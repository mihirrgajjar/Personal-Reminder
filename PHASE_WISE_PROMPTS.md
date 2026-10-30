# Personal Reminder Website --- Phase-wise Development Prompts

Give these phases to the coding agent in order. The agent is responsible
for creating the application, code, configuration templates, database
migrations, tests, and deployment instructions. The owner will create
the project folder and provide account credentials or secrets only when
requested.

## Global instructions

Read `PROJECT_OVERVIEW.md` before starting.

-   Work only inside the project folder.
-   Use HTML, CSS, vanilla JavaScript, Supabase, Supabase Edge
    Functions/Cron, and Resend.
-   Keep the UI mobile-friendly and simple.
-   Keep CSS in the external `assets/css/styles.css` file.
-   Do not add charts, AI features, team features, or unrelated
    functionality.
-   Never put service-role keys, Resend keys, or other secrets in
    frontend code or Git.
-   Do not invent credentials or claim deployment/testing succeeded
    without evidence.
-   Finish and test one phase before moving to the next.
-   If a required account, secret, domain, or manual action is missing,
    pause and give the owner exact step-by-step instructions. Continue
    with work that does not depend on it.
-   Use database migrations for schema changes. Do not rely on
    undocumented manual SQL edits.
-   Keep a `README.md`, `docs/SETUP.md`, and `docs/DEPLOYMENT.md`
    updated.

------------------------------------------------------------------------

## Phase 1 --- Project setup and frontend foundation

**Prompt**

Set up the project structure described in `PROJECT_OVERVIEW.md`. Create
the initial responsive interface using HTML, CSS, and vanilla
JavaScript.

Build: - Login page. - Dashboard layout with navigation. - Summary
sections for today's, upcoming, overdue, and completed reminders. -
Reminder list with realistic placeholder data clearly marked as demo
data. - Add/edit reminder form with title, description, date, time,
recurrence selection, and weekly-day selection. - Reminder detail/edit
experience. - Settings page layout for destination email and timezone. -
Empty, loading, success, and error states.

Requirements: - Use a single external stylesheet. - Use professional
icons, not emoji. - Ensure mobile and desktop layouts work. - Do not
connect Supabase yet. - Do not imply that demo reminders are actually
scheduled or emailed.

**Acceptance checks** - Pages load locally. - Navigation works. - Forms
validate required fields. - Layout works at mobile and desktop widths. -
No inline CSS or committed secrets.

At the end, report the files created and how to run the frontend
locally. Stop for approval before Phase 2.

------------------------------------------------------------------------

## Phase 2 --- Supabase setup and private authentication

**Prompt**

Integrate Supabase Auth and prepare the database project configuration.

Tasks: 1. Add the Supabase JavaScript client using a supported
installation method suitable for the static frontend. 2. Create a safe
configuration template such as `config.example.js`; do not include real
credentials. 3. Implement login, logout, session restoration, protected
dashboard access, and password reset. 4. Do not expose public
registration in the production UI. 5. Provide a secure owner-account
creation procedure. Prefer creating the initial user through the
Supabase dashboard or a secure administrative method. 6. Create the
initial SQL migration for `profiles`, with the correct foreign key and
RLS policy. 7. Create or update the owner profile after authentication.
8. Add clear handling for invalid credentials, expired sessions, and
network errors.

Ask the owner for the Supabase project URL and publishable/anon key only
when needed. Explain where to find them. These frontend values are
expected to be public; never request or expose the service-role key.

**Acceptance checks** - Owner can log in and log out. - Refreshing the
page restores a valid session. - Unauthenticated users cannot access the
dashboard. - Password reset flow is configured and documented. - RLS is
enabled and tested.

Stop for approval before Phase 3.

------------------------------------------------------------------------

## Phase 3 --- Reminder database and CRUD

**Prompt**

Implement reminder storage and management.

Tasks: 1. Create a migration for the `reminders` and `reminder_logs`
tables based on `PROJECT_OVERVIEW.md`. 2. Add indexes and constraints
for efficient due-reminder lookup and idempotency. 3. Enable RLS on all
user-owned tables. 4. Write policies so the authenticated owner can
access only their own records. 5. Connect the reminder form and list to
Supabase. 6. Implement create, read, update, delete, mark complete, and
snooze. 7. Store scheduled dates as timezone-aware timestamps
(`timestamptz`) and preserve the owner's timezone. 8. Add form
validation and clear user feedback. 9. Ensure editing or deleting a
reminder does not accidentally alter unrelated delivery logs.

**Acceptance checks** - Create, edit, delete, complete, and snooze all
work. - Data remains after logout and login. - RLS prevents access to
records belonging to another user. - Invalid or past dates are handled
clearly. - No fake success messages.

Stop for approval before Phase 4.

------------------------------------------------------------------------

## Phase 4 --- Recurring reminder engine

**Prompt**

Implement recurrence calculations on the backend, not only in browser
JavaScript.

Support: - One-time. - Daily. - Weekly on selected weekdays. - Monthly
on a selected calendar day.

Tasks: 1. Define recurrence data fields and weekday numbering in
documentation. 2. Implement a tested server-side function that
calculates the next occurrence in the reminder's timezone. 3. Handle
daylight-saving transitions for any timezone, even though the default is
`Asia/Kolkata`. 4. Define monthly behavior when the selected day does
not exist in a month. Use the last day of that month and document this
behavior. 5. Ensure a recurring reminder advances from the intended
scheduled occurrence, not from the time the email happened to be sent.
6. Prevent duplicate occurrences and invalid infinite loops. 7. Add unit
tests for month boundaries, year boundaries, leap years, weekly
schedules, and timezone conversions.

