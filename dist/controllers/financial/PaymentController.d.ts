import { Request, Response } from 'express';
export declare class PaymentController {
    private prisma;
    private paymentService;
    private refundService;
    private reconciliationService;
    constructor();
    createPayment(req: Request, res: Response): Promise<void>;
    getPayment(req: Request, res: Response): Promise<void>;
    getPaymentByReference(req: Request, res: Response): Promise<void>;
    checkPaymentStatus(req: Request, res: Response): Promise<void>;
    getPaymentsByInvoice(req: Request, res: Response): Promise<void>;
    getPaymentsByClient(req: Request, res: Response): Promise<void>;
    cancelPayment(req: Request, res: Response): Promise<void>;
    processRefund(req: Request, res: Response): Promise<void>;
    getRefund(req: Request, res: Response): Promise<void>;
    getRefundsByPayment(req: Request, res: Response): Promise<void>;
    getRefundsByClient(req: Request, res: Response): Promise<void>;
    createCredit(req: Request, res: Response): Promise<void>;
    useCredit(req: Request, res: Response): Promise<void>;
    getCredit(req: Request, res: Response): Promise<void>;
    getCreditsByClient(req: Request, res: Response): Promise<void>;
    getActiveCreditsByClient(req: Request, res: Response): Promise<void>;
    schedulePayment(req: Request, res: Response): Promise<void>;
    processWebhook(req: Request, res: Response): Promise<void>;
    generateReconciliationReport(req: Request, res: Response): Promise<void>;
    getReconciliationReports(req: Request, res: Response): Promise<void>;
    getReconciliationReport(req: Request, res: Response): Promise<void>;
    getDiscrepancyAlerts(req: Request, res: Response): Promise<void>;
    resolveDiscrepancyAlert(req: Request, res: Response): Promise<void>;
    exportReconciliationReport(req: Request, res: Response): Promise<void>;
    getPaymentStatistics(req: Request, res: Response): Promise<void>;
    getPaymentMethodStatistics(req: Request, res: Response): Promise<void>;
    getRefundStatistics(req: Request, res: Response): Promise<void>;
    getCreditStatistics(req: Request, res: Response): Promise<void>;
    getReconciliationStatistics(req: Request, res: Response): Promise<void>;
    private getContentType;
}
//# sourceMappingURL=PaymentController.d.ts.map