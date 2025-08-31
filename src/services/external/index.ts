// External Services Module
export * from './types';
export * from './BaseExternalService';

// Service interfaces
export interface CourtIntegration {
  fileDocument(document: LegalDocument): Promise<FilingResult>;
  checkStatus(caseId: string): Promise<CaseStatus>;
  retrieveDocuments(caseId: string): Promise<LegalDocument[]>;
  scheduleHearing(caseId: string, hearing: Hearing): Promise<HearingResult>;
}

export interface PaymentProcessor {
  processPayment(payment: PaymentRequest): Promise<PaymentResult>;
  refundPayment(refund: RefundRequest): Promise<RefundResult>;
  createSubscription(subscription: Subscription): Promise<SubscriptionResult>;
  handleWebhook(webhook: WebhookPayload): Promise<WebhookResult>;
}

export interface LegalResearchService {
  searchCases(query: SearchQuery): Promise<CaseResult[]>;
  getStatutes(jurisdiction: string): Promise<Statute[]>;
  searchRegulations(query: string): Promise<Regulation[]>;
  analyzeDocument(document: Document): Promise<AnalysisResult>;
}

// Import types
import {
  LegalDocument,
  Party,
  Attorney,
  ContactInfo,
  DocumentMetadata,
  CourtInfo,
  FilingResult,
  CaseStatus,
  CaseEvent,
  Hearing,
  HearingResult,
  PaymentRequest,
  PaymentMethod,
  PaymentMethodDetails,
  PaymentResult,
  RefundRequest,
  RefundResult,
  Subscription,
  SubscriptionResult,
  SearchQuery,
  CaseResult,
  Statute,
  Regulation,
  AnalysisResult,
  WebhookPayload,
  WebhookResult,
  ServiceHealth,
  ServiceConfig
} from './types';