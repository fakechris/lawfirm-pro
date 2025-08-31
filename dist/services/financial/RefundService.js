"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefundService = void 0;
const financial_1 = require("../models/financial");
const PaymentGatewayService_1 = require("./PaymentGatewayService");
const AlipayService_1 = require("./AlipayService");
const WechatPayService_1 = require("./WechatPayService");
const financial_2 = require("../../config/financial");
class RefundService {
    constructor(prisma) {
        this.config = (0, financial_2.getPaymentConfig)();
        this.prisma = prisma;
        this.gatewayService = new PaymentGatewayService_1.PaymentGatewayService(prisma);
        this.alipayService = new AlipayService_1.AlipayService();
        this.wechatPayService = new WechatPayService_1.WechatPayService();
    }
    async processRefund(request) {
        try {
            const payment = await this.prisma.payment.findUnique({
                where: { id: request.paymentId },
                include: {
                    invoice: {
                        include: {
                            client: true,
                            case: true,
                        },
                    },
                },
            });
            if (!payment) {
                return {
                    success: false,
                    error: 'Payment not found',
                };
            }
            if (payment.status !== financial_1.PaymentStatus.COMPLETED) {
                return {
                    success: false,
                    error: `Payment cannot be refunded. Current status: ${payment.status}`,
                };
            }
            const existingRefunds = await this.prisma.refund.findMany({
                where: { paymentId: request.paymentId },
            });
            const totalRefunded = existingRefunds.reduce((sum, refund) => sum + refund.amount, 0);
            const refundableAmount = payment.amount - totalRefunded;
            const refundAmount = request.amount || refundableAmount;
            if (refundAmount > refundableAmount) {
                return {
                    success: false,
                    error: `Refund amount (${refundAmount}) exceeds refundable balance (${refundableAmount})`,
                };
            }
            const refundReference = this.generateRefundReference();
            const gatewayResponse = await this.gatewayService.refundPayment(payment.method, payment.transactionId || payment.reference, refundAmount, request.reason);
            if (!gatewayResponse.success) {
                return {
                    success: false,
                    error: gatewayResponse.error || 'Refund processing failed',
                };
            }
            const refund = await this.prisma.refund.create({
                data: {
                    paymentId: request.paymentId,
                    invoiceId: payment.invoiceId,
                    clientId: payment.invoice.clientId,
                    amount: refundAmount,
                    currency: payment.currency,
                    reason: request.reason,
                    reference: refundReference,
                    gatewayTransactionId: gatewayResponse.transactionId,
                    status: 'COMPLETED',
                    processedBy: request.processedBy,
                    notes: request.notes,
                },
            });
            let newPaymentStatus = payment.status;
            if (refundAmount >= payment.amount) {
                newPaymentStatus = financial_1.PaymentStatus.REFUNDED;
            }
            else {
                newPaymentStatus = financial_1.PaymentStatus.PARTIALLY_REFUNDED;
            }
            await this.prisma.payment.update({
                where: { id: payment.id },
                data: { status: newPaymentStatus },
            });
            await this.updateInvoicePaymentStatus(payment.invoiceId);
            return {
                success: true,
                refund: await this.getRefundById(refund.id),
                message: 'Refund processed successfully',
            };
        }
        catch (error) {
            console.error('Refund processing failed:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async createCredit(request) {
        try {
            const client = await this.prisma.client.findUnique({
                where: { id: request.clientId },
            });
            if (!client) {
                return {
                    success: false,
                    error: 'Client not found',
                };
            }
            const creditReference = this.generateCreditReference();
            const credit = await this.prisma.credit.create({
                data: {
                    clientId: request.clientId,
                    amount: request.amount,
                    currency: request.currency || this.config.processing.currency,
                    reason: request.reason,
                    reference: creditReference,
                    balance: request.amount,
                    expiresAt: request.expiresAt,
                    status: 'ACTIVE',
                    processedBy: request.processedBy,
                    notes: request.notes,
                },
            });
            return {
                success: true,
                credit: await this.getCreditById(credit.id),
                message: 'Credit created successfully',
            };
        }
        catch (error) {
            console.error('Credit creation failed:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async useCredit(request) {
        try {
            const credit = await this.prisma.credit.findUnique({
                where: { id: request.creditId },
            });
            if (!credit) {
                return {
                    success: false,
                    error: 'Credit not found',
                };
            }
            if (credit.status !== 'ACTIVE') {
                return {
                    success: false,
                    error: `Credit is not active. Current status: ${credit.status}`,
                };
            }
            if (credit.balance < request.amount) {
                return {
                    success: false,
                    error: `Insufficient credit balance. Available: ${credit.balance}, Requested: ${request.amount}`,
                };
            }
            if (credit.expiresAt && new Date() > credit.expiresAt) {
                return {
                    success: false,
                    error: 'Credit has expired',
                };
            }
            const invoice = await this.prisma.invoice.findUnique({
                where: { id: request.invoiceId },
            });
            if (!invoice) {
                return {
                    success: false,
                    error: 'Invoice not found',
                };
            }
            const paidAmount = await this.calculateInvoicePaidAmount(request.invoiceId);
            const remainingAmount = invoice.total - paidAmount;
            if (request.amount > remainingAmount) {
                return {
                    success: false,
                    error: `Credit amount (${request.amount}) exceeds invoice balance (${remainingAmount})`,
                };
            }
            const usage = await this.prisma.creditUsage.create({
                data: {
                    creditId: request.creditId,
                    invoiceId: request.invoiceId,
                    amount: request.amount,
                    processedBy: request.processedBy,
                },
            });
            const newBalance = credit.balance - request.amount;
            const newStatus = newBalance <= 0 ? 'USED' : 'ACTIVE';
            await this.prisma.credit.update({
                where: { id: request.creditId },
                data: {
                    balance: newBalance,
                    status: newStatus,
                },
            });
            await this.prisma.payment.create({
                data: {
                    invoiceId: request.invoiceId,
                    amount: request.amount,
                    currency: credit.currency,
                    method: financial_1.PaymentMethod.CASH,
                    reference: this.generatePaymentReference(),
                    status: financial_1.PaymentStatus.COMPLETED,
                    notes: `Payment using credit ${credit.reference}`,
                },
            });
            await this.updateInvoicePaymentStatus(request.invoiceId);
            return {
                success: true,
                usage: await this.getCreditUsageById(usage.id),
                message: 'Credit used successfully',
            };
        }
        catch (error) {
            console.error('Credit usage failed:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async getRefundById(refundId) {
        return await this.prisma.refund.findUnique({
            where: { id: refundId },
            include: {
                payment: {
                    include: {
                        invoice: {
                            include: {
                                client: true,
                                case: true,
                            },
                        },
                    },
                },
                processor: true,
            },
        });
    }
    async getRefundsByPayment(paymentId) {
        return await this.prisma.refund.findMany({
            where: { paymentId },
            include: {
                payment: {
                    include: {
                        invoice: {
                            include: {
                                client: true,
                                case: true,
                            },
                        },
                    },
                },
                processor: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getRefundsByClient(clientId) {
        return await this.prisma.refund.findMany({
            where: { clientId },
            include: {
                payment: {
                    include: {
                        invoice: {
                            include: {
                                client: true,
                                case: true,
                            },
                        },
                    },
                },
                processor: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getCreditById(creditId) {
        return await this.prisma.credit.findUnique({
            where: { id: creditId },
            include: {
                client: true,
                processor: true,
                usages: {
                    include: {
                        invoice: true,
                    },
                },
            },
        });
    }
    async getCreditsByClient(clientId) {
        return await this.prisma.credit.findMany({
            where: { clientId },
            include: {
                client: true,
                processor: true,
                usages: {
                    include: {
                        invoice: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getActiveCreditsByClient(clientId) {
        return await this.prisma.credit.findMany({
            where: {
                clientId,
                status: 'ACTIVE',
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: new Date() } },
                ],
            },
            include: {
                client: true,
                processor: true,
                usages: {
                    include: {
                        invoice: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getCreditUsageById(usageId) {
        return await this.prisma.creditUsage.findUnique({
            where: { id: usageId },
            include: {
                credit: {
                    include: {
                        client: true,
                    },
                },
                invoice: true,
                processor: true,
            },
        });
    }
    async getCreditUsageByCredit(creditId) {
        return await this.prisma.creditUsage.findMany({
            where: { creditId },
            include: {
                credit: {
                    include: {
                        client: true,
                    },
                },
                invoice: true,
                processor: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async processAutomaticRefunds() {
        try {
            const failedPayments = await this.prisma.payment.findMany({
                where: {
                    status: financial_1.PaymentStatus.FAILED,
                    createdAt: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    },
                },
            });
            for (const payment of failedPayments) {
                try {
                    const existingRefunds = await this.prisma.refund.findMany({
                        where: { paymentId: payment.id },
                    });
                    if (existingRefunds.length === 0) {
                        const refundRequest = {
                            paymentId: payment.id,
                            amount: payment.amount,
                            reason: 'Automatic refund for failed payment',
                            processedBy: 'SYSTEM',
                        };
                        await this.processRefund(refundRequest);
                    }
                }
                catch (error) {
                    console.error(`Automatic refund failed for payment ${payment.id}:`, error);
                }
            }
        }
        catch (error) {
            console.error('Automatic refund processing failed:', error);
        }
    }
    async expireOldCredits() {
        try {
            const expiredCredits = await this.prisma.credit.findMany({
                where: {
                    status: 'ACTIVE',
                    expiresAt: {
                        lt: new Date(),
                    },
                    balance: {
                        gt: 0,
                    },
                },
            });
            for (const credit of expiredCredits) {
                await this.prisma.credit.update({
                    where: { id: credit.id },
                    data: { status: 'EXPIRED' },
                });
            }
        }
        catch (error) {
            console.error('Credit expiration failed:', error);
        }
    }
    async getRefundStatistics(clientId) {
        try {
            const whereClause = clientId
                ? { clientId }
                : {};
            const [totalRefunds, completedRefunds, pendingRefunds, failedRefunds,] = await Promise.all([
                this.prisma.refund.count({ where: whereClause }),
                this.prisma.refund.count({
                    where: { ...whereClause, status: 'COMPLETED' },
                }),
                this.prisma.refund.count({
                    where: { ...whereClause, status: 'PENDING' },
                }),
                this.prisma.refund.count({
                    where: { ...whereClause, status: 'FAILED' },
                }),
            ]);
            const totalRefunded = await this.prisma.refund.aggregate({
                where: whereClause,
                _sum: { amount: true },
            });
            return {
                totalRefunds,
                completedRefunds,
                pendingRefunds,
                failedRefunds,
                totalRefunded: totalRefunded._sum.amount || 0,
                successRate: totalRefunds > 0 ? (completedRefunds / totalRefunds) * 100 : 0,
            };
        }
        catch (error) {
            console.error('Failed to get refund statistics:', error);
            throw error;
        }
    }
    async getCreditStatistics(clientId) {
        try {
            const whereClause = clientId
                ? { clientId }
                : {};
            const [totalCredits, activeCredits, usedCredits, expiredCredits,] = await Promise.all([
                this.prisma.credit.count({ where: whereClause }),
                this.prisma.credit.count({
                    where: { ...whereClause, status: 'ACTIVE' },
                }),
                this.prisma.credit.count({
                    where: { ...whereClause, status: 'USED' },
                }),
                this.prisma.credit.count({
                    where: { ...whereClause, status: 'EXPIRED' },
                }),
            ]);
            const totalCreditAmount = await this.prisma.credit.aggregate({
                where: whereClause,
                _sum: { amount: true },
            });
            const activeCreditBalance = await this.prisma.credit.aggregate({
                where: { ...whereClause, status: 'ACTIVE' },
                _sum: { balance: true },
            });
            return {
                totalCredits,
                activeCredits,
                usedCredits,
                expiredCredits,
                totalCreditAmount: totalCreditAmount._sum.amount || 0,
                activeCreditBalance: activeCreditBalance._sum.balance || 0,
            };
        }
        catch (error) {
            console.error('Failed to get credit statistics:', error);
            throw error;
        }
    }
    async calculateInvoicePaidAmount(invoiceId) {
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
    generateRefundReference() {
        const timestamp = Date.now().toString();
        const random = Math.random().toString(36).substring(2, 8);
        return `REF_${timestamp}_${random}`;
    }
    generateCreditReference() {
        const timestamp = Date.now().toString();
        const random = Math.random().toString(36).substring(2, 8);
        return `CREDIT_${timestamp}_${random}`;
    }
    generatePaymentReference() {
        const timestamp = Date.now().toString();
        const random = Math.random().toString(36).substring(2, 8);
        return `PAY_${timestamp}_${random}`;
    }
}
exports.RefundService = RefundService;
//# sourceMappingURL=RefundService.js.map