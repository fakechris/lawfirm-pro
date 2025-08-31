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
export declare class KnowledgeBaseIntegrationService {
    private integrations;
    private eventQueue;
    private processing;
    private metrics;
    constructor();
    registerIntegration(config: IntegrationConfig): Promise<void>;
    updateIntegration(id: string, updates: Partial<IntegrationConfig>): Promise<void>;
    removeIntegration(id: string): Promise<void>;
    emitEvent(event: Omit<IntegrationEvent, 'id' | 'timestamp' | 'processed'>): Promise<void>;
    getIntegrations(): Promise<IntegrationConfig[]>;
    getIntegrationMetrics(): Promise<IntegrationMetrics>;
    getEventHistory(filters?: {
        type?: string;
        source?: string;
        processed?: boolean;
        limit?: number;
        offset?: number;
    }): Promise<IntegrationEvent[]>;
    syncWithExternalSystems(): Promise<void>;
    testIntegration(id: string): Promise<{
        success: boolean;
        responseTime: number;
        error?: string;
    }>;
    private loadIntegrations;
    private startEventProcessor;
    private processEvents;
    private processEvent;
    private sendToIntegrationWithRetry;
    private sendToIntegration;
    private sendWebhook;
    private sendAPIRequest;
    private sendToDatabase;
    private sendToMessageQueue;
    private syncContentWithCMS;
    private syncWithSearchSystem;
    private updateMetrics;
}
export declare const knowledgeBaseIntegrationService: KnowledgeBaseIntegrationService;
//# sourceMappingURL=service.d.ts.map