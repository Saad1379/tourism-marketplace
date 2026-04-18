import { IPaymentProvider, PaymentIntent, CreatePaymentIntentParams, ConfirmPaymentParams } from './types';

export class MockStripeProvider implements IPaymentProvider {
  private paymentIntents: Map<string, PaymentIntent> = new Map();

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent> {
    const id = `pi_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const clientSecret = `${id}_secret_${Math.random().toString(36).substr(2, 9)}`;

    const paymentIntent: PaymentIntent = {
      id,
      amount: params.amount,
      currency: params.currency,
      status: 'requires_payment_method',
      clientSecret,
      metadata: params.metadata,
    };

    this.paymentIntents.set(id, paymentIntent);
    return paymentIntent;
  }

  async confirmPayment(params: ConfirmPaymentParams): Promise<PaymentIntent> {
    const paymentIntent = this.paymentIntents.get(params.paymentIntentId);
    
    if (!paymentIntent) {
      throw new Error('Payment intent not found');
    }

    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock success (90% success rate)
    const isSuccess = Math.random() > 0.1;
    
    paymentIntent.status = isSuccess ? 'succeeded' : 'requires_payment_method';
    this.paymentIntents.set(params.paymentIntentId, paymentIntent);

    return paymentIntent;
  }

  async cancelPayment(paymentIntentId: string): Promise<PaymentIntent> {
    const paymentIntent = this.paymentIntents.get(paymentIntentId);
    
    if (!paymentIntent) {
      throw new Error('Payment intent not found');
    }

    paymentIntent.status = 'canceled';
    this.paymentIntents.set(paymentIntentId, paymentIntent);

    return paymentIntent;
  }
}
