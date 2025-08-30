"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const PaymentWebhookService_1 = require("../services/financial/PaymentWebhookService");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const webhookService = new PaymentWebhookService_1.PaymentWebhookService(prisma);
router.post('/alipay/notify', (req, res, next) => webhookService.verifyWebhookRequest(req, res, next), webhookService.handleAlipayWebhook.bind(webhookService));
router.post('/wechat/notify', (req, res, next) => webhookService.verifyWebhookRequest(req, res, next), webhookService.handleWechatPayWebhook.bind(webhookService));
router.post('/generic/notify', (req, res, next) => webhookService.verifyWebhookRequest(req, res, next), webhookService.handleGenericWebhook.bind(webhookService));
router.get('/stats', auth_1.authenticate, async (req, res) => {
    try {
        const stats = await webhookService.getWebhookStats();
        res.json({ success: true, data: stats });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/retry-failed', auth_1.authenticate, async (req, res) => {
    try {
        await webhookService.retryFailedWebhooks();
        res.json({ success: true, message: 'Failed webhooks retry initiated' });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=webhooks.js.map