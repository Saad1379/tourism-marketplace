-- Create add_credits function for credit purchases
CREATE OR REPLACE FUNCTION public.add_credits(
  p_guide_id uuid,
  p_credits integer,
  p_description text,
  p_reference_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance numeric;
BEGIN
  -- Check if this payment has already been processed
  IF p_reference_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.credit_transactions
    WHERE description LIKE '%' || p_reference_id || '%'
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

  INSERT INTO public.credit_transactions (
    guide_id,
    type,
    amount,
    description
  )
  VALUES (
    p_guide_id,
    'purchase',
    p_credits,
    p_description || ' - ' || COALESCE(p_reference_id, '')
  );
END;
$$;
