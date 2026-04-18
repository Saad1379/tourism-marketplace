import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const migration = `
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
  SELECT balance
    INTO v_balance
  FROM public.guide_credits
  WHERE guide_id = p_guide_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    INSERT INTO public.guide_credits (guide_id, balance, lifetime_earned)
    VALUES (p_guide_id, p_credits, p_credits);
  ELSE
    UPDATE public.guide_credits
      SET balance = balance + p_credits,
          lifetime_earned = COALESCE(lifetime_earned, 0) + p_credits,
          updated_at = NOW()
    WHERE guide_id = p_guide_id;
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
    p_description,
    p_reference_id
  );
END;
$$;
`

async function runMigration() {
  console.log('Running migration...')
  const { data, error } = await supabase.rpc('exec_sql', { sql: migration })
  
  if (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
  
  console.log('Migration completed successfully!')
}

runMigration()
