import { PaymentGatewayRequest, PaymentGatewayResponse } from './PaymentGatewayService';
export declare class AlipayService {
    private config;
    private processingConfig;
    initializePayment(request: PaymentGatewayRequest): Promise<PaymentGatewayResponse>;
    checkPaymentStatus(transactionId: string): Promise<string>;
    refundPayment(transactionId: string, amount?: number, reason?: string): Promise<PaymentGatewayResponse>;
    verifyWebhookSignature(params: any): boolean;
    parseWebhookPayload(params: any): {
        transactionId: any;
        orderId: any;
        amount: number;
        status: string;
        gateway: string;
        timestamp: Date;
        rawData: any;
    };
    private buildAlipayParams;
    private generateSign;
    private verifySign;
    private callAlipayAPI;
    private buildQueryString;
    private sortObject;
    private getTimestamp;
    private mapAlipayStatus;
    generateQRCode(request: PaymentGatewayRequest): Promise<PaymentGatewayResponse>;
    closePayment(transactionId: string): Promise<PaymentGatewayResponse>;
}
//# sourceMappingURL=AlipayService.d.ts.map