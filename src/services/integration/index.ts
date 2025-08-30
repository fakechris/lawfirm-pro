export { IntegrationGateway } from './IntegrationGateway';
export { IntegrationOrchestrator } from './IntegrationOrchestrator';
export { IntegrationMonitor } from './IntegrationMonitor';

// Re-export types
export type {
  IntegrationRequest,
  IntegrationResponse,
  AuthenticationResult,
  RateLimitResult
} from './IntegrationGateway';

export type {
  WorkflowContext,
  WorkflowResult,
  ServiceCall,
  CoordinationResult,
  RetryConfig,
  TransactionalOperation,
  TransactionResult
} from './IntegrationOrchestrator';

export type {
  IntegrationMetric,
  IntegrationEvent,
  HealthCheckResult,
  SystemHealthResult,
  Alert,
  Report,
  HealthStatus
} from './IntegrationMonitor';

// Integration service interfaces
export interface BaseIntegrationService {
  getServiceInfo(): Promise<ServiceInfo>;
  healthCheck(): Promise<HealthStatus>;
  getConfiguration(): Promise<ServiceConfiguration>;
  updateConfiguration(config: ServiceConfiguration): Promise<void>;
  executeOperation(operation: string, params: any): Promise<ServiceResult>;
}

export interface ServiceInfo {
  name: string;
  version: string;
  description: string;
  baseUrl: string;
  documentation?: string;
  supportedOperations: string[];
  capabilities: string[];
}

export interface ServiceConfiguration {
  enabled: boolean;
  baseUrl: string;
  timeout: number;
  retries: number;
  authentication: AuthenticationConfig;
  rateLimit: RateLimitConfig;
  circuitBreaker: CircuitBreakerConfig;
  cache: CacheConfig;
}

export interface AuthenticationConfig {
  type: 'API_KEY' | 'OAUTH2' | 'BASIC' | 'BEARER';
  credentials: Record<string, string>;
  tokenUrl?: string;
  scopes?: string[];
}

export interface RateLimitConfig {
  enabled: boolean;
  windowMs: number;
  max: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  timeout: number;
  errorThresholdPercentage: number;
  resetTimeout: number;
  monitoringPeriod?: number;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  strategy: 'LRU' | 'FIFO' | 'TTL';
}

export interface ServiceResult {
  success: boolean;
  data?: any;
  error?: string;
  statusCode?: number;
  headers?: Record<string, string>;
  metadata?: Record<string, any>;
}

// Factory function for creating integration services
export class IntegrationServiceFactory {
  static createService(serviceType: string, config: ServiceConfiguration): BaseIntegrationService {
    switch (serviceType) {
      case 'pacer':
        return new PACERService(config);
      case 'stripe':
        return new StripeService(config);
      case 'paypal':
        return new PayPalService(config);
      case 'lexisnexis':
        return new LexisNexisService(config);
      case 'westlaw':
        return new WestlawService(config);
      default:
        throw new Error(`Unknown service type: ${serviceType}`);
    }
  }
}

// Placeholder service implementations
class PACERService implements BaseIntegrationService {
  constructor(private config: ServiceConfiguration) {}

  async getServiceInfo(): Promise<ServiceInfo> {
    return {
      name: 'PACER',
      version: '1.0.0',
      description: 'Public Access to Court Electronic Records',
      baseUrl: 'https://pacer.uscourts.gov',
      documentation: 'https://pacer.uscourts.gov/services',
      supportedOperations: ['getCaseInfo', 'searchCases', 'getDocument', 'fileDocument'],
      capabilities: ['case_search', 'document_retrieval', 'electronic_filing']
    };
  }

  async healthCheck(): Promise<HealthStatus> {
    // Placeholder implementation
    return {
      status: 'HEALTHY',
      timestamp: new Date(),
      checks: [],
      metrics: {
        requestCount: 0,
        errorCount: 0,
        averageResponseTime: 0,
        lastRequestTime: new Date(),
        uptime: 0
      }
    };
  }

  async getConfiguration(): Promise<ServiceConfiguration> {
    return this.config;
  }

  async updateConfiguration(config: ServiceConfiguration): Promise<void> {
    this.config = config;
  }

  async executeOperation(operation: string, params: any): Promise<ServiceResult> {
    // Placeholder implementation
    return {
      success: true,
      data: { message: `PACER ${operation} executed successfully` },
      metadata: { operation, params }
    };
  }
}

class StripeService implements BaseIntegrationService {
  constructor(private config: ServiceConfiguration) {}

