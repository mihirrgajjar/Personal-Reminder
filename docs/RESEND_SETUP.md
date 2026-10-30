# Personal Reminder - Resend Email Setup Guide

This guide explains how to configure [Resend](https://resend.com) for reliable, automated transactional email delivery for your Personal Reminder website.

---

## 1. Why Domain Verification is Required

Major email providers (including Google Gmail and Yahoo) enforce strict **DMARC, DKIM, and SPF** policies.
- **You cannot send emails from a `@gmail.com` address through an external API.** Resend will reject attempts to use `@gmail.com` as your sender domain.
- **Production sender addresses must belong to a domain you control** (e.g., `reminders@yourdomain.com`).
- **Temporary Developer Testing**: If you do not yet have a custom domain, Resend allows sending test emails from `onboarding@resend.dev` *exclusively* to the email address registered with your Resend account.

---

## 2. Setting Up Your Resend Account

### Step 2.1: Create a Resend Account
1. Visit [https://resend.com](https://resend.com) and sign up with your email.
2. In the Resend Dashboard, go to **API Keys**.
3. Click **"Create API Key"**:
   - Name: `personal-reminder-key`
   - Permission: **Full access** (or Sending access)
4. Copy the API key (starts with `re_...`).

> [!CAUTION]
> **NEVER paste your Resend API key in Git, frontend code, or chat.** Store it exclusively as a Supabase Edge Function secret.

### Step 2.2: Add and Verify Your Domain (For Production)
1. In Resend Dashboard, navigate to **Domains** -> **"Add Domain"**.
2. Enter your domain (or subdomain, e.g. `mail.yourdomain.com` or `yourdomain.com`).
3. Resend will display DNS records:
   - **DKIM** (CNAME / TXT)
   - **SPF** (TXT)
   - **DMARC** (TXT)
4. Add these DNS records at your domain registrar (Namecheap, Cloudflare, GoDaddy, Google Domains, etc.).
5. Wait for DNS propagation and click **"Verify Domain"** in Resend until the status shows **Verified**.

---

## 3. Configuring Supabase Edge Function Secrets

Configure your secrets securely in Supabase so the Edge Function can access them:

### Option A: Using the Supabase Web Dashboard
1. Go to your Supabase Project Dashboard -> **Settings** -> **Edge Functions** (or **Project Settings** -> **Secrets**).
2. Click **"Add new secret"** for each of the following:

| Secret Name | Value Example | Description |
|---|---|---|
| `RESEND_API_KEY` | `re_123456789...` | Your private Resend API Key |
| `RESEND_FROM_EMAIL` | `reminders@yourdomain.com` | Verified sender address (or `onboarding@resend.dev` for test mode) |
| `DRY_RUN` | `false` | Set to `false` to enable live sending (`true` runs simulation) |
| `CRON_SECRET` | `generate-a-secure-random-token` | Secret used to authenticate scheduler calls |

### Option B: Using the Supabase CLI
```bash
supabase secrets set RESEND_API_KEY="re_your_api_key_here"
supabase secrets set RESEND_FROM_EMAIL="reminders@yourdomain.com"
supabase secrets set DRY_RUN="false"
supabase secrets set CRON_SECRET="your-secure-random-secret"
```

---

## 4. Sending a Test Verification Email

You can test that your Resend credentials and sender domain are working without waiting for a scheduled reminder:

```bash
curl -X POST "https://<your-project-ref>.supabase.co/functions/v1/send-due-reminders?action=test-email" \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"recipient": "your-gmail@gmail.com"}'
```

**Expected Response**:
```json
{
  "success": true,
  "dryRun": false,
  "providerMessageId": "re_abc123xyz",
  "recipient": "yo***@gmail.com"
}
```

Check your Gmail inbox. You should receive the responsive HTML reminder notification!

---

## 5. Delivery Logs & Troubleshooting

- **View Logs in Dashboard**: Open your Personal Reminder dashboard -> **Settings** -> **Email Delivery History** -> **Refresh Logs**.
- **Delivery Statuses**:
  - `sent`: Successfully accepted by Resend with `provider_message_id`.
  - `failed`: Provider error (e.g., unverified sender domain, invalid recipient). Automatically scheduled for backoff retry.
  - `pending`: Claimed by scheduler and in-flight.
- **Supabase Edge Function Logs**: Available under **Edge Functions** -> `send-due-reminders` -> **Logs** in your Supabase dashboard.
