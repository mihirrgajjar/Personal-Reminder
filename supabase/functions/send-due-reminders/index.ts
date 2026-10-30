/**
 * Supabase Edge Function: send-due-reminders
 * 
 * Scheduled worker that claims due reminders, dispatches emails via Resend API,
 * records provider message IDs, handles retries, and advances recurrence schedules.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Server configuration from Deno environment
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";

// Resend Configuration (Supplied strictly via Supabase secrets)
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "reminders@yourdomain.com";

// Mode toggle: if RESEND_API_KEY is not set or DRY_RUN is explicitly true, runs in simulation mode
const DRY_RUN = Deno.env.get("DRY_RUN") === "true" || !RESEND_API_KEY;

serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json"
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 1. Authenticate Request
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  const isCronAuthorized = CRON_SECRET && token === CRON_SECRET;
  const isServiceRoleAuthorized = SUPABASE_SERVICE_ROLE_KEY && token === SUPABASE_SERVICE_ROLE_KEY;

  if (!isCronAuthorized && !isServiceRoleAuthorized) {
    console.warn("[Auth] Unauthorized scheduler request rejected.");
    return new Response(
      JSON.stringify({ error: "Unauthorized: Invalid or missing authorization token." }),
      { status: 401, headers: corsHeaders }
    );
  }

  // 2. Initialize Supabase Admin Client
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[Config] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    return new Response(
      JSON.stringify({ error: "Server configuration error: missing database credentials." }),
      { status: 500, headers: corsHeaders }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // --- ACTION: SEND TEST VERIFICATION EMAIL ---
  if (action === "test-email") {
    try {
      const body = await req.json().catch(() => ({}));
      const recipient = body.recipient || Deno.env.get("OWNER_EMAIL");

      if (!recipient) {
        return new Response(
          JSON.stringify({ error: "Missing recipient email in test request." }),
          { status: 400, headers: corsHeaders }
        );
      }

      console.log(`[Test Email] Sending verification test email to ${maskEmail(recipient)}...`);

      if (DRY_RUN) {
        return new Response(
          JSON.stringify({
            success: true,
            dryRun: true,
            message: "Dry-run mode active. No email sent because RESEND_API_KEY is not configured.",
            simulatedMessageId: `dryrun_test_${crypto.randomUUID()}`
          }),
          { status: 200, headers: corsHeaders }
        );
      }

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: RESEND_FROM_EMAIL,
          to: [recipient],
          subject: "Personal Reminder - Test Verification Email",
          html: generateEmailHtml({
            title: "Test Verification Reminder",
            description: "This is a test notification confirming that your Resend domain and API keys are working properly.",
            scheduledAtFormatted: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
            timezone: "Asia/Kolkata",
            recurrenceLabel: "One-time Test"
          }),
          text: "This is a test notification confirming that your Resend domain and API keys are working properly."
        })
      });

      const resendData = await resendRes.json();
      if (!resendRes.ok) {
        throw new Error(resendData.message || `Resend API error (${resendRes.status})`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          dryRun: false,
          providerMessageId: resendData.id,
          recipient: maskEmail(recipient)
        }),
        { status: 200, headers: corsHeaders }
      );
    } catch (err: any) {
      console.error("[Test Email Error]", err.message);
      return new Response(
        JSON.stringify({ error: "Failed to dispatch test email", message: err.message }),
        { status: 500, headers: corsHeaders }
      );
    }
  }

  // --- STANDARD SCHEDULED WORKER FLOW ---
  try {
    console.log(`[Job Start] Claiming due reminders... (DryRun Mode: ${DRY_RUN})`);

    // 3. Claim due reminders safely (SKIP LOCKED)
    const { data: claimed, error: claimError } = await supabase.rpc("claim_due_reminders", {
      p_batch_size: 50
    });

    if (claimError) {
      console.error("[Claim Error]", claimError);
      return new Response(
        JSON.stringify({ error: "Database claim failed", details: claimError.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    const dueList = claimed || [];
    console.log(`[Claimed] Found ${dueList.length} due reminders to dispatch.`);

    const processingResults = [];

    // 4. Dispatch each claimed reminder
    for (const reminder of dueList) {
      const {
        reminder_id,
        title,
        description,
        scheduled_for,
        destination_email,
        timezone,
        recurrence_type
      } = reminder;

      console.log(`[Sending] Reminder ${reminder_id}: "${title}" to ${maskEmail(destination_email)}`);

      let deliverySuccess = false;
      let providerMessageId: string | null = null;
      let errorMessage: string | null = null;

      if (DRY_RUN) {
        // --- DRY-RUN SIMULATION ---
        providerMessageId = `dryrun_msg_${crypto.randomUUID()}`;
        deliverySuccess = true;
        console.log(`[DryRun Sent] Simulated delivery for reminder ${reminder_id}. Provider ID: ${providerMessageId}`);
      } else {
        // --- LIVE RESEND API DISPATCH ---
        try {
          const tz = timezone || "Asia/Kolkata";
          const formattedDate = formatTimeForEmail(scheduled_for, tz);

          const resendPayload = {
            from: RESEND_FROM_EMAIL,
            to: [destination_email],
            subject: `Reminder: ${title}`,
            html: generateEmailHtml({
              title,
              description: description || "",
              scheduledAtFormatted: formattedDate,
              timezone: tz,
              recurrenceLabel: recurrence_type !== "none" ? `Repeats ${recurrence_type}` : null
            }),
            text: `${title}\n\n${description || ""}\n\nScheduled: ${formattedDate} (${tz})\nPersonal Reminder`,
            headers: {
              "X-Entity-Ref-ID": `${reminder_id}_${new Date(scheduled_for).getTime()}`
            }
          };

          const resendResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(resendPayload)
          });

          const resendData = await resendResponse.json();

          if (resendResponse.ok && resendData.id) {
            deliverySuccess = true;
            providerMessageId = resendData.id;
            console.log(`[Resend Success] Sent reminder ${reminder_id}. Resend ID: ${providerMessageId}`);
          } else {
            deliverySuccess = false;
            errorMessage = resendData.message || `Resend error status ${resendResponse.status}`;
            console.error(`[Resend Failed] Reminder ${reminder_id}:`, errorMessage);
          }
        } catch (dispatchErr: any) {
          deliverySuccess = false;
          errorMessage = dispatchErr.message || "Network exception contacting Resend API";
          console.error(`[Resend Network Error] Reminder ${reminder_id}:`, errorMessage);
        }
      }

      // 5. Complete occurrence in database & advance recurrence
      const status = deliverySuccess ? "sent" : "failed";
      const { error: completeError } = await supabase.rpc("complete_reminder_occurrence", {
        p_reminder_id: reminder_id,
        p_scheduled_for: scheduled_for,
        p_status: status,
        p_provider_message_id: providerMessageId,
        p_error_message: errorMessage
      });

      if (completeError) {
        console.error(`[Complete Error] Reminder ${reminder_id}:`, completeError);
      }

      processingResults.push({
        reminder_id,
        title,
        scheduled_for,
        status,
        provider_message_id: providerMessageId,
        error: errorMessage
      });
    }

    console.log(`[Job Complete] Processed ${processingResults.length} reminders.`);

    return new Response(
      JSON.stringify({
        success: true,
        dryRun: DRY_RUN,
        processedCount: processingResults.length,
        results: processingResults
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[Unhandled Scheduler Exception]", err.message);
    return new Response(
      JSON.stringify({ error: "Internal scheduler error", message: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});

// Helper: Format date for email body
function formatTimeForEmail(isoString: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

// Helper: Mask email address for operational logging
function maskEmail(email: string | null): string {
  if (!email) return "unknown";
  const parts = email.split("@");
  if (parts.length !== 2) return "***";
  const user = parts[0];
  const domain = parts[1];
  const maskedUser = user.length > 2 ? user.slice(0, 2) + "***" : "***";
  return `${maskedUser}@${domain}`;
}

// Helper: Responsive HTML Email Template
function generateEmailHtml(data: {
  title: string;
  description: string;
  scheduledAtFormatted: string;
  timezone: string;
  recurrenceLabel: string | null;
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reminder: ${escapeHtml(data.title)}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc; }
    .wrapper { max-width: 560px; margin: 30px auto; background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4); }
    .header { padding: 24px 32px; border-bottom: 1px solid #334155; display: flex; align-items: center; gap: 12px; }
    .header-title { font-size: 16px; font-weight: 700; color: #3b82f6; letter-spacing: 0.5px; text-transform: uppercase; }
    .body { padding: 32px; }
    .reminder-badge { display: inline-block; background-color: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 9999px; margin-bottom: 16px; }
    .title { font-size: 24px; font-weight: 700; color: #f8fafc; margin: 0 0 12px 0; line-height: 1.3; }
    .description { font-size: 15px; line-height: 1.6; color: #cbd5e1; margin: 0 0 24px 0; background: #0f172a; padding: 16px; border-radius: 8px; border: 1px solid #334155; }
    .meta-box { background: rgba(15, 23, 42, 0.6); border-radius: 8px; padding: 16px; margin-bottom: 24px; }
    .meta-item { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; }
    .meta-label { color: #94a3b8; }
    .meta-value { color: #f8fafc; font-weight: 600; font-family: monospace; }
    .footer { padding: 20px 32px; background-color: #0f172a; border-top: 1px solid #334155; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <span class="header-title">Personal Reminder</span>
    </div>
    <div class="body">
      ${data.recurrenceLabel ? `<span class="reminder-badge">${escapeHtml(data.recurrenceLabel)}</span>` : ''}
      <h1 class="title">${escapeHtml(data.title)}</h1>
      ${data.description ? `<div class="description">${escapeHtml(data.description)}</div>` : ''}
      
      <div class="meta-box">
        <div class="meta-item">
          <span class="meta-label">Scheduled Time:</span>
          <span class="meta-value">${escapeHtml(data.scheduledAtFormatted)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Timezone:</span>
          <span class="meta-value">${escapeHtml(data.timezone)}</span>
        </div>
      </div>
    </div>
    <div class="footer">
      Private reminder dispatched by your Personal Reminder website &bull; Automated notification
    </div>
  </div>
</body>
</html>
  `.trim();
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return str.replace(/[&<>'"]/g, (tag) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[tag] || tag));
}
