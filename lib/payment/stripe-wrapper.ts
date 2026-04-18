import { IPaymentProvider, CreatePaymentIntentParams, ConfirmPaymentParams, PaymentIntent } from './types';
import { MockStripeProvider } from './mock-stripe';
import { StripeProvider } from './stripe';



class PaymentService {
  private provider: IPaymentProvider;

  constructor() {
    const useMock = process.env.NEXT_PUBLIC_USE_MOCK_PAYMENT === 'true';
    
    if (useMock) {
      this.provider = new MockStripeProvider();
    } else {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not found in environment variables');
      this.provider = new StripeProvider(stripeKey);
    }
  }

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent> {
    return this.provider.createPaymentIntent(params);
  }

  async confirmPayment(params: ConfirmPaymentParams): Promise<PaymentIntent> {
    return this.provider.confirmPayment(params);
  }

  async cancelPayment(paymentIntentId: string): Promise<PaymentIntent> {
    return this.provider.cancelPayment(paymentIntentId);
  }
}

export const paymentService = new PaymentService();
