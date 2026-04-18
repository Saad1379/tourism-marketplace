import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: creditAccount } = await supabase
      .from('guide_credits')
      .select('balance')
      .eq('guide_id', user.id)
      .single();

    const { data: transactions } = await supabase
      .from('credit_transactions')
      .select('id, type, amount, description, reference_id, created_at')
      .eq('guide_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      balance: creditAccount?.balance || 0,
      transactions: transactions || [],
    });
  } catch (error) {
    console.error('Credits fetch error:', error);
    return NextResponse.json({ balance: 0, transactions: [] });
  }
}
