// Payment Processor Integration Module
export * from './StripeService';
export * from './PayPalService';

import { StripeService } from './StripeService';
import { PayPalService } from './PayPalService';

export class PaymentProcessorFactory {
  static createProcessor(processorType: 'stripe' | 'paypal'): any {
    switch (processorType) {
      case 'stripe':
        return new StripeService();
      case 'paypal':
        return new PayPalService();
      default:
        throw new Error(`Unknown payment processor: ${processorType}`);
    }
  }
}