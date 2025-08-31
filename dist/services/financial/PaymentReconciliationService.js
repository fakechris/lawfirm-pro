"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentReconciliationService = void 0;
const financial_1 = require("../models/financial");
const financial_2 = require("../../config/financial");
class PaymentReconciliationService {
    constructor(prisma) {
        this.config = (0, financial_2.getPaymentConfig)();
        this.prisma = prisma;
    }
    async generateReconciliationReport(request) {
        try {
            const reportId = this.generateReportId();
            const generatedAt = new Date();
            const payments = await this.getPaymentsForPeriod(request.startDate, request.endDate, request.paymentMethods);
            const reconciliationResult = await this.reconcilePayments(payments, request.autoMatch);
            const summary = {
                totalPayments: payments.length,
                totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
                matchedPayments: reconciliationResult.matchedPayments.length,
                matchedAmount: reconciliationResult.matchedPayments.reduce((sum, p) => sum + p.amount, 0),
                unmatchedPayments: reconciliationResult.unmatchedPayments.length,
                unmatchedAmount: reconciliationResult.unmatchedPayments.reduce((sum, p) => sum + p.amount, 0),
                discrepancies: reconciliationResult.discrepancies.length,
            };
            const report = {
                id: reportId,
                period: {
                    startDate: request.startDate,
                    endDate: request.endDate,
                },
                summary,
                details: {
                    matchedPayments: reconciliationResult.matchedPayments,
                    unmatchedPayments: reconciliationResult.unmatchedPayments,
                    discrepancies: reconciliationResult.discrepancies,
                },
                generatedAt,
                status: 'COMPLETED',
            };
            await this.saveReconciliationReport(report);
            if (reconciliationResult.discrepancies.length > 0) {
                await this.createDiscrepancyAlerts(reconciliationResult.discrepancies);
            }
            return report;
        }
        catch (error) {
            console.error('Reconciliation report generation failed:', error);
            throw error;
        }
    }
    async autoReconcilePayments() {
        try {
            const config = this.config.processing;
            const paymentsToReconcile = await this.prisma.payment.findMany({
                where: {
                    status: financial_1.PaymentStatus.PENDING,
                    createdAt: {
                        gte: new Date(Date.now() - config.retryDelay * config.retryAttempts),
                    },
                    OR: [
                        { lastReconciledAt: null },
                        { lastReconciledAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
                    ],
                },
            });
            for (const payment of paymentsToReconcile) {
                try {
                    await this.reconcilePayment(payment);
                }
                catch (error) {
                    console.error(`Auto-reconciliation failed for payment ${payment.id}:`, error);
                }
            }
        }
        catch (error) {
            console.error('Auto-reconciliation failed:', error);
        }
    }
    async reconcilePayment(payment) {
        try {
            const gatewayService = await this.getGatewayService(payment.method);
            const gatewayStatus = await gatewayService.checkPaymentStatus(payment.method, payment.transactionId || payment.reference);
            if (gatewayStatus !== payment.status) {
                await this.prisma.payment.update({
                    where: { id: payment.id },
                    data: {
                        status: gatewayStatus,
                        lastReconciledAt: new Date(),
                    },
                });
                if (gatewayStatus === financial_1.PaymentStatus.COMPLETED) {
                    await this.updateInvoicePaymentStatus(payment.invoiceId);
                }
                return true;
            }
            await this.prisma.payment.update({
                where: { id: payment.id },
                data: { lastReconciledAt: new Date() },
            });
            return false;
        }
        catch (error) {
            console.error(`Payment reconciliation failed for ${payment.id}:`, error);
            return false;
        }
    }
    async getReconciliationReports(limit = 10, offset = 0) {
        try {
            const reports = await this.prisma.reconciliationReport.findMany({
                orderBy: { generatedAt: 'desc' },
                take: limit,
                skip: offset,
            });
            return reports.map(report => ({
                ...report,
                period: {
                    startDate: report.startDate,
                    endDate: report.endDate,
                },
                summary: report.summary,
                details: report.details,
            }));
        }
        catch (error) {
            console.error('Failed to get reconciliation reports:', error);
            throw error;
        }
    }
    async getReconciliationReport(reportId) {
        try {
            const report = await this.prisma.reconciliationReport.findUnique({
                where: { id: reportId },
            });
            if (!report) {
                return null;
            }
            return {
                ...report,
                period: {
                    startDate: report.startDate,
                    endDate: report.endDate,
                },
                summary: report.summary,
                details: report.details,
            };
        }
        catch (error) {
            console.error('Failed to get reconciliation report:', error);
            throw error;
        }
    }
    async getDiscrepancyAlerts(resolved = false, limit = 50) {
        try {
            const alerts = await this.prisma.discrepancyAlert.findMany({
                where: { resolved },
                orderBy: { detectedAt: 'desc' },
                take: limit,
            });
            return alerts.map(alert => ({
                ...alert,
                details: alert.details,
            }));
        }
        catch (error) {
            console.error('Failed to get discrepancy alerts:', error);
            throw error;
        }
    }
    async resolveDiscrepancyAlert(alertId, resolvedBy, resolutionNotes) {
        try {
            await this.prisma.discrepancyAlert.update({
                where: { id: alertId },
                data: {
                    resolved: true,
                    resolvedAt: new Date(),
                    resolvedBy,
                    resolutionNotes,
                },
            });
            return true;
        }
        catch (error) {
            console.error('Failed to resolve discrepancy alert:', error);
            return false;
        }
    }
    async getReconciliationStatistics() {
        try {
            const [totalReports, lastReport, totalDiscrepancies, unresolvedDiscrepancies, totalPayments, reconciledPayments,] = await Promise.all([
                this.prisma.reconciliationReport.count(),
                this.prisma.reconciliationReport.findFirst({
                    orderBy: { generatedAt: 'desc' },
                }),
                this.prisma.discrepancyAlert.count(),
                this.prisma.discrepancyAlert.count({ where: { resolved: false } }),
                this.prisma.payment.count(),
                this.prisma.payment.count({
                    where: { lastReconciledAt: { not: null } },
                }),
            ]);
            const reconciliationRate = totalPayments > 0 ? (reconciledPayments / totalPayments) * 100 : 0;
            return {
                totalReports,
                lastReport,
                totalDiscrepancies,
                unresolvedDiscrepancies,
                totalPayments,
                reconciledPayments,
                reconciliationRate,
            };
        }
        catch (error) {
            console.error('Failed to get reconciliation statistics:', error);
            throw error;
        }
    }
    async exportReconciliationReport(reportId, format = 'CSV') {
        try {
            const report = await this.getReconciliationReport(reportId);
            if (!report) {
                throw new Error('Report not found');
            }
            switch (format) {
                case 'CSV':
                    return this.generateCSVExport(report);
                case 'PDF':
                    return this.generatePDFExport(report);
                case 'EXCEL':
                    return this.generateExcelExport(report);
                default:
                    throw new Error('Unsupported export format');
            }
        }
        catch (error) {
            console.error('Report export failed:', error);
            throw error;
        }
    }
    async getPaymentsForPeriod(startDate, endDate, paymentMethods) {
        const whereClause = {
            createdAt: {
                gte: startDate,
                lte: endDate,
            },
        };
        if (paymentMethods && paymentMethods.length > 0) {
            whereClause.method = { in: paymentMethods };
        }
        return await this.prisma.payment.findMany({
            where: whereClause,
            include: {
                invoice: {
                    include: {
                        client: true,
                        case: true,
                    },
                },
            },
        });
    }
    async reconcilePayments(payments, autoMatch = true) {
        const matchedPayments = [];
        const unmatchedPayments = [];
        const discrepancies = [];
        for (const payment of payments) {
            try {
                const gatewayService = await this.getGatewayService(payment.method);
                const gatewayStatus = await gatewayService.checkPaymentStatus(payment.method, payment.transactionId || payment.reference);
                const discrepancy = this.detectDiscrepancy(payment, gatewayStatus);
                if (discrepancy) {
                    discrepancies.push(discrepancy);
                    unmatchedPayments.push(payment);
                }
                else {
                    matchedPayments.push(payment);
                    if (autoMatch && gatewayStatus !== payment.status) {
                        await this.prisma.payment.update({
                            where: { id: payment.id },
                            data: {
                                status: gatewayStatus,
                                lastReconciledAt: new Date(),
                            },
                        });
                        if (gatewayStatus === financial_1.PaymentStatus.COMPLETED) {
                            await this.updateInvoicePaymentStatus(payment.invoiceId);
                        }
                    }
                }
            }
            catch (error) {
                console.error(`Payment reconciliation failed for ${payment.id}:`, error);
                unmatchedPayments.push(payment);
                discrepancies.push({
                    type: 'RECONCILIATION_ERROR',
                    severity: 'MEDIUM',
                    paymentId: payment.id,
                    description: 'Failed to reconcile payment with gateway',
                    details: { error: error.message },
                    detectedAt: new Date(),
                });
            }
        }
        return { matchedPayments, unmatchedPayments, discrepancies };
    }
    async getGatewayService(method) {
        switch (method) {
            case financial_1.PaymentMethod.ALIPAY:
                const { AlipayService } = await Promise.resolve().then(() => __importStar(require('./AlipayService')));
                return new AlipayService();
            case financial_1.PaymentMethod.WECHAT_PAY:
                const { WechatPayService } = await Promise.resolve().then(() => __importStar(require('./WechatPayService')));
                return new WechatPayService();
            default:
                throw new Error(`Gateway service not implemented for method: ${method}`);
        }
    }
    detectDiscrepancy(payment, gatewayStatus) {
        if (gatewayStatus !== payment.status) {
            return {
                type: 'STATUS_MISMATCH',
                severity: 'HIGH',
                paymentId: payment.id,
                transactionId: payment.transactionId,
                description: `Payment status mismatch: local=${payment.status}, gateway=${gatewayStatus}`,
                details: {
                    localStatus: payment.status,
                    gatewayStatus,
                },
                detectedAt: new Date(),
            };
        }
        return null;
    }
    async saveReconciliationReport(report) {
        await this.prisma.reconciliationReport.create({
            data: {
                id: report.id,
                startDate: report.period.startDate,
                endDate: report.period.endDate,
                summary: report.summary,
                details: report.details,
                generatedAt: report.generatedAt,
                status: report.status,
            },
        });
    }
    async createDiscrepancyAlerts(discrepancies) {
        for (const discrepancy of discrepancies) {
            await this.prisma.discrepancyAlert.create({
                data: {
                    id: this.generateAlertId(),
                    type: discrepancy.type,
                    severity: discrepancy.severity,
                    paymentId: discrepancy.paymentId,
                    transactionId: discrepancy.transactionId,
                    description: discrepancy.description,
                    details: discrepancy.details,
                    detectedAt: discrepancy.detectedAt,
                    resolved: false,
                },
            });
        }
    }
    async updateInvoicePaymentStatus(invoiceId) {
        const invoice = await this.prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: { payments: true },
        });
        if (!invoice)
            return;
        const totalPaid = invoice.payments
            .filter(p => p.status === financial_1.PaymentStatus.COMPLETED)
            .reduce((sum, p) => sum + p.amount, 0);
        let status;
        if (totalPaid >= invoice.total) {
            status = 'PAID';
        }
        else if (totalPaid > 0) {
            status = 'PARTIALLY_PAID';
        }
        else {
            status = 'UNPAID';
        }
        await this.prisma.invoice.update({
            where: { id: invoiceId },
            data: { status },
        });
    }
    generateReportId() {
        const timestamp = Date.now().toString();
        const random = Math.random().toString(36).substring(2, 8);
        return `RECONC_${timestamp}_${random}`;
    }
    generateAlertId() {
        const timestamp = Date.now().toString();
        const random = Math.random().toString(36).substring(2, 8);
        return `ALERT_${timestamp}_${random}`;
    }
    generateCSVExport(report) {
        const headers = [
            'Payment ID',
            'Invoice ID',
            'Amount',
            'Currency',
            'Method',
            'Status',
            'Created At',
            'Matched',
        ];
        const rows = [
            ...report.details.matchedPayments.map((p) => [
                p.id,
                p.invoiceId,
                p.amount,
                p.currency,
                p.method,
                p.status,
                p.createdAt,
                'YES',
            ]),
            ...report.details.unmatchedPayments.map((p) => [
                p.id,
                p.invoiceId,
                p.amount,
                p.currency,
                p.method,
                p.status,
                p.createdAt,
                'NO',
            ]),
        ];
        return [
            headers.join(','),
            ...rows.map(row => row.join(',')),
        ].join('\n');
    }
    generatePDFExport(report) {
        return `PDF Report for ${report.id}`;
    }
    generateExcelExport(report) {
        return `Excel Report for ${report.id}`;
    }
}
exports.PaymentReconciliationService = PaymentReconciliationService;
//# sourceMappingURL=PaymentReconciliationService.js.map