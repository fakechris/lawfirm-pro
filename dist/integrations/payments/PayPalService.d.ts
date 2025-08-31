import { BaseExternalService } from '../../services/external/BaseExternalService';
import { PaymentProcessor } from '../../services/external';
import { PaymentRequest, PaymentResult, RefundRequest, RefundResult, Subscription, SubscriptionResult, WebhookPayload, WebhookResult } from '../../services/external/types';
export declare class PayPalService extends BaseExternalService implements PaymentProcessor {
    private accessToken;
    private tokenExpiry;
    constructor();
    processPayment(payment: PaymentRequest): Promise<PaymentResult>;
    refundPayment(refund: RefundRequest): Promise<RefundResult>;
    createSubscription(subscription: Subscription): Promise<SubscriptionResult>;
    handleWebhook(webhook: WebhookPayload): Promise<WebhookResult>;
    createOrder(orderData: {
        amount: number;
        currency: string;
        description: string;
        returnUrl: string;
        cancelUrl: string;
    }): Promise<any>;
    capturePayment(orderId: string): Promise<any>;
    getAccessToken(): Promise<string>;
    testConnection(): Promise<boolean>;
    private ensureAccessToken;
    private createPaymentSource;
    private mapPayPalStatus;
    private mapRefundStatus;
    private mapSubscriptionStatus;
    private verifyWebhookSignature;
    private handlePaymentAuthorizationCreated;
    private handlePaymentAuthorizationVoided;
    private handlePaymentCaptureCompleted;
    private handlePaymentCaptureDenied;
    private handleSubscriptionActivated;
    private handleSubscriptionCancelled;
    private handleSubscriptionExpired;
    protected getHeaders(customHeaders?: Record<string, string>): Promise<Record<string, string>>;
}
//# sourceMappingURL=PayPalService.d.ts.map