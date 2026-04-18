-- Migration: Fix add_credits function to stop appending UUIDs to descriptions
-- Description: Updates the add_credits RPC to properly store real UUIDs in the reference_id column instead of appending them to the description text, while keeping fallback logic for mock text IDs.

CREATE OR REPLACE FUNCTION public.add_credits(
  p_guide_id uuid,
  p_credits integer,
  p_description text,
  p_reference_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance numeric;
  v_is_uuid boolean;
  v_final_description text;
BEGIN
  -- Check if this payment has already been processed 
  -- (supporting both old description-based checks and new reference_id checks)
  IF p_reference_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.credit_transactions
    WHERE (description LIKE '%' || p_reference_id || '%' OR reference_id::text = p_reference_id)
      AND type = 'purchase'
  ) THEN
    RETURN;
  END IF;

  SELECT balance
    INTO v_balance
  FROM public.guide_credits
  WHERE guide_id = p_guide_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    INSERT INTO public.guide_credits (guide_id, balance)
    VALUES (p_guide_id, p_credits);
  ELSE
    UPDATE public.guide_credits
      SET balance = balance + p_credits,
          updated_at = NOW()
    WHERE guide_id = p_guide_id;
  END IF;

  -- Regex check to safely determine if p_reference_id is a valid UUID
  v_is_uuid := p_reference_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  -- If it's a real Stripe Webhook UUID passing through, we keep the description perfectly clean.
  -- If it's a local mock stripe string (pi_mock_123...), we append it so it's not lost.
  IF v_is_uuid OR p_reference_id IS NULL THEN
    v_final_description := p_description;
  ELSE
    v_final_description := p_description || ' - ' || p_reference_id;
  END IF;

  INSERT INTO public.credit_transactions (
    guide_id,
    type,
    amount,
    description,
    reference_id
  )
  VALUES (
    p_guide_id,
    'purchase',
    p_credits,
    v_final_description,
    CASE WHEN v_is_uuid THEN p_reference_id::uuid ELSE NULL END
  );
END;
$$;
