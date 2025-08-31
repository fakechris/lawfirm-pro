import { Request, Response, NextFunction } from 'express';
import { ContentValidationUtils } from '../../utils/knowledge-base/content';

export class ContentMiddleware {
  // Content validation middleware
  static validateContent(req: Request, res: Response, next: NextFunction) {
    const validation = ContentValidationUtils.validateContent(req.body);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }

    // Additional content size validation
    if (req.body.content) {
      const sizeValidation = ContentValidationUtils.validateContentSize(req.body.content);
      if (!sizeValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Content size validation failed',
          details: sizeValidation.errors
        });
      }
    }

    // Tag validation
    if (req.body.tags) {
      const tagValidation = ContentValidationUtils.validateTags(req.body.tags);
      if (!tagValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Tag validation failed',
          details: tagValidation.errors
        });
      }
    }

    // Category validation
    if (req.body.category) {
      const categoryValidation = ContentValidationUtils.validateCategory(req.body.category);
      if (!categoryValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Category validation failed',
          details: categoryValidation.errors
        });
      }
    }

    next();
  }

  // Template validation middleware
  static validateTemplate(req: Request, res: Response, next: NextFunction) {
    const validation = ContentValidationUtils.validateTemplate(req.body);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Template validation failed',
        details: validation.errors
      });
    }

    // Variable schema validation
    if (req.body.variableSchema) {
      const schemaValidation = ContentValidationUtils.validateVariableSchema(req.body.variableSchema);
      if (!schemaValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Variable schema validation failed',
          details: schemaValidation.errors
        });
      }
    }

    next();
  }

  // Training module validation middleware
  static validateTrainingModule(req: Request, res: Response, next: NextFunction) {
    const validation = ContentValidationUtils.validateTrainingModule(req.body);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Training module validation failed',
        details: validation.errors
      });
    }

    next();
  }

  // Assessment validation middleware
  static validateAssessment(req: Request, res: Response, next: NextFunction) {
    const validation = ContentValidationUtils.validateAssessment(req.body);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Assessment validation failed',
        details: validation.errors
      });
    }

    next();
  }

  // Workflow stage validation middleware
  static validateWorkflowStage(req: Request, res: Response, next: NextFunction) {
    const validation = ContentValidationUtils.validateWorkflowStage(req.body);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Workflow stage validation failed',
        details: validation.errors
      });
    }

    next();
  }

  // Search query validation middleware
  static validateSearchQuery(req: Request, res: Response, next: NextFunction) {
    const query = req.body.query || req.query.query;
    const validation = ContentValidationUtils.validateSearchQuery(query);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Search query validation failed',
        details: validation.errors
      });
    }

    next();
  }

  // Content access control middleware
  static checkContentAccess = (requiredPermission: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user;
        if (!user) {
          return res.status(401).json({
            success: false,
            error: 'Authentication required'
          });
        }

        // Check if user has required permission
        const hasPermission = await this.checkUserPermission(user.id, requiredPermission);
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            error: 'Insufficient permissions'
          });
        }

        next();
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Access check failed'
        });
      }
    };
  };

  // Content visibility middleware
  static checkContentVisibility = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      const contentId = req.params.id;

      // If no user, only public content is accessible
      if (!user) {
        const content = await this.getContentById(contentId);
        if (!content || content.visibility !== 'public') {
          return res.status(403).json({
            success: false,
            error: 'Authentication required to access this content'
          });
        }
        next();
        return;
      }

      // Check user permissions based on content visibility
      const hasAccess = await this.checkUserContentAccess(user.id, contentId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions to access this content'
        });
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Visibility check failed'
      });
    }
  };

  // Content versioning middleware
  static trackContentVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const originalSend = res.send;
      const contentId = req.params.id;
      const userId = req.user?.id;
      const changes = req.body;

      res.send = function(data: any) {
        // If the request was successful and created/updated content
        if (res.statusCode < 400 && data && data.success) {
          // Track the version change
          if (userId && contentId && changes) {
            ContentMiddleware.trackVersionChange(contentId, userId, changes)
              .catch(error => {
                console.error('Failed to track version change:', error);
              });
          }
        }

        originalSend.call(this, data);
      };

      next();
    } catch (error) {
      next(error);
    }
  };

  // Content analytics middleware
  static trackContentInteraction = (action: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const originalSend = res.send;
        const contentId = req.params.id;
        const userId = req.user?.id;

        res.send = function(data: any) {
          // If the request was successful
          if (res.statusCode < 400 && data && data.success) {
            // Track the interaction
            if (userId && contentId) {
              ContentMiddleware.trackInteraction(contentId, userId, action)
                .catch(error => {
                  console.error('Failed to track interaction:', error);
                });
            }
          }

          originalSend.call(this, data);
        };

        next();
      } catch (error) {
        next(error);
      }
    };
  };

  // Rate limiting middleware for content operations
  static rateLimitContentOperations = (maxOperations: number, windowMs: number) => {
    const operations = new Map<string, number[]>();

    return (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user?.id || req.ip;
      const now = Date.now();
      const windowStart = now - windowMs;

      if (!operations.has(userId)) {
        operations.set(userId, []);
      }

      const userOperations = operations.get(userId)!;
      
      // Remove old operations
      const recentOperations = userOperations.filter(time => time > windowStart);
      operations.set(userId, recentOperations);

      if (recentOperations.length >= maxOperations) {
        return res.status(429).json({
          success: false,
          error: 'Too many content operations. Please try again later.'
        });
      }

      recentOperations.push(now);
      next();
    };
  };

  // Content sanitization middleware
  static sanitizeContent(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.body.content) {
        // Import processing utilities dynamically to avoid circular dependency
        const { ContentProcessingUtils } = require('../../utils/knowledge-base/content/processingUtils');
        req.body.content = ContentProcessingUtils.sanitizeHtml(req.body.content);
      }

      if (req.body.description) {
        const { ContentProcessingUtils } = require('../../utils/knowledge-base/content/processingUtils');
        req.body.description = ContentProcessingUtils.sanitizeHtml(req.body.description);
      }

      next();
    } catch (error) {
      next(error);
    }
  }

  // Helper methods
  private static async checkUserPermission(userId: string, permission: string): Promise<boolean> {
    // This would typically check against a permissions service
    // For now, we'll implement a simple check
    // In a real implementation, this would query the database or auth service
    return true; // Placeholder implementation
  }

  private static async getContentById(contentId: string): Promise<any> {
    // This would typically query the content service
    // For now, we'll return a placeholder
    return null; // Placeholder implementation
  }

  private static async checkUserContentAccess(userId: string, contentId: string): Promise<boolean> {
    // This would typically check user permissions against content visibility
    // For now, we'll implement a simple check
    return true; // Placeholder implementation
  }

  private static async trackVersionChange(contentId: string, userId: string, changes: any): Promise<void> {
    // This would typically create a version record
    // For now, we'll just log the change
    console.log(`Version change tracked for content ${contentId} by user ${userId}`, changes);
  }

  private static async trackInteraction(contentId: string, userId: string, action: string): Promise<void> {
    // This would typically create an interaction record
    // For now, we'll just log the interaction
    console.log(`Interaction tracked: ${action} on content ${contentId} by user ${userId}`);
  }
}