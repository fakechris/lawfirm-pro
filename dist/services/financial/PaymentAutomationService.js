"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentAutomationService = void 0;
const PaymentService_1 = require("./PaymentService");
const RefundService_1 = require("./RefundService");
const PaymentReconciliationService_1 = require("./PaymentReconciliationService");
const financial_1 = require("../models/financial");
const financial_2 = require("../../config/financial");
class PaymentAutomationService {
    constructor(prisma) {
        this.timers = {};
        this.prisma = prisma;
        this.paymentService = new PaymentService_1.PaymentService(prisma);
        this.refundService = new RefundService_1.RefundService(prisma);
        this.reconciliationService = new PaymentReconciliationService_1.PaymentReconciliationService(prisma);
        this.config = this.loadConfig();
    }
    async start() {
        if (!this.config.enabled) {
            console.log('Payment automation is disabled');
            return;
        }
        console.log('Starting payment automation services...');
        if (this.config.reconciliation.enabled) {
            this.startReconciliationAutomation();
        }
        if (this.config.scheduledPayments.enabled) {
            this.startScheduledPaymentsAutomation();
        }
        if (this.config.statusMonitoring.enabled) {
            this.startStatusMonitoring();
        }
        if (this.config.refunds.enabled) {
            this.startRefundsAutomation();
        }
        console.log('Payment automation services started successfully');
    }
    async stop() {
        console.log('Stopping payment automation services...');
        Object.values(this.timers).forEach(timer => {
            if (timer) {
                clearInterval(timer);
            }
        });
        this.timers = {};
        console.log('Payment automation services stopped');
    }
    startReconciliationAutomation() {
        const interval = this.config.reconciliation.interval * 60 * 1000;
        this.timers.reconciliation = setInterval(async () => {
            try {
                await this.runReconciliationAutomation();
            }
            catch (error) {
                console.error('Reconciliation automation failed:', error);
            }
        }, interval);
        console.log(`Reconciliation automation started (interval: ${this.config.reconciliation.interval} minutes)`);
    }
    async runReconciliationAutomation() {
        console.log('Running reconciliation automation...');
        try {
            await this.reconciliationService.autoReconcilePayments();
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            await this.reconciliationService.generateReconciliationReport({
                startDate: yesterday,
                endDate: today,
                autoMatch: true,
                generateReport: true,
            });
            console.log('Reconciliation automation completed');
        }
        catch (error) {
            console.error('Reconciliation automation error:', error);
        }
    }
    startScheduledPaymentsAutomation() {
        const interval = this.config.scheduledPayments.checkInterval * 60 * 1000;
        this.timers.scheduledPayments = setInterval(async () => {
            try {
                await this.runScheduledPaymentsAutomation();
            }
            catch (error) {
                console.error('Scheduled payments automation failed:', error);
            }
        }, interval);
        console.log(`Scheduled payments automation started (interval: ${this.config.scheduledPayments.checkInterval} minutes)`);
    }
    async runScheduledPaymentsAutomation() {
        console.log('Running scheduled payments automation...');
        try {
            await this.paymentService.processScheduledPayments();
            await this.sendScheduledPaymentNotifications();
            console.log('Scheduled payments automation completed');
        }
        catch (error) {
            console.error('Scheduled payments automation error:', error);
        }
    }
    async sendScheduledPaymentNotifications() {
        try {
            const advanceTime = new Date();
            advanceTime.setHours(advanceTime.getHours() + this.config.scheduledPayments.advanceNotice);
            const upcomingPayments = await this.prisma.scheduledPayment.findMany({
                where: {
                    status: 'SCHEDULED',
                    scheduleDate: {
                        lte: advanceTime,
                        gt: new Date(),
                    },
                    notified: false,
                },
            });
            for (const payment of upcomingPayments) {
                await this.sendNotification({
                    type: 'SCHEDULED_PAYMENT_REMINDER',
                    recipient: payment.clientEmail,
                    subject: 'Payment Reminder',
                    message: `Your scheduled payment of ${payment.amount} will be processed on ${payment.scheduleDate}`,
                    data: payment,
                });
                await this.prisma.scheduledPayment.update({
                    where: { id: payment.id },
                    data: { notified: true },
                });
            }
        }
        catch (error) {
            console.error('Failed to send scheduled payment notifications:', error);
        }
    }
    startStatusMonitoring() {
        const interval = this.config.statusMonitoring.checkInterval * 60 * 1000;
        this.timers.statusMonitoring = setInterval(async () => {
            try {
                await this.runStatusMonitoring();
            }
            catch (error) {
                console.error('Status monitoring failed:', error);
            }
        }, interval);
        console.log(`Status monitoring started (interval: ${this.config.statusMonitoring.checkInterval} minutes)`);
    }
    async runStatusMonitoring() {
        console.log('Running status monitoring...');
        try {
            await this.checkStalePayments();
            await this.monitorPaymentMetrics();
            await this.detectPaymentAnomalies();
            console.log('Status monitoring completed');
        }
        catch (error) {
            console.error('Status monitoring error:', error);
        }
    }
    async checkStalePayments() {
        try {
            const staleThreshold = new Date();
            staleThreshold.setHours(staleThreshold.getHours() - this.config.statusMonitoring.stalePaymentThreshold);
            const stalePayments = await this.prisma.payment.findMany({
                where: {
                    status: financial_1.PaymentStatus.PENDING,
                    createdAt: {
                        lt: staleThreshold,
                    },
                },
            });
            for (const payment of stalePayments) {
                const result = await this.reconciliationService.reconcilePayment(payment);
                if (!result) {
                    await this.sendNotification({
                        type: 'STALE_PAYMENT_ALERT',
                        recipient: 'admin',
                        subject: 'Stale Payment Alert',
                        message: `Payment ${payment.id} has been pending for too long`,
                        data: payment,
                    });
                }
            }
        }
        catch (error) {
            console.error('Failed to check stale payments:', error);
        }
    }
    async monitorPaymentMetrics() {
        try {
            const now = new Date();
            const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const [totalPayments, failedPayments, totalAmount] = await Promise.all([
                this.prisma.payment.count({
                    where: {
                        createdAt: { gte: last24Hours },
                    },
                }),
                this.prisma.payment.count({
                    where: {
                        createdAt: { gte: last24Hours },
                        status: financial_1.PaymentStatus.FAILED,
                    },
                }),
                this.prisma.payment.aggregate({
                    where: {
                        createdAt: { gte: last24Hours },
                    },
                    _sum: { amount: true },
                }),
            ]);
            const failureRate = totalPayments > 0 ? (failedPayments / totalPayments) * 100 : 0;
            if (failureRate > 10) {
                await this.sendNotification({
                    type: 'HIGH_FAILURE_RATE_ALERT',
                    recipient: 'admin',
                    subject: 'High Payment Failure Rate',
                    message: `Payment failure rate is ${failureRate.toFixed(2)}% in the last 24 hours`,
                    data: {
                        totalPayments,
                        failedPayments,
                        failureRate,
                        totalAmount: totalAmount._sum.amount || 0,
                    },
                });
            }
        }
        catch (error) {
            console.error('Failed to monitor payment metrics:', error);
        }
    }
    async detectPaymentAnomalies() {
        try {
            const now = new Date();
            const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
            const recentPayments = await this.prisma.payment.findMany({
                where: {
                    createdAt: { gte: lastHour },
                },
                orderBy: { amount: 'desc' },
                take: 10,
            });
            const avgAmount = recentPayments.reduce((sum, p) => sum + p.amount, 0) / recentPayments.length;
            const largePayments = recentPayments.filter(p => p.amount > avgAmount * 3);
            for (const payment of largePayments) {
                await this.sendNotification({
                    type: 'LARGE_PAYMENT_ALERT',
                    recipient: 'admin',
                    subject: 'Large Payment Detected',
                    message: `Unusually large payment detected: ${payment.amount}`,
                    data: payment,
                });
            }
        }
        catch (error) {
            console.error('Failed to detect payment anomalies:', error);
        }
    }
    startRefundsAutomation() {
        const interval = this.config.refunds.checkInterval * 60 * 1000;
        this.timers.refunds = setInterval(async () => {
            try {
                await this.runRefundsAutomation();
            }
            catch (error) {
                console.error('Refunds automation failed:', error);
            }
        }, interval);
        console.log(`Refunds automation started (interval: ${this.config.refunds.checkInterval} minutes)`);
    }
    async runRefundsAutomation() {
        console.log('Running refunds automation...');
        try {
            if (this.config.refunds.autoRefundFailed) {
                await this.refundService.processAutomaticRefunds();
            }
            if (this.config.refunds.expireCredits) {
                await this.refundService.expireOldCredits();
            }
            console.log('Refunds automation completed');
        }
        catch (error) {
            console.error('Refunds automation error:', error);
        }
    }
    async sendNotification(notification) {
        try {
            console.log(`Sending notification: ${notification.type}`, notification);
            if (this.config.notifications.enabled) {
            }
        }
        catch (error) {
            console.error('Failed to send notification:', error);
        }
    }
    loadConfig() {
        const paymentConfig = (0, financial_2.getPaymentConfig)();
        return {
            enabled: paymentConfig.autoReconciliation || false,
            reconciliation: {
                enabled: paymentConfig.autoReconciliation || false,
                interval: 30,
                retryAttempts: paymentConfig.processing?.retryAttempts || 3,
                retryDelay: 5,
            },
            scheduledPayments: {
                enabled: true,
                checkInterval: 15,
                advanceNotice: 24,
            },
            statusMonitoring: {
                enabled: true,
                checkInterval: 10,
                stalePaymentThreshold: 24,
            },
            refunds: {
                enabled: true,
                autoRefundFailed: true,
                expireCredits: true,
                checkInterval: 60,
            },
            notifications: {
                enabled: true,
                paymentSuccess: true,
                paymentFailed: true,
                paymentOverdue: true,
                refundProcessed: true,
                lowBalance: true,
            },
        };
    }
    getAutomationStatus() {
        return {
            enabled: this.config.enabled,
            running: Object.keys(this.timers).length > 0,
            services: {
                reconciliation: !!this.timers.reconciliation,
                scheduledPayments: !!this.timers.scheduledPayments,
                statusMonitoring: !!this.timers.statusMonitoring,
                refunds: !!this.timers.refunds,
            },
            config: this.config,
        };
    }
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        if (Object.keys(this.timers).length > 0) {
            this.stop();
            this.start();
        }
    }
    async triggerReconciliation() {
        try {
            await this.runReconciliationAutomation();
        }
        catch (error) {
            console.error('Manual reconciliation failed:', error);
            throw error;
        }
    }
    async triggerScheduledPayments() {
        try {
            await this.runScheduledPaymentsAutomation();
        }
        catch (error) {
            console.error('Manual scheduled payments processing failed:', error);
            throw error;
        }
    }
    async triggerStatusMonitoring() {
        try {
            await this.runStatusMonitoring();
        }
        catch (error) {
            console.error('Manual status monitoring failed:', error);
            throw error;
        }
    }
    async triggerRefunds() {
        try {
            await this.runRefundsAutomation();
        }
        catch (error) {
            console.error('Manual refunds processing failed:', error);
            throw error;
        }
    }
}
exports.PaymentAutomationService = PaymentAutomationService;
//# sourceMappingURL=PaymentAutomationService.js.map