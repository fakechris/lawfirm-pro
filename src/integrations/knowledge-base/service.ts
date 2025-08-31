import { PrismaClient } from '@prisma/client';
import { knowledgeBaseAnalyticsEngine } from '../services/knowledge-base/analytics/engine';

const prisma = new PrismaClient();

export interface IntegrationEvent {
  id: string;
  type: string;
  source: string;
  payload: any;
  timestamp: Date;
  processed: boolean;
  processedAt?: Date;
  error?: string;
}

export interface IntegrationConfig {
  id: string;
  name: string;
  type: 'webhook' | 'api' | 'database' | 'message_queue';
  endpoint: string;
  headers?: Record<string, string>;
  auth?: {
    type: 'bearer' | 'basic' | 'api_key';
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    keyHeader?: string;
  };
  events: string[];
  active: boolean;
  retryPolicy: {
    maxAttempts: number;
    delayMs: number;
    backoffMultiplier: number;
  };
}

export interface IntegrationMetrics {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  averageResponseTime: number;
  lastSuccessfulSync?: Date;
  activeIntegrations: number;
  errorRate: number;
}

export class KnowledgeBaseIntegrationService {
  private integrations: Map<string, IntegrationConfig> = new Map();
  private eventQueue: IntegrationEvent[] = [];
  private processing = false;
  private metrics: IntegrationMetrics = {
    totalEvents: 0,
    successfulEvents: 0,
    failedEvents: 0,
    averageResponseTime: 0,
    activeIntegrations: 0,
    errorRate: 0,
  };

  constructor() {
    this.loadIntegrations();
    this.startEventProcessor();
    this.startMetricsCollection();
  }

  async registerIntegration(config: IntegrationConfig): Promise<void> {
    try {
      // Store integration configuration
      await prisma.knowledgeBaseIntegration.create({
        data: {
          name: config.name,
          type: config.type,
          endpoint: config.endpoint,
          headers: config.headers || {},
          auth: config.auth,
          events: config.events,
          active: config.active,
          retryPolicy: config.retryPolicy,
        },
      });

      this.integrations.set(config.id, config);
      this.updateMetrics();
      
      console.log(`Integration registered: ${config.name}`);
    } catch (error) {
      console.error('Failed to register integration:', error);
      throw error;
    }
  }

  async updateIntegration(id: string, updates: Partial<IntegrationConfig>): Promise<void> {
    try {
      const existing = this.integrations.get(id);
      if (!existing) {
        throw new Error('Integration not found');
      }

      const updated = { ...existing, ...updates };
      
      await prisma.knowledgeBaseIntegration.update({
        where: { id },
        data: {
          name: updated.name,
          endpoint: updated.endpoint,
          headers: updated.headers,
          auth: updated.auth,
          events: updated.events,
          active: updated.active,
          retryPolicy: updated.retryPolicy,
        },
      });

      this.integrations.set(id, updated);
      console.log(`Integration updated: ${updated.name}`);
    } catch (error) {
      console.error('Failed to update integration:', error);
      throw error;
    }
  }

  async removeIntegration(id: string): Promise<void> {
    try {
      await prisma.knowledgeBaseIntegration.delete({
        where: { id },
      });

      this.integrations.delete(id);
      this.updateMetrics();
      
      console.log(`Integration removed: ${id}`);
    } catch (error) {
      console.error('Failed to remove integration:', error);
      throw error;
    }
  }

  async emitEvent(event: Omit<IntegrationEvent, 'id' | 'timestamp' | 'processed'>): Promise<void> {
    const integrationEvent: IntegrationEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date(),
      processed: false,
    };

    // Add to queue
    this.eventQueue.push(integrationEvent);
    
    // Store in database
    await prisma.knowledgeBaseIntegrationEvent.create({
      data: {
        id: integrationEvent.id,
        type: integrationEvent.type,
        source: integrationEvent.source,
        payload: integrationEvent.payload,
        timestamp: integrationEvent.timestamp,
        processed: false,
      },
    });

    // Update metrics
    this.metrics.totalEvents++;
    
