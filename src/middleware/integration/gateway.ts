import { Request, Response, NextFunction } from 'express';
import { IntegrationGatewayService } from '../../services/integration/gateway';
import { IntegrationRequest } from '../../services/integration/types';

export interface IntegrationRequestExtended extends Request {
  integrationRequest?: IntegrationRequest;
}

export class IntegrationMiddleware {
  private gateway: IntegrationGatewayService;

  constructor() {
    this.gateway = new IntegrationGatewayService();
  }

  handleIntegration = (service: string) => {
    return async (req: IntegrationRequestExtended, res: Response, next: NextFunction) => {
      try {
        const integrationRequest: IntegrationRequest = {
          id: this.generateRequestId(),
          method: req.method,
          path: req.path,
          headers: this.sanitizeHeaders(req.headers),
          body: req.body,
          query: req.query as Record<string, string>,
          user: req.user,
          timestamp: new Date(),
          service
        };

        req.integrationRequest = integrationRequest;

        // Execute the integration request
        const response = await this.gateway.execute(integrationRequest);

        // Set response headers
        Object.entries(response.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });

        // Set rate limit headers if available
        if (response.headers['X-RateLimit-Limit']) {
          res.setHeader('X-RateLimit-Limit', response.headers['X-RateLimit-Limit']);
          res.setHeader('X-RateLimit-Remaining', response.headers['X-RateLimit-Remaining']);
          res.setHeader('X-RateLimit-Reset', response.headers['X-RateLimit-Reset']);
        }

        // Set standard headers
        res.setHeader('X-Request-ID', response.id);
        res.setHeader('X-Service', response.service);
        res.setHeader('X-Response-Time', response.duration.toString());

        res.status(response.status).json(response.body);

      } catch (error) {
        next(error);
      }
    };
  };

  validateApiKey = (req: IntegrationRequestExtended, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API key required'
      });
    }

    // Add API key validation logic here
    next();
  };

  validateServiceAccess = (service: string) => {
    return (req: IntegrationRequestExtended, res: Response, next: NextFunction) => {
      // Check if user has access to the specific service
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Add service access validation logic here
      next();
    };
  };

  logRequest = (req: IntegrationRequestExtended, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      // Log the request/response cycle
      if (req.integrationRequest) {
        console.log(`Integration Request: ${req.integrationRequest.id} - ${req.integrationRequest.service} - ${duration}ms`);
      }
    });

    next();
  };

  private generateRequestId(): string {
    return `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeHeaders(headers: any): Record<string, string> {
    const sanitized: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === 'string') {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

export const integrationMiddleware = new IntegrationMiddleware();