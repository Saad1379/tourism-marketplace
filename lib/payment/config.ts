export type PaymentProvider = 'stripe' | 'paddle';

export const getPaymentProvider = (): PaymentProvider => {
  return (process.env.NEXT_PUBLIC_PAYMENT_PROVIDER as PaymentProvider) || 'paddle';
};
