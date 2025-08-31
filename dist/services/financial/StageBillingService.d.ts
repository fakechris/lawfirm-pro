import { PrismaClient } from '@prisma/client';
import { BillingNode, Invoice } from '../models/financial';
export interface StageBillingConfiguration {
    autoAdvance: boolean;
    requireCompletion: boolean;
    allowPartialBilling: boolean;
    sendNotifications: boolean;
    approvalRequired: boolean;
    gracePeriod: number;
    currency: string;
}
export interface StageBillingNode {
    id: string;
    name: string;
    description: string;
    phase: string;
    order: number;
    amount: number;
    requirements: string[];
    dependencies: string[];
    triggers: string[];
    completionCriteria: {
        timeThreshold?: number;
        documentRequirements?: string[];
        approvalRequirements?: string[];
    };
    dueDate?: Date;
    isCompleted: boolean;
    completionDate?: Date;
    isActive: boolean;
}
export interface StageBillingProgress {
    currentPhase: string;
    completedNodes: StageBillingNode[];
    pendingNodes: StageBillingNode[];
    blockedNodes: StageBillingNode[];
    readyNodes: StageBillingNode[];
    overallProgress: number;
    phaseProgress: Record<string, number>;
    nextMilestone?: StageBillingNode;
    billingSummary: {
        totalBilled: number;
        totalPaid: number;
        outstandingBalance: number;
        upcomingPayments: any[];
    };
}
export interface StageBillingValidation {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    recommendations: string[];
    compliance: {
        meetsRequirements: boolean;
        violations: string[];
        suggestions: string[];
    };
}
export interface StageBillingAutomation {
    enabled: boolean;
    rules: {
        autoGenerateInvoices: boolean;
        autoApproveCompletions: boolean;
        autoSendReminders: boolean;
        autoAdvanceStages: boolean;
    };
    triggers: {
        onTimeEntry: boolean;
        onDocumentUpload: boolean;
        onMilestoneCompletion: boolean;
        onPaymentReceived: boolean;
    };
    conditions: {
        minimumAmount: number;
        maximumDelay: number;
        requiredApprovals: number;
    };
}
export declare class StageBillingService {
    private prisma;
    private configuration;
    constructor(prisma: PrismaClient, configuration?: StageBillingConfiguration);
    createStageBillingSystem(caseId: string, billingNodes: StageBillingNode[], configuration?: StageBillingConfiguration): Promise<{
        success: boolean;
        createdNodes: BillingNode[];
        validation: StageBillingValidation;
        automation: StageBillingAutomation;
    }>;
    getStageBillingProgress(caseId: string): Promise<StageBillingProgress>;
    completeBillingMilestone(billingNodeId: string, completionData: {
        completionDate: Date;
        notes?: string;
        documents?: string[];
        approverId?: string;
        generateInvoice?: boolean;
    }): Promise<{
        billingNode: BillingNode;
        nextNodes: BillingNode[];
        invoice?: Invoice;
        automationResults: any;
    }>;
    validateCompletion(billingNodeId: string, completionData: any): Promise<StageBillingValidation>;
    generateBillingSuggestions(caseId: string): Promise<{
        suggestions: any[];
        readyToBill: any[];
        upcomingDeadlines: any[];
        overdueItems: any[];
    }>;
    processAutomation(caseId: string): Promise<{
        processed: string[];
        results: any[];
        errors: string[];
    }>;
    private getDefaultConfiguration;
    private validateBillingNodes;
    private convertToStageBillingNodes;
    private parseRequirements;
    private parseDependencies;
    private parseTriggers;
    private getBlockedNodes;
    private getReadyNodes;
    private checkDependencies;
    private checkTimeThreshold;
    private calculateOverallProgress;
    private calculatePhaseProgress;
    private calculateBillingSummary;
    private generateInvoiceForMilestone;
    private getNextAvailableNodes;
    private checkComplianceRequirements;
    private calculatePriority;
    private getAutomationRules;
    private handleAutomation;
    private autoGenerateInvoices;
    private sendDeadlineReminders;
    private autoAdvanceStages;
    private storeConfiguration;
}
//# sourceMappingURL=StageBillingService.d.ts.map