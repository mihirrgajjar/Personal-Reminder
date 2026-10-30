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

## 2. Supabase Project Setup (Phase 2)

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

### Step 2.3: Apply the Database Migration
1. In your Supabase Dashboard, open the **SQL Editor** from the left navigation.
2. Click **"+ New Query"**.
3. Open [supabase/migrations/20261030000001_create_profiles.sql](file:///d:/Projects/Personal_reminder/supabase/migrations/20261030000001_create_profiles.sql).
4. Copy its contents, paste them into the SQL Editor, and click **"Run"**.
5. This creates:
   - The `public.profiles` table with foreign key `auth.users(id)` and cascading deletes.
   - Row Level Security (RLS) policies ensuring only the authenticated user can read or modify their own record.
   - The automatic `on_auth_user_created` trigger that inserts a profile whenever a new user is created.

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
