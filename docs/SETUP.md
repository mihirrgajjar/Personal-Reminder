# Personal Reminder - Local Setup Guide

This document explains how to set up and run the Personal Reminder web application locally.

## Project Prerequisites

- A modern web browser (Chrome, Edge, Firefox, or Safari).
- A local HTTP server (such as Python's `http.server`, Node's `npx serve`, or VS Code Live Server).
- Git installed on your machine.

---

## Running Locally (Phase 1 Frontend Foundation)

Because the project uses standard HTML, CSS, and vanilla JavaScript without any heavy build steps or bundlers, you can preview it immediately using any lightweight local static server.

### Option A: Using Python (Recommended)

From the project root folder:

```bash
# Python 3
python -m http.server 8080
```

Open your browser and navigate to:
`http://localhost:8080`

### Option B: Using Node.js

```bash
npx serve -l 8080 .
```

Open your browser and navigate to:
`http://localhost:8080`

### Option C: Directly Opening Files

You can also open [index.html](file:///d:/Projects/Personal_reminder/index.html) or [dashboard.html](file:///d:/Projects/Personal_reminder/dashboard.html) directly in your browser.

---

## Phase 1 Capabilities

- **Login & Password Reset Layouts**: Interactive forms with validation for email and password on [login.html](file:///d:/Projects/Personal_reminder/login.html).
- **Dashboard Overview**: Summary statistics for Today, Upcoming, Overdue, and Completed reminders.
- **Filter Tabs**: Filter by All, Today, Upcoming, Overdue, Completed, and Recurring.
- **Reminder Management (CRUD)**:
  - Create new reminders with date, time, and recurrence (One-time, Daily, Weekly with weekday selection, Monthly with day-of-month).
  - Edit existing reminders.
  - Complete / uncomplete reminders.
  - Snooze reminders (+1 Hour, +3 Hours, Tomorrow morning).
  - Delete reminders with confirmation.
- **Settings View**: Configurable destination email and timezone dropdown (default `Asia/Kolkata`).
- **Interactive Feedback**: Loading spinners, validation errors, and alert toast notifications.

---

## Upcoming Phases

- **Phase 2**: Supabase Auth integration (owner login, session restoration, profiles table, and RLS).
- **Phase 3**: Supabase PostgreSQL database tables (`reminders`, `reminder_logs`) and live CRUD operations.
- **Phase 4**: Server-side recurrence engine.
- **Phase 5**: Server-side scheduler with Supabase Cron (`pg_cron`) and Edge Functions.
- **Phase 6**: Resend email delivery integration.
- **Phase 7**: Comprehensive security audit and end-to-end testing.
- **Phase 8**: Netlify production deployment.
