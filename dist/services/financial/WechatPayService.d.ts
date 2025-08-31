import { PaymentGatewayRequest, PaymentGatewayResponse } from './PaymentGatewayService';
export declare class WechatPayService {
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
    generateJSAPIPayment(request: PaymentGatewayRequest, openid: string): Promise<PaymentGatewayResponse>;
    generateAPPPayment(request: PaymentGatewayRequest): Promise<PaymentGatewayResponse>;
    private buildWechatParams;
    private generateSign;
    private callWechatAPI;
    private convertToYuan;
    private convertFromYuan;
    private generateNonceStr;
    private buildQueryString;
    private sortObject;
    private buildXML;
    private parseXML;
    private mapWechatStatus;
    private generateMockQRCode;
    closePayment(transactionId: string): Promise<PaymentGatewayResponse>;
}
//# sourceMappingURL=WechatPayService.d.ts.map