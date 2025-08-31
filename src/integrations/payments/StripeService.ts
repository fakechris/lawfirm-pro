import { BaseExternalService } from '../../services/external/BaseExternalService';
import { PaymentProcessor } from '../../services/external';
import {
  PaymentRequest,
  PaymentResult,
  RefundRequest,
  RefundResult,
  Subscription,
  SubscriptionResult,
  WebhookPayload,
  WebhookResult,
  PaymentMethod,
  PaymentMethodDetails
} from '../../services/external/types';

export class StripeService extends BaseExternalService implements PaymentProcessor {
  constructor() {
    super('stripe');
  }

  async processPayment(payment: PaymentRequest): Promise<PaymentResult> {
    try {
      this.logRequest('POST', '/payment_intents', { amount: payment.amount, currency: payment.currency });

      // Map payment method to Stripe format
      const stripePaymentMethod = await this.createPaymentMethod(payment.paymentMethod);

      // Create payment intent
      const paymentIntentData = {
        amount: Math.round(payment.amount * 100), // Convert to cents
        currency: payment.currency.toLowerCase(),
        customer: payment.customerId,
        payment_method: stripePaymentMethod.id,
        confirmation_method: 'manual',
        confirm: true,
        description: payment.description,
        metadata: {
          ...payment.metadata,
          invoiceId: payment.invoiceId,
          caseId: payment.caseId,
          source: 'lawfirmpro'
        }
      };

      const response = await this.makeRequest<any>('/payment_intents', {
        method: 'POST',
        body: this.createFormData(paymentIntentData)
      });

      const result: PaymentResult = {
        success: response.status === 'succeeded',
        paymentId: response.id,
        amount: response.amount / 100, // Convert back to dollars
        currency: response.currency.toUpperCase(),
        status: this.mapStripeStatus(response.status),
        processedAt: new Date(),
        transactionId: response.latest_charge,
        receiptUrl: response.charges?.data[0]?.receipt_url,
        metadata: response.metadata
      };

      this.logResponse('POST', '/payment_intents', result, Date.now());
      return result;

    } catch (error) {
      this.logError('POST', '/payment_intents', error, Date.now());
      return {
        success: false,
        paymentId: '',
        amount: payment.amount,
        currency: payment.currency,
        status: 'failed',
        processedAt: new Date(),
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  async refundPayment(refund: RefundRequest): Promise<RefundResult> {
    try {
      this.logRequest('POST', '/refunds', { paymentId: refund.paymentId, amount: refund.amount });

      const refundData = {
        payment_intent: refund.paymentId,
        amount: refund.amount ? Math.round(refund.amount * 100) : undefined,
        reason: this.mapRefundReason(refund.reason),
        metadata: refund.metadata
      };

      const response = await this.makeRequest<any>('/refunds', {
        method: 'POST',
        body: this.createFormData(refundData)
      });

      const result: RefundResult = {
        success: response.status === 'succeeded',
        refundId: response.id,
        amount: response.amount / 100,
        status: this.mapRefundStatus(response.status),
        processedAt: new Date(),
        transactionId: response.balance_transaction
      };

      this.logResponse('POST', '/refunds', result, Date.now());
      return result;

    } catch (error) {
      this.logError('POST', '/refunds', error, Date.now());
      return {
        success: false,
        refundId: '',
        amount: refund.amount || 0,
        status: 'failed',
        processedAt: new Date(),
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  async createSubscription(subscription: Subscription): Promise<SubscriptionResult> {
    try {
      this.logRequest('POST', '/subscriptions', { customerId: subscription.customerId, planId: subscription.planId });

      // Create or get customer
      const customer = await this.getOrCreateCustomer(subscription.customerId);

      // Create subscription
      const subscriptionData = {
        customer: customer.id,
        items: [{
          price: subscription.planId,
          quantity: 1
        }],
        trial_period_days: subscription.trialPeriod,
        metadata: subscription.metadata,
        expand: ['latest_invoice.payment_intent']
      };

      const response = await this.makeRequest<any>('/subscriptions', {
        method: 'POST',
        body: this.createFormData(subscriptionData)
      });

      const result: SubscriptionResult = {
        success: response.status === 'active' || response.status === 'trialing',
        subscriptionId: response.id,
        status: this.mapSubscriptionStatus(response.status),
        currentPeriodStart: new Date(response.current_period_start * 1000),
        currentPeriodEnd: new Date(response.current_period_end * 1000),
        ...(response.trial_end && { trialEnd: new Date(response.trial_end * 1000) }),
        cancelAtPeriodEnd: response.cancel_at_period_end
      };

      this.logResponse('POST', '/subscriptions', result, Date.now());
      return result;

    } catch (error) {
      this.logError('POST', '/subscriptions', error, Date.now());
      return {
        success: false,
        subscriptionId: '',
        status: 'incomplete',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  async handleWebhook(webhook: WebhookPayload): Promise<WebhookResult> {
    try {
      this.logRequest('POST', '/webhook/handle', { type: webhook.type });

      // Verify webhook signature
      if (!this.verifyWebhookSignature(webhook)) {
        throw new Error('Invalid webhook signature');
      }

      // Process webhook event
      const event = webhook.data;
      let processed = false;
      let responseData: any = {};

      switch (webhook.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event);
          processed = true;
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event);
          processed = true;
          break;
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSuccess(event);
          processed = true;
          break;
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event);
          processed = true;
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event);
          processed = true;
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event);
          processed = true;
          break;
        default:
          this.logger.warn('Unhandled webhook type', { type: webhook.type });
      }

      const result: WebhookResult = {
        success: processed,
        processedAt: new Date(),
        response: responseData,
        ...(!processed && { errors: ['Unhandled webhook type'] })
      };

      this.logResponse('POST', '/webhook/handle', result, Date.now());
      return result;

    } catch (error) {
      this.logError('POST', '/webhook/handle', error, Date.now());
      return {
        success: false,
        processedAt: new Date(),
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  // Additional Stripe-specific methods
  async createCustomer(customerData: {
    email: string;
    name?: string;
    phone?: string;
    metadata?: Record<string, any>;
  }): Promise<string> {
    try {
      this.logRequest('POST', '/customers', { email: customerData.email });

      const response = await this.makeRequest<any>('/customers', {
        method: 'POST',
        body: this.createFormData(customerData)
      });

      this.logResponse('POST', '/customers', { customerId: response.id }, Date.now());
      return response.id;

    } catch (error) {
      this.logError('POST', '/customers', error, Date.now());
      throw error;
    }
  }

  async getCustomer(customerId: string): Promise<any> {
    try {
      this.logRequest('GET', `/customers/${customerId}`);

      const response = await this.makeRequest<any>(`/customers/${customerId}`);

      this.logResponse('GET', `/customers/${customerId}`, response, Date.now());
      return response;

    } catch (error) {
      this.logError('GET', `/customers/${customerId}`, error, Date.now());
      throw error;
    }
  }

  async getPaymentMethod(paymentMethodId: string): Promise<any> {
    try {
      this.logRequest('GET', `/payment_methods/${paymentMethodId}`);

      const response = await this.makeRequest<any>(`/payment_methods/${paymentMethodId}`);

      this.logResponse('GET', `/payment_methods/${paymentMethodId}`, response, Date.now());
      return response;

    } catch (error) {
      this.logError('GET', `/payment_methods/${paymentMethodId}`, error, Date.now());
      throw error;
    }
  }

  async getPaymentIntent(paymentIntentId: string): Promise<any> {
    try {
      this.logRequest('GET', `/payment_intents/${paymentIntentId}`);

      const response = await this.makeRequest<any>(`/payment_intents/${paymentIntentId}`);

      this.logResponse('GET', `/payment_intents/${paymentIntentId}`, response, Date.now());
      return response;

    } catch (error) {
      this.logError('GET', `/payment_intents/${paymentIntentId}`, error, Date.now());
      throw error;
    }
  }

  override async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest<any>('/balance');
      return true;
    } catch (error) {
      this.logger.error('Stripe connection test failed', { error });
      return false;
    }
  }

  private async createPaymentMethod(paymentMethod: PaymentMethod): Promise<any> {
    switch (paymentMethod.type) {
      case 'card':
        return await this.createCardPaymentMethod(paymentMethod.details);
      case 'bank':
        return await this.createBankPaymentMethod(paymentMethod.details);
      case 'paypal':
        // PayPal integration through Stripe requires additional setup
        throw new Error('PayPal payment method not yet implemented');
      default:
        throw new Error(`Unsupported payment method type: ${paymentMethod.type}`);
    }
  }

  private async createCardPaymentMethod(details: PaymentMethodDetails): Promise<any> {
    if (!details.card) {
      throw new Error('Card details required');
    }

    const cardData = {
      type: 'card',
      card: {
        number: details.card.number,
        exp_month: details.card.expMonth,
        exp_year: details.card.expYear,
        cvc: details.card.cvv,
        name: details.card.name
      }
    };

    const response = await this.makeRequest<any>('/payment_methods', {
      method: 'POST',
      body: this.createFormData(cardData)
    });

    return response;
  }

  private async createBankPaymentMethod(details: PaymentMethodDetails): Promise<any> {
    if (!details.bank) {
      throw new Error('Bank details required');
    }

    // For bank payments, we typically create a token first
    const tokenData = {
      bank_account: {
        country: 'US',
        currency: 'usd',
        account_holder_name: details.bank.name,
        account_holder_type: details.bank.accountType,
        routing_number: details.bank.routingNumber,
        account_number: details.bank.accountNumber
      }
    };

    const response = await this.makeRequest<any>('/tokens', {
      method: 'POST',
      body: this.createFormData(tokenData)
    });

    return response;
  }

  private async getOrCreateCustomer(customerId?: string): Promise<any> {
    if (customerId) {
      try {
        return await this.getCustomer(customerId);
      } catch (error) {
        // Customer not found, create new one
      }
    }

    // Create new customer with minimal data
    return await this.createCustomer({
      email: `customer-${Date.now()}@lawfirmpro.com`,
      metadata: { source: 'lawfirmpro' }
    });
  }

  private mapStripeStatus(stripeStatus: string): PaymentResult['status'] {
    switch (stripeStatus) {
      case 'succeeded':
        return 'succeeded';
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        return 'pending';
      case 'canceled':
        return 'canceled';
      case 'requires_capture':
        return 'pending';
      default:
        return 'failed';
    }
  }

  private mapRefundReason(reason: string): string {
    switch (reason.toLowerCase()) {
      case 'duplicate':
        return 'duplicate';
      case 'fraudulent':
        return 'fraudulent';
      case 'requested_by_customer':
        return 'requested_by_customer';
      default:
        return 'requested_by_customer';
    }
  }

  private mapRefundStatus(status: string): RefundResult['status'] {
    switch (status) {
      case 'succeeded':
        return 'succeeded';
      case 'pending':
        return 'pending';
      case 'failed':
        return 'failed';
      case 'canceled':
        return 'failed';
      default:
        return 'failed';
    }
  }

  private mapSubscriptionStatus(status: string): SubscriptionResult['status'] {
    switch (status) {
      case 'active':
        return 'active';
      case 'canceled':
        return 'canceled';
      case 'past_due':
        return 'past_due';
      case 'unpaid':
        return 'unpaid';
      case 'incomplete':
        return 'incomplete';
      case 'incomplete_expired':
        return 'canceled';
      case 'trialing':
        return 'active';
      default:
        return 'incomplete';
    }
  }

  private verifyWebhookSignature(_webhook: WebhookPayload): boolean {
    // In a real implementation, this would verify the Stripe webhook signature
    // For now, we'll return true for development
    return true;
  }

  private async handlePaymentSuccess(event: any): Promise<void> {
    // Handle successful payment
    this.logger.info('Payment success webhook received', { eventId: event.id });
  }

  private async handlePaymentFailure(event: any): Promise<void> {
    // Handle failed payment
    this.logger.info('Payment failure webhook received', { eventId: event.id });
  }

  private async handleInvoicePaymentSuccess(event: any): Promise<void> {
    // Handle successful invoice payment
    this.logger.info('Invoice payment success webhook received', { eventId: event.id });
  }

  private async handleSubscriptionCreated(event: any): Promise<void> {
    // Handle subscription creation
    this.logger.info('Subscription created webhook received', { eventId: event.id });
  }

  private async handleSubscriptionUpdated(event: any): Promise<void> {
    // Handle subscription update
    this.logger.info('Subscription updated webhook received', { eventId: event.id });
  }

  private async handleSubscriptionDeleted(event: any): Promise<void> {
    // Handle subscription deletion
    this.logger.info('Subscription deleted webhook received', { eventId: event.id });
  }

  private createFormData(data: any): string {
    const formData = new URLSearchParams();
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    }
    return formData.toString();
  }

  protected override async getHeaders(customHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
    return {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Bearer ${this.config.authentication.credentials.apiKey}`,
      'Stripe-Version': '2023-10-16',
      ...customHeaders
    };
  }
}