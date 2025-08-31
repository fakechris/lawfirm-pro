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
  PaymentStatus,
  TrustTransactionType
} from '../models/financial';
import { getChinaConfig, getBillingConfig } from '../config/financial';

export class ChineseBillingEngine {
  private prisma: PrismaClient;
  private chinaConfig = getChinaConfig();
  private billingConfig = getBillingConfig();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // Chinese Legal Fee Calculation
  async calculateLegalFee(caseType: string, feeType: FeeType, params: {
    hours?: number;
    rate?: number;
    settlementAmount?: number;
    baseAmount?: number;
    percentage?: number;
    complexity?: 'simple' | 'medium' | 'complex';
    jurisdiction?: 'local' | 'provincial' | 'national';
  }): Promise<{ fee: number; breakdown: any; compliance: any }> {
    const { complexity = 'medium', jurisdiction = 'local' } = params;
    
    // Base calculation according to Chinese legal fee standards
    let baseFee = 0;
    let breakdown: any = {};
    let compliance: any = {};

    switch (feeType) {
      case FeeType.HOURLY:
        if (!params.hours || !params.rate) {
          throw new Error('Hours and rate are required for hourly fees');
        }
        
        // Apply Chinese minimum wage requirements for legal services
        const minRate = this.chinaConfig.feeRegulations.minimumHourlyRate;
        const effectiveRate = Math.max(params.rate, minRate);
        
        baseFee = params.hours * effectiveRate;
        breakdown = {
          hours: params.hours,
          rate: effectiveRate,
          baseAmount: baseFee,
          adjustments: params.rate < minRate ? {
            originalRate: params.rate,
            adjustedRate: effectiveRate,
            reason: 'Minimum wage requirement'
          } : null
        };
        
        // Compliance checks
        compliance = {
          meetsMinimumWage: true,
          writtenAgreementRequired: this.chinaConfig.feeRegulations.requiresWrittenAgreement,
          disclosureRequired: this.chinaConfig.feeRegulations.disclosureRequirements,
        };
        break;

      case FeeType.CONTINGENCY:
        if (!params.settlementAmount || !params.percentage) {
          throw new Error('Settlement amount and percentage are required for contingency fees');
        }
        
        // Check against Chinese contingency fee limits
        const maxPercentage = this.chinaConfig.feeRegulations.maximumContingency;
        const effectivePercentage = Math.min(params.percentage, maxPercentage);
        
        baseFee = params.settlementAmount * (effectivePercentage / 100);
        breakdown = {
          settlementAmount: params.settlementAmount,
          percentage: effectivePercentage,
          baseAmount: baseFee,
          adjustments: params.percentage > maxPercentage ? {
            originalPercentage: params.percentage,
            adjustedPercentage: effectivePercentage,
            reason: 'Maximum contingency fee limit'
          } : null
        };
        
        // Chinese contingency fee compliance
        compliance = {
          withinLegalLimits: true,
          writtenAgreementRequired: true,
          courtApprovalRequired: params.settlementAmount > 1000000, // 1M+ requires court approval
          disclosureRequired: true,
        };
        break;

      case FeeType.FLAT:
        if (!params.baseAmount) {
          throw new Error('Base amount is required for flat fees');
        }
        
        // Apply jurisdiction-based adjustments
        const jurisdictionMultiplier = {
          local: 1.0,
          provincial: 1.2,
          national: 1.5
        }[jurisdiction];
        
        baseFee = params.baseAmount * jurisdictionMultiplier;
        breakdown = {
          baseAmount: params.baseAmount,
          jurisdiction,
          multiplier: jurisdictionMultiplier,
          finalAmount: baseFee
        };
        
        compliance = {
          writtenAgreementRequired: true,
          disclosureRequired: true,
          jurisdictionRulesApplied: true,
        };
        break;

      case FeeType.RETAINER:
        if (!params.baseAmount) {
          throw new Error('Base amount is required for retainer fees');
        }
        
        // Chinese retainer fee regulations
        baseFee = params.baseAmount;
        breakdown = {
          retainerAmount: baseFee,
          type: 'retainer',
          refundable: true, // Chinese law requires retainers to be refundable
        };
        
        compliance = {
          writtenAgreementRequired: true,
          refundableRequired: true,
          trustAccountRequired: true,
          disclosureRequired: true,
        };
        break;

      default:
        throw new Error(`Unsupported fee type: ${feeType}`);
    }

    // Apply complexity multiplier
    const complexityMultiplier = {
      simple: 1.0,
      medium: 1.3,
      complex: 1.8
    }[complexity];
    
    const finalFee = baseFee * complexityMultiplier;
    breakdown.complexityAdjustment = {
      complexity,
      multiplier: complexityMultiplier,
      adjustedAmount: finalFee
    };

    // Add VAT (6% for legal services in China)
    const vatAmount = finalFee * this.chinaConfig.vatRate;
    const totalWithVAT = finalFee + vatAmount;
    
    breakdown.vat = {
      rate: this.chinaConfig.vatRate,
      amount: vatAmount,
      totalWithVAT
    };

    return {
      fee: totalWithVAT,
      breakdown,
      compliance
    };
  }

