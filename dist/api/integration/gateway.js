"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const gateway_1 = require("../../middleware/integration/gateway");
const gateway_2 = require("../../services/integration/gateway");
const configManager_1 = require("../../services/integration/configManager");
const router = (0, express_1.Router)();
const gateway = new gateway_2.IntegrationGatewayService();
const config = new configManager_1.ConfigManager();
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Health check failed',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/services', async (req, res) => {
    try {
        const services = await config.getActiveServices();
        const serviceStatuses = {};
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get service statuses',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.all('/service/:service/*', gateway_1.integrationMiddleware.validateApiKey, gateway_1.integrationMiddleware.validateServiceAccess('service'), gateway_1.integrationMiddleware.handleIntegration('service'));
router.all('/pacer/*', gateway_1.integrationMiddleware.validateApiKey, gateway_1.integrationMiddleware.validateServiceAccess('pacer'), gateway_1.integrationMiddleware.handleIntegration('pacer'));
router.all('/courts/*', gateway_1.integrationMiddleware.validateApiKey, gateway_1.integrationMiddleware.validateServiceAccess('stateCourts'), gateway_1.integrationMiddleware.handleIntegration('stateCourts'));
router.all('/payments/*', gateway_1.integrationMiddleware.validateApiKey, gateway_1.integrationMiddleware.validateServiceAccess('stripe'), gateway_1.integrationMiddleware.handleIntegration('stripe'));
router.all('/research/*', gateway_1.integrationMiddleware.validateApiKey, gateway_1.integrationMiddleware.validateServiceAccess('lexisNexis'), gateway_1.integrationMiddleware.handleIntegration('lexisNexis'));
router.all('/documents/*', gateway_1.integrationMiddleware.validateApiKey, gateway_1.integrationMiddleware.validateServiceAccess('googleDrive'), gateway_1.integrationMiddleware.handleIntegration('googleDrive'));
router.all('/communication/*', gateway_1.integrationMiddleware.validateApiKey, gateway_1.integrationMiddleware.validateServiceAccess('twilio'), gateway_1.integrationMiddleware.handleIntegration('twilio'));
router.post('/webhooks/:service', async (req, res) => {
    try {
        const { service } = req.params;
        const payload = req.body;
        const signature = req.headers['x-signature'];
        const isValid = await this.validateWebhookSignature(service, payload, signature);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid webhook signature'
            });
        }
        await this.processWebhook(service, payload);
        res.json({
            success: true,
            message: 'Webhook processed successfully'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Webhook processing failed',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/config', async (req, res) => {
    try {
        const activeServices = await config.getActiveServices();
        const configurations = {};
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get configurations',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/rate-limit/:service', async (req, res) => {
    try {
        const { service } = req.params;
        const identifier = req.user?.id || req.ip;
        res.json({
            success: true,
            service,
            identifier,
            status: 'Rate limit status endpoint not yet implemented'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get rate limit status',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/metrics', async (req, res) => {
    try {
        const timeRange = {
            start: new Date(Date.now() - 24 * 60 * 60 * 1000),
            end: new Date()
        };
        res.json({
            success: true,
            message: 'Metrics endpoint not yet implemented',
            timeRange
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get metrics',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=gateway.js.map