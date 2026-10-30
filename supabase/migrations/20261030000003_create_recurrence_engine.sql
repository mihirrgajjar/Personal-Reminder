-- Migration: 20261030000003_create_recurrence_engine.sql
-- Description: Server-side recurrence engine for calculating next occurrences

/**
 * public.calculate_next_occurrence
 * 
 * Computes the next scheduled timestamp for a reminder based on its recurrence rule:
 * - 'none': Returns NULL.
 * - 'daily': Next calendar day at the same wall-clock time in the given timezone.
 * - 'weekly': Next occurrence on one of the specified weekdays (0=Sun, 1=Mon, ..., 6=Sat).
 * - 'monthly': Target day of the next month. If the month has fewer days, clamps to the last day of that month.
 *
 * Guarantees:
 * 1. Advances from p_current_scheduled, not current time.
 * 2. If the computed occurrence is still in the past, advances forward iteratively (bounded to 500 iterations to prevent infinite loops).
 * 3. Wall-clock hour, minute, second are preserved in the target timezone.
 */
CREATE OR REPLACE FUNCTION public.calculate_next_occurrence(
  p_current_scheduled TIMESTAMPTZ,
  p_timezone TEXT,
  p_recurrence_type TEXT,
  p_recurrence_days INTEGER[] DEFAULT NULL,
  p_recurrence_month_day INTEGER DEFAULT NULL
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
  v_day_offset INT;
  v_found_day BOOLEAN;
  v_days_in_month INT;
  v_year INT;
  v_month INT;
  v_target_day INT;
  v_iteration INT := 0;
  v_max_iterations CONSTANT INT := 500;
BEGIN
  -- Validate recurrence type
  IF p_recurrence_type IS NULL OR p_recurrence_type = 'none' THEN
    RETURN NULL;
  END IF;

  v_tz := COALESCE(NULLIF(p_timezone, ''), 'Asia/Kolkata');
  
  -- Convert scheduled timestamptz to wall-clock timestamp in local timezone
  v_local_current := p_current_scheduled AT TIME ZONE v_tz;
  v_target_hour := EXTRACT(HOUR FROM v_local_current);
  v_target_min := EXTRACT(MINUTE FROM v_local_current);
  v_target_sec := EXTRACT(SECOND FROM v_local_current);

  -- 1. DAILY
  IF p_recurrence_type = 'daily' THEN
    v_candidate := v_local_current + INTERVAL '1 day';
    v_result := v_candidate AT TIME ZONE v_tz;
    
    -- Catch up if still behind now()
    WHILE v_result <= NOW() AND v_iteration < v_max_iterations LOOP
      v_candidate := v_candidate + INTERVAL '1 day';
      v_result := v_candidate AT TIME ZONE v_tz;
      v_iteration := v_iteration + 1;
    END LOOP;
    RETURN v_result;

  -- 2. WEEKLY
  ELSIF p_recurrence_type = 'weekly' THEN
    IF p_recurrence_days IS NULL OR array_length(p_recurrence_days, 1) = 0 THEN
      -- Default to same day next week if no specific days were saved
      v_candidate := v_local_current + INTERVAL '7 days';
      RETURN v_candidate AT TIME ZONE v_tz;
    END IF;

    v_candidate := v_local_current;
    LOOP
      v_candidate := v_candidate + INTERVAL '1 day';
      -- In Postgres EXTRACT(DOW FROM ...) returns 0 for Sunday to 6 for Saturday
      v_current_dow := EXTRACT(DOW FROM v_candidate);
      IF v_current_dow = ANY(p_recurrence_days) THEN
        v_result := v_candidate AT TIME ZONE v_tz;
        IF v_result > NOW() OR v_iteration >= v_max_iterations THEN
          RETURN v_result;
        END IF;
      END IF;
      v_iteration := v_iteration + 1;
      EXIT WHEN v_iteration >= v_max_iterations;
    END LOOP;
    RETURN v_candidate AT TIME ZONE v_tz;

  -- 3. MONTHLY
  ELSIF p_recurrence_type = 'monthly' THEN
    v_year := EXTRACT(YEAR FROM v_local_current);
    v_month := EXTRACT(MONTH FROM v_local_current);
    v_target_day := COALESCE(p_recurrence_month_day, EXTRACT(DAY FROM v_local_current));

    LOOP
      v_month := v_month + 1;
      IF v_month > 12 THEN
        v_month := 1;
        v_year := v_year + 1;
      END IF;

      -- Calculate last day of target month:
      -- Start at 1st of month, add 1 month, subtract 1 day
      v_days_in_month := EXTRACT(DAY FROM (MAKE_DATE(v_year, v_month, 1) + INTERVAL '1 month' - INTERVAL '1 day'));

      -- Clamp target day if target exceeds days in month (e.g. 31 in Feb -> 28 or 29)
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
        RETURN v_result;
      END IF;

      v_iteration := v_iteration + 1;
      EXIT WHEN v_iteration >= v_max_iterations;
    END LOOP;
    RETURN v_result;

  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to automatically calculate next_run_at when reminders are inserted or updated
CREATE OR REPLACE FUNCTION public.handle_reminder_recurrence_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.recurrence_type IS NULL OR NEW.recurrence_type = 'none' THEN
    NEW.recurrence_days := NULL;
    NEW.recurrence_month_day := NULL;
    NEW.next_run_at := NEW.scheduled_at;
  ELSE
    -- If next_run_at is not explicitly provided, compute it
    IF NEW.next_run_at IS NULL THEN
      NEW.next_run_at := NEW.scheduled_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_handle_reminder_recurrence ON public.reminders;
CREATE TRIGGER trigger_handle_reminder_recurrence
  BEFORE INSERT OR UPDATE OF recurrence_type, scheduled_at, recurrence_days, recurrence_month_day
  ON public.reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_reminder_recurrence_update();
