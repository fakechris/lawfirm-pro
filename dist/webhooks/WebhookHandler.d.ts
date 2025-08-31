import { WebhookPayload, WebhookResult } from '../services/external/types';
export declare class WebhookHandler {
    private logger;
    private stripeService;
    private paypalService;
    constructor();
    handleWebhook(payload: WebhookPayload): Promise<WebhookResult>;
    private routeWebhook;
    private handleCourtWebhook;
    private handleSystemWebhook;
    private handleCourtFilingUpdate;
    private handleCourtHearingScheduled;
    private handleCourtDocumentAvailable;
    private handleCourtCaseStatusChange;
    private handleServiceHealthUpdate;
    private handleRateLimitExceeded;
    private handleMaintenanceNotification;
    private handleSecurityAlert;
    private verifyWebhookSignature;
    registerWebhook(service: string, endpoint: string, events: string[]): Promise<boolean>;
    unregisterWebhook(service: string, webhookId: string): Promise<boolean>;
    listWebhooks(service: string): Promise<any[]>;
    testWebhook(service: string, webhookId: string): Promise<boolean>;
}
//# sourceMappingURL=WebhookHandler.d.ts.map