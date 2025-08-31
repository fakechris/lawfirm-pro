import { PrismaClient } from '@prisma/client';
import { 
  Invoice, 
  InvoiceItem, 
  BillingNode, 
  FeeStructure, 
  TimeEntry, 
  Expense, 
  Payment,
  TrustAccount,
  TrustTransaction,
  InvoiceStatus,
  FeeType,
  ExpenseCategory,
  PaymentMethod,
  PaymentStatus,
  TrustTransactionType
} from '../models/financial';
import { PaymentGatewayService } from './PaymentGatewayService';

export class FinancialService {
  private prisma: PrismaClient;
  private paymentGatewayService: PaymentGatewayService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.paymentGatewayService = new PaymentGatewayService(prisma);
  }

  // Billing Node Management
  async createBillingNode(data: {
    name: string;
    description?: string;
    caseId: string;
    phase: string;
    order: number;
    amount: number;
    dueDate?: Date;
    notes?: string;
  }) {
    return this.prisma.billingNode.create({
      data: {
        name: data.name,
        description: data.description,
        caseId: data.caseId,
        phase: data.phase,
        order: data.order,
        amount: data.amount,
        dueDate: data.dueDate,
        notes: data.notes,
      },
    });
  }

  async getBillingNodesByCase(caseId: string) {
    return this.prisma.billingNode.findMany({
      where: { caseId, isActive: true },
      orderBy: { order: 'asc' },
    });
  }

  async updateBillingNode(id: string, data: Partial<BillingNode>) {
    return this.prisma.billingNode.update({
      where: { id },
      data,
    });
  }

  // Invoice Management
  async createInvoice(data: {
    invoiceNumber: string;
    caseId?: string;
    clientId: string;
    userId: string;
    dueDate: Date;
    items: Omit<InvoiceItem, 'id' | 'invoiceId' | 'createdAt' | 'updatedAt'>[];
  }) {
    const subtotal = data.items.reduce((sum, item) => sum + item.amount, 0);
    const taxRate = 0.06; // 6% VAT for China
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;

    return this.prisma.invoice.create({
      data: {
        invoiceNumber: data.invoiceNumber,
        caseId: data.caseId,
        clientId: data.clientId,
        userId: data.userId,
        dueDate: data.dueDate,
        subtotal,
        taxRate,
        taxAmount,
        total,
        items: {
          create: data.items.map(item => ({
            type: item.type,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
            taxRate: item.taxRate,
            taxAmount: item.amount * item.taxRate,
            total: item.amount * (1 + item.taxRate),
          })),
        },
      },
      include: {
        items: true,
        client: true,
        case: true,
        user: true,
      },
    });
  }

  async getInvoiceById(id: string) {
    return this.prisma.invoice.findUnique({
      where: { id },
      include: {
        items: true,
        client: true,
        case: true,
        user: true,
        payments: true,
      },
    });
  }

  async getInvoicesByClient(clientId: string) {
    return this.prisma.invoice.findMany({
      where: { clientId },
      include: {
        items: true,
        case: true,
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateInvoiceStatus(id: string, status: InvoiceStatus) {
    return this.prisma.invoice.update({
      where: { id },
      data: { status },
    });
  }

  // Time Entry Management
  async createTimeEntry(data: {
    caseId: string;
    userId: string;
    description: string;
    hours: number;
    rate: number;
    date: Date;
    notes?: string;
  }) {
    const amount = data.hours * data.rate;
    return this.prisma.timeEntry.create({
      data: {
        caseId: data.caseId,
        userId: data.userId,
        description: data.description,
        hours: data.hours,
        rate: data.rate,
        amount,
        date: data.date,
        notes: data.notes,
      },
    });
  }

  async getTimeEntriesByCase(caseId: string) {
    return this.prisma.timeEntry.findMany({
      where: { caseId },
      include: {
        user: true,
        case: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  async getTimeEntriesByUser(userId: string, startDate?: Date, endDate?: Date) {
    const where: any = { userId };
    if (startDate && endDate) {
      where.date = { gte: startDate, lte: endDate };
    }

    return this.prisma.timeEntry.findMany({
      where,
      include: {
        case: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  // Expense Management
  async createExpense(data: {
    caseId?: string;
    userId: string;
    category: ExpenseCategory;
    description: string;
    amount: number;
    date: Date;
    receiptUrl?: string;
    notes?: string;
  }) {
    return this.prisma.expense.create({
      data: {
        caseId: data.caseId,
        userId: data.userId,
        category: data.category,
        description: data.description,
        amount: data.amount,
        date: data.date,
        receiptUrl: data.receiptUrl,
        notes: data.notes,
      },
    });
  }

  async getExpensesByCase(caseId: string) {
    return this.prisma.expense.findMany({
      where: { caseId },
      include: {
        user: true,
        case: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  async getExpensesByUser(userId: string, startDate?: Date, endDate?: Date) {
    const where: any = { userId };
    if (startDate && endDate) {
      where.date = { gte: startDate, lte: endDate };
    }

    return this.prisma.expense.findMany({
      where,
      include: {
        case: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  // Payment Management
  async createPayment(data: {
    invoiceId: string;
    amount: number;
    method: PaymentMethod;
    reference?: string;
    transactionId?: string;
    notes?: string;
  }) {
    return this.prisma.payment.create({
      data: {
        invoiceId: data.invoiceId,
        amount: data.amount,
        method: data.method,
        reference: data.reference,
        transactionId: data.transactionId,
        notes: data.notes,
      },
    });
  }

  async updatePaymentStatus(id: string, status: PaymentStatus) {
    return this.prisma.payment.update({
      where: { id },
      data: { status },
    });
  }

  async getPaymentsByInvoice(invoiceId: string) {
    return this.prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Trust Account Management
  async createTrustAccount(data: {
    clientId: string;
    caseId?: string;
    notes?: string;
  }) {
    return this.prisma.trustAccount.create({
      data: {
        clientId: data.clientId,
        caseId: data.caseId,
        notes: data.notes,
      },
    });
  }

  async getTrustAccountsByClient(clientId: string) {
    return this.prisma.trustAccount.findMany({
      where: { clientId, isActive: true },
      include: {
        client: true,
        case: true,
      },
    });
  }

  async createTrustTransaction(data: {
    trustAccountId: string;
    type: TrustTransactionType;
    amount: number;
    description: string;
    reference?: string;
  }) {
    return this.prisma.trustTransaction.create({
      data: {
        trustAccountId: data.trustAccountId,
        type: data.type,
        amount: data.amount,
        description: data.description,
        reference: data.reference,
      },
    });
  }

  // Financial Reporting
  async getFinancialReport(caseId?: string, clientId?: string, startDate?: Date, endDate?: Date) {
    const where: any = {};
    if (caseId) where.caseId = caseId;
    if (clientId) where.clientId = clientId;
    if (startDate && endDate) {
      where.createdAt = { gte: startDate, lte: endDate };
    }

    const [invoices, payments, expenses, timeEntries] = await Promise.all([
      this.prisma.invoice.findMany({
        where: caseId ? { caseId } : clientId ? { clientId } : {},
        include: { payments: true, items: true },
      }),
      this.prisma.payment.findMany({
        where: {
          invoice: caseId ? { caseId } : clientId ? { clientId } : {},
          ...(startDate && endDate && { createdAt: { gte: startDate, lte: endDate } }),
        },
      }),
      this.prisma.expense.findMany({
        where: {
          ...(caseId && { caseId }),
          ...(clientId && { userId: clientId }), // This might need adjustment
          ...(startDate && endDate && { date: { gte: startDate, lte: endDate } }),
        },
      }),
      this.prisma.timeEntry.findMany({
        where: {
          ...(caseId && { caseId }),
          ...(startDate && endDate && { date: { gte: startDate, lte: endDate } }),
        },
      }),
    ]);

    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalPaid = payments
      .filter(p => p.status === PaymentStatus.COMPLETED)
      .reduce((sum, p) => sum + p.amount, 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const totalHours = timeEntries.reduce((sum, te) => sum + te.hours, 0);
    const totalTimeValue = timeEntries.reduce((sum, te) => sum + te.amount, 0);

    return {
      summary: {
        totalInvoiced,
        totalPaid,
        totalExpenses,
        totalHours,
        totalTimeValue,
        outstandingBalance: totalInvoiced - totalPaid,
        profit: totalPaid - totalExpenses,
      },
      details: {
        invoices,
        payments,
        expenses,
        timeEntries,
      },
    };
  }

  // Stage-based Billing
  async generateCaseBilling(caseId: string) {
    const caseData = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: {
        billingNodes: { where: { isActive: true }, orderBy: { order: 'asc' } },
        timeEntries: { where: { isBilled: false } },
        expenses: { where: { isBilled: false, isBillable: true } },
      },
    });

    if (!caseData) {
      throw new Error('Case not found');
    }

    const currentPhase = caseData.phase;
    const phaseBillingNodes = caseData.billingNodes.filter(node => node.phase === currentPhase);
    const unbilledTimeEntries = caseData.timeEntries;
    const unbilledExpenses = caseData.expenses;

    return {
      currentPhase,
      billingNodes: phaseBillingNodes,
      unbilledTimeEntries,
      unbilledExpenses,
      suggestedInvoice: {
        caseId,
        clientId: caseData.clientId,
        items: [
          ...phaseBillingNodes.map(node => ({
            type: 'billing_node' as const,
            description: node.name,
            quantity: 1,
            unitPrice: node.amount,
            amount: node.amount,
          })),
          ...unbilledTimeEntries.map(entry => ({
            type: 'time_entry' as const,
            description: entry.description,
            quantity: entry.hours,
            unitPrice: entry.rate,
            amount: entry.amount,
          })),
          ...unbilledExpenses.map(expense => ({
            type: 'expense' as const,
            description: expense.description,
            quantity: 1,
            unitPrice: expense.amount,
            amount: expense.amount,
          })),
        ],
      },
    };
  }

  // Fee Calculation Engine
  async calculateFee(
    feeType: FeeType,
    params: {
      hours?: number;
      rate?: number;
      settlementAmount?: number;
      baseAmount?: number;
      percentage?: number;
      minimum?: number;
      maximum?: number;
    }
  ): number {
    switch (feeType) {
      case FeeType.HOURLY:
        if (!params.hours || !params.rate) {
          throw new Error('Hours and rate are required for hourly fees');
        }
        return params.hours * params.rate;

      case FeeType.FLAT:
        if (!params.baseAmount) {
          throw new Error('Base amount is required for flat fees');
        }
        return params.baseAmount;

      case FeeType.CONTINGENCY:
        if (!params.settlementAmount || !params.percentage) {
          throw new Error('Settlement amount and percentage are required for contingency fees');
        }
        const contingencyFee = params.settlementAmount * (params.percentage / 100);
        if (params.minimum && contingencyFee < params.minimum) {
          return params.minimum;
        }
        if (params.maximum && contingencyFee > params.maximum) {
          return params.maximum;
        }
        return contingencyFee;

      case FeeType.RETAINER:
        if (!params.baseAmount) {
          throw new Error('Base amount is required for retainer fees');
        }
        return params.baseAmount;

      case FeeType.HYBRID:
        // Combination of hourly and contingency
        let hybridFee = 0;
        if (params.hours && params.rate) {
          hybridFee += params.hours * params.rate;
        }
        if (params.settlementAmount && params.percentage) {
          hybridFee += params.settlementAmount * (params.percentage / 100);
        }
        return hybridFee;

      default:
        throw new Error(`Unsupported fee type: ${feeType}`);
    }
  }

  // Payment Processing Methods
  async processPayment(data: {
    invoiceId: string;
    amount: number;
    method: PaymentMethod;
    clientInfo: {
      name: string;
      email: string;
      phone?: string;
    };
    description?: string;
  }) {
    // Get invoice details
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: data.invoiceId },
      include: { client: true, case: true },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Check if payment amount is valid
    if (data.amount <= 0) {
      throw new Error('Payment amount must be greater than 0');
    }

    // Check if payment amount exceeds invoice total
    const totalPaid = await this.getTotalPaidAmount(data.invoiceId);
    if (totalPaid + data.amount > invoice.total) {
      throw new Error('Payment amount exceeds invoice total');
    }

    // Initialize payment with gateway
    const paymentRequest = {
      amount: data.amount,
      currency: invoice.currency,
      description: data.description || `Payment for invoice ${invoice.invoiceNumber}`,
      orderId: `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      clientInfo: data.clientInfo,
    };

    const gatewayResponse = await this.paymentGatewayService.initializePayment(
      data.method,
      paymentRequest
    );

    if (!gatewayResponse.success) {
      throw new Error(`Payment initialization failed: ${gatewayResponse.error}`);
    }

    // Create payment record
    const payment = await this.prisma.payment.create({
      data: {
        invoiceId: data.invoiceId,
        amount: data.amount,
        method: data.method,
        status: PaymentStatus.PENDING,
        transactionId: gatewayResponse.transactionId,
        reference: JSON.stringify(gatewayResponse),
      },
    });

    return {
      payment,
      gatewayResponse,
    };
  }

  async checkPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (!payment.transactionId) {
      return payment.status;
    }

    try {
      const gatewayStatus = await this.paymentGatewayService.checkPaymentStatus(
        payment.method,
        payment.transactionId
      );

      // Update payment status if different
      if (gatewayStatus !== payment.status) {
        await this.prisma.payment.update({
          where: { id: paymentId },
          data: { status: gatewayStatus as PaymentStatus },
        });

        // Update invoice status if payment is completed
        if (gatewayStatus === PaymentStatus.COMPLETED) {
          await this.updateInvoicePaymentStatus(payment.invoiceId);
        }
      }

      return gatewayStatus as PaymentStatus;
    } catch (error) {
      console.error('Failed to check payment status:', error);
      return payment.status;
    }
  }

  async refundPayment(paymentId: string, amount?: number, reason?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { invoice: true },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new Error('Only completed payments can be refunded');
    }

    const refundAmount = amount || payment.amount;
    if (refundAmount > payment.amount) {
      throw new Error('Refund amount cannot exceed payment amount');
    }

    try {
      const refundResponse = await this.paymentGatewayService.refundPayment(
        payment.method,
        payment.transactionId!,
        refundAmount,
        reason
      );

      if (refundResponse.success) {
        // Update payment status to refunded
        await this.prisma.payment.update({
          where: { id: paymentId },
          data: { status: PaymentStatus.REFUNDED },
        });

        // Update invoice status
        await this.updateInvoicePaymentStatus(payment.invoiceId);
      }

      return refundResponse;
    } catch (error) {
      throw new Error(`Refund failed: ${error.message}`);
    }
  }

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const config = await import('../../config/financial').then(m => m.getPaymentConfig());
    const enabledMethods: PaymentMethod[] = [];

    if (config.supportedGateways.alipay.enabled) {
      enabledMethods.push(PaymentMethod.ALIPAY);
    }
    if (config.supportedGateways.wechat.enabled) {
      enabledMethods.push(PaymentMethod.WECHAT_PAY);
    }
    if (config.supportedGateways.bank.enabled) {
      enabledMethods.push(PaymentMethod.BANK_TRANSFER);
    }

    return enabledMethods;
  }

  async getPaymentHistory(invoiceId?: string, clientId?: string, startDate?: Date, endDate?: Date) {
    const where: any = {};
    if (invoiceId) where.invoiceId = invoiceId;
    if (clientId) where.invoice = { clientId };
    if (startDate && endDate) {
      where.createdAt = { gte: startDate, lte: endDate };
    }

    return this.prisma.payment.findMany({
      where,
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

  // Helper methods
  private async getTotalPaidAmount(invoiceId: string): Promise<number> {
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

    let status: InvoiceStatus;
    if (totalPaid >= invoice.total) {
      status = InvoiceStatus.PAID;
    } else if (totalPaid > 0) {
      status = InvoiceStatus.PARTIALLY_PAID;
    } else {
      status = InvoiceStatus.UNPAID;
    }

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status },
    });
  }
}