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
  PaymentMethod
} from '../../services/external/types';

export class PayPalService extends BaseExternalService implements PaymentProcessor {
  private accessToken: string = '';
  private tokenExpiry: Date = new Date();

  constructor() {
    super('paypal');
  }

  
  async processPayment(payment: PaymentRequest): Promise<PaymentResult> {
    try {
      this.logRequest('POST', '/v2/checkout/orders', { amount: payment.amount, currency: payment.currency });

      // Ensure we have a valid access token
      await this.ensureAccessToken();

      // Create PayPal order
      const orderData = {
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: payment.currency.toUpperCase(),
            value: payment.amount.toFixed(2)
          },
          description: payment.description,
          custom_id: payment.invoiceId || payment.caseId,
          invoice_id: payment.invoiceId
        }],
        payment_source: await this.createPaymentSource(payment.paymentMethod)
      };

      const response = await this.makeRequest<any>('/v2/checkout/orders', {
        method: 'POST',
        body: JSON.stringify(orderData)
      });

      // Capture the payment (for simplified flow)
      const captureResponse = await this.capturePayment(response.id);

      const result: PaymentResult = {
        success: captureResponse.status === 'COMPLETED',
        paymentId: captureResponse.id,
        amount: parseFloat(captureResponse.amount.value),
        currency: captureResponse.amount.currency_code,
        status: this.mapPayPalStatus(captureResponse.status),
        processedAt: new Date(),
        transactionId: captureResponse.id,
        receiptUrl: captureResponse.links?.find((link: any) => link.rel === 'self')?.href,
        ...(payment.metadata && { metadata: payment.metadata })
      };

      this.logResponse('POST', '/v2/checkout/orders', result, Date.now());
      return result;

    } catch (error) {
      this.logError('POST', '/v2/checkout/orders', error, Date.now());
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
      this.logRequest('POST', `/v2/payments/captures/${refund.paymentId}/refund`, { amount: refund.amount });

      await this.ensureAccessToken();

      const refundData = {
        amount: refund.amount ? {
          currency_code: 'USD', // This should be dynamic based on original payment
          value: refund.amount.toFixed(2)
        } : undefined,
        note_to_payer: refund.reason,
        invoice_id: refund.metadata?.invoiceId
      };

      const response = await this.makeRequest<any>(`/v2/payments/captures/${refund.paymentId}/refund`, {
        method: 'POST',
        body: JSON.stringify(refundData)
      });

      const result: RefundResult = {
        success: response.status === 'COMPLETED',
        refundId: response.id,
        amount: parseFloat(response.amount.value),
        status: this.mapRefundStatus(response.status),
        processedAt: new Date(),
        transactionId: response.id
      };

      this.logResponse('POST', `/v2/payments/captures/${refund.paymentId}/refund`, result, Date.now());
      return result;

    } catch (error) {
      this.logError('POST', `/v2/payments/captures/${refund.paymentId}/refund`, error, Date.now());
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
      this.logRequest('POST', '/v1/billing/subscriptions', { planId: subscription.planId });

      await this.ensureAccessToken();

      const subscriptionData = {
        plan_id: subscription.planId,
        subscriber: {
          email_address: subscription.customerId // In real implementation, this would be the customer's email
        },
        application_context: {
          brand_name: 'Law Firm Pro',
          locale: 'en-US',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          payment_method: {
            payer_selected: 'PAYPAL',
            payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED'
          }
        },
        custom_id: subscription.metadata?.caseId,
        trial_period: subscription.trialPeriod ? {
          trial_duration: subscription.trialPeriod,
          trial_duration_unit: 'DAY'
        } : undefined
      };

      const response = await this.makeRequest<any>('/v1/billing/subscriptions', {
        method: 'POST',
        body: JSON.stringify(subscriptionData)
      });

      const result: SubscriptionResult = {
        success: response.status === 'ACTIVE' || response.status === 'APPROVAL_PENDING',
        subscriptionId: response.id,
        status: this.mapSubscriptionStatus(response.status),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        ...(subscription.trialPeriod && { trialEnd: new Date(Date.now() + subscription.trialPeriod * 24 * 60 * 60 * 1000) }),
        cancelAtPeriodEnd: false
      };

      this.logResponse('POST', '/v1/billing/subscriptions', result, Date.now());
      return result;

    } catch (error) {
      this.logError('POST', '/v1/billing/subscriptions', error, Date.now());
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
        case 'PAYMENT.AUTHORIZATION.CREATED':
          await this.handlePaymentAuthorizationCreated(event);
          processed = true;
          break;
        case 'PAYMENT.AUTHORIZATION.VOIDED':
          await this.handlePaymentAuthorizationVoided(event);
          processed = true;
          break;
        case 'PAYMENT.CAPTURE.COMPLETED':
          await this.handlePaymentCaptureCompleted(event);
          processed = true;
          break;
        case 'PAYMENT.CAPTURE.DENIED':
          await this.handlePaymentCaptureDenied(event);
          processed = true;
          break;
        case 'BILLING.SUBSCRIPTION.ACTIVATED':
          await this.handleSubscriptionActivated(event);
          processed = true;
          break;
        case 'BILLING.SUBSCRIPTION.CANCELLED':
          await this.handleSubscriptionCancelled(event);
          processed = true;
          break;
        case 'BILLING.SUBSCRIPTION.EXPIRED':
          await this.handleSubscriptionExpired(event);
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

  // Additional PayPal-specific methods
  async createOrder(orderData: {
    amount: number;
    currency: string;
    description: string;
    returnUrl: string;
    cancelUrl: string;
  }): Promise<any> {
    try {
      this.logRequest('POST', '/v2/checkout/orders', { amount: orderData.amount });

      await this.ensureAccessToken();

      const paypalOrderData = {
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: orderData.currency.toUpperCase(),
            value: orderData.amount.toFixed(2)
          },
          description: orderData.description
        }],
        application_context: {
          return_url: orderData.returnUrl,
          cancel_url: orderData.cancelUrl,
          brand_name: 'Law Firm Pro',
          locale: 'en-US'
        }
      };

      const response = await this.makeRequest<any>('/v2/checkout/orders', {
        method: 'POST',
        body: JSON.stringify(paypalOrderData)
      });

      this.logResponse('POST', '/v2/checkout/orders', response, Date.now());
      return response;

    } catch (error) {
      this.logError('POST', '/v2/checkout/orders', error, Date.now());
      throw error;
    }
  }

  async capturePayment(orderId: string): Promise<any> {
    try {
      this.logRequest('POST', `/v2/checkout/orders/${orderId}/capture`);

      await this.ensureAccessToken();

      const response = await this.makeRequest<any>(`/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        body: JSON.stringify({})
      });

      this.logResponse('POST', `/v2/checkout/orders/${orderId}/capture`, response, Date.now());
      return response;

    } catch (error) {
      this.logError('POST', `/v2/checkout/orders/${orderId}/capture`, error, Date.now());
      throw error;
    }
  }

  async getAccessToken(): Promise<string> {
    try {
      this.logRequest('POST', '/v1/oauth2/token');

      const auth = Buffer.from(
        `${this.config.authentication.credentials.clientId}:${this.config.authentication.credentials.clientSecret}`
      ).toString('base64');

      const response = await this.makeRequest<any>('/v1/oauth2/token', {
        method: 'POST',
        body: 'grant_type=client_credentials',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.accessToken = response.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.expires_in * 1000));

      this.logResponse('POST', '/v1/oauth2/token', { tokenReceived: true }, Date.now());
      return this.accessToken;

    } catch (error) {
      this.logError('POST', '/v1/oauth2/token', error, Date.now());
      throw error;
    }
  }

  override async testConnection(): Promise<boolean> {
    try {
      await this.ensureAccessToken();
      await this.makeRequest<any>('/v1/notifications/webhooks');
      return true;
    } catch (error) {
      this.logger.error('PayPal connection test failed', { error });
      return false;
    }
  }

  private async ensureAccessToken(): Promise<void> {
    if (!this.accessToken || new Date() >= this.tokenExpiry) {
      await this.getAccessToken();
    }
  }

  private async createPaymentSource(paymentMethod: PaymentMethod): Promise<any> {
    switch (paymentMethod.type) {
      case 'paypal':
        return {
          paypal: {
            experience_context: {
              brand_name: 'Law Firm Pro',
              locale: 'en-US',
              landing_page: 'BILLING',
              shipping_preference: 'NO_SHIPPING',
              user_action: 'PAY_NOW'
            }
          }
        };
      case 'card':
        return {
          card: {
            experience_context: {
              brand_name: 'Law Firm Pro',
              locale: 'en-US',
              landing_page: 'BILLING',
              shipping_preference: 'NO_SHIPPING',
              user_action: 'PAY_NOW'
            }
          }
        };
      default:
        throw new Error(`Unsupported payment method type: ${paymentMethod.type}`);
    }
  }

  private mapPayPalStatus(status: string): PaymentResult['status'] {
    switch (status) {
      case 'COMPLETED':
        return 'succeeded';
      case 'CREATED':
      case 'SAVED':
      case 'APPROVED':
      case 'PENDING':
        return 'pending';
      case 'VOIDED':
      case 'DENIED':
        return 'failed';
      default:
        return 'failed';
    }
  }

  private mapRefundStatus(status: string): RefundResult['status'] {
    switch (status) {
      case 'COMPLETED':
        return 'succeeded';
      case 'PENDING':
        return 'pending';
      case 'CANCELLED':
      case 'DENIED':
        return 'failed';
      default:
        return 'failed';
    }
  }

  private mapSubscriptionStatus(status: string): SubscriptionResult['status'] {
    switch (status) {
      case 'ACTIVE':
        return 'active';
      case 'CANCELLED':
        return 'canceled';
      case 'EXPIRED':
        return 'canceled';
      case 'SUSPENDED':
        return 'past_due';
      case 'APPROVAL_PENDING':
        return 'incomplete';
      default:
        return 'incomplete';
    }
  }

  private verifyWebhookSignature(_webhook: WebhookPayload): boolean {
    // In a real implementation, this would verify the PayPal webhook signature
    // For now, we'll return true for development
    return true;
  }

  private async handlePaymentAuthorizationCreated(event: any): Promise<void> {
    this.logger.info('Payment authorization created webhook received', { eventId: event.id });
  }

  private async handlePaymentAuthorizationVoided(event: any): Promise<void> {
    this.logger.info('Payment authorization voided webhook received', { eventId: event.id });
  }

  private async handlePaymentCaptureCompleted(event: any): Promise<void> {
    this.logger.info('Payment capture completed webhook received', { eventId: event.id });
  }

  private async handlePaymentCaptureDenied(event: any): Promise<void> {
    this.logger.info('Payment capture denied webhook received', { eventId: event.id });
  }

  private async handleSubscriptionActivated(event: any): Promise<void> {
    this.logger.info('Subscription activated webhook received', { eventId: event.id });
  }

  private async handleSubscriptionCancelled(event: any): Promise<void> {
    this.logger.info('Subscription cancelled webhook received', { eventId: event.id });
  }

  private async handleSubscriptionExpired(event: any): Promise<void> {
    this.logger.info('Subscription expired webhook received', { eventId: event.id });
  }

  protected override async getHeaders(customHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
    await this.ensureAccessToken();
    
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.accessToken}`,
      'PayPal-Request-Id': `lawfirmpro-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      'Prefer': 'return=representation',
      ...customHeaders
    };
  }
}