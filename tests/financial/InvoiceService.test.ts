import { InvoiceService } from '../../src/services/financial/InvoiceService';
import { PrismaClient } from '@prisma/client';
import { InvoiceStatus, PaymentStatus, InvoiceTemplateType } from '../../src/models/financial';

// Mock PrismaClient
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    client: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    case: {
      findUnique: jest.fn(),
    },
    invoiceTemplate: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    invoice: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
    },
    invoiceItem: {
      deleteMany: jest.fn(),
    },
    invoiceReminder: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $disconnect: jest.fn(),
  };

  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

describe('InvoiceService', () => {
  let invoiceService: InvoiceService;
  let prisma: any;

  beforeEach(() => {
    prisma = new PrismaClient();
    invoiceService = new InvoiceService(prisma);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('createInvoice', () => {
    it('should create invoice successfully with template', async () => {
      const mockClient = {
        id: 'client-1',
        name: 'Test Client',
        email: 'client@test.com',
      };

      const mockUser = {
        id: 'user-1',
        name: 'Test User',
      };

      const mockTemplate = {
        id: 'template-1',
        name: 'Standard Template',
        type: InvoiceTemplateType.STANDARD,
        settings: {
          currency: 'CNY',
          taxRate: 0.06,
          paymentTerms: 30,
        },
      };

      const mockInvoice = {
        id: 'invoice-1',
        invoiceNumber: 'INV202508310001',
        clientId: 'client-1',
        userId: 'user-1',
        templateId: 'template-1',
        status: InvoiceStatus.DRAFT,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal: 1000,
        taxRate: 0.06,
        taxAmount: 60,
        total: 1060,
        currency: 'CNY',
        items: [],
        client: mockClient,
        user: mockUser,
        template: mockTemplate,
      };

      const request = {
        clientId: 'client-1',
        userId: 'user-1',
        templateId: 'template-1',
        items: [
          {
            type: 'service',
            description: 'Legal Consultation',
            quantity: 1,
            unitPrice: 1000,
          },
        ],
      };

      prisma.client.findUnique.mockResolvedValue(mockClient);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.invoiceTemplate.findUnique.mockResolvedValue(mockTemplate);
      prisma.invoice.create.mockResolvedValue(mockInvoice);

      const result = await invoiceService.createInvoice(request);

      expect(result).toBeDefined();
      expect(result.invoiceNumber).toBe('INV202508310001');
      expect(result.clientId).toBe('client-1');
      expect(result.total).toBe(1060);
      expect(prisma.client.findUnique).toHaveBeenCalledWith({
        where: { id: 'client-1' },
      });
      expect(prisma.invoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clientId: 'client-1',
          userId: 'user-1',
          templateId: 'template-1',
          subtotal: 1000,
          total: 1060,
          currency: 'CNY',
          items: {
            create: expect.arrayContaining([
              expect.objectContaining({
                type: 'service',
                description: 'Legal Consultation',
                quantity: 1,
                unitPrice: 1000,
                amount: 1000,
              }),
            ]),
          },
        }),
      });
    });

    it('should create invoice successfully with default template', async () => {
      const mockClient = {
        id: 'client-1',
        name: 'Test Client',
      };

      const mockUser = {
        id: 'user-1',
        name: 'Test User',
      };

      const mockDefaultTemplate = {
        id: 'default-template-1',
        name: 'Default Template',
        type: InvoiceTemplateType.STANDARD,
        settings: {
          currency: 'CNY',
          taxRate: 0.06,
          paymentTerms: 30,
        },
      };

      const mockInvoice = {
        id: 'invoice-1',
        invoiceNumber: 'INV202508310001',
        clientId: 'client-1',
        userId: 'user-1',
        templateId: 'default-template-1',
        status: InvoiceStatus.DRAFT,
        subtotal: 1000,
        taxRate: 0.06,
        taxAmount: 60,
        total: 1060,
        currency: 'CNY',
      };

      const request = {
        clientId: 'client-1',
        userId: 'user-1',
        items: [
          {
            type: 'service',
            description: 'Legal Consultation',
            quantity: 1,
            unitPrice: 1000,
          },
        ],
      };

      prisma.client.findUnique.mockResolvedValue(mockClient);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.invoiceTemplate.findUnique.mockResolvedValue(null);
      prisma.invoiceTemplate.findFirst.mockResolvedValue(mockDefaultTemplate);
      prisma.invoice.create.mockResolvedValue(mockInvoice);

      const result = await invoiceService.createInvoice(request);

      expect(result).toBeDefined();
      expect(result.templateId).toBe('default-template-1');
      expect(prisma.invoiceTemplate.findFirst).toHaveBeenCalledWith({
        where: {
          type: InvoiceTemplateType.STANDARD,
          isDefault: true,
          status: 'APPROVED',
        },
      });
    });

    it('should throw error when client not found', async () => {
      const request = {
        clientId: 'non-existent-client',
        userId: 'user-1',
        items: [],
      };

      prisma.client.findUnique.mockResolvedValue(null);

      await expect(invoiceService.createInvoice(request)).rejects.toThrow('Client not found');
    });

    it('should throw error when user not found', async () => {
      const mockClient = {
        id: 'client-1',
        name: 'Test Client',
      };

      const request = {
        clientId: 'client-1',
        userId: 'non-existent-user',
        items: [],
      };

      prisma.client.findUnique.mockResolvedValue(mockClient);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(invoiceService.createInvoice(request)).rejects.toThrow('User not found');
    });

    it('should throw error when case does not belong to client', async () => {
      const mockClient = {
        id: 'client-1',
        name: 'Test Client',
      };

      const mockUser = {
        id: 'user-1',
        name: 'Test User',
      };

      const mockCase = {
        id: 'case-1',
        clientId: 'client-2', // Different client
      };

      const request = {
        caseId: 'case-1',
        clientId: 'client-1',
        userId: 'user-1',
        items: [],
      };

      prisma.client.findUnique.mockResolvedValue(mockClient);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.case.findUnique.mockResolvedValue(mockCase);

      await expect(invoiceService.createInvoice(request)).rejects.toThrow('Case does not belong to the specified client');
    });

    it('should calculate totals correctly with multiple items', async () => {
      const mockClient = {
        id: 'client-1',
        name: 'Test Client',
      };

      const mockUser = {
        id: 'user-1',
        name: 'Test User',
      };

      const mockTemplate = {
        id: 'template-1',
        settings: {
          currency: 'CNY',
          taxRate: 0.1,
        },
      };

      const request = {
        clientId: 'client-1',
        userId: 'user-1',
        items: [
          {
            type: 'service',
            description: 'Service 1',
            quantity: 2,
            unitPrice: 500,
          },
          {
            type: 'expense',
            description: 'Expense 1',
            quantity: 1,
            unitPrice: 200,
            taxRate: 0.05,
          },
        ],
      };

      prisma.client.findUnique.mockResolvedValue(mockClient);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.invoiceTemplate.findUnique.mockResolvedValue(mockTemplate);

      const mockInvoice = {
        id: 'invoice-1',
        subtotal: 1200,
        taxRate: 0.1,
        taxAmount: 120,
        total: 1320,
      };

      prisma.invoice.create.mockResolvedValue(mockInvoice);

      const result = await invoiceService.createInvoice(request);

      expect(result.subtotal).toBe(1200);
      expect(result.taxAmount).toBe(120);
      expect(result.total).toBe(1320);
    });
  });

  describe('getInvoice', () => {
    it('should return invoice when found', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        invoiceNumber: 'INV202508310001',
        clientId: 'client-1',
        userId: 'user-1',
        status: InvoiceStatus.DRAFT,
        items: [],
        client: { id: 'client-1', name: 'Test Client' },
        user: { id: 'user-1', name: 'Test User' },
        payments: [],
      };

      prisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await invoiceService.getInvoice('invoice-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('invoice-1');
      expect(prisma.invoice.findUnique).toHaveBeenCalledWith({
        where: { id: 'invoice-1' },
        include: expect.objectContaining({
          items: true,
          client: true,
          user: true,
          payments: expect.objectContaining({
            orderBy: { createdAt: 'desc' },
          }),
        }),
      });
    });

    it('should return null when invoice not found', async () => {
      prisma.invoice.findUnique.mockResolvedValue(null);

      const result = await invoiceService.getInvoice('non-existent-invoice');

      expect(result).toBeNull();
    });
  });

  describe('getInvoices', () => {
    it('should return invoices with filters', async () => {
      const mockInvoices = [
        {
          id: 'invoice-1',
          invoiceNumber: 'INV202508310001',
          status: InvoiceStatus.DRAFT,
          clientId: 'client-1',
        },
        {
          id: 'invoice-2',
          invoiceNumber: 'INV202508310002',
          status: InvoiceStatus.SENT,
          clientId: 'client-2',
        },
      ];

      prisma.invoice.findMany.mockResolvedValue(mockInvoices);

      const result = await invoiceService.getInvoices({
        status: [InvoiceStatus.DRAFT, InvoiceStatus.SENT],
        clientId: 'client-1',
        dateFrom: new Date('2025-08-01'),
        dateTo: new Date('2025-08-31'),
      });

      expect(result).toHaveLength(2);
      expect(prisma.invoice.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.SENT] },
          clientId: 'client-1',
          issueDate: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
        include: expect.objectContaining({
          items: true,
          client: true,
          user: true,
          payments: expect.objectContaining({
            orderBy: { createdAt: 'desc' },
          }),
        }),
        orderBy: { issueDate: 'desc' },
      });
    });

    it('should return all invoices when no filters provided', async () => {
      const mockInvoices = [
        {
          id: 'invoice-1',
          invoiceNumber: 'INV202508310001',
          status: InvoiceStatus.DRAFT,
        },
      ];

      prisma.invoice.findMany.mockResolvedValue(mockInvoices);

      const result = await invoiceService.getInvoices();

      expect(result).toHaveLength(1);
      expect(prisma.invoice.findMany).toHaveBeenCalledWith({
        where: {},
        include: expect.any(Object),
        orderBy: { issueDate: 'desc' },
      });
    });
  });

  describe('updateInvoice', () => {
    it('should update invoice successfully', async () => {
      const existingInvoice = {
        id: 'invoice-1',
        status: InvoiceStatus.DRAFT,
        items: [
          { id: 'item-1', description: 'Old Item' },
        ],
      };

      const updatedInvoice = {
        id: 'invoice-1',
        status: InvoiceStatus.SENT,
        notes: 'Updated notes',
        items: [
          { id: 'new-item-1', description: 'New Item' },
        ],
      };

      const request = {
        status: InvoiceStatus.SENT,
        notes: 'Updated notes',
        items: [
          {
            type: 'service',
            description: 'New Item',
            quantity: 1,
            unitPrice: 1000,
          },
        ],
      };

      prisma.invoice.findUnique.mockResolvedValue(existingInvoice);
      prisma.invoiceItem.deleteMany.mockResolvedValue({});
      prisma.invoice.update.mockResolvedValue(updatedInvoice);

      const result = await invoiceService.updateInvoice('invoice-1', request);

      expect(result).toBeDefined();
      expect(result.status).toBe(InvoiceStatus.SENT);
      expect(prisma.invoiceItem.deleteMany).toHaveBeenCalledWith({
        where: { invoiceId: 'invoice-1' },
      });
      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'invoice-1' },
        data: expect.objectContaining({
          status: InvoiceStatus.SENT,
          notes: 'Updated notes',
          items: {
            create: expect.arrayContaining([
              expect.objectContaining({
                description: 'New Item',
                quantity: 1,
                unitPrice: 1000,
              }),
            ]),
          },
        }),
        include: expect.any(Object),
      });
    });

    it('should throw error when invoice not found', async () => {
      prisma.invoice.findUnique.mockResolvedValue(null);

      await expect(invoiceService.updateInvoice('non-existent-invoice', {}))
        .rejects.toThrow('Invoice not found');
    });

    it('should throw error when updating non-draft invoice', async () => {
      const existingInvoice = {
        id: 'invoice-1',
        status: InvoiceStatus.SENT, // Not draft
      };

      prisma.invoice.findUnique.mockResolvedValue(existingInvoice);

      await expect(invoiceService.updateInvoice('invoice-1', {}))
        .rejects.toThrow('Only draft invoices can be updated');
    });
  });

  describe('deleteInvoice', () => {
    it('should delete invoice successfully', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        status: InvoiceStatus.DRAFT,
      };

      prisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      prisma.invoice.delete.mockResolvedValue({});

      await invoiceService.deleteInvoice('invoice-1');

      expect(prisma.invoice.delete).toHaveBeenCalledWith({
        where: { id: 'invoice-1' },
      });
    });

    it('should throw error when invoice not found', async () => {
      prisma.invoice.findUnique.mockResolvedValue(null);

      await expect(invoiceService.deleteInvoice('non-existent-invoice'))
        .rejects.toThrow('Invoice not found');
    });

    it('should throw error when deleting non-draft invoice', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        status: InvoiceStatus.SENT, // Not draft
      };

      prisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      await expect(invoiceService.deleteInvoice('invoice-1'))
        .rejects.toThrow('Only draft invoices can be deleted');
    });
  });

  describe('sendInvoice', () => {
    it('should send invoice successfully via email', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        invoiceNumber: 'INV202508310001',
        status: InvoiceStatus.DRAFT,
        client: { id: 'client-1', email: 'client@test.com' },
        user: { id: 'user-1', name: 'Test User' },
        template: { id: 'template-1', name: 'Standard Template' },
      };

      const updatedInvoice = {
        id: 'invoice-1',
        status: InvoiceStatus.SENT,
        sentAt: new Date(),
      };

      const request = {
        invoiceId: 'invoice-1',
        sendMethod: 'email' as const,
        recipientEmail: 'recipient@test.com',
        message: 'Please find attached invoice',
      };

      prisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      prisma.invoice.update.mockResolvedValue(updatedInvoice);

      const result = await invoiceService.sendInvoice(request);

      expect(result).toBeDefined();
      expect(result.status).toBe(InvoiceStatus.SENT);
      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'invoice-1' },
        data: expect.objectContaining({
          status: InvoiceStatus.SENT,
          sentAt: expect.any(Date),
        }),
      });
    });

    it('should throw error when invoice not found', async () => {
      const request = {
        invoiceId: 'non-existent-invoice',
        sendMethod: 'email' as const,
      };

      prisma.invoice.findUnique.mockResolvedValue(null);

      await expect(invoiceService.sendInvoice(request))
        .rejects.toThrow('Invoice not found');
    });

    it('should throw error when sending non-draft invoice', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        status: InvoiceStatus.SENT, // Already sent
      };

      const request = {
        invoiceId: 'invoice-1',
        sendMethod: 'email' as const,
      };

      prisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      await expect(invoiceService.sendInvoice(request))
        .rejects.toThrow('Only draft invoices can be sent');
    });
  });

  describe('getInvoiceStatistics', () => {
    it('should return comprehensive invoice statistics', async () => {
      const mockInvoices = [
        {
          id: 'invoice-1',
          total: 1000,
          issueDate: new Date(),
          client: { id: 'client-1', name: 'Client A' },
          payments: [
            { amount: 1000, status: PaymentStatus.COMPLETED },
          ],
        },
        {
          id: 'invoice-2',
          total: 2000,
          issueDate: new Date(),
          client: { id: 'client-2', name: 'Client B' },
          payments: [
            { amount: 500, status: PaymentStatus.COMPLETED },
          ],
        },
        {
          id: 'invoice-3',
          total: 1500,
          dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
          status: InvoiceStatus.OVERDUE,
          payments: [],
        },
      ];

      prisma.invoice.findMany.mockResolvedValue(mockInvoices);

      const result = await invoiceService.getInvoiceStatistics();

      expect(result).toBeDefined();
      expect(result.totalInvoices).toBe(3);
      expect(result.totalAmount).toBe(4500);
      expect(result.totalPaid).toBe(1500);
      expect(result.totalOutstanding).toBe(3000);
      expect(result.overdueInvoices).toBe(1);
      expect(result.overdueAmount).toBe(1500);
      expect(result.topClients).toHaveLength(2);
    });

    it('should return empty statistics when no invoices', async () => {
      prisma.invoice.findMany.mockResolvedValue([]);

      const result = await invoiceService.getInvoiceStatistics();

      expect(result).toBeDefined();
      expect(result.totalInvoices).toBe(0);
      expect(result.totalAmount).toBe(0);
      expect(result.totalPaid).toBe(0);
      expect(result.topClients).toHaveLength(0);
    });
  });

  describe('generateInvoiceReminder', () => {
    it('should generate overdue reminder successfully', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        invoiceNumber: 'INV202508310001',
        client: { id: 'client-1', email: 'client@test.com' },
      };

      const mockReminder = {
        id: 'reminder-1',
        invoiceId: 'invoice-1',
        type: 'OVERDUE',
        sentAt: new Date(),
        recipient: 'client@test.com',
        message: 'Reminder: Invoice INV202508310001 is overdue',
        status: 'SENT',
      };

      prisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      prisma.invoiceReminder.create.mockResolvedValue(mockReminder);

      const result = await invoiceService.generateInvoiceReminder('invoice-1', 'OVERDUE');

      expect(result).toBeDefined();
      expect(result.type).toBe('OVERDUE');
      expect(result.invoiceId).toBe('invoice-1');
      expect(prisma.invoiceReminder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invoiceId: 'invoice-1',
          type: 'OVERDUE',
          recipient: 'client@test.com',
          status: 'SENT',
        }),
      });
    });

    it('should throw error when invoice not found', async () => {
      prisma.invoice.findUnique.mockResolvedValue(null);

      await expect(invoiceService.generateInvoiceReminder('non-existent-invoice', 'OVERDUE'))
        .rejects.toThrow('Invoice not found');
    });
  });

  describe('getInvoiceReminders', () => {
    it('should return reminders for specific invoice', async () => {
      const mockReminders = [
        {
          id: 'reminder-1',
          invoiceId: 'invoice-1',
          type: 'OVERDUE',
          sentAt: new Date(),
        },
        {
          id: 'reminder-2',
          invoiceId: 'invoice-1',
          type: 'DUE_SOON',
          sentAt: new Date(),
        },
      ];

      prisma.invoiceReminder.findMany.mockResolvedValue(mockReminders);

      const result = await invoiceService.getInvoiceReminders('invoice-1');

      expect(result).toHaveLength(2);
      expect(result[0].invoiceId).toBe('invoice-1');
      expect(prisma.invoiceReminder.findMany).toHaveBeenCalledWith({
        where: { invoiceId: 'invoice-1' },
        orderBy: { sentAt: 'desc' },
      });
    });

    it('should return all reminders when no invoiceId provided', async () => {
      const mockReminders = [
        {
          id: 'reminder-1',
          invoiceId: 'invoice-1',
          type: 'OVERDUE',
        },
        {
          id: 'reminder-2',
          invoiceId: 'invoice-2',
          type: 'DUE_SOON',
        },
      ];

      prisma.invoiceReminder.findMany.mockResolvedValue(mockReminders);

      const result = await invoiceService.getInvoiceReminders();

      expect(result).toHaveLength(2);
      expect(prisma.invoiceReminder.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { sentAt: 'desc' },
      });
    });
  });
});