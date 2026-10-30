# Personal Reminder Website --- Project Overview

## 1. Project purpose

Build a private, single-user website that lets the owner create
reminders and receive email notifications at the scheduled time, even
when the website, browser, or laptop is closed.

The application must support one-time and recurring reminders.
Reliability, privacy, and a simple interface are more important than
adding unnecessary features.

## 2. Main user flow

1.  The owner signs in.
2.  The owner creates a reminder with a title, optional description,
    date, time, and recurrence rule.
3.  The reminder is saved in the database.
4.  A server-side scheduler checks for due reminders.
5.  The backend sends an email to the owner's configured Gmail address.
6.  The system records the delivery attempt.
7.  For recurring reminders, the next occurrence is calculated and
    scheduled.

The browser must never be responsible for sending scheduled emails.
Reminders must continue to work when the browser is closed.

## 3. Technology stack

  Area               Technology
  ------------------ ------------------------------------------------
  Frontend           HTML, CSS, vanilla JavaScript
  Hosting            Netlify (free tier, subject to current limits)
  Authentication     Supabase Auth
  Database           Supabase PostgreSQL
  Access control     Supabase Row Level Security (RLS)
  Scheduler          Supabase Cron (`pg_cron`)
  Backend jobs       Supabase Edge Functions
  Email delivery     Resend API
  Default timezone   `Asia/Kolkata`

Use official SDKs and supported deployment methods. Before
implementation, verify current free-tier limits and any restrictions in
the official documentation. Do not promise uninterrupted or second-level
delivery: scheduled emails may arrive a little after the selected time.

## 4. Scope and features

### Authentication

-   Private login for the owner.
-   Password reset.
-   No public sign-up page in production.
-   Create the initial owner account through a documented secure setup
    process.
-   Do not hardcode passwords or expose service credentials.

### Dashboard

-   Today's reminders.
-   Upcoming reminders.
-   Overdue reminders.
-   Completed reminders.
-   Clear status labels and a quick way to add a reminder.

### Reminder management

-   Create, view, edit, delete, complete, and snooze reminders.
-   Fields: title, description, scheduled date/time, timezone,
    recurrence rule, status.
-   Validate required fields and prevent invalid dates.
-   Display dates and times in the owner's selected timezone.

### Recurrence

-   One-time.
-   Daily.
-   Weekly, with selected weekdays.
-   Monthly, on a selected day.
-   Define and document what happens when a monthly day does not exist
    (for example, the 31st in a shorter month).
-   Calculate the next occurrence server-side.
-   Do not create duplicate future occurrences.

### Email

-   Send to the owner's configured Gmail address.
-   Use Resend from a server-side Edge Function.
-   Store the Resend API key only as a Supabase Edge Function secret.
-   Verify a sending domain in Resend before production use. Do not
    assume a personal Gmail address can be used as the sender domain.
-   Provide a clear setup guide for domain verification and sender
    configuration.
-   Record sent and failed attempts.

### History and settings

-   Reminder delivery history with timestamps and status.
-   Owner's destination email.
-   Timezone setting, defaulting to `Asia/Kolkata`.
-   Basic account settings and logout.

## 5. Suggested database design

The agent may refine this schema, but must explain any changes before
applying them.

### `profiles`

-   `id` UUID, primary key, references `auth.users(id)`
-   `display_name` text
-   `destination_email` text
-   `timezone` text, default `Asia/Kolkata`
-   `created_at` timestamptz

### `reminders`

-   `id` UUID, primary key
-   `user_id` UUID, references `auth.users(id)`
-   `title` text, required
-   `description` text, nullable
-   `scheduled_at` timestamptz, required
-   `timezone` text
-   `recurrence_type` text: `none`, `daily`, `weekly`, `monthly`
-   `recurrence_days` integer array, nullable (for weekly recurrence;
    document weekday numbering)
-   `recurrence_month_day` integer, nullable
-   `next_run_at` timestamptz, nullable
-   `status` text: `active`, `completed`, `cancelled`
-   `created_at` timestamptz
-   `updated_at` timestamptz

### `reminder_logs`

-   `id` UUID, primary key
-   `reminder_id` UUID, references `reminders(id)`
-   `user_id` UUID, references `auth.users(id)`
-   `scheduled_for` timestamptz
-   `attempted_at` timestamptz
-   `sent_at` timestamptz, nullable
-   `email_status` text: `pending`, `sent`, `failed`
-   `provider_message_id` text, nullable
-   `error_message` text, nullable
-   A unique idempotency constraint for a reminder and its scheduled
    occurrence.

