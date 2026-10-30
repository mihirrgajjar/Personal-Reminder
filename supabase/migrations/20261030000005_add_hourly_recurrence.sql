-- Migration: 20261030000005_add_hourly_recurrence.sql
-- Description: Adds support for hourly recurrence, intervals, max repetitions, and end dates

-- 1. Alter reminders table to support hourly recurrence and end conditions
ALTER TABLE public.reminders 
  DROP CONSTRAINT IF EXISTS reminders_recurrence_type_check;

ALTER TABLE public.reminders 
  ADD CONSTRAINT reminders_recurrence_type_check 
  CHECK (recurrence_type IN ('none', 'hourly', 'daily', 'weekly', 'monthly'));

-- Add columns for hourly interval and termination conditions
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS recurrence_interval_hours INTEGER DEFAULT 1 CHECK (recurrence_interval_hours IS NULL OR recurrence_interval_hours >= 1),
  ADD COLUMN IF NOT EXISTS recurrence_end_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_occurrences INTEGER DEFAULT NULL CHECK (max_occurrences IS NULL OR max_occurrences >= 1),
  ADD COLUMN IF NOT EXISTS occurrences_count INTEGER NOT NULL DEFAULT 0;

-- 2. Update calculate_next_occurrence function to support hourly intervals & end conditions
CREATE OR REPLACE FUNCTION public.calculate_next_occurrence(
  p_current_scheduled TIMESTAMPTZ,
  p_timezone TEXT,
  p_recurrence_type TEXT,
  p_recurrence_days INTEGER[] DEFAULT NULL,
  p_recurrence_month_day INTEGER DEFAULT NULL,
  p_interval_hours INTEGER DEFAULT 1,
  p_end_at TIMESTAMPTZ DEFAULT NULL,
  p_max_occurrences INTEGER DEFAULT NULL,
  p_occurrences_count INTEGER DEFAULT 0
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_tz TEXT;
  v_local_current TIMESTAMP;
  v_target_hour INT;
  v_target_min INT;
  v_target_sec INT;
  v_candidate TIMESTAMP;
  v_result TIMESTAMPTZ;
  v_current_dow INT;
  v_days_in_month INT;
  v_year INT;
  v_month INT;
  v_target_day INT;
  v_interval_hrs INT;
  v_iteration INT := 0;
  v_max_iterations CONSTANT INT := 500;
BEGIN
  -- Validate recurrence type
  IF p_recurrence_type IS NULL OR p_recurrence_type = 'none' THEN
    RETURN NULL;
  END IF;

  -- Check max occurrences limit
  IF p_max_occurrences IS NOT NULL AND p_occurrences_count >= p_max_occurrences THEN
    RETURN NULL;
  END IF;

  v_tz := COALESCE(NULLIF(p_timezone, ''), 'Asia/Kolkata');
  v_interval_hrs := COALESCE(p_interval_hours, 1);
  IF v_interval_hrs < 1 THEN
    v_interval_hrs := 1;
  END IF;

  -- 1. HOURLY
  IF p_recurrence_type = 'hourly' THEN
    -- Calculate directly from scheduled timestamp to eliminate drift
    v_result := p_current_scheduled + (v_interval_hrs || ' hours')::INTERVAL;
    
    -- Catch up if still behind now()
    WHILE v_result <= NOW() AND v_iteration < v_max_iterations LOOP
      v_result := v_result + (v_interval_hrs || ' hours')::INTERVAL;
      v_iteration := v_iteration + 1;
    END LOOP;

    -- Verify end date condition
    IF p_end_at IS NOT NULL AND v_result > p_end_at THEN
      RETURN NULL;
    END IF;

    RETURN v_result;

  -- 2. DAILY
  ELSIF p_recurrence_type = 'daily' THEN
    v_local_current := p_current_scheduled AT TIME ZONE v_tz;
    v_candidate := v_local_current + INTERVAL '1 day';
    v_result := v_candidate AT TIME ZONE v_tz;
    
    WHILE v_result <= NOW() AND v_iteration < v_max_iterations LOOP
      v_candidate := v_candidate + INTERVAL '1 day';
      v_result := v_candidate AT TIME ZONE v_tz;
      v_iteration := v_iteration + 1;
    END LOOP;

    IF p_end_at IS NOT NULL AND v_result > p_end_at THEN
      RETURN NULL;
    END IF;

    RETURN v_result;

  -- 3. WEEKLY
  ELSIF p_recurrence_type = 'weekly' THEN
    v_local_current := p_current_scheduled AT TIME ZONE v_tz;
    IF p_recurrence_days IS NULL OR array_length(p_recurrence_days, 1) = 0 THEN
      v_candidate := v_local_current + INTERVAL '7 days';
      v_result := v_candidate AT TIME ZONE v_tz;
      IF p_end_at IS NOT NULL AND v_result > p_end_at THEN
        RETURN NULL;
      END IF;
      RETURN v_result;
    END IF;

    v_candidate := v_local_current;
    LOOP
      v_candidate := v_candidate + INTERVAL '1 day';
      v_current_dow := EXTRACT(DOW FROM v_candidate);
      IF v_current_dow = ANY(p_recurrence_days) THEN
        v_result := v_candidate AT TIME ZONE v_tz;
        IF v_result > NOW() OR v_iteration >= v_max_iterations THEN
          IF p_end_at IS NOT NULL AND v_result > p_end_at THEN
            RETURN NULL;
          END IF;
          RETURN v_result;
        END IF;
      END IF;
      v_iteration := v_iteration + 1;
      EXIT WHEN v_iteration >= v_max_iterations;
    END LOOP;
    
    v_result := v_candidate AT TIME ZONE v_tz;
    IF p_end_at IS NOT NULL AND v_result > p_end_at THEN
      RETURN NULL;
    END IF;
    RETURN v_result;

  -- 4. MONTHLY
  ELSIF p_recurrence_type = 'monthly' THEN
    v_local_current := p_current_scheduled AT TIME ZONE v_tz;
    v_target_hour := EXTRACT(HOUR FROM v_local_current);
    v_target_min := EXTRACT(MINUTE FROM v_local_current);
    v_target_sec := EXTRACT(SECOND FROM v_local_current);
    v_year := EXTRACT(YEAR FROM v_local_current);
    v_month := EXTRACT(MONTH FROM v_local_current);
    v_target_day := COALESCE(p_recurrence_month_day, EXTRACT(DAY FROM v_local_current));

    LOOP
      v_month := v_month + 1;
      IF v_month > 12 THEN
        v_month := 1;
        v_year := v_year + 1;
      END IF;

      v_days_in_month := EXTRACT(DAY FROM (MAKE_DATE(v_year, v_month, 1) + INTERVAL '1 month' - INTERVAL '1 day'));

      v_candidate := MAKE_TIMESTAMP(
        v_year,
        v_month,
        LEAST(v_target_day, v_days_in_month),
        v_target_hour,
        v_target_min,
        v_target_sec
      );
      v_result := v_candidate AT TIME ZONE v_tz;

      IF v_result > NOW() OR v_iteration >= v_max_iterations THEN
        IF p_end_at IS NOT NULL AND v_result > p_end_at THEN
          RETURN NULL;
        END IF;
        RETURN v_result;
      END IF;

      v_iteration := v_iteration + 1;
      EXIT WHEN v_iteration >= v_max_iterations;
    END LOOP;

    IF p_end_at IS NOT NULL AND v_result > p_end_at THEN
      RETURN NULL;
    END IF;
    RETURN v_result;

  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Update claim_due_reminders to include hourly interval & end conditions
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
  recurrence_interval_hours INT,
  recurrence_end_at TIMESTAMPTZ,
  max_occurrences INT,
  occurrences_count INT,
  destination_email TEXT
) AS $$
DECLARE
  v_rec RECORD;
