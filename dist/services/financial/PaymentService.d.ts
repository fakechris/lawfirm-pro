import { PrismaClient } from '@prisma/client';
import { Payment, PaymentMethod } from '../models/financial';
export interface PaymentRequest {
    invoiceId: string;
    amount: number;
    method: PaymentMethod;
    currency?: string;
    description?: string;
    clientInfo: {
        name: string;
        email: string;
        phone?: string;
    };
    returnUrl?: string;
    notifyUrl?: string;
}
export interface PaymentResponse {
    success: boolean;
    payment?: Payment;
    paymentUrl?: string;
    qrCode?: string;
    transactionId?: string;
    error?: string;
    message?: string;
}
export interface PaymentStatusRequest {
    paymentId: string;
    transactionId?: string;
}
export interface PaymentScheduleRequest {
    invoiceId: string;
    amount: number;
    method: PaymentMethod;
    scheduleDate: Date;
    clientInfo: {
        name: string;
        email: string;
        phone?: string;
    };
    description?: string;
}
export declare class PaymentService {
    private prisma;
    private gatewayService;
    private alipayService;
    private wechatPayService;
    private config;
    constructor(prisma: PrismaClient);
    createPayment(request: PaymentRequest): Promise<PaymentResponse>;
    getPaymentById(paymentId: string): Promise<Payment | null>;
    getPaymentByReference(reference: string): Promise<Payment | null>;
    checkPaymentStatus(request: PaymentStatusRequest): Promise<PaymentResponse>;
    getPaymentsByInvoice(invoiceId: string): Promise<Payment[]>;
    getPaymentsByClient(clientId: string): Promise<Payment[]>;
    processWebhook(gateway: PaymentMethod, payload: any): Promise<boolean>;
    schedulePayment(request: PaymentScheduleRequest): Promise<PaymentResponse>;
    processScheduledPayments(): Promise<void>;
    cancelPayment(paymentId: string): Promise<PaymentResponse>;
    private calculatePaidAmount;
    private updateInvoicePaymentStatus;
    private generatePaymentReference;
    getPaymentStatistics(clientId?: string): Promise<any>;
    getPaymentMethodStatistics(): Promise<any>;
}
//# sourceMappingURL=PaymentService.d.ts.map