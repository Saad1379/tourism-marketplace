import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { paymentIntentId, credits, source, packageId } = await request.json();

    if (!paymentIntentId || !credits) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const useMock = process.env.NEXT_PUBLIC_USE_MOCK_PAYMENT === 'true';

    // 1. If using REAL Stripe, do not double-process! The background Webhook handles the DB correctly.
    // We just return 200 OK so the frontend page can show the animated green checkmark.
    if (!useMock) {
      return NextResponse.json({ success: true, message: 'Processing handled asynchronously by webhook' });
    }

    // 2. If using MOCK Stripe, no Webhook is ever fired. We must fulfill the credits right here right now.
    if (!paymentIntentId.startsWith('pi_mock_')) {
      return NextResponse.json({ error: 'Invalid mock payment intent' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for mock duplicates quickly
    const { data: existingTx } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('reference_id', paymentIntentId)
      .maybeSingle();

    if (existingTx) {
      return NextResponse.json({ success: true, message: 'Already processed mock' });
    }

    const { error } = await supabase.rpc('add_credits', {
      p_guide_id: user.id,
      p_credits: credits,
      p_description: `[MOCK] Credit purchase - ${credits} credits`,
      p_reference_id: paymentIntentId
    });

    if (error) {
      console.error('Error adding mock credits:', error);
      return NextResponse.json({ error: 'Failed to add mock credits' }, { status: 500 });
    }

    const { data: existingPlan } = await supabase
      .from('guide_plans')
      .select('id, plan_type')
      .eq('guide_id', user.id)
      .maybeSingle();

    const normalizedCredits = Number(credits);
    const shouldUpgradeFromPurchase = normalizedCredits === 50;

    if (shouldUpgradeFromPurchase && !existingPlan) {
      await supabase.from('guide_plans').insert({
        guide_id: user.id,
        plan_type: 'pro',
        started_at: new Date().toISOString()
      });
    } else if (shouldUpgradeFromPurchase && existingPlan && existingPlan.plan_type !== 'pro') {
      await supabase
        .from('guide_plans')
        .update({ plan_type: 'pro', started_at: new Date().toISOString() })
        .eq('guide_id', user.id);
    }

    return NextResponse.json({ success: true, message: 'Mock payment fulfilled', source, packageId });
  } catch (error) {
    console.error('Checkout success error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
