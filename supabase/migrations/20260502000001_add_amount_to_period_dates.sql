-- Add amount column to circle_period_dates if it doesn't already exist
-- This handles the case where the table was created before this column was defined
ALTER TABLE public.circle_period_dates
  ADD COLUMN IF NOT EXISTS amount NUMERIC;
