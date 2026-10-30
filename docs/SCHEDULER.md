# Personal Reminder - Server-Side Scheduler & Job Processing

This document explains the architecture, concurrency safeguards, idempotency controls, and deployment instructions for the server-side reminder scheduler.

---

## 1. System Architecture

```text
+-------------------+
|  Supabase pg_cron | (Runs every minute)
+---------+---------+
          | Calls Edge Function or triggers database worker
          v
+-----------------------------+
| Edge Function:              |
| send-due-reminders          | (Authenticated via CRON_SECRET)
+--------------+--------------+
               |
               v
+-----------------------------+
| PostgreSQL Function:        |
| claim_due_reminders()       | (SELECT ... FOR UPDATE SKIP LOCKED)
+--------------+--------------+
               |
               v (Locks batch, inserts pending claim in reminder_logs)
+-----------------------------+
| Dispatch Worker             | (Phase 5: Dry-Run Mode / Phase 6: Resend API)
+--------------+--------------+
               |
               v
+-----------------------------+
| complete_reminder_          | (Records delivery result, advances recurrence)
| occurrence()                |
+-----------------------------+
```

---

## 2. Concurrency Safety & Duplicate Prevention

### 2.1 Concurrency Locking (`FOR UPDATE SKIP LOCKED`)
When `claim_due_reminders(p_batch_size)` is called:
- It selects due reminders where `status = 'active'` and `next_run_at <= NOW()`.
- It applies `FOR UPDATE SKIP LOCKED`.
- If two scheduler runs overlap, the second job immediately skips the rows already locked by the first, completely preventing duplicate claims.

### 2.2 Database Idempotency Constraint
- In `reminder_logs`:
  ```sql
  CONSTRAINT uq_reminder_occurrence_idempotency UNIQUE (reminder_id, scheduled_for)
  ```
- Before an email can be sent, an initial `pending` claim is inserted into `reminder_logs`.
- If a record already exists for that specific `(reminder_id, scheduled_for)`, the unique constraint blocks duplicate inserts, ensuring exactly one attempt per scheduled timestamp.

### 2.3 Limits of Exactly-Once Delivery & Timeout Handling
In distributed email delivery, true "exactly-once" delivery across network boundaries is mathematically impossible if a third-party SMTP provider accepts an email but network disconnection occurs before the ACK reaches our server.

Our design implements the safest industry standard:
1. **Pre-commit claim**: Occurrence is marked `pending` in `reminder_logs` before contacting provider.
2. **Idempotent provider payload**: In Phase 6, Resend idempotency headers or matching occurrence metadata are sent.
3. **Bounded retries**: Failed attempts are retried up to 3 times with exponential backoff (5-minute retry intervals).
4. **Visibility**: Failed attempts remain visible in the database logs and dashboard rather than being silently dropped.

---

## 3. Configuring Supabase Cron (`pg_cron`)

In the Supabase Dashboard SQL Editor, run:

```sql
-- 1. Enable the pg_cron and pg_net extensions (enabled by default on Supabase projects)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Schedule the edge function to run every minute
SELECT cron.schedule(
  'process-due-reminders-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<your-project-ref>.supabase.co/functions/v1/send-due-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR_CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

To view or manage active cron jobs:
```sql
SELECT * FROM cron.job;
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
```

---

## 4. Edge Function Secrets

In production, configure the following secrets in your Supabase project:

```bash
# Using Supabase CLI:
supabase secrets set CRON_SECRET="your-secure-random-secret"
supabase secrets set DRY_RUN="true" # (Set to false when Resend is connected in Phase 6)
```

---

## 5. Local Dry-Run Testing

You can trigger the Edge Function locally or test the database claiming logic directly in PostgreSQL:

### Test in Supabase SQL Editor:
```sql
-- 1. Check if any reminders are currently due
SELECT * FROM public.claim_due_reminders(10);

-- 2. Complete the claimed occurrence
-- SELECT public.complete_reminder_occurrence('<reminder-id>', '<scheduled-timestamp>', 'sent', 'dryrun_manual_id', NULL);
```

### Test via cURL:
```bash
curl -X POST "https://<your-project-ref>.supabase.co/functions/v1/send-due-reminders" \
  -H "Authorization: Bearer <YOUR_CRON_SECRET>" \
  -H "Content-Type: application/json"
```
Response:
```json
{
  "success": true,
  "dryRun": true,
  "processedCount": 1,
  "results": [
    {
      "reminder_id": "...",
      "title": "...",
      "scheduled_for": "...",
      "status": "sent",
      "provider_message_id": "dryrun_msg_...",
      "error": null
    }
  ]
}
```
