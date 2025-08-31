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
exports.FinancialService = void 0;
const financial_1 = require("../models/financial");
const PaymentGatewayService_1 = require("./PaymentGatewayService");
class FinancialService {
    constructor(prisma) {
        this.prisma = prisma;
        this.paymentGatewayService = new PaymentGatewayService_1.PaymentGatewayService(prisma);
    }
    async createBillingNode(data) {
        return this.prisma.billingNode.create({
            data: {
                name: data.name,
                description: data.description,
                caseId: data.caseId,
                phase: data.phase,
                order: data.order,
                amount: data.amount,
                dueDate: data.dueDate,
                notes: data.notes,
            },
        });
    }
    async getBillingNodesByCase(caseId) {
        return this.prisma.billingNode.findMany({
            where: { caseId, isActive: true },
            orderBy: { order: 'asc' },
        });
    }
    async updateBillingNode(id, data) {
        return this.prisma.billingNode.update({
            where: { id },
            data,
        });
    }
    async createInvoice(data) {
        const subtotal = data.items.reduce((sum, item) => sum + item.amount, 0);
        const taxRate = 0.06;
        const taxAmount = subtotal * taxRate;
        const total = subtotal + taxAmount;
        return this.prisma.invoice.create({
            data: {
                invoiceNumber: data.invoiceNumber,
                caseId: data.caseId,
                clientId: data.clientId,
                userId: data.userId,
                dueDate: data.dueDate,
                subtotal,
                taxRate,
                taxAmount,
                total,
                items: {
                    create: data.items.map(item => ({
                        type: item.type,
                        description: item.description,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        amount: item.amount,
                        taxRate: item.taxRate,
                        taxAmount: item.amount * item.taxRate,
                        total: item.amount * (1 + item.taxRate),
                    })),
                },
            },
            include: {
                items: true,
                client: true,
                case: true,
                user: true,
            },
        });
    }
    async getInvoiceById(id) {
        return this.prisma.invoice.findUnique({
            where: { id },
            include: {
                items: true,
                client: true,
                case: true,
                user: true,
                payments: true,
            },
        });
    }
    async getInvoicesByClient(clientId) {
        return this.prisma.invoice.findMany({
            where: { clientId },
            include: {
                items: true,
                case: true,
                payments: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async updateInvoiceStatus(id, status) {
        return this.prisma.invoice.update({
            where: { id },
            data: { status },
        });
    }
    async createTimeEntry(data) {
        const amount = data.hours * data.rate;
        return this.prisma.timeEntry.create({
            data: {
                caseId: data.caseId,
                userId: data.userId,
                description: data.description,
                hours: data.hours,
                rate: data.rate,
                amount,
                date: data.date,
                notes: data.notes,
            },
        });
    }
    async getTimeEntriesByCase(caseId) {
        return this.prisma.timeEntry.findMany({
            where: { caseId },
            include: {
                user: true,
                case: true,
            },
            orderBy: { date: 'desc' },
        });
    }
    async getTimeEntriesByUser(userId, startDate, endDate) {
        const where = { userId };
        if (startDate && endDate) {
            where.date = { gte: startDate, lte: endDate };
        }
        return this.prisma.timeEntry.findMany({
            where,
            include: {
                case: true,
            },
            orderBy: { date: 'desc' },
        });
    }
    async createExpense(data) {
        return this.prisma.expense.create({
            data: {
                caseId: data.caseId,
                userId: data.userId,
                category: data.category,
                description: data.description,
                amount: data.amount,
                date: data.date,
                receiptUrl: data.receiptUrl,
                notes: data.notes,
            },
        });
    }
    async getExpensesByCase(caseId) {
        return this.prisma.expense.findMany({
            where: { caseId },
            include: {
                user: true,
                case: true,
            },
            orderBy: { date: 'desc' },
        });
    }
    async getExpensesByUser(userId, startDate, endDate) {
        const where = { userId };
        if (startDate && endDate) {
            where.date = { gte: startDate, lte: endDate };
        }
        return this.prisma.expense.findMany({
            where,
            include: {
                case: true,
            },
            orderBy: { date: 'desc' },
        });
    }
    async createPayment(data) {
        return this.prisma.payment.create({
            data: {
                invoiceId: data.invoiceId,
                amount: data.amount,
                method: data.method,
                reference: data.reference,
                transactionId: data.transactionId,
                notes: data.notes,
            },
        });
    }
    async updatePaymentStatus(id, status) {
        return this.prisma.payment.update({
            where: { id },
            data: { status },
        });
    }
    async getPaymentsByInvoice(invoiceId) {
        return this.prisma.payment.findMany({
            where: { invoiceId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async createTrustAccount(data) {
        return this.prisma.trustAccount.create({
            data: {
                clientId: data.clientId,
                caseId: data.caseId,
                notes: data.notes,
            },
        });
    }
    async getTrustAccountsByClient(clientId) {
        return this.prisma.trustAccount.findMany({
            where: { clientId, isActive: true },
            include: {
                client: true,
                case: true,
            },
        });
    }
    async createTrustTransaction(data) {
        return this.prisma.trustTransaction.create({
            data: {
                trustAccountId: data.trustAccountId,
                type: data.type,
                amount: data.amount,
                description: data.description,
                reference: data.reference,
            },
        });
    }
    async getFinancialReport(caseId, clientId, startDate, endDate) {
        const where = {};
        if (caseId)
            where.caseId = caseId;
        if (clientId)
            where.clientId = clientId;
        if (startDate && endDate) {
            where.createdAt = { gte: startDate, lte: endDate };
        }
        const [invoices, payments, expenses, timeEntries] = await Promise.all([
            this.prisma.invoice.findMany({
                where: caseId ? { caseId } : clientId ? { clientId } : {},
                include: { payments: true, items: true },
            }),
            this.prisma.payment.findMany({
                where: {
                    invoice: caseId ? { caseId } : clientId ? { clientId } : {},
                    ...(startDate && endDate && { createdAt: { gte: startDate, lte: endDate } }),
                },
            }),
            this.prisma.expense.findMany({
                where: {
                    ...(caseId && { caseId }),
                    ...(clientId && { userId: clientId }),
                    ...(startDate && endDate && { date: { gte: startDate, lte: endDate } }),
                },
            }),
            this.prisma.timeEntry.findMany({
                where: {
                    ...(caseId && { caseId }),
                    ...(startDate && endDate && { date: { gte: startDate, lte: endDate } }),
                },
            }),
        ]);
        const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
        const totalPaid = payments
            .filter(p => p.status === financial_1.PaymentStatus.COMPLETED)
            .reduce((sum, p) => sum + p.amount, 0);
        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
        const totalHours = timeEntries.reduce((sum, te) => sum + te.hours, 0);
        const totalTimeValue = timeEntries.reduce((sum, te) => sum + te.amount, 0);
        return {
            summary: {
                totalInvoiced,
                totalPaid,
                totalExpenses,
                totalHours,
                totalTimeValue,
                outstandingBalance: totalInvoiced - totalPaid,
                profit: totalPaid - totalExpenses,
            },
            details: {
                invoices,
                payments,
                expenses,
                timeEntries,
            },
        };
    }
    async generateCaseBilling(caseId) {
        const caseData = await this.prisma.case.findUnique({
            where: { id: caseId },
            include: {
                billingNodes: { where: { isActive: true }, orderBy: { order: 'asc' } },
                timeEntries: { where: { isBilled: false } },
                expenses: { where: { isBilled: false, isBillable: true } },
            },
        });
        if (!caseData) {
            throw new Error('Case not found');
        }
        const currentPhase = caseData.phase;
        const phaseBillingNodes = caseData.billingNodes.filter(node => node.phase === currentPhase);
        const unbilledTimeEntries = caseData.timeEntries;
        const unbilledExpenses = caseData.expenses;
        return {
            currentPhase,
            billingNodes: phaseBillingNodes,
            unbilledTimeEntries,
            unbilledExpenses,
            suggestedInvoice: {
                caseId,
                clientId: caseData.clientId,
                items: [
                    ...phaseBillingNodes.map(node => ({
                        type: 'billing_node',
                        description: node.name,
                        quantity: 1,
                        unitPrice: node.amount,
                        amount: node.amount,
                    })),
                    ...unbilledTimeEntries.map(entry => ({
                        type: 'time_entry',
                        description: entry.description,
                        quantity: entry.hours,
                        unitPrice: entry.rate,
                        amount: entry.amount,
                    })),
                    ...unbilledExpenses.map(expense => ({
                        type: 'expense',
                        description: expense.description,
                        quantity: 1,
                        unitPrice: expense.amount,
                        amount: expense.amount,
                    })),
                ],
            },
        };
    }
    async calculateFee(feeType, params) {
        switch (feeType) {
            case financial_1.FeeType.HOURLY:
                if (!params.hours || !params.rate) {
                    throw new Error('Hours and rate are required for hourly fees');
                }
                return params.hours * params.rate;
            case financial_1.FeeType.FLAT:
                if (!params.baseAmount) {
                    throw new Error('Base amount is required for flat fees');
                }
                return params.baseAmount;
            case financial_1.FeeType.CONTINGENCY:
                if (!params.settlementAmount || !params.percentage) {
                    throw new Error('Settlement amount and percentage are required for contingency fees');
                }
                const contingencyFee = params.settlementAmount * (params.percentage / 100);
                if (params.minimum && contingencyFee < params.minimum) {
                    return params.minimum;
                }
                if (params.maximum && contingencyFee > params.maximum) {
                    return params.maximum;
                }
                return contingencyFee;
            case financial_1.FeeType.RETAINER:
                if (!params.baseAmount) {
                    throw new Error('Base amount is required for retainer fees');
                }
                return params.baseAmount;
            case financial_1.FeeType.HYBRID:
                let hybridFee = 0;
                if (params.hours && params.rate) {
                    hybridFee += params.hours * params.rate;
                }
                if (params.settlementAmount && params.percentage) {
                    hybridFee += params.settlementAmount * (params.percentage / 100);
                }
                return hybridFee;
            default:
                throw new Error(`Unsupported fee type: ${feeType}`);
        }
    }
    async processPayment(data) {
        const invoice = await this.prisma.invoice.findUnique({
            where: { id: data.invoiceId },
            include: { client: true, case: true },
        });
        if (!invoice) {
            throw new Error('Invoice not found');
        }
        if (data.amount <= 0) {
            throw new Error('Payment amount must be greater than 0');
        }
        const totalPaid = await this.getTotalPaidAmount(data.invoiceId);
        if (totalPaid + data.amount > invoice.total) {
            throw new Error('Payment amount exceeds invoice total');
        }
        const paymentRequest = {
            amount: data.amount,
            currency: invoice.currency,
            description: data.description || `Payment for invoice ${invoice.invoiceNumber}`,
            orderId: `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            clientInfo: data.clientInfo,
        };
        const gatewayResponse = await this.paymentGatewayService.initializePayment(data.method, paymentRequest);
        if (!gatewayResponse.success) {
            throw new Error(`Payment initialization failed: ${gatewayResponse.error}`);
        }
        const payment = await this.prisma.payment.create({
            data: {
                invoiceId: data.invoiceId,
                amount: data.amount,
                method: data.method,
                status: financial_1.PaymentStatus.PENDING,
                transactionId: gatewayResponse.transactionId,
                reference: JSON.stringify(gatewayResponse),
            },
        });
        return {
            payment,
            gatewayResponse,
        };
    }
    async checkPaymentStatus(paymentId) {
        const payment = await this.prisma.payment.findUnique({
            where: { id: paymentId },
        });
        if (!payment) {
            throw new Error('Payment not found');
        }
        if (!payment.transactionId) {
            return payment.status;
        }
        try {
            const gatewayStatus = await this.paymentGatewayService.checkPaymentStatus(payment.method, payment.transactionId);
            if (gatewayStatus !== payment.status) {
                await this.prisma.payment.update({
                    where: { id: paymentId },
                    data: { status: gatewayStatus },
                });
                if (gatewayStatus === financial_1.PaymentStatus.COMPLETED) {
                    await this.updateInvoicePaymentStatus(payment.invoiceId);
                }
            }
            return gatewayStatus;
        }
        catch (error) {
            console.error('Failed to check payment status:', error);
            return payment.status;
        }
    }
    async refundPayment(paymentId, amount, reason) {
        const payment = await this.prisma.payment.findUnique({
            where: { id: paymentId },
            include: { invoice: true },
        });
        if (!payment) {
            throw new Error('Payment not found');
        }
        if (payment.status !== financial_1.PaymentStatus.COMPLETED) {
            throw new Error('Only completed payments can be refunded');
        }
        const refundAmount = amount || payment.amount;
        if (refundAmount > payment.amount) {
            throw new Error('Refund amount cannot exceed payment amount');
        }
        try {
            const refundResponse = await this.paymentGatewayService.refundPayment(payment.method, payment.transactionId, refundAmount, reason);
            if (refundResponse.success) {
                await this.prisma.payment.update({
                    where: { id: paymentId },
                    data: { status: financial_1.PaymentStatus.REFUNDED },
                });
                await this.updateInvoicePaymentStatus(payment.invoiceId);
            }
            return refundResponse;
        }
        catch (error) {
            throw new Error(`Refund failed: ${error.message}`);
        }
    }
    async getPaymentMethods() {
        const config = await Promise.resolve().then(() => __importStar(require('../../config/financial'))).then(m => m.getPaymentConfig());
        const enabledMethods = [];
        if (config.supportedGateways.alipay.enabled) {
            enabledMethods.push(financial_1.PaymentMethod.ALIPAY);
        }
        if (config.supportedGateways.wechat.enabled) {
            enabledMethods.push(financial_1.PaymentMethod.WECHAT_PAY);
        }
        if (config.supportedGateways.bank.enabled) {
            enabledMethods.push(financial_1.PaymentMethod.BANK_TRANSFER);
        }
        return enabledMethods;
    }
    async getPaymentHistory(invoiceId, clientId, startDate, endDate) {
        const where = {};
        if (invoiceId)
            where.invoiceId = invoiceId;
        if (clientId)
            where.invoice = { clientId };
        if (startDate && endDate) {
            where.createdAt = { gte: startDate, lte: endDate };
        }
        return this.prisma.payment.findMany({
            where,
            include: {
                invoice: {
                    include: {
                        client: true,
                        case: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getTotalPaidAmount(invoiceId) {
        const payments = await this.prisma.payment.findMany({
            where: {
                invoiceId,
                status: financial_1.PaymentStatus.COMPLETED,
            },
        });
        return payments.reduce((sum, payment) => sum + payment.amount, 0);
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
            status = financial_1.InvoiceStatus.PAID;
        }
        else if (totalPaid > 0) {
            status = financial_1.InvoiceStatus.PARTIALLY_PAID;
        }
        else {
            status = financial_1.InvoiceStatus.UNPAID;
        }
        await this.prisma.invoice.update({
            where: { id: invoiceId },
            data: { status },
        });
    }
}
exports.FinancialService = FinancialService;
//# sourceMappingURL=FinancialService.js.map