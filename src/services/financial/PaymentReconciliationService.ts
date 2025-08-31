import { PrismaClient } from '@prisma/client';
import { Payment, PaymentMethod, PaymentStatus } from '../models/financial';
import { getPaymentConfig } from '../../config/financial';

export interface ReconciliationReport {
  id: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  summary: {
    totalPayments: number;
    totalAmount: number;
    matchedPayments: number;
    matchedAmount: number;
    unmatchedPayments: number;
    unmatchedAmount: number;
    discrepancies: number;
  };
  details: {
    matchedPayments: any[];
    unmatchedPayments: any[];
    discrepancies: any[];
  };
  generatedAt: Date;
  status: string;
}

export interface ReconciliationRequest {
  startDate: Date;
  endDate: Date;
  paymentMethods?: PaymentMethod[];
  autoMatch?: boolean;
  generateReport?: boolean;
}

export interface DiscrepancyAlert {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  paymentId?: string;
  transactionId?: string;
  description: string;
  details: any;
  detectedAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
}

export class PaymentReconciliationService {
  private prisma: PrismaClient;
  private config = getPaymentConfig();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // Generate reconciliation report
  async generateReconciliationReport(request: ReconciliationRequest): Promise<ReconciliationReport> {
    try {
      const reportId = this.generateReportId();
      const generatedAt = new Date();

      // Get payments for the period
      const payments = await this.getPaymentsForPeriod(request.startDate, request.endDate, request.paymentMethods);

      // Match payments with gateway records
      const reconciliationResult = await this.reconcilePayments(payments, request.autoMatch);

      // Calculate summary
      const summary = {
        totalPayments: payments.length,
        totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
        matchedPayments: reconciliationResult.matchedPayments.length,
        matchedAmount: reconciliationResult.matchedPayments.reduce((sum, p) => sum + p.amount, 0),
        unmatchedPayments: reconciliationResult.unmatchedPayments.length,
        unmatchedAmount: reconciliationResult.unmatchedPayments.reduce((sum, p) => sum + p.amount, 0),
        discrepancies: reconciliationResult.discrepancies.length,
      };

      // Create reconciliation report
      const report: ReconciliationReport = {
        id: reportId,
        period: {
          startDate: request.startDate,
          endDate: request.endDate,
        },
        summary,
        details: {
          matchedPayments: reconciliationResult.matchedPayments,
          unmatchedPayments: reconciliationResult.unmatchedPayments,
          discrepancies: reconciliationResult.discrepancies,
        },
        generatedAt,
        status: 'COMPLETED',
      };

      // Save report to database
      await this.saveReconciliationReport(report);

      // Create discrepancy alerts if needed
      if (reconciliationResult.discrepancies.length > 0) {
        await this.createDiscrepancyAlerts(reconciliationResult.discrepancies);
      }

      return report;
    } catch (error) {
      console.error('Reconciliation report generation failed:', error);
      throw error;
    }
  }

