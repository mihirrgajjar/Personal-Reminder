# Personal Reminder

A private, single-user personal reminder web application designed to deliver automated email notifications at scheduled times, even when the website, browser, or laptop is completely closed.

---

## Architecture Overview

```text
+------------------------------------------------------------------------+
|                          NETLIFY FRONTEND                              |
|  - HTML5, CSS3 (assets/css/styles.css), Vanilla JavaScript             |
|  - Responsive Dashboard, Modal CRUD, Settings, Delivery Logs           |
|  - Automated build config generation via scripts/generate-config.js    |
+-----------------------------------+------------------------------------+
                                    | Supabase Auth & RLS
                                    v
+------------------------------------------------------------------------+
|                      SUPABASE POSTGRESQL & AUTH                        |
|  - auth.users & public.profiles (Row Level Security enabled)           |
|  - public.reminders (One-time, Daily, Weekly, Monthly)                 |
|  - public.reminder_logs (Idempotency: UNIQUE reminder_id, scheduled_for)
|  - Stored Functions: calculate_next_occurrence, claim_due_reminders     |
+-----------------------------------+------------------------------------+
                                    |
            +-----------------------+-----------------------+
            |                                               |
            v                                               v
+-----------------------+                       +-----------------------+
|   SUPABASE PG_CRON    |                       | SUPABASE EDGE FUNCTION|
|  - Runs every minute  |                       |  send-due-reminders   |
|  - Triggers worker    |                       |  - Validates Secret   |
+-----------+-----------+                       |  - Claims via Locks   |
            |                                   +-----------+-----------+
            +-----------------------------------------------+
                                    |
                                    v
                        +-----------------------+
                        |      RESEND API       |
                        |  - Verified Domain    |
                        |  - Responsive HTML    |
                        |  - Gmail Inboxes      |
                        +-----------------------+
```

---

## Features

- **Single-Owner Private Portal**: Hardened with Supabase Auth; public user registration is disabled.
- **Reliable Server-Side Automation**: Backend scheduler checks for due reminders every minute and dispatches emails even when devices are powered off.
- **Advanced Recurrence Engine**:
  - One-time reminders (`none`).
  - **Hourly recurrence (`hourly`)**: Every 1 hour, 2 hours, 3 hours, 4 hours, or custom hourly interval with zero timing drift.
  - Daily recurrence (`daily`).
  - Weekly recurrence on selected weekdays (`0=Sun` ... `6=Sat`).
  - Monthly recurrence on a designated day (automatically clamping short months like Feb 28/29, Apr 30).
  - Wall-clock time preserved across Daylight Saving Time (DST) shifts.
  - **Flexible End Conditions**: Optional end date/time and optional maximum repetition count (continues indefinitely if not set until manually paused, completed, or deleted).
- **Concurrency & Idempotency Safeguards**:
  - Row claiming with `SELECT ... FOR UPDATE SKIP LOCKED` eliminates race conditions.
  - Unique idempotency constraint `(reminder_id, scheduled_for)` guarantees duplicate emails cannot be sent.
  - Bounded exponential backoff retries for transient delivery failures.
- **Aesthetic, Responsive Interface**:
  - Clean, high-contrast dark theme.
  - Live modal recurrence previewing.
  - Filters: All, Today, Upcoming, Overdue, Completed, Recurring.
  - Email delivery logs history in dashboard.
  - Zero inline styles; clean external CSS and pure vanilla JavaScript.

---

## Project Structure

```text
Personal-Reminder/
├── index.html                     # Entry point & session router
├── login.html                     # Owner authentication & password recovery
├── dashboard.html                 # Dashboard, summary cards, CRUD modals, logs
├── netlify.toml                   # Netlify build configuration & security headers
├── assets/
│   ├── css/
│   │   └── styles.css             # Unified stylesheet (dark-slate modern theme)
│   ├── js/
│   │   ├── config.example.js      # Public configuration template
│   │   ├── auth.js                # Login, reset, and password update logic
│   │   ├── dashboard.js           # Dashboard UI controller & logs loader
│   │   ├── reminders.js           # Supabase async CRUD & demo fallback store
│   │   ├── recurrence.js          # Deterministic recurrence calculation engine
│   │   └── supabase-client.js     # Supabase client wrapper & route guard
│   └── images/
├── supabase/
│   ├── migrations/                # Database migrations
│   │   ├── 20261030000001_create_profiles.sql
│   │   ├── 20261030000002_create_reminders_and_logs.sql
│   │   ├── 20261030000003_create_recurrence_engine.sql
│   │   └── 20261030000004_create_scheduler_and_job_queue.sql
│   └── functions/
│       └── send-due-reminders/    # Supabase Deno Edge Function
│           └── index.ts
├── tests/
│   ├── recurrence.test.js         # Recurrence engine automated unit tests
│   └── system_integrity.test.js   # Security scan, schema & RLS test suite
├── scripts/
│   └── generate-config.js         # Netlify build script for runtime config
├── docs/
│   ├── SETUP.md                   # Local run and database migration guide
│   ├── DEPLOYMENT.md              # Netlify & Supabase production deployment
│   ├── SCHEDULER.md               # pg_cron scheduler & concurrency safeguards
│   ├── RESEND_SETUP.md            # Resend domain verification & secrets guide
│   └── TEST_REPORT.md             # Complete Phase 7 pass/fail test report
├── .gitignore                     # Strict secrets and config exclusion rules
├── PHASE_WISE_PROMPTS.md          # Multi-phase project development prompts
└── PROJECT_OVERVIEW.md            # Architectural specifications
```

---

## Quick Start (Local Run)

Preview the application locally with any static web server:

```bash
# Using Python
python -m http.server 8080

# Or using Node.js
npx serve -l 8080 .
```

Open your browser to: **`http://localhost:8080`**

### Running the Test Suites

```bash
# 1. Run recurrence unit tests
node tests/recurrence.test.js

# 2. Run system integrity and security scan
node tests/system_integrity.test.js
```

---

## Deployment & Documentation Links

- [Setup Guide](file:///d:/Projects/Personal_reminder/docs/SETUP.md) — Database migrations, account creation, and local setup.
- [Production Deployment Guide](file:///d:/Projects/Personal_reminder/docs/DEPLOYMENT.md) — Netlify deployment, Edge Functions, and rollback steps.
- [Scheduler & Job Queue Guide](file:///d:/Projects/Personal_reminder/docs/SCHEDULER.md) — Supabase `pg_cron` setup and concurrency locking.
- [Resend Setup Guide](file:///d:/Projects/Personal_reminder/docs/RESEND_SETUP.md) — Domain verification, DNS records, and Supabase secrets.
- [Test Report](file:///d:/Projects/Personal_reminder/docs/TEST_REPORT.md) — Comprehensive test results across all 12 validation scenarios.

---

## Development Roadmap Progress

- [x] **Phase 1**: Project setup, Git repository connection, and responsive frontend foundation.
- [x] **Phase 2**: Supabase setup & private owner authentication.
- [x] **Phase 3**: Reminder database schema, RLS policies, and live CRUD.
- [x] **Phase 4**: Server-side recurrence engine & automated unit tests.
- [x] **Phase 5**: Server-side scheduler & concurrency-safe job processing.
- [x] **Phase 6**: Resend email delivery integration.
- [x] **Phase 7**: Comprehensive security audit & reliability testing.
- [x] **Phase 8**: Netlify production deployment configuration & handover.
