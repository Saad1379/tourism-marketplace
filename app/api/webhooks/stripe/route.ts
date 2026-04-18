import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Initialize the Stripe server client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-11-17.clover' });

export async function POST(request: NextRequest) {
  // We need the raw body text to cryptographically verify the signature
  const bodyText = await request.text();
  const signature = request.headers.get('Stripe-Signature');

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook Error: Missing signature or secret variable' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    // 1. Verify the signature proves this request actually came from Stripe
    event = stripe.webhooks.constructEvent(bodyText, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // 2. We only care about successful payments right now
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    
    // Extract metadata that we securely attached in /api/checkout/route.ts
    const userId = paymentIntent.metadata?.userId;
    const creditsStr = paymentIntent.metadata?.credits;

    const packageId = paymentIntent.metadata?.packageId;
    const amountEurStr = paymentIntent.metadata?.amount_eur;
    const purchaseSource = paymentIntent.metadata?.source || 'credits_purchase';

    if (!userId || !creditsStr || !packageId || !amountEurStr) {
      console.error(`Webhook Error [${paymentIntent.id}]: Missing logic metadata`);
      return NextResponse.json({ error: 'Missing logic metadata' }, { status: 400 });
    }

    const creditsToAdd = parseInt(creditsStr, 10);
    const amountPaid = parseFloat(amountEurStr);

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. IDEMPOTENCY CHECK: Did we already process this exact payment intent ID?
    // We check the pure credit_purchases table where Stripe IDs ('pi_123') are meant to live!
    const { data: existingPurchase, error: purchaseCheckError } = await supabaseAdmin
      .from('credit_purchases')
      .select('id')
      .eq('payment_reference', paymentIntent.id)
      .maybeSingle();

    if (purchaseCheckError) {
      console.error('Error checking existing purchase:', purchaseCheckError);
      return NextResponse.json({ error: 'Database check failed' }, { status: 500 });
    }

    // Stop early to prevent a double-reward glitch!
    if (existingPurchase) {
      console.log(`Webhook: PaymentIntent ${paymentIntent.id} already processed. Skipping.`);
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    // 4. Insert into standard Purchases table & trigger real DB UUID generation
    const { data: newPurchase, error: insertError } = await supabaseAdmin
      .from('credit_purchases')
      .insert({
        guide_id: userId,
        package_id: packageId,
        credits_added: creditsToAdd,
        amount_paid: amountPaid,
        currency: 'EUR',
        payment_provider: 'stripe',
        payment_reference: paymentIntent.id,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (insertError || !newPurchase) {
      console.error('Webhook: Error inserting credit purchase:', insertError);
      return NextResponse.json({ error: 'Failed to record purchase' }, { status: 500 });
    }

    // 5. Securely add credits to internal ledger using the REAL UUID from the purchases table
    const { error: rpcError } = await supabaseAdmin.rpc('add_credits', {
      p_guide_id: userId,
      p_credits: creditsToAdd,
      p_description: `Credit purchase - ${creditsToAdd} credits`,
      p_reference_id: newPurchase.id 
    });

    if (rpcError) {
      console.error('Webhook: Error executing add_credits RPC:', rpcError);
      return NextResponse.json({ error: 'Failed to add credits to ledger' }, { status: 500 });
    }

    // 6. First-time Pro activation policy: only 50-credit purchase upgrades Free -> Pro.
    if (creditsToAdd === 50) {
      const { data: existingPlan, error: planFetchError } = await supabaseAdmin
        .from('guide_plans')
        .select('id, plan_type')
        .eq('guide_id', userId)
        .maybeSingle();

      if (planFetchError) {
        console.error('Webhook: Error fetching plan:', planFetchError);
      } else if (!existingPlan) {
        const { error: insertError } = await supabaseAdmin.from('guide_plans').insert({
          guide_id: userId,
          plan_type: 'pro',
          started_at: new Date().toISOString()
        });
        if (insertError) console.error('Webhook: Error inserting plan:', insertError);
      } else if (existingPlan.plan_type !== 'pro') {
        const { error: updateError } = await supabaseAdmin
          .from('guide_plans')
          .update({ plan_type: 'pro', started_at: new Date().toISOString() })
          .eq('guide_id', userId);
        if (updateError) console.error('Webhook: Error updating plan:', updateError);
      }
    }

    console.log(`Webhook Success: Rewarded ${creditsToAdd} credits to user ${userId} for intent ${paymentIntent.id} [source=${purchaseSource}]`);
  }

  // Acknowledge receipt to Stripe so they don't resend the webhook
  return NextResponse.json({ success: true, received: true });
}
