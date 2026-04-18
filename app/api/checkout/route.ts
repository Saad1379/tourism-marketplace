import { NextRequest, NextResponse } from 'next/server';
import { paymentService } from '@/lib/payment/stripe-wrapper';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, currency, paymentIntentId, packageId, source } = body;

    switch (action) {
      case 'create': {
        if (!packageId || !currency) {
          return NextResponse.json({ error: 'Package ID and currency required' }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        // Securely fetch exact package price and metadata from database
        const { data: pkg, error } = await supabase
          .from('credit_packages')
          .select('credits, price_eur')
          .eq('id', packageId)
          .single();

        if (error || !pkg) {
          return NextResponse.json({ error: 'Invalid credit package' }, { status: 400 });
        }

        const purchaseSource = typeof source === 'string' ? source : 'credits_purchase';

        if (purchaseSource === 'pro_activation') {
          const { data: currentPlan } = await supabase
            .from('guide_plans')
            .select('plan_type')
            .eq('guide_id', user.id)
            .maybeSingle();

          const isAlreadyPro = currentPlan?.plan_type === 'pro';
          if (!isAlreadyPro && Number(pkg.credits) !== 50) {
            return NextResponse.json(
              { error: 'First-time Pro activation must use the 50-credit package.' },
              { status: 400 },
            );
          }
        }

        // Backend locks in the calculation (Stripe needs it in cents)
        const serverComputedAmountInCents = Number(pkg.price_eur) * 100;

        const paymentIntent = await paymentService.createPaymentIntent({ 
          amount: serverComputedAmountInCents, 
          currency, 
          metadata: { 
            credits: pkg.credits.toString(),
            userId: user.id,
            packageId: packageId,
            amount_eur: pkg.price_eur.toString(),
            source: purchaseSource,
          } 
        });
        return NextResponse.json(paymentIntent);
      }

      case 'confirm': {
        // This action is deprecated - credits are now added via /api/checkout/success
        // Kept for backward compatibility but does nothing
        return NextResponse.json({ success: true });
      }

      case 'cancel': {
        if (!paymentIntentId) {
          return NextResponse.json({ error: 'Payment intent ID required' }, { status: 400 });
        }
        const paymentIntent = await paymentService.cancelPayment(paymentIntentId);
        return NextResponse.json(paymentIntent);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Payment processing failed' }, { status: 500 });
  }
}