  // Auto-reconcile payments
  async autoReconcilePayments(): Promise<void> {
    try {
      const config = this.config.processing;
      
      // Get payments that need reconciliation
      const paymentsToReconcile = await this.prisma.payment.findMany({
        where: {
          status: PaymentStatus.PENDING,
          createdAt: {
            gte: new Date(Date.now() - config.retryDelay * config.retryAttempts),
          },
          OR: [
            { lastReconciledAt: null },
            { lastReconciledAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          ],
        },
      });

      for (const payment of paymentsToReconcile) {
        try {
          await this.reconcilePayment(payment);
        } catch (error) {
          console.error(`Auto-reconciliation failed for payment ${payment.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Auto-reconciliation failed:', error);
    }
  }

  // Reconcile single payment
  async reconcilePayment(payment: Payment): Promise<boolean> {
    try {
      // Check payment status with gateway
      const gatewayService = await this.getGatewayService(payment.method);
      const gatewayStatus = await gatewayService.checkPaymentStatus(
        payment.method,
        payment.transactionId || payment.reference
      );

      // Update payment status based on gateway response
      if (gatewayStatus !== payment.status) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: gatewayStatus,
            lastReconciledAt: new Date(),
          },
        });

        // If payment is completed, update invoice status
        if (gatewayStatus === PaymentStatus.COMPLETED) {
          await this.updateInvoicePaymentStatus(payment.invoiceId);
        }

        return true;
      }

      // Update last reconciled timestamp
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { lastReconciledAt: new Date() },
      });

      return false;
    } catch (error) {
      console.error(`Payment reconciliation failed for ${payment.id}:`, error);
      return false;
    }
  }

  // Get reconciliation reports
  async getReconciliationReports(limit: number = 10, offset: number = 0): Promise<ReconciliationReport[]> {
    try {
      const reports = await this.prisma.reconciliationReport.findMany({
        orderBy: { generatedAt: 'desc' },
        take: limit,
        skip: offset,
      });

      return reports.map(report => ({
        ...report,
        period: {
          startDate: report.startDate,
          endDate: report.endDate,
        },
        summary: report.summary,
        details: report.details,
      }));
    } catch (error) {
      console.error('Failed to get reconciliation reports:', error);
      throw error;
    }
  }

  // Get reconciliation report by ID
  async getReconciliationReport(reportId: string): Promise<ReconciliationReport | null> {
    try {
      const report = await this.prisma.reconciliationReport.findUnique({
        where: { id: reportId },
      });

      if (!report) {
        return null;
      }

      return {
        ...report,
        period: {
          startDate: report.startDate,
          endDate: report.endDate,
        },
        summary: report.summary,
        details: report.details,
      };
    } catch (error) {
      console.error('Failed to get reconciliation report:', error);
      throw error;
    }
  }

  // Get discrepancy alerts
  async getDiscrepancyAlerts(resolved: boolean = false, limit: number = 50): Promise<DiscrepancyAlert[]> {
    try {
      const alerts = await this.prisma.discrepancyAlert.findMany({
        where: { resolved },
        orderBy: { detectedAt: 'desc' },
        take: limit,
      });

      return alerts.map(alert => ({
        ...alert,
        details: alert.details,
      }));
    } catch (error) {
      console.error('Failed to get discrepancy alerts:', error);
      throw error;
    }
  }

  // Resolve discrepancy alert
  async resolveDiscrepancyAlert(alertId: string, resolvedBy: string, resolutionNotes: string): Promise<boolean> {
    try {
      await this.prisma.discrepancyAlert.update({
        where: { id: alertId },
        data: {
          resolved: true,
          resolvedAt: new Date(),
          resolvedBy,
          resolutionNotes,
        },
      });

      return true;
    } catch (error) {
      console.error('Failed to resolve discrepancy alert:', error);
      return false;
    }
  }

  // Get reconciliation statistics
  async getReconciliationStatistics(): Promise<any> {
    try {
      const [
        totalReports,
        lastReport,
        totalDiscrepancies,
        unresolvedDiscrepancies,
        totalPayments,
        reconciledPayments,
      ] = await Promise.all([
        this.prisma.reconciliationReport.count(),
        this.prisma.reconciliationReport.findFirst({
          orderBy: { generatedAt: 'desc' },
        }),
        this.prisma.discrepancyAlert.count(),
        this.prisma.discrepancyAlert.count({ where: { resolved: false } }),
        this.prisma.payment.count(),
        this.prisma.payment.count({
          where: { lastReconciledAt: { not: null } },
        }),
      ]);

      const reconciliationRate = totalPayments > 0 ? (reconciledPayments / totalPayments) * 100 : 0;

      return {
        totalReports,
        lastReport,
        totalDiscrepancies,
        unresolvedDiscrepancies,
        totalPayments,
        reconciledPayments,
        reconciliationRate,
      };
    } catch (error) {
      console.error('Failed to get reconciliation statistics:', error);
      throw error;
    }
  }

  // Export reconciliation report
  async exportReconciliationReport(reportId: string, format: 'CSV' | 'PDF' | 'EXCEL' = 'CSV'): Promise<string> {
    try {
      const report = await this.getReconciliationReport(reportId);
      if (!report) {
        throw new Error('Report not found');
      }

      // Generate export based on format
      switch (format) {
        case 'CSV':
          return this.generateCSVExport(report);
        case 'PDF':
          return this.generatePDFExport(report);
        case 'EXCEL':
          return this.generateExcelExport(report);
        default:
          throw new Error('Unsupported export format');
      }
    } catch (error) {
      console.error('Report export failed:', error);
      throw error;
    }
  }

  // Helper methods
  private async getPaymentsForPeriod(
    startDate: Date,
    endDate: Date,
    paymentMethods?: PaymentMethod[]
  ): Promise<Payment[]> {
    const whereClause: any = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (paymentMethods && paymentMethods.length > 0) {
      whereClause.method = { in: paymentMethods };
    }

    return await this.prisma.payment.findMany({
      where: whereClause,
      include: {
        invoice: {
          include: {
            client: true,
            case: true,
          },
        },
      },
    });
  }

  private async reconcilePayments(payments: Payment[], autoMatch: boolean = true): Promise<any> {
    const matchedPayments: any[] = [];
    const unmatchedPayments: any[] = [];
    const discrepancies: any[] = [];

    for (const payment of payments) {
      try {
        const gatewayService = await this.getGatewayService(payment.method);
        const gatewayStatus = await gatewayService.checkPaymentStatus(
          payment.method,
          payment.transactionId || payment.reference
        );

        // Check for discrepancies
        const discrepancy = this.detectDiscrepancy(payment, gatewayStatus);
        if (discrepancy) {
          discrepancies.push(discrepancy);
          unmatchedPayments.push(payment);
        } else {
          matchedPayments.push(payment);

          // Auto-update payment status if enabled
          if (autoMatch && gatewayStatus !== payment.status) {
            await this.prisma.payment.update({
              where: { id: payment.id },
              data: {
                status: gatewayStatus,
                lastReconciledAt: new Date(),
              },
            });

            // Update invoice status if payment is completed
            if (gatewayStatus === PaymentStatus.COMPLETED) {
              await this.updateInvoicePaymentStatus(payment.invoiceId);
            }
          }
        }
      } catch (error) {
        console.error(`Payment reconciliation failed for ${payment.id}:`, error);
        unmatchedPayments.push(payment);
        discrepancies.push({
          type: 'RECONCILIATION_ERROR',
          severity: 'MEDIUM',
          paymentId: payment.id,
          description: 'Failed to reconcile payment with gateway',
          details: { error: error.message },
          detectedAt: new Date(),
        });
      }
    }

    return { matchedPayments, unmatchedPayments, discrepancies };
  }

  private async getGatewayService(method: PaymentMethod): Promise<any> {
    // Dynamically import the appropriate gateway service
    switch (method) {
      case PaymentMethod.ALIPAY:
        const { AlipayService } = await import('./AlipayService');
        return new AlipayService();
      case PaymentMethod.WECHAT_PAY:
        const { WechatPayService } = await import('./WechatPayService');
        return new WechatPayService();
      default:
        throw new Error(`Gateway service not implemented for method: ${method}`);
    }
  }

  private detectDiscrepancy(payment: Payment, gatewayStatus: string): any {
    // Status mismatch
    if (gatewayStatus !== payment.status) {
      return {
        type: 'STATUS_MISMATCH',
        severity: 'HIGH',
        paymentId: payment.id,
        transactionId: payment.transactionId,
        description: `Payment status mismatch: local=${payment.status}, gateway=${gatewayStatus}`,
        details: {
          localStatus: payment.status,
          gatewayStatus,
        },
        detectedAt: new Date(),
      };
    }

    return null;
  }

  private async saveReconciliationReport(report: ReconciliationReport): Promise<void> {
    await this.prisma.reconciliationReport.create({
      data: {
        id: report.id,
        startDate: report.period.startDate,
        endDate: report.period.endDate,
        summary: report.summary,
        details: report.details,
        generatedAt: report.generatedAt,
        status: report.status,
      },
    });
  }

  private async createDiscrepancyAlerts(discrepancies: any[]): Promise<void> {
    for (const discrepancy of discrepancies) {
      await this.prisma.discrepancyAlert.create({
        data: {
          id: this.generateAlertId(),
          type: discrepancy.type,
          severity: discrepancy.severity,
          paymentId: discrepancy.paymentId,
          transactionId: discrepancy.transactionId,
          description: discrepancy.description,
          details: discrepancy.details,
          detectedAt: discrepancy.detectedAt,
          resolved: false,
        },
      });
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

  private generateReportId(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `RECONC_${timestamp}_${random}`;
  }

  private generateAlertId(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `ALERT_${timestamp}_${random}`;
  }

  private generateCSVExport(report: ReconciliationReport): string {
    // Generate CSV content
    const headers = [
      'Payment ID',
      'Invoice ID',
      'Amount',
      'Currency',
      'Method',
      'Status',
      'Created At',
      'Matched',
    ];

    const rows = [
      ...report.details.matchedPayments.map((p: any) => [
        p.id,
        p.invoiceId,
        p.amount,
        p.currency,
        p.method,
        p.status,
        p.createdAt,
        'YES',
      ]),
      ...report.details.unmatchedPayments.map((p: any) => [
        p.id,
        p.invoiceId,
        p.amount,
        p.currency,
        p.method,
        p.status,
        p.createdAt,
        'NO',
      ]),
    ];

    return [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');
  }

  private generatePDFExport(report: ReconciliationReport): string {
    // For now, return a placeholder
    // In production, this would generate a PDF report
    return `PDF Report for ${report.id}`;
  }

  private generateExcelExport(report: ReconciliationReport): string {
    // For now, return a placeholder
    // In production, this would generate an Excel report
    return `Excel Report for ${report.id}`;
  }
}