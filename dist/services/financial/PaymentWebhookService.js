"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentWebhookService = void 0;
const PaymentGatewayService_1 = require("./PaymentGatewayService");
const AlipayService_1 = require("./AlipayService");
const WechatPayService_1 = require("./WechatPayService");
const financial_1 = require("../models/financial");
const financial_2 = require("../../config/financial");
class PaymentWebhookService {
    constructor(prisma) {
        this.config = (0, financial_2.getPaymentConfig)();
        this.prisma = prisma;
        this.paymentGatewayService = new PaymentGatewayService_1.PaymentGatewayService(prisma);
        this.alipayService = new AlipayService_1.AlipayService();
        this.wechatPayService = new WechatPayService_1.WechatPayService();
    }
    async handleAlipayWebhook(req, res) {
        try {
            const payload = req.body;
            if (!this.alipayService.verifyWebhookSignature(payload)) {
                res.status(400).json({ success: false, message: 'Invalid signature' });
                return;
            }
            const webhookData = this.alipayService.parseWebhookPayload(payload);
            const success = await this.paymentGatewayService.processWebhook(financial_1.PaymentMethod.ALIPAY, webhookData);
            if (success) {
                await this.logWebhook('ALIPAY', payload, 'SUCCESS');
                res.json({ success: true });
            }
            else {
                await this.logWebhook('ALIPAY', payload, 'FAILED');
                res.status(500).json({ success: false, message: 'Webhook processing failed' });
            }
        }
        catch (error) {
            console.error('Alipay webhook error:', error);
            await this.logWebhook('ALIPAY', req.body, 'ERROR', error.message);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }
    async handleWechatPayWebhook(req, res) {
        try {
            const xmlData = req.body;
            const payload = this.parseWechatXML(xmlData);
            if (!this.wechatPayService.verifyWebhookSignature(payload)) {
                res.status(400).json({ success: false, message: 'Invalid signature' });
                return;
            }
            const webhookData = this.wechatPayService.parseWebhookPayload(payload);
            const success = await this.paymentGatewayService.processWebhook(financial_1.PaymentMethod.WECHAT_PAY, webhookData);
            if (success) {
                await this.logWebhook('WECHAT_PAY', payload, 'SUCCESS');
                res.send('<xml><return_code><![CDATA[SUCCESS]]></return_code></xml>');
            }
            else {
                await this.logWebhook('WECHAT_PAY', payload, 'FAILED');
                res.status(500).json({ success: false, message: 'Webhook processing failed' });
            }
        }
        catch (error) {
            console.error('WeChat Pay webhook error:', error);
            await this.logWebhook('WECHAT_PAY', req.body, 'ERROR', error.message);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }
    async handleGenericWebhook(req, res) {
        try {
            const { gateway, transactionId, status, amount, signature } = req.body;
            if (this.config.webhooks.enabled && this.config.webhooks.secret) {
                if (!this.verifyGenericSignature(req.body, signature)) {
                    res.status(400).json({ success: false, message: 'Invalid signature' });
                    return;
                }
            }
            const payment = await this.prisma.payment.findFirst({
                where: { transactionId },
            });
            if (!payment) {
                res.status(404).json({ success: false, message: 'Payment not found' });
                return;
            }
            await this.prisma.payment.update({
                where: { id: payment.id },
                data: {
                    status: status,
                    reference: JSON.stringify(req.body),
                },
            });
            if (status === financial_1.PaymentStatus.COMPLETED) {
                await this.updateInvoicePaymentStatus(payment.invoiceId);
            }
            await this.logWebhook(gateway, req.body, 'SUCCESS');
            res.json({ success: true });
        }
        catch (error) {
            console.error('Generic webhook error:', error);
            await this.logWebhook('GENERIC', req.body, 'ERROR', error.message);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }
    async retryFailedWebhooks() {
        try {
            const failedWebhooks = await this.prisma.webhookLog.findMany({
                where: { status: 'FAILED' },
                orderBy: { createdAt: 'desc' },
                take: 100,
            });
            for (const webhook of failedWebhooks) {
                try {
                    const payload = JSON.parse(webhook.payload);
                    let success = false;
                    switch (webhook.gateway) {
                        case 'ALIPAY':
                            success = await this.paymentGatewayService.processWebhook(financial_1.PaymentMethod.ALIPAY, this.alipayService.parseWebhookPayload(payload));
                            break;
                        case 'WECHAT_PAY':
                            success = await this.paymentGatewayService.processWebhook(financial_1.PaymentMethod.WECHAT_PAY, this.wechatPayService.parseWebhookPayload(payload));
                            break;
                    }
                    if (success) {
                        await this.prisma.webhookLog.update({
                            where: { id: webhook.id },
                            data: { status: 'RETRIED_SUCCESS' },
                        });
                    }
                }
                catch (error) {
                    console.error(`Failed to retry webhook ${webhook.id}:`, error);
                }
            }
        }
        catch (error) {
            console.error('Failed to retry webhooks:', error);
        }
    }
    async getWebhookStats() {
        try {
            const stats = await this.prisma.webhookLog.groupBy({
                by: ['gateway', 'status'],
                _count: { id: true },
                _sum: { retryCount: true },
            });
            const totalWebhooks = await this.prisma.webhookLog.count();
            const successRate = await this.prisma.webhookLog.count({
                where: { status: 'SUCCESS' },
            }) / totalWebhooks;
            return {
                totalWebhooks,
                successRate,
                gatewayStats: stats,
            };
        }
        catch (error) {
            throw new Error(`Failed to get webhook stats: ${error.message}`);
        }
    }
    parseWechatXML(xmlData) {
        const result = {};
        const regex = /<([^>]+)><!\[CDATA\[([^]]*)\]\]><\/\1>/g;
        let match;
        while ((match = regex.exec(xmlData)) !== null) {
            result[match[1]] = match[2];
        }
        return result;
    }
    verifyGenericSignature(payload, signature) {
        try {
            const expectedSignature = crypto
                .createHmac('sha256', this.config.webhooks.secret)
                .update(JSON.stringify(payload))
                .digest('hex');
            return expectedSignature === signature;
        }
        catch (error) {
            return false;
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
    async logWebhook(gateway, payload, status, error) {
        try {
            await this.prisma.webhookLog.create({
                data: {
                    gateway,
                    payload: JSON.stringify(payload),
                    status,
                    error: error,
                },
            });
        }
        catch (logError) {
            console.error('Failed to log webhook:', logError);
        }
    }
    verifyWebhookRequest(req, res, next) {
        try {
            if (!this.config.webhooks.enabled) {
                res.status(403).json({ success: false, message: 'Webhooks disabled' });
                return;
            }
            if (this.config.security.rateLimiting.enabled) {
                const clientIp = req.ip;
            }
            if (this.config.security.ipWhitelist.length > 0) {
                if (!this.config.security.ipWhitelist.includes(req.ip)) {
                    res.status(403).json({ success: false, message: 'IP not allowed' });
                    return;
                }
            }
            if (this.config.security.ipBlacklist.includes(req.ip)) {
                res.status(403).json({ success: false, message: 'IP blocked' });
                return;
            }
            next();
        }
        catch (error) {
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }
}
exports.PaymentWebhookService = PaymentWebhookService;
//# sourceMappingURL=PaymentWebhookService.js.map