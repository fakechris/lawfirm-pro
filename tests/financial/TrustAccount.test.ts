import { TrustAccountService } from '../../src/services/financial/TrustAccountService';
import { PrismaClient } from '@prisma/client';
import { TrustTransactionType } from '../../src/models/financial';

// Mock PrismaClient
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    clientProfile: {
      findUnique: jest.fn(),
    },
    trustAccount: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    trustTransaction: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    trustReconciliation: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    $disconnect: jest.fn(),
  };

  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

describe('TrustAccountService', () => {
  let trustAccountService: TrustAccountService;
  let prisma: any;

  beforeEach(() => {
    prisma = new PrismaClient();
    trustAccountService = new TrustAccountService(prisma);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('createTrustAccount', () => {
    it('should create trust account successfully', async () => {
      const mockClient = {
        id: 'client-1',
        name: 'Test Client',
      };

      const mockTrustAccount = {
        id: 'trust-1',
        clientId: 'client-1',
        caseId: 'case-1',
        balance: 10000,
        currency: 'CNY',
        isActive: true,
        client: mockClient,
        case: { id: 'case-1', title: 'Test Case' },
      };

      const request = {
        clientId: 'client-1',
        caseId: 'case-1',
        initialBalance: 10000,
        notes: 'Test trust account',
        currency: 'CNY',
      };

      prisma.clientProfile.findUnique.mockResolvedValue(mockClient);
      prisma.trustAccount.findFirst.mockResolvedValue(null); // No existing account
      prisma.trustAccount.create.mockResolvedValue(mockTrustAccount);
      prisma.trustTransaction.create.mockResolvedValue({
        id: 'transaction-1',
        trustAccountId: 'trust-1',
        type: TrustTransactionType.DEPOSIT,
        amount: 10000,
        description: 'Initial deposit',
        status: 'completed',
      });

      const result = await trustAccountService.createTrustAccount(request);

      expect(result).toBeDefined();
      expect(result.id).toBe('trust-1');
      expect(result.balance).toBe(10000);
      expect(prisma.clientProfile.findUnique).toHaveBeenCalledWith({
        where: { id: 'client-1' },
      });
      expect(prisma.trustAccount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clientId: 'client-1',
          caseId: 'case-1',
          balance: 10000,
          currency: 'CNY',
        }),
      });
    });

    it('should throw error when client not found', async () => {
      const request = {
        clientId: 'non-existent-client',
        caseId: 'case-1',
        initialBalance: 10000,
      };

      prisma.clientProfile.findUnique.mockResolvedValue(null);

      await expect(trustAccountService.createTrustAccount(request)).rejects.toThrow('Client not found');
    });

    it('should throw error when trust account already exists', async () => {
      const mockClient = {
        id: 'client-1',
        name: 'Test Client',
      };

      const existingAccount = {
        id: 'existing-trust-1',
        clientId: 'client-1',
        caseId: 'case-1',
        isActive: true,
      };

      const request = {
        clientId: 'client-1',
        caseId: 'case-1',
        initialBalance: 10000,
      };

      prisma.clientProfile.findUnique.mockResolvedValue(mockClient);
      prisma.trustAccount.findFirst.mockResolvedValue(existingAccount);

      await expect(trustAccountService.createTrustAccount(request)).rejects.toThrow(
        'Trust account already exists for this client/case combination'
      );
    });

    it('should create initial deposit transaction when initial balance provided', async () => {
      const mockClient = {
        id: 'client-1',
        name: 'Test Client',
      };

      const mockTrustAccount = {
        id: 'trust-1',
        clientId: 'client-1',
        caseId: 'case-1',
        balance: 10000,
        currency: 'CNY',
        isActive: true,
      };

      const request = {
        clientId: 'client-1',
        caseId: 'case-1',
        initialBalance: 10000,
      };

      prisma.clientProfile.findUnique.mockResolvedValue(mockClient);
      prisma.trustAccount.findFirst.mockResolvedValue(null);
      prisma.trustAccount.create.mockResolvedValue(mockTrustAccount);
      prisma.trustTransaction.create.mockResolvedValue({
        id: 'transaction-1',
        type: TrustTransactionType.DEPOSIT,
        amount: 10000,
      });

      await trustAccountService.createTrustAccount(request);

      expect(prisma.trustTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          trustAccountId: 'trust-1',
          type: TrustTransactionType.DEPOSIT,
          amount: 10000,
          description: 'Initial deposit',
          reference: 'INITIAL_DEPOSIT',
        }),
      });
    });
  });

  describe('getTrustAccountById', () => {
    it('should return trust account by ID', async () => {
      const mockTrustAccount = {
        id: 'trust-1',
        clientId: 'client-1',
        caseId: 'case-1',
        balance: 10000,
        currency: 'CNY',
        isActive: true,
        client: { id: 'client-1', name: 'Test Client' },
        case: { id: 'case-1', title: 'Test Case' },
        transactions: [
          {
            id: 'transaction-1',
            type: TrustTransactionType.DEPOSIT,
            amount: 10000,
            createdAt: new Date(),
          },
        ],
      };

      prisma.trustAccount.findUnique.mockResolvedValue(mockTrustAccount);

      const result = await trustAccountService.getTrustAccountById('trust-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('trust-1');
      expect(result.transactions).toHaveLength(1);
      expect(prisma.trustAccount.findUnique).toHaveBeenCalledWith({
        where: { id: 'trust-1' },
        include: {
          client: true,
          case: true,
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });
    });

    it('should return null when trust account not found', async () => {
      prisma.trustAccount.findUnique.mockResolvedValue(null);

      const result = await trustAccountService.getTrustAccountById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getTrustAccountsByClient', () => {
    it('should return trust accounts for a client', async () => {
      const mockTrustAccounts = [
        {
          id: 'trust-1',
          clientId: 'client-1',
          caseId: 'case-1',
          balance: 10000,
          currency: 'CNY',
          isActive: true,
          case: { id: 'case-1', title: 'Test Case 1' },
          transactions: [],
        },
        {
          id: 'trust-2',
          clientId: 'client-1',
          caseId: 'case-2',
          balance: 5000,
          currency: 'CNY',
          isActive: true,
          case: { id: 'case-2', title: 'Test Case 2' },
          transactions: [],
        },
      ];

      prisma.trustAccount.findMany.mockResolvedValue(mockTrustAccounts);

      const result = await trustAccountService.getTrustAccountsByClient('client-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('trust-1');
      expect(result[1].id).toBe('trust-2');
      expect(prisma.trustAccount.findMany).toHaveBeenCalledWith({
        where: { clientId: 'client-1', isActive: true },
        include: {
          case: true,
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('createTrustTransaction', () => {
    it('should create deposit transaction successfully', async () => {
      const mockTrustAccount = {
        id: 'trust-1',
        clientId: 'client-1',
        balance: 10000,
        currency: 'CNY',
        isActive: true,
      };

      const mockTransaction = {
        id: 'transaction-1',
        trustAccountId: 'trust-1',
        type: TrustTransactionType.DEPOSIT,
        amount: 5000,
        description: 'Additional deposit',
        status: 'completed',
        createdAt: new Date(),
      };

      const request = {
        trustAccountId: 'trust-1',
        type: TrustTransactionType.DEPOSIT,
        amount: 5000,
        description: 'Additional deposit',
        reference: 'DEP-001',
      };

      prisma.trustAccount.findUnique.mockResolvedValue(mockTrustAccount);
      prisma.trustTransaction.create.mockResolvedValue(mockTransaction);
      prisma.trustAccount.update.mockResolvedValue({
        ...mockTrustAccount,
        balance: 15000,
      });

      const result = await trustAccountService.createTrustTransaction(request);

      expect(result).toBeDefined();
      expect(result.id).toBe('transaction-1');
      expect(result.amount).toBe(5000);
      expect(prisma.trustTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          trustAccountId: 'trust-1',
          type: TrustTransactionType.DEPOSIT,
          amount: 5000,
          description: 'Additional deposit',
          reference: 'DEP-001',
        }),
      });
      expect(prisma.trustAccount.update).toHaveBeenCalledWith({
        where: { id: 'trust-1' },
        data: { balance: { increment: 5000 } },
      });
    });

    it('should create withdrawal transaction successfully', async () => {
      const mockTrustAccount = {
        id: 'trust-1',
        clientId: 'client-1',
        balance: 10000,
        currency: 'CNY',
        isActive: true,
      };

      const mockTransaction = {
        id: 'transaction-1',
        trustAccountId: 'trust-1',
        type: TrustTransactionType.WITHDRAWAL,
        amount: 3000,
        description: 'Fee withdrawal',
        status: 'completed',
        createdAt: new Date(),
      };

      const request = {
        trustAccountId: 'trust-1',
        type: TrustTransactionType.WITHDRAWAL,
        amount: 3000,
        description: 'Fee withdrawal',
        reference: 'WD-001',
      };

      prisma.trustAccount.findUnique.mockResolvedValue(mockTrustAccount);
      prisma.trustTransaction.create.mockResolvedValue(mockTransaction);
      prisma.trustAccount.update.mockResolvedValue({
        ...mockTrustAccount,
        balance: 7000,
      });

      const result = await trustAccountService.createTrustTransaction(request);

      expect(result).toBeDefined();
      expect(result.type).toBe(TrustTransactionType.WITHDRAWAL);
      expect(prisma.trustAccount.update).toHaveBeenCalledWith({
        where: { id: 'trust-1' },
        data: { balance: { decrement: 3000 } },
      });
    });

    it('should throw error when trust account not found', async () => {
      const request = {
        trustAccountId: 'non-existent',
        type: TrustTransactionType.DEPOSIT,
        amount: 1000,
        description: 'Test deposit',
      };

      prisma.trustAccount.findUnique.mockResolvedValue(null);

      await expect(trustAccountService.createTrustTransaction(request)).rejects.toThrow(
        'Trust account not found'
      );
    });

    it('should throw error when trust account is not active', async () => {
      const mockTrustAccount = {
        id: 'trust-1',
        clientId: 'client-1',
        balance: 10000,
        currency: 'CNY',
        isActive: false,
      };

      const request = {
        trustAccountId: 'trust-1',
        type: TrustTransactionType.DEPOSIT,
        amount: 1000,
        description: 'Test deposit',
      };

      prisma.trustAccount.findUnique.mockResolvedValue(mockTrustAccount);

      await expect(trustAccountService.createTrustTransaction(request)).rejects.toThrow(
        'Trust account is not active'
      );
    });

    it('should throw error for invalid transaction amount', async () => {
      const mockTrustAccount = {
        id: 'trust-1',
        clientId: 'client-1',
        balance: 10000,
        currency: 'CNY',
        isActive: true,
      };

      const request = {
        trustAccountId: 'trust-1',
        type: TrustTransactionType.DEPOSIT,
        amount: -100, // Invalid negative amount
        description: 'Test deposit',
      };

      prisma.trustAccount.findUnique.mockResolvedValue(mockTrustAccount);

      await expect(trustAccountService.createTrustTransaction(request)).rejects.toThrow(
        'Transaction amount must be greater than 0'
      );
    });

    it('should throw error for insufficient balance on withdrawal', async () => {
      const mockTrustAccount = {
        id: 'trust-1',
        clientId: 'client-1',
        balance: 1000,
        currency: 'CNY',
        isActive: true,
      };

      const request = {
        trustAccountId: 'trust-1',
        type: TrustTransactionType.WITHDRAWAL,
        amount: 5000, // More than available balance
        description: 'Large withdrawal',
      };

      prisma.trustAccount.findUnique.mockResolvedValue(mockTrustAccount);

      await expect(trustAccountService.createTrustTransaction(request)).rejects.toThrow(
        'Insufficient trust account balance'
      );
    });
  });

  describe('getTrustAccountBalance', () => {
    it('should return trust account balance', async () => {
      const mockTrustAccount = {
        id: 'trust-1',
        balance: 10000,
        currency: 'CNY',
        updatedAt: new Date(),
      };

      prisma.trustAccount.findUnique.mockResolvedValue(mockTrustAccount);
      prisma.trustTransaction.findMany.mockResolvedValue([]); // No pending transactions

      const balance = await trustAccountService.getTrustAccountBalance('trust-1');

      expect(balance.totalBalance).toBe(10000);
      expect(balance.availableBalance).toBe(10000);
      expect(balance.pendingBalance).toBe(0);
      expect(balance.currency).toBe('CNY');
    });

    it('should calculate available balance considering pending transactions', async () => {
      const mockTrustAccount = {
        id: 'trust-1',
        balance: 10000,
        currency: 'CNY',
        updatedAt: new Date(),
      };

      const pendingTransactions = [
        { amount: 2000 },
        { amount: 1000 },
      ];

      prisma.trustAccount.findUnique.mockResolvedValue(mockTrustAccount);
      prisma.trustTransaction.findMany.mockResolvedValue(pendingTransactions);

      const balance = await trustAccountService.getTrustAccountBalance('trust-1');

      expect(balance.totalBalance).toBe(10000);
      expect(balance.availableBalance).toBe(7000); // 10000 - 3000
      expect(balance.pendingBalance).toBe(3000);
    });
  });

  describe('generateTrustAccountStatement', () => {
    it('should generate trust account statement', async () => {
      const mockTrustAccount = {
        id: 'trust-1',
        clientId: 'client-1',
        caseId: 'case-1',
        balance: 10000,
        currency: 'CNY',
        client: { id: 'client-1', name: 'Test Client' },
        case: { id: 'case-1', title: 'Test Case' },
      };

      const mockTransactions = [
        {
          id: 'transaction-1',
          type: TrustTransactionType.DEPOSIT,
          amount: 10000,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'transaction-2',
          type: TrustTransactionType.WITHDRAWAL,
          amount: 3000,
          createdAt: new Date('2024-01-15'),
        },
      ];

      const period = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      prisma.trustAccount.findUnique.mockResolvedValue(mockTrustAccount);
      prisma.trustTransaction.findMany.mockResolvedValue(mockTransactions);

      // Mock balance calculation
      jest.spyOn(trustAccountService, 'getTrustAccountBalance' as any).mockResolvedValue({
        totalBalance: 7000,
        availableBalance: 7000,
        pendingBalance: 0,
        currency: 'CNY',
        lastUpdated: new Date(),
      });

      const statement = await trustAccountService.generateTrustAccountStatement('trust-1', period);

      expect(statement).toBeDefined();
      expect(statement.account.id).toBe('trust-1');
      expect(statement.transactions).toHaveLength(2);
      expect(statement.summary.totalDeposits).toBe(10000);
      expect(statement.summary.totalWithdrawals).toBe(3000);
      expect(statement.summary.netChange).toBe(7000);
      expect(statement.period.startDate).toEqual(period.startDate);
      expect(statement.period.endDate).toEqual(period.endDate);
    });

    it('should throw error when trust account not found', async () => {
      prisma.trustAccount.findUnique.mockResolvedValue(null);

      await expect(
        trustAccountService.generateTrustAccountStatement('non-existent', {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
        })
      ).rejects.toThrow('Trust account not found');
    });
  });

  describe('checkTrustAccountCompliance', () => {
    it('should check trust account compliance', async () => {
      const mockTrustAccount = {
        id: 'trust-1',
        balance: 10000,
        currency: 'CNY',
        transactions: [
          { id: 'transaction-1', type: TrustTransactionType.DEPOSIT, amount: 10000 },
          { id: 'transaction-2', type: TrustTransactionType.WITHDRAWAL, amount: 3000 },
        ],
      };

      prisma.trustAccount.findUnique.mockResolvedValue(mockTrustAccount);

      // Mock helper methods
      jest.spyOn(trustAccountService as any, 'checkFundSegregation').mockResolvedValue(null);
      jest.spyOn(trustAccountService as any, 'checkInterestHandling').mockResolvedValue(null);
      jest.spyOn(trustAccountService as any, 'checkReconciliationStatus').mockResolvedValue(null);
      jest.spyOn(trustAccountService as any, 'checkDocumentationCompleteness').mockResolvedValue([]);
      jest.spyOn(trustAccountService as any, 'checkClientNotificationRequirements').mockResolvedValue([]);
      jest.spyOn(trustAccountService as any, 'getLastReconciliationDate').mockResolvedValue(new Date('2024-01-01'));

      const compliance = await trustAccountService.checkTrustAccountCompliance('trust-1');

      expect(compliance).toBeDefined();
      expect(compliance.isCompliant).toBe(true);
      expect(compliance.violations).toHaveLength(0);
      expect(compliance.requirements.segregationRequired).toBe(true);
      expect(compliance.requirements.interestHandlingRequired).toBe(true);
      expect(compliance.requirements.reconciliationRequired).toBe(true);
    });

    it('should detect compliance violations', async () => {
      const mockTrustAccount = {
        id: 'trust-1',
        balance: 10000,
        currency: 'CNY',
        transactions: [],
      };

      prisma.trustAccount.findUnique.mockResolvedValue(mockTrustAccount);

      // Mock helper methods to return violations
      jest.spyOn(trustAccountService as any, 'checkFundSegregation').mockResolvedValue('Fund segregation violation');
      jest.spyOn(trustAccountService as any, 'checkInterestHandling').mockResolvedValue(null);
      jest.spyOn(trustAccountService as any, 'checkReconciliationStatus').mockResolvedValue('Monthly reconciliation is overdue');
      jest.spyOn(trustAccountService as any, 'checkDocumentationCompleteness').mockResolvedValue(['Missing documentation']);
      jest.spyOn(trustAccountService as any, 'checkClientNotificationRequirements').mockResolvedValue([]);
      jest.spyOn(trustAccountService as any, 'getLastReconciliationDate').mockResolvedValue(new Date('2024-01-01'));

      const compliance = await trustAccountService.checkTrustAccountCompliance('trust-1');

      expect(compliance.isCompliant).toBe(false);
      expect(compliance.violations).toContain('Fund segregation violation');
      expect(compliance.violations).toContain('Monthly reconciliation is overdue');
      expect(compliance.warnings).toContain('Missing documentation');
    });
  });

  describe('processMonthlyInterest', () => {
    it('should process monthly interest accrual', async () => {
      const mockTrustAccount = {
        id: 'trust-1',
        balance: 100000, // Large balance for meaningful interest
        currency: 'CNY',
      };

      const mockTransaction = {
        id: 'transaction-1',
        trustAccountId: 'trust-1',
        type: TrustTransactionType.INTEREST,
        amount: 250, // 100000 * 0.0025
        description: 'Monthly interest accrual',
        status: 'completed',
      };

      prisma.trustAccount.findUnique.mockResolvedValue(mockTrustAccount);
      jest.spyOn(trustAccountService, 'createTrustTransaction' as any).mockResolvedValue(mockTransaction);

      const result = await trustAccountService.processMonthlyInterest('trust-1');

      expect(result).toBeDefined();
      expect(result.type).toBe(TrustTransactionType.INTEREST);
      expect(result.amount).toBe(250);
      expect(trustAccountService.createTrustTransaction).toHaveBeenCalledWith({
        trustAccountId: 'trust-1',
        type: TrustTransactionType.INTEREST,
        amount: 250,
        description: 'Monthly interest accrual',
        reference: expect.stringContaining('INTEREST_'),
      });
    });

    it('should throw error when no interest to accrue', async () => {
      const mockTrustAccount = {
        id: 'trust-1',
        balance: 0, // No balance
        currency: 'CNY',
      };

      prisma.trustAccount.findUnique.mockResolvedValue(mockTrustAccount);

      await expect(trustAccountService.processMonthlyInterest('trust-1')).rejects.toThrow(
        'No interest to accrue'
      );
    });
  });

  describe('reconcileTrustAccount', () => {
    it('should reconcile trust account successfully', async () => {
      const mockTrustAccount = {
        id: 'trust-1',
        balance: 10000,
      };

      const reconciliationData = {
        reconciledBalance: 10000,
        discrepancies: [],
        corrections: [],
        reconciledBy: 'user-1',
      };

      const mockReconciliation = {
        id: 'reconciliation-1',
        trustAccountId: 'trust-1',
        reconciledBalance: 10000,
        systemBalance: 10000,
        discrepancies: [],
        corrections: [],
        reconciledBy: 'user-1',
        reconciledAt: new Date(),
      };

      prisma.trustAccount.findUnique.mockResolvedValue(mockTrustAccount);
      prisma.trustReconciliation.create.mockResolvedValue(mockReconciliation);
      jest.spyOn(trustAccountService, 'checkTrustAccountCompliance').mockResolvedValue({
        isCompliant: true,
        violations: [],
        warnings: [],
        requirements: {
          segregationRequired: true,
          interestHandlingRequired: true,
          reconciliationRequired: true,
          documentationRequired: true,
          clientNotificationRequired: true,
        },
      });

      const result = await trustAccountService.reconcileTrustAccount('trust-1', reconciliationData);

      expect(result.success).toBe(true);
      expect(result.reconciliation.id).toBe('reconciliation-1');
      expect(prisma.trustReconciliation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          trustAccountId: 'trust-1',
          reconciledBalance: 10000,
          systemBalance: 10000,
          reconciledBy: 'user-1',
        }),
      });
    });

    it('should throw error when balance discrepancy detected', async () => {
      const mockTrustAccount = {
        id: 'trust-1',
        balance: 10000,
      };

      const reconciliationData = {
        reconciledBalance: 10500, // Different from system balance
        discrepancies: [],
        corrections: [],
        reconciledBy: 'user-1',
      };

      prisma.trustAccount.findUnique.mockResolvedValue(mockTrustAccount);

      await expect(
        trustAccountService.reconcileTrustAccount('trust-1', reconciliationData)
      ).rejects.toThrow('Balance discrepancy detected');
    });
  });

  describe('transferTrustFunds', () => {
    it('should transfer funds between trust accounts successfully', async () => {
      const mockFromAccount = {
        id: 'trust-1',
        balance: 10000,
        currency: 'CNY',
        isActive: true,
      };

      const mockToAccount = {
        id: 'trust-2',
        balance: 5000,
        currency: 'CNY',
        isActive: true,
      };

      const mockFromTransaction = {
        id: 'transaction-1',
        type: TrustTransactionType.WITHDRAWAL,
        amount: 3000,
      };

      const mockToTransaction = {
        id: 'transaction-2',
        type: TrustTransactionType.DEPOSIT,
        amount: 3000,
      };

      prisma.trustAccount.findUnique
        .mockResolvedValueOnce(mockFromAccount)
        .mockResolvedValueOnce(mockToAccount);

      jest.spyOn(trustAccountService, 'createTrustTransaction' as any)
        .mockResolvedValueOnce(mockFromTransaction)
        .mockResolvedValueOnce(mockToTransaction);

      const result = await trustAccountService.transferTrustFunds(
        'trust-1',
        'trust-2',
        3000,
        'Fee transfer',
        'TRANSFER-001'
      );

      expect(result).toBeDefined();
      expect(result.fromTransaction.type).toBe(TrustTransactionType.WITHDRAWAL);
      expect(result.toTransaction.type).toBe(TrustTransactionType.DEPOSIT);
      expect(result.fromTransaction.amount).toBe(3000);
      expect(result.toTransaction.amount).toBe(3000);
    });

    it('should throw error when accounts have different currencies', async () => {
      const mockFromAccount = {
        id: 'trust-1',
        balance: 10000,
        currency: 'CNY',
        isActive: true,
      };

      const mockToAccount = {
        id: 'trust-2',
        balance: 5000,
        currency: 'USD', // Different currency
        isActive: true,
      };

      prisma.trustAccount.findUnique
        .mockResolvedValueOnce(mockFromAccount)
        .mockResolvedValueOnce(mockToAccount);

      await expect(
        trustAccountService.transferTrustFunds('trust-1', 'trust-2', 3000, 'Fee transfer')
      ).rejects.toThrow('Currency mismatch between trust accounts');
    });

    it('should throw error when insufficient balance', async () => {
      const mockFromAccount = {
        id: 'trust-1',
        balance: 1000, // Low balance
        currency: 'CNY',
        isActive: true,
      };

      const mockToAccount = {
        id: 'trust-2',
        balance: 5000,
        currency: 'CNY',
        isActive: true,
      };

      prisma.trustAccount.findUnique
        .mockResolvedValueOnce(mockFromAccount)
        .mockResolvedValueOnce(mockToAccount);

      await expect(
        trustAccountService.transferTrustFunds('trust-1', 'trust-2', 3000, 'Fee transfer')
      ).rejects.toThrow('Insufficient balance in source trust account');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      prisma.clientProfile.findUnique.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        trustAccountService.createTrustAccount({
          clientId: 'client-1',
          initialBalance: 10000,
        })
      ).rejects.toThrow('Database connection failed');
    });

    it('should validate input parameters', async () => {
      const mockClient = {
        id: 'client-1',
        name: 'Test Client',
      };

      prisma.clientProfile.findUnique.mockResolvedValue(mockClient);
      prisma.trustAccount.findFirst.mockResolvedValue(null);

      // Test invalid initial balance
      await expect(
        trustAccountService.createTrustAccount({
          clientId: 'client-1',
          initialBalance: -1000, // Invalid negative balance
        })
      ).rejects.toThrow(); // Should throw some validation error
    });
  });
});