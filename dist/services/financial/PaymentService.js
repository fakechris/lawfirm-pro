"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const financial_1 = require("../models/financial");
const PaymentGatewayService_1 = require("./PaymentGatewayService");
const AlipayService_1 = require("./AlipayService");
const WechatPayService_1 = require("./WechatPayService");
const financial_2 = require("../../config/financial");
class PaymentService {
    constructor(prisma) {
        this.config = (0, financial_2.getPaymentConfig)();
        this.prisma = prisma;
        this.gatewayService = new PaymentGatewayService_1.PaymentGatewayService(prisma);
        this.alipayService = new AlipayService_1.AlipayService();
        this.wechatPayService = new WechatPayService_1.WechatPayService();
    }
    async createPayment(request) {
        try {
            const invoice = await this.prisma.invoice.findUnique({
                where: { id: request.invoiceId },
            });
            if (!invoice) {
                return {
                    success: false,
                    error: 'Invoice not found',
                };
            }
            if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
                return {
                    success: false,
                    error: `Invoice cannot be paid. Current status: ${invoice.status}`,
                };
            }
            const paidAmount = await this.calculatePaidAmount(request.invoiceId);
            const remainingAmount = invoice.total - paidAmount;
            if (request.amount > remainingAmount) {
                return {
                    success: false,
                    error: `Payment amount (${request.amount}) exceeds remaining balance (${remainingAmount})`,
                };
            }
            const paymentReference = this.generatePaymentReference();
            const payment = await this.prisma.payment.create({
                data: {
                    invoiceId: request.invoiceId,
                    amount: request.amount,
                    currency: request.currency || this.config.processing.currency,
                    method: request.method,
                    reference: paymentReference,
                    status: financial_1.PaymentStatus.PENDING,
                    notes: request.description,
                },
            });
            const gatewayRequest = {
                amount: request.amount,
                currency: request.currency || this.config.processing.currency,
                description: request.description || `Payment for invoice ${invoice.invoiceNumber}`,
                orderId: paymentReference,
                clientInfo: request.clientInfo,
                returnUrl: request.returnUrl,
                notifyUrl: request.notifyUrl,
            };
            const gatewayResponse = await this.gatewayService.initializePayment(request.method, gatewayRequest);
            if (!gatewayResponse.success) {
                await this.prisma.payment.update({
                    where: { id: payment.id },
                    data: { status: financial_1.PaymentStatus.FAILED },
                });
                return {
                    success: false,
                    error: gatewayResponse.error || 'Payment initialization failed',
                };
            }
            if (gatewayResponse.transactionId) {
                await this.prisma.payment.update({
                    where: { id: payment.id },
                    data: { transactionId: gatewayResponse.transactionId },
                });
            }
            return {
                success: true,
                payment: await this.getPaymentById(payment.id),
                paymentUrl: gatewayResponse.paymentUrl,
                qrCode: gatewayResponse.qrCode,
                transactionId: gatewayResponse.transactionId,
                message: 'Payment initialized successfully',
            };
        }
        catch (error) {
            console.error('Payment creation failed:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async getPaymentById(paymentId) {
        return await this.prisma.payment.findUnique({
            where: { id: paymentId },
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
    async getPaymentByReference(reference) {
        return await this.prisma.payment.findFirst({
            where: { reference },
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
    async checkPaymentStatus(request) {
        try {
            const payment = await this.getPaymentById(request.paymentId);
            if (!payment) {
                return {
                    success: false,
                    error: 'Payment not found',
                };
            }
            if (request.transactionId && payment.status === financial_1.PaymentStatus.PENDING) {
                const gatewayStatus = await this.gatewayService.checkPaymentStatus(payment.method, request.transactionId);
                if (gatewayStatus !== payment.status) {
                    await this.prisma.payment.update({
                        where: { id: payment.id },
                        data: { status: gatewayStatus },
                    });
                    if (gatewayStatus === financial_1.PaymentStatus.COMPLETED) {
                        await this.updateInvoicePaymentStatus(payment.invoiceId);
                    }
                }
            }
            return {
                success: true,
                payment: await this.getPaymentById(request.paymentId),
                message: 'Payment status retrieved successfully',
            };
        }
        catch (error) {
            console.error('Payment status check failed:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async getPaymentsByInvoice(invoiceId) {
        return await this.prisma.payment.findMany({
            where: { invoiceId },
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
    async getPaymentsByClient(clientId) {
        return await this.prisma.payment.findMany({
            where: {
                invoice: {
                    clientId,
                },
            },
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
    async processWebhook(gateway, payload) {
        try {
            const success = await this.gatewayService.processWebhook(gateway, payload);
            if (success) {
                console.log(`Webhook processed successfully for ${gateway}`);
            }
            return success;
        }
        catch (error) {
            console.error('Webhook processing failed:', error);
            return false;
        }
    }
    async schedulePayment(request) {
        try {
            const invoice = await this.prisma.invoice.findUnique({
                where: { id: request.invoiceId },
            });
            if (!invoice) {
                return {
                    success: false,
                    error: 'Invoice not found',
                };
            }
            const scheduledPayment = await this.prisma.scheduledPayment.create({
                data: {
                    invoiceId: request.invoiceId,
                    amount: request.amount,
                    method: request.method,
                    scheduleDate: request.scheduleDate,
                    clientName: request.clientInfo.name,
                    clientEmail: request.clientInfo.email,
                    clientPhone: request.clientInfo.phone,
                    description: request.description,
                    status: 'SCHEDULED',
                },
            });
            return {
                success: true,
                message: 'Payment scheduled successfully',
            };
        }
        catch (error) {
            console.error('Payment scheduling failed:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async processScheduledPayments() {
        try {
            const now = new Date();
            const scheduledPayments = await this.prisma.scheduledPayment.findMany({
                where: {
                    status: 'SCHEDULED',
                    scheduleDate: {
                        lte: now,
                    },
                },
            });
            for (const scheduledPayment of scheduledPayments) {
                try {
                    const paymentRequest = {
                        invoiceId: scheduledPayment.invoiceId,
                        amount: scheduledPayment.amount,
                        method: scheduledPayment.method,
                        description: scheduledPayment.description,
                        clientInfo: {
                            name: scheduledPayment.clientName,
                            email: scheduledPayment.clientEmail,
                            phone: scheduledPayment.clientPhone,
                        },
                    };
                    const result = await this.createPayment(paymentRequest);
                    if (result.success) {
                        await this.prisma.scheduledPayment.update({
                            where: { id: scheduledPayment.id },
                            data: { status: 'PROCESSED' },
                        });
                    }
                    else {
                        await this.prisma.scheduledPayment.update({
                            where: { id: scheduledPayment.id },
                            data: { status: 'FAILED', notes: result.error },
                        });
                    }
                }
                catch (error) {
                    await this.prisma.scheduledPayment.update({
                        where: { id: scheduledPayment.id },
                        data: { status: 'FAILED', notes: error.message },
                    });
                }
            }
        }
        catch (error) {
            console.error('Scheduled payment processing failed:', error);
        }
    }
    async cancelPayment(paymentId) {
        try {
            const payment = await this.getPaymentById(paymentId);
            if (!payment) {
                return {
                    success: false,
                    error: 'Payment not found',
                };
            }
            if (payment.status !== financial_1.PaymentStatus.PENDING) {
                return {
                    success: false,
                    error: `Cannot cancel payment with status: ${payment.status}`,
                };
            }
            await this.prisma.payment.update({
                where: { id: paymentId },
                data: { status: financial_1.PaymentStatus.FAILED },
            });
            return {
                success: true,
                payment: await this.getPaymentById(paymentId),
                message: 'Payment cancelled successfully',
            };
        }
        catch (error) {
            console.error('Payment cancellation failed:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async calculatePaidAmount(invoiceId) {
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
    generatePaymentReference() {
        const timestamp = Date.now().toString();
        const random = Math.random().toString(36).substring(2, 8);
        return `PAY_${timestamp}_${random}`;
    }
    async getPaymentStatistics(clientId) {
        try {
            const whereClause = clientId
                ? { invoice: { clientId } }
                : {};
            const [totalPayments, completedPayments, pendingPayments, failedPayments, refundedPayments,] = await Promise.all([
                this.prisma.payment.count({ where: whereClause }),
                this.prisma.payment.count({
                    where: { ...whereClause, status: financial_1.PaymentStatus.COMPLETED },
                }),
                this.prisma.payment.count({
                    where: { ...whereClause, status: financial_1.PaymentStatus.PENDING },
                }),
                this.prisma.payment.count({
                    where: { ...whereClause, status: financial_1.PaymentStatus.FAILED },
                }),
                this.prisma.payment.count({
                    where: { ...whereClause, status: financial_1.PaymentStatus.REFUNDED },
                }),
            ]);
            const totalAmount = await this.prisma.payment.aggregate({
                where: whereClause,
                _sum: { amount: true },
            });
            const completedAmount = await this.prisma.payment.aggregate({
                where: { ...whereClause, status: financial_1.PaymentStatus.COMPLETED },
                _sum: { amount: true },
            });
            return {
                totalPayments,
                completedPayments,
                pendingPayments,
                failedPayments,
                refundedPayments,
                totalAmount: totalAmount._sum.amount || 0,
                completedAmount: completedAmount._sum.amount || 0,
                successRate: totalPayments > 0 ? (completedPayments / totalPayments) * 100 : 0,
            };
        }
        catch (error) {
            console.error('Failed to get payment statistics:', error);
            throw error;
        }
    }
    async getPaymentMethodStatistics() {
        try {
            const payments = await this.prisma.payment.groupBy({
                by: ['method'],
                _count: { id: true },
                _sum: { amount: true },
            });
            return payments.map(item => ({
                method: item.method,
                count: item._count.id,
                totalAmount: item._sum.amount || 0,
            }));
        }
        catch (error) {
            console.error('Failed to get payment method statistics:', error);
            throw error;
        }
    }
}
exports.PaymentService = PaymentService;
//# sourceMappingURL=PaymentService.js.map