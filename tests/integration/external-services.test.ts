import { PACERService } from '../../src/integrations/courts/PACERService';
import { StateCourtService } from '../../src/integrations/courts/StateCourtService';
import { StripeService } from '../../src/integrations/payments/StripeService';
import { PayPalService } from '../../src/integrations/payments/PayPalService';
import { LexisNexisService } from '../../src/integrations/legal/LexisNexisService';
import { WestlawService } from '../../src/integrations/legal/WestlawService';
import { ExternalServiceClient } from '../../src/services/external/ExternalServiceClient';
import { WebhookHandler } from '../../src/webhooks/WebhookHandler';

// Mock the base external service to avoid actual API calls
jest.mock('../../src/services/external/BaseExternalService');

describe('External Service Integrations', () => {
  let pacerService: PACERService;
  let stateCourtService: StateCourtService;
  let stripeService: StripeService;
  let paypalService: PayPalService;
  let lexisNexisService: LexisNexisService;
  let westlawService: WestlawService;
  let externalClient: ExternalServiceClient;
  let webhookHandler: WebhookHandler;

  beforeEach(() => {
    pacerService = new PACERService();
    stateCourtService = new StateCourtService();
    stripeService = new StripeService();
    paypalService = new PayPalService();
    lexisNexisService = new LexisNexisService();
    westlawService = new WestlawService();
    externalClient = new ExternalServiceClient();
    webhookHandler = new WebhookHandler();
  });

  describe('PACER Service', () => {
    test('should initialize with correct configuration', () => {
      expect(pacerService).toBeDefined();
    });

    test('should file document successfully', async () => {
      const mockDocument = {
        id: 'doc-123',
        title: 'Test Document',
        content: 'Document content',
        documentType: 'motion',
        caseId: 'case-456',
        parties: [],
        attorneys: [],
        metadata: {
          pageCount: 5,
          fileSize: 1024,
          format: 'pdf',
          court: {
            name: 'Test Court',
            jurisdiction: 'US-DC',
            level: 'federal' as const,
            location: 'Washington DC',
            courtCode: 'DC'
          },
          tags: ['test'],
          confidential: false
        }
      };

      const result = await pacerService.fileDocument(mockDocument);
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    test('should handle document filing errors', async () => {
      const mockDocument = {
        id: 'doc-123',
        title: 'Test Document',
        content: 'Document content',
        documentType: 'motion',
        caseId: 'case-456',
        parties: [],
        attorneys: [],
        metadata: {
          pageCount: 5,
          fileSize: 1024,
          format: 'pdf',
          court: {
            name: 'Test Court',
            jurisdiction: 'US-DC',
            level: 'federal' as const,
            location: 'Washington DC',
            courtCode: 'DC'
          },
          tags: ['test'],
          confidential: false
        }
      };

      // Mock the makeRequest method to throw an error
      jest.spyOn(pacerService as any, 'makeRequest').mockRejectedValue(new Error('API Error'));

      const result = await pacerService.fileDocument(mockDocument);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    test('should check case status', async () => {
      const caseId = 'case-456';
      const result = await pacerService.checkStatus(caseId);
      expect(result).toBeDefined();
      expect(result.caseId).toBe(caseId);
    });

    test('should retrieve case documents', async () => {
      const caseId = 'case-456';
      const result = await pacerService.retrieveDocuments(caseId);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test('should schedule hearing', async () => {
      const caseId = 'case-456';
      const mockHearing = {
        date: new Date(),
        time: '10:00',
        type: 'motion' as const,
        location: 'Courtroom 1',
        purpose: 'Motion hearing',
        duration: 60,
        participants: []
      };

      const result = await pacerService.scheduleHearing(caseId, mockHearing);
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    test('should test connection', async () => {
      const result = await pacerService.testConnection();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('State Court Service', () => {
    test('should initialize with correct configuration', () => {
      expect(stateCourtService).toBeDefined();
    });

    test('should validate supported states', async () => {
      const mockDocument = {
        id: 'doc-123',
        title: 'Test Document',
        content: 'Document content',
        documentType: 'motion',
        caseId: 'case-456',
        parties: [],
        attorneys: [],
        metadata: {
          pageCount: 5,
          fileSize: 1024,
          format: 'pdf',
          court: {
            name: 'Test Court',
            jurisdiction: 'NY-STATE',
            level: 'state' as const,
            location: 'New York',
            courtCode: 'NY'
          },
          tags: ['test'],
          confidential: false
        }
      };

      const result = await stateCourtService.fileDocument(mockDocument);
      expect(result).toBeDefined();
    });

    test('should reject unsupported states', async () => {
      const mockDocument = {
        id: 'doc-123',
        title: 'Test Document',
        content: 'Document content',
        documentType: 'motion',
        caseId: 'case-456',
        parties: [],
        attorneys: [],
        metadata: {
          pageCount: 5,
          fileSize: 1024,
          format: 'pdf',
          court: {
            name: 'Test Court',
            jurisdiction: 'INVALID-STATE',
            level: 'state' as const,
            location: 'Invalid',
            courtCode: 'XX'
          },
          tags: ['test'],
          confidential: false
        }
      };

      await expect(stateCourtService.fileDocument(mockDocument)).rejects.toThrow('not supported');
    });

    test('should get case information by state and case number', async () => {
      const result = await stateCourtService.getCaseInformation('CA', '12345');
      expect(result).toBeDefined();
    });

    test('should search cases in specific state', async () => {
      const query = {
        caseNumber: '12345',
        partyName: 'John Doe'
      };

      const result = await stateCourtService.searchCases('CA', query);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test('should get attorney information', async () => {
      const result = await stateCourtService.getAttorneyInformation('CA', '123456');
      expect(result).toBeDefined();
    });

    test('should get filing fees', async () => {
      const result = await stateCourtService.getFilingFees('CA', 'superior', 'civil');
      expect(typeof result).toBe('number');
    });
  });

  describe('Stripe Service', () => {
    test('should initialize with correct configuration', () => {
      expect(stripeService).toBeDefined();
    });

    test('should process payment successfully', async () => {
      const mockPayment = {
        amount: 100.00,
        currency: 'USD',
        paymentMethod: {
          type: 'card' as const,
          details: {
            card: {
              number: '4242424242424242',
              expMonth: 12,
              expYear: 2025,
              cvv: '123',
              name: 'John Doe'
            }
          }
        },
        description: 'Test payment'
      };

      const result = await stripeService.processPayment(mockPayment);
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.amount).toBe(mockPayment.amount);
      expect(result.currency).toBe(mockPayment.currency);
    });

    test('should handle payment processing errors', async () => {
      const mockPayment = {
        amount: 100.00,
        currency: 'USD',
        paymentMethod: {
          type: 'card' as const,
          details: {
            card: {
              number: 'invalid',
              expMonth: 12,
              expYear: 2025,
              cvv: '123',
              name: 'John Doe'
            }
          }
        },
        description: 'Test payment'
      };

      jest.spyOn(stripeService as any, 'makeRequest').mockRejectedValue(new Error('Card declined'));

      const result = await stripeService.processPayment(mockPayment);
      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
    });

    test('should process refund', async () => {
      const mockRefund = {
        paymentId: 'pay_123',
        amount: 50.00,
        reason: 'Customer request'
      };

      const result = await stripeService.refundPayment(mockRefund);
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    test('should create subscription', async () => {
      const mockSubscription = {
        customerId: 'cus_123',
        planId: 'price_123',
        amount: 29.99,
        currency: 'USD',
        interval: 'month' as const
      };

      const result = await stripeService.createSubscription(mockSubscription);
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    test('should handle webhook events', async () => {
      const mockWebhook = {
        id: 'wh_123',
        type: 'payment_intent.succeeded',
        timestamp: new Date(),
        data: {
          id: 'pi_123',
          amount: 10000,
          currency: 'usd',
          status: 'succeeded'
        }
      };

      const result = await stripeService.handleWebhook(mockWebhook);
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    test('should test connection', async () => {
      const result = await stripeService.testConnection();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('PayPal Service', () => {
    test('should initialize with correct configuration', () => {
      expect(paypalService).toBeDefined();
    });

    test('should process payment successfully', async () => {
      const mockPayment = {
        amount: 100.00,
        currency: 'USD',
        paymentMethod: {
          type: 'paypal' as const,
          details: {}
        },
        description: 'Test payment'
      };

      const result = await paypalService.processPayment(mockPayment);
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    test('should handle PayPal-specific errors', async () => {
      const mockPayment = {
        amount: 100.00,
        currency: 'USD',
        paymentMethod: {
          type: 'paypal' as const,
          details: {}
        },
        description: 'Test payment'
      };

      jest.spyOn(paypalService as any, 'makeRequest').mockRejectedValue(new Error('PayPal API Error'));

      const result = await paypalService.processPayment(mockPayment);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    test('should create order', async () => {
      const orderData = {
        amount: 100.00,
        currency: 'USD',
        description: 'Test order',
        returnUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel'
      };

      const result = await paypalService.createOrder(orderData);
      expect(result).toBeDefined();
    });

    test('should capture payment', async () => {
      const orderId = 'order_123';
      const result = await paypalService.capturePayment(orderId);
      expect(result).toBeDefined();
    });

    test('should get access token', async () => {
      const result = await paypalService.getAccessToken();
      expect(typeof result).toBe('string');
    });
  });

  describe('LexisNexis Service', () => {
    test('should initialize with correct configuration', () => {
      expect(lexisNexisService).toBeDefined();
    });

    test('should search cases', async () => {
      const mockQuery = {
        query: 'contract dispute',
        jurisdiction: 'CA',
        limit: 10
      };

      const result = await lexisNexisService.searchCases(mockQuery);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test('should get statutes by jurisdiction', async () => {
      const result = await lexisNexisService.getStatutes('CA');
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test('should search regulations', async () => {
      const result = await lexisNexisService.searchRegulations('environmental protection');
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test('should analyze document', async () => {
      const mockDocument = {
        textContent: 'This is a legal document for analysis.',
        title: 'Test Document',
        type: 'contract'
      };

      const result = await lexisNexisService.analyzeDocument(mockDocument as any);
      expect(result).toBeDefined();
      expect(result.issues).toBeDefined();
      expect(result.citations).toBeDefined();
    });

    test('should get case by citation', async () => {
      const citation = '123 F.3d 456';
      const result = await lexisNexisService.getCaseByCitation(citation);
      expect(result).toBeDefined();
      expect(result.citation).toBe(citation);
    });

    test('should search Shepardized cases', async () => {
      const citation = '123 F.3d 456';
      const result = await (lexisNexisService as any).searchShepardizedCases(citation);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test('should get practice areas', async () => {
      const result = await lexisNexisService.getPracticeAreas();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Westlaw Service', () => {
    test('should initialize with correct configuration', () => {
      expect(westlawService).toBeDefined();
    });

    test('should search cases', async () => {
      const mockQuery = {
        query: 'breach of contract',
        jurisdiction: 'NY',
        limit: 10
      };

      const result = await westlawService.searchCases(mockQuery);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test('should get statutes by jurisdiction', async () => {
      const result = await westlawService.getStatutes('NY');
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test('should search regulations', async () => {
      const result = await westlawService.searchRegulations('securities regulation');
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test('should analyze document', async () => {
      const mockDocument = {
        textContent: 'This document contains legal analysis.',
        title: 'Legal Analysis',
        type: 'brief'
      };

      const result = await westlawService.analyzeDocument(mockDocument as any);
      expect(result).toBeDefined();
      expect(result.issues).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    test('should get key citations', async () => {
      const caseId = 'case_123';
      const result = await westlawService.getKeyCitations(caseId);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test('should get headnotes', async () => {
      const caseId = 'case_123';
      const result = await westlawService.getHeadnotes(caseId);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test('should search key numbers', async () => {
      const keyNumber = '110';
      const result = await westlawService.searchKeyNumbers(keyNumber);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test('should get jurisdictions', async () => {
      const result = await westlawService.getJurisdictions();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('External Service Client', () => {
    test('should initialize with all services', () => {
      expect(externalClient).toBeDefined();
    });

    test('should file document through court service', async () => {
      const mockDocument = {
        id: 'doc-123',
        title: 'Test Document',
        content: 'Document content',
        documentType: 'motion',
        caseId: 'case-456',
        parties: [],
        attorneys: [],
        metadata: {
          pageCount: 5,
          fileSize: 1024,
          format: 'pdf',
          court: {
            name: 'Test Court',
            jurisdiction: 'US-DC',
            level: 'federal' as const,
            location: 'Washington DC',
            courtCode: 'DC'
          },
          tags: ['test'],
          confidential: false
        }
      };

      const result = await externalClient.fileDocument('pacer', mockDocument);
      expect(result).toBeDefined();
    });

    test('should process payment through payment processor', async () => {
      const mockPayment = {
        amount: 100.00,
        currency: 'USD',
        paymentMethod: {
          type: 'card' as const,
          details: {
            card: {
              number: '4242424242424242',
              expMonth: 12,
              expYear: 2025,
              cvv: '123',
              name: 'John Doe'
            }
          }
        },
        description: 'Test payment'
      };

      const result = await externalClient.processPayment('stripe', mockPayment);
      expect(result).toBeDefined();
    });

    test('should search cases through legal research service', async () => {
      const mockQuery = {
        query: 'contract dispute',
        jurisdiction: 'CA',
        limit: 10
      };

      const result = await externalClient.searchCases('lexisnexis', mockQuery);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test('should handle webhook through webhook handler', async () => {
      const mockWebhook = {
        id: 'wh_123',
        type: 'stripe.payment_intent.succeeded',
        timestamp: new Date(),
        data: {
          id: 'pi_123',
          amount: 10000,
          currency: 'usd',
          status: 'succeeded'
        }
      };

      const result = await externalClient.handleWebhook(mockWebhook);
      expect(result).toBeDefined();
    });

    test('should test all services', async () => {
      const results = await externalClient.testAllServices();
      expect(results).toBeDefined();
      expect(typeof results).toBe('object');
      expect(results.pacer).toBeDefined();
      expect(results.stripe).toBeDefined();
      expect(results.lexisNexis).toBeDefined();
    });
  });

  describe('Webhook Handler', () => {
    test('should initialize with all services', () => {
      expect(webhookHandler).toBeDefined();
    });

    test('should handle webhook successfully', async () => {
      const mockWebhook = {
        id: 'wh_123',
        type: 'stripe.payment_intent.succeeded',
        timestamp: new Date(),
        data: {
          id: 'pi_123',
          amount: 10000,
          currency: 'usd',
          status: 'succeeded'
        }
      };

      const result = await webhookHandler.handleWebhook(mockWebhook);
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    test('should handle invalid webhook signature', async () => {
      const mockWebhook = {
        id: 'wh_123',
        type: 'stripe.payment_intent.succeeded',
        timestamp: new Date(),
        data: {
          id: 'pi_123',
          amount: 10000,
          currency: 'usd',
          status: 'succeeded'
        },
        signature: 'invalid_signature'
      };

      // Mock the verifyWebhookSignature method to return false
      jest.spyOn(webhookHandler as any, 'verifyWebhookSignature').mockReturnValue(false);

      const result = await webhookHandler.handleWebhook(mockWebhook);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    test('should register webhook', async () => {
      const result = await webhookHandler.registerWebhook('stripe', 'https://example.com/webhook', ['payment_intent.succeeded']);
      expect(typeof result).toBe('boolean');
    });

    test('should unregister webhook', async () => {
      const result = await webhookHandler.unregisterWebhook('stripe', 'wh_123');
      expect(typeof result).toBe('boolean');
    });

    test('should list webhooks', async () => {
      const result = await webhookHandler.listWebhooks('stripe');
      expect(Array.isArray(result)).toBe(true);
    });

    test('should test webhook', async () => {
      const result = await webhookHandler.testWebhook('stripe', 'wh_123');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      jest.spyOn(pacerService as any, 'makeRequest').mockRejectedValue(new Error('Network error'));

      const mockDocument = {
        id: 'doc-123',
        title: 'Test Document',
        content: 'Document content',
        documentType: 'motion',
        caseId: 'case-456',
        parties: [],
        attorneys: [],
        metadata: {
          pageCount: 5,
          fileSize: 1024,
          format: 'pdf',
          court: {
            name: 'Test Court',
            jurisdiction: 'US-DC',
            level: 'federal' as const,
            location: 'Washington DC',
            courtCode: 'DC'
          },
          tags: ['test'],
          confidential: false
        }
      };

      await expect(pacerService.fileDocument(mockDocument)).resolves.not.toThrow();
      const result = await pacerService.fileDocument(mockDocument);
      expect(result.success).toBe(false);
    });

    test('should handle timeout errors', async () => {
      jest.spyOn(stripeService as any, 'makeRequest').mockRejectedValue(new Error('Request timeout'));

      const mockPayment = {
        amount: 100.00,
        currency: 'USD',
        paymentMethod: {
          type: 'card' as const,
          details: {
            card: {
              number: '4242424242424242',
              expMonth: 12,
              expYear: 2025,
              cvv: '123',
              name: 'John Doe'
            }
          }
        },
        description: 'Test payment'
      };

      const result = await stripeService.processPayment(mockPayment);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    test('should handle authentication errors', async () => {
      jest.spyOn(lexisNexisService as any, 'makeRequest').mockRejectedValue(new Error('Authentication failed'));

      const mockQuery = {
        query: 'test query',
        jurisdiction: 'CA',
        limit: 10
      };

      await expect(lexisNexisService.searchCases(mockQuery)).rejects.toThrow();
    });
  });

  describe('Integration Service Factory', () => {
    test('should create PACER service', () => {
      const config = {
        enabled: true,
        baseUrl: 'https://pacer.uscourts.gov',
        timeout: 30000,
        retries: 3,
        authentication: { type: 'API_KEY' as const, credentials: {} },
        rateLimit: { enabled: false, windowMs: 900000, max: 1000 },
        circuitBreaker: { enabled: false, timeout: 30000, errorThresholdPercentage: 50, resetTimeout: 30000 },
        cache: { enabled: false, ttl: 3600, maxSize: 1000, strategy: 'LRU' as const }
      };

      const service = require('../../src/services/integration').IntegrationServiceFactory.createService('pacer', config);
      expect(service).toBeDefined();
    });

    test('should create Stripe service', () => {
      const config = {
        enabled: true,
        baseUrl: 'https://api.stripe.com',
        timeout: 30000,
        retries: 3,
        authentication: { type: 'API_KEY' as const, credentials: {} },
        rateLimit: { enabled: false, windowMs: 900000, max: 1000 },
        circuitBreaker: { enabled: false, timeout: 30000, errorThresholdPercentage: 50, resetTimeout: 30000 },
        cache: { enabled: false, ttl: 3600, maxSize: 1000, strategy: 'LRU' as const }
      };

      const service = require('../../src/services/integration').IntegrationServiceFactory.createService('stripe', config);
      expect(service).toBeDefined();
    });

    test('should throw error for unknown service type', () => {
      const config = {
        enabled: true,
        baseUrl: 'https://api.example.com',
        timeout: 30000,
        retries: 3,
        authentication: { type: 'API_KEY' as const, credentials: {} },
        rateLimit: { enabled: false, windowMs: 900000, max: 1000 },
        circuitBreaker: { enabled: false, timeout: 30000, errorThresholdPercentage: 50, resetTimeout: 30000 },
        cache: { enabled: false, ttl: 3600, maxSize: 1000, strategy: 'LRU' as const }
      };

      expect(() => {
        require('../../src/services/integration').IntegrationServiceFactory.createService('unknown', config);
      }).toThrow('Unknown service type');
    });
  });
});