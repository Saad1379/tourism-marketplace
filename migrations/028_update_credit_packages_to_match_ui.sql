-- Migration: Update credit packages to match the UI
-- Description: Adds is_popular and savings_percentage fields, archives old packages, and inserts the new ones.

-- 1. Add new columns
ALTER TABLE public.credit_packages ADD COLUMN IF NOT EXISTS is_popular boolean DEFAULT false;
ALTER TABLE public.credit_packages ADD COLUMN IF NOT EXISTS savings_percentage integer DEFAULT null;

-- 2. Deactivate existing packages to avoid breaking transaction history in credit_purchases
UPDATE public.credit_packages SET is_active = false;

-- 3. Insert new UI-aligned packages
INSERT INTO public.credit_packages (name, credits, price_eur, is_active, display_order, is_popular, savings_percentage) VALUES
  ('Starter', 50, 50.00, true, 1, false, null),
  ('Popular', 150, 150.00, true, 2, true, null),
  ('Pro', 350, 350.00, true, 3, false, null),
  ('Enterprise', 1000, 1000.00, true, 4, false, null);
