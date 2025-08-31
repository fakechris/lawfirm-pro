import { PrismaClient } from '@prisma/client';
import { TrustAccount, TrustTransaction, TrustTransactionType } from '../models/financial';
export interface TrustAccountRequest {
    clientId: string;
    caseId?: string;
    initialBalance?: number;
    notes?: string;
    currency?: string;
}
export interface TrustTransactionRequest {
    trustAccountId: string;
    type: TrustTransactionType;
    amount: number;
    description: string;
    reference?: string;
    documents?: string[];
    requiresApproval?: boolean;
}
export interface TrustAccountBalance {
    totalBalance: number;
    availableBalance: number;
    pendingBalance: number;
    currency: string;
    lastUpdated: Date;
}
export interface TrustAccountStatement {
    account: TrustAccount;
    transactions: TrustTransaction[];
    balance: TrustAccountBalance;
    period: {
        startDate: Date;
        endDate: Date;
    };
    summary: {
        totalDeposits: number;
        totalWithdrawals: number;
        totalInterest: number;
        netChange: number;
    };
}
export interface TrustAccountCompliance {
    isCompliant: boolean;
    violations: string[];
    warnings: string[];
    requirements: {
        segregationRequired: boolean;
        interestHandlingRequired: boolean;
        reconciliationRequired: boolean;
        documentationRequired: boolean;
        clientNotificationRequired: boolean;
    };
    lastReconciliationDate?: Date;
    nextReconciliationDate?: Date;
}
export declare class TrustAccountService {
    private prisma;
    constructor(prisma: PrismaClient);
    createTrustAccount(request: TrustAccountRequest): Promise<TrustAccount>;
    getTrustAccountById(id: string): Promise<TrustAccount | null>;
    getTrustAccountsByClient(clientId: string): Promise<TrustAccount[]>;
    getTrustAccountsByCase(caseId: string): Promise<TrustAccount[]>;
    createTrustTransaction(request: TrustTransactionRequest): Promise<TrustTransaction>;
    getTrustAccountBalance(trustAccountId: string): Promise<TrustAccountBalance>;
    generateTrustAccountStatement(trustAccountId: string, period: {
        startDate: Date;
        endDate: Date;
    }): Promise<TrustAccountStatement>;
    checkTrustAccountCompliance(trustAccountId: string): Promise<TrustAccountCompliance>;
    processMonthlyInterest(trustAccountId: string): Promise<TrustTransaction>;
    reconcileTrustAccount(trustAccountId: string, reconciliationData: {
        reconciledBalance: number;
        discrepancies: string[];
        corrections: any[];
        reconciledBy: string;
    }): Promise<{
        success: boolean;
        reconciliation: any;
        compliance: TrustAccountCompliance;
    }>;
    transferTrustFunds(fromAccountId: string, toAccountId: string, amount: number, description: string, reference?: string): Promise<{
        fromTransaction: TrustTransaction;
        toTransaction: TrustTransaction;
    }>;
    private updateTrustAccountBalance;
    private handleTransactionCompliance;
    private checkFundSegregation;
    private checkInterestHandling;
    private checkReconciliationStatus;
    private checkDocumentationCompleteness;
    private checkClientNotificationRequirements;
    private getLastReconciliationDate;
    private calculateNextReconciliationDate;
}
//# sourceMappingURL=TrustAccountService.d.ts.map