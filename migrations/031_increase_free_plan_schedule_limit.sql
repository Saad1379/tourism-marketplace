-- Raise the free-plan weekly schedule cap from 2 to 5.
--
-- Rationale: publishing a tour requires at least 3 upcoming dates, but the
-- previous 2/week cap made satisfying that within a single week impossible and
-- forced guides to stagger schedules across weeks unnecessarily. 5/week keeps
-- the plan meaningfully limited while allowing the publish rule to be met.

UPDATE public.plan_settings
SET max_schedules_per_week = 5,
    updated_at = NOW()
WHERE plan_type = 'free'
  AND max_schedules_per_week = 2;

ALTER TABLE public.plan_settings
  ALTER COLUMN max_schedules_per_week SET DEFAULT 5;