Add indexes for due-reminder lookup and user-owned reminder queries. Use
appropriate foreign-key delete behavior.

## 6. Scheduling and duplicate protection

Implement a server-side process that runs approximately once per minute:

1.  Find active reminders where `next_run_at` is due.
2.  Claim due occurrences safely using a database transaction or
    equivalent concurrency-safe mechanism.
3.  Use a unique idempotency key for each reminder occurrence.
4.  Send the email through Resend.
5.  Record the provider response and delivery status.
6.  For one-time reminders, mark the reminder completed after successful
    sending.
7.  For recurring reminders, calculate the next occurrence and update
    `next_run_at` only after the current occurrence is safely handled.
8.  Handle failures with a bounded retry strategy and visible failed
    status. Never silently drop an occurrence.
9.  Make retries idempotent. Avoid sending duplicate emails if a
    function times out after the provider accepted an email.
10. Log operational errors without logging API keys or other secrets.

Document the exact delivery guarantees and limitations. A scheduler
running every minute does not guarantee an email will arrive at the
exact second.

## 7. Security requirements

-   Enable RLS on all user-owned tables.
-   Policies must restrict reads and writes to the authenticated owner.
-   The Edge Function must validate the scheduled job request.
-   Keep the Supabase service-role key and Resend API key on the server
    only.
-   Never put secrets in frontend JavaScript, committed files,
    screenshots, or Git history.
-   Use environment variables and Supabase secrets.
-   Do not expose public registration in production.
-   Protect all dashboard routes and handle expired sessions.
-   Validate input on both client and server.
-   Add basic rate limiting or abuse protection where appropriate.

## 8. Important free-tier and deployment checks

Before choosing final deployment settings, verify current provider
documentation for: - Supabase project pausing, database size, Edge
Function and Cron limits. - Resend free email limits and verified-domain
requirements. - Netlify build and bandwidth limits.

A free tier can change and may have inactivity or usage restrictions.
Explain any risk that could interrupt reminders. Do not claim the system
is guaranteed to be free forever. The owner may need to purchase a
domain to verify the email sender with Resend.

## 9. UI direction

-   Clean, minimal, responsive design.
-   Mobile-first layout.
-   Clear typography and readable contrast.
-   Use one external `styles.css` file for styling.
-   Keep HTML, CSS, and JavaScript separated.
-   Use professional icons; do not use emoji as interface icons.
-   Avoid charts and unrelated modules.
-   Make adding a reminder quick and obvious.
-   Show loading, empty, success, and error states.

## 10. Project structure

Use a clear structure similar to:

``` text
personal-reminder/
├── index.html
├── login.html
├── dashboard.html
├── assets/
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── config.example.js
│   │   ├── auth.js
│   │   ├── dashboard.js
│   │   ├── reminders.js
│   │   └── supabase-client.js
│   └── images/
├── supabase/
│   ├── migrations/
│   └── functions/
│       └── send-due-reminders/
├── docs/
│   ├── SETUP.md
│   └── DEPLOYMENT.md
├── .gitignore
└── README.md
```

Adjust this structure if needed, but keep frontend and backend
responsibilities clearly separated. Never commit real secrets.

## 11. Definition of done

The project is complete only when: - The owner can securely log in. -
The owner can create, edit, delete, complete, and snooze reminders. -
One-time and recurring reminders calculate correctly. - A due reminder
is sent by the backend while the browser is closed. - Duplicate sending
is prevented as far as the provider/API workflow permits. - Failed
attempts are recorded and recoverable. - RLS and server-side secrets are
verified. - Mobile layout works. - Deployment and setup instructions are
complete. - A real end-to-end test email has been received by the owner.

## 12. Development rules for the coding agent

-   First inspect the existing folder; do not overwrite useful work.
-   Build in the phases in `PHASE_WISE_PROMPTS.md`.
-   Do not skip ahead or combine phases without approval.
-   Do not ask the owner to write code. The owner will create the
    project folder and provide credentials/configuration when required.
-   Ask only when a decision or secret that cannot be safely configured
    by the agent is required.
-   Never invent API keys, email addresses, project IDs, or passwords.
-   Explain exactly where the owner must obtain and enter each required
    value.
-   After each phase, run relevant checks and report changed files,
    completed work, and anything the owner must do.
-   Do not claim a feature works until it has been tested.
