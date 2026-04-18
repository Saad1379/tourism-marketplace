import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { addCreditsToGuide, upgradeGuideToPro } from '@/lib/credits/credit-service';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentIntentId, amount, plan } = await request.json();

    if (!paymentIntentId || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Convert cents to euros (1 credit = 1 euro)
    const credits = Math.floor(amount / 100);
    const durationMonths = plan === 'yearly' ? 12 : 1;

    // Add credits to guide account
    await addCreditsToGuide(
      user.id,
      credits,
      `Purchased ${credits} credits via ${plan} plan`,
      paymentIntentId
    );

    // Upgrade to Pro
    await upgradeGuideToPro(user.id, durationMonths);

    return NextResponse.json({ 
      success: true, 
      credits,
      plan: 'pro',
      expiresInMonths: durationMonths
    });
  } catch (error) {
    console.error('Upgrade error:', error);
    return NextResponse.json({ error: 'Upgrade failed' }, { status: 500 });
  }
}