  // Generate compliant invoice for Chinese legal services
  async generateCompliantInvoice(data: {
    clientId: string;
    caseId?: string;
    items: Omit<InvoiceItem, 'id' | 'invoiceId' | 'createdAt' | 'updatedAt'>[];
    issueDate?: Date;
    dueDate?: Date;
    notes?: string;
  }): Promise<Invoice> {
    const client = await this.prisma.clientProfile.findUnique({
      where: { id: data.clientId },
      include: { user: true }
    });

    if (!client) {
      throw new Error('Client not found');
    }

    // Check if client has required tax information
    if (!client.taxId && this.chinaConfig.invoice.requiresTaxNumber) {
      throw new Error('Client tax ID (税号) is required for invoicing');
    }

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber();

    // Calculate totals with VAT
    const subtotal = data.items.reduce((sum, item) => sum + item.amount, 0);
    const vatAmount = subtotal * this.chinaConfig.vatRate;
    const total = subtotal + vatAmount;

    // Create invoice
    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        caseId: data.caseId,
        clientId: data.clientId,
        userId: data.items[0]?.userId || '', // This should be passed properly
        status: InvoiceStatus.DRAFT,
        issueDate: data.issueDate || new Date(),
        dueDate: data.dueDate || this.calculateDueDate(data.issueDate || new Date()),
        subtotal,
        taxRate: this.chinaConfig.vatRate,
        taxAmount: vatAmount,
        total,
        currency: this.chinaConfig.currency,
        notes: data.notes,
        items: {
          create: data.items.map(item => ({
            type: item.type,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
            taxRate: this.chinaConfig.vatRate,
            taxAmount: item.amount * this.chinaConfig.vatRate,
            total: item.amount * (1 + this.chinaConfig.vatRate),
          })),
        },
      },
      include: {
        items: true,
        client: true,
        case: true,
      },
    });

    // Generate fapiao (official Chinese invoice)
    if (this.chinaConfig.invoice.requiresFapiao) {
      await this.generateFapiao(invoice.id);
    }

    return invoice;
  }

  // Generate fapiao (official Chinese tax invoice)
  private async generateFapiao(invoiceId: string): Promise<void> {
    // This would integrate with Chinese tax authorities' fapiao system
    // For now, we'll create a placeholder implementation
    
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: true,
        items: true,
      },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Fapiao generation logic would go here
    // This would typically involve:
    // 1. Calling Chinese tax authority API
    // 2. Getting fapiao number and QR code
    // 3. Storing fapiao details
    // 4. Updating invoice with fapiao information

    console.log(`Fapiao generation required for invoice ${invoice.invoiceNumber}`);
    console.log(`Client tax ID: ${invoice.client.taxId}`);
    console.log(`Total amount: ${invoice.total} ${invoice.currency}`);
  }

  // Generate invoice number according to Chinese regulations
  private async generateInvoiceNumber(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Get the next sequence number for this month
    const lastInvoice = await this.prisma.invoice.findFirst({
      where: {
        invoiceNumber: {
          startsWith: `${this.billingConfig.invoiceNumberPrefix}${currentYear}${currentMonth}`
        }
      },
      orderBy: {
        invoiceNumber: 'desc'
      }
    });

    let sequence = 1;
    if (lastInvoice) {
      const lastSequence = parseInt(lastInvoice.invoiceNumber.slice(-4));
      sequence = lastSequence + 1;
    }

    const sequenceStr = String(sequence).padStart(4, '0');
    return `${this.billingConfig.invoiceNumberPrefix}${currentYear}${currentMonth}${sequenceStr}`;
  }

  // Calculate due date based on Chinese business practices
  private calculateDueDate(issueDate: Date): Date {
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + this.billingConfig.defaultPaymentTerms);
    return dueDate;
  }

  // Stage-based billing for Chinese legal cases
  async generateStageBilling(caseId: string): Promise<{
    currentPhase: string;
    billingNodes: BillingNode[];
    suggestedInvoice: any;
    compliance: any;
  }> {
    const caseData = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: {
        client: true,
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

    // Check compliance requirements for this stage
    const compliance = await this.checkStageBillingCompliance(caseData, currentPhase);

    // Generate suggested invoice items
    const invoiceItems = [
      ...phaseBillingNodes.map(node => ({
        type: 'billing_node' as const,
        description: `${node.name} (${currentPhase})`,
        quantity: 1,
        unitPrice: node.amount,
        amount: node.amount,
        userId: caseData.attorneyId,
      })),
      ...unbilledTimeEntries.map(entry => ({
        type: 'time_entry' as const,
        description: entry.description,
        quantity: entry.hours,
        unitPrice: entry.rate,
        amount: entry.amount,
        userId: entry.userId,
      })),
      ...unbilledExpenses.map(expense => ({
        type: 'expense' as const,
        description: expense.description,
        quantity: 1,
        unitPrice: expense.amount,
        amount: expense.amount,
        userId: expense.userId,
      })),
    ];

    return {
      currentPhase,
      billingNodes: phaseBillingNodes,
      suggestedInvoice: {
        caseId,
        clientId: caseData.clientId,
        items: invoiceItems,
        estimatedTotal: invoiceItems.reduce((sum, item) => sum + item.amount, 0),
      },
      compliance,
    };
  }

  // Check compliance for stage-based billing
  private async checkStageBillingCompliance(caseData: any, phase: string): Promise<any> {
    const compliance = {
      phaseAppropriate: true,
      disclosureRequired: true,
      clientApprovalRequired: false,
      courtApprovalRequired: false,
      documentationRequired: [],
    };

    // Phase-specific compliance requirements
    switch (phase) {
      case 'INTAKE_RISK_ASSESSMENT':
        compliance.clientApprovalRequired = true;
        compliance.documentationRequired.push('fee_agreement', 'engagement_letter');
        break;
        
      case 'FORMAL_PROCEEDINGS':
        compliance.documentationRequired.push('court_filing_receipt', 'service_proof');
        break;
        
      case 'RESOLUTION_POST_PROCEEDING':
        compliance.documentationRequired.push('settlement_agreement', 'judgment_copy');
        break;
    }

    // Check for high-value cases requiring court approval
    const totalCaseValue = await this.calculateCaseValue(caseData.id);
    if (totalCaseValue > 1000000) { // 1M+ CNY
      compliance.courtApprovalRequired = true;
      compliance.documentationRequired.push('court_approval');
    }

    return compliance;
  }

  // Calculate total case value for compliance purposes
  private async calculateCaseValue(caseId: string): Promise<number> {
    // This would calculate the total value of the case for compliance purposes
    // For now, we'll return a placeholder value
    return 0;
  }

  // Trust account management for Chinese compliance
  async manageTrustAccount(data: {
    clientId: string;
    caseId?: string;
    amount: number;
    type: TrustTransactionType;
    description: string;
  }): Promise<{ success: boolean; transaction: any; compliance: any }> {
    const compliance = {
      segregationRequired: this.chinaConfig.trustAccount.requiresSegregation,
      interestHandling: this.chinaConfig.trustAccount.interestHandling,
      documentationRequired: true,
      clientNotificationRequired: true,
    };

    // Check if trust account exists
    let trustAccount = await this.prisma.trustAccount.findFirst({
      where: {
        clientId: data.clientId,
        caseId: data.caseId,
        isActive: true,
      },
    });

    // Create trust account if it doesn't exist
    if (!trustAccount) {
      trustAccount = await this.prisma.trustAccount.create({
        data: {
          clientId: data.clientId,
          caseId: data.caseId,
          currency: this.chinaConfig.currency,
        },
      });
    }

    // Create transaction
    const transaction = await this.prisma.trustTransaction.create({
      data: {
        trustAccountId: trustAccount.id,
        type: data.type,
        amount: data.amount,
        description: data.description,
        status: 'pending',
      },
    });

    // Update trust account balance
    if (data.type === TrustTransactionType.DEPOSIT) {
      await this.prisma.trustAccount.update({
        where: { id: trustAccount.id },
        data: { balance: { increment: data.amount } },
      });
    } else if (data.type === TrustTransactionType.WITHDRAWAL) {
      if (trustAccount.balance < data.amount) {
        throw new Error('Insufficient trust account balance');
      }
      await this.prisma.trustAccount.update({
        where: { id: trustAccount.id },
        data: { balance: { decrement: data.amount } },
      });
    }

    return {
      success: true,
      transaction,
      compliance,
    };
  }
}