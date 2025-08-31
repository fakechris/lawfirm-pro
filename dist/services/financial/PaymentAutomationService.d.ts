import { PrismaClient } from '@prisma/client';
export interface PaymentAutomationConfig {
    enabled: boolean;
    reconciliation: {
        enabled: boolean;
        interval: number;
        retryAttempts: number;
        retryDelay: number;
    };
    scheduledPayments: {
        enabled: boolean;
        checkInterval: number;
        advanceNotice: number;
    };
    statusMonitoring: {
        enabled: boolean;
        checkInterval: number;
        stalePaymentThreshold: number;
    };
    refunds: {
        enabled: boolean;
        autoRefundFailed: boolean;
        expireCredits: boolean;
        checkInterval: number;
    };
    notifications: {
        enabled: boolean;
        paymentSuccess: boolean;
        paymentFailed: boolean;
        paymentOverdue: boolean;
        refundProcessed: boolean;
        lowBalance: boolean;
    };
}
export declare class PaymentAutomationService {
    private prisma;
    private paymentService;
    private refundService;
    private reconciliationService;
    private config;
    private timers;
    constructor(prisma: PrismaClient);
    start(): Promise<void>;
    stop(): Promise<void>;
    private startReconciliationAutomation;
    private runReconciliationAutomation;
    private startScheduledPaymentsAutomation;
    private runScheduledPaymentsAutomation;
    private sendScheduledPaymentNotifications;
    private startStatusMonitoring;
    private runStatusMonitoring;
    private checkStalePayments;
    private monitorPaymentMetrics;
    private detectPaymentAnomalies;
    private startRefundsAutomation;
    private runRefundsAutomation;
    private sendNotification;
    private loadConfig;
    getAutomationStatus(): any;
    updateConfig(newConfig: Partial<PaymentAutomationConfig>): void;
    triggerReconciliation(): Promise<void>;
    triggerScheduledPayments(): Promise<void>;
    triggerStatusMonitoring(): Promise<void>;
    triggerRefunds(): Promise<void>;
}
//# sourceMappingURL=PaymentAutomationService.d.ts.map