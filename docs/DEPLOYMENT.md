# Personal Reminder - Deployment Guide

This document tracks the deployment requirements and target infrastructure for the Personal Reminder system.

## Target Infrastructure Architecture

| Layer | Provider | Free-Tier Limits & Specifications |
|---|---|---|
| **Frontend** | Netlify | Static HTML/CSS/JS hosting with automatic Git deployments |
| **Authentication & Database** | Supabase | Managed PostgreSQL, Row Level Security (RLS), Supabase Auth |
| **Scheduler** | Supabase Cron (`pg_cron`) | Database cron jobs running every minute |
| **Worker / Automation** | Supabase Edge Functions | Concurrency-safe Deno Edge Functions claiming due reminder batches |
| **Email Delivery** | Resend API | Transactional email delivery with verified sender domain |

---

## Deployment Strategy per Phase

- **Phase 1 (Current)**: Frontend foundation & responsive architecture established.
- **Phase 2 - 3**: Database schema migrations (`supabase/migrations/`), RLS security policies, and environment config templates.
- **Phase 4 - 5**: Edge Function logic and `pg_cron` schedule provisioning.
- **Phase 6**: Resend domain verification and secure secret configuration.
- **Phase 7 - 8**: End-to-end testing, Netlify deployment configuration, and production handover.

---

## Security Invariants

1. **No Credentials in Frontend**:
   - `assets/js/config.example.js` contains only non-secret public placeholders.
   - Real `config.js` and `.env*` files are strictly excluded via `.gitignore`.
2. **Server-Side Secrets Only**:
   - Supabase `service_role` keys and Resend API keys are strictly configured as server-side Edge Function secrets (`supabase secrets set`).
3. **Strict Row Level Security (RLS)**:
   - All tables enforce authenticated owner policies (`auth.uid() = user_id`).
