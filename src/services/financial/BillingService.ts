import { PrismaClient } from '@prisma/client';
import { 
  Invoice, 
  InvoiceItem, 
  BillingNode, 
  FeeStructure, 
  TimeEntry, 
  Expense,
  InvoiceStatus,
  FeeType,
  PaymentMethod,
  PaymentStatus,
  TrustTransactionType
} from '../models/financial';
import { ChineseBillingEngine } from './ChineseBillingEngine';

export interface BillingMilestone {
  id: string;
  name: string;
  description: string;
  phase: string;
  order: number;
  amount: number;
  dueDate?: Date;
  isCompleted: boolean;
  completionDate?: Date;
  requirements: string[];
  triggers: string[];
}

export interface BillingConfiguration {
  autoGenerateInvoices: boolean;
  requireClientApproval: boolean;
  sendNotifications: boolean;
  paymentTerms: number;
  lateFeeRate: number;
  currency: string;
  taxRate: number;
}

export interface StageBillingRequest {
  caseId: string;
  phase: string;
  milestones: BillingMilestone[];
  configuration: BillingConfiguration;
}

export class BillingService {
  private prisma: PrismaClient;
  private chineseBillingEngine: ChineseBillingEngine;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.chineseBillingEngine = new ChineseBillingEngine(prisma);
  }

  // Stage-based Billing System
  async createStageBilling(request: StageBillingRequest): Promise<{
    billingNodes: BillingNode[];
    configuration: BillingConfiguration;
    compliance: any;
  }> {
    const caseData = await this.prisma.case.findUnique({
      where: { id: request.caseId },
      include: { client: true }
    });

    if (!caseData) {
      throw new Error('Case not found');
    }

    // Validate phase compatibility
    await this.validatePhaseCompatibility(request.caseId, request.phase);

    // Create billing nodes for each milestone
    const billingNodes = await Promise.all(
      request.milestones.map(async (milestone, index) => {
        return this.prisma.billingNode.create({
          data: {
            name: milestone.name,
            description: milestone.description,
            caseId: request.caseId,
            phase: request.phase,
            order: milestone.order,
            amount: milestone.amount,
            dueDate: milestone.dueDate,
            notes: `Milestone requirements: ${milestone.requirements.join(', ')}`,
          },
        });
      })
    );

    // Store billing configuration
    const configuration = await this.storeBillingConfiguration(
      request.caseId,
      request.configuration
    );

    // Check compliance
    const compliance = await this.checkStageBillingCompliance(request);

    return {
      billingNodes,
      configuration,
      compliance,
    };
  }

  // Get billing nodes by case with stage-based filtering
  async getBillingNodesByCase(
    caseId: string,
    options: {
      phase?: string;
      includeCompleted?: boolean;
      includePaid?: boolean;
    } = {}
  ): Promise<BillingNode[]> {
    const where: any = { caseId, isActive: true };

    if (options.phase) {
      where.phase = options.phase;
    }

    if (!options.includeCompleted) {
      where.isPaid = false;
    }

    return this.prisma.billingNode.findMany({
      where,
      orderBy: { order: 'asc' },
      include: {
        case: {
          include: {
            client: true,
          },
        },
      },
    });
  }

  // Update billing node status and trigger invoicing
  async completeBillingNode(
    billingNodeId: string,
    completionData: {
      completionDate: Date;
      notes?: string;
      generateInvoice?: boolean;
    }
  ): Promise<{
    billingNode: BillingNode;
    invoice?: Invoice;
    nextMilestones: BillingNode[];
  }> {
    const billingNode = await this.prisma.billingNode.update({
      where: { id: billingNodeId },
      data: {
        isPaid: true,
        paidDate: completionData.completionDate,
        notes: completionData.notes,
      },
      include: {
        case: {
          include: {
            client: true,
            billingNodes: {
              where: { isActive: true, isPaid: false },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    let invoice: Invoice | undefined;

    // Generate invoice if requested
    if (completionData.generateInvoice) {
      invoice = await this.generateInvoiceForBillingNode(billingNodeId);
    }

    // Get next milestones
    const nextMilestones = billingNode.case.billingNodes.filter(
      node => node.order > billingNode.order && node.phase === billingNode.phase
    );

    return {
      billingNode,
      invoice,
      nextMilestones,
    };
  }

  // Generate invoice for billing node
  async generateInvoiceForBillingNode(billingNodeId: string): Promise<Invoice> {
    const billingNode = await this.prisma.billingNode.findUnique({
      where: { id: billingNodeId },
      include: {
        case: {
          include: {
            client: true,
            timeEntries: { where: { isBilled: false } },
            expenses: { where: { isBilled: false, isBillable: true } },
          },
        },
      },
    });

    if (!billingNode) {
      throw new Error('Billing node not found');
    }

    // Get billing configuration
    const configuration = await this.getBillingConfiguration(billingNode.caseId);

    // Prepare invoice items
    const invoiceItems: Omit<InvoiceItem, 'id' | 'invoiceId' | 'createdAt' | 'updatedAt'>[] = [
      {
        type: 'billing_node',
        description: `${billingNode.name} - ${billingNode.phase}`,
        quantity: 1,
        unitPrice: billingNode.amount,
        amount: billingNode.amount,
        taxRate: configuration.taxRate,
      },
    ];

    // Add unbilled time entries
    const timeEntryItems = billingNode.case.timeEntries.map(entry => ({
      type: 'time_entry' as const,
      description: entry.description,
      quantity: entry.hours,
      unitPrice: entry.rate,
      amount: entry.amount,
      taxRate: configuration.taxRate,
    }));

    // Add unbilled expenses
    const expenseItems = billingNode.case.expenses.map(expense => ({
      type: 'expense' as const,
      description: expense.description,
      quantity: 1,
      unitPrice: expense.amount,
      amount: expense.amount,
      taxRate: configuration.taxRate,
    }));

    invoiceItems.push(...timeEntryItems, ...expenseItems);

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber();

    // Calculate totals
    const subtotal = invoiceItems.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = subtotal * configuration.taxRate;
    const total = subtotal + taxAmount;

    // Create invoice
    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        caseId: billingNode.caseId,
        clientId: billingNode.case.clientId,
        userId: billingNode.case.attorneyId,
        status: InvoiceStatus.DRAFT,
        issueDate: new Date(),
        dueDate: this.calculateDueDate(new Date(), configuration.paymentTerms),
        subtotal,
        taxRate: configuration.taxRate,
        taxAmount,
        total,
        currency: configuration.currency,
        notes: `Invoice for ${billingNode.name} milestone`,
        items: {
          create: invoiceItems.map(item => ({
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
      },
    });

    // Mark items as billed
    await this.markItemsAsBilled(billingNode.caseId, invoiceItems);

    return invoice;
  }

  // Auto-generate invoices based on completed milestones
  async autoGenerateInvoices(caseId: string): Promise<Invoice[]> {
    const configuration = await this.getBillingConfiguration(caseId);

    if (!configuration.autoGenerateInvoices) {
      return [];
    }

    // Get completed but uninvoiced billing nodes
    const completedNodes = await this.prisma.billingNode.findMany({
      where: {
        caseId,
        isActive: true,
        isPaid: true,
        invoice: null, // Not yet invoiced
      },
    });

    const invoices: Invoice[] = [];

    for (const node of completedNodes) {
      try {
        const invoice = await this.generateInvoiceForBillingNode(node.id);
        invoices.push(invoice);
      } catch (error) {
        console.error(`Failed to generate invoice for billing node ${node.id}:`, error);
      }
    }

    return invoices;
  }

  // Get billing progress for a case
  async getBillingProgress(caseId: string): Promise<{
    currentPhase: string;
    completedNodes: BillingNode[];
    pendingNodes: BillingNode[];
    totalBilled: number;
    totalPaid: number;
    completionPercentage: number;
    nextMilestone?: BillingNode;
  }> {
    const caseData = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: {
        billingNodes: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
        invoices: {
          include: { payments: true },
        },
      },
    });

    if (!caseData) {
      throw new Error('Case not found');
    }

    const completedNodes = caseData.billingNodes.filter(node => node.isPaid);
    const pendingNodes = caseData.billingNodes.filter(node => !node.isPaid);

    const totalBilled = caseData.invoices.reduce((sum, invoice) => sum + invoice.total, 0);
    const totalPaid = caseData.invoices.reduce((sum, invoice) => {
      const paidAmount = invoice.payments
        .filter(p => p.status === PaymentStatus.COMPLETED)
        .reduce((paymentSum, payment) => paymentSum + payment.amount, 0);
      return sum + paidAmount;
    }, 0);

    const completionPercentage = caseData.billingNodes.length > 0 
      ? (completedNodes.length / caseData.billingNodes.length) * 100 
      : 0;

    const nextMilestone = pendingNodes.length > 0 ? pendingNodes[0] : undefined;

    return {
      currentPhase: caseData.phase,
      completedNodes,
      pendingNodes,
      totalBilled,
      totalPaid,
      completionPercentage,
      nextMilestone,
    };
  }

  // Validate billing milestones
  async validateBillingMilestones(milestones: BillingMilestone[]): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for duplicate orders
    const orders = milestones.map(m => m.order);
    const uniqueOrders = new Set(orders);
    if (orders.length !== uniqueOrders.size) {
      errors.push('Duplicate milestone orders detected');
    }

    // Check for missing required fields
    milestones.forEach((milestone, index) => {
      if (!milestone.name || milestone.name.trim() === '') {
        errors.push(`Milestone ${index + 1}: Name is required`);
      }

      if (milestone.amount <= 0) {
        errors.push(`Milestone ${index + 1}: Amount must be greater than 0`);
      }

      if (milestone.requirements.length === 0) {
        warnings.push(`Milestone ${index + 1}: No requirements specified`);
      }
    });

    // Check phase consistency
    const phases = milestones.map(m => m.phase);
    const uniquePhases = new Set(phases);
    if (uniquePhases.size > 1) {
      warnings.push('Milestones span multiple phases - consider creating separate billing configurations');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // Helper methods
  private async validatePhaseCompatibility(caseId: string, phase: string): Promise<void> {
    const caseData = await this.prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseData) {
      throw new Error('Case not found');
    }

    // Check if phase is compatible with case type
    const compatiblePhases = this.getCompatiblePhases(caseData.caseType);
    if (!compatiblePhases.includes(phase)) {
      throw new Error(`Phase ${phase} is not compatible with case type ${caseData.caseType}`);
    }
  }

  private getCompatiblePhases(caseType: string): string[] {
    // This would be configured based on case type
    const phaseMap: Record<string, string[]> = {
      'labor_dispute': [
        'INTAKE_RISK_ASSESSMENT',
        'FORMAL_PROCEEDINGS',
        'RESOLUTION_POST_PROCEEDING',
      ],
      'contract_dispute': [
        'INTAKE_RISK_ASSESSMENT',
        'FORMAL_PROCEEDINGS',
        'RESOLUTION_POST_PROCEEDING',
      ],
      'criminal_defense': [
        'INTAKE_RISK_ASSESSMENT',
        'FORMAL_PROCEEDINGS',
        'RESOLUTION_POST_PROCEEDING',
      ],
    };

    return phaseMap[caseType] || [];
  }

  private async storeBillingConfiguration(
    caseId: string,
    configuration: BillingConfiguration
  ): Promise<BillingConfiguration> {
    // This would store the configuration in the database
    // For now, we'll return the configuration as-is
    return configuration;
  }

  private async getBillingConfiguration(caseId: string): Promise<BillingConfiguration> {
    // This would retrieve the configuration from the database
    // For now, we'll return default configuration
    return {
      autoGenerateInvoices: true,
      requireClientApproval: false,
      sendNotifications: true,
      paymentTerms: 30,
      lateFeeRate: 0.02,
      currency: 'CNY',
      taxRate: 0.06,
    };
  }

  private async checkStageBillingCompliance(request: StageBillingRequest): Promise<any> {
    // Use Chinese billing engine for compliance checking
    const compliance = await this.chineseBillingEngine.calculateLegalFee(
      'general',
      FeeType.FLAT,
      {
        baseAmount: request.milestones.reduce((sum, m) => sum + m.amount, 0),
      }
    );

    return {
      ...compliance.compliance,
      milestoneCount: request.milestones.length,
      totalAmount: request.milestones.reduce((sum, m) => sum + m.amount, 0),
      phase: request.phase,
    };
  }

  private async generateInvoiceNumber(): Promise<string> {
    const prefix = 'INV';
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    const lastInvoice = await this.prisma.invoice.findFirst({
      where: {
        invoiceNumber: {
          startsWith: `${prefix}${year}${month}`,
        },
      },
      orderBy: {
        invoiceNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastInvoice) {
      const lastSequence = parseInt(lastInvoice.invoiceNumber.slice(-4));
      sequence = lastSequence + 1;
    }

    const sequenceStr = String(sequence).padStart(4, '0');
    return `${prefix}${year}${month}${sequenceStr}`;
  }

  private calculateDueDate(issueDate: Date, paymentTerms: number): Date {
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + paymentTerms);
    return dueDate;
  }

  private async markItemsAsBilled(caseId: string, items: any[]): Promise<void> {
    // Mark time entries as billed
    const timeEntryIds = items
      .filter(item => item.type === 'time_entry')
      .map(item => item.id);

    if (timeEntryIds.length > 0) {
      await this.prisma.timeEntry.updateMany({
        where: { id: { in: timeEntryIds } },
        data: { isBilled: true },
      });
    }

    // Mark expenses as billed
    const expenseIds = items
      .filter(item => item.type === 'expense')
      .map(item => item.id);

    if (expenseIds.length > 0) {
      await this.prisma.expense.updateMany({
        where: { id: { in: expenseIds } },
        data: { isBilled: true },
      });
    }
  }
}