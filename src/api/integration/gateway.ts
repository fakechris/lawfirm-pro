import { Router } from 'express';
import { integrationMiddleware } from '../../middleware/integration/gateway';
import { IntegrationGatewayService } from '../../services/integration/gateway';
import { ConfigManager } from '../../services/integration/configManager';

const router = Router();
const gateway = new IntegrationGatewayService();
const config = new ConfigManager();

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const activeServices = await config.getActiveServices();
    
    res.json({
      success: true,
      message: 'Integration Gateway is operational',
      timestamp: new Date().toISOString(),
      activeServices,
      version: '1.0.0'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Service status endpoint
router.get('/services', async (req, res) => {
  try {
    const services = await config.getActiveServices();
    const serviceStatuses: any = {};

    for (const service of services) {
      const serviceConfig = config.getServiceConfig(service);
      const circuitBreaker = gateway.circuitBreaker(service);
      const circuitState = circuitBreaker.getState();

      serviceStatuses[service] = {
        enabled: serviceConfig?.enabled || false,
        circuitBreaker: circuitState,
        config: {
          timeout: serviceConfig?.timeout,
          baseUrl: serviceConfig?.baseUrl
        }
      };
    }

    res.json({
      success: true,
      services: serviceStatuses,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get service statuses',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Generic service proxy endpoint
router.all('/service/:service/*', 
  integrationMiddleware.validateApiKey,
  integrationMiddleware.validateServiceAccess('service'),
  integrationMiddleware.handleIntegration('service')
);

// PACER integration endpoints
router.all('/pacer/*', 
  integrationMiddleware.validateApiKey,
  integrationMiddleware.validateServiceAccess('pacer'),
  integrationMiddleware.handleIntegration('pacer')
);

// Court systems integration endpoints
router.all('/courts/*', 
  integrationMiddleware.validateApiKey,
  integrationMiddleware.validateServiceAccess('stateCourts'),
  integrationMiddleware.handleIntegration('stateCourts')
);

// Payment processing endpoints
router.all('/payments/*', 
  integrationMiddleware.validateApiKey,
  integrationMiddleware.validateServiceAccess('stripe'),
  integrationMiddleware.handleIntegration('stripe')
);

// Legal research endpoints
router.all('/research/*', 
  integrationMiddleware.validateApiKey,
  integrationMiddleware.validateServiceAccess('lexisNexis'),
  integrationMiddleware.handleIntegration('lexisNexis')
);

// Document management endpoints
router.all('/documents/*', 
  integrationMiddleware.validateApiKey,
  integrationMiddleware.validateServiceAccess('googleDrive'),
  integrationMiddleware.handleIntegration('googleDrive')
);

// Communication endpoints
router.all('/communication/*', 
  integrationMiddleware.validateApiKey,
  integrationMiddleware.validateServiceAccess('twilio'),
  integrationMiddleware.handleIntegration('twilio')
);

// Webhook endpoints
router.post('/webhooks/:service', async (req, res) => {
  try {
    const { service } = req.params;
    const payload = req.body;
    const signature = req.headers['x-signature'] as string;

    // Validate webhook signature
    const isValid = await this.validateWebhookSignature(service, payload, signature);
    
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }

    // Process webhook
    await this.processWebhook(service, payload);

    res.json({
      success: true,
      message: 'Webhook processed successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Configuration management endpoints
router.get('/config', async (req, res) => {
  try {
    const activeServices = await config.getActiveServices();
    const configurations: any = {};

    for (const service of activeServices) {
      const serviceConfig = config.getServiceConfig(service);
      if (serviceConfig) {
        configurations[service] = {
          enabled: serviceConfig.enabled,
          timeout: serviceConfig.timeout,
          baseUrl: serviceConfig.baseUrl
        };
      }
    }

    res.json({
      success: true,
      configurations,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get configurations',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Rate limit status endpoint
router.get('/rate-limit/:service', async (req, res) => {
  try {
    const { service } = req.params;
    const identifier = req.user?.id || req.ip;

    // This would need to be implemented in the rate limiter
    res.json({
      success: true,
      service,
      identifier,
      status: 'Rate limit status endpoint not yet implemented'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get rate limit status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Metrics endpoint
router.get('/metrics', async (req, res) => {
  try {
    const timeRange = {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
      end: new Date()
    };

    // This would need to be implemented in the logger
    res.json({
      success: true,
      message: 'Metrics endpoint not yet implemented',
      timeRange
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get metrics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;