import { PrismaClient } from '@prisma/client';
import { Invoice, InvoiceItem, BillingNode, FeeType, TrustTransactionType } from '../models/financial';
export declare class ChineseBillingEngine {
    private prisma;
    private chinaConfig;
    private billingConfig;
    constructor(prisma: PrismaClient);
    calculateLegalFee(caseType: string, feeType: FeeType, params: {
        hours?: number;
        rate?: number;
        settlementAmount?: number;
        baseAmount?: number;
        percentage?: number;
        complexity?: 'simple' | 'medium' | 'complex';
        jurisdiction?: 'local' | 'provincial' | 'national';
    }): Promise<{
        fee: number;
        breakdown: any;
        compliance: any;
    }>;
    generateCompliantInvoice(data: {
        clientId: string;
        caseId?: string;
        items: Omit<InvoiceItem, 'id' | 'invoiceId' | 'createdAt' | 'updatedAt'>[];
        issueDate?: Date;
        dueDate?: Date;
        notes?: string;
    }): Promise<Invoice>;
    private generateFapiao;
    private generateInvoiceNumber;
    private calculateDueDate;
    generateStageBilling(caseId: string): Promise<{
        currentPhase: string;
        billingNodes: BillingNode[];
        suggestedInvoice: any;
        compliance: any;
    }>;
    private checkStageBillingCompliance;
    private calculateCaseValue;
    manageTrustAccount(data: {
        clientId: string;
        caseId?: string;
        amount: number;
        type: TrustTransactionType;
        description: string;
    }): Promise<{
        success: boolean;
        transaction: any;
        compliance: any;
    }>;
}
//# sourceMappingURL=ChineseBillingEngine.d.ts.map