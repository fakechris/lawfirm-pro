import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { PaymentGatewayService } from './PaymentGatewayService';
import { AlipayService } from './AlipayService';
import { WechatPayService } from './WechatPayService';
import { PaymentMethod, PaymentStatus } from '../models/financial';
import { getPaymentConfig } from '../../config/financial';

export class PaymentWebhookService {
  private prisma: PrismaClient;
  private paymentGatewayService: PaymentGatewayService;
  private alipayService: AlipayService;
  private wechatPayService: WechatPayService;
  private config = getPaymentConfig();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.paymentGatewayService = new PaymentGatewayService(prisma);
    this.alipayService = new AlipayService();
    this.wechatPayService = new WechatPayService();
  }

  // Handle Alipay webhook
  async handleAlipayWebhook(req: Request, res: Response): Promise<void> {
    try {
      const payload = req.body;
      
      // Verify webhook signature
      if (!this.alipayService.verifyWebhookSignature(payload)) {
        res.status(400).json({ success: false, message: 'Invalid signature' });
        return;
      }

      // Parse webhook payload
      const webhookData = this.alipayService.parseWebhookPayload(payload);
      
      // Process webhook
      const success = await this.paymentGatewayService.processWebhook(
        PaymentMethod.ALIPAY,
        webhookData
      );

      if (success) {
        // Log webhook processing
        await this.logWebhook('ALIPAY', payload, 'SUCCESS');
        
        // Respond to Alipay
        res.json({ success: true });
      } else {
        await this.logWebhook('ALIPAY', payload, 'FAILED');
        res.status(500).json({ success: false, message: 'Webhook processing failed' });
      }
    } catch (error) {
      console.error('Alipay webhook error:', error);
      await this.logWebhook('ALIPAY', req.body, 'ERROR', error.message);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Handle WeChat Pay webhook
  async handleWechatPayWebhook(req: Request, res: Response): Promise<void> {
    try {
      // WeChat Pay sends XML data
      const xmlData = req.body;
      const payload = this.parseWechatXML(xmlData);
      
      // Verify webhook signature
      if (!this.wechatPayService.verifyWebhookSignature(payload)) {
        res.status(400).json({ success: false, message: 'Invalid signature' });
        return;
      }

      // Parse webhook payload
      const webhookData = this.wechatPayService.parseWebhookPayload(payload);
      
      // Process webhook
      const success = await this.paymentGatewayService.processWebhook(
        PaymentMethod.WECHAT_PAY,
        webhookData
      );

      if (success) {
        // Log webhook processing
        await this.logWebhook('WECHAT_PAY', payload, 'SUCCESS');
        
        // Respond to WeChat Pay
        res.send('<xml><return_code><![CDATA[SUCCESS]]></return_code></xml>');
      } else {
        await this.logWebhook('WECHAT_PAY', payload, 'FAILED');
        res.status(500).json({ success: false, message: 'Webhook processing failed' });
      }
    } catch (error) {
      console.error('WeChat Pay webhook error:', error);
      await this.logWebhook('WECHAT_PAY', req.body, 'ERROR', error.message);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Handle generic payment webhook (for testing and other gateways)
  async handleGenericWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { gateway, transactionId, status, amount, signature } = req.body;
      
      // Verify webhook signature if configured
      if (this.config.webhooks.enabled && this.config.webhooks.secret) {
        if (!this.verifyGenericSignature(req.body, signature)) {
          res.status(400).json({ success: false, message: 'Invalid signature' });
          return;
        }
      }

      // Find payment record
      const payment = await this.prisma.payment.findFirst({
        where: { transactionId },
      });

      if (!payment) {
        res.status(404).json({ success: false, message: 'Payment not found' });
        return;
      }

      // Update payment status
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: status as PaymentStatus,
          reference: JSON.stringify(req.body),
        },
      });

      // If payment is completed, update invoice status
      if (status === PaymentStatus.COMPLETED) {
        await this.updateInvoicePaymentStatus(payment.invoiceId);
      }

      // Log webhook processing
      await this.logWebhook(gateway, req.body, 'SUCCESS');

      res.json({ success: true });
    } catch (error) {
      console.error('Generic webhook error:', error);
      await this.logWebhook('GENERIC', req.body, 'ERROR', error.message);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Retry failed webhook processing
  async retryFailedWebhooks(): Promise<void> {
    try {
      const failedWebhooks = await this.prisma.webhookLog.findMany({
        where: { status: 'FAILED' },
        orderBy: { createdAt: 'desc' },
        take: 100, // Process in batches
      });

      for (const webhook of failedWebhooks) {
        try {
          const payload = JSON.parse(webhook.payload);
          
          let success = false;
          switch (webhook.gateway) {
            case 'ALIPAY':
              success = await this.paymentGatewayService.processWebhook(
                PaymentMethod.ALIPAY,
                this.alipayService.parseWebhookPayload(payload)
              );
              break;
            case 'WECHAT_PAY':
              success = await this.paymentGatewayService.processWebhook(
                PaymentMethod.WECHAT_PAY,
                this.wechatPayService.parseWebhookPayload(payload)
              );
              break;
          }

          if (success) {
            await this.prisma.webhookLog.update({
              where: { id: webhook.id },
              data: { status: 'RETRIED_SUCCESS' },
            });
          }
        } catch (error) {
          console.error(`Failed to retry webhook ${webhook.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to retry webhooks:', error);
    }
  }

  // Get webhook processing statistics
  async getWebhookStats(): Promise<any> {
    try {
      const stats = await this.prisma.webhookLog.groupBy({
        by: ['gateway', 'status'],
        _count: { id: true },
        _sum: { retryCount: true },
      });

      const totalWebhooks = await this.prisma.webhookLog.count();
      const successRate = await this.prisma.webhookLog.count({
        where: { status: 'SUCCESS' },
      }) / totalWebhooks;

      return {
        totalWebhooks,
        successRate,
        gatewayStats: stats,
      };
    } catch (error) {
      throw new Error(`Failed to get webhook stats: ${error.message}`);
    }
  }

  // Helper methods
  private parseWechatXML(xmlData: string): any {
    // Simple XML parser - in production, use a proper XML parser
    const result: any = {};
    const regex = /<([^>]+)><!\[CDATA\[([^]]*)\]\]><\/\1>/g;
    let match;
    
    while ((match = regex.exec(xmlData)) !== null) {
      result[match[1]] = match[2];
    }
    
    return result;
  }

  private verifyGenericSignature(payload: any, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.config.webhooks.secret!)
        .update(JSON.stringify(payload))
        .digest('hex');
      
      return expectedSignature === signature;
    } catch (error) {
      return false;
    }
  }

  private async updateInvoicePaymentStatus(invoiceId: string): Promise<void> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true },
    });

    if (!invoice) return;

    const totalPaid = invoice.payments
      .filter(p => p.status === PaymentStatus.COMPLETED)
      .reduce((sum, p) => sum + p.amount, 0);

    let status: any;
    if (totalPaid >= invoice.total) {
      status = 'PAID';
    } else if (totalPaid > 0) {
      status = 'PARTIALLY_PAID';
    } else {
      status = 'UNPAID';
    }

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status },
    });
  }

  private async logWebhook(
    gateway: string,
    payload: any,
    status: string,
    error?: string
  ): Promise<void> {
    try {
      await this.prisma.webhookLog.create({
        data: {
          gateway,
          payload: JSON.stringify(payload),
          status,
          error: error,
        },
      });
    } catch (logError) {
      console.error('Failed to log webhook:', logError);
    }
  }

  // Security middleware for webhook endpoints
  verifyWebhookRequest(req: Request, res: Response, next: Function): void {
    try {
      // Check if webhook is enabled
      if (!this.config.webhooks.enabled) {
        res.status(403).json({ success: false, message: 'Webhooks disabled' });
        return;
      }

      // Rate limiting
      if (this.config.security.rateLimiting.enabled) {
        const clientIp = req.ip;
        // Implement rate limiting logic here
        // This is a simplified version - in production, use proper rate limiting middleware
      }

      // IP whitelist/blacklist check
      if (this.config.security.ipWhitelist.length > 0) {
        if (!this.config.security.ipWhitelist.includes(req.ip)) {
          res.status(403).json({ success: false, message: 'IP not allowed' });
          return;
        }
      }

      if (this.config.security.ipBlacklist.includes(req.ip)) {
        res.status(403).json({ success: false, message: 'IP blocked' });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}