BEGIN
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
      r.recurrence_interval_hours,
      r.recurrence_end_at,
      r.max_occurrences,
      r.occurrences_count,
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
      recurrence_interval_hours := v_rec.recurrence_interval_hours;
      recurrence_end_at := v_rec.recurrence_end_at;
      max_occurrences := v_rec.max_occurrences;
      occurrences_count := v_rec.occurrences_count;
      destination_email := v_rec.dest_email;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update complete_reminder_occurrence to track occurrence counts and check termination
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
  v_new_count INT;
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
    v_new_count := v_reminder.occurrences_count + 1;

    -- Check if one-time or reached maximum allowed occurrences
    IF v_reminder.recurrence_type = 'none' OR v_reminder.recurrence_type IS NULL OR 
       (v_reminder.max_occurrences IS NOT NULL AND v_new_count >= v_reminder.max_occurrences) THEN
      UPDATE public.reminders
      SET 
        status = 'completed',
        occurrences_count = v_new_count,
        updated_at = NOW()
      WHERE id = p_reminder_id;
    ELSE
      -- Calculate next occurrence
      v_next_run := public.calculate_next_occurrence(
        p_scheduled_for,
        v_reminder.timezone,
        v_reminder.recurrence_type,
        v_reminder.recurrence_days,
        v_reminder.recurrence_month_day,
        v_reminder.recurrence_interval_hours,
        v_reminder.recurrence_end_at,
        v_reminder.max_occurrences,
        v_new_count
      );

      IF v_next_run IS NULL THEN
        -- Reached end condition (end date reached or limit hit)
        UPDATE public.reminders
        SET 
          status = 'completed',
          occurrences_count = v_new_count,
          updated_at = NOW()
        WHERE id = p_reminder_id;
      ELSE
        UPDATE public.reminders
        SET 
          next_run_at = v_next_run,
          occurrences_count = v_new_count,
          updated_at = NOW()
        WHERE id = p_reminder_id;
      END IF;
    END IF;

  -- 4. If failed, apply bounded retry backoff
  ELSIF p_status = 'failed' THEN
    SELECT COUNT(*) INTO v_attempt_count
    FROM public.reminder_logs
    WHERE reminder_id = p_reminder_id
      AND scheduled_for = p_scheduled_for;

    IF v_attempt_count < 3 THEN
      UPDATE public.reminders
      SET 
        next_run_at = NOW() + INTERVAL '5 minutes',
        updated_at = NOW()
      WHERE id = p_reminder_id;
    ELSE
      UPDATE public.reminders
      SET updated_at = NOW()
      WHERE id = p_reminder_id;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
