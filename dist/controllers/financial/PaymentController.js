"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentController = void 0;
const client_1 = require("@prisma/client");
const PaymentService_1 = require("../services/financial/PaymentService");
const RefundService_1 = require("../services/financial/RefundService");
const PaymentReconciliationService_1 = require("../services/financial/PaymentReconciliationService");
class PaymentController {
    constructor() {
        this.prisma = new client_1.PrismaClient();
        this.paymentService = new PaymentService_1.PaymentService(this.prisma);
        this.refundService = new RefundService_1.RefundService(this.prisma);
        this.reconciliationService = new PaymentReconciliationService_1.PaymentReconciliationService(this.prisma);
    }
    async createPayment(req, res) {
        try {
            const paymentRequest = {
                invoiceId: req.body.invoiceId,
                amount: req.body.amount,
                method: req.body.method,
                currency: req.body.currency,
                description: req.body.description,
                clientInfo: req.body.clientInfo,
                returnUrl: req.body.returnUrl,
                notifyUrl: req.body.notifyUrl,
            };
            const result = await this.paymentService.createPayment(paymentRequest);
            if (result.success) {
                res.status(201).json({
                    success: true,
                    data: {
                        payment: result.payment,
                        paymentUrl: result.paymentUrl,
                        qrCode: result.qrCode,
                        transactionId: result.transactionId,
                    },
                    message: result.message,
                });
            }
            else {
                res.status(400).json({
                    success: false,
                    error: result.error,
                    message: result.message,
                });
            }
        }
        catch (error) {
            console.error('Create payment error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async getPayment(req, res) {
        try {
            const { id } = req.params;
            const payment = await this.paymentService.getPaymentById(id);
            if (payment) {
                res.status(200).json({
                    success: true,
                    data: payment,
                });
            }
            else {
                res.status(404).json({
                    success: false,
                    error: 'Payment not found',
                });
            }
        }
        catch (error) {
            console.error('Get payment error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async getPaymentByReference(req, res) {
        try {
            const { reference } = req.params;
            const payment = await this.paymentService.getPaymentByReference(reference);
            if (payment) {
                res.status(200).json({
                    success: true,
                    data: payment,
                });
            }
            else {
                res.status(404).json({
                    success: false,
                    error: 'Payment not found',
                });
            }
        }
        catch (error) {
            console.error('Get payment by reference error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async checkPaymentStatus(req, res) {
        try {
            const { id } = req.params;
            const { transactionId } = req.query;
            const result = await this.paymentService.checkPaymentStatus({
                paymentId: id,
                transactionId: transactionId,
            });
            if (result.success) {
                res.status(200).json({
                    success: true,
                    data: result.payment,
                    message: result.message,
                });
            }
            else {
                res.status(400).json({
                    success: false,
                    error: result.error,
                    message: result.message,
                });
            }
        }
        catch (error) {
            console.error('Check payment status error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async getPaymentsByInvoice(req, res) {
        try {
            const { invoiceId } = req.params;
            const payments = await this.paymentService.getPaymentsByInvoice(invoiceId);
            res.status(200).json({
                success: true,
                data: payments,
            });
        }
        catch (error) {
            console.error('Get payments by invoice error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async getPaymentsByClient(req, res) {
        try {
            const { clientId } = req.params;
            const payments = await this.paymentService.getPaymentsByClient(clientId);
            res.status(200).json({
                success: true,
                data: payments,
            });
        }
        catch (error) {
            console.error('Get payments by client error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async cancelPayment(req, res) {
        try {
            const { id } = req.params;
            const result = await this.paymentService.cancelPayment(id);
            if (result.success) {
                res.status(200).json({
                    success: true,
                    data: result.payment,
                    message: result.message,
                });
            }
            else {
                res.status(400).json({
                    success: false,
                    error: result.error,
                    message: result.message,
                });
            }
        }
        catch (error) {
            console.error('Cancel payment error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async processRefund(req, res) {
        try {
            const refundRequest = {
                paymentId: req.body.paymentId,
                amount: req.body.amount,
                reason: req.body.reason,
                processedBy: req.user?.id || 'SYSTEM',
                notes: req.body.notes,
            };
            const result = await this.refundService.processRefund(refundRequest);
            if (result.success) {
                res.status(201).json({
                    success: true,
                    data: result.refund,
                    message: result.message,
                });
            }
            else {
                res.status(400).json({
                    success: false,
                    error: result.error,
                    message: result.message,
                });
            }
        }
        catch (error) {
            console.error('Process refund error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async getRefund(req, res) {
        try {
            const { id } = req.params;
            const refund = await this.refundService.getRefundById(id);
            if (refund) {
                res.status(200).json({
                    success: true,
                    data: refund,
                });
            }
            else {
                res.status(404).json({
                    success: false,
                    error: 'Refund not found',
                });
            }
        }
        catch (error) {
            console.error('Get refund error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async getRefundsByPayment(req, res) {
        try {
            const { paymentId } = req.params;
            const refunds = await this.refundService.getRefundsByPayment(paymentId);
            res.status(200).json({
                success: true,
                data: refunds,
            });
        }
        catch (error) {
            console.error('Get refunds by payment error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async getRefundsByClient(req, res) {
        try {
            const { clientId } = req.params;
            const refunds = await this.refundService.getRefundsByClient(clientId);
            res.status(200).json({
                success: true,
                data: refunds,
            });
        }
        catch (error) {
            console.error('Get refunds by client error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async createCredit(req, res) {
        try {
            const creditRequest = {
                clientId: req.body.clientId,
                amount: req.body.amount,
                currency: req.body.currency,
                reason: req.body.reason,
                expiresAt: req.body.expiresAt,
                processedBy: req.user?.id || 'SYSTEM',
                notes: req.body.notes,
            };
            const result = await this.refundService.createCredit(creditRequest);
            if (result.success) {
                res.status(201).json({
                    success: true,
                    data: result.credit,
                    message: result.message,
                });
            }
            else {
                res.status(400).json({
                    success: false,
                    error: result.error,
                    message: result.message,
                });
            }
        }
        catch (error) {
            console.error('Create credit error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async useCredit(req, res) {
        try {
            const creditUsageRequest = {
                creditId: req.body.creditId,
                invoiceId: req.body.invoiceId,
                amount: req.body.amount,
                processedBy: req.user?.id || 'SYSTEM',
            };
            const result = await this.refundService.useCredit(creditUsageRequest);
            if (result.success) {
                res.status(201).json({
                    success: true,
                    data: result.usage,
                    message: result.message,
                });
            }
            else {
                res.status(400).json({
                    success: false,
                    error: result.error,
                    message: result.message,
                });
            }
        }
        catch (error) {
            console.error('Use credit error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async getCredit(req, res) {
        try {
            const { id } = req.params;
            const credit = await this.refundService.getCreditById(id);
            if (credit) {
                res.status(200).json({
                    success: true,
                    data: credit,
                });
            }
            else {
                res.status(404).json({
                    success: false,
                    error: 'Credit not found',
                });
            }
        }
        catch (error) {
            console.error('Get credit error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async getCreditsByClient(req, res) {
        try {
            const { clientId } = req.params;
            const credits = await this.refundService.getCreditsByClient(clientId);
            res.status(200).json({
                success: true,
                data: credits,
            });
        }
        catch (error) {
            console.error('Get credits by client error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async getActiveCreditsByClient(req, res) {
        try {
            const { clientId } = req.params;
            const credits = await this.refundService.getActiveCreditsByClient(clientId);
            res.status(200).json({
                success: true,
                data: credits,
            });
        }
        catch (error) {
            console.error('Get active credits by client error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async schedulePayment(req, res) {
        try {
            const scheduleRequest = {
                invoiceId: req.body.invoiceId,
                amount: req.body.amount,
                method: req.body.method,
                scheduleDate: req.body.scheduleDate,
                clientInfo: req.body.clientInfo,
                description: req.body.description,
            };
            const result = await this.paymentService.schedulePayment(scheduleRequest);
            if (result.success) {
                res.status(201).json({
                    success: true,
                    message: result.message,
                });
            }
            else {
                res.status(400).json({
                    success: false,
                    error: result.error,
                    message: result.message,
                });
            }
        }
        catch (error) {
            console.error('Schedule payment error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async processWebhook(req, res) {
        try {
            const { gateway } = req.params;
            const payload = req.body;
            const success = await this.paymentService.processWebhook(gateway, payload);
            if (success) {
                res.status(200).json({
                    success: true,
                    message: 'Webhook processed successfully',
                });
            }
            else {
                res.status(400).json({
                    success: false,
                    error: 'Webhook processing failed',
                });
            }
        }
        catch (error) {
            console.error('Process webhook error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async generateReconciliationReport(req, res) {
        try {
            const reportRequest = {
                startDate: new Date(req.body.startDate),
                endDate: new Date(req.body.endDate),
                paymentMethods: req.body.paymentMethods,
                autoMatch: req.body.autoMatch,
                generateReport: req.body.generateReport,
            };
            const report = await this.reconciliationService.generateReconciliationReport(reportRequest);
            res.status(201).json({
                success: true,
                data: report,
            });
        }
        catch (error) {
            console.error('Generate reconciliation report error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async getReconciliationReports(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 10;
            const offset = parseInt(req.query.offset) || 0;
            const reports = await this.reconciliationService.getReconciliationReports(limit, offset);
            res.status(200).json({
                success: true,
                data: reports,
            });
        }
        catch (error) {
            console.error('Get reconciliation reports error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async getReconciliationReport(req, res) {
        try {
            const { id } = req.params;
            const report = await this.reconciliationService.getReconciliationReport(id);
            if (report) {
                res.status(200).json({
                    success: true,
                    data: report,
                });
            }
            else {
                res.status(404).json({
                    success: false,
                    error: 'Report not found',
                });
            }
        }
        catch (error) {
            console.error('Get reconciliation report error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async getDiscrepancyAlerts(req, res) {
        try {
            const resolved = req.query.resolved === 'true';
            const limit = parseInt(req.query.limit) || 50;
            const alerts = await this.reconciliationService.getDiscrepancyAlerts(resolved, limit);
            res.status(200).json({
                success: true,
                data: alerts,
            });
        }
        catch (error) {
            console.error('Get discrepancy alerts error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async resolveDiscrepancyAlert(req, res) {
        try {
            const { id } = req.params;
            const { resolutionNotes } = req.body;
            const resolvedBy = req.user?.id || 'SYSTEM';
            const success = await this.reconciliationService.resolveDiscrepancyAlert(id, resolvedBy, resolutionNotes);
            if (success) {
                res.status(200).json({
                    success: true,
                    message: 'Discrepancy alert resolved successfully',
                });
            }
            else {
                res.status(400).json({
                    success: false,
                    error: 'Failed to resolve discrepancy alert',
                });
            }
        }
        catch (error) {
            console.error('Resolve discrepancy alert error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async exportReconciliationReport(req, res) {
        try {
            const { id } = req.params;
            const { format } = req.query;
            const exportData = await this.reconciliationService.exportReconciliationReport(id, format);
            const contentType = this.getContentType(format);
            const filename = `reconciliation_report_${id}.${format?.toLowerCase() || 'csv'}`;
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.status(200).send(exportData);
        }
        catch (error) {
            console.error('Export reconciliation report error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async getPaymentStatistics(req, res) {
        try {
            const { clientId } = req.query;
            const statistics = await this.paymentService.getPaymentStatistics(clientId);
            res.status(200).json({
                success: true,
                data: statistics,
            });
        }
        catch (error) {
            console.error('Get payment statistics error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async getPaymentMethodStatistics(req, res) {
        try {
            const statistics = await this.paymentService.getPaymentMethodStatistics();
            res.status(200).json({
                success: true,
                data: statistics,
            });
        }
        catch (error) {
            console.error('Get payment method statistics error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async getRefundStatistics(req, res) {
        try {
            const { clientId } = req.query;
            const statistics = await this.refundService.getRefundStatistics(clientId);
            res.status(200).json({
                success: true,
                data: statistics,
            });
        }
        catch (error) {
            console.error('Get refund statistics error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async getCreditStatistics(req, res) {
        try {
            const { clientId } = req.query;
            const statistics = await this.refundService.getCreditStatistics(clientId);
            res.status(200).json({
                success: true,
                data: statistics,
            });
        }
        catch (error) {
            console.error('Get credit statistics error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    async getReconciliationStatistics(req, res) {
        try {
            const statistics = await this.reconciliationService.getReconciliationStatistics();
            res.status(200).json({
                success: true,
                data: statistics,
            });
        }
        catch (error) {
            console.error('Get reconciliation statistics error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
    getContentType(format) {
        switch (format?.toUpperCase()) {
            case 'PDF':
                return 'application/pdf';
            case 'EXCEL':
                return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            case 'CSV':
            default:
                return 'text/csv';
        }
    }
}
exports.PaymentController = PaymentController;
//# sourceMappingURL=PaymentController.js.map