# Personal Reminder

A private, single-user personal reminder web application designed to deliver automated email reminders at scheduled times, even when the browser, website, or laptop is completely closed.

---

## Key Features

- **Private Owner Portal**: Single-owner sign-in; no public registration.
- **Reliable Automation**: Server-side scheduler checks for due reminders and dispatches emails independently of the browser.
- **Recurrence Engine**: Supports One-Time, Daily, Weekly (selected weekdays), and Monthly reminders.
- **Responsive & Modern UI**: Built with HTML5, CSS3, and vanilla JavaScript without heavy framework overhead.
- **Zero Inline Styles & Clean Architecture**: Clean separation of structure, presentation, and logic.

---

## Project Structure

```text
Personal-Reminder/
├── index.html                     # Entry point & router
├── login.html                     # Owner authentication & password reset
├── dashboard.html                 # Main dashboard with summary metrics & modals
├── assets/
│   ├── css/
│   │   └── styles.css             # Unified modern stylesheet
│   ├── js/
│   │   ├── config.example.js      # Public configuration template
│   │   ├── auth.js                # Auth & reset form controller
│   │   ├── dashboard.js           # Dashboard UI controller
│   │   ├── reminders.js           # Reminders data store & calculations
│   │   └── supabase-client.js     # Supabase client stub (Phase 2 integration)
│   └── images/
├── supabase/
│   ├── migrations/                # Database migrations (Phase 2 & 3)
│   └── functions/
│       └── send-due-reminders/    # Serverless edge function (Phase 5 & 6)
├── docs/
│   ├── SETUP.md                   # Local setup instructions
│   └── DEPLOYMENT.md              # Target infrastructure & deployment guide
├── .gitignore                     # Comprehensive secrets and build ignore rules
├── PHASE_WISE_PROMPTS.md          # Multi-phase development roadmap
└── PROJECT_OVERVIEW.md            # Architectural specifications
```

---

## Quick Start (Local Run)

You can preview the app using any static web server:

```bash
# Python 3
python -m http.server 8080

# Or Node.js
npx serve -l 8080 .
```

Navigate to: `http://localhost:8080`

---

## Development Roadmap

- [x] **Phase 1**: Project setup, Git repository connection, and responsive frontend foundation.
- [x] **Phase 2**: Supabase setup & private owner authentication.
- [x] **Phase 3**: Reminder database schema, RLS policies, and live CRUD.
- [x] **Phase 4**: Server-side recurrence engine.
- [x] **Phase 5**: Server-side scheduler & concurrency-safe job processing.
- [x] **Phase 6**: Resend email delivery integration.
- [x] **Phase 7**: Comprehensive security audit & reliability testing.
- [ ] **Phase 8**: Netlify production deployment & handover.