**Acceptance checks** - Recurrence calculations pass automated tests. -
The UI displays the next scheduled occurrence accurately. - Editing a
recurrence rule updates the next occurrence safely. - A one-time
reminder is not treated as recurring.

Stop for approval before Phase 5.

------------------------------------------------------------------------

## Phase 5 --- Server-side scheduler and safe job processing

**Prompt**

Build the server-side reminder scheduler with Supabase Cron and Edge
Functions.

Tasks: 1. Create the Edge Function that processes due reminders. 2.
Configure Supabase Cron to invoke it approximately once per minute,
using the supported Supabase scheduling approach. 3. Authenticate
scheduled invocations with a secret. Do not expose an unprotected public
job endpoint. 4. Claim due reminders safely using database transactions
or an equivalent concurrency-safe approach. 5. Use a unique idempotency
key for each reminder occurrence. 6. Prevent two overlapping scheduler
runs from sending the same occurrence twice. 7. Record job attempts and
errors. 8. Add bounded retries with backoff for temporary failures. 9.
Handle the case where an email provider accepts a message but the
function times out before recording the result. Explain the limits of
exactly-once email delivery and design the safest practical approach.
10. Add operational logs that never include credentials.

Do not send real emails yet; use a test/dry-run mode until Phase 6.

**Acceptance checks** - Scheduler invokes the function. - Due reminders
are identified correctly. - Concurrent invocations do not claim the same
occurrence. - Idempotency constraints work. - Failed jobs remain visible
and recoverable. - Scheduler and function setup is documented.

Stop for approval before Phase 6.

------------------------------------------------------------------------

## Phase 6 --- Resend email integration

**Prompt**

Integrate Resend for reminder email delivery.

Tasks: 1. Implement server-side email sending in the Edge Function. 2.
Use the owner's configured Gmail address as the recipient. 3. Use a
sender address on a domain verified with Resend. Do not attempt to use
the recipient's Gmail address as an unverified sender domain. 4. Create
a clean, readable email template showing reminder title, description,
and scheduled date/time with timezone. 5. Store the Resend API key as a
Supabase Edge Function secret only. 6. Record provider message IDs and
sending results in `reminder_logs`. 7. On success, advance or complete
the reminder according to its recurrence rule. 8. On failure, preserve
the occurrence for safe retry and show the error in delivery history. 9.
Add a test-email mode and prevent accidental bulk sending during
development.

Pause and ask the owner to: - Create or access a Resend account. -
Verify a domain they control. - Add the required DNS records at their
domain provider. - Provide the verified sender address. - Add the Resend
API key through Supabase secrets, not in chat or frontend files.

If the owner does not own a domain, explain the limitation and pause
production email setup rather than promising that a free Gmail sender
will work.

**Acceptance checks** - A test email reaches the owner's Gmail inbox. -
The sender domain is verified. - Provider response and message ID are
recorded. - Failure and retry behavior is tested. - No API key appears
in frontend files or Git.

Stop for approval before Phase 7.

------------------------------------------------------------------------

## Phase 7 --- Full testing, security and reliability

**Prompt**

Test the complete system as a real personal reminder application.

Test cases: 1. One-time reminder sends at its due time while the browser
is closed. 2. Daily reminder sends and schedules its next occurrence. 3.
Weekly reminder sends only on selected days. 4. Monthly reminder handles
short months and leap years. 5. Editing a reminder before it is due
changes the scheduled occurrence correctly. 6. Deleting or cancelling a
reminder prevents future sends. 7. A failed email is logged and retried
safely. 8. Repeated scheduler invocations do not create duplicate sends
under normal operation. 9. Expired login sessions are handled. 10. RLS
blocks unauthorized access. 11. Mobile and desktop layouts work. 12.
Timezone display and scheduling are correct.

Also: - Review all RLS policies. - Search the repository for
accidentally committed secrets. - Verify Edge Function secrets and
scheduler authentication. - Check logs for sensitive information. - Add
clear setup and troubleshooting documentation. - Fix issues found; do
not just list them.

**Acceptance checks** - Provide a test report with pass/fail results. -
Do not mark untested cases as passed. - Document any remaining
limitations.

Stop for approval before Phase 8.

------------------------------------------------------------------------

## Phase 8 --- Deployment and handover

**Prompt**

Prepare and deploy the production application.

Tasks: 1. Prepare the frontend for Netlify deployment. 2. Configure
production Supabase URL and publishable/anon key using the appropriate
frontend configuration. 3. Deploy Supabase migrations and Edge
Functions. 4. Configure Supabase secrets and Cron in production. 5.
Verify Resend domain and sender configuration. 6. Disable public
registration and confirm only the owner's account can access the app. 7.
Configure authentication redirect URLs and password reset URLs for the
production domain. 8. Test a real reminder from creation through email
delivery. 9. Test one recurring reminder and verify its next occurrence.
10. Write `docs/DEPLOYMENT.md` with exact deployment and rollback steps.
11. Write `docs/SETUP.md` with account setup, environment configuration,
database setup, and local run instructions. 12. Update the root README
with the project overview and quick start.

The owner will create provider accounts and supply required credentials
through secure provider dashboards. Do not ask them to paste secrets
into source files or commit them.

**Final handover** Provide: - Production website URL. - Local run
instructions. - Provider services and free-tier limitations. - Required
secrets and where they are stored (never reveal their values). -
Database migration status. - Cron schedule and Edge Function status. -
Test results. - Known limitations and maintenance steps.

Do not claim deployment is complete until the live URL and end-to-end
email test have both been verified.
