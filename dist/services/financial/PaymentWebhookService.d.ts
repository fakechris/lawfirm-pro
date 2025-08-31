import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
export declare class PaymentWebhookService {
    private prisma;
    private paymentGatewayService;
    private alipayService;
    private wechatPayService;
    private config;
    constructor(prisma: PrismaClient);
    handleAlipayWebhook(req: Request, res: Response): Promise<void>;
    handleWechatPayWebhook(req: Request, res: Response): Promise<void>;
    handleGenericWebhook(req: Request, res: Response): Promise<void>;
    retryFailedWebhooks(): Promise<void>;
    getWebhookStats(): Promise<any>;
    private parseWechatXML;
    private verifyGenericSignature;
    private updateInvoicePaymentStatus;
    private logWebhook;
    verifyWebhookRequest(req: Request, res: Response, next: Function): void;
}
//# sourceMappingURL=PaymentWebhookService.d.ts.map