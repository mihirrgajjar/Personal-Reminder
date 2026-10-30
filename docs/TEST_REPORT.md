# Personal Reminder - Phase 7 Test & Security Report

**Date**: 2026-10-30  
**Status**: All Automated & Architecture Test Cases Passed  
**Repository**: [github.com/mihirrgajjar/Personal-Reminder](https://github.com/mihirrgajjar/Personal-Reminder.git)

---

## 1. Test Cases & Verification Results

| # | Test Scenario | Mechanism & Implementation | Status | Notes |
|---|---|---|:---:|---|
| **1** | **One-time reminder sends while browser is closed** | Scheduled via Supabase Cron (`pg_cron`) + Edge Function; marked completed in DB. | **PASSED** | Runs server-side independently of browser state. |
| **2** | **Daily reminder advances next occurrence** | `calculate_next_occurrence` advances by 1 calendar day preserving wall-clock time in reminder timezone. | **PASSED** | Tested across calendar days; preserves exact hour/min. |
| **3** | **Weekly reminder sends only on selected days** | Weekday numbering (`0=Sun` to `6=Sat`); candidate cycle verifies `recurrence_days.includes(dow)`. | **PASSED** | Verified for multi-day schedules (Mon/Wed/Fri) and weekend wrap-around. |
| **4** | **Monthly reminder handles short months & leap years** | Days in target month calculated; clamps `Math.min(targetDay, daysInMonth)`. | **PASSED** | Verified: Jan 31 -> Feb 28 (2027) & Feb 29 (2028 leap year). |
| **5** | **Editing reminder updates scheduled occurrence** | `reminders.js` & `dashboard.js` update `scheduled_at` and `next_run_at`. | **PASSED** | Updating rule recomputes next run and stores in database. |
| **6** | **Deleting or cancelling prevents future sends** | `claim_due_reminders` filters strictly by `status = 'active'`. Deleting cascades to logs. | **PASSED** | Cancelled/deleted items are skipped by scheduler. |
| **7** | **Failed email logged and retried safely** | Stored in `reminder_logs` with status `failed` and provider error message; retry backoff (+5 min, max 3 attempts). | **PASSED** | Failed attempts remain visible; never silently dropped. |
| **8** | **No duplicate sends under concurrent scheduler runs** | `SELECT ... FOR UPDATE SKIP LOCKED` on reminders + `UNIQUE (reminder_id, scheduled_for)` in `reminder_logs`. | **PASSED** | Concurrent or overlapping cron runs cannot claim the same row. |
| **9** | **Expired login sessions handled** | `requireAuth()` catches expired tokens and redirects unauthenticated requests to `login.html`. | **PASSED** | Tokens refreshed automatically; expired sessions forced to login. |
| **10** | **RLS blocks unauthorized access** | Strict RLS on `profiles`, `reminders`, `reminder_logs` with `auth.uid() = user_id`. | **PASSED** | Non-owners cannot read or modify another user's rows. |
| **11** | **Mobile and desktop layouts responsive** | CSS Flexbox & Grid layouts, media queries, touch-friendly buttons, and modals. | **PASSED** | Tested and functional across mobile, tablet, and desktop viewports. |
| **12** | **Timezone display and scheduling accuracy** | Displayed in owner's configured timezone (default `Asia/Kolkata`); preserved across DST in US timezones. | **PASSED** | Tested in `America/New_York` across spring forward; retains wall-clock time. |

---

## 2. Security Audit & Invariant Review

### 2.1 Repository Secrets Scan
- **Grep & Regex Scan**: Scanned all tracked files for API keys (`re_*`), JWT service-role keys (`eyJ*`), passwords, and credentials.
- **Result**: Zero secrets committed. All public frontend configurations contain only non-secret placeholders (`config.example.js`). Real configs and `.env*` files are strictly ignored by `.gitignore`.

### 2.2 Row Level Security (RLS) Audit
- **`public.profiles`**: RLS enabled. Policies ensure `auth.uid() = id`.
- **`public.reminders`**: RLS enabled. Policies ensure `auth.uid() = user_id` for SELECT, INSERT, UPDATE, DELETE.
- **`public.reminder_logs`**: RLS enabled. Policies ensure `auth.uid() = user_id` for all operations.
- **Security Definer Functions**: `claim_due_reminders` and `complete_reminder_occurrence` are granted strictly to `service_role`.

### 2.3 Edge Function Authorization
- Endpoint `send-due-reminders` verifies `Authorization: Bearer <CRON_SECRET>`. Unauthenticated requests receive `401 Unauthorized`.
- Operational logs mask all recipient email addresses (e.g. `mi***@gmail.com`).

---

## 3. Automated Test Suite Summary

- **Recurrence Engine Tests** (`tests/recurrence.test.js`): 10 passed, 0 failed.
- **System Integrity & Security Suite** (`tests/system_integrity.test.js`): 14 passed, 0 failed.
- **Total Test Assertions**: 24 passed, 0 failed.

---

## 4. Remaining Operational Notes & Handover Requirements

1. **Resend Domain Verification**:
   - The owner must configure DNS records at their domain registrar to send live emails from a custom domain (e.g., `reminders@yourdomain.com`).
   - Sandbox emails can be sent to the owner's registered Resend account using `onboarding@resend.dev`.
2. **Supabase Free Tier Inactivity**:
   - On Supabase free tier, projects pause after 7 days of total inactivity if no database queries are made. The `pg_cron` schedule running every minute keeps the project active.
