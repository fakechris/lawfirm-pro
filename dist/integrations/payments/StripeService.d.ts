import { BaseExternalService } from '../../services/external/BaseExternalService';
import { PaymentProcessor } from '../../services/external';
import { PaymentRequest, PaymentResult, RefundRequest, RefundResult, Subscription, SubscriptionResult, WebhookPayload, WebhookResult } from '../../services/external/types';
export declare class StripeService extends BaseExternalService implements PaymentProcessor {
    constructor();
    processPayment(payment: PaymentRequest): Promise<PaymentResult>;
    refundPayment(refund: RefundRequest): Promise<RefundResult>;
    createSubscription(subscription: Subscription): Promise<SubscriptionResult>;
    handleWebhook(webhook: WebhookPayload): Promise<WebhookResult>;
    createCustomer(customerData: {
        email: string;
        name?: string;
        phone?: string;
        metadata?: Record<string, any>;
    }): Promise<string>;
    getCustomer(customerId: string): Promise<any>;
    getPaymentMethod(paymentMethodId: string): Promise<any>;
    getPaymentIntent(paymentIntentId: string): Promise<any>;
    testConnection(): Promise<boolean>;
    private createPaymentMethod;
    private createCardPaymentMethod;
    private createBankPaymentMethod;
    private getOrCreateCustomer;
    private mapStripeStatus;
    private mapRefundReason;
    private mapRefundStatus;
    private mapSubscriptionStatus;
    private verifyWebhookSignature;
    private handlePaymentSuccess;
    private handlePaymentFailure;
    private handleInvoicePaymentSuccess;
    private handleSubscriptionCreated;
    private handleSubscriptionUpdated;
    private handleSubscriptionDeleted;
    private createFormData;
    protected getHeaders(customHeaders?: Record<string, string>): Promise<Record<string, string>>;
}
//# sourceMappingURL=StripeService.d.ts.map