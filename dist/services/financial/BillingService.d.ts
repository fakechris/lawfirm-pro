import { PrismaClient } from '@prisma/client';
import { Invoice, BillingNode } from '../models/financial';
export interface BillingMilestone {
    id: string;
    name: string;
    description: string;
    phase: string;
    order: number;
    amount: number;
    dueDate?: Date;
    isCompleted: boolean;
    completionDate?: Date;
    requirements: string[];
    triggers: string[];
}
export interface BillingConfiguration {
    autoGenerateInvoices: boolean;
    requireClientApproval: boolean;
    sendNotifications: boolean;
    paymentTerms: number;
    lateFeeRate: number;
    currency: string;
    taxRate: number;
}
export interface StageBillingRequest {
    caseId: string;
    phase: string;
    milestones: BillingMilestone[];
    configuration: BillingConfiguration;
}
export declare class BillingService {
    private prisma;
    private chineseBillingEngine;
    constructor(prisma: PrismaClient);
    createStageBilling(request: StageBillingRequest): Promise<{
        billingNodes: BillingNode[];
        configuration: BillingConfiguration;
        compliance: any;
    }>;
    getBillingNodesByCase(caseId: string, options?: {
        phase?: string;
        includeCompleted?: boolean;
        includePaid?: boolean;
    }): Promise<BillingNode[]>;
    completeBillingNode(billingNodeId: string, completionData: {
        completionDate: Date;
        notes?: string;
        generateInvoice?: boolean;
    }): Promise<{
        billingNode: BillingNode;
        invoice?: Invoice;
        nextMilestones: BillingNode[];
    }>;
    generateInvoiceForBillingNode(billingNodeId: string): Promise<Invoice>;
    autoGenerateInvoices(caseId: string): Promise<Invoice[]>;
    getBillingProgress(caseId: string): Promise<{
        currentPhase: string;
        completedNodes: BillingNode[];
        pendingNodes: BillingNode[];
        totalBilled: number;
        totalPaid: number;
        completionPercentage: number;
        nextMilestone?: BillingNode;
    }>;
    validateBillingMilestones(milestones: BillingMilestone[]): Promise<{
        isValid: boolean;
        errors: string[];
        warnings: string[];
    }>;
    private validatePhaseCompatibility;
    private getCompatiblePhases;
    private storeBillingConfiguration;
    private getBillingConfiguration;
    private checkStageBillingCompliance;
    private generateInvoiceNumber;
    private calculateDueDate;
    private markItemsAsBilled;
}
//# sourceMappingURL=BillingService.d.ts.map