    console.log(`Event emitted: ${event.type} from ${event.source}`);
  }

  async getIntegrations(): Promise<IntegrationConfig[]> {
    return Array.from(this.integrations.values()).filter(i => i.active);
  }

  async getIntegrationMetrics(): Promise<IntegrationMetrics> {
    return { ...this.metrics };
  }

  async getEventHistory(
    filters: {
      type?: string;
      source?: string;
      processed?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<IntegrationEvent[]> {
    const where: any = {};
    
    if (filters.type) where.type = filters.type;
    if (filters.source) where.source = filters.source;
    if (filters.processed !== undefined) where.processed = filters.processed;

    const events = await prisma.knowledgeBaseIntegrationEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: filters.limit || 50,
      skip: filters.offset || 0,
    });

    return events.map(event => ({
      id: event.id,
      type: event.type,
      source: event.source,
      payload: event.payload,
      timestamp: event.timestamp,
      processed: event.processed,
      processedAt: event.processedAt,
      error: event.error,
    }));
  }

  async syncWithExternalSystems(): Promise<void> {
    try {
      // Sync analytics data with external systems
      const metrics = await knowledgeBaseAnalyticsEngine.getKnowledgeBaseMetrics();
      
      await this.emitEvent({
        type: 'analytics_sync',
        source: 'knowledge_base',
        payload: {
          metrics,
          timestamp: new Date(),
        },
      });

      // Sync with content management system
      await this.syncContentWithCMS();
      
      // Sync with search system
      await this.syncWithSearchSystem();
      
      console.log('External systems sync completed');
    } catch (error) {
      console.error('Failed to sync with external systems:', error);
      throw error;
    }
  }

  async testIntegration(id: string): Promise<{ success: boolean; responseTime: number; error?: string }> {
    const integration = this.integrations.get(id);
    if (!integration) {
      return { success: false, responseTime: 0, error: 'Integration not found' };
    }

    const startTime = Date.now();
    
    try {
      // Send test event
      const testEvent = {
        type: 'test',
        source: 'integration_test',
        payload: {
          message: 'Integration test event',
          timestamp: new Date(),
        },
      };

      await this.sendToIntegration(integration, testEvent);
      
      const responseTime = Date.now() - startTime;
      
      return { success: true, responseTime };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return { 
        success: false, 
        responseTime, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  private async loadIntegrations(): Promise<void> {
    try {
      const integrations = await prisma.knowledgeBaseIntegration.findMany({
        where: { active: true },
      });

      integrations.forEach(integration => {
        this.integrations.set(integration.id, {
          id: integration.id,
          name: integration.name,
          type: integration.type,
          endpoint: integration.endpoint,
          headers: integration.headers,
          auth: integration.auth,
          events: integration.events,
          active: integration.active,
          retryPolicy: integration.retryPolicy,
        });
      });

      this.updateMetrics();
      console.log(`Loaded ${integrations.length} integrations`);
    } catch (error) {
      console.error('Failed to load integrations:', error);
    }
  }

  private startEventProcessor(): void {
    setInterval(async () => {
      if (!this.processing && this.eventQueue.length > 0) {
        await this.processEvents();
      }
    }, 5000); // Process every 5 seconds
  }

  private async processEvents(): Promise<void> {
    this.processing = true;
    
    try {
      const eventsToProcess = [...this.eventQueue];
      this.eventQueue = [];

      for (const event of eventsToProcess) {
        await this.processEvent(event);
      }
    } catch (error) {
      console.error('Error processing events:', error);
    } finally {
      this.processing = false;
    }
  }

  private async processEvent(event: IntegrationEvent): Promise<void> {
    const relevantIntegrations = Array.from(this.integrations.values())
      .filter(integration => 
        integration.active && 
        integration.events.includes(event.type)
      );

    for (const integration of relevantIntegrations) {
      await this.sendToIntegrationWithRetry(integration, event);
    }
  }

  private async sendToIntegrationWithRetry(
    integration: IntegrationConfig, 
    event: IntegrationEvent
  ): Promise<void> {
    const { maxAttempts, delayMs, backoffMultiplier } = integration.retryPolicy;
    let attempt = 0;
    let delay = delayMs;

    while (attempt < maxAttempts) {
      try {
        await this.sendToIntegration(integration, event);
        
        // Mark event as processed
        await prisma.knowledgeBaseIntegrationEvent.update({
          where: { id: event.id },
          data: {
            processed: true,
            processedAt: new Date(),
          },
        });

        this.metrics.successfulEvents++;
        return;
      } catch (error) {
        attempt++;
        
        if (attempt === maxAttempts) {
          // Mark event as failed
          await prisma.knowledgeBaseIntegrationEvent.update({
            where: { id: event.id },
            data: {
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          });

          this.metrics.failedEvents++;
          console.error(`Failed to send event to ${integration.name} after ${maxAttempts} attempts:`, error);
          return;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= backoffMultiplier;
      }
    }
  }

  private async sendToIntegration(
    integration: IntegrationConfig, 
    event: IntegrationEvent
  ): Promise<void> {
    const startTime = Date.now();
    
    switch (integration.type) {
      case 'webhook':
        await this.sendWebhook(integration, event);
        break;
      case 'api':
        await this.sendAPIRequest(integration, event);
        break;
      case 'database':
        await this.sendToDatabase(integration, event);
        break;
      case 'message_queue':
        await this.sendToMessageQueue(integration, event);
        break;
      default:
        throw new Error(`Unsupported integration type: ${integration.type}`);
    }

    // Update response time metrics
    const responseTime = Date.now() - startTime;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.successfulEvents - 1) + responseTime) / 
      this.metrics.successfulEvents;
  }

  private async sendWebhook(integration: IntegrationConfig, event: IntegrationEvent): Promise<void> {
    const headers = {
      'Content-Type': 'application/json',
      ...integration.headers,
    };

    // Add authentication headers
    if (integration.auth) {
      switch (integration.auth.type) {
        case 'bearer':
          headers['Authorization'] = `Bearer ${integration.auth.token}`;
          break;
        case 'basic':
          const credentials = btoa(`${integration.auth.username}:${integration.auth.password}`);
          headers['Authorization'] = `Basic ${credentials}`;
          break;
        case 'api_key':
          if (integration.auth.keyHeader) {
            headers[integration.auth.keyHeader] = integration.auth.apiKey;
          }
          break;
      }
    }

    const response = await fetch(integration.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event: event.type,
        source: event.source,
        payload: event.payload,
        timestamp: event.timestamp,
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
    }
  }

  private async sendAPIRequest(integration: IntegrationConfig, event: IntegrationEvent): Promise<void> {
    // Similar to webhook but with API-specific handling
    await this.sendWebhook(integration, event);
  }

  private async sendToDatabase(integration: IntegrationConfig, event: IntegrationEvent): Promise<void> {
    // Store event in external database
    // This would require specific database client implementation
    console.log(`Storing event in external database: ${integration.endpoint}`, event);
  }

  private async sendToMessageQueue(integration: IntegrationConfig, event: IntegrationEvent): Promise<void> {
    // Send event to message queue
    // This would require specific message queue client implementation
    console.log(`Sending event to message queue: ${integration.endpoint}`, event);
  }

  private async syncContentWithCMS(): Promise<void> {
    // Sync knowledge base content with external CMS
    const articles = await prisma.knowledgeBaseArticle.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        id: true,
        title: true,
        slug: true,
        content: true,
        summary: true,
        categories: true,
        tags: true,
        publishedAt: true,
        updatedAt: true,
      },
    });

    await this.emitEvent({
      type: 'cms_sync',
      source: 'knowledge_base',
      payload: {
        articles,
        timestamp: new Date(),
      },
    });
  }

  private async syncWithSearchSystem(): Promise<void> {
    // Sync search analytics with external search system
    const searchActivity = await prisma.knowledgeBaseSearchActivity.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    await this.emitEvent({
      type: 'search_sync',
      source: 'knowledge_base',
      payload: {
        searchActivity,
        timestamp: new Date(),
      },
    });
  }

  private updateMetrics(): void> {
    this.metrics.activeIntegrations = Array.from(this.integrations.values())
      .filter(i => i.active).length;
    this.metrics.errorRate = this.metrics.totalEvents > 0 
      ? (this.metrics.failedEvents / this.metrics.totalEvents) * 100 
      : 0;
  }

  private startMetricsCollection(): void {
    // Collect metrics every minute
    setInterval(() => {
      this.updateMetrics();
    }, 60 * 1000);
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Database models needed for integration service
// These should be added to the Prisma schema

export const knowledgeBaseIntegrationService = new KnowledgeBaseIntegrationService();