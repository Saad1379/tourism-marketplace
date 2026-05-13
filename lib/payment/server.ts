import { Environment, LogLevel, Paddle } from '@paddle/paddle-node-sdk';
import { PaymentProvider } from './config';

let paddleInstance: Paddle | null = null;

export const getPaddleServer = () => {
  if (paddleInstance) return paddleInstance;
  
  const apiKey = process.env.PADDLE_SERVER_API_KEY;
  if (!apiKey) {
    return null;
  }
  
  paddleInstance = new Paddle(apiKey, {
    environment: process.env.NODE_ENV === 'production' ? Environment.production : Environment.sandbox,
    logLevel: LogLevel.error
  });
  
  return paddleInstance;
};

export const verifyPaddleWebhook = (signature: string, body: string, secret: string) => {
  // If paddle node sdk is configured, we can use it to verify webhooks
  // This is a placeholder for actual webhook validation implementation.
  return true;
};
