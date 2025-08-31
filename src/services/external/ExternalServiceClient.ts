// API Client Libraries for External Services
import { CourtIntegrationFactory } from '../../integrations/courts';
import { PaymentProcessorFactory } from '../../integrations/payments';
import { LegalResearchServiceFactory } from '../../integrations/legal';
import { WebhookHandler } from '../../webhooks/WebhookHandler';
import {
  LegalDocument,
  FilingResult,
  CaseStatus,
  Hearing,
  HearingResult,
  PaymentRequest,
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
  WebhookResult
} from './types';

export class ExternalServiceClient {
  private webhookHandler: WebhookHandler;

  constructor() {
    this.webhookHandler = new WebhookHandler();
  }

  // Court System Methods
  async fileDocument(
    courtType: 'pacer' | 'state',
    document: LegalDocument
  ): Promise<FilingResult> {
    try {
      const courtService = CourtIntegrationFactory.createService(courtType);
      return await courtService.fileDocument(document);
    } catch (error) {
      throw new Error(`Failed to file document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async checkCaseStatus(
    courtType: 'pacer' | 'state',
    caseId: string
  ): Promise<CaseStatus> {
    try {
      const courtService = CourtIntegrationFactory.createService(courtType);
      return await courtService.checkStatus(caseId);
    } catch (error) {
      throw new Error(`Failed to check case status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async retrieveCaseDocuments(
    courtType: 'pacer' | 'state',
    caseId: string
  ): Promise<LegalDocument[]> {
    try {
      const courtService = CourtIntegrationFactory.createService(courtType);
      return await courtService.retrieveDocuments(caseId);
    } catch (error) {
      throw new Error(`Failed to retrieve case documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async scheduleHearing(
    courtType: 'pacer' | 'state',
    caseId: string,
    hearing: Hearing
  ): Promise<HearingResult> {
    try {
      const courtService = CourtIntegrationFactory.createService(courtType);
      return await courtService.scheduleHearing(caseId, hearing);
    } catch (error) {
      throw new Error(`Failed to schedule hearing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Payment Processing Methods
  async processPayment(
    processor: 'stripe' | 'paypal',
    payment: PaymentRequest
  ): Promise<PaymentResult> {
    try {
      const paymentService = PaymentProcessorFactory.createProcessor(processor);
      return await paymentService.processPayment(payment);
    } catch (error) {
      throw new Error(`Failed to process payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async refundPayment(
    processor: 'stripe' | 'paypal',
    refund: RefundRequest
  ): Promise<RefundResult> {
    try {
      const paymentService = PaymentProcessorFactory.createProcessor(processor);
      return await paymentService.refundPayment(refund);
    } catch (error) {
      throw new Error(`Failed to refund payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createSubscription(
    processor: 'stripe' | 'paypal',
    subscription: Subscription
  ): Promise<SubscriptionResult> {
    try {
      const paymentService = PaymentProcessorFactory.createProcessor(processor);
      return await paymentService.createSubscription(subscription);
    } catch (error) {
      throw new Error(`Failed to create subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Legal Research Methods
  async searchCases(
    service: 'lexisnexis' | 'westlaw',
    query: SearchQuery
  ): Promise<CaseResult[]> {
    try {
      const researchService = LegalResearchServiceFactory.createService(service);
      return await researchService.searchCases(query);
    } catch (error) {
      throw new Error(`Failed to search cases: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getStatutes(
    service: 'lexisnexis' | 'westlaw',
    jurisdiction: string
  ): Promise<Statute[]> {
    try {
      const researchService = LegalResearchServiceFactory.createService(service);
      return await researchService.getStatutes(jurisdiction);
    } catch (error) {
      throw new Error(`Failed to get statutes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async searchRegulations(
    service: 'lexisnexis' | 'westlaw',
    query: string
  ): Promise<Regulation[]> {
    try {
      const researchService = LegalResearchServiceFactory.createService(service);
      return await researchService.searchRegulations(query);
    } catch (error) {
      throw new Error(`Failed to search regulations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async analyzeDocument(
    service: 'lexisnexis' | 'westlaw',
    document: any
  ): Promise<AnalysisResult> {
    try {
      const researchService = LegalResearchServiceFactory.createService(service);
      return await researchService.analyzeDocument(document);
    } catch (error) {
      throw new Error(`Failed to analyze document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Webhook Methods
  async handleWebhook(payload: WebhookPayload): Promise<WebhookResult> {
    try {
      return await this.webhookHandler.handleWebhook(payload);
    } catch (error) {
      throw new Error(`Failed to handle webhook: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async registerWebhook(
    service: string,
    endpoint: string,
    events: string[]
  ): Promise<boolean> {
    try {
      return await this.webhookHandler.registerWebhook(service, endpoint, events);
    } catch (error) {
      throw new Error(`Failed to register webhook: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async unregisterWebhook(service: string, webhookId: string): Promise<boolean> {
    try {
      return await this.webhookHandler.unregisterWebhook(service, webhookId);
    } catch (error) {
      throw new Error(`Failed to unregister webhook: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listWebhooks(service: string): Promise<any[]> {
    try {
      return await this.webhookHandler.listWebhooks(service);
    } catch (error) {
      throw new Error(`Failed to list webhooks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async testWebhook(service: string, webhookId: string): Promise<boolean> {
    try {
      return await this.webhookHandler.testWebhook(service, webhookId);
    } catch (error) {
      throw new Error(`Failed to test webhook: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Utility Methods
  async testAllServices(): Promise<{ [key: string]: boolean }> {
    const results: { [key: string]: boolean } = {};

    try {
      // Test court services
      results.pacer = await this.testPACERConnection();
      results.stateCourts = await this.testStateCourtsConnection();

      // Test payment processors
      results.stripe = await this.testStripeConnection();
      results.paypal = await this.testPayPalConnection();

      // Test legal research services
      results.lexisNexis = await this.testLexisNexisConnection();
      results.westlaw = await this.testWestlawConnection();

    } catch (error) {
      console.error('Service test failed:', error);
    }

    return results;
  }

  private async testPACERConnection(): Promise<boolean> {
    try {
      const pacerService = CourtIntegrationFactory.createService('pacer');
      return await pacerService.testConnection();
    } catch (error) {
      return false;
    }
  }

  private async testStateCourtsConnection(): Promise<boolean> {
    try {
      const stateService = CourtIntegrationFactory.createService('state');
      return await stateService.testConnection();
    } catch (error) {
      return false;
    }
  }

  private async testStripeConnection(): Promise<boolean> {
    try {
      const stripeService = PaymentProcessorFactory.createProcessor('stripe');
      return await stripeService.testConnection();
    } catch (error) {
      return false;
    }
  }

  private async testPayPalConnection(): Promise<boolean> {
    try {
      const paypalService = PaymentProcessorFactory.createProcessor('paypal');
      return await paypalService.testConnection();
    } catch (error) {
      return false;
    }
  }

  private async testLexisNexisConnection(): Promise<boolean> {
    try {
      const lexisService = LegalResearchServiceFactory.createService('lexisnexis');
      return await lexisService.testConnection();
    } catch (error) {
      return false;
    }
  }

  private async testWestlawConnection(): Promise<boolean> {
    try {
      const westlawService = LegalResearchServiceFactory.createService('westlaw');
      return await westlawService.testConnection();
    } catch (error) {
      return false;
    }
  }
}

// Convenience functions for common operations
export const externalServices = {
  client: new ExternalServiceClient(),

  // Court operations
  async filePACERDocument(document: LegalDocument): Promise<FilingResult> {
    return await externalServices.client.fileDocument('pacer', document);
  },

  async fileStateCourtDocument(document: LegalDocument): Promise<FilingResult> {
    return await externalServices.client.fileDocument('state', document);
  },

  // Payment operations
  async processStripePayment(payment: PaymentRequest): Promise<PaymentResult> {
    return await externalServices.client.processPayment('stripe', payment);
  },

  async processPayPalPayment(payment: PaymentRequest): Promise<PaymentResult> {
    return await externalServices.client.processPayment('paypal', payment);
  },

  // Research operations
  async searchLexisNexisCases(query: SearchQuery): Promise<CaseResult[]> {
    return await externalServices.client.searchCases('lexisnexis', query);
  },

  async searchWestlawCases(query: SearchQuery): Promise<CaseResult[]> {
    return await externalServices.client.searchCases('westlaw', query);
  }
};

export default ExternalServiceClient;