# Personal Reminder - Setup Guide

This document explains how to set up the Personal Reminder web application, connect your Supabase backend, apply database migrations, and create the owner account securely.

---

## 1. Local Development Quickstart

Because the project is built with static HTML, CSS, and vanilla JavaScript, you can run it immediately with any static server:

```bash
# Using Python
python -m http.server 8080

# Or using Node.js
npx serve -l 8080 .
```

Open your browser to: `http://localhost:8080`

---

## 2. Supabase Project Setup (Phase 2 & Phase 3)

### Step 2.1: Create your Supabase Project
1. Log in to [supabase.com](https://supabase.com) and click **"New Project"**.
2. Select your organization, choose a project name (e.g. `personal-reminder`), enter a strong database password, and select your preferred region (e.g. `ap-south-1` for Mumbai / India).
3. Wait for the project to provision.

### Step 2.2: Obtain Frontend Public Credentials
1. In your Supabase Project Dashboard, click the **Settings** (gear icon) in the left sidebar.
2. Select **API** (or **Data API** in newer dashboards).
3. Find:
   - **Project URL**: (e.g., `https://abcdefghijklm.supabase.co`)
   - **Project API Keys** -> `anon` / `public`: (e.g., `eyJhbGci...`)
4. Create your local config file:
   - Make a copy of `assets/js/config.example.js` and name it `assets/js/config.js` (this file is ignored by Git in `.gitignore`).
   - Fill in your values:
     ```javascript
     window.APP_CONFIG = {
       SUPABASE_URL: 'https://abcdefghijklm.supabase.co',
       SUPABASE_ANON_KEY: 'eyJhbGci...',
       DEFAULT_TIMEZONE: 'Asia/Kolkata',
       DEMO_MODE: false
     };
     ```
> [!IMPORTANT]
> **NEVER** use or expose the `service_role` key in frontend code. Only the public `anon` key is safe for browser use.

### Step 2.3: Apply Database Migrations in Supabase SQL Editor

#### Migration 1: Owner Profiles Table
1. In Supabase Dashboard, open the **SQL Editor** from the left navigation and click **"+ New Query"**.
2. Open [supabase/migrations/20261030000001_create_profiles.sql](file:///d:/Projects/Personal_reminder/supabase/migrations/20261030000001_create_profiles.sql).
3. Paste its contents and click **"Run"**.
4. This creates:
   - The `public.profiles` table with foreign key `auth.users(id)` and cascading deletes.
   - Row Level Security (RLS) policies ensuring only the authenticated user can read or modify their own record.
   - The automatic `on_auth_user_created` trigger that inserts a profile whenever a new user is created.

#### Migration 2: Reminders & Reminder Logs (Phase 3)
1. In the **SQL Editor**, click **"+ New Query"**.
2. Open [supabase/migrations/20261030000002_create_reminders_and_logs.sql](file:///d:/Projects/Personal_reminder/supabase/migrations/20261030000002_create_reminders_and_logs.sql).
3. Paste its contents and click **"Run"**.
4. This creates:
   - The `public.reminders` table (with title, description, scheduled_at timestamptz, timezone, recurrence settings, and next_run_at).
   - The `public.reminder_logs` table with an idempotency constraint `UNIQUE (reminder_id, scheduled_for)` to guarantee duplicate email protection.
   - Performance indexes on `(status, next_run_at)`, `user_id`, and `scheduled_at`.
   - Strict Row Level Security (RLS) policies ensuring all reads, inserts, updates, and deletes are restricted to the owner (`auth.uid() = user_id`).

#### Migration 3: Recurrence Calculation Engine (Phase 4)
1. In the **SQL Editor**, click **"+ New Query"**.
2. Open [supabase/migrations/20261030000003_create_recurrence_engine.sql](file:///d:/Projects/Personal_reminder/supabase/migrations/20261030000003_create_recurrence_engine.sql).
3. Paste its contents and click **"Run"**.
4. This creates the PostgreSQL function `public.calculate_next_occurrence(...)` which computes next scheduled occurrences in SQL, preserving wall-clock time in the reminder's timezone and clamping shorter months.

### Step 2.4: Create the Owner Account (Secure Single-User Procedure)
Since this is a strictly private single-user application, public sign-ups must remain disabled.

1. In Supabase Dashboard, go to **Authentication** -> **Users**.
2. Click **"Add User"** -> **"Create user"**.
3. Enter:
   - **Email**: Your personal Gmail address where you wish to receive notifications.
   - **Password**: A strong, unique master password.
   - Check **"Auto Confirm User?"** to immediately mark the email verified.
4. Click **"Create User"**.
5. The trigger automatically creates an entry in `public.profiles` with `display_name = 'Owner'` and `timezone = 'Asia/Kolkata'`.

### Step 2.5: Disable Public Sign-ups
To guarantee zero unauthorized registrations:
1. In Supabase Dashboard, navigate to **Authentication** -> **Providers** -> **Email**.
2. Uncheck **"Enable Sign-up"** (or toggle "Allow new users to sign up" to OFF).
3. Save changes. Now, only users manually created by you can sign in.

---

## 3. Testing Authentication & Session Persistence

1. Open `http://localhost:8080/login.html`.
2. Enter your owner credentials and click **Sign In**.
3. Upon authentication, you will be redirected to `dashboard.html`.
4. Refresh the page: the session is seamlessly restored via Supabase Auth without logging out.
5. In the dashboard header, click **Sign Out**: your session will be cleared and you will be returned to `login.html`.
6. Try opening `dashboard.html` directly in an incognito window: the route guard automatically redirects unauthenticated requests back to `login.html`.

---

## 4. Testing Reminder CRUD & Database Operations

With your owner account signed in:
1. **Create Reminder**: Click **"+ New Reminder"**, enter title, date, time, and recurrence rule. Click **Save Reminder**. The record will be inserted directly into Supabase `public.reminders`.
2. **Edit Reminder**: Click the edit pencil icon on any card, adjust the fields, and save.
3. **Toggle Completion**: Click the circular checkmark button to mark a reminder complete or active.
4. **Snooze**: Click **Snooze** to postpone by +1 hour, +3 hours, or until tomorrow morning.
5. **Delete**: Click the trash icon to delete a reminder.
6. **Data Persistence**: Sign out and log back in, or refresh the page; all reminders remain safely preserved in your Supabase database.

---

## 5. Recurrence Engine & Automated Tests (Phase 4)

### Recurrence Rules & Behavior
- **One-time (`none`)**: Not recurring; returns null.
- **Daily (`daily`)**: Advances by 1 calendar day, preserving exact wall-clock hour and minute in the owner's timezone.
- **Weekly (`weekly`)**: Repeats on selected weekdays.
  - **Weekday Numbering**: `0 = Sunday`, `1 = Monday`, `2 = Tuesday`, `3 = Wednesday`, `4 = Thursday`, `5 = Friday`, `6 = Saturday`.
- **Monthly (`monthly`)**: Repeats on the chosen calendar day (1–31).
  - **Short Month Clamping**: If a target day does not exist in the upcoming month (e.g. Day 31 in February or April), the engine clamps to the last valid day of that month (Feb 28 in non-leap years, Feb 29 in leap years, Apr 30, etc.).
- **Advance Guarantee**: Advances from the intended scheduled occurrence, not the time of trigger/invocation.

### Running Automated Unit Tests
To run the automated recurrence test suite:
```bash
node tests/recurrence.test.js
```
The test suite validates:
- One-time rejection
- Daily preservation across days
- Weekly schedule advancement and weekend rollover
- Monthly day clamping (Jan 31 -> Feb 28/29)
- Leap year edge cases (2028 leap year)
- Year boundary rollovers (Dec 31 -> Jan 31)
- Daylight saving transitions in US timezones
- Historical occurrence catch-up without infinite loops
