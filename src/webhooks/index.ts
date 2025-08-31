import { Router } from 'express';
import { WebhookHandler } from './WebhookHandler';
import { IntegrationGatewayService } from '../services/integration/gateway';
import { IntegrationLoggerImplementation } from '../services/integration/logger';

const router = Router();
const webhookHandler = new WebhookHandler();
const gateway = new IntegrationGatewayService();
const logger = new IntegrationLoggerImplementation();

// Generic webhook endpoint
router.post('/webhook', async (req, res) => {
  const startTime = Date.now();
  const requestId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    logger.info('Webhook request received', {
      requestId,
      method: req.method,
      path: req.path,
      contentType: req.get('Content-Type'),
      userAgent: req.get('User-Agent')
    });

    // Create webhook payload
    const payload = {
      id: req.headers['x-webhook-id'] as string || requestId,
      type: req.headers['x-webhook-type'] as string || 'unknown',
      timestamp: new Date(),
      data: req.body,
      signature: req.headers['x-webhook-signature'] as string,
      headers: {
        'content-type': req.get('Content-Type'),
        'user-agent': req.get('User-Agent'),
        'x-forwarded-for': req.get('X-Forwarded-For'),
        'x-real-ip': req.get('X-Real-IP')
      }
    };

    // Process webhook
    const result = await webhookHandler.handleWebhook(payload);

    logger.info('Webhook processed', {
      requestId,
      success: result.success,
      duration: Date.now() - startTime,
      errors: result.errors
    });

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
        processedAt: result.processedAt
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Webhook processing failed',
        errors: result.errors,
        processedAt: result.processedAt
      });
    }

  } catch (error) {
    logger.error('Webhook processing error', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime
    });

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Service-specific webhook endpoints
router.post('/webhook/stripe', async (req, res) => {
  const startTime = Date.now();
  const requestId = `stripe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    logger.info('Stripe webhook received', { requestId });

    const payload = {
      id: req.headers['stripe-id'] as string || requestId,
      type: `stripe.${req.headers['stripe-type'] as string || 'unknown'}`,
      timestamp: new Date(),
      data: req.body,
      signature: req.headers['stripe-signature'] as string,
      headers: {
        'stripe-signature': req.headers['stripe-signature'] as string,
        'content-type': req.get('Content-Type'),
        'user-agent': req.get('User-Agent')
      }
    };

    const result = await webhookHandler.handleWebhook(payload);

    logger.info('Stripe webhook processed', {
      requestId,
      success: result.success,
      duration: Date.now() - startTime
    });

    if (result.success) {
      res.status(200).json({ success: true });
    } else {
      res.status(400).json({ success: false, errors: result.errors });
    }

  } catch (error) {
    logger.error('Stripe webhook error', { requestId, error });
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/webhook/paypal', async (req, res) => {
  const startTime = Date.now();
  const requestId = `paypal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    logger.info('PayPal webhook received', { requestId });

    const payload = {
      id: req.headers['paypal-id'] as string || requestId,
      type: `paypal.${req.headers['paypal-event-type'] as string || 'unknown'}`,
      timestamp: new Date(),
      data: req.body,
      signature: req.headers['paypal-signature'] as string,
      headers: {
        'paypal-signature': req.headers['paypal-signature'] as string,
        'content-type': req.get('Content-Type'),
        'user-agent': req.get('User-Agent')
      }
    };

    const result = await webhookHandler.handleWebhook(payload);

    logger.info('PayPal webhook processed', {
      requestId,
      success: result.success,
      duration: Date.now() - startTime
    });

    if (result.success) {
      res.status(200).json({ success: true });
    } else {
      res.status(400).json({ success: false, errors: result.errors });
    }

  } catch (error) {
    logger.error('PayPal webhook error', { requestId, error });
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/webhook/court', async (req, res) => {
  const startTime = Date.now();
  const requestId = `court_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    logger.info('Court webhook received', { requestId });

    const payload = {
      id: req.headers['court-id'] as string || requestId,
      type: `court.${req.headers['court-event-type'] as string || 'unknown'}`,
      timestamp: new Date(),
      data: req.body,
      signature: req.headers['court-signature'] as string,
      headers: {
        'court-signature': req.headers['court-signature'] as string,
        'content-type': req.get('Content-Type'),
        'user-agent': req.get('User-Agent')
      }
    };

    const result = await webhookHandler.handleWebhook(payload);

    logger.info('Court webhook processed', {
      requestId,
      success: result.success,
      duration: Date.now() - startTime
    });

    if (result.success) {
      res.status(200).json({ success: true });
    } else {
      res.status(400).json({ success: false, errors: result.errors });
    }

  } catch (error) {
    logger.error('Court webhook error', { requestId, error });
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Webhook management endpoints (protected)
router.get('/webhooks', async (req, res) => {
  try {
    const { service } = req.query;
    
    if (!service) {
      return res.status(400).json({
        success: false,
        message: 'Service parameter is required'
      });
    }

    const webhooks = await webhookHandler.listWebhooks(service as string);
    
    res.json({
      success: true,
      data: webhooks
    });

  } catch (error) {
    logger.error('List webhooks error', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/webhooks/register', async (req, res) => {
  try {
    const { service, endpoint, events } = req.body;
    
    if (!service || !endpoint || !events) {
      return res.status(400).json({
        success: false,
        message: 'Service, endpoint, and events are required'
      });
    }

    const success = await webhookHandler.registerWebhook(service, endpoint, events);
    
    if (success) {
      res.json({
        success: true,
        message: 'Webhook registered successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Webhook registration failed'
      });
    }

  } catch (error) {
    logger.error('Register webhook error', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.delete('/webhooks/:webhookId', async (req, res) => {
  try {
    const { service } = req.query;
    const { webhookId } = req.params;
    
    if (!service) {
      return res.status(400).json({
        success: false,
        message: 'Service parameter is required'
      });
    }

    const success = await webhookHandler.unregisterWebhook(service as string, webhookId);
    
    if (success) {
      res.json({
        success: true,
        message: 'Webhook unregistered successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Webhook unregistration failed'
      });
    }

  } catch (error) {
    logger.error('Unregister webhook error', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/webhooks/:webhookId/test', async (req, res) => {
  try {
    const { service } = req.query;
    const { webhookId } = req.params;
    
    if (!service) {
      return res.status(400).json({
        success: false,
        message: 'Service parameter is required'
      });
    }

    const success = await webhookHandler.testWebhook(service as string, webhookId);
    
    if (success) {
      res.json({
        success: true,
        message: 'Webhook test successful'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Webhook test failed'
      });
    }

  } catch (error) {
    logger.error('Test webhook error', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Webhook health check
router.get('/webhooks/health', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Webhook service is healthy',
      timestamp: new Date(),
      version: '1.0.0'
    });
  } catch (error) {
    logger.error('Webhook health check error', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;