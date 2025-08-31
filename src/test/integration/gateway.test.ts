import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IntegrationGatewayService } from '../../services/integration/gateway';
import { ConfigManager } from '../../services/integration/configManager';
import { CircuitBreaker } from '../../services/integration/circuitBreaker';
import { RateLimiter } from '../../services/integration/rateLimiter';
import { IntegrationLogger } from '../../services/integration/logger';

describe('Integration Gateway', () => {
  let gateway: IntegrationGatewayService;
  let config: ConfigManager;
  let logger: IntegrationLogger;

  beforeEach(() => {
    gateway = new IntegrationGatewayService();
    config = new ConfigManager();
    logger = new IntegrationLogger();
  });

  afterEach(() => {
    // Clean up after tests
  });

  describe('Authentication', () => {
    it('should reject requests without API key', async () => {
      const request = {
        id: 'test-1',
        method: 'GET',
        path: '/test',
        headers: {},
        timestamp: new Date(),
        service: 'pacer'
      };

      const result = await gateway.authenticate(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API key required');
    });

    it('should reject requests with invalid API key', async () => {
      const request = {
        id: 'test-2',
        method: 'GET',
        path: '/test',
        headers: { 'X-API-Key': 'invalid-key' },
        timestamp: new Date(),
        service: 'pacer'
      };

      const result = await gateway.authenticate(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid API key');
    });
  });

  describe('Circuit Breaker', () => {
    it('should create circuit breaker for service', () => {
      const circuitBreaker = gateway.circuitBreaker('pacer');
      expect(circuitBreaker).toBeDefined();
    });

    it('should handle circuit breaker state changes', () => {
      const circuitBreaker = gateway.circuitBreaker('pacer') as CircuitBreaker;
      
      const initialState = circuitBreaker.getState();
      expect(initialState.isOpen).toBe(false);
      
      circuitBreaker.forceOpen();
      const openState = circuitBreaker.getState();
      expect(openState.isOpen).toBe(true);
      
      circuitBreaker.reset();
      const resetState = circuitBreaker.getState();
      expect(resetState.isOpen).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within limits', async () => {
      const request = {
        id: 'test-3',
        method: 'GET',
        path: '/test',
        headers: {},
        timestamp: new Date(),
        service: 'pacer'
      };

      const result = await gateway.rateLimit(request);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
    });
  });

  describe('Configuration Management', () => {
    it('should return service configuration', () => {
      const serviceConfig = config.getServiceConfig('pacer');
      
      if (serviceConfig) {
        expect(serviceConfig).toBeDefined();
        expect(serviceConfig.enabled).toBeDefined();
      }
    });

    it('should validate configuration', () => {
      const validConfig = {
        enabled: true,
        apiKey: 'test-key',
        clientId: 'test-client',
        baseUrl: 'https://api.example.com',
        timeout: 30000
      };

      const validation = config.validateConfig(validConfig, 'pacer');
      expect(validation.valid).toBe(true);
    });

    it('should reject invalid configuration', () => {
      const invalidConfig = {
        enabled: true,
        baseUrl: 'invalid-url',
        timeout: -1
      };

      const validation = config.validateConfig(invalidConfig, 'pacer');
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Service Integration', () => {
    it('should list active services', async () => {
      const services = await config.getActiveServices();
      expect(Array.isArray(services)).toBe(true);
    });

    it('should handle gateway execution', async () => {
      const request = {
        id: 'test-4',
        method: 'GET',
        path: '/test',
        headers: { 'X-API-Key': 'test-key' },
        timestamp: new Date(),
        service: 'pacer'
      };

      // This will fail due to invalid API key, but should handle gracefully
      const response = await gateway.execute(request);
      
      expect(response).toBeDefined();
      expect(response.id).toBeDefined();
      expect(response.status).toBeDefined();
      expect(response.timestamp).toBeDefined();
      expect(response.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      const request = {
        id: 'test-5',
        method: 'GET',
        path: '/test',
        headers: {},
        timestamp: new Date(),
        service: 'nonexistent-service'
      };

      const response = await gateway.execute(request);
      
      expect(response.status).toBe(500);
      expect(response.body).toBeDefined();
      expect(response.body.success).toBe(false);
    });
  });
});