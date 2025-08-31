import { Request, Response, NextFunction } from 'express';
import { knowledgeBaseAnalyticsEngine } from '../../services/knowledge-base/analytics/engine';
import { knowledgeBaseIntegrationService } from '../../integrations/knowledge-base/service';

export interface AnalyticsRequest extends Request {
  analyticsContext?: {
    sessionId: string;
    startTime: number;
    userId?: string;
    path: string;
    method: string;
    userAgent?: string;
    ipAddress?: string;
  };
}

export class AnalyticsMiddleware {
  private static instance: AnalyticsMiddleware;
  private activeSessions: Map<string, { lastActivity: Date; userId?: string }> = new Map();

  static getInstance(): AnalyticsMiddleware {
    if (!AnalyticsMiddleware.instance) {
      AnalyticsMiddleware.instance = new AnalyticsMiddleware();
    }
    return AnalyticsMiddleware.instance;
  }

  trackKnowledgeBaseRequests = (req: AnalyticsRequest, res: Response, next: NextFunction): void => {
    // Only track knowledge base related requests
    if (!req.path.startsWith('/api/knowledge-base') && !req.path.startsWith('/knowledge-base')) {
      return next();
    }

    const sessionId = this.getOrCreateSession(req);
    const startTime = Date.now();

    req.analyticsContext = {
      sessionId,
      startTime,
      userId: req.user?.id,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
    };

    // Track request start
    this.trackRequestStart(req);

    // Override res.end to track request completion
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Track request completion
      AnalyticsMiddleware.getInstance().trackRequestEnd(req, res, responseTime);

      // Call original end
      originalEnd.call(this, chunk, encoding);
    };

