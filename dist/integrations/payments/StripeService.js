"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeService = void 0;
const BaseExternalService_1 = require("../../services/external/BaseExternalService");
class StripeService extends BaseExternalService_1.BaseExternalService {
    constructor() {
        super('stripe');
    }
    async processPayment(payment) {
        try {
            this.logRequest('POST', '/payment_intents', { amount: payment.amount, currency: payment.currency });
            const stripePaymentMethod = await this.createPaymentMethod(payment.paymentMethod);
            const paymentIntentData = {
                amount: Math.round(payment.amount * 100),
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
            const response = await this.makeRequest('/payment_intents', {
                method: 'POST',
                body: this.createFormData(paymentIntentData)
            });
            const result = {
                success: response.status === 'succeeded',
                paymentId: response.id,
                amount: response.amount / 100,
                currency: response.currency.toUpperCase(),
                status: this.mapStripeStatus(response.status),
                processedAt: new Date(),
                transactionId: response.latest_charge,
                receiptUrl: response.charges?.data[0]?.receipt_url,
                metadata: response.metadata
            };
            this.logResponse('POST', '/payment_intents', result, Date.now());
            return result;
        }
        catch (error) {
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
    async refundPayment(refund) {
        try {
            this.logRequest('POST', '/refunds', { paymentId: refund.paymentId, amount: refund.amount });
            const refundData = {
                payment_intent: refund.paymentId,
                amount: refund.amount ? Math.round(refund.amount * 100) : undefined,
                reason: this.mapRefundReason(refund.reason),
                metadata: refund.metadata
            };
            const response = await this.makeRequest('/refunds', {
                method: 'POST',
                body: this.createFormData(refundData)
            });
            const result = {
                success: response.status === 'succeeded',
                refundId: response.id,
                amount: response.amount / 100,
                status: this.mapRefundStatus(response.status),
                processedAt: new Date(),
                transactionId: response.balance_transaction
            };
            this.logResponse('POST', '/refunds', result, Date.now());
            return result;
        }
        catch (error) {
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
    async createSubscription(subscription) {
        try {
            this.logRequest('POST', '/subscriptions', { customerId: subscription.customerId, planId: subscription.planId });
            const customer = await this.getOrCreateCustomer(subscription.customerId);
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
            const response = await this.makeRequest('/subscriptions', {
                method: 'POST',
                body: this.createFormData(subscriptionData)
            });
            const result = {
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
        }
        catch (error) {
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
    async createCustomer(customerData) {
        try {
            this.logRequest('POST', '/customers', { email: customerData.email });
            const response = await this.makeRequest('/customers', {
                method: 'POST',
                body: this.createFormData(customerData)
            });
            this.logResponse('POST', '/customers', { customerId: response.id }, Date.now());
            return response.id;
        }
        catch (error) {
            this.logError('POST', '/customers', error, Date.now());
            throw error;
        }
    }
    async getCustomer(customerId) {
        try {
            this.logRequest('GET', `/customers/${customerId}`);
            const response = await this.makeRequest(`/customers/${customerId}`);
            this.logResponse('GET', `/customers/${customerId}`, response, Date.now());
            return response;
        }
        catch (error) {
            this.logError('GET', `/customers/${customerId}`, error, Date.now());
            throw error;
        }
    }
    async getPaymentMethod(paymentMethodId) {
        try {
            this.logRequest('GET', `/payment_methods/${paymentMethodId}`);
            const response = await this.makeRequest(`/payment_methods/${paymentMethodId}`);
            this.logResponse('GET', `/payment_methods/${paymentMethodId}`, response, Date.now());
            return response;
        }
        catch (error) {
            this.logError('GET', `/payment_methods/${paymentMethodId}`, error, Date.now());
            throw error;
        }
    }
    async getPaymentIntent(paymentIntentId) {
        try {
            this.logRequest('GET', `/payment_intents/${paymentIntentId}`);
            const response = await this.makeRequest(`/payment_intents/${paymentIntentId}`);
            this.logResponse('GET', `/payment_intents/${paymentIntentId}`, response, Date.now());
            return response;
        }
        catch (error) {
            this.logError('GET', `/payment_intents/${paymentIntentId}`, error, Date.now());
            throw error;
        }
    }
    async testConnection() {
        try {
            await this.makeRequest('/balance');
            return true;
        }
        catch (error) {
            this.logger.error('Stripe connection test failed', { error });
            return false;
        }
    }
    async createPaymentMethod(paymentMethod) {
        switch (paymentMethod.type) {
            case 'card':
                return await this.createCardPaymentMethod(paymentMethod.details);
            case 'bank':
                return await this.createBankPaymentMethod(paymentMethod.details);
            case 'paypal':
                throw new Error('PayPal payment method not yet implemented');
            default:
                throw new Error(`Unsupported payment method type: ${paymentMethod.type}`);
        }
    }
    async createCardPaymentMethod(details) {
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
        const response = await this.makeRequest('/payment_methods', {
            method: 'POST',
            body: this.createFormData(cardData)
        });
        return response;
    }
    async createBankPaymentMethod(details) {
        if (!details.bank) {
            throw new Error('Bank details required');
        }
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
        const response = await this.makeRequest('/tokens', {
            method: 'POST',
            body: this.createFormData(tokenData)
        });
        return response;
    }
    async getOrCreateCustomer(customerId) {
        if (customerId) {
            try {
                return await this.getCustomer(customerId);
            }
            catch (error) {
            }
        }
        return await this.createCustomer({
            email: `customer-${Date.now()}@lawfirmpro.com`,
            metadata: { source: 'lawfirmpro' }
        });
    }
    mapStripeStatus(stripeStatus) {
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
    mapRefundReason(reason) {
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
    mapRefundStatus(status) {
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
    mapSubscriptionStatus(status) {
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
    verifyWebhookSignature(_webhook) {
        return true;
    }
    async handlePaymentSuccess(event) {
        this.logger.info('Payment success webhook received', { eventId: event.id });
    }
    async handlePaymentFailure(event) {
        this.logger.info('Payment failure webhook received', { eventId: event.id });
    }
    async handleInvoicePaymentSuccess(event) {
        this.logger.info('Invoice payment success webhook received', { eventId: event.id });
    }
    async handleSubscriptionCreated(event) {
        this.logger.info('Subscription created webhook received', { eventId: event.id });
    }
    async handleSubscriptionUpdated(event) {
        this.logger.info('Subscription updated webhook received', { eventId: event.id });
    }
    async handleSubscriptionDeleted(event) {
        this.logger.info('Subscription deleted webhook received', { eventId: event.id });
    }
    createFormData(data) {
        const formData = new URLSearchParams();
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined && value !== null) {
                formData.append(key, String(value));
            }
        }
        return formData.toString();
    }
    async getHeaders(customHeaders = {}) {
        return {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${this.config.authentication.credentials.apiKey}`,
            'Stripe-Version': '2023-10-16',
            ...customHeaders
        };
    }
}
exports.StripeService = StripeService;
//# sourceMappingURL=StripeService.js.map