  async getServiceInfo(): Promise<ServiceInfo> {
    return {
      name: 'Stripe',
      version: '1.0.0',
      description: 'Payment processing platform',
      baseUrl: 'https://api.stripe.com',
      documentation: 'https://stripe.com/docs/api',
      supportedOperations: ['processPayment', 'processRefund', 'createSubscription', 'manageInvoices'],
      capabilities: ['payment_processing', 'subscription_management', 'financial_reporting']
    };
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      status: 'HEALTHY',
      timestamp: new Date(),
      checks: [],
      metrics: {
        requestCount: 0,
        errorCount: 0,
        averageResponseTime: 0,
        lastRequestTime: new Date(),
        uptime: 0
      }
    };
  }

  async getConfiguration(): Promise<ServiceConfiguration> {
    return this.config;
  }

  async updateConfiguration(config: ServiceConfiguration): Promise<void> {
    this.config = config;
  }

  async executeOperation(operation: string, params: any): Promise<ServiceResult> {
    return {
      success: true,
      data: { message: `Stripe ${operation} executed successfully` },
      metadata: { operation, params }
    };
  }
}

class PayPalService implements BaseIntegrationService {
  constructor(private config: ServiceConfiguration) {}

  async getServiceInfo(): Promise<ServiceInfo> {
    return {
      name: 'PayPal',
      version: '1.0.0',
      description: 'Online payment system',
      baseUrl: 'https://api.paypal.com',
      documentation: 'https://developer.paypal.com/docs/api',
      supportedOperations: ['processPayment', 'processRefund', 'createSubscription', 'manageInvoices'],
      capabilities: ['payment_processing', 'subscription_management', 'international_payments']
    };
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      status: 'HEALTHY',
      timestamp: new Date(),
      checks: [],
      metrics: {
        requestCount: 0,
        errorCount: 0,
        averageResponseTime: 0,
        lastRequestTime: new Date(),
        uptime: 0
      }
    };
  }

  async getConfiguration(): Promise<ServiceConfiguration> {
    return this.config;
  }

  async updateConfiguration(config: ServiceConfiguration): Promise<void> {
    this.config = config;
  }

  async executeOperation(operation: string, params: any): Promise<ServiceResult> {
    return {
      success: true,
      data: { message: `PayPal ${operation} executed successfully` },
      metadata: { operation, params }
    };
  }
}

class LexisNexisService implements BaseIntegrationService {
  constructor(private config: ServiceConfiguration) {}

  async getServiceInfo(): Promise<ServiceInfo> {
    return {
      name: 'LexisNexis',
      version: '1.0.0',
      description: 'Legal research and analytics platform',
      baseUrl: 'https://api.lexisnexis.com',
      documentation: 'https://developer.lexisnexis.com',
      supportedOperations: ['searchCases', 'searchStatutes', 'searchRegulations', 'getAnalytics'],
      capabilities: ['legal_research', 'case_analysis', 'statute_lookup', 'regulatory_compliance']
    };
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      status: 'HEALTHY',
      timestamp: new Date(),
      checks: [],
      metrics: {
        requestCount: 0,
        errorCount: 0,
        averageResponseTime: 0,
        lastRequestTime: new Date(),
        uptime: 0
      }
    };
  }

  async getConfiguration(): Promise<ServiceConfiguration> {
    return this.config;
  }

  async updateConfiguration(config: ServiceConfiguration): Promise<void> {
    this.config = config;
  }

  async executeOperation(operation: string, params: any): Promise<ServiceResult> {
    return {
      success: true,
      data: { message: `LexisNexis ${operation} executed successfully` },
      metadata: { operation, params }
    };
  }
}

class WestlawService implements BaseIntegrationService {
  constructor(private config: ServiceConfiguration) {}

  async getServiceInfo(): Promise<ServiceInfo> {
    return {
      name: 'Westlaw',
      version: '1.0.0',
      description: 'Legal research platform',
      baseUrl: 'https://api.westlaw.com',
      documentation: 'https://developers.westlaw.com',
      supportedOperations: ['searchCases', 'searchStatutes', 'searchRegulations', 'getCitations'],
      capabilities: ['legal_research', 'case_law', 'statutory_research', 'regulatory_research']
    };
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      status: 'HEALTHY',
      timestamp: new Date(),
      checks: [],
      metrics: {
        requestCount: 0,
        errorCount: 0,
        averageResponseTime: 0,
        lastRequestTime: new Date(),
        uptime: 0
      }
    };
  }

  async getConfiguration(): Promise<ServiceConfiguration> {
    return this.config;
  }

  async updateConfiguration(config: ServiceConfiguration): Promise<void> {
    this.config = config;
  }

  async executeOperation(operation: string, params: any): Promise<ServiceResult> {
    return {
      success: true,
      data: { message: `Westlaw ${operation} executed successfully` },
      metadata: { operation, params }
    };
  }
}