"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayPalService = void 0;
const BaseExternalService_1 = require("../../services/external/BaseExternalService");
class PayPalService extends BaseExternalService_1.BaseExternalService {
    constructor() {
        super('paypal');
        this.accessToken = '';
        this.tokenExpiry = new Date();
    }
    async processPayment(payment) {
        try {
            this.logRequest('POST', '/v2/checkout/orders', { amount: payment.amount, currency: payment.currency });
            await this.ensureAccessToken();
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
            const response = await this.makeRequest('/v2/checkout/orders', {
                method: 'POST',
                body: JSON.stringify(orderData)
            });
            const captureResponse = await this.capturePayment(response.id);
            const result = {
                success: captureResponse.status === 'COMPLETED',
                paymentId: captureResponse.id,
                amount: parseFloat(captureResponse.amount.value),
                currency: captureResponse.amount.currency_code,
                status: this.mapPayPalStatus(captureResponse.status),
                processedAt: new Date(),
                transactionId: captureResponse.id,
                receiptUrl: captureResponse.links?.find((link) => link.rel === 'self')?.href,
                ...(payment.metadata && { metadata: payment.metadata })
            };
            this.logResponse('POST', '/v2/checkout/orders', result, Date.now());
            return result;
        }
        catch (error) {
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
    async refundPayment(refund) {
        try {
            this.logRequest('POST', `/v2/payments/captures/${refund.paymentId}/refund`, { amount: refund.amount });
            await this.ensureAccessToken();
            const refundData = {
                amount: refund.amount ? {
                    currency_code: 'USD',
                    value: refund.amount.toFixed(2)
                } : undefined,
                note_to_payer: refund.reason,
                invoice_id: refund.metadata?.invoiceId
            };
            const response = await this.makeRequest(`/v2/payments/captures/${refund.paymentId}/refund`, {
                method: 'POST',
                body: JSON.stringify(refundData)
            });
            const result = {
                success: response.status === 'COMPLETED',
                refundId: response.id,
                amount: parseFloat(response.amount.value),
                status: this.mapRefundStatus(response.status),
                processedAt: new Date(),
                transactionId: response.id
            };
            this.logResponse('POST', `/v2/payments/captures/${refund.paymentId}/refund`, result, Date.now());
            return result;
        }
        catch (error) {
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
    async createSubscription(subscription) {
        try {
            this.logRequest('POST', '/v1/billing/subscriptions', { planId: subscription.planId });
            await this.ensureAccessToken();
            const subscriptionData = {
                plan_id: subscription.planId,
                subscriber: {
                    email_address: subscription.customerId
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
            const response = await this.makeRequest('/v1/billing/subscriptions', {
                method: 'POST',
                body: JSON.stringify(subscriptionData)
            });
            const result = {
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
        }
        catch (error) {
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
    async handleWebhook(webhook) {
        try {
            this.logRequest('POST', '/webhook/handle', { type: webhook.type });
            if (!this.verifyWebhookSignature(webhook)) {
                throw new Error('Invalid webhook signature');
            }
            const event = webhook.data;
            let processed = false;
            let responseData = {};
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
            const result = {
                success: processed,
                processedAt: new Date(),
                response: responseData,
                ...(!processed && { errors: ['Unhandled webhook type'] })
            };
            this.logResponse('POST', '/webhook/handle', result, Date.now());
            return result;
        }
        catch (error) {
            this.logError('POST', '/webhook/handle', error, Date.now());
            return {
                success: false,
                processedAt: new Date(),
                errors: [error instanceof Error ? error.message : 'Unknown error']
            };
        }
    }
    async createOrder(orderData) {
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
            const response = await this.makeRequest('/v2/checkout/orders', {
                method: 'POST',
                body: JSON.stringify(paypalOrderData)
            });
            this.logResponse('POST', '/v2/checkout/orders', response, Date.now());
            return response;
        }
        catch (error) {
            this.logError('POST', '/v2/checkout/orders', error, Date.now());
            throw error;
        }
    }
    async capturePayment(orderId) {
        try {
            this.logRequest('POST', `/v2/checkout/orders/${orderId}/capture`);
            await this.ensureAccessToken();
            const response = await this.makeRequest(`/v2/checkout/orders/${orderId}/capture`, {
                method: 'POST',
                body: JSON.stringify({})
            });
            this.logResponse('POST', `/v2/checkout/orders/${orderId}/capture`, response, Date.now());
            return response;
        }
        catch (error) {
            this.logError('POST', `/v2/checkout/orders/${orderId}/capture`, error, Date.now());
            throw error;
        }
    }
    async getAccessToken() {
        try {
            this.logRequest('POST', '/v1/oauth2/token');
            const auth = Buffer.from(`${this.config.authentication.credentials.clientId}:${this.config.authentication.credentials.clientSecret}`).toString('base64');
            const response = await this.makeRequest('/v1/oauth2/token', {
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
        }
        catch (error) {
            this.logError('POST', '/v1/oauth2/token', error, Date.now());
            throw error;
        }
    }
    async testConnection() {
        try {
            await this.ensureAccessToken();
            await this.makeRequest('/v1/notifications/webhooks');
            return true;
        }
        catch (error) {
            this.logger.error('PayPal connection test failed', { error });
            return false;
        }
    }
    async ensureAccessToken() {
        if (!this.accessToken || new Date() >= this.tokenExpiry) {
            await this.getAccessToken();
        }
    }
    async createPaymentSource(paymentMethod) {
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
    mapPayPalStatus(status) {
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
    mapRefundStatus(status) {
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
    mapSubscriptionStatus(status) {
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
    verifyWebhookSignature(_webhook) {
        return true;
    }
    async handlePaymentAuthorizationCreated(event) {
        this.logger.info('Payment authorization created webhook received', { eventId: event.id });
    }
    async handlePaymentAuthorizationVoided(event) {
        this.logger.info('Payment authorization voided webhook received', { eventId: event.id });
    }
    async handlePaymentCaptureCompleted(event) {
        this.logger.info('Payment capture completed webhook received', { eventId: event.id });
    }
    async handlePaymentCaptureDenied(event) {
        this.logger.info('Payment capture denied webhook received', { eventId: event.id });
    }
    async handleSubscriptionActivated(event) {
        this.logger.info('Subscription activated webhook received', { eventId: event.id });
    }
    async handleSubscriptionCancelled(event) {
        this.logger.info('Subscription cancelled webhook received', { eventId: event.id });
    }
    async handleSubscriptionExpired(event) {
        this.logger.info('Subscription expired webhook received', { eventId: event.id });
    }
    async getHeaders(customHeaders = {}) {
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
exports.PayPalService = PayPalService;
//# sourceMappingURL=PayPalService.js.map