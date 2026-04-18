import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: plan } = await supabase
      .from('guide_plans')
      .select('plan_type, expires_at')
      .eq('guide_id', user.id)
      .single();

    const { data: credits } = await supabase
      .from('guide_credits')
      .select('balance')
      .eq('guide_id', user.id)
      .single();

    return NextResponse.json({
      planType: plan?.plan_type || 'free',
      expiresAt: plan?.expires_at,
      credits: credits?.balance || 0,
    });
  } catch (error) {
    console.error('Plan fetch error:', error);
    return NextResponse.json({ planType: 'free', credits: 0 });
  }
}
