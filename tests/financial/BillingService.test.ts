import { BillingService } from '../../src/services/financial/BillingService';
import { PrismaClient } from '@prisma/client';
import { InvoiceStatus, FeeType, PaymentStatus } from '../../src/models/financial';

// Mock PrismaClient
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    case: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    billingNode: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    invoice: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    timeEntry: {
      updateMany: jest.fn(),
    },
    expense: {
      updateMany: jest.fn(),
    },
    clientProfile: {
      findUnique: jest.fn(),
    },
    $disconnect: jest.fn(),
  };

  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

describe('BillingService', () => {
  let billingService: BillingService;
  let prisma: any;

  beforeEach(() => {
    prisma = new PrismaClient();
    billingService = new BillingService(prisma);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('createStageBilling', () => {
    it('should create stage billing successfully', async () => {
      const mockCase = {
        id: 'case-1',
        caseType: 'labor_dispute',
        phase: 'INTAKE_RISK_ASSESSMENT',
        client: { id: 'client-1' },
      };

      const mockBillingNodes = [
        {
          id: 'node-1',
          name: 'Initial Consultation',
          description: 'Initial case assessment',
          caseId: 'case-1',
          phase: 'INTAKE_RISK_ASSESSMENT',
          order: 1,
          amount: 5000,
          isActive: true,
        },
      ];

      const request = {
        caseId: 'case-1',
        phase: 'INTAKE_RISK_ASSESSMENT',
        milestones: [
          {
            id: 'milestone-1',
            name: 'Initial Consultation',
            description: 'Initial case assessment',
            phase: 'INTAKE_RISK_ASSESSMENT',
            order: 1,
            amount: 5000,
            isCompleted: false,
            requirements: ['Client meeting', 'Document review'],
            triggers: ['Case intake'],
          },
        ],
        configuration: {
          autoGenerateInvoices: true,
          requireClientApproval: false,
          sendNotifications: true,
          paymentTerms: 30,
          lateFeeRate: 0.02,
          currency: 'CNY',
          taxRate: 0.06,
        },
      };

      prisma.case.findUnique.mockResolvedValue(mockCase);
      prisma.billingNode.create.mockResolvedValue(mockBillingNodes[0]);

      const result = await billingService.createStageBilling(request);

      expect(result).toBeDefined();
      expect(result.billingNodes).toHaveLength(1);
      expect(result.billingNodes[0].name).toBe('Initial Consultation');
      expect(prisma.case.findUnique).toHaveBeenCalledWith({
        where: { id: 'case-1' },
      });
      expect(prisma.billingNode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Initial Consultation',
          caseId: 'case-1',
          phase: 'INTAKE_RISK_ASSESSMENT',
          amount: 5000,
        }),
      });
    });

    it('should throw error when case not found', async () => {
      const request = {
        caseId: 'non-existent-case',
        phase: 'INTAKE_RISK_ASSESSMENT',
        milestones: [],
        configuration: {
          autoGenerateInvoices: true,
          requireClientApproval: false,
          sendNotifications: true,
          paymentTerms: 30,
          lateFeeRate: 0.02,
          currency: 'CNY',
          taxRate: 0.06,
        },
      };

      prisma.case.findUnique.mockResolvedValue(null);

      await expect(billingService.createStageBilling(request)).rejects.toThrow('Case not found');
    });

    it('should validate phase compatibility', async () => {
      const mockCase = {
        id: 'case-1',
        caseType: 'labor_dispute',
        phase: 'INTAKE_RISK_ASSESSMENT',
        client: { id: 'client-1' },
      };

      const request = {
        caseId: 'case-1',
        phase: 'INCOMPATIBLE_PHASE',
        milestones: [],
        configuration: {
          autoGenerateInvoices: true,
          requireClientApproval: false,
          sendNotifications: true,
          paymentTerms: 30,
          lateFeeRate: 0.02,
          currency: 'CNY',
          taxRate: 0.06,
        },
      };

      prisma.case.findUnique.mockResolvedValue(mockCase);

      await expect(billingService.createStageBilling(request)).rejects.toThrow(
        'Phase INCOMPATIBLE_PHASE is not compatible with case type labor_dispute'
      );
    });
  });

  describe('getBillingNodesByCase', () => {
    it('should return billing nodes for a case', async () => {
      const mockBillingNodes = [
        {
          id: 'node-1',
          name: 'Initial Consultation',
          caseId: 'case-1',
          phase: 'INTAKE_RISK_ASSESSMENT',
          order: 1,
          amount: 5000,
          isActive: true,
        },
        {
          id: 'node-2',
          name: 'Document Review',
          caseId: 'case-1',
          phase: 'INTAKE_RISK_ASSESSMENT',
          order: 2,
          amount: 3000,
          isActive: true,
        },
      ];

      prisma.billingNode.findMany.mockResolvedValue(mockBillingNodes);

      const result = await billingService.getBillingNodesByCase('case-1');

      expect(result).toHaveLength(2);
      expect(result[0].order).toBe(1);
      expect(result[1].order).toBe(2);
      expect(prisma.billingNode.findMany).toHaveBeenCalledWith({
        where: { caseId: 'case-1', isActive: true },
        orderBy: { order: 'asc' },
        include: {
          case: {
            include: {
              client: true,
            },
          },
        },
      });
    });

    it('should filter by phase when specified', async () => {
      const mockBillingNodes = [
        {
          id: 'node-1',
          name: 'Initial Consultation',
          caseId: 'case-1',
          phase: 'INTAKE_RISK_ASSESSMENT',
          order: 1,
          amount: 5000,
          isActive: true,
        },
      ];

      prisma.billingNode.findMany.mockResolvedValue(mockBillingNodes);

      const result = await billingService.getBillingNodesByCase('case-1', {
        phase: 'INTAKE_RISK_ASSESSMENT',
      });

      expect(result).toHaveLength(1);
      expect(prisma.billingNode.findMany).toHaveBeenCalledWith({
        where: { caseId: 'case-1', isActive: true, phase: 'INTAKE_RISK_ASSESSMENT' },
        orderBy: { order: 'asc' },
        include: {
          case: {
            include: {
              client: true,
            },
          },
        },
      });
    });
  });

  describe('completeBillingNode', () => {
    it('should complete billing node successfully', async () => {
      const mockBillingNode = {
        id: 'node-1',
        name: 'Initial Consultation',
        caseId: 'case-1',
        phase: 'INTAKE_RISK_ASSESSMENT',
        order: 1,
        amount: 5000,
        isPaid: false,
        isActive: true,
        case: {
          id: 'case-1',
          clientId: 'client-1',
          billingNodes: [
            {
              id: 'node-2',
              name: 'Document Review',
              order: 2,
              phase: 'INTAKE_RISK_ASSESSMENT',
              isActive: true,
              isPaid: false,
            },
          ],
        },
      };

      const updatedNode = {
        ...mockBillingNode,
        isPaid: true,
        paidDate: new Date(),
      };

      prisma.billingNode.update.mockResolvedValue(updatedNode);

      const completionData = {
        completionDate: new Date(),
        notes: 'Milestone completed successfully',
        generateInvoice: false,
      };

      const result = await billingService.completeBillingNode('node-1', completionData);

      expect(result.billingNode.isPaid).toBe(true);
      expect(result.billingNode.paidDate).toBeDefined();
      expect(result.nextMilestones).toHaveLength(1);
      expect(result.nextMilestones[0].name).toBe('Document Review');
      expect(prisma.billingNode.update).toHaveBeenCalledWith({
        where: { id: 'node-1' },
        data: {
          isPaid: true,
          paidDate: completionData.completionDate,
          notes: completionData.notes,
        },
      });
    });
  });

  describe('generateInvoiceForBillingNode', () => {
    it('should generate invoice for billing node', async () => {
      const mockBillingNode = {
        id: 'node-1',
        name: 'Initial Consultation',
        caseId: 'case-1',
        phase: 'INTAKE_RISK_ASSESSMENT',
        order: 1,
        amount: 5000,
        isActive: true,
        case: {
          id: 'case-1',
          clientId: 'client-1',
          attorneyId: 'attorney-1',
          client: { id: 'client-1', name: 'Test Client' },
          timeEntries: [
            {
              id: 'time-1',
              description: 'Legal research',
              hours: 2,
              rate: 500,
              amount: 1000,
              isBilled: false,
            },
          ],
          expenses: [
            {
              id: 'expense-1',
              description: 'Court fees',
              amount: 200,
              isBilled: false,
              isBillable: true,
            },
          ],
        },
      };

      const mockInvoice = {
        id: 'invoice-1',
        invoiceNumber: 'INV2024080001',
        caseId: 'case-1',
        clientId: 'client-1',
        userId: 'attorney-1',
        status: InvoiceStatus.DRAFT,
        subtotal: 6200,
        taxAmount: 372,
        total: 6572,
        currency: 'CNY',
        items: [
          {
            type: 'billing_node',
            description: 'Initial Consultation - INTAKE_RISK_ASSESSMENT',
            quantity: 1,
            unitPrice: 5000,
            amount: 5000,
          },
        ],
      };

      prisma.billingNode.findUnique.mockResolvedValue(mockBillingNode);
      prisma.invoice.create.mockResolvedValue(mockInvoice);
      prisma.timeEntry.updateMany.mockResolvedValue({ count: 1 });
      prisma.expense.updateMany.mockResolvedValue({ count: 1 });

      const invoice = await billingService.generateInvoiceForBillingNode('node-1');

      expect(invoice).toBeDefined();
      expect(invoice.subtotal).toBe(6200);
      expect(invoice.total).toBe(6572);
      expect(prisma.invoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          caseId: 'case-1',
          clientId: 'client-1',
          userId: 'attorney-1',
          subtotal: 6200,
          total: 6572,
        }),
      });
    });

    it('should throw error when billing node not found', async () => {
      prisma.billingNode.findUnique.mockResolvedValue(null);

      await expect(billingService.generateInvoiceForBillingNode('non-existent')).rejects.toThrow(
        'Billing node not found'
      );
    });
  });

  describe('getBillingProgress', () => {
    it('should return billing progress for a case', async () => {
      const mockCase = {
        id: 'case-1',
        phase: 'INTAKE_RISK_ASSESSMENT',
        billingNodes: [
          { id: 'node-1', isPaid: true, amount: 5000 },
          { id: 'node-2', isPaid: false, amount: 3000 },
        ],
        invoices: [
          {
            id: 'invoice-1',
            total: 5000,
            payments: [
              { status: PaymentStatus.COMPLETED, amount: 5000 },
            ],
          },
        ],
      };

      prisma.case.findUnique.mockResolvedValue(mockCase);

      const progress = await billingService.getBillingProgress('case-1');

      expect(progress).toBeDefined();
      expect(progress.currentPhase).toBe('INTAKE_RISK_ASSESSMENT');
      expect(progress.completedNodes).toHaveLength(1);
      expect(progress.pendingNodes).toHaveLength(1);
      expect(progress.totalBilled).toBe(5000);
      expect(progress.totalPaid).toBe(5000);
      expect(progress.completionPercentage).toBe(50);
    });

    it('should throw error when case not found', async () => {
      prisma.case.findUnique.mockResolvedValue(null);

      await expect(billingService.getBillingProgress('non-existent')).rejects.toThrow('Case not found');
    });
  });

  describe('validateBillingMilestones', () => {
    it('should validate valid billing milestones', async () => {
      const milestones = [
        {
          id: 'milestone-1',
          name: 'Initial Consultation',
          phase: 'INTAKE_RISK_ASSESSMENT',
          order: 1,
          amount: 5000,
          isCompleted: false,
          requirements: ['Client meeting'],
          triggers: ['Case intake'],
        },
        {
          id: 'milestone-2',
          name: 'Document Review',
          phase: 'INTAKE_RISK_ASSESSMENT',
          order: 2,
          amount: 3000,
          isCompleted: false,
          requirements: ['Document analysis'],
          triggers: ['Review complete'],
        },
      ];

      const validation = await billingService.validateBillingMilestones(milestones);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect duplicate orders', async () => {
      const milestones = [
        {
          id: 'milestone-1',
          name: 'Initial Consultation',
          phase: 'INTAKE_RISK_ASSESSMENT',
          order: 1,
          amount: 5000,
          isCompleted: false,
          requirements: ['Client meeting'],
          triggers: ['Case intake'],
        },
        {
          id: 'milestone-2',
          name: 'Document Review',
          phase: 'INTAKE_RISK_ASSESSMENT',
          order: 1,
          amount: 3000,
          isCompleted: false,
          requirements: ['Document analysis'],
          triggers: ['Review complete'],
        },
      ];

      const validation = await billingService.validateBillingMilestones(milestones);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Duplicate milestone orders detected');
    });

    it('should detect missing required fields', async () => {
      const milestones = [
        {
          id: 'milestone-1',
          name: '', // Empty name
          phase: 'INTAKE_RISK_ASSESSMENT',
          order: 1,
          amount: 0, // Invalid amount
          isCompleted: false,
          requirements: [],
          triggers: [],
        },
      ];

      const validation = await billingService.validateBillingMilestones(milestones);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Milestone 1: Name is required');
      expect(validation.errors).toContain('Milestone 1: Amount must be greater than 0');
    });

    it('should generate warnings for missing requirements', async () => {
      const milestones = [
        {
          id: 'milestone-1',
          name: 'Initial Consultation',
          phase: 'INTAKE_RISK_ASSESSMENT',
          order: 1,
          amount: 5000,
          isCompleted: false,
          requirements: [], // No requirements
          triggers: ['Case intake'],
        },
      ];

      const validation = await billingService.validateBillingMilestones(milestones);

      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toContain('Milestone 1: No requirements specified');
    });
  });

  describe('autoGenerateInvoices', () => {
    it('should auto-generate invoices for completed nodes', async () => {
      const mockCompletedNodes = [
        {
          id: 'node-1',
          caseId: 'case-1',
          isActive: true,
          isPaid: true,
          invoice: null,
        },
      ];

      const mockInvoice = {
        id: 'invoice-1',
        invoiceNumber: 'INV2024080001',
        total: 5000,
      };

      prisma.billingNode.findMany.mockResolvedValue(mockCompletedNodes);
      prisma.billingNode.findUnique.mockResolvedValue({
        ...mockCompletedNodes[0],
        case: {
          id: 'case-1',
          clientId: 'client-1',
          attorneyId: 'attorney-1',
          client: { id: 'client-1' },
          timeEntries: [],
          expenses: [],
        },
      });
      prisma.invoice.create.mockResolvedValue(mockInvoice);

      const invoices = await billingService.autoGenerateInvoices('case-1');

      expect(invoices).toHaveLength(1);
      expect(invoices[0].id).toBe('invoice-1');
    });

    it('should return empty array when auto-generation is disabled', async () => {
      // Mock configuration with autoGenerateInvoices: false
      const invoices = await billingService.autoGenerateInvoices('case-1');

      expect(invoices).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      prisma.case.findUnique.mockRejectedValue(new Error('Database connection failed'));

      await expect(billingService.createStageBilling({
        caseId: 'case-1',
        phase: 'INTAKE_RISK_ASSESSMENT',
        milestones: [],
        configuration: {
          autoGenerateInvoices: true,
          requireClientApproval: false,
          sendNotifications: true,
          paymentTerms: 30,
          lateFeeRate: 0.02,
          currency: 'CNY',
          taxRate: 0.06,
        },
      })).rejects.toThrow('Database connection failed');
    });

    it('should handle validation errors with descriptive messages', async () => {
      const request = {
        caseId: 'case-1',
        phase: 'INTAKE_RISK_ASSESSMENT',
        milestones: [
          {
            id: 'milestone-1',
            name: '',
            phase: 'INTAKE_RISK_ASSESSMENT',
            order: 1,
            amount: -100,
            isCompleted: false,
            requirements: [],
            triggers: [],
          },
        ],
        configuration: {
          autoGenerateInvoices: true,
          requireClientApproval: false,
          sendNotifications: true,
          paymentTerms: 30,
          lateFeeRate: 0.02,
          currency: 'CNY',
          taxRate: 0.06,
        },
      };

      prisma.case.findUnique.mockResolvedValue({
        id: 'case-1',
        caseType: 'labor_dispute',
        phase: 'INTAKE_RISK_ASSESSMENT',
        client: { id: 'client-1' },
      });

      const validation = await billingService.validateBillingMilestones(request.milestones);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Milestone 1: Name is required');
      expect(validation.errors).toContain('Milestone 1: Amount must be greater than 0');
    });
  });
});