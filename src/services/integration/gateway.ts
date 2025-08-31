import { Request, Response, NextFunction } from 'express';
import { CircuitBreakerImplementation } from './circuitBreaker';
import { RateLimiterImplementation } from './rateLimiter';
import { IntegrationLoggerImplementation } from './logger';
import { ConfigManagerImplementation } from './configManager';
import integrationConfig from '../../config/integration';
import { 
  IntegrationGateway, 
  IntegrationRequest, 
  IntegrationResponse, 
  AuthResult, 
  RateLimitResult, 
  CircuitState,
  CircuitBreaker 
} from './types';


export class IntegrationGatewayService implements IntegrationGateway {
  private circuitBreakers: Map<string, CircuitBreakerImplementation> = new Map();
  private rateLimiters: Map<string, RateLimiterImplementation> = new Map();
  private logger: IntegrationLoggerImplementation;
  private config: ConfigManagerImplementation;

  constructor() {
    this.logger = new IntegrationLoggerImplementation();
    this.config = new ConfigManagerImplementation();
    this.initializeCircuitBreakers();
    this.initializeRateLimiters();
  }

  private initializeCircuitBreakers(): void {
    const services = ['pacer', 'stateCourts', 'stripe', 'paypal', 'lexisNexis', 'westlaw', 'googleDrive', 'dropbox', 'twilio', 'sendGrid'];
    
    services.forEach(service => {
      const config = this.config.getServiceConfig(service);
      if (config?.enabled) {
        this.circuitBreakers.set(service, new CircuitBreakerImplementation(service));
      }
    });
  }

  private initializeRateLimiters(): void {
    const services = ['pacer', 'stateCourts', 'stripe', 'paypal', 'lexisNexis', 'westlaw', 'googleDrive', 'dropbox', 'twilio', 'sendGrid'];
    
    services.forEach(service => {
      const config = this.config.getServiceConfig(service);
      if (config?.enabled) {
        this.rateLimiters.set(service, new RateLimiterImplementation(service));
      }
    });
  }

  async authenticate(request: IntegrationRequest): Promise<AuthResult> {
    try {
      const apiKey = request.headers[integrationConfig.auth.apiKeyHeader];
      
      if (!apiKey) {
        return {
          success: false,
          error: 'API key required'
        };
      }

      // Validate API key against database
      const db = require('../../utils/database').Database;
      const database = new db();
      await database.connect();

      const apiKeyRecord = await database.client.apiKey.findUnique({
        where: { key: apiKey },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true
            }
          }
        }
      });

      await database.disconnect();

      if (!apiKeyRecord || !apiKeyRecord.isActive) {
        return {
          success: false,
          error: 'Invalid API key'
        };
      }

      if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
        return {
          success: false,
          error: 'API key expired'
        };
      }

      // Update last used timestamp
      const updateDb = new db();
      await updateDb.connect();
      await updateDb.client.apiKey.update({
        where: { id: apiKeyRecord.id },
        data: { lastUsedAt: new Date() }
      });
      await updateDb.disconnect();

      return {
        success: true,
        user: apiKeyRecord.user
      };

    } catch (error) {
      this.logger.error('Authentication failed', { error, requestId: request.id });
      return {
        success: false,
        error: 'Authentication service unavailable'
      };
    }
  }

  async authorize(request: IntegrationRequest, user: any): Promise<boolean> {
    try {
      const serviceConfig = this.config.getServiceConfig(request.service);
      if (!serviceConfig) {
        return false;
      }

      // Check if user has permission to access this service
      const db = require('../../utils/database').Database;
      const database = new db();
      await database.connect();

      const permission = await database.client.userPermission.findFirst({
        where: {
          userId: user.id,
          service: request.service,
          action: { in: ['read', 'write', 'admin'] }
        }
      });

      await database.disconnect();

      return !!permission;

    } catch (error) {
      this.logger.error('Authorization failed', { error, requestId: request.id, userId: user.id });
      return false;
    }
  }

  async rateLimit(request: IntegrationRequest): Promise<RateLimitResult> {
    const rateLimiter = this.rateLimiters.get(request.service);
    if (!rateLimiter) {
      return {
        allowed: true,
        remaining: Infinity,
        resetTime: new Date(Date.now() + 900000) // 15 minutes
      };
    }

    return rateLimiter.checkLimit(request.user?.id || request.headers['x-forwarded-for'] || 'anonymous');
  }

  circuitBreaker(service: string): CircuitBreaker {
    return this.circuitBreakers.get(service) || new CircuitBreakerImplementation(service);
  }

  async execute(request: IntegrationRequest): Promise<IntegrationResponse> {
    const startTime = Date.now();
    const responseId = this.generateId();

    try {
      // Log request start
      this.logger.info('Integration request started', {
        requestId: request.id,
        service: request.service,
        method: request.method,
        path: request.path,
        userId: request.user?.id
      });

      // Authenticate
      const authResult = await this.authenticate(request);
      if (!authResult.success) {
        return {
          id: responseId,
          status: 401,
          headers: {},
          body: {
            success: false,
            message: authResult.error || 'Authentication failed'
          },
          timestamp: new Date(),
          duration: Date.now() - startTime,
          service: request.service
        };
      }

      // Authorize
      const isAuthorized = await this.authorize(request, authResult.user);
      if (!isAuthorized) {
        return {
          id: responseId,
          status: 403,
          headers: {},
          body: {
            success: false,
            message: 'Insufficient permissions'
          },
          timestamp: new Date(),
          duration: Date.now() - startTime,
          service: request.service
        };
      }

      // Rate limit
      const rateLimitResult = await this.rateLimit(request);
      if (!rateLimitResult.allowed) {
        return {
          id: responseId,
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toISOString()
          },
          body: {
            success: false,
            message: rateLimitResult.error || 'Rate limit exceeded'
          },
          timestamp: new Date(),
          duration: Date.now() - startTime,
          service: request.service
        };
      }

      // Execute with circuit breaker
      const circuitBreaker = this.circuitBreaker(request.service);
      const response = await circuitBreaker.execute(async () => {
        return this.executeServiceRequest(request, authResult.user);
      });

      // Log successful response
      this.logger.info('Integration request completed', {
        requestId: request.id,
        responseId,
        service: request.service,
        status: response.status,
        duration: Date.now() - startTime,
        userId: request.user?.id
      });

      return {
        ...response,
        id: responseId,
        timestamp: new Date(),
        duration: Date.now() - startTime,
        service: request.service
      };

    } catch (error) {
      // Log error
      this.logger.error('Integration request failed', {
        requestId: request.id,
        responseId,
        service: request.service,
        error,
        duration: Date.now() - startTime,
        userId: request.user?.id
      });

      return {
        id: responseId,
        status: 500,
        headers: {},
        body: {
          success: false,
          message: 'Internal server error',
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date(),
        duration: Date.now() - startTime,
        service: request.service
      };
    }
  }

  private async executeServiceRequest(request: IntegrationRequest, user: any): Promise<Omit<IntegrationResponse, 'id' | 'timestamp' | 'duration' | 'service'>> {
    // This will be implemented by specific service integrations
    throw new Error('Service request execution not implemented');
  }

  private generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}