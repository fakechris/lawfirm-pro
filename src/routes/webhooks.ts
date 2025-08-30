import { Router } from 'express';
import { PaymentWebhookService } from '../services/financial/PaymentWebhookService';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();
const webhookService = new PaymentWebhookService(prisma);

// Alipay webhook endpoint
router.post('/alipay/notify', 
  (req, res, next) => webhookService.verifyWebhookRequest(req, res, next),
  webhookService.handleAlipayWebhook.bind(webhookService)
);

// WeChat Pay webhook endpoint
router.post('/wechat/notify', 
  (req, res, next) => webhookService.verifyWebhookRequest(req, res, next),
  webhookService.handleWechatPayWebhook.bind(webhookService)
);

// Generic webhook endpoint (for testing and other gateways)
router.post('/generic/notify', 
  (req, res, next) => webhookService.verifyWebhookRequest(req, res, next),
  webhookService.handleGenericWebhook.bind(webhookService)
);

// Webhook management endpoints (protected)
router.get('/stats', authenticate, async (req, res) => {
  try {
    const stats = await webhookService.getWebhookStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/retry-failed', authenticate, async (req, res) => {
  try {
    await webhookService.retryFailedWebhooks();
    res.json({ success: true, message: 'Failed webhooks retry initiated' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;