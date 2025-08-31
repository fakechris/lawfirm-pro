import { LegalDocument, FilingResult, CaseStatus, Hearing, HearingResult, PaymentRequest, PaymentResult, RefundRequest, RefundResult, Subscription, SubscriptionResult, SearchQuery, CaseResult, Statute, Regulation, AnalysisResult, WebhookPayload, WebhookResult } from './types';
export declare class ExternalServiceClient {
    private webhookHandler;
    constructor();
    fileDocument(courtType: 'pacer' | 'state', document: LegalDocument): Promise<FilingResult>;
    checkCaseStatus(courtType: 'pacer' | 'state', caseId: string): Promise<CaseStatus>;
    retrieveCaseDocuments(courtType: 'pacer' | 'state', caseId: string): Promise<LegalDocument[]>;
    scheduleHearing(courtType: 'pacer' | 'state', caseId: string, hearing: Hearing): Promise<HearingResult>;
    processPayment(processor: 'stripe' | 'paypal', payment: PaymentRequest): Promise<PaymentResult>;
    refundPayment(processor: 'stripe' | 'paypal', refund: RefundRequest): Promise<RefundResult>;
    createSubscription(processor: 'stripe' | 'paypal', subscription: Subscription): Promise<SubscriptionResult>;
    searchCases(service: 'lexisnexis' | 'westlaw', query: SearchQuery): Promise<CaseResult[]>;
    getStatutes(service: 'lexisnexis' | 'westlaw', jurisdiction: string): Promise<Statute[]>;
    searchRegulations(service: 'lexisnexis' | 'westlaw', query: string): Promise<Regulation[]>;
    analyzeDocument(service: 'lexisnexis' | 'westlaw', document: any): Promise<AnalysisResult>;
    handleWebhook(payload: WebhookPayload): Promise<WebhookResult>;
    registerWebhook(service: string, endpoint: string, events: string[]): Promise<boolean>;
    unregisterWebhook(service: string, webhookId: string): Promise<boolean>;
    listWebhooks(service: string): Promise<any[]>;
    testWebhook(service: string, webhookId: string): Promise<boolean>;
    testAllServices(): Promise<{
        [key: string]: boolean;
    }>;
    private testPACERConnection;
    private testStateCourtsConnection;
    private testStripeConnection;
    private testPayPalConnection;
    private testLexisNexisConnection;
    private testWestlawConnection;
}
export declare const externalServices: {
    client: ExternalServiceClient;
    filePACERDocument(document: LegalDocument): Promise<FilingResult>;
    fileStateCourtDocument(document: LegalDocument): Promise<FilingResult>;
    processStripePayment(payment: PaymentRequest): Promise<PaymentResult>;
    processPayPalPayment(payment: PaymentRequest): Promise<PaymentResult>;
    searchLexisNexisCases(query: SearchQuery): Promise<CaseResult[]>;
    searchWestlawCases(query: SearchQuery): Promise<CaseResult[]>;
};
export default ExternalServiceClient;
//# sourceMappingURL=ExternalServiceClient.d.ts.map