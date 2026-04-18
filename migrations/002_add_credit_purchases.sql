-- Migration: Add credit purchases table to track real money transactions
-- Description: Records when guides buy credit packages via payment providers

CREATE TABLE IF NOT EXISTS public.credit_purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  guide_id uuid NOT NULL,
  package_id uuid NOT NULL,
  credits_added integer NOT NULL,
  amount_paid numeric NOT NULL,
  currency text DEFAULT 'EUR',
  payment_provider text,
  payment_reference text,
  status text DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT credit_purchases_pkey PRIMARY KEY (id),
  CONSTRAINT credit_purchases_guide_id_fkey FOREIGN KEY (guide_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT credit_purchases_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.credit_packages(id),
  CONSTRAINT credit_purchases_status_check CHECK (status IN ('pending', 'completed', 'failed', 'refunded'))
);

COMMENT ON TABLE public.credit_purchases IS 'Records of guide credit purchases with payment details';