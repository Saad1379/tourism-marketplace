-- Migration: Add credit packages table for guides to purchase credits
-- Description: Defines bundles of credits that guides can buy

CREATE TABLE IF NOT EXISTS public.credit_packages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  credits integer NOT NULL,
  price_eur numeric NOT NULL,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT credit_packages_pkey PRIMARY KEY (id)
);

-- Seed default packages
INSERT INTO public.credit_packages (name, credits, price_eur, display_order) VALUES
  ('Starter Pack', 50, 50.00, 1),
  ('Popular Choice', 100, 95.00, 2),
  ('Best Value', 200, 180.00, 3),
  ('Pro Bundle', 500, 425.00, 4)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.credit_packages IS 'Credit packages available for guides to purchase';