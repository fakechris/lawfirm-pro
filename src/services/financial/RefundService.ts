import { PrismaClient } from '@prisma/client';
import { Payment, PaymentMethod, PaymentStatus } from '../models/financial';
import { PaymentGatewayService } from './PaymentGatewayService';
import { AlipayService } from './AlipayService';
import { WechatPayService } from './WechatPayService';
import { getPaymentConfig } from '../../config/financial';

export interface RefundRequest {
  paymentId: string;
  amount?: number; // Partial refund if specified, full refund if not
  reason: string;
  processedBy: string;
  notes?: string;
}

export interface RefundResponse {
  success: boolean;
  refund?: any;
  error?: string;
  message?: string;
}

export interface CreditRequest {
  clientId: string;
  amount: number;
  currency?: string;
  reason: string;
  expiresAt?: Date;
  processedBy: string;
  notes?: string;
}

export interface CreditResponse {
  success: boolean;
  credit?: any;
  error?: string;
  message?: string;
}

export interface CreditUsageRequest {
  creditId: string;
  invoiceId: string;
  amount: number;
  processedBy: string;
}

export interface CreditUsageResponse {
  success: boolean;
  usage?: any;
  error?: string;
  message?: string;
}

export class RefundService {
  private prisma: PrismaClient;
  private gatewayService: PaymentGatewayService;
  private alipayService: AlipayService;
  private wechatPayService: WechatPayService;
  private config = getPaymentConfig();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.gatewayService = new PaymentGatewayService(prisma);
    this.alipayService = new AlipayService();
    this.wechatPayService = new WechatPayService();
  }

  // Process refund for a payment
  async processRefund(request: RefundRequest): Promise<RefundResponse> {
    try {
      // Get payment details
      const payment = await this.prisma.payment.findUnique({
        where: { id: request.paymentId },
        include: {
          invoice: {
            include: {
              client: true,
              case: true,
            },
          },
        },
      });

      if (!payment) {
        return {
          success: false,
          error: 'Payment not found',
        };
      }

      // Validate payment can be refunded
      if (payment.status !== PaymentStatus.COMPLETED) {
        return {
          success: false,
          error: `Payment cannot be refunded. Current status: ${payment.status}`,
        };
      }

      // Check if payment has already been refunded
      const existingRefunds = await this.prisma.refund.findMany({
        where: { paymentId: request.paymentId },
      });

      const totalRefunded = existingRefunds.reduce((sum, refund) => sum + refund.amount, 0);
      const refundableAmount = payment.amount - totalRefunded;

      const refundAmount = request.amount || refundableAmount;

      if (refundAmount > refundableAmount) {
        return {
          success: false,
          error: `Refund amount (${refundAmount}) exceeds refundable balance (${refundableAmount})`,
        };
      }

      // Generate refund reference
      const refundReference = this.generateRefundReference();

      // Process refund through gateway
      const gatewayResponse = await this.gatewayService.refundPayment(
        payment.method,
        payment.transactionId || payment.reference,
        refundAmount,
        request.reason
      );

      if (!gatewayResponse.success) {
        return {
          success: false,
          error: gatewayResponse.error || 'Refund processing failed',
        };
      }

      // Create refund record
      const refund = await this.prisma.refund.create({
        data: {
          paymentId: request.paymentId,
          invoiceId: payment.invoiceId,
          clientId: payment.invoice.clientId,
          amount: refundAmount,
          currency: payment.currency,
          reason: request.reason,
          reference: refundReference,
          gatewayTransactionId: gatewayResponse.transactionId,
          status: 'COMPLETED',
          processedBy: request.processedBy,
          notes: request.notes,
        },
      });

      // Update payment status
      let newPaymentStatus = payment.status;
      if (refundAmount >= payment.amount) {
        newPaymentStatus = PaymentStatus.REFUNDED;
      } else {
        newPaymentStatus = PaymentStatus.PARTIALLY_REFUNDED;
      }

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: newPaymentStatus },
      });

      // Update invoice status
      await this.updateInvoicePaymentStatus(payment.invoiceId);

      return {
        success: true,
        refund: await this.getRefundById(refund.id),
        message: 'Refund processed successfully',
      };
    } catch (error) {
      console.error('Refund processing failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Create client credit
  async createCredit(request: CreditRequest): Promise<CreditResponse> {
    try {
      // Validate client exists
      const client = await this.prisma.client.findUnique({
        where: { id: request.clientId },
      });

      if (!client) {
        return {
          success: false,
          error: 'Client not found',
        };
      }

      // Generate credit reference
      const creditReference = this.generateCreditReference();

      // Create credit record
      const credit = await this.prisma.credit.create({
        data: {
          clientId: request.clientId,
          amount: request.amount,
          currency: request.currency || this.config.processing.currency,
          reason: request.reason,
          reference: creditReference,
          balance: request.amount,
          expiresAt: request.expiresAt,
          status: 'ACTIVE',
          processedBy: request.processedBy,
          notes: request.notes,
        },
      });

      return {
        success: true,
        credit: await this.getCreditById(credit.id),
        message: 'Credit created successfully',
      };
    } catch (error) {
      console.error('Credit creation failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Use credit for invoice payment
  async useCredit(request: CreditUsageRequest): Promise<CreditUsageResponse> {
    try {
      // Get credit details
      const credit = await this.prisma.credit.findUnique({
        where: { id: request.creditId },
      });

      if (!credit) {
        return {
          success: false,
          error: 'Credit not found',
        };
      }

      if (credit.status !== 'ACTIVE') {
        return {
          success: false,
          error: `Credit is not active. Current status: ${credit.status}`,
        };
      }

      if (credit.balance < request.amount) {
        return {
          success: false,
          error: `Insufficient credit balance. Available: ${credit.balance}, Requested: ${request.amount}`,
        };
      }

      // Check if credit is expired
      if (credit.expiresAt && new Date() > credit.expiresAt) {
        return {
          success: false,
          error: 'Credit has expired',
        };
      }

      // Get invoice details
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: request.invoiceId },
      });

      if (!invoice) {
        return {
          success: false,
          error: 'Invoice not found',
        };
      }

      // Calculate remaining invoice amount
      const paidAmount = await this.calculateInvoicePaidAmount(request.invoiceId);
      const remainingAmount = invoice.total - paidAmount;

      if (request.amount > remainingAmount) {
        return {
          success: false,
          error: `Credit amount (${request.amount}) exceeds invoice balance (${remainingAmount})`,
        };
      }

      // Create credit usage record
      const usage = await this.prisma.creditUsage.create({
        data: {
          creditId: request.creditId,
          invoiceId: request.invoiceId,
          amount: request.amount,
          processedBy: request.processedBy,
        },
      });

      // Update credit balance
      const newBalance = credit.balance - request.amount;
      const newStatus = newBalance <= 0 ? 'USED' : 'ACTIVE';

      await this.prisma.credit.update({
        where: { id: request.creditId },
        data: {
          balance: newBalance,
          status: newStatus,
        },
      });

      // Create payment record for credit usage
      await this.prisma.payment.create({
        data: {
          invoiceId: request.invoiceId,
          amount: request.amount,
          currency: credit.currency,
          method: PaymentMethod.CASH, // Representing credit as cash
          reference: this.generatePaymentReference(),
          status: PaymentStatus.COMPLETED,
          notes: `Payment using credit ${credit.reference}`,
        },
      });

      // Update invoice status
      await this.updateInvoicePaymentStatus(request.invoiceId);

      return {
        success: true,
        usage: await this.getCreditUsageById(usage.id),
        message: 'Credit used successfully',
      };
    } catch (error) {
      console.error('Credit usage failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Get refund by ID
  async getRefundById(refundId: string): Promise<any> {
    return await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: {
        payment: {
          include: {
            invoice: {
              include: {
                client: true,
                case: true,
              },
            },
          },
        },
        processor: true,
      },
    });
  }

  // Get refunds by payment
  async getRefundsByPayment(paymentId: string): Promise<any[]> {
    return await this.prisma.refund.findMany({
      where: { paymentId },
      include: {
        payment: {
          include: {
            invoice: {
              include: {
                client: true,
                case: true,
              },
            },
          },
        },
        processor: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get refunds by client
  async getRefundsByClient(clientId: string): Promise<any[]> {
    return await this.prisma.refund.findMany({
      where: { clientId },
      include: {
        payment: {
          include: {
            invoice: {
              include: {
                client: true,
                case: true,
              },
            },
          },
        },
        processor: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get credit by ID
  async getCreditById(creditId: string): Promise<any> {
    return await this.prisma.credit.findUnique({
      where: { id: creditId },
      include: {
        client: true,
        processor: true,
        usages: {
          include: {
            invoice: true,
          },
        },
      },
    });
  }

  // Get credits by client
  async getCreditsByClient(clientId: string): Promise<any[]> {
    return await this.prisma.credit.findMany({
      where: { clientId },
      include: {
        client: true,
        processor: true,
        usages: {
          include: {
            invoice: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get active credits by client
  async getActiveCreditsByClient(clientId: string): Promise<any[]> {
    return await this.prisma.credit.findMany({
      where: {
        clientId,
        status: 'ACTIVE',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        client: true,
        processor: true,
        usages: {
          include: {
            invoice: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get credit usage by ID
  async getCreditUsageById(usageId: string): Promise<any> {
    return await this.prisma.creditUsage.findUnique({
      where: { id: usageId },
      include: {
        credit: {
          include: {
            client: true,
          },
        },
        invoice: true,
        processor: true,
      },
    });
  }

  // Get credit usage by credit
  async getCreditUsageByCredit(creditId: string): Promise<any[]> {
    return await this.prisma.creditUsage.findMany({
      where: { creditId },
      include: {
        credit: {
          include: {
            client: true,
          },
        },
        invoice: true,
        processor: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Process automatic refunds (for failed payments)
  async processAutomaticRefunds(): Promise<void> {
    try {
      // Find failed payments that are eligible for automatic refund
      const failedPayments = await this.prisma.payment.findMany({
        where: {
          status: PaymentStatus.FAILED,
          createdAt: {
            // Within last 24 hours
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      });

      for (const payment of failedPayments) {
        try {
          // Check if payment has already been refunded
          const existingRefunds = await this.prisma.refund.findMany({
            where: { paymentId: payment.id },
          });

          if (existingRefunds.length === 0) {
            // Create automatic refund
            const refundRequest: RefundRequest = {
              paymentId: payment.id,
              amount: payment.amount,
              reason: 'Automatic refund for failed payment',
              processedBy: 'SYSTEM',
            };

            await this.processRefund(refundRequest);
          }
        } catch (error) {
          console.error(`Automatic refund failed for payment ${payment.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Automatic refund processing failed:', error);
    }
  }

  // Expire old credits
  async expireOldCredits(): Promise<void> {
    try {
      const expiredCredits = await this.prisma.credit.findMany({
        where: {
          status: 'ACTIVE',
          expiresAt: {
            lt: new Date(),
          },
          balance: {
            gt: 0,
          },
        },
      });

      for (const credit of expiredCredits) {
        await this.prisma.credit.update({
          where: { id: credit.id },
          data: { status: 'EXPIRED' },
        });
      }
    } catch (error) {
      console.error('Credit expiration failed:', error);
    }
  }

  // Get refund statistics
  async getRefundStatistics(clientId?: string): Promise<any> {
    try {
      const whereClause = clientId
        ? { clientId }
        : {};

      const [
        totalRefunds,
        completedRefunds,
        pendingRefunds,
        failedRefunds,
      ] = await Promise.all([
        this.prisma.refund.count({ where: whereClause }),
        this.prisma.refund.count({
          where: { ...whereClause, status: 'COMPLETED' },
        }),
        this.prisma.refund.count({
          where: { ...whereClause, status: 'PENDING' },
        }),
        this.prisma.refund.count({
          where: { ...whereClause, status: 'FAILED' },
        }),
      ]);

      const totalRefunded = await this.prisma.refund.aggregate({
        where: whereClause,
        _sum: { amount: true },
      });

      return {
        totalRefunds,
        completedRefunds,
        pendingRefunds,
        failedRefunds,
        totalRefunded: totalRefunded._sum.amount || 0,
        successRate: totalRefunds > 0 ? (completedRefunds / totalRefunds) * 100 : 0,
      };
    } catch (error) {
      console.error('Failed to get refund statistics:', error);
      throw error;
    }
  }

  // Get credit statistics
  async getCreditStatistics(clientId?: string): Promise<any> {
    try {
      const whereClause = clientId
        ? { clientId }
        : {};

      const [
        totalCredits,
        activeCredits,
        usedCredits,
        expiredCredits,
      ] = await Promise.all([
        this.prisma.credit.count({ where: whereClause }),
        this.prisma.credit.count({
          where: { ...whereClause, status: 'ACTIVE' },
        }),
        this.prisma.credit.count({
          where: { ...whereClause, status: 'USED' },
        }),
        this.prisma.credit.count({
          where: { ...whereClause, status: 'EXPIRED' },
        }),
      ]);

      const totalCreditAmount = await this.prisma.credit.aggregate({
        where: whereClause,
        _sum: { amount: true },
      });

      const activeCreditBalance = await this.prisma.credit.aggregate({
        where: { ...whereClause, status: 'ACTIVE' },
        _sum: { balance: true },
      });

      return {
        totalCredits,
        activeCredits,
        usedCredits,
        expiredCredits,
        totalCreditAmount: totalCreditAmount._sum.amount || 0,
        activeCreditBalance: activeCreditBalance._sum.balance || 0,
      };
    } catch (error) {
      console.error('Failed to get credit statistics:', error);
      throw error;
    }
  }

  // Helper methods
  private async calculateInvoicePaidAmount(invoiceId: string): Promise<number> {
    const payments = await this.prisma.payment.findMany({
      where: {
        invoiceId,
        status: PaymentStatus.COMPLETED,
      },
    });

    return payments.reduce((sum, payment) => sum + payment.amount, 0);
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

  private generateRefundReference(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `REF_${timestamp}_${random}`;
  }

  private generateCreditReference(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `CREDIT_${timestamp}_${random}`;
  }

  private generatePaymentReference(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `PAY_${timestamp}_${random}`;
  }
}