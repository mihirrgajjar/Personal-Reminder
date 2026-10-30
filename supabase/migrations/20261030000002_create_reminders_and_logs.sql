-- Migration: 20261030000002_create_reminders_and_logs.sql
-- Description: Creates reminders and reminder_logs tables with constraints, indexes, and RLS

-- 1. Create reminders table
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  recurrence_type TEXT NOT NULL DEFAULT 'none' CHECK (recurrence_type IN ('none', 'daily', 'weekly', 'monthly')),
  -- For weekly recurrence: integer array with 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  recurrence_days INTEGER[] DEFAULT NULL,
  -- For monthly recurrence: day of month (1 to 31)
  recurrence_month_day INTEGER DEFAULT NULL CHECK (recurrence_month_day IS NULL OR (recurrence_month_day >= 1 AND recurrence_month_day <= 31)),
  next_run_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Trigger to keep next_run_at synchronized with scheduled_at on insert if next_run_at is null
CREATE OR REPLACE FUNCTION public.sync_reminder_next_run()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.next_run_at IS NULL AND NEW.status = 'active' THEN
    NEW.next_run_at = NEW.scheduled_at;
  END IF;
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_reminder_next_run ON public.reminders;
CREATE TRIGGER trigger_sync_reminder_next_run
  BEFORE INSERT OR UPDATE ON public.reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_reminder_next_run();

-- 2. Create reminder_logs table
CREATE TABLE IF NOT EXISTS public.reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID NOT NULL REFERENCES public.reminders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  sent_at TIMESTAMPTZ,
  email_status TEXT NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'failed')),
  provider_message_id TEXT,
  error_message TEXT,
  -- Unique idempotency constraint preventing duplicate email dispatches for the same scheduled occurrence
  CONSTRAINT uq_reminder_occurrence_idempotency UNIQUE (reminder_id, scheduled_for)
);

-- 3. Indexes for fast query performance
CREATE INDEX IF NOT EXISTS idx_reminders_due 
  ON public.reminders (status, next_run_at) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_reminders_user_id 
  ON public.reminders (user_id);

CREATE INDEX IF NOT EXISTS idx_reminders_scheduled_at 
  ON public.reminders (scheduled_at);

CREATE INDEX IF NOT EXISTS idx_reminder_logs_user_id 
  ON public.reminder_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_reminder_logs_reminder_id 
  ON public.reminder_logs (reminder_id);

CREATE INDEX IF NOT EXISTS idx_reminder_logs_scheduled_for 
  ON public.reminder_logs (scheduled_for);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;

-- 5. Strict RLS Policies for reminders
CREATE POLICY "Owner can view own reminders"
  ON public.reminders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can insert own reminders"
  ON public.reminders
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update own reminders"
  ON public.reminders
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can delete own reminders"
  ON public.reminders
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 6. Strict RLS Policies for reminder_logs
CREATE POLICY "Owner can view own reminder logs"
  ON public.reminder_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can insert own reminder logs"
  ON public.reminder_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update own reminder logs"
  ON public.reminder_logs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can delete own reminder logs"
  ON public.reminder_logs
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
