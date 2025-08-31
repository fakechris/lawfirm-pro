"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.externalServices = exports.ExternalServiceClient = void 0;
const courts_1 = require("../../integrations/courts");
const payments_1 = require("../../integrations/payments");
const legal_1 = require("../../integrations/legal");
const WebhookHandler_1 = require("../../webhooks/WebhookHandler");
class ExternalServiceClient {
    constructor() {
        this.webhookHandler = new WebhookHandler_1.WebhookHandler();
    }
    async fileDocument(courtType, document) {
        try {
            const courtService = courts_1.CourtIntegrationFactory.createService(courtType);
            return await courtService.fileDocument(document);
        }
        catch (error) {
            throw new Error(`Failed to file document: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async checkCaseStatus(courtType, caseId) {
        try {
            const courtService = courts_1.CourtIntegrationFactory.createService(courtType);
            return await courtService.checkStatus(caseId);
        }
        catch (error) {
            throw new Error(`Failed to check case status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async retrieveCaseDocuments(courtType, caseId) {
        try {
            const courtService = courts_1.CourtIntegrationFactory.createService(courtType);
            return await courtService.retrieveDocuments(caseId);
        }
        catch (error) {
            throw new Error(`Failed to retrieve case documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async scheduleHearing(courtType, caseId, hearing) {
        try {
            const courtService = courts_1.CourtIntegrationFactory.createService(courtType);
            return await courtService.scheduleHearing(caseId, hearing);
        }
        catch (error) {
            throw new Error(`Failed to schedule hearing: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async processPayment(processor, payment) {
        try {
            const paymentService = payments_1.PaymentProcessorFactory.createProcessor(processor);
            return await paymentService.processPayment(payment);
        }
        catch (error) {
            throw new Error(`Failed to process payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async refundPayment(processor, refund) {
        try {
            const paymentService = payments_1.PaymentProcessorFactory.createProcessor(processor);
            return await paymentService.refundPayment(refund);
        }
        catch (error) {
            throw new Error(`Failed to refund payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async createSubscription(processor, subscription) {
        try {
            const paymentService = payments_1.PaymentProcessorFactory.createProcessor(processor);
            return await paymentService.createSubscription(subscription);
        }
        catch (error) {
            throw new Error(`Failed to create subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async searchCases(service, query) {
        try {
            const researchService = legal_1.LegalResearchServiceFactory.createService(service);
            return await researchService.searchCases(query);
        }
        catch (error) {
            throw new Error(`Failed to search cases: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getStatutes(service, jurisdiction) {
        try {
            const researchService = legal_1.LegalResearchServiceFactory.createService(service);
            return await researchService.getStatutes(jurisdiction);
        }
        catch (error) {
            throw new Error(`Failed to get statutes: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async searchRegulations(service, query) {
        try {
            const researchService = legal_1.LegalResearchServiceFactory.createService(service);
            return await researchService.searchRegulations(query);
        }
        catch (error) {
            throw new Error(`Failed to search regulations: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async analyzeDocument(service, document) {
        try {
            const researchService = legal_1.LegalResearchServiceFactory.createService(service);
            return await researchService.analyzeDocument(document);
        }
        catch (error) {
            throw new Error(`Failed to analyze document: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async handleWebhook(payload) {
        try {
            return await this.webhookHandler.handleWebhook(payload);
        }
        catch (error) {
            throw new Error(`Failed to handle webhook: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async registerWebhook(service, endpoint, events) {
        try {
            return await this.webhookHandler.registerWebhook(service, endpoint, events);
        }
        catch (error) {
            throw new Error(`Failed to register webhook: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async unregisterWebhook(service, webhookId) {
        try {
            return await this.webhookHandler.unregisterWebhook(service, webhookId);
        }
        catch (error) {
            throw new Error(`Failed to unregister webhook: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async listWebhooks(service) {
        try {
            return await this.webhookHandler.listWebhooks(service);
        }
        catch (error) {
            throw new Error(`Failed to list webhooks: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async testWebhook(service, webhookId) {
        try {
            return await this.webhookHandler.testWebhook(service, webhookId);
        }
        catch (error) {
            throw new Error(`Failed to test webhook: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async testAllServices() {
        const results = {};
        try {
            results.pacer = await this.testPACERConnection();
            results.stateCourts = await this.testStateCourtsConnection();
            results.stripe = await this.testStripeConnection();
            results.paypal = await this.testPayPalConnection();
            results.lexisNexis = await this.testLexisNexisConnection();
            results.westlaw = await this.testWestlawConnection();
        }
        catch (error) {
            console.error('Service test failed:', error);
        }
        return results;
    }
    async testPACERConnection() {
        try {
            const pacerService = courts_1.CourtIntegrationFactory.createService('pacer');
            return await pacerService.testConnection();
        }
        catch (error) {
            return false;
        }
    }
    async testStateCourtsConnection() {
        try {
            const stateService = courts_1.CourtIntegrationFactory.createService('state');
            return await stateService.testConnection();
        }
        catch (error) {
            return false;
        }
    }
    async testStripeConnection() {
        try {
            const stripeService = payments_1.PaymentProcessorFactory.createProcessor('stripe');
            return await stripeService.testConnection();
        }
        catch (error) {
            return false;
        }
    }
    async testPayPalConnection() {
        try {
            const paypalService = payments_1.PaymentProcessorFactory.createProcessor('paypal');
            return await paypalService.testConnection();
        }
        catch (error) {
            return false;
        }
    }
    async testLexisNexisConnection() {
        try {
            const lexisService = legal_1.LegalResearchServiceFactory.createService('lexisnexis');
            return await lexisService.testConnection();
        }
        catch (error) {
            return false;
        }
    }
    async testWestlawConnection() {
        try {
            const westlawService = legal_1.LegalResearchServiceFactory.createService('westlaw');
            return await westlawService.testConnection();
        }
        catch (error) {
            return false;
        }
    }
}
exports.ExternalServiceClient = ExternalServiceClient;
exports.externalServices = {
    client: new ExternalServiceClient(),
    async filePACERDocument(document) {
        return await exports.externalServices.client.fileDocument('pacer', document);
    },
    async fileStateCourtDocument(document) {
        return await exports.externalServices.client.fileDocument('state', document);
    },
    async processStripePayment(payment) {
        return await exports.externalServices.client.processPayment('stripe', payment);
    },
    async processPayPalPayment(payment) {
        return await exports.externalServices.client.processPayment('paypal', payment);
    },
    async searchLexisNexisCases(query) {
        return await exports.externalServices.client.searchCases('lexisnexis', query);
    },
    async searchWestlawCases(query) {
        return await exports.externalServices.client.searchCases('westlaw', query);
    }
};
exports.default = ExternalServiceClient;
//# sourceMappingURL=ExternalServiceClient.js.map