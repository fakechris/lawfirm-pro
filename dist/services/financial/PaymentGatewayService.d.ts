import { PrismaClient } from '@prisma/client';
import { PaymentMethod, PaymentStatus } from '../models/financial';
export interface PaymentGatewayRequest {
    amount: number;
    currency: string;
    description: string;
    orderId: string;
    clientInfo: {
        name: string;
        email: string;
        phone?: string;
    };
    returnUrl?: string;
    notifyUrl?: string;
}
export interface PaymentGatewayResponse {
    success: boolean;
    transactionId?: string;
    paymentUrl?: string;
    qrCode?: string;
    message?: string;
    error?: string;
}
export interface PaymentWebhookPayload {
    transactionId: string;
    orderId: string;
    amount: number;
    status: PaymentStatus;
    gateway: string;
    timestamp: Date;
    signature?: string;
}
export declare class PaymentGatewayService {
    private prisma;
    private config;
    constructor(prisma: PrismaClient);
    initializePayment(gateway: PaymentMethod, request: PaymentGatewayRequest): Promise<PaymentGatewayResponse>;
    processWebhook(gateway: PaymentMethod, payload: any): Promise<boolean>;
    checkPaymentStatus(gateway: PaymentMethod, transactionId: string): Promise<PaymentStatus>;
    refundPayment(gateway: PaymentMethod, transactionId: string, amount?: number, reason?: string): Promise<PaymentGatewayResponse>;
    private validatePaymentRequest;
    private isGatewayConfigured;
    private validateAmount;
    private verifyWebhookSignature;
    private parseWebhookPayload;
    private updateInvoicePaymentStatus;
    private initializeAlipayPayment;
    private checkAlipayStatus;
    private refundAlipayPayment;
    private parseAlipayWebhook;
    private initializeWechatPayment;
    private checkWechatStatus;
    private refundWechatPayment;
    private parseWechatWebhook;
    private initializeBankTransfer;
}
//# sourceMappingURL=PaymentGatewayService.d.ts.map