import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { PaymentService } from '../services/financial/PaymentService';
import { RefundService } from '../services/financial/RefundService';
import { PaymentReconciliationService } from '../services/financial/PaymentReconciliationService';
import { PaymentMethod, PaymentStatus } from '../models/financial';

export class PaymentController {
  private prisma: PrismaClient;
  private paymentService: PaymentService;
  private refundService: RefundService;
  private reconciliationService: PaymentReconciliationService;

  constructor() {
    this.prisma = new PrismaClient();
    this.paymentService = new PaymentService(this.prisma);
    this.refundService = new RefundService(this.prisma);
    this.reconciliationService = new PaymentReconciliationService(this.prisma);
  }

  // Create payment
  async createPayment(req: Request, res: Response): Promise<void> {
    try {
      const paymentRequest = {
        invoiceId: req.body.invoiceId,
        amount: req.body.amount,
        method: req.body.method,
        currency: req.body.currency,
        description: req.body.description,
        clientInfo: req.body.clientInfo,
        returnUrl: req.body.returnUrl,
        notifyUrl: req.body.notifyUrl,
      };

      const result = await this.paymentService.createPayment(paymentRequest);

      if (result.success) {
        res.status(201).json({
          success: true,
          data: {
            payment: result.payment,
            paymentUrl: result.paymentUrl,
            qrCode: result.qrCode,
            transactionId: result.transactionId,
          },
          message: result.message,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          message: result.message,
        });
      }
    } catch (error) {
      console.error('Create payment error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Get payment by ID
  async getPayment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const payment = await this.paymentService.getPaymentById(id);

      if (payment) {
        res.status(200).json({
          success: true,
          data: payment,
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Payment not found',
        });
      }
    } catch (error) {
      console.error('Get payment error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Get payment by reference
  async getPaymentByReference(req: Request, res: Response): Promise<void> {
    try {
      const { reference } = req.params;
      const payment = await this.paymentService.getPaymentByReference(reference);

      if (payment) {
        res.status(200).json({
          success: true,
          data: payment,
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Payment not found',
        });
      }
    } catch (error) {
      console.error('Get payment by reference error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Check payment status
  async checkPaymentStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { transactionId } = req.query;

      const result = await this.paymentService.checkPaymentStatus({
        paymentId: id,
        transactionId: transactionId as string,
      });

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.payment,
          message: result.message,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          message: result.message,
        });
      }
    } catch (error) {
      console.error('Check payment status error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Get payments by invoice
  async getPaymentsByInvoice(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceId } = req.params;
      const payments = await this.paymentService.getPaymentsByInvoice(invoiceId);

      res.status(200).json({
        success: true,
        data: payments,
      });
    } catch (error) {
      console.error('Get payments by invoice error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Get payments by client
  async getPaymentsByClient(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;
      const payments = await this.paymentService.getPaymentsByClient(clientId);

      res.status(200).json({
        success: true,
        data: payments,
      });
    } catch (error) {
      console.error('Get payments by client error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Cancel payment
  async cancelPayment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.paymentService.cancelPayment(id);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.payment,
          message: result.message,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          message: result.message,
        });
      }
    } catch (error) {
      console.error('Cancel payment error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Process refund
  async processRefund(req: Request, res: Response): Promise<void> {
    try {
      const refundRequest = {
        paymentId: req.body.paymentId,
        amount: req.body.amount,
        reason: req.body.reason,
        processedBy: req.user?.id || 'SYSTEM',
        notes: req.body.notes,
      };

      const result = await this.refundService.processRefund(refundRequest);

      if (result.success) {
        res.status(201).json({
          success: true,
          data: result.refund,
          message: result.message,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          message: result.message,
        });
      }
    } catch (error) {
      console.error('Process refund error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Get refund by ID
  async getRefund(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const refund = await this.refundService.getRefundById(id);

      if (refund) {
        res.status(200).json({
          success: true,
          data: refund,
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Refund not found',
        });
      }
    } catch (error) {
      console.error('Get refund error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Get refunds by payment
  async getRefundsByPayment(req: Request, res: Response): Promise<void> {
    try {
      const { paymentId } = req.params;
      const refunds = await this.refundService.getRefundsByPayment(paymentId);

      res.status(200).json({
        success: true,
        data: refunds,
      });
    } catch (error) {
      console.error('Get refunds by payment error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Get refunds by client
  async getRefundsByClient(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;
      const refunds = await this.refundService.getRefundsByClient(clientId);

      res.status(200).json({
        success: true,
        data: refunds,
      });
    } catch (error) {
      console.error('Get refunds by client error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Create credit
  async createCredit(req: Request, res: Response): Promise<void> {
    try {
      const creditRequest = {
        clientId: req.body.clientId,
        amount: req.body.amount,
        currency: req.body.currency,
        reason: req.body.reason,
        expiresAt: req.body.expiresAt,
        processedBy: req.user?.id || 'SYSTEM',
        notes: req.body.notes,
      };

      const result = await this.refundService.createCredit(creditRequest);

      if (result.success) {
        res.status(201).json({
          success: true,
          data: result.credit,
          message: result.message,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          message: result.message,
        });
      }
    } catch (error) {
      console.error('Create credit error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Use credit
  async useCredit(req: Request, res: Response): Promise<void> {
    try {
      const creditUsageRequest = {
        creditId: req.body.creditId,
        invoiceId: req.body.invoiceId,
        amount: req.body.amount,
        processedBy: req.user?.id || 'SYSTEM',
      };

      const result = await this.refundService.useCredit(creditUsageRequest);

      if (result.success) {
        res.status(201).json({
          success: true,
          data: result.usage,
          message: result.message,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          message: result.message,
        });
      }
    } catch (error) {
      console.error('Use credit error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Get credit by ID
  async getCredit(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const credit = await this.refundService.getCreditById(id);

      if (credit) {
        res.status(200).json({
          success: true,
          data: credit,
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Credit not found',
        });
      }
    } catch (error) {
      console.error('Get credit error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Get credits by client
  async getCreditsByClient(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;
      const credits = await this.refundService.getCreditsByClient(clientId);

      res.status(200).json({
        success: true,
        data: credits,
      });
    } catch (error) {
      console.error('Get credits by client error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Get active credits by client
  async getActiveCreditsByClient(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;
      const credits = await this.refundService.getActiveCreditsByClient(clientId);

      res.status(200).json({
        success: true,
        data: credits,
      });
    } catch (error) {
      console.error('Get active credits by client error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Schedule payment
  async schedulePayment(req: Request, res: Response): Promise<void> {
    try {
      const scheduleRequest = {
        invoiceId: req.body.invoiceId,
        amount: req.body.amount,
        method: req.body.method,
        scheduleDate: req.body.scheduleDate,
        clientInfo: req.body.clientInfo,
        description: req.body.description,
      };

      const result = await this.paymentService.schedulePayment(scheduleRequest);

      if (result.success) {
        res.status(201).json({
          success: true,
          message: result.message,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          message: result.message,
        });
      }
    } catch (error) {
      console.error('Schedule payment error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Process webhook
  async processWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { gateway } = req.params;
      const payload = req.body;

      const success = await this.paymentService.processWebhook(
        gateway as PaymentMethod,
        payload
      );

      if (success) {
        res.status(200).json({
          success: true,
          message: 'Webhook processed successfully',
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Webhook processing failed',
        });
      }
    } catch (error) {
      console.error('Process webhook error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Generate reconciliation report
  async generateReconciliationReport(req: Request, res: Response): Promise<void> {
    try {
      const reportRequest = {
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        paymentMethods: req.body.paymentMethods,
        autoMatch: req.body.autoMatch,
        generateReport: req.body.generateReport,
      };

      const report = await this.reconciliationService.generateReconciliationReport(reportRequest);

      res.status(201).json({
        success: true,
        data: report,
      });
    } catch (error) {
      console.error('Generate reconciliation report error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Get reconciliation reports
  async getReconciliationReports(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;

      const reports = await this.reconciliationService.getReconciliationReports(limit, offset);

      res.status(200).json({
        success: true,
        data: reports,
      });
    } catch (error) {
      console.error('Get reconciliation reports error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Get reconciliation report by ID
  async getReconciliationReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const report = await this.reconciliationService.getReconciliationReport(id);

      if (report) {
        res.status(200).json({
          success: true,
          data: report,
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Report not found',
        });
      }
    } catch (error) {
      console.error('Get reconciliation report error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Get discrepancy alerts
  async getDiscrepancyAlerts(req: Request, res: Response): Promise<void> {
    try {
      const resolved = req.query.resolved === 'true';
      const limit = parseInt(req.query.limit as string) || 50;

      const alerts = await this.reconciliationService.getDiscrepancyAlerts(resolved, limit);

      res.status(200).json({
        success: true,
        data: alerts,
      });
    } catch (error) {
      console.error('Get discrepancy alerts error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Resolve discrepancy alert
  async resolveDiscrepancyAlert(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { resolutionNotes } = req.body;
      const resolvedBy = req.user?.id || 'SYSTEM';

      const success = await this.reconciliationService.resolveDiscrepancyAlert(
        id,
        resolvedBy,
        resolutionNotes
      );

      if (success) {
        res.status(200).json({
          success: true,
          message: 'Discrepancy alert resolved successfully',
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Failed to resolve discrepancy alert',
        });
      }
    } catch (error) {
      console.error('Resolve discrepancy alert error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Export reconciliation report
  async exportReconciliationReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { format } = req.query;

      const exportData = await this.reconciliationService.exportReconciliationReport(
        id,
        format as 'CSV' | 'PDF' | 'EXCEL'
      );

      // Set appropriate headers based on format
      const contentType = this.getContentType(format as string);
      const filename = `reconciliation_report_${id}.${format?.toLowerCase() || 'csv'}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(exportData);
    } catch (error) {
      console.error('Export reconciliation report error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Get payment statistics
  async getPaymentStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.query;
      const statistics = await this.paymentService.getPaymentStatistics(
        clientId as string
      );

      res.status(200).json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      console.error('Get payment statistics error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Get payment method statistics
  async getPaymentMethodStatistics(req: Request, res: Response): Promise<void> {
    try {
      const statistics = await this.paymentService.getPaymentMethodStatistics();

      res.status(200).json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      console.error('Get payment method statistics error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Get refund statistics
  async getRefundStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.query;
      const statistics = await this.refundService.getRefundStatistics(
        clientId as string
      );

      res.status(200).json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      console.error('Get refund statistics error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Get credit statistics
  async getCreditStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.query;
      const statistics = await this.refundService.getCreditStatistics(
        clientId as string
      );

      res.status(200).json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      console.error('Get credit statistics error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Get reconciliation statistics
  async getReconciliationStatistics(req: Request, res: Response): Promise<void> {
    try {
      const statistics = await this.reconciliationService.getReconciliationStatistics();

      res.status(200).json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      console.error('Get reconciliation statistics error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  // Helper method to get content type for export
  private getContentType(format: string): string {
    switch (format?.toUpperCase()) {
      case 'PDF':
        return 'application/pdf';
      case 'EXCEL':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'CSV':
      default:
        return 'text/csv';
    }
  }
}