    next();
  };

  trackArticleViews = async (req: AnalyticsRequest, res: Response, next: NextFunction): Promise<void> => {
    if (req.method === 'GET' && req.path.match(/\/api\/knowledge-base\/articles\/[^\/]+$/)) {
      const articleId = req.path.split('/').pop();
      
      if (articleId && req.analyticsContext) {
        try {
          await knowledgeBaseAnalyticsEngine.recordArticleView({
            articleId,
            userId: req.analyticsContext.userId,
            sessionId: req.analyticsContext.sessionId,
            referrer: req.get('Referer'),
          });

          // Emit integration event
          await knowledgeBaseIntegrationService.emitEvent({
            type: 'article_viewed',
            source: 'knowledge_base_api',
            payload: {
              articleId,
              userId: req.analyticsContext.userId,
              sessionId: req.analyticsContext.sessionId,
              timestamp: new Date(),
              metadata: {
                path: req.path,
                userAgent: req.analyticsContext.userAgent,
              },
            },
          });
        } catch (error) {
          console.error('Failed to track article view:', error);
        }
      }
    }
    
    next();
  };

  trackSearchActivity = async (req: AnalyticsRequest, res: Response, next: NextFunction): Promise<void> => {
    if (req.method === 'GET' && req.path.includes('/search')) {
      const startTime = Date.now();
      
      // Store search start time
      (req as any).searchStartTime = startTime;
    }
    
    next();
  };

  trackSearchResults = async (req: AnalyticsRequest, res: Response, next: NextFunction): Promise<void> => {
    if (req.method === 'GET' && req.path.includes('/search') && res.statusCode === 200) {
      const searchStartTime = (req as any).searchStartTime;
      
      if (searchStartTime && req.analyticsContext) {
        const responseTime = Date.now() - searchStartTime;
        
        try {
          // Extract search query from request
          const query = req.query.q as string || '';
          const resultsCount = res.locals.searchResults?.length || 0;
          
          await knowledgeBaseAnalyticsEngine.recordSearchActivity({
            query,
            userId: req.analyticsContext.userId,
            sessionId: req.analyticsContext.sessionId,
            resultsCount,
            clickedResults: [], // Would be populated from client-side tracking
            filters: req.query.filters ? JSON.parse(req.query.filters as string) : undefined,
            responseTime,
            success: true,
          });

          // Emit integration event
          await knowledgeBaseIntegrationService.emitEvent({
            type: 'search_performed',
            source: 'knowledge_base_api',
            payload: {
              query,
              resultsCount,
              responseTime,
              userId: req.analyticsContext.userId,
              sessionId: req.analyticsContext.sessionId,
              timestamp: new Date(),
              metadata: {
                path: req.path,
                userAgent: req.analyticsContext.userAgent,
              },
            },
          });
        } catch (error) {
          console.error('Failed to track search activity:', error);
        }
      }
    }
    
    next();
  };

  trackUserInteractions = async (req: AnalyticsRequest, res: Response, next: NextFunction): Promise<void> => {
    if (req.method === 'POST' && req.path.match(/\/api\/knowledge-base\/articles\/[^\/]+\/(like|comment|share|bookmark)/)) {
      const articleId = req.path.split('/')[4];
      const interactionType = req.path.split('/')[5];
      
      if (articleId && interactionType && req.analyticsContext?.userId) {
        try {
          await knowledgeBaseAnalyticsEngine.recordUserInteraction({
            articleId,
            userId: req.analyticsContext.userId,
            interactionType: interactionType as any,
            content: req.body.content,
            metadata: req.body.metadata,
          });

          // Emit integration event
          await knowledgeBaseIntegrationService.emitEvent({
            type: 'user_interaction',
            source: 'knowledge_base_api',
            payload: {
              articleId,
              interactionType,
              userId: req.analyticsContext.userId,
              content: req.body.content,
              timestamp: new Date(),
              metadata: {
                path: req.path,
                userAgent: req.analyticsContext.userAgent,
              },
            },
          });
        } catch (error) {
          console.error('Failed to track user interaction:', error);
        }
      }
    }
    
    next();
  };

  trackApiErrors = (err: any, req: AnalyticsRequest, res: Response, next: NextFunction): void => {
    if (req.analyticsContext) {
      const responseTime = Date.now() - req.analyticsContext.startTime;
      
      // Track error
      this.trackError(req, err, responseTime);
    }
    
    next(err);
  };

  trackPerformanceMetrics = (req: AnalyticsRequest, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    
    // Track memory usage
    const startMemory = process.memoryUsage();
    
    res.on('finish', () => {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      const endMemory = process.memoryUsage();
      
      // Track performance metrics
      this.trackPerformance(req, res, {
        responseTime,
        memoryUsage: {
          start: startMemory,
          end: endMemory,
          delta: {
            rss: endMemory.rss - startMemory.rss,
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          },
        },
      });
    });
    
    next();
  };

  trackRealTimeMetrics = (req: AnalyticsRequest, res: Response, next: NextFunction): void => {
    // Track real-time metrics for dashboard
    if (req.path === '/api/knowledge-base/analytics/real-time') {
      this.updateRealTimeMetrics(req);
    }
    
    next();
  };

  private getOrCreateSession(req: Request): string {
    const userAgent = req.get('User-Agent');
    const ip = req.ip;
    
    // Try to get session from various sources
    let sessionId = req.headers['x-session-id'] as string;
    
    if (!sessionId) {
      // Create session ID based on user agent and IP
      const sessionData = `${userAgent || ''}_${ip || ''}_${req.user?.id || 'anonymous'}`;
      sessionId = this.hashSessionData(sessionData);
    }
    
    // Update session activity
    this.activeSessions.set(sessionId, {
      lastActivity: new Date(),
      userId: req.user?.id,
    });
    
    return sessionId;
  }

  private hashSessionData(data: string): string {
    // Simple hash function for session ID generation
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `session_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
  }

  private trackRequestStart(req: AnalyticsRequest): void {
    // Track request start for analytics
    if (req.analyticsContext) {
      // This could be stored in a more sophisticated tracking system
      console.log(`Request started: ${req.analyticsContext.method} ${req.analyticsContext.path}`);
    }
  }

  private trackRequestEnd(req: AnalyticsRequest, res: Response, responseTime: number): void {
    if (req.analyticsContext) {
      const analyticsData = {
        sessionId: req.analyticsContext.sessionId,
        userId: req.analyticsContext.userId,
        path: req.analyticsContext.path,
        method: req.analyticsContext.method,
        responseTime,
        statusCode: res.statusCode,
        userAgent: req.analyticsContext.userAgent,
        ipAddress: req.analyticsContext.ipAddress,
        timestamp: new Date(),
      };

      // Store in analytics system
      this.storeRequestAnalytics(analyticsData);

      // Emit integration event for important requests
      if (responseTime > 1000 || res.statusCode >= 400) {
        knowledgeBaseIntegrationService.emitEvent({
          type: 'api_request',
          source: 'knowledge_base_middleware',
          payload: analyticsData,
        }).catch(error => {
          console.error('Failed to emit API request event:', error);
        });
      }
    }
  }

  private trackError(req: AnalyticsRequest, error: any, responseTime: number): void {
    if (req.analyticsContext) {
      const errorData = {
        sessionId: req.analyticsContext.sessionId,
        userId: req.analyticsContext.userId,
        path: req.analyticsContext.path,
        method: req.analyticsContext.method,
        responseTime,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        statusCode: error.statusCode || 500,
        userAgent: req.analyticsContext.userAgent,
        ipAddress: req.analyticsContext.ipAddress,
        timestamp: new Date(),
      };

      // Store error analytics
      this.storeErrorAnalytics(errorData);

      // Emit integration event for errors
      knowledgeBaseIntegrationService.emitEvent({
        type: 'api_error',
        source: 'knowledge_base_middleware',
        payload: errorData,
      }).catch(error => {
        console.error('Failed to emit API error event:', error);
      });
    }
  }

  private trackPerformance(req: AnalyticsRequest, res: Response, metrics: any): void {
    if (req.analyticsContext) {
      const performanceData = {
        sessionId: req.analyticsContext.sessionId,
        userId: req.analyticsContext.userId,
        path: req.analyticsContext.path,
        method: req.analyticsContext.method,
        ...metrics,
        timestamp: new Date(),
      };

      // Store performance analytics
      this.storePerformanceAnalytics(performanceData);

      // Check for performance issues
      if (metrics.responseTime > 2000) {
        knowledgeBaseIntegrationService.emitEvent({
          type: 'performance_issue',
          source: 'knowledge_base_middleware',
          payload: performanceData,
        }).catch(error => {
          console.error('Failed to emit performance issue event:', error);
        });
      }
    }
  }

  private updateRealTimeMetrics(req: AnalyticsRequest): void {
    // Update real-time metrics for dashboard
    const now = new Date();
    const activeSessions = this.activeSessions.size;
    const memoryUsage = process.memoryUsage();
    
    // This would typically update a real-time metrics store
    console.log(`Real-time metrics update: ${activeSessions} active sessions, ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB memory used`);
  }

  private storeRequestAnalytics(data: any): void {
    // Store request analytics in database or analytics service
    // This would typically use the analytics engine or a dedicated analytics service
    console.log('Storing request analytics:', data);
  }

  private storeErrorAnalytics(data: any): void {
    // Store error analytics
    console.log('Storing error analytics:', data);
  }

  private storePerformanceAnalytics(data: any): void {
    // Store performance analytics
    console.log('Storing performance analytics:', data);
  }

  // Cleanup old sessions
  private startSessionCleanup(): void {
    setInterval(() => {
      const now = new Date();
      const cutoff = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago
      
      for (const [sessionId, session] of this.activeSessions.entries()) {
        if (session.lastActivity < cutoff) {
          this.activeSessions.delete(sessionId);
        }
      }
    }, 5 * 60 * 1000); // Clean up every 5 minutes
  }

  // Get current analytics context
  getAnalyticsContext(req: Request): any {
    return (req as AnalyticsRequest).analyticsContext;
  }

  // Get active sessions count
  getActiveSessionsCount(): number {
    return this.activeSessions.size;
  }

  // Get session analytics
  getSessionAnalytics(): any {
    const sessions = Array.from(this.activeSessions.entries());
    return {
      totalSessions: sessions.length,
      authenticatedSessions: sessions.filter(([, session]) => session.userId).length,
      anonymousSessions: sessions.filter(([, session]) => !session.userId).length,
      recentActivity: sessions.map(([id, session]) => ({
        sessionId: id,
        userId: session.userId,
        lastActivity: session.lastActivity,
      })),
    };
  }
}

// Export singleton instance
export const analyticsMiddleware = AnalyticsMiddleware.getInstance();

// Export individual middleware functions
export const trackKnowledgeBaseRequests = analyticsMiddleware.trackKnowledgeBaseRequests;
export const trackArticleViews = analyticsMiddleware.trackArticleViews;
export const trackSearchActivity = analyticsMiddleware.trackSearchActivity;
export const trackSearchResults = analyticsMiddleware.trackSearchResults;
export const trackUserInteractions = analyticsMiddleware.trackUserInteractions;
export const trackApiErrors = analyticsMiddleware.trackApiErrors;
export const trackPerformanceMetrics = analyticsMiddleware.trackPerformanceMetrics;
export const trackRealTimeMetrics = analyticsMiddleware.trackRealTimeMetrics;