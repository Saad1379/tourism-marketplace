import { useEffect, useState } from 'react';
import { getPaymentProvider, PaymentProvider } from './config';
import { initializePaddle, Paddle } from '@paddle/paddle-js';

export interface CheckoutOptions {
  packageId: string;
  credits: number;
  price: number;
  source: string;
  paddlePriceId?: string;
  onSuccess?: () => void;
  onClose?: () => void;
}

export function usePayment() {
  const provider = getPaymentProvider();
  const [paddle, setPaddle] = useState<Paddle | null>(null);

  useEffect(() => {
    if (provider === 'paddle' && process.env.NEXT_PUBLIC_PADDLE_CLIENT_SIDE_TOKEN) {
      initializePaddle({ environment: 'production', token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_SIDE_TOKEN }).then(
        (paddleInstance) => {
          if (paddleInstance) {
            setPaddle(paddleInstance);
          }
        }
      );
    }
  }, [provider]);

  const openCheckout = (options: CheckoutOptions, router: any) => {
    if (provider === 'stripe') {
      router.push(`/checkout?id=${encodeURIComponent(options.packageId)}&source=${encodeURIComponent(options.source)}`);
    } else if (provider === 'paddle') {
      if (!paddle) {
        console.error('Paddle is not initialized yet');
        return;
      }
      
      if (!options.paddlePriceId) {
        console.error('Paddle price ID is required for Paddle checkout');
        // Fallback to error or default
        return;
      }

      paddle.Checkout.open({
        items: [{ priceId: options.paddlePriceId, quantity: 1 }],
        customData: {
          package_id: options.packageId,
          source: options.source,
          credits: options.credits.toString()
        },
        settings: {
          successUrl: `${window.location.origin}/checkout/success?credits=${options.credits}&package_id=${options.packageId}&source=${encodeURIComponent(options.source)}`,
        }
      });
    }
  };

  return {
    provider,
    openCheckout,
    isReady: provider === 'stripe' || (provider === 'paddle' && paddle !== null)
  };
}
