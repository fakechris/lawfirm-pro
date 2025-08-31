import { PrismaClient } from '@prisma/client';
import { 
  TrustAccount,
  TrustTransaction,
  TrustTransactionType,
  PaymentMethod,
  PaymentStatus
} from '../models/financial';

export interface TrustAccountRequest {
  clientId: string;
  caseId?: string;
  initialBalance?: number;
  notes?: string;
  currency?: string;
}

export interface TrustTransactionRequest {
  trustAccountId: string;
  type: TrustTransactionType;
  amount: number;
  description: string;
  reference?: string;
  documents?: string[];
  requiresApproval?: boolean;
}

export interface TrustAccountBalance {
  totalBalance: number;
  availableBalance: number;
  pendingBalance: number;
  currency: string;
  lastUpdated: Date;
}

export interface TrustAccountStatement {
  account: TrustAccount;
  transactions: TrustTransaction[];
  balance: TrustAccountBalance;
  period: {
    startDate: Date;
    endDate: Date;
  };
  summary: {
    totalDeposits: number;
    totalWithdrawals: number;
    totalInterest: number;
    netChange: number;
  };
}

export interface TrustAccountCompliance {
  isCompliant: boolean;
  violations: string[];
  warnings: string[];
  requirements: {
    segregationRequired: boolean;
    interestHandlingRequired: boolean;
    reconciliationRequired: boolean;
    documentationRequired: boolean;
    clientNotificationRequired: boolean;
  };
  lastReconciliationDate?: Date;
  nextReconciliationDate?: Date;
}

