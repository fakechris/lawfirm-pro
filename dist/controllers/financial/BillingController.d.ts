import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
export declare class BillingController {
    private prisma;
    private billingService;
    private trustAccountService;
    private feeCalculationService;
    private stageBillingService;
    constructor(prisma: PrismaClient);
    createStageBilling(req: Request, res: Response): Promise<void>;
    getBillingNodes(req: Request, res: Response): Promise<void>;
    completeBillingNode(req: Request, res: Response): Promise<void>;
    generateInvoiceForNode(req: Request, res: Response): Promise<void>;
    getBillingProgress(req: Request, res: Response): Promise<void>;
    autoGenerateInvoices(req: Request, res: Response): Promise<void>;
    createTrustAccount(req: Request, res: Response): Promise<void>;
    getTrustAccount(req: Request, res: Response): Promise<void>;
    getTrustAccountsByClient(req: Request, res: Response): Promise<void>;
    createTrustTransaction(req: Request, res: Response): Promise<void>;
    getTrustAccountBalance(req: Request, res: Response): Promise<void>;
    generateTrustAccountStatement(req: Request, res: Response): Promise<void>;
    checkTrustAccountCompliance(req: Request, res: Response): Promise<void>;
    calculateFee(req: Request, res: Response): Promise<void>;
    calculateMultiCurrencyFee(req: Request, res: Response): Promise<void>;
    convertCurrency(req: Request, res: Response): Promise<void>;
    getCaseFeeEstimation(req: Request, res: Response): Promise<void>;
    createStageBillingSystem(req: Request, res: Response): Promise<void>;
    getStageBillingProgress(req: Request, res: Response): Promise<void>;
    completeBillingMilestone(req: Request, res: Response): Promise<void>;
    validateMilestoneCompletion(req: Request, res: Response): Promise<void>;
    generateBillingSuggestions(req: Request, res: Response): Promise<void>;
    processAutomation(req: Request, res: Response): Promise<void>;
    getFeeTypes(req: Request, res: Response): Promise<void>;
    getPaymentMethods(req: Request, res: Response): Promise<void>;
    getSupportedCurrencies(req: Request, res: Response): Promise<void>;
    healthCheck(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=BillingController.d.ts.map