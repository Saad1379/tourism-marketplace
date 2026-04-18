-- RLS policies to protect wallet and credit ledger

ALTER TABLE public.guide_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guide_credits_select_own ON public.guide_credits;
DROP POLICY IF EXISTS guide_credits_update_own ON public.guide_credits;
DROP POLICY IF EXISTS guide_credits_insert_own ON public.guide_credits;

CREATE POLICY guide_credits_select_own
  ON public.guide_credits
  FOR SELECT
  USING (guide_id = auth.uid());

DROP POLICY IF EXISTS credit_transactions_select_own ON public.credit_transactions;
DROP POLICY IF EXISTS credit_transactions_insert_own ON public.credit_transactions;

CREATE POLICY credit_transactions_select_own
  ON public.credit_transactions
  FOR SELECT
  USING (guide_id = auth.uid());

-- No INSERT/UPDATE policies: only SECURITY DEFINER functions may modify these tables.
