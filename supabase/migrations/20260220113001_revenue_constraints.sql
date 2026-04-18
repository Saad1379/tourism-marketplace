-- Revenue constraints: non-negative balances, transaction idempotency, and type safety

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'balance_non_negative'
      AND conrelid = 'public.guide_credits'::regclass
  ) THEN
    ALTER TABLE public.guide_credits
      ADD CONSTRAINT balance_non_negative CHECK (balance >= 0);
  END IF;
END $$;

-- Ensure credit_transactions.type allows auto_topup
ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS reference_id uuid;

DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT c.conname
    INTO v_conname
  FROM pg_constraint c
  JOIN pg_attribute a
    ON a.attrelid = c.conrelid
   AND a.attnum = ANY (c.conkey)
  WHERE c.conrelid = 'public.credit_transactions'::regclass
    AND a.attname = 'type'
    AND c.contype = 'c'
  LIMIT 1;

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.credit_transactions DROP CONSTRAINT %I', v_conname);
  END IF;

  -- Use NOT VALID to avoid failing on legacy rows with older type values.
  -- Keep legacy values allowed for backward compatibility.
  ALTER TABLE public.credit_transactions
    ADD CONSTRAINT credit_transactions_type_check
    CHECK (type IN ('purchase', 'spend', 'bonus', 'refund', 'auto_topup', 'boost', 'attendance_fee'))
    NOT VALID;
END $$;

-- Idempotency guard for booking deductions/refunds
CREATE UNIQUE INDEX IF NOT EXISTS unique_booking_deduction
  ON public.credit_transactions (reference_id, type)
  WHERE type IN ('spend', 'refund');
