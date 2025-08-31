import { PrismaClient } from '@prisma/client';
import { Payment, PaymentMethod } from '../models/financial';
export interface ReconciliationReport {
    id: string;
    period: {
        startDate: Date;
        endDate: Date;
    };
    summary: {
        totalPayments: number;
        totalAmount: number;
        matchedPayments: number;
        matchedAmount: number;
        unmatchedPayments: number;
        unmatchedAmount: number;
        discrepancies: number;
    };
    details: {
        matchedPayments: any[];
        unmatchedPayments: any[];
        discrepancies: any[];
    };
    generatedAt: Date;
    status: string;
}
export interface ReconciliationRequest {
    startDate: Date;
    endDate: Date;
    paymentMethods?: PaymentMethod[];
    autoMatch?: boolean;
    generateReport?: boolean;
}
export interface DiscrepancyAlert {
    id: string;
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    paymentId?: string;
    transactionId?: string;
    description: string;
    details: any;
    detectedAt: Date;
    resolved: boolean;
    resolvedAt?: Date;
    resolvedBy?: string;
    resolutionNotes?: string;
}
export declare class PaymentReconciliationService {
    private prisma;
    private config;
    constructor(prisma: PrismaClient);
    generateReconciliationReport(request: ReconciliationRequest): Promise<ReconciliationReport>;
    autoReconcilePayments(): Promise<void>;
    reconcilePayment(payment: Payment): Promise<boolean>;
    getReconciliationReports(limit?: number, offset?: number): Promise<ReconciliationReport[]>;
    getReconciliationReport(reportId: string): Promise<ReconciliationReport | null>;
    getDiscrepancyAlerts(resolved?: boolean, limit?: number): Promise<DiscrepancyAlert[]>;
    resolveDiscrepancyAlert(alertId: string, resolvedBy: string, resolutionNotes: string): Promise<boolean>;
    getReconciliationStatistics(): Promise<any>;
    exportReconciliationReport(reportId: string, format?: 'CSV' | 'PDF' | 'EXCEL'): Promise<string>;
    private getPaymentsForPeriod;
    private reconcilePayments;
    private getGatewayService;
    private detectDiscrepancy;
    private saveReconciliationReport;
    private createDiscrepancyAlerts;
    private updateInvoicePaymentStatus;
    private generateReportId;
    private generateAlertId;
    private generateCSVExport;
    private generatePDFExport;
    private generateExcelExport;
}
//# sourceMappingURL=PaymentReconciliationService.d.ts.map