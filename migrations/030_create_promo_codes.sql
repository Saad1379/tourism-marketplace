-- Create the main promo codes table
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  credits_to_give integer NOT NULL DEFAULT 0,
  gives_pro_status boolean NOT NULL DEFAULT false,
  max_uses integer NOT NULL DEFAULT 1,
  current_uses integer NOT NULL DEFAULT 0,
  expires_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT promo_codes_pkey PRIMARY KEY (id)
);

-- Create the tracking table to prevent multiple redemptions by the same user
CREATE TABLE IF NOT EXISTS public.promo_code_redemptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  promo_code_id uuid NOT NULL,
  guide_id uuid NOT NULL,
  redeemed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT promo_code_redemptions_pkey PRIMARY KEY (id),
  CONSTRAINT promo_code_redemptions_promo_code_id_fkey FOREIGN KEY (promo_code_id) REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  CONSTRAINT promo_code_redemptions_guide_id_fkey FOREIGN KEY (guide_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT promo_code_redemptions_unique_user UNIQUE (promo_code_id, guide_id)
);

-- Turn on Row Level Security to prevent API tampering from the frontend
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_redemptions ENABLE ROW LEVEL SECURITY;

-- Allow users to simply 'view' active promo codes (useful for UI validation)
CREATE POLICY "Anyone can read active promo codes" 
ON public.promo_codes FOR SELECT 
USING (is_active = true);

-- Allow users to view their own redemptions
CREATE POLICY "Users can view their own redemptions" 
ON public.promo_code_redemptions FOR SELECT 
USING (guide_id = auth.uid());

-- NOTE: All Insert/Update transactions (burning a promo code and rewarding credits) 
-- will be handled securely by a backend Next.js API route using the Supabase Service Role Key 
-- to bypass these RLS restrictions. This prevents malicious frontend hackers from inventing their own redemptions.
