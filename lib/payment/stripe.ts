import { IPaymentProvider, CreatePaymentIntentParams, ConfirmPaymentParams, PaymentIntent } from './types';
import Stripe from 'stripe';


export class StripeProvider implements IPaymentProvider {
  private stripe: Stripe;
  
  constructor(apiKey: string) {
    this.stripe = new Stripe(apiKey, { apiVersion: '2025-11-17.clover' });
  }
  
  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent> {
    const intent = await this.stripe.paymentIntents.create({
      amount: params.amount,
      currency: params.currency,
      metadata: params.metadata,
      automatic_payment_methods: { enabled: true },
    });
    return {
      id: intent.id,
      amount: intent.amount,
      currency: intent.currency,
      status: intent.status as any,
      clientSecret: intent.client_secret!,
      metadata: intent.metadata,
    };
  }
  
  async confirmPayment(params: ConfirmPaymentParams): Promise<PaymentIntent> {
    const intent = await this.stripe.paymentIntents.confirm(params.paymentIntentId, {
      payment_method: params.paymentMethodId,
    });
    return {
      id: intent.id,
      amount: intent.amount,
      currency: intent.currency,
      status: intent.status as any,
      clientSecret: intent.client_secret!,
      metadata: intent.metadata,
    };
  }
  
  async cancelPayment(paymentIntentId: string): Promise<PaymentIntent> {
    const intent = await this.stripe.paymentIntents.cancel(paymentIntentId);
    return {
      id: intent.id,
      amount: intent.amount,
      currency: intent.currency,
      status: intent.status as any,
      clientSecret: intent.client_secret!,
      metadata: intent.metadata,
    };
  }
}