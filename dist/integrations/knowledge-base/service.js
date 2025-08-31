"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.knowledgeBaseIntegrationService = exports.KnowledgeBaseIntegrationService = void 0;
const client_1 = require("@prisma/client");
const engine_1 = require("../services/knowledge-base/analytics/engine");
const prisma = new client_1.PrismaClient();
class KnowledgeBaseIntegrationService {
    constructor() {
        this.integrations = new Map();
        this.eventQueue = [];
        this.processing = false;
        this.metrics = {
            totalEvents: 0,
            successfulEvents: 0,
            failedEvents: 0,
            averageResponseTime: 0,
            activeIntegrations: 0,
            errorRate: 0,
        };
        this.loadIntegrations();
        this.startEventProcessor();
        this.startMetricsCollection();
    }
    async registerIntegration(config) {
        try {
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
        }
        catch (error) {
            console.error('Failed to register integration:', error);
            throw error;
        }
    }
    async updateIntegration(id, updates) {
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
        }
        catch (error) {
            console.error('Failed to update integration:', error);
            throw error;
        }
    }
    async removeIntegration(id) {
        try {
            await prisma.knowledgeBaseIntegration.delete({
                where: { id },
            });
            this.integrations.delete(id);
            this.updateMetrics();
            console.log(`Integration removed: ${id}`);
        }
        catch (error) {
            console.error('Failed to remove integration:', error);
            throw error;
        }
    }
    async emitEvent(event) {
        const integrationEvent = {
            ...event,
            id: this.generateEventId(),
            timestamp: new Date(),
            processed: false,
        };
        this.eventQueue.push(integrationEvent);
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
        this.metrics.totalEvents++;
        console.log(`Event emitted: ${event.type} from ${event.source}`);
    }
    async getIntegrations() {
        return Array.from(this.integrations.values()).filter(i => i.active);
    }
    async getIntegrationMetrics() {
        return { ...this.metrics };
    }
    async getEventHistory(filters = {}) {
        const where = {};
        if (filters.type)
            where.type = filters.type;
        if (filters.source)
            where.source = filters.source;
        if (filters.processed !== undefined)
            where.processed = filters.processed;
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
    async syncWithExternalSystems() {
        try {
            const metrics = await engine_1.knowledgeBaseAnalyticsEngine.getKnowledgeBaseMetrics();
            await this.emitEvent({
                type: 'analytics_sync',
                source: 'knowledge_base',
                payload: {
                    metrics,
                    timestamp: new Date(),
                },
            });
            await this.syncContentWithCMS();
            await this.syncWithSearchSystem();
            console.log('External systems sync completed');
        }
        catch (error) {
            console.error('Failed to sync with external systems:', error);
            throw error;
        }
    }
    async testIntegration(id) {
        const integration = this.integrations.get(id);
        if (!integration) {
            return { success: false, responseTime: 0, error: 'Integration not found' };
        }
        const startTime = Date.now();
        try {
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
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            return {
                success: false,
                responseTime,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async loadIntegrations() {
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
        }
        catch (error) {
            console.error('Failed to load integrations:', error);
        }
    }
    startEventProcessor() {
        setInterval(async () => {
            if (!this.processing && this.eventQueue.length > 0) {
                await this.processEvents();
            }
        }, 5000);
    }
    async processEvents() {
        this.processing = true;
        try {
            const eventsToProcess = [...this.eventQueue];
            this.eventQueue = [];
            for (const event of eventsToProcess) {
                await this.processEvent(event);
            }
        }
        catch (error) {
            console.error('Error processing events:', error);
        }
        finally {
            this.processing = false;
        }
    }
    async processEvent(event) {
        const relevantIntegrations = Array.from(this.integrations.values())
            .filter(integration => integration.active &&
            integration.events.includes(event.type));
        for (const integration of relevantIntegrations) {
            await this.sendToIntegrationWithRetry(integration, event);
        }
    }
    async sendToIntegrationWithRetry(integration, event) {
        const { maxAttempts, delayMs, backoffMultiplier } = integration.retryPolicy;
        let attempt = 0;
        let delay = delayMs;
        while (attempt < maxAttempts) {
            try {
                await this.sendToIntegration(integration, event);
                await prisma.knowledgeBaseIntegrationEvent.update({
                    where: { id: event.id },
                    data: {
                        processed: true,
                        processedAt: new Date(),
                    },
                });
                this.metrics.successfulEvents++;
                return;
            }
            catch (error) {
                attempt++;
                if (attempt === maxAttempts) {
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
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= backoffMultiplier;
            }
        }
    }
    async sendToIntegration(integration, event) {
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
        const responseTime = Date.now() - startTime;
        this.metrics.averageResponseTime =
            (this.metrics.averageResponseTime * (this.metrics.successfulEvents - 1) + responseTime) /
                this.metrics.successfulEvents;
    }
    async sendWebhook(integration, event) {
        const headers = {
            'Content-Type': 'application/json',
            ...integration.headers,
        };
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
    async sendAPIRequest(integration, event) {
        await this.sendWebhook(integration, event);
    }
    async sendToDatabase(integration, event) {
        console.log(`Storing event in external database: ${integration.endpoint}`, event);
    }
    async sendToMessageQueue(integration, event) {
        console.log(`Sending event to message queue: ${integration.endpoint}`, event);
    }
    async syncContentWithCMS() {
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
    async syncWithSearchSystem() {
        const searchActivity = await prisma.knowledgeBaseSearchActivity.findMany({
            where: {
                createdAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
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
}
exports.KnowledgeBaseIntegrationService = KnowledgeBaseIntegrationService;
 > {
    this: .metrics.activeIntegrations = Array.from(this.integrations.values())
        .filter(i => i.active).length,
    this: .metrics.errorRate = this.metrics.totalEvents > 0
        ? (this.metrics.failedEvents / this.metrics.totalEvents) * 100
        : 0
};
startMetricsCollection();
void {
    setInterval() { }
}();
{
    this.updateMetrics();
}
60 * 1000;
;
generateEventId();
string;
{
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
exports.knowledgeBaseIntegrationService = new KnowledgeBaseIntegrationService();
//# sourceMappingURL=service.js.map