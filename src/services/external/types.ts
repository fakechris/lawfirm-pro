// External service interfaces and types

export interface LegalDocument {
  id: string;
  title: string;
  content: string;
  documentType: string;
  filingDate?: Date;
  caseId?: string;
  parties: Party[];
  attorneys: Attorney[];
  metadata: DocumentMetadata;
}

export interface Party {
  name: string;
  role: 'plaintiff' | 'defendant' | 'petitioner' | 'respondent' | 'intervenor';
  address?: string;
  contact?: ContactInfo;
}

export interface Attorney {
  name: string;
  barNumber: string;
  firm?: string;
  address?: string;
  contact: ContactInfo;
  representing: string[];
}

export interface ContactInfo {
  email?: string;
  phone?: string;
  address?: string;
}

export interface DocumentMetadata {
  pageCount: number;
  fileSize: number;
  format: string;
  docketNumber?: string;
  court: CourtInfo;
  tags?: string[];
  confidential: boolean;
}

export interface CourtInfo {
  name: string;
  jurisdiction: string;
  level: 'federal' | 'state' | 'local';
  location: string;
  courtCode: string;
}

export interface FilingResult {
  success: boolean;
  docketNumber?: string;
  filingDate: Date;
  receiptNumber?: string;
  fees?: number;
  errors?: string[];
  warnings?: string[];
}

export interface CaseStatus {
  caseId: string;
  docketNumber: string;
  status: 'open' | 'closed' | 'pending' | 'dismissed' | 'settled';
  lastUpdated: Date;
  nextHearing?: Date;
  judge?: string;
  assignedAttorneys: Attorney[];
  documents: LegalDocument[];
  timeline: CaseEvent[];
}

export interface CaseEvent {
  date: Date;
  description: string;
  eventType: string;
  filedBy?: string;
  documentId?: string;
}

export interface Hearing {
  date: Date;
  time: string;
  type: 'preliminary' | 'motion' | 'trial' | 'settlement' | 'sentencing';
  location: string;
  judge?: string;
  purpose: string;
  duration: number;
  virtual?: boolean;
  participants: string[];
}

export interface HearingResult {
  success: boolean;
  hearingId?: string;
  scheduledDate: Date;
  confirmationNumber?: string;
  instructions?: string;
  errors?: string[];
}

// Payment interfaces
export interface PaymentRequest {
  amount: number;
  currency: string;
  customerId?: string;
  paymentMethod: PaymentMethod;
  description: string;
  metadata?: Record<string, any>;
  invoiceId?: string;
  caseId?: string;
}

export interface PaymentMethod {
  type: 'card' | 'bank' | 'paypal' | 'alipay' | 'wechat';
  details: PaymentMethodDetails;
}

export interface PaymentMethodDetails {
  card?: {
    number: string;
    expMonth: number;
    expYear: number;
    cvv: string;
    name: string;
  };
  bank?: {
    accountNumber: string;
    routingNumber: string;
    accountType: 'checking' | 'savings';
    name: string;
  };
  paypal?: {
    email: string;
  };
  digitalWallet?: {
    provider: 'apple' | 'google' | 'samsung';
    token: string;
  };
}

export interface PaymentResult {
  success: boolean;
  paymentId: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'failed' | 'pending' | 'canceled' | 'refunded';
  processedAt: Date;
  transactionId?: string;
  receiptUrl?: string;
  errors?: string[];
  metadata?: Record<string, any>;
}

export interface RefundRequest {
  paymentId: string;
  amount?: number;
  reason: string;
  metadata?: Record<string, any>;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  amount: number;
  status: 'succeeded' | 'failed' | 'pending';
  processedAt: Date;
  transactionId?: string;
  errors?: string[];
}

export interface Subscription {
  customerId: string;
  planId: string;
  amount: number;
  currency: string;
  interval: 'day' | 'week' | 'month' | 'year';
  trialPeriod?: number;
  metadata?: Record<string, any>;
}

export interface SubscriptionResult {
  success: boolean;
  subscriptionId: string;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'incomplete';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  errors?: string[];
}

// Legal research interfaces
export interface SearchQuery {
  query: string;
  jurisdiction?: string;
  court?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  practiceArea?: string;
  caseType?: string;
  limit?: number;
  offset?: number;
}

export interface CaseResult {
  id: string;
  title: string;
  citation: string;
  court: CourtInfo;
  date: Date;
  judge?: string;
  summary: string;
  keywords: string[];
  docketNumber?: string;
  parties: Party[];
  attorneys: Attorney[];
  content: string;
  relevanceScore: number;
}

export interface Statute {
  id: string;
  title: string;
  code: string;
  section: string;
  jurisdiction: string;
  text: string;
  effectiveDate: Date;
  lastAmended?: Date;
  tags: string[];
  relatedStatutes: string[];
}

export interface Regulation {
  id: string;
  title: string;
  agency: string;
  citation: string;
  jurisdiction: string;
  text: string;
  effectiveDate: Date;
  lastAmended?: Date;
  tags: string[];
  relatedRegulations: string[];
}

export interface AnalysisResult {
  documentId: string;
  issues: LegalIssue[];
  citations: Citation[];
  entities: LegalEntity[];
  riskAssessment: RiskAssessment;
  recommendations: Recommendation[];
  confidence: number;
}

export interface LegalIssue {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  relevantJurisdictions: string[];
  relatedCases: string[];
}

export interface Citation {
  type: 'case' | 'statute' | 'regulation' | 'secondary';
  text: string;
  source: string;
  relevance: number;
}

export interface LegalEntity {
  type: 'person' | 'organization' | 'location' | 'date' | 'amount';
  text: string;
  context: string;
  confidence: number;
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high';
  factors: RiskFactor[];
  mitigation: string[];
}

export interface RiskFactor {
  factor: string;
  impact: 'low' | 'medium' | 'high';
  likelihood: 'low' | 'medium' | 'high';
  description: string;
}

export interface Recommendation {
  type: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  evidence: string[];
}

// Webhook interfaces
export interface WebhookPayload {
  id: string;
  type: string;
  timestamp: Date;
  data: any;
  signature?: string;
  headers?: Record<string, string>;
}

export interface WebhookResult {
  success: boolean;
  processedAt: Date;
  response?: any;
  errors?: string[];
}

// Common interfaces
export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  responseTime: number;
  errorRate: number;
  lastChecked: Date;
}

export interface ServiceConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  authentication: AuthConfig;
  rateLimit: RateLimitConfig;
  logging: LoggingConfig;
}

export interface AuthConfig {
  type: 'none' | 'apiKey' | 'oauth' | 'basic' | 'bearer';
  credentials: Record<string, string>;
  tokenUrl?: string;
  scopes?: string[];
}

export interface RateLimitConfig {
  enabled: boolean;
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
}

export interface LoggingConfig {
  enabled: boolean;
  level: 'debug' | 'info' | 'warn' | 'error';
  maskSensitiveData: boolean;
}