export class TrustAccountService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // Create new trust account
  async createTrustAccount(request: TrustAccountRequest): Promise<TrustAccount> {
    // Validate client exists
    const client = await this.prisma.clientProfile.findUnique({
      where: { id: request.clientId },
    });

    if (!client) {
      throw new Error('Client not found');
    }

    // Check if trust account already exists for this client/case combination
    const existingAccount = await this.prisma.trustAccount.findFirst({
      where: {
        clientId: request.clientId,
        caseId: request.caseId,
        isActive: true,
      },
    });

    if (existingAccount) {
      throw new Error('Trust account already exists for this client/case combination');
    }

    // Create trust account
    const trustAccount = await this.prisma.trustAccount.create({
      data: {
        clientId: request.clientId,
        caseId: request.caseId,
        balance: request.initialBalance || 0,
        currency: request.currency || 'CNY',
        notes: request.notes,
        isActive: true,
      },
      include: {
        client: true,
        case: true,
      },
    });

    // If initial balance provided, create initial deposit transaction
    if (request.initialBalance && request.initialBalance > 0) {
      await this.createTrustTransaction({
        trustAccountId: trustAccount.id,
        type: TrustTransactionType.DEPOSIT,
        amount: request.initialBalance,
        description: 'Initial deposit',
        reference: 'INITIAL_DEPOSIT',
      });
    }

    return trustAccount;
  }

  // Get trust account by ID
  async getTrustAccountById(id: string): Promise<TrustAccount | null> {
    return this.prisma.trustAccount.findUnique({
      where: { id },
      include: {
        client: true,
        case: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10, // Last 10 transactions
        },
      },
    });
  }

  // Get trust accounts by client
  async getTrustAccountsByClient(clientId: string): Promise<TrustAccount[]> {
    return this.prisma.trustAccount.findMany({
      where: { clientId, isActive: true },
      include: {
        case: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get trust accounts by case
  async getTrustAccountsByCase(caseId: string): Promise<TrustAccount[]> {
    return this.prisma.trustAccount.findMany({
      where: { caseId, isActive: true },
      include: {
        client: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Create trust transaction
  async createTrustTransaction(request: TrustTransactionRequest): Promise<TrustTransaction> {
    const trustAccount = await this.prisma.trustAccount.findUnique({
      where: { id: request.trustAccountId },
    });

    if (!trustAccount) {
      throw new Error('Trust account not found');
    }

    if (!trustAccount.isActive) {
      throw new Error('Trust account is not active');
    }

    // Validate transaction amount
    if (request.amount <= 0) {
      throw new Error('Transaction amount must be greater than 0');
    }

    // Check sufficient balance for withdrawals
    if (request.type === TrustTransactionType.WITHDRAWAL) {
      if (trustAccount.balance < request.amount) {
        throw new Error('Insufficient trust account balance');
      }
    }

    // Create transaction
    const transaction = await this.prisma.trustTransaction.create({
      data: {
        trustAccountId: request.trustAccountId,
        type: request.type,
        amount: request.amount,
        description: request.description,
        reference: request.reference,
        status: 'completed', // Could be 'pending' if approval required
      },
    });

    // Update trust account balance
    await this.updateTrustAccountBalance(request.trustAccountId, request.type, request.amount);

    // Handle compliance requirements
    await this.handleTransactionCompliance(transaction);

    return transaction;
  }

  // Get trust account balance
  async getTrustAccountBalance(trustAccountId: string): Promise<TrustAccountBalance> {
    const trustAccount = await this.prisma.trustAccount.findUnique({
      where: { id: trustAccountId },
    });

    if (!trustAccount) {
      throw new Error('Trust account not found');
    }

    const pendingTransactions = await this.prisma.trustTransaction.findMany({
      where: {
        trustAccountId,
        status: 'pending',
      },
    });

    const pendingBalance = pendingTransactions.reduce((sum, transaction) => {
      return sum + transaction.amount;
    }, 0);

    return {
      totalBalance: trustAccount.balance,
      availableBalance: trustAccount.balance - pendingBalance,
      pendingBalance,
      currency: trustAccount.currency,
      lastUpdated: trustAccount.updatedAt,
    };
  }

  // Generate trust account statement
  async generateTrustAccountStatement(
    trustAccountId: string,
    period: { startDate: Date; endDate: Date }
  ): Promise<TrustAccountStatement> {
    const trustAccount = await this.prisma.trustAccount.findUnique({
      where: { id: trustAccountId },
      include: {
        client: true,
        case: true,
      },
    });

    if (!trustAccount) {
      throw new Error('Trust account not found');
    }

    const transactions = await this.prisma.trustTransaction.findMany({
      where: {
        trustAccountId,
        createdAt: {
          gte: period.startDate,
          lte: period.endDate,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const balance = await this.getTrustAccountBalance(trustAccountId);

    const summary = {
      totalDeposits: transactions
        .filter(t => t.type === TrustTransactionType.DEPOSIT)
        .reduce((sum, t) => sum + t.amount, 0),
      totalWithdrawals: transactions
        .filter(t => t.type === TrustTransactionType.WITHDRAWAL)
        .reduce((sum, t) => sum + t.amount, 0),
      totalInterest: transactions
        .filter(t => t.type === TrustTransactionType.INTEREST)
        .reduce((sum, t) => sum + t.amount, 0),
      netChange: 0, // Will be calculated below
    };

    summary.netChange = summary.totalDeposits - summary.totalWithdrawals + summary.totalInterest;

    return {
      account: trustAccount,
      transactions,
      balance,
      period,
      summary,
    };
  }

  // Check trust account compliance
  async checkTrustAccountCompliance(trustAccountId: string): Promise<TrustAccountCompliance> {
    const trustAccount = await this.prisma.trustAccount.findUnique({
      where: { id: trustAccountId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 100, // Last 100 transactions for analysis
        },
      },
    });

    if (!trustAccount) {
      throw new Error('Trust account not found');
    }

    const violations: string[] = [];
    const warnings: string[] = [];

    // Check for segregation compliance
    const segregationViolation = await this.checkFundSegregation(trustAccount);
    if (segregationViolation) {
      violations.push(segregationViolation);
    }

    // Check for proper interest handling
    const interestViolation = await this.checkInterestHandling(trustAccount);
    if (interestViolation) {
      violations.push(interestViolation);
    }

    // Check for reconciliation requirements
    const reconciliationViolation = await this.checkReconciliationStatus(trustAccount);
    if (reconciliationViolation) {
      violations.push(reconciliationViolation);
    }

    // Check for documentation completeness
    const documentationWarnings = await this.checkDocumentationCompleteness(trustAccount);
    warnings.push(...documentationWarnings);

    // Check for client notification requirements
    const notificationWarnings = await this.checkClientNotificationRequirements(trustAccount);
    warnings.push(...notificationWarnings);

    // Calculate next reconciliation date
    const lastReconciliationDate = await this.getLastReconciliationDate(trustAccountId);
    const nextReconciliationDate = this.calculateNextReconciliationDate(lastReconciliationDate);

    return {
      isCompliant: violations.length === 0,
      violations,
      warnings,
      requirements: {
        segregationRequired: true,
        interestHandlingRequired: true,
        reconciliationRequired: true,
        documentationRequired: true,
        clientNotificationRequired: true,
      },
      lastReconciliationDate,
      nextReconciliationDate,
    };
  }

  // Process monthly interest accrual
  async processMonthlyInterest(trustAccountId: string): Promise<TrustTransaction> {
    const trustAccount = await this.prisma.trustAccount.findUnique({
      where: { id: trustAccountId },
    });

    if (!trustAccount) {
      throw new Error('Trust account not found');
    }

    // Calculate interest (simplified - in reality would integrate with bank APIs)
    const interestRate = 0.0025; // 0.25% monthly (example)
    const monthlyInterest = trustAccount.balance * interestRate;

    if (monthlyInterest <= 0) {
      throw new Error('No interest to accrue');
    }

    // Create interest transaction
    const transaction = await this.createTrustTransaction({
      trustAccountId,
      type: TrustTransactionType.INTEREST,
      amount: monthlyInterest,
      description: 'Monthly interest accrual',
      reference: `INTEREST_${new Date().toISOString().slice(0, 7)}`,
    });

    return transaction;
  }

  // Reconcile trust account
  async reconcileTrustAccount(
    trustAccountId: string,
    reconciliationData: {
      reconciledBalance: number;
      discrepancies: string[];
      corrections: any[];
      reconciledBy: string;
    }
  ): Promise<{
    success: boolean;
    reconciliation: any;
    compliance: TrustAccountCompliance;
  }> {
    const trustAccount = await this.prisma.trustAccount.findUnique({
      where: { id: trustAccountId },
    });

    if (!trustAccount) {
      throw new Error('Trust account not found');
    }

    // Check if balance matches
    const balanceDiscrepancy = Math.abs(trustAccount.balance - reconciliationData.reconciledBalance);
    if (balanceDiscrepancy > 0.01) { // Allow for small rounding differences
      throw new Error(`Balance discrepancy detected: ${balanceDiscrepancy}`);
    }

    // Create reconciliation record
    const reconciliation = await this.prisma.trustReconciliation.create({
      data: {
        trustAccountId,
        reconciledBalance: reconciliationData.reconciledBalance,
        systemBalance: trustAccount.balance,
        discrepancies: reconciliationData.discrepancies,
        corrections: reconciliationData.corrections,
        reconciledBy: reconciliationData.reconciledBy,
        reconciledAt: new Date(),
      },
    });

    // Update compliance status
    const compliance = await this.checkTrustAccountCompliance(trustAccountId);

    return {
      success: true,
      reconciliation,
      compliance,
    };
  }

  // Transfer funds between trust accounts
  async transferTrustFunds(
    fromAccountId: string,
    toAccountId: string,
    amount: number,
    description: string,
    reference?: string
  ): Promise<{
    fromTransaction: TrustTransaction;
    toTransaction: TrustTransaction;
  }> {
    // Validate accounts exist and are active
    const fromAccount = await this.prisma.trustAccount.findUnique({
      where: { id: fromAccountId },
    });

    const toAccount = await this.prisma.trustAccount.findUnique({
      where: { id: toAccountId },
    });

    if (!fromAccount || !toAccount) {
      throw new Error('One or both trust accounts not found');
    }

    if (!fromAccount.isActive || !toAccount.isActive) {
      throw new Error('One or both trust accounts are not active');
    }

    if (fromAccount.currency !== toAccount.currency) {
      throw new Error('Currency mismatch between trust accounts');
    }

    if (fromAccount.balance < amount) {
      throw new Error('Insufficient balance in source trust account');
    }

    // Create withdrawal transaction
    const fromTransaction = await this.createTrustTransaction({
      trustAccountId: fromAccountId,
      type: TrustTransactionType.WITHDRAWAL,
      amount,
      description: `Transfer to ${toAccount.id}: ${description}`,
      reference: reference || `TRANSFER_${Date.now()}`,
    });

    // Create deposit transaction
    const toTransaction = await this.createTrustTransaction({
      trustAccountId: toAccountId,
      type: TrustTransactionType.DEPOSIT,
      amount,
      description: `Transfer from ${fromAccount.id}: ${description}`,
      reference: reference || `TRANSFER_${Date.now()}`,
    });

    return {
      fromTransaction,
      toTransaction,
    };
  }

  // Helper methods
  private async updateTrustAccountBalance(
    trustAccountId: string,
    transactionType: TrustTransactionType,
    amount: number
  ): Promise<void> {
    let updateData: any;

    switch (transactionType) {
      case TrustTransactionType.DEPOSIT:
      case TrustTransactionType.INTEREST:
        updateData = { balance: { increment: amount } };
        break;
      case TrustTransactionType.WITHDRAWAL:
        updateData = { balance: { decrement: amount } };
        break;
      default:
        throw new Error(`Unsupported transaction type: ${transactionType}`);
    }

    await this.prisma.trustAccount.update({
      where: { id: trustAccountId },
      data: updateData,
    });
  }

  private async handleTransactionCompliance(transaction: TrustTransaction): Promise<void> {
    // Handle compliance requirements for Chinese trust accounts
    // This would include:
    // - Client notifications
    // - Documentation requirements
    // - Regulatory reporting
    // - Audit trail maintenance

    console.log(`Processing compliance for transaction ${transaction.id}`);
  }

  private async checkFundSegregation(trustAccount: any): Promise<string | null> {
    // Check if client funds are properly segregated
    // This would involve checking bank account structures
    // For now, return null (no violation)
    return null;
  }

  private async checkInterestHandling(trustAccount: any): Promise<string | null> {
    // Check if interest is being properly handled and allocated to clients
    // This would involve checking interest calculation and distribution
    // For now, return null (no violation)
    return null;
  }

  private async checkReconciliationStatus(trustAccount: any): Promise<string | null> {
    // Check if monthly reconciliation is up to date
    const lastReconciliation = await this.getLastReconciliationDate(trustAccount.id);
    const nextReconciliation = this.calculateNextReconciliationDate(lastReconciliation);

    if (new Date() > nextReconciliation) {
      return 'Monthly reconciliation is overdue';
    }

    return null;
  }

  private async checkDocumentationCompleteness(trustAccount: any): Promise<string[]> {
    const warnings: string[] = [];

    // Check for missing documentation
    // This would involve checking for required documents
    // For now, return empty array
    return warnings;
  }

  private async checkClientNotificationRequirements(trustAccount: any): Promise<string[]> {
    const warnings: string[] = [];

    // Check if client notifications are up to date
    // This would involve checking notification logs
    // For now, return empty array
    return warnings;
  }

  private async getLastReconciliationDate(trustAccountId: string): Promise<Date | null> {
    const reconciliation = await this.prisma.trustReconciliation.findFirst({
      where: { trustAccountId },
      orderBy: { reconciledAt: 'desc' },
    });

    return reconciliation?.reconciledAt || null;
  }

  private calculateNextReconciliationDate(lastReconciliation: Date | null): Date {
    const baseDate = lastReconciliation || new Date();
    const nextDate = new Date(baseDate);
    nextDate.setMonth(nextDate.getMonth() + 1); // Monthly reconciliation
    return nextDate;
  }
}