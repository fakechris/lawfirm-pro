"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentGatewayService = void 0;
const financial_1 = require("../../config/financial");
const financial_2 = require("../models/financial");
class PaymentGatewayService {
    constructor(prisma) {
        this.config = (0, financial_1.getPaymentConfig)();
        this.prisma = prisma;
    }
    async initializePayment(gateway, request) {
        if (!this.validatePaymentRequest(request)) {
            throw new Error('Invalid payment request');
        }
        if (!this.isGatewayConfigured(gateway)) {
            throw new Error(`Payment gateway ${gateway} is not configured`);
        }
        if (!this.validateAmount(request.amount)) {
            throw new Error('Amount is outside allowed limits');
        }
        switch (gateway) {
            case financial_2.PaymentMethod.ALIPAY:
                return this.initializeAlipayPayment(request);
            case financial_2.PaymentMethod.WECHAT_PAY:
                return this.initializeWechatPayment(request);
            case financial_2.PaymentMethod.BANK_TRANSFER:
                return this.initializeBankTransfer(request);
            default:
                throw new Error(`Unsupported payment gateway: ${gateway}`);
        }
    }
    async processWebhook(gateway, payload) {
        try {
            if (!this.verifyWebhookSignature(gateway, payload)) {
                throw new Error('Invalid webhook signature');
            }
            const webhookPayload = this.parseWebhookPayload(gateway, payload);
            const payment = await this.prisma.payment.findFirst({
                where: { transactionId: webhookPayload.transactionId },
            });
            if (!payment) {
                throw new Error('Payment not found');
            }
            await this.prisma.payment.update({
                where: { id: payment.id },
                data: {
                    status: webhookPayload.status,
                    reference: JSON.stringify(payload),
                },
            });
            if (webhookPayload.status === financial_2.PaymentStatus.COMPLETED) {
                await this.updateInvoicePaymentStatus(payment.invoiceId);
            }
            return true;
        }
        catch (error) {
            console.error(`Webhook processing failed for ${gateway}:`, error);
            return false;
        }
    }
    async checkPaymentStatus(gateway, transactionId) {
        switch (gateway) {
            case financial_2.PaymentMethod.ALIPAY:
                return this.checkAlipayStatus(transactionId);
            case financial_2.PaymentMethod.WECHAT_PAY:
                return this.checkWechatStatus(transactionId);
            default:
                throw new Error(`Status check not supported for gateway: ${gateway}`);
        }
    }
    async refundPayment(gateway, transactionId, amount, reason) {
        switch (gateway) {
            case financial_2.PaymentMethod.ALIPAY:
                return this.refundAlipayPayment(transactionId, amount, reason);
            case financial_2.PaymentMethod.WECHAT_PAY:
                return this.refundWechatPayment(transactionId, amount, reason);
            default:
                throw new Error(`Refund not supported for gateway: ${gateway}`);
        }
    }
    validatePaymentRequest(request) {
        return (request.amount > 0 &&
            request.currency &&
            request.description &&
            request.orderId &&
            request.clientInfo.name &&
            request.clientInfo.email);
    }
    isGatewayConfigured(gateway) {
        const gatewayConfig = this.config.supportedGateways[gateway.toLowerCase()];
        return gatewayConfig && gatewayConfig.enabled;
    }
    validateAmount(amount) {
        const { minAmount, maxAmount } = this.config.processing;
        return amount >= minAmount && amount <= maxAmount;
    }
    verifyWebhookSignature(gateway, payload) {
        return process.env.NODE_ENV === 'development';
    }
    parseWebhookPayload(gateway, payload) {
        switch (gateway) {
            case financial_2.PaymentMethod.ALIPAY:
                return this.parseAlipayWebhook(payload);
            case financial_2.PaymentMethod.WECHAT_PAY:
                return this.parseWechatWebhook(payload);
            default:
                throw new Error(`Webhook parsing not supported for gateway: ${gateway}`);
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
            .filter(p => p.status === financial_2.PaymentStatus.COMPLETED)
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
    async initializeAlipayPayment(request) {
        return {
            success: true,
            paymentUrl: 'https://alipay.com/pay',
            message: 'Alipay payment initialized',
        };
    }
    async checkAlipayStatus(transactionId) {
        return financial_2.PaymentStatus.COMPLETED;
    }
    async refundAlipayPayment(transactionId, amount, reason) {
        return {
            success: true,
            message: 'Alipay refund processed',
        };
    }
    parseAlipayWebhook(payload) {
        return {
            transactionId: payload.trade_no,
            orderId: payload.out_trade_no,
            amount: parseFloat(payload.total_amount),
            status: payload.trade_status === 'TRADE_SUCCESS' ? financial_2.PaymentStatus.COMPLETED : financial_2.PaymentStatus.FAILED,
            gateway: 'ALIPAY',
            timestamp: new Date(),
        };
    }
    async initializeWechatPayment(request) {
        return {
            success: true,
            qrCode: 'wechat://pay',
            message: 'WeChat Pay payment initialized',
        };
    }
    async checkWechatStatus(transactionId) {
        return financial_2.PaymentStatus.COMPLETED;
    }
    async refundWechatPayment(transactionId, amount, reason) {
        return {
            success: true,
            message: 'WeChat Pay refund processed',
        };
    }
    parseWechatWebhook(payload) {
        return {
            transactionId: payload.transaction_id,
            orderId: payload.out_trade_no,
            amount: parseFloat(payload.total_fee) / 100,
            status: payload.result_code === 'SUCCESS' ? financial_2.PaymentStatus.COMPLETED : financial_2.PaymentStatus.FAILED,
            gateway: 'WECHAT_PAY',
            timestamp: new Date(),
        };
    }
    async initializeBankTransfer(request) {
        const bankConfig = this.config.supportedGateways.bank;
        return {
            success: true,
            message: 'Bank transfer instructions generated',
            transactionId: `BT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
    }
}
exports.PaymentGatewayService = PaymentGatewayService;
//# sourceMappingURL=PaymentGatewayService.js.map