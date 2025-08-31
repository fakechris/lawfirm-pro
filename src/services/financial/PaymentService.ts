import { PrismaClient } from '@prisma/client';
import { Payment, PaymentMethod, PaymentStatus } from '../models/financial';
import { PaymentGatewayService, PaymentGatewayRequest, PaymentGatewayResponse } from './PaymentGatewayService';
import { AlipayService } from './AlipayService';
import { WechatPayService } from './WechatPayService';
import { getPaymentConfig } from '../../config/financial';

export interface PaymentRequest {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  currency?: string;
  description?: string;
  clientInfo: {
    name: string;
    email: string;
    phone?: string;
  };
  returnUrl?: string;
  notifyUrl?: string;
}

export interface PaymentResponse {
  success: boolean;
  payment?: Payment;
  paymentUrl?: string;
  qrCode?: string;
  transactionId?: string;
  error?: string;
  message?: string;
}

export interface PaymentStatusRequest {
  paymentId: string;
  transactionId?: string;
}

export interface PaymentScheduleRequest {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  scheduleDate: Date;
  clientInfo: {
    name: string;
    email: string;
    phone?: string;
  };
  description?: string;
}

export class PaymentService {
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

  // Create and initialize payment
  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      // Validate invoice exists and is payable
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: request.invoiceId },
      });

      if (!invoice) {
        return {
          success: false,
          error: 'Invoice not found',
        };
      }

      if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
        return {
          success: false,
          error: `Invoice cannot be paid. Current status: ${invoice.status}`,
        };
      }

      // Calculate remaining amount
      const paidAmount = await this.calculatePaidAmount(request.invoiceId);
      const remainingAmount = invoice.total - paidAmount;

      if (request.amount > remainingAmount) {
        return {
          success: false,
          error: `Payment amount (${request.amount}) exceeds remaining balance (${remainingAmount})`,
        };
      }

      // Generate unique payment reference
      const paymentReference = this.generatePaymentReference();

      // Create payment record
      const payment = await this.prisma.payment.create({
        data: {
          invoiceId: request.invoiceId,
          amount: request.amount,
          currency: request.currency || this.config.processing.currency,
          method: request.method,
          reference: paymentReference,
          status: PaymentStatus.PENDING,
          notes: request.description,
        },
      });

      // Initialize payment with gateway
      const gatewayRequest: PaymentGatewayRequest = {
        amount: request.amount,
        currency: request.currency || this.config.processing.currency,
        description: request.description || `Payment for invoice ${invoice.invoiceNumber}`,
        orderId: paymentReference,
        clientInfo: request.clientInfo,
        returnUrl: request.returnUrl,
        notifyUrl: request.notifyUrl,
      };

      const gatewayResponse = await this.gatewayService.initializePayment(
        request.method,
        gatewayRequest
      );

      if (!gatewayResponse.success) {
        // Update payment status to failed
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.FAILED },
        });

        return {
          success: false,
          error: gatewayResponse.error || 'Payment initialization failed',
        };
      }

      // Update payment with transaction ID
      if (gatewayResponse.transactionId) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { transactionId: gatewayResponse.transactionId },
        });
      }

      // Return payment response
      return {
        success: true,
        payment: await this.getPaymentById(payment.id),
        paymentUrl: gatewayResponse.paymentUrl,
        qrCode: gatewayResponse.qrCode,
        transactionId: gatewayResponse.transactionId,
        message: 'Payment initialized successfully',
      };
    } catch (error) {
      console.error('Payment creation failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Get payment by ID
  async getPaymentById(paymentId: string): Promise<Payment | null> {
    return await this.prisma.payment.findUnique({
      where: { id: paymentId },
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

  // Get payment by reference
  async getPaymentByReference(reference: string): Promise<Payment | null> {
    return await this.prisma.payment.findFirst({
      where: { reference },
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

  // Check payment status
  async checkPaymentStatus(request: PaymentStatusRequest): Promise<PaymentResponse> {
    try {
      const payment = await this.getPaymentById(request.paymentId);
      if (!payment) {
        return {
          success: false,
          error: 'Payment not found',
        };
      }

      // If transaction ID is provided, check with gateway
      if (request.transactionId && payment.status === PaymentStatus.PENDING) {
        const gatewayStatus = await this.gatewayService.checkPaymentStatus(
          payment.method,
          request.transactionId
        );

        // Update payment status based on gateway response
        if (gatewayStatus !== payment.status) {
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: { status: gatewayStatus },
          });

          // If payment is completed, update invoice status
          if (gatewayStatus === PaymentStatus.COMPLETED) {
            await this.updateInvoicePaymentStatus(payment.invoiceId);
          }
        }
      }

      return {
        success: true,
        payment: await this.getPaymentById(request.paymentId),
        message: 'Payment status retrieved successfully',
      };
    } catch (error) {
      console.error('Payment status check failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Get payments by invoice
  async getPaymentsByInvoice(invoiceId: string): Promise<Payment[]> {
    return await this.prisma.payment.findMany({
      where: { invoiceId },
      include: {
        invoice: {
          include: {
            client: true,
            case: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get payments by client
  async getPaymentsByClient(clientId: string): Promise<Payment[]> {
    return await this.prisma.payment.findMany({
      where: {
        invoice: {
          clientId,
        },
      },
      include: {
        invoice: {
          include: {
            client: true,
            case: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Process payment webhook
  async processWebhook(gateway: PaymentMethod, payload: any): Promise<boolean> {
    try {
      const success = await this.gatewayService.processWebhook(gateway, payload);
      if (success) {
        console.log(`Webhook processed successfully for ${gateway}`);
      }
      return success;
    } catch (error) {
      console.error('Webhook processing failed:', error);
      return false;
    }
  }

  // Schedule payment for future processing
  async schedulePayment(request: PaymentScheduleRequest): Promise<PaymentResponse> {
    try {
      // Validate invoice
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: request.invoiceId },
      });

      if (!invoice) {
        return {
          success: false,
          error: 'Invoice not found',
        };
      }

      // Create scheduled payment record
      const scheduledPayment = await this.prisma.scheduledPayment.create({
        data: {
          invoiceId: request.invoiceId,
          amount: request.amount,
          method: request.method,
          scheduleDate: request.scheduleDate,
          clientName: request.clientInfo.name,
          clientEmail: request.clientInfo.email,
          clientPhone: request.clientInfo.phone,
          description: request.description,
          status: 'SCHEDULED',
        },
      });

      return {
        success: true,
        message: 'Payment scheduled successfully',
      };
    } catch (error) {
      console.error('Payment scheduling failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Process scheduled payments
  async processScheduledPayments(): Promise<void> {
    try {
      const now = new Date();
      const scheduledPayments = await this.prisma.scheduledPayment.findMany({
        where: {
          status: 'SCHEDULED',
          scheduleDate: {
            lte: now,
          },
        },
      });

      for (const scheduledPayment of scheduledPayments) {
        try {
          const paymentRequest: PaymentRequest = {
            invoiceId: scheduledPayment.invoiceId,
            amount: scheduledPayment.amount,
            method: scheduledPayment.method,
            description: scheduledPayment.description,
            clientInfo: {
              name: scheduledPayment.clientName,
              email: scheduledPayment.clientEmail,
              phone: scheduledPayment.clientPhone,
            },
          };

          const result = await this.createPayment(paymentRequest);

          if (result.success) {
            await this.prisma.scheduledPayment.update({
              where: { id: scheduledPayment.id },
              data: { status: 'PROCESSED' },
            });
          } else {
            await this.prisma.scheduledPayment.update({
              where: { id: scheduledPayment.id },
              data: { status: 'FAILED', notes: result.error },
            });
          }
        } catch (error) {
          await this.prisma.scheduledPayment.update({
            where: { id: scheduledPayment.id },
            data: { status: 'FAILED', notes: error.message },
          });
        }
      }
    } catch (error) {
      console.error('Scheduled payment processing failed:', error);
    }
  }

  // Cancel payment
  async cancelPayment(paymentId: string): Promise<PaymentResponse> {
    try {
      const payment = await this.getPaymentById(paymentId);
      if (!payment) {
        return {
          success: false,
          error: 'Payment not found',
        };
      }

      if (payment.status !== PaymentStatus.PENDING) {
        return {
          success: false,
          error: `Cannot cancel payment with status: ${payment.status}`,
        };
      }

      // Update payment status
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.FAILED },
      });

      return {
        success: true,
        payment: await this.getPaymentById(paymentId),
        message: 'Payment cancelled successfully',
      };
    } catch (error) {
      console.error('Payment cancellation failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Helper methods
  private async calculatePaidAmount(invoiceId: string): Promise<number> {
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

  private generatePaymentReference(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `PAY_${timestamp}_${random}`;
  }

  // Get payment statistics
  async getPaymentStatistics(clientId?: string): Promise<any> {
    try {
      const whereClause = clientId
        ? { invoice: { clientId } }
        : {};

      const [
        totalPayments,
        completedPayments,
        pendingPayments,
        failedPayments,
        refundedPayments,
      ] = await Promise.all([
        this.prisma.payment.count({ where: whereClause }),
        this.prisma.payment.count({
          where: { ...whereClause, status: PaymentStatus.COMPLETED },
        }),
        this.prisma.payment.count({
          where: { ...whereClause, status: PaymentStatus.PENDING },
        }),
        this.prisma.payment.count({
          where: { ...whereClause, status: PaymentStatus.FAILED },
        }),
        this.prisma.payment.count({
          where: { ...whereClause, status: PaymentStatus.REFUNDED },
        }),
      ]);

      const totalAmount = await this.prisma.payment.aggregate({
        where: whereClause,
        _sum: { amount: true },
      });

      const completedAmount = await this.prisma.payment.aggregate({
        where: { ...whereClause, status: PaymentStatus.COMPLETED },
        _sum: { amount: true },
      });

      return {
        totalPayments,
        completedPayments,
        pendingPayments,
        failedPayments,
        refundedPayments,
        totalAmount: totalAmount._sum.amount || 0,
        completedAmount: completedAmount._sum.amount || 0,
        successRate: totalPayments > 0 ? (completedPayments / totalPayments) * 100 : 0,
      };
    } catch (error) {
      console.error('Failed to get payment statistics:', error);
      throw error;
    }
  }

  // Get payment methods statistics
  async getPaymentMethodStatistics(): Promise<any> {
    try {
      const payments = await this.prisma.payment.groupBy({
        by: ['method'],
        _count: { id: true },
        _sum: { amount: true },
      });

      return payments.map(item => ({
        method: item.method,
        count: item._count.id,
        totalAmount: item._sum.amount || 0,
      }));
    } catch (error) {
      console.error('Failed to get payment method statistics:', error);
      throw error;
    }
  }
}