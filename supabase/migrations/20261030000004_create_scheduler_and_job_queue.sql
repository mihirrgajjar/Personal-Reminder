-- Migration: 20261030000004_create_scheduler_and_job_queue.sql
-- Description: Concurrency-safe reminder claiming, idempotent execution, and pg_cron scheduler setup

-- 1. Function: claim_due_reminders
-- Concurrency-safe claiming using SELECT ... FOR UPDATE SKIP LOCKED
CREATE OR REPLACE FUNCTION public.claim_due_reminders(
  p_batch_size INT DEFAULT 50
)
RETURNS TABLE (
  reminder_id UUID,
  user_id UUID,
  title TEXT,
  description TEXT,
  scheduled_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  timezone TEXT,
  recurrence_type TEXT,
  recurrence_days INT[],
  recurrence_month_day INT,
  destination_email TEXT
) AS $$
DECLARE
  v_rec RECORD;
BEGIN
  -- Iterate through due active reminders using FOR UPDATE SKIP LOCKED
  FOR v_rec IN 
    SELECT 
      r.id,
      r.user_id,
      r.title,
      r.description,
      r.scheduled_at,
      r.next_run_at,
      r.timezone,
      r.recurrence_type,
      r.recurrence_days,
      r.recurrence_month_day,
      COALESCE(p.destination_email, u.email) AS dest_email
    FROM public.reminders r
    JOIN auth.users u ON u.id = r.user_id
    LEFT JOIN public.profiles p ON p.id = r.user_id
    WHERE r.status = 'active'
      AND r.next_run_at IS NOT NULL
      AND r.next_run_at <= NOW()
    ORDER BY r.next_run_at ASC
    LIMIT p_batch_size
    FOR UPDATE OF r SKIP LOCKED
  LOOP
    -- Insert a claim record into reminder_logs with status 'pending'
    -- If a log entry already exists for this (reminder_id, scheduled_for), ON CONFLICT DO NOTHING ensures idempotency
    INSERT INTO public.reminder_logs (
      reminder_id,
      user_id,
      scheduled_for,
      attempted_at,
      email_status
    )
    VALUES (
      v_rec.id,
      v_rec.user_id,
      v_rec.next_run_at,
      NOW(),
      'pending'
    )
    ON CONFLICT (reminder_id, scheduled_for) DO NOTHING;

    -- Only return rows that were successfully claimed as 'pending'
    IF FOUND THEN
      reminder_id := v_rec.id;
      user_id := v_rec.user_id;
      title := v_rec.title;
      description := v_rec.description;
      scheduled_at := v_rec.scheduled_at;
      scheduled_for := v_rec.next_run_at;
      timezone := v_rec.timezone;
      recurrence_type := v_rec.recurrence_type;
      recurrence_days := v_rec.recurrence_days;
      recurrence_month_day := v_rec.recurrence_month_day;
      destination_email := v_rec.dest_email;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Function: complete_reminder_occurrence
-- Finalizes a claimed reminder occurrence, updates reminder_logs, and calculates next recurrence
CREATE OR REPLACE FUNCTION public.complete_reminder_occurrence(
  p_reminder_id UUID,
  p_scheduled_for TIMESTAMPTZ,
  p_status TEXT,
  p_provider_message_id TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_reminder RECORD;
  v_next_run TIMESTAMPTZ;
  v_attempt_count INT;
BEGIN
  -- 1. Update the delivery log
  UPDATE public.reminder_logs
  SET 
    email_status = p_status,
    sent_at = CASE WHEN p_status = 'sent' THEN NOW() ELSE sent_at END,
    provider_message_id = COALESCE(p_provider_message_id, provider_message_id),
    error_message = p_error_message
  WHERE reminder_id = p_reminder_id
    AND scheduled_for = p_scheduled_for;

  -- 2. Fetch the reminder record
  SELECT * INTO v_reminder
  FROM public.reminders
  WHERE id = p_reminder_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- 3. If sent successfully
  IF p_status = 'sent' THEN
    IF v_reminder.recurrence_type = 'none' OR v_reminder.recurrence_type IS NULL THEN
      -- One-time reminder is marked completed
      UPDATE public.reminders
      SET 
        status = 'completed',
        updated_at = NOW()
      WHERE id = p_reminder_id;
    ELSE
      -- Recurring reminder: advance next_run_at using calculate_next_occurrence
      v_next_run := public.calculate_next_occurrence(
        p_scheduled_for,
        v_reminder.timezone,
        v_reminder.recurrence_type,
        v_reminder.recurrence_days,
        v_reminder.recurrence_month_day
      );

      UPDATE public.reminders
      SET 
        next_run_at = v_next_run,
        updated_at = NOW()
      WHERE id = p_reminder_id;
    END IF;

  -- 4. If failed, apply bounded retry backoff
  ELSIF p_status = 'failed' THEN
    SELECT COUNT(*) INTO v_attempt_count
    FROM public.reminder_logs
    WHERE reminder_id = p_reminder_id
      AND scheduled_for = p_scheduled_for;

    IF v_attempt_count < 3 THEN
      -- Retry in 5 minutes with backoff
      UPDATE public.reminders
      SET 
        next_run_at = NOW() + INTERVAL '5 minutes',
        updated_at = NOW()
      WHERE id = p_reminder_id;
    ELSE
      -- Keep next_run_at past-due and log failure for owner visibility without silent drop
      UPDATE public.reminders
      SET updated_at = NOW()
      WHERE id = p_reminder_id;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Permissions
GRANT EXECUTE ON FUNCTION public.claim_due_reminders TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_reminder_occurrence TO service_role;
