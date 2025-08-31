import { Request, Response } from 'express';
export declare class InvoiceController {
    createInvoice(req: Request, res: Response): Promise<void>;
    getInvoice(req: Request, res: Response): Promise<void>;
    getInvoices(req: Request, res: Response): Promise<void>;
    updateInvoice(req: Request, res: Response): Promise<void>;
    deleteInvoice(req: Request, res: Response): Promise<void>;
    sendInvoice(req: Request, res: Response): Promise<void>;
    getInvoiceStatistics(req: Request, res: Response): Promise<void>;
    generateInvoicePDF(req: Request, res: Response): Promise<void>;
    generateInvoicePreview(req: Request, res: Response): Promise<void>;
    createTemplate(req: Request, res: Response): Promise<void>;
    getTemplate(req: Request, res: Response): Promise<void>;
    getTemplates(req: Request, res: Response): Promise<void>;
    updateTemplate(req: Request, res: Response): Promise<void>;
    deleteTemplate(req: Request, res: Response): Promise<void>;
    submitTemplateForApproval(req: Request, res: Response): Promise<void>;
    approveTemplate(req: Request, res: Response): Promise<void>;
    setDefaultTemplate(req: Request, res: Response): Promise<void>;
    getTemplateVersions(req: Request, res: Response): Promise<void>;
    duplicateTemplate(req: Request, res: Response): Promise<void>;
    getTemplateUsage(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=InvoiceController.d.ts.map