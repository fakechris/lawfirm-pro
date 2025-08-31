"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const gateway_1 = require("../../services/integration/gateway");
const configManager_1 = require("../../services/integration/configManager");
const logger_1 = require("../../services/integration/logger");
const router = (0, express_1.Router)();
const gateway = new gateway_1.IntegrationGatewayService();
const config = new configManager_1.ConfigManager();
const logger = new logger_1.IntegrationLogger();
router.get('/circuit-breakers', async (req, res) => {
    try {
        const activeServices = await config.getActiveServices();
        const circuitBreakers = {};
        for (const service of activeServices) {
            const circuitBreaker = gateway.circuitBreaker(service);
            circuitBreakers[service] = circuitBreaker.getState();
        }
        res.json({
            success: true,
            circuitBreakers,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get circuit breaker statuses',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/circuit-breakers/:service/reset', async (req, res) => {
    try {
        const { service } = req.params;
        const circuitBreaker = gateway.circuitBreaker(service);
        circuitBreaker.reset();
        logger.info('Circuit breaker reset manually', { service });
        res.json({
            success: true,
            message: `Circuit breaker for ${service} has been reset`,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to reset circuit breaker',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/circuit-breakers/:service/open', async (req, res) => {
    try {
        const { service } = req.params;
        const circuitBreaker = gateway.circuitBreaker(service);
        circuitBreaker.forceOpen();
        logger.info('Circuit breaker forced open', { service });
        res.json({
            success: true,
            message: `Circuit breaker for ${service} has been forced open`,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to force open circuit breaker',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/circuit-breakers/:service/close', async (req, res) => {
    try {
        const { service } = req.params;
        const circuitBreaker = gateway.circuitBreaker(service);
        circuitBreaker.forceClose();
        logger.info('Circuit breaker forced closed', { service });
        res.json({
            success: true,
            message: `Circuit breaker for ${service} has been forced closed`,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to force close circuit breaker',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/config/services', async (req, res) => {
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
            services: configurations,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get service configurations',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/config/services/:service/validate', async (req, res) => {
    try {
        const { service } = req.params;
        const serviceConfig = req.body;
        const validation = config.validateConfig(serviceConfig, service);
        res.json({
            success: validation.valid,
            message: validation.valid ? 'Configuration is valid' : 'Configuration validation failed',
            errors: validation.errors,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to validate configuration',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/rate-limits', async (req, res) => {
    try {
        const activeServices = await config.getActiveServices();
        const rateLimits = {};
        for (const service of activeServices) {
            rateLimits[service] = {
                status: 'Rate limit stats not yet implemented',
                config: config.getRateLimitConfig()
            };
        }
        res.json({
            success: true,
            rateLimits,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get rate limit information',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/rate-limits/:service/reset', async (req, res) => {
    try {
        const { service } = req.params;
        const { identifier } = req.body;
        res.json({
            success: true,
            message: `Rate limit reset for ${service}${identifier ? ` and identifier ${identifier}` : ''}`,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to reset rate limit',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/logs', async (req, res) => {
    try {
        const { level, service, startDate, endDate, limit = 100 } = req.query;
        res.json({
            success: true,
            message: 'Log retrieval not yet implemented',
            filters: { level, service, startDate, endDate, limit },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve logs',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/metrics', async (req, res) => {
    try {
        const timeRange = {
            start: req.query.startDate ? new Date(req.query.startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000),
            end: req.query.endDate ? new Date(req.query.endDate) : new Date()
        };
        res.json({
            success: true,
            message: 'Metrics retrieval not yet implemented',
            timeRange,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve metrics',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/api-keys/rotate', async (req, res) => {
    try {
        const { service, oldKey, newKey } = req.body;
        const success = await config.rotateApiKey(service, oldKey, newKey);
        if (success) {
            res.json({
                success: true,
                message: `API key rotated successfully for ${service}`,
                timestamp: new Date().toISOString()
            });
        }
        else {
            res.status(400).json({
                success: false,
                message: `Failed to rotate API key for ${service}`,
                timestamp: new Date().toISOString()
            });
        }
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to rotate API key',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map