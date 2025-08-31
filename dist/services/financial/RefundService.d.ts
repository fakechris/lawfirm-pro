import { PrismaClient } from '@prisma/client';
export interface RefundRequest {
    paymentId: string;
    amount?: number;
    reason: string;
    processedBy: string;
    notes?: string;
}
export interface RefundResponse {
    success: boolean;
    refund?: any;
    error?: string;
    message?: string;
}
export interface CreditRequest {
    clientId: string;
    amount: number;
    currency?: string;
    reason: string;
    expiresAt?: Date;
    processedBy: string;
    notes?: string;
}
export interface CreditResponse {
    success: boolean;
    credit?: any;
    error?: string;
    message?: string;
}
export interface CreditUsageRequest {
    creditId: string;
    invoiceId: string;
    amount: number;
    processedBy: string;
}
export interface CreditUsageResponse {
    success: boolean;
    usage?: any;
    error?: string;
    message?: string;
}
export declare class RefundService {
    private prisma;
    private gatewayService;
    private alipayService;
    private wechatPayService;
    private config;
    constructor(prisma: PrismaClient);
    processRefund(request: RefundRequest): Promise<RefundResponse>;
    createCredit(request: CreditRequest): Promise<CreditResponse>;
    useCredit(request: CreditUsageRequest): Promise<CreditUsageResponse>;
    getRefundById(refundId: string): Promise<any>;
    getRefundsByPayment(paymentId: string): Promise<any[]>;
    getRefundsByClient(clientId: string): Promise<any[]>;
    getCreditById(creditId: string): Promise<any>;
    getCreditsByClient(clientId: string): Promise<any[]>;
    getActiveCreditsByClient(clientId: string): Promise<any[]>;
    getCreditUsageById(usageId: string): Promise<any>;
    getCreditUsageByCredit(creditId: string): Promise<any[]>;
    processAutomaticRefunds(): Promise<void>;
    expireOldCredits(): Promise<void>;
    getRefundStatistics(clientId?: string): Promise<any>;
    getCreditStatistics(clientId?: string): Promise<any>;
    private calculateInvoicePaidAmount;
    private updateInvoicePaymentStatus;
    private generateRefundReference;
    private generateCreditReference;
    private generatePaymentReference;
}
//# sourceMappingURL=RefundService.d.ts.map