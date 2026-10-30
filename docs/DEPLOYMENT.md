# Personal Reminder - Production Deployment & Handover Guide

This document provides step-by-step instructions for deploying the Personal Reminder web application to Netlify and connecting it to Supabase and Resend in production.

---

## 1. Production Architecture Overview

| Component | Provider | Role & Implementation |
|---|---|---|
| **Frontend** | Netlify | Static hosting with automated continuous deployment from GitHub |
| **Authentication & Database** | Supabase | Managed PostgreSQL, Row Level Security (RLS), User Management |
| **Recurrence Engine** | PostgreSQL / JS | Deterministic recurrence calculations in SQL and client |
| **Scheduler** | Supabase `pg_cron` | Automated minute-by-minute worker trigger |
| **Worker / Automation** | Supabase Edge Functions | Deno function claiming due batches (`FOR UPDATE SKIP LOCKED`) |
| **Email Delivery** | Resend API | Transactional email provider with verified custom domain |

---

## 2. Step-by-Step Production Deployment

### Step 2.1: Deploy Frontend to Netlify

1. Log in to [Netlify](https://app.netlify.com).
2. Click **"Add new site"** -> **"Import an existing project"** -> **"GitHub"**.
3. Select your repository: **`mihirrgajjar/Personal-Reminder`**.
4. Configure Build settings:
   - **Branch to deploy**: `main`
   - **Build command**: `node scripts/generate-config.js`
   - **Publish directory**: `.`
5. Under **Environment variables**, click **"Add environment variables"** and configure:
   - `SUPABASE_URL`: Your Supabase Project URL (`https://<project-ref>.supabase.co`)
   - `SUPABASE_ANON_KEY`: Your Supabase Public `anon` Key
   - `DEFAULT_TIMEZONE`: `Asia/Kolkata`
6. Click **"Deploy site"**.
7. Once deployed, note your production Netlify URL (e.g. `https://personal-reminder-app.netlify.app`).

---

### Step 2.2: Configure Supabase Authentication for Production Domain

1. In your Supabase Dashboard, open **Authentication** -> **URL Configuration**.
2. Set **Site URL** to your Netlify URL:
   ```text
   https://your-site-name.netlify.app
   ```
3. Under **Redirect URLs**, add:
   ```text
   https://your-site-name.netlify.app/login.html
   https://your-site-name.netlify.app/dashboard.html
   ```
4. Click **Save**.

---

### Step 2.3: Execute Database Migrations

In your Supabase Dashboard, open the **SQL Editor** and execute the 4 migration scripts in order:

1. [supabase/migrations/20261030000001_create_profiles.sql](file:///d:/Projects/Personal_reminder/supabase/migrations/20261030000001_create_profiles.sql) — Profiles table, RLS, and auto-creation trigger.
2. [supabase/migrations/20261030000002_create_reminders_and_logs.sql](file:///d:/Projects/Personal_reminder/supabase/migrations/20261030000002_create_reminders_and_logs.sql) — Reminders table, delivery logs, idempotency constraints, and RLS.
3. [supabase/migrations/20261030000003_create_recurrence_engine.sql](file:///d:/Projects/Personal_reminder/supabase/migrations/20261030000003_create_recurrence_engine.sql) — Server-side PostgreSQL recurrence calculation engine.
4. [supabase/migrations/20261030000004_create_scheduler_and_job_queue.sql](file:///d:/Projects/Personal_reminder/supabase/migrations/20261030000004_create_scheduler_and_job_queue.sql) — Concurrency-safe claiming (`FOR UPDATE SKIP LOCKED`) and occurrence completion.

---

### Step 2.4: Create Owner Account & Lock Public Registrations

1. Go to Supabase Dashboard -> **Authentication** -> **Users**.
2. Click **"Add User"** -> **"Create user"**:
   - Enter your owner email (e.g. your personal Gmail).
   - Enter a strong master password.
   - Check **"Auto Confirm User?"** and click **"Create User"**.
3. Disable public registrations:
   - Go to **Authentication** -> **Providers** -> **Email**.
   - Uncheck **"Enable Sign-up"** and click **Save**.

---

### Step 2.5: Deploy Edge Function & Set Secrets

From your local machine (using Supabase CLI):

```bash
# 1. Login to Supabase CLI
npx supabase login

# 2. Link your project
npx supabase link --project-ref <your-project-ref>

# 3. Configure production secrets
npx supabase secrets set RESEND_API_KEY="re_your_api_key_here"
npx supabase secrets set RESEND_FROM_EMAIL="reminders@yourdomain.com"
npx supabase secrets set CRON_SECRET="your-secure-random-secret"
npx supabase secrets set DRY_RUN="false"

# 4. Deploy the Edge Function
npx supabase functions deploy send-due-reminders
```

---

### Step 2.6: Activate Supabase Cron (`pg_cron`)

In the Supabase SQL Editor, enable extensions and schedule the worker:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

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

---

## 3. End-to-End Verification Checklist

Perform these tests on your live Netlify deployment:

1. **Owner Login**: Visit `https://your-site.netlify.app/login.html` and sign in.
2. **Session Persistence**: Refresh the browser and verify the session is retained.
3. **Route Guard**: Open an incognito browser window and visit `/dashboard.html`; verify redirection to `/login.html`.
4. **Create Live One-Time Reminder**:
   - Create a reminder scheduled for 2 minutes from the current time.
   - Close the browser and laptop window.
   - Verify the reminder email arrives in your Gmail inbox at the scheduled time.
   - Verify in the dashboard that the reminder is marked **Completed**.
5. **Create Live Recurring Reminder**:
   - Create a daily reminder scheduled for 2 minutes ahead.
   - Once dispatched, check the dashboard to confirm `next_run_at` automatically advanced by 1 calendar day.
6. **Delivery History**:
   - In Dashboard -> Settings -> **Email Delivery History**, click **Refresh Logs** and verify the provider message ID and status `sent`.

---

## 4. Rollback Procedures

### Frontend Rollback
- In the Netlify Dashboard -> **Deploys**, select any previous successful deploy and click **"Publish deploy"**. Netlify rolls back instantly with zero downtime.

### Database / Function Rollback
- If a migration needs to be rolled back, execute the corresponding `DROP TRIGGER`, `DROP FUNCTION`, or table adjustments in the Supabase SQL Editor.
- Edge functions can be redeployed to an earlier Git commit using:
  ```bash
  git checkout <commit-hash>
  npx supabase functions deploy send-due-reminders
  ```

---

## 5. Free-Tier Usage & Limitations Advisory

- **Supabase (Free Tier)**:
  - PostgreSQL database limit: 500 MB.
  - Edge Functions: 500,000 invocations / month.
  - Inactivity: Projects pause after 7 days of zero activity; the minute-by-minute `pg_cron` schedule maintains database activity and prevents inactivity pausing.
- **Resend (Free Tier)**:
  - 3,000 emails / month (100 emails / day).
  - Custom domain required for production sending to prevent Gmail DMARC rejection.
- **Netlify (Free Tier)**:
  - 100 GB bandwidth / month; 300 build minutes / month.
