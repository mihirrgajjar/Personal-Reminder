/**
 * Supabase Edge Function: send-due-reminders
 * 
 * Scheduled worker that claims due reminders, dispatches emails (dry-run mode in Phase 5),
 * logs provider results, and advances recurrence schedules.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Server configuration from Deno environment
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
// DRY_RUN mode defaults to true for Phase 5 (simulates email delivery without calling Resend API)
const DRY_RUN = Deno.env.get("DRY_RUN") !== "false";

serve(async (req: Request) => {
  // CORS Headers
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
    console.warn("[Auth Warning] Unauthorized scheduler invocation rejected.");
    return new Response(
      JSON.stringify({ error: "Unauthorized: Invalid or missing authorization token." }),
      { status: 401, headers: corsHeaders }
    );
  }

  // 2. Initialize Supabase Admin Client
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[Config Error] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.");
    return new Response(
      JSON.stringify({ error: "Server configuration error: missing database credentials." }),
      { status: 500, headers: corsHeaders }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  try {
    console.log(`[Job Start] Claiming due reminders... (DryRun Mode: ${DRY_RUN})`);

    // 3. Claim due reminders safely using DB-level row locks (SKIP LOCKED)
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
    console.log(`[Claimed] Found ${dueList.length} due reminders to process.`);

    const processingResults = [];

    // 4. Process each claimed reminder occurrence
    for (const reminder of dueList) {
      const {
        reminder_id,
        title,
        description,
        scheduled_for,
        destination_email,
        timezone
      } = reminder;

      console.log(`[Processing] Reminder ${reminder_id}: "${title}" for recipient ${maskEmail(destination_email)}`);

      let deliverySuccess = false;
      let providerMessageId: string | null = null;
      let errorMessage: string | null = null;

      if (DRY_RUN) {
        // --- PHASE 5 DRY-RUN SIMULATION ---
        // Simulates provider dispatch without calling external Resend API
        providerMessageId = `dryrun_msg_${crypto.randomUUID()}`;
        deliverySuccess = true;
        console.log(`[DryRun Sent] Simulated delivery for reminder ${reminder_id}. Provider ID: ${providerMessageId}`);
      } else {
        // Phase 6 will hook the Resend API here
        errorMessage = "Live Resend delivery not yet enabled (Phase 5 dry-run only).";
        deliverySuccess = false;
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
        console.error(`[Complete Error] Failed to update completion for ${reminder_id}:`, completeError);
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

    console.log(`[Job Complete] Successfully processed ${processingResults.length} reminders.`);

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
    console.error("[Unhandled Worker Exception]", err.message);
    return new Response(
      JSON.stringify({ error: "Internal worker error", message: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});

// Helper: Mask email address for safe logging
function maskEmail(email: string | null): string {
  if (!email) return "unknown";
  const parts = email.split("@");
  if (parts.length !== 2) return "***";
  const user = parts[0];
  const domain = parts[1];
  const maskedUser = user.length > 2 ? user.slice(0, 2) + "***" : "***";
  return `${maskedUser}@${domain}`;
}
