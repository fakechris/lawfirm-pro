import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { 
  BillingService,
  BillingMilestone,
  BillingConfiguration,
  StageBillingRequest
} from '../services/financial/BillingService';
import { 
  TrustAccountService,
  TrustAccountRequest,
  TrustTransactionRequest,
  TrustAccountStatement
} from '../services/financial/TrustAccountService';
import { 
  FeeCalculationService,
  FeeCalculationRequest,
  CurrencyConversion
} from '../services/financial/FeeCalculationService';
import { 
  StageBillingService,
  StageBillingConfiguration,
  StageBillingNode,
  StageBillingAutomation
} from '../services/financial/StageBillingService';
import { 
  InvoiceStatus,
  FeeType,
  PaymentMethod,
  PaymentStatus,
  TrustTransactionType
} from '../models/financial';

export class BillingController {
  private prisma: PrismaClient;
  private billingService: BillingService;
  private trustAccountService: TrustAccountService;
  private feeCalculationService: FeeCalculationService;
  private stageBillingService: StageBillingService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.billingService = new BillingService(prisma);
    this.trustAccountService = new TrustAccountService(prisma);
    this.feeCalculationService = new FeeCalculationService(prisma);
    this.stageBillingService = new StageBillingService(prisma);
  }

  // Stage Billing Endpoints

  /**
   * Create stage-based billing for a case
   * POST /api/financial/billing/stage
   */
  async createStageBilling(req: Request, res: Response): Promise<void> {
    try {
      const request: StageBillingRequest = req.body;
      
      const result = await this.billingService.createStageBilling(request);
      
      res.status(201).json({
        success: true,
        data: result,
        message: 'Stage billing created successfully',
      });
    } catch (error) {
      console.error('Error creating stage billing:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to create stage billing',
      });
    }
  }

  /**
   * Get billing nodes for a case
   * GET /api/financial/billing/nodes/:caseId
   */
  async getBillingNodes(req: Request, res: Response): Promise<void> {
    try {
      const { caseId } = req.params;
      const { phase, includeCompleted, includePaid } = req.query;
      
      const billingNodes = await this.billingService.getBillingNodesByCase(caseId, {
        phase: phase as string,
        includeCompleted: includeCompleted === 'true',
        includePaid: includePaid === 'true',
      });
      
      res.json({
        success: true,
        data: billingNodes,
        message: 'Billing nodes retrieved successfully',
      });
    } catch (error) {
      console.error('Error getting billing nodes:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to get billing nodes',
      });
    }
  }

  /**
   * Complete a billing node
   * POST /api/financial/billing/nodes/:nodeId/complete
   */
  async completeBillingNode(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;
      const completionData = req.body;
      
      const result = await this.billingService.completeBillingNode(nodeId, completionData);
      
      res.json({
        success: true,
        data: result,
        message: 'Billing node completed successfully',
      });
    } catch (error) {
      console.error('Error completing billing node:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to complete billing node',
      });
    }
  }

  /**
   * Generate invoice for billing node
   * POST /api/financial/billing/nodes/:nodeId/invoice
   */
  async generateInvoiceForNode(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;
      
      const invoice = await this.billingService.generateInvoiceForBillingNode(nodeId);
      
      res.json({
        success: true,
        data: invoice,
        message: 'Invoice generated successfully',
      });
    } catch (error) {
      console.error('Error generating invoice:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to generate invoice',
      });
    }
  }

  /**
   * Get billing progress for a case
   * GET /api/financial/billing/progress/:caseId
   */
  async getBillingProgress(req: Request, res: Response): Promise<void> {
    try {
      const { caseId } = req.params;
      
      const progress = await this.billingService.getBillingProgress(caseId);
      
      res.json({
        success: true,
        data: progress,
        message: 'Billing progress retrieved successfully',
      });
    } catch (error) {
      console.error('Error getting billing progress:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to get billing progress',
      });
    }
  }

  /**
   * Auto-generate invoices for a case
   * POST /api/financial/billing/auto-generate/:caseId
   */
  async autoGenerateInvoices(req: Request, res: Response): Promise<void> {
    try {
      const { caseId } = req.params;
      
      const invoices = await this.billingService.autoGenerateInvoices(caseId);
      
      res.json({
        success: true,
        data: invoices,
        message: 'Invoices auto-generated successfully',
      });
    } catch (error) {
      console.error('Error auto-generating invoices:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to auto-generate invoices',
      });
    }
  }

  // Trust Account Endpoints

  /**
   * Create trust account
   * POST /api/financial/trust-accounts
   */
  async createTrustAccount(req: Request, res: Response): Promise<void> {
    try {
      const request: TrustAccountRequest = req.body;
      
      const trustAccount = await this.trustAccountService.createTrustAccount(request);
      
      res.status(201).json({
        success: true,
        data: trustAccount,
        message: 'Trust account created successfully',
      });
    } catch (error) {
      console.error('Error creating trust account:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to create trust account',
      });
    }
  }

  /**
   * Get trust account by ID
   * GET /api/financial/trust-accounts/:id
   */
  async getTrustAccount(req: Request, res: Response): Promise<void> {
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
    } catch (error) {
      console.error('Error getting trust account:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to get trust account',
      });
    }
  }

  /**
   * Get trust accounts by client
   * GET /api/financial/trust-accounts/client/:clientId
   */
  async getTrustAccountsByClient(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;
      
      const trustAccounts = await this.trustAccountService.getTrustAccountsByClient(clientId);
      
      res.json({
        success: true,
        data: trustAccounts,
        message: 'Trust accounts retrieved successfully',
      });
    } catch (error) {
      console.error('Error getting trust accounts:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to get trust accounts',
      });
    }
  }

  /**
   * Create trust transaction
   * POST /api/financial/trust-accounts/:accountId/transactions
   */
  async createTrustTransaction(req: Request, res: Response): Promise<void> {
    try {
      const { accountId } = req.params;
      const transactionData: TrustTransactionRequest = req.body;
      
      const transaction = await this.trustAccountService.createTrustTransaction({
        ...transactionData,
        trustAccountId: accountId,
      });
      
      res.status(201).json({
        success: true,
        data: transaction,
        message: 'Trust transaction created successfully',
      });
    } catch (error) {
      console.error('Error creating trust transaction:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to create trust transaction',
      });
    }
  }

  /**
   * Get trust account balance
   * GET /api/financial/trust-accounts/:accountId/balance
   */
  async getTrustAccountBalance(req: Request, res: Response): Promise<void> {
    try {
      const { accountId } = req.params;
      
      const balance = await this.trustAccountService.getTrustAccountBalance(accountId);
      
      res.json({
        success: true,
        data: balance,
        message: 'Trust account balance retrieved successfully',
      });
    } catch (error) {
      console.error('Error getting trust account balance:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to get trust account balance',
      });
    }
  }

  /**
   * Generate trust account statement
   * GET /api/financial/trust-accounts/:accountId/statement
   */
  async generateTrustAccountStatement(req: Request, res: Response): Promise<void> {
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
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
      });
      
      res.json({
        success: true,
        data: statement,
        message: 'Trust account statement generated successfully',
      });
    } catch (error) {
      console.error('Error generating trust account statement:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to generate trust account statement',
      });
    }
  }

  /**
   * Check trust account compliance
   * GET /api/financial/trust-accounts/:accountId/compliance
   */
  async checkTrustAccountCompliance(req: Request, res: Response): Promise<void> {
    try {
      const { accountId } = req.params;
      
      const compliance = await this.trustAccountService.checkTrustAccountCompliance(accountId);
      
      res.json({
        success: true,
        data: compliance,
        message: 'Trust account compliance checked successfully',
      });
    } catch (error) {
      console.error('Error checking trust account compliance:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to check trust account compliance',
      });
    }
  }

  // Fee Calculation Endpoints

  /**
   * Calculate fee
   * POST /api/financial/fees/calculate
   */
  async calculateFee(req: Request, res: Response): Promise<void> {
    try {
      const request: FeeCalculationRequest = req.body;
      
      const result = await this.feeCalculationService.calculateFee(request);
      
      res.json({
        success: true,
        data: result,
        message: 'Fee calculated successfully',
      });
    } catch (error) {
      console.error('Error calculating fee:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to calculate fee',
      });
    }
  }

  /**
   * Calculate multi-currency fee
   * POST /api/financial/fees/calculate-multi-currency
   */
  async calculateMultiCurrencyFee(req: Request, res: Response): Promise<void> {
    try {
      const { request, targetCurrency } = req.body;
      
      const result = await this.feeCalculationService.calculateMultiCurrencyFee(request, targetCurrency);
      
      res.json({
        success: true,
        data: result,
        message: 'Multi-currency fee calculated successfully',
      });
    } catch (error) {
      console.error('Error calculating multi-currency fee:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to calculate multi-currency fee',
      });
    }
  }

  /**
   * Convert currency
   * POST /api/financial/currency/convert
   */
  async convertCurrency(req: Request, res: Response): Promise<void> {
    try {
      const conversion: CurrencyConversion = req.body;
      
      const result = await this.feeCalculationService.convertCurrency(conversion);
      
      res.json({
        success: true,
        data: result,
        message: 'Currency converted successfully',
      });
    } catch (error) {
      console.error('Error converting currency:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to convert currency',
      });
    }
  }

  /**
   * Get case fee estimation
   * GET /api/financial/fees/estimate/:caseId
   */
  async getCaseFeeEstimation(req: Request, res: Response): Promise<void> {
    try {
      const { caseId } = req.params;
      
      const estimation = await this.feeCalculationService.getCaseFeeEstimation(caseId);
      
      res.json({
        success: true,
        data: estimation,
        message: 'Case fee estimation retrieved successfully',
      });
    } catch (error) {
      console.error('Error getting case fee estimation:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to get case fee estimation',
      });
    }
  }

  // Stage Billing Service Endpoints

  /**
   * Create stage billing system
   * POST /api/financial/stage-billing/system
   */
  async createStageBillingSystem(req: Request, res: Response): Promise<void> {
    try {
      const { caseId, billingNodes, configuration } = req.body;
      
      const result = await this.stageBillingService.createStageBillingSystem(caseId, billingNodes, configuration);
      
      res.status(201).json({
        success: true,
        data: result,
        message: 'Stage billing system created successfully',
      });
    } catch (error) {
      console.error('Error creating stage billing system:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to create stage billing system',
      });
    }
  }

  /**
   * Get stage billing progress
   * GET /api/financial/stage-billing/progress/:caseId
   */
  async getStageBillingProgress(req: Request, res: Response): Promise<void> {
    try {
      const { caseId } = req.params;
      
      const progress = await this.stageBillingService.getStageBillingProgress(caseId);
      
      res.json({
        success: true,
        data: progress,
        message: 'Stage billing progress retrieved successfully',
      });
    } catch (error) {
      console.error('Error getting stage billing progress:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to get stage billing progress',
      });
    }
  }

  /**
   * Complete billing milestone
   * POST /api/financial/stage-billing/milestones/:milestoneId/complete
   */
  async completeBillingMilestone(req: Request, res: Response): Promise<void> {
    try {
      const { milestoneId } = req.params;
      const completionData = req.body;
      
      const result = await this.stageBillingService.completeBillingMilestone(milestoneId, completionData);
      
      res.json({
        success: true,
        data: result,
        message: 'Billing milestone completed successfully',
      });
    } catch (error) {
      console.error('Error completing billing milestone:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to complete billing milestone',
      });
    }
  }

  /**
   * Validate billing milestone completion
   * POST /api/financial/stage-billing/milestones/:milestoneId/validate
   */
  async validateMilestoneCompletion(req: Request, res: Response): Promise<void> {
    try {
      const { milestoneId } = req.params;
      const completionData = req.body;
      
      const validation = await this.stageBillingService.validateCompletion(milestoneId, completionData);
      
      res.json({
        success: true,
        data: validation,
        message: 'Milestone completion validated successfully',
      });
    } catch (error) {
      console.error('Error validating milestone completion:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to validate milestone completion',
      });
    }
  }

  /**
   * Generate billing suggestions
   * GET /api/financial/stage-billing/suggestions/:caseId
   */
  async generateBillingSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const { caseId } = req.params;
      
      const suggestions = await this.stageBillingService.generateBillingSuggestions(caseId);
      
      res.json({
        success: true,
        data: suggestions,
        message: 'Billing suggestions generated successfully',
      });
    } catch (error) {
      console.error('Error generating billing suggestions:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to generate billing suggestions',
      });
    }
  }

  /**
   * Process automation
   * POST /api/financial/stage-billing/automation/:caseId/process
   */
  async processAutomation(req: Request, res: Response): Promise<void> {
    try {
      const { caseId } = req.params;
      
      const result = await this.stageBillingService.processAutomation(caseId);
      
      res.json({
        success: true,
        data: result,
        message: 'Automation processed successfully',
      });
    } catch (error) {
      console.error('Error processing automation:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to process automation',
      });
    }
  }

  // Utility Endpoints

  /**
   * Get supported fee types
   * GET /api/financial/fees/types
   */
  async getFeeTypes(req: Request, res: Response): Promise<void> {
    try {
      const feeTypes = Object.values(FeeType);
      
      res.json({
        success: true,
        data: feeTypes,
        message: 'Fee types retrieved successfully',
      });
    } catch (error) {
      console.error('Error getting fee types:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to get fee types',
      });
    }
  }

  /**
   * Get supported payment methods
   * GET /api/financial/payment-methods
   */
  async getPaymentMethods(req: Request, res: Response): Promise<void> {
    try {
      const paymentMethods = Object.values(PaymentMethod);
      
      res.json({
        success: true,
        data: paymentMethods,
        message: 'Payment methods retrieved successfully',
      });
    } catch (error) {
      console.error('Error getting payment methods:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to get payment methods',
      });
    }
  }

  /**
   * Get supported currencies
   * GET /api/financial/currencies
   */
  async getSupportedCurrencies(req: Request, res: Response): Promise<void> {
    try {
      const currencies = ['CNY', 'USD', 'EUR', 'GBP', 'JPY'];
      
      res.json({
        success: true,
        data: currencies,
        message: 'Supported currencies retrieved successfully',
      });
    } catch (error) {
      console.error('Error getting supported currencies:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to get supported currencies',
      });
    }
  }

  /**
   * Health check
   * GET /api/financial/health
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Simple health check - verify database connection
      await this.prisma.$queryRaw`SELECT 1`;
      
      res.json({
        success: true,
        message: 'Financial services are healthy',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(500).json({
        success: false,
        message: 'Financial services are unhealthy',
        error: error.message,
      });
    }
  }
}