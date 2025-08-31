"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingController = void 0;
const BillingService_1 = require("../services/financial/BillingService");
const TrustAccountService_1 = require("../services/financial/TrustAccountService");
const FeeCalculationService_1 = require("../services/financial/FeeCalculationService");
const StageBillingService_1 = require("../services/financial/StageBillingService");
const financial_1 = require("../models/financial");
class BillingController {
    constructor(prisma) {
        this.prisma = prisma;
        this.billingService = new BillingService_1.BillingService(prisma);
        this.trustAccountService = new TrustAccountService_1.TrustAccountService(prisma);
        this.feeCalculationService = new FeeCalculationService_1.FeeCalculationService(prisma);
        this.stageBillingService = new StageBillingService_1.StageBillingService(prisma);
    }
    async createStageBilling(req, res) {
        try {
            const request = req.body;
            const result = await this.billingService.createStageBilling(request);
            res.status(201).json({
                success: true,
                data: result,
                message: 'Stage billing created successfully',
            });
        }
        catch (error) {
            console.error('Error creating stage billing:', error);
            res.status(400).json({
                success: false,
                error: error.message,
                message: 'Failed to create stage billing',
            });
        }
    }
    async getBillingNodes(req, res) {
        try {
            const { caseId } = req.params;
            const { phase, includeCompleted, includePaid } = req.query;
            const billingNodes = await this.billingService.getBillingNodesByCase(caseId, {
                phase: phase,
                includeCompleted: includeCompleted === 'true',
                includePaid: includePaid === 'true',
            });
            res.json({
                success: true,
                data: billingNodes,
                message: 'Billing nodes retrieved successfully',
            });
        }
        catch (error) {
            console.error('Error getting billing nodes:', error);
            res.status(400).json({
                success: false,
                error: error.message,
                message: 'Failed to get billing nodes',
            });
        }
    }
    async completeBillingNode(req, res) {
        try {
            const { nodeId } = req.params;
            const completionData = req.body;
            const result = await this.billingService.completeBillingNode(nodeId, completionData);
            res.json({
                success: true,
                data: result,
                message: 'Billing node completed successfully',
            });
        }
        catch (error) {
            console.error('Error completing billing node:', error);
            res.status(400).json({
                success: false,
                error: error.message,
                message: 'Failed to complete billing node',
            });
        }
    }
    async generateInvoiceForNode(req, res) {
        try {
            const { nodeId } = req.params;
            const invoice = await this.billingService.generateInvoiceForBillingNode(nodeId);
            res.json({
                success: true,
                data: invoice,
                message: 'Invoice generated successfully',
            });
        }
        catch (error) {
            console.error('Error generating invoice:', error);
            res.status(400).json({
                success: false,
                error: error.message,
                message: 'Failed to generate invoice',
            });
        }
    }
    async getBillingProgress(req, res) {
        try {
            const { caseId } = req.params;
            const progress = await this.billingService.getBillingProgress(caseId);
            res.json({
                success: true,
                data: progress,
                message: 'Billing progress retrieved successfully',
            });
        }
        catch (error) {
            console.error('Error getting billing progress:', error);
            res.status(400).json({
                success: false,
                error: error.message,
                message: 'Failed to get billing progress',
            });
        }
    }
    async autoGenerateInvoices(req, res) {
        try {
            const { caseId } = req.params;
            const invoices = await this.billingService.autoGenerateInvoices(caseId);
            res.json({
                success: true,
                data: invoices,
                message: 'Invoices auto-generated successfully',
            });
        }
        catch (error) {
            console.error('Error auto-generating invoices:', error);
            res.status(400).json({
                success: false,
                error: error.message,
                message: 'Failed to auto-generate invoices',
            });
        }
    }
    async createTrustAccount(req, res) {
        try {
            const request = req.body;
            const trustAccount = await this.trustAccountService.createTrustAccount(request);
            res.status(201).json({
                success: true,
                data: trustAccount,
                message: 'Trust account created successfully',
            });
        }
        catch (error) {
            console.error('Error creating trust account:', error);
            res.status(400).json({
                success: false,
                error: error.message,
                message: 'Failed to create trust account',
            });
        }
    }
    async getTrustAccount(req, res) {
        try {
            const { id } = req.params;
            const trustAccount = await this.trustAccountService.getTrustAccountById(id);
            if (!trustAccount) {
                res.status(404).json({
                    success: false,
                    message: 'Trust account not found',
                });
                return;
            }
            res.json({
                success: true,
                data: trustAccount,
                message: 'Trust account retrieved successfully',
            });
        }
        catch (error) {
            console.error('Error getting trust account:', error);
            res.status(400).json({
                success: false,
                error: error.message,
                message: 'Failed to get trust account',
            });
        }
    }
    async getTrustAccountsByClient(req, res) {
        try {
            const { clientId } = req.params;
            const trustAccounts = await this.trustAccountService.getTrustAccountsByClient(clientId);
            res.json({
                success: true,
                data: trustAccounts,
                message: 'Trust accounts retrieved successfully',
            });
        }
        catch (error) {
            console.error('Error getting trust accounts:', error);
            res.status(400).json({
                success: false,
                error: error.message,
                message: 'Failed to get trust accounts',
            });
        }
    }
    async createTrustTransaction(req, res) {
        try {
            const { accountId } = req.params;
            const transactionData = req.body;
            const transaction = await this.trustAccountService.createTrustTransaction({
                ...transactionData,
                trustAccountId: accountId,
            });
            res.status(201).json({
                success: true,
                data: transaction,
                message: 'Trust transaction created successfully',
            });
        }
        catch (error) {
            console.error('Error creating trust transaction:', error);
            res.status(400).json({
                success: false,
                error: error.message,
                message: 'Failed to create trust transaction',
            });
        }
    }
    async getTrustAccountBalance(req, res) {
        try {
            const { accountId } = req.params;
            const balance = await this.trustAccountService.getTrustAccountBalance(accountId);
            res.json({
                success: true,
                data: balance,
                message: 'Trust account balance retrieved successfully',
            });
        }
        catch (error) {
            console.error('Error getting trust account balance:', error);
            res.status(400).json({
                success: false,
                error: error.message,
                message: 'Failed to get trust account balance',
            });
        }
    }
    async generateTrustAccountStatement(req, res) {
        try {
            const { accountId } = req.params;
            const { startDate, endDate } = req.query;
            if (!startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    message: 'Start date and end date are required',
                });
                return;
            }
            const statement = await this.trustAccountService.generateTrustAccountStatement(accountId, {
                startDate: new Date(startDate),
                endDate: new Date(endDate),
            });
            res.json({
                success: true,
                data: statement,
                message: 'Trust account statement generated successfully',
            });
        }
        catch (error) {
            console.error('Error generating trust account statement:', error);
            res.status(400).json({
                success: false,
                error: error.message,
                message: 'Failed to generate trust account statement',
            });
        }
    }
    async checkTrustAccountCompliance(req, res) {
        try {
            const { accountId } = req.params;
            const compliance = await this.trustAccountService.checkTrustAccountCompliance(accountId);
            res.json({
                success: true,
                data: compliance,
                message: 'Trust account compliance checked successfully',
            });
        }
        catch (error) {
            console.error('Error checking trust account compliance:', error);
            res.status(400).json({
                success: false,
                error: error.message,
                message: 'Failed to check trust account compliance',
            });
        }
    }
    async calculateFee(req, res) {
        try {
            const request = req.body;
            const result = await this.feeCalculationService.calculateFee(request);
            res.json({
                success: true,
                data: result,
                message: 'Fee calculated successfully',
            });
        }
        catch (error) {
            console.error('Error calculating fee:', error);
            res.status(400).json({
                success: false,
                error: error.message,
                message: 'Failed to calculate fee',
            });
        }
    }
    async calculateMultiCurrencyFee(req, res) {
        try {
            const { request, targetCurrency } = req.body;
            const result = await this.feeCalculationService.calculateMultiCurrencyFee(request, targetCurrency);
            res.json({
                success: true,
                data: result,
                message: 'Multi-currency fee calculated successfully',
            });
        }
        catch (error) {
            console.error('Error calculating multi-currency fee:', error);
            res.status(400).json({
                success: false,
                error: error.message,
                message: 'Failed to calculate multi-currency fee',
            });
        }
    }
    async convertCurrency(req, res) {
        try {
            const conversion = req.body;
            const result = await this.feeCalculationService.convertCurrency(conversion);
            res.json({
                success: true,
                data: result,
                message: 'Currency converted successfully',
            });
        }
        catch (error) {
            console.error('Error converting currency:', error);
            res.status(400).json({
                success: false,
                error: error.message,
                message: 'Failed to convert currency',
            });
        }
    }
    async getCaseFeeEstimation(req, res) {
        try {
            const { caseId } = req.params;
            const estimation = await this.feeCalculationService.getCaseFeeEstimation(caseId);
            res.json({
                success: true,
                data: estimation,
                message: 'Case fee estimation retrieved successfully',
            });
        }
        catch (error) {
            console.error('Error getting case fee estimation:', error);
            res.status(400).json({
                success: false,
                error: error.message,
                message: 'Failed to get case fee estimation',
            });
        }
    }
    async createStageBillingSystem(req, res) {
        try {
            const { caseId, billingNodes, configuration } = req.body;
            const result = await this.stageBillingService.createStageBillingSystem(caseId, billingNodes, configuration);
            res.status(201).json({
                success: true,
                data: result,
                message: 'Stage billing system created successfully',
            });
        }
        catch (error) {
            console.error('Error creating stage billing system:', error);
            res.status(400).json({
                success: false,
                error: error.message,
                message: 'Failed to create stage billing system',
            });
        }
    }
    async getStageBillingProgress(req, res) {
        try {
            const { caseId } = req.params;
            const progress = await this.stageBillingService.getStageBillingProgress(caseId);
            res.json({
                success: true,
                data: progress,
                message: 'Stage billing progress retrieved successfully',
            });
        }
        catch (error) {
            console.error('Error getting stage billing progress:', error);
            res.status(400).json({
                success: false,
                error: error.message,
                message: 'Failed to get stage billing progress',
            });
        }
    }
    async completeBillingMilestone(req, res) {
        try {
            const { milestoneId } = req.params;
            const completionData = req.body;
            const result = await this.stageBillingService.completeBillingMilestone(milestoneId, completionData);
            res.json({
                success: true,
                data: result,
                message: 'Billing milestone completed successfully',
            });
        }
        catch (error) {
            console.error('Error completing billing milestone:', error);
            res.status(400).json({
                success: false,
                error: error.message,
                message: 'Failed to complete billing milestone',
            });
        }
    }
    async validateMilestoneCompletion(req, res) {
        try {
            const { milestoneId } = req.params;
            const completionData = req.body;
            const validation = await this.stageBillingService.validateCompletion(milestoneId, completionData);
            res.json({
                success: true,
                data: validation,
                message: 'Milestone completion validated successfully',
            });
        }
        catch (error) {
            console.error('Error validating milestone completion:', error);
            res.status(400).json({
                success: false,
                error: error.message,
                message: 'Failed to validate milestone completion',
            });
        }
    }
    async generateBillingSuggestions(req, res) {
        try {
            const { caseId } = req.params;
            const suggestions = await this.stageBillingService.generateBillingSuggestions(caseId);
            res.json({
                success: true,
                data: suggestions,
                message: 'Billing suggestions generated successfully',
            });
        }
        catch (error) {
            console.error('Error generating billing suggestions:', error);
            res.status(400).json({
                success: false,
                error: error.message,
                message: 'Failed to generate billing suggestions',
            });
        }
    }
    async processAutomation(req, res) {
        try {
            const { caseId } = req.params;
            const result = await this.stageBillingService.processAutomation(caseId);
            res.json({
                success: true,
                data: result,
                message: 'Automation processed successfully',
            });
        }
        catch (error) {
            console.error('Error processing automation:', error);
            res.status(400).json({
                success: false,
                error: error.message,
                message: 'Failed to process automation',
            });
        }
    }
    async getFeeTypes(req, res) {
        try {
            const feeTypes = Object.values(financial_1.FeeType);
            res.json({
                success: true,
                data: feeTypes,
                message: 'Fee types retrieved successfully',
            });
        }
        catch (error) {
            console.error('Error getting fee types:', error);
            res.status(400).json({
                success: false,
                error: error.message,
                message: 'Failed to get fee types',
            });
        }
    }
    async getPaymentMethods(req, res) {
        try {
            const paymentMethods = Object.values(financial_1.PaymentMethod);
            res.json({
                success: true,
                data: paymentMethods,
                message: 'Payment methods retrieved successfully',
            });
        }
        catch (error) {
            console.error('Error getting payment methods:', error);
            res.status(400).json({
                success: false,
                error: error.message,
                message: 'Failed to get payment methods',
            });
        }
    }
    async getSupportedCurrencies(req, res) {
        try {
            const currencies = ['CNY', 'USD', 'EUR', 'GBP', 'JPY'];
            res.json({
                success: true,
                data: currencies,
                message: 'Supported currencies retrieved successfully',
            });
        }
        catch (error) {
            console.error('Error getting supported currencies:', error);
            res.status(400).json({
                success: false,
                error: error.message,
                message: 'Failed to get supported currencies',
            });
        }
    }
    async healthCheck(req, res) {
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            res.json({
                success: true,
                message: 'Financial services are healthy',
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error('Health check failed:', error);
            res.status(500).json({
                success: false,
                message: 'Financial services are unhealthy',
                error: error.message,
            });
        }
    }
}
exports.BillingController = BillingController;
//# sourceMappingURL=BillingController.js.map