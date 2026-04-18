'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useUserStore } from '@/store/user-store';

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { fetchPlan } = useUserStore();
  const [processing, setProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const credits = searchParams.get('credits');
  const paymentIntent = searchParams.get('payment_intent');
  const source = searchParams.get('source') || 'credits_purchase';
  const packageId = searchParams.get('package_id');
  const hasProcessed = React.useRef(false);

  useEffect(() => {
    const processPayment = async () => {
      // Prevent React StrictMode from firing this twice
      if (hasProcessed.current) return;
      hasProcessed.current = true;

      if (!paymentIntent || !credits) {
        setError('Invalid payment information');
        setProcessing(false);
        return;
      }

      try {
        const response = await fetch('/api/checkout/success', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentIntentId: paymentIntent,
            credits: parseInt(credits),
            source,
            packageId,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to process payment');
        }

        await fetchPlan();
        setProcessing(false);
      } catch (err) {
        setError('Failed to add credits');
        setProcessing(false);
      }
    };

    processPayment();
  }, [paymentIntent, credits, source, packageId, fetchPlan]);

  if (processing) {
    return (
      <div className="container max-w-md mx-auto py-16 px-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <h2 className="text-xl font-semibold mb-2">Processing Payment</h2>
            <p className="text-muted-foreground">Please wait while we confirm your payment...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-md mx-auto py-16 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Payment Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => router.push('/checkout')} className="w-full">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-md mx-auto py-16 px-4">
      <Card>
        <CardContent className="pt-6 text-center">
          <CheckCircle2 className="h-16 w-16 text-secondary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
          <p className="text-muted-foreground mb-6">
            {credits} credits have been added to your account.
          </p>
          <Button onClick={() => router.push('/dashboard/credits')} className="w-full">
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
