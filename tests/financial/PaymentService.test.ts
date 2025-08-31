import { PaymentService } from '../../src/services/financial/PaymentService';
import { PaymentMethod, PaymentStatus } from '../../src/models/financial';
import { PrismaClient } from '@prisma/client';

// Mock PrismaClient
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    payment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    invoice: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    scheduledPayment: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  })),
}));

// Mock other services
jest.mock('../../src/services/financial/PaymentGatewayService', () => ({
  PaymentGatewayService: jest.fn().mockImplementation(() => ({
    initializePayment: jest.fn(),
    checkPaymentStatus: jest.fn(),
    processWebhook: jest.fn(),
  })),
}));

jest.mock('../../src/services/financial/AlipayService', () => ({
  AlipayService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../src/services/financial/WechatPayService', () => ({
  WechatPayService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../src/config/financial', () => ({
  getPaymentConfig: jest.fn().mockReturnValue({
    processing: {
      currency: 'CNY',
      minAmount: 1,
      maxAmount: 1000000,
    },
  }),
}));

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let mockPrisma: any;
  let mockGatewayService: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    mockGatewayService = {
      initializePayment: jest.fn(),
      checkPaymentStatus: jest.fn(),
      processWebhook: jest.fn(),
    };
    
    paymentService = new PaymentService(mockPrisma);
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('createPayment', () => {
    it('should create payment successfully', async () => {
      const request = {
        invoiceId: 'invoice-123',
        amount: 100,
        method: PaymentMethod.ALIPAY,
        description: 'Test payment',
        clientInfo: {
          name: 'Test Client',
          email: 'test@example.com',
        },
      };

      const mockInvoice = {
        id: 'invoice-123',
        invoiceNumber: 'INV-001',
        status: 'UNPAID',
        total: 200,
        clientId: 'client-123',
      };

      const mockPayment = {
        id: 'payment-123',
        invoiceId: 'invoice-123',
        amount: 100,
        status: PaymentStatus.PENDING,
        reference: 'PAY_123456',
      };

      const mockGatewayResponse = {
        success: true,
        transactionId: 'txn-123',
        paymentUrl: 'https://alipay.com/pay',
        message: 'Payment initialized',
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.payment.create.mockResolvedValue(mockPayment);
      mockPrisma.payment.update.mockResolvedValue(mockPayment);
      mockGatewayService.initializePayment.mockResolvedValue(mockGatewayResponse);

      const result = await paymentService.createPayment(request);

      expect(result.success).toBe(true);
      expect(result.payment).toEqual(mockPayment);
      expect(result.paymentUrl).toBe(mockGatewayResponse.paymentUrl);
      expect(result.transactionId).toBe(mockGatewayResponse.transactionId);
      expect(mockPrisma.invoice.findUnique).toHaveBeenCalledWith({
        where: { id: request.invoiceId },
      });
      expect(mockPrisma.payment.create).toHaveBeenCalled();
      expect(mockGatewayService.initializePayment).toHaveBeenCalledWith(
        request.method,
        expect.objectContaining({
          amount: request.amount,
          currency: 'CNY',
          description: request.description,
          orderId: expect.any(String),
          clientInfo: request.clientInfo,
        })
      );
    });

    it('should return error when invoice not found', async () => {
      const request = {
        invoiceId: 'non-existent',
        amount: 100,
        method: PaymentMethod.ALIPAY,
        clientInfo: {
          name: 'Test Client',
          email: 'test@example.com',
        },
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      const result = await paymentService.createPayment(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invoice not found');
    });

    it('should return error when invoice is already paid', async () => {
      const request = {
        invoiceId: 'invoice-123',
        amount: 100,
        method: PaymentMethod.ALIPAY,
        clientInfo: {
          name: 'Test Client',
          email: 'test@example.com',
        },
      };

      const mockInvoice = {
        id: 'invoice-123',
        status: 'PAID',
        total: 200,
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await paymentService.createPayment(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be paid');
    });

    it('should return error when payment amount exceeds remaining balance', async () => {
      const request = {
        invoiceId: 'invoice-123',
        amount: 150,
        method: PaymentMethod.ALIPAY,
        clientInfo: {
          name: 'Test Client',
          email: 'test@example.com',
        },
      };

      const mockInvoice = {
        id: 'invoice-123',
        status: 'UNPAID',
        total: 200,
      };

      const mockExistingPayment = {
        id: 'existing-payment',
        amount: 100,
        status: PaymentStatus.COMPLETED,
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.payment.findMany.mockResolvedValue([mockExistingPayment]);

      const result = await paymentService.createPayment(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds remaining balance');
    });

    it('should return error when gateway initialization fails', async () => {
      const request = {
        invoiceId: 'invoice-123',
        amount: 100,
        method: PaymentMethod.ALIPAY,
        clientInfo: {
          name: 'Test Client',
          email: 'test@example.com',
        },
      };

      const mockInvoice = {
        id: 'invoice-123',
        status: 'UNPAID',
        total: 200,
      };

      const mockPayment = {
        id: 'payment-123',
        status: PaymentStatus.PENDING,
      };

      const mockGatewayResponse = {
        success: false,
        error: 'Gateway error',
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.payment.create.mockResolvedValue(mockPayment);
      mockPrisma.payment.findMany.mockResolvedValue([]);
      mockGatewayService.initializePayment.mockResolvedValue(mockGatewayResponse);

      const result = await paymentService.createPayment(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Gateway error');
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-123' },
        data: { status: PaymentStatus.FAILED },
      });
    });
  });

  describe('getPaymentById', () => {
    it('should return payment by ID', async () => {
      const mockPayment = {
        id: 'payment-123',
        invoiceId: 'invoice-123',
        amount: 100,
        invoice: {
          client: { id: 'client-123', name: 'Test Client' },
          case: { id: 'case-123', title: 'Test Case' },
        },
      };

      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);

      const result = await paymentService.getPaymentById('payment-123');

      expect(result).toEqual(mockPayment);
      expect(mockPrisma.payment.findUnique).toHaveBeenCalledWith({
        where: { id: 'payment-123' },
        include: {
          invoice: {
            include: {
              client: true,
              case: true,
            },
          },
        },
      });
    });

    it('should return null when payment not found', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      const result = await paymentService.getPaymentById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('checkPaymentStatus', () => {
    it('should check payment status successfully', async () => {
      const request = {
        paymentId: 'payment-123',
        transactionId: 'txn-123',
      };

      const mockPayment = {
        id: 'payment-123',
        status: PaymentStatus.PENDING,
        method: PaymentMethod.ALIPAY,
        invoiceId: 'invoice-123',
      };

      const mockUpdatedPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
      };

      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrisma.payment.update.mockResolvedValue(mockUpdatedPayment);
      mockGatewayService.checkPaymentStatus.mockResolvedValue(PaymentStatus.COMPLETED);

      const result = await paymentService.checkPaymentStatus(request);

      expect(result.success).toBe(true);
      expect(result.payment).toEqual(mockUpdatedPayment);
      expect(mockGatewayService.checkPaymentStatus).toHaveBeenCalledWith(
        PaymentMethod.ALIPAY,
        'txn-123'
      );
    });

    it('should return error when payment not found', async () => {
      const request = {
        paymentId: 'non-existent',
      };

      mockPrisma.payment.findUnique.mockResolvedValue(null);

      const result = await paymentService.checkPaymentStatus(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment not found');
    });
  });

  describe('getPaymentsByInvoice', () => {
    it('should return payments for invoice', async () => {
      const mockPayments = [
        {
          id: 'payment-123',
          invoiceId: 'invoice-123',
          amount: 100,
          invoice: {
            client: { id: 'client-123', name: 'Test Client' },
            case: { id: 'case-123', title: 'Test Case' },
          },
        },
      ];

      mockPrisma.payment.findMany.mockResolvedValue(mockPayments);

      const result = await paymentService.getPaymentsByInvoice('invoice-123');

      expect(result).toEqual(mockPayments);
      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith({
        where: { invoiceId: 'invoice-123' },
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
    });
  });

  describe('getPaymentsByClient', () => {
    it('should return payments for client', async () => {
      const mockPayments = [
        {
          id: 'payment-123',
          invoiceId: 'invoice-123',
          amount: 100,
          invoice: {
            client: { id: 'client-123', name: 'Test Client' },
            case: { id: 'case-123', title: 'Test Case' },
          },
        },
      ];

      mockPrisma.payment.findMany.mockResolvedValue(mockPayments);

      const result = await paymentService.getPaymentsByClient('client-123');

      expect(result).toEqual(mockPayments);
      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith({
        where: {
          invoice: {
            clientId: 'client-123',
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
    });
  });

  describe('processWebhook', () => {
    it('should process webhook successfully', async () => {
      const payload = {
        transaction_id: 'txn-123',
        out_trade_no: 'PAY_123456',
        total_amount: '100.00',
        trade_status: 'TRADE_SUCCESS',
      };

      mockGatewayService.processWebhook.mockResolvedValue(true);

      const result = await paymentService.processWebhook(PaymentMethod.ALIPAY, payload);

      expect(result).toBe(true);
      expect(mockGatewayService.processWebhook).toHaveBeenCalledWith(
        PaymentMethod.ALIPAY,
        payload
      );
    });

    it('should handle webhook processing errors', async () => {
      const payload = {
        transaction_id: 'txn-123',
        out_trade_no: 'PAY_123456',
        total_amount: '100.00',
        trade_status: 'TRADE_SUCCESS',
      };

      mockGatewayService.processWebhook.mockRejectedValue(new Error('Webhook error'));

      const result = await paymentService.processWebhook(PaymentMethod.ALIPAY, payload);

      expect(result).toBe(false);
    });
  });

  describe('schedulePayment', () => {
    it('should schedule payment successfully', async () => {
      const request = {
        invoiceId: 'invoice-123',
        amount: 100,
        method: PaymentMethod.ALIPAY,
        scheduleDate: new Date('2024-12-31'),
        clientInfo: {
          name: 'Test Client',
          email: 'test@example.com',
        },
        description: 'Scheduled payment',
      };

      const mockInvoice = {
        id: 'invoice-123',
        invoiceNumber: 'INV-001',
      };

      const mockScheduledPayment = {
        id: 'scheduled-123',
        invoiceId: 'invoice-123',
        amount: 100,
        status: 'SCHEDULED',
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.scheduledPayment.create.mockResolvedValue(mockScheduledPayment);

      const result = await paymentService.schedulePayment(request);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Payment scheduled successfully');
      expect(mockPrisma.scheduledPayment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invoiceId: request.invoiceId,
          amount: request.amount,
          method: request.method,
          scheduleDate: request.scheduleDate,
          clientName: request.clientInfo.name,
          clientEmail: request.clientInfo.email,
          description: request.description,
          status: 'SCHEDULED',
        }),
      });
    });

    it('should return error when invoice not found', async () => {
      const request = {
        invoiceId: 'non-existent',
        amount: 100,
        method: PaymentMethod.ALIPAY,
        scheduleDate: new Date('2024-12-31'),
        clientInfo: {
          name: 'Test Client',
          email: 'test@example.com',
        },
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      const result = await paymentService.schedulePayment(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invoice not found');
    });
  });

  describe('processScheduledPayments', () => {
    it('should process scheduled payments', async () => {
      const mockScheduledPayments = [
        {
          id: 'scheduled-123',
          invoiceId: 'invoice-123',
          amount: 100,
          method: PaymentMethod.ALIPAY,
          clientName: 'Test Client',
          clientEmail: 'test@example.com',
          description: 'Scheduled payment',
        },
      ];

      const mockInvoice = {
        id: 'invoice-123',
        status: 'UNPAID',
        total: 200,
      };

      mockPrisma.scheduledPayment.findMany.mockResolvedValue(mockScheduledPayments);
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.payment.findMany.mockResolvedValue([]);

      // Mock successful payment creation
      const mockPaymentResponse = {
        success: true,
        payment: { id: 'payment-123' },
      };

      jest.spyOn(paymentService, 'createPayment').mockResolvedValue(mockPaymentResponse);

      await paymentService.processScheduledPayments();

      expect(mockPrisma.scheduledPayment.findMany).toHaveBeenCalledWith({
        where: {
          status: 'SCHEDULED',
          scheduleDate: {
            lte: expect.any(Date),
          },
        },
      });

      expect(paymentService.createPayment).toHaveBeenCalledWith({
        invoiceId: 'invoice-123',
        amount: 100,
        method: PaymentMethod.ALIPAY,
        description: 'Scheduled payment',
        clientInfo: {
          name: 'Test Client',
          email: 'test@example.com',
          phone: undefined,
        },
      });

      expect(mockPrisma.scheduledPayment.update).toHaveBeenCalledWith({
        where: { id: 'scheduled-123' },
        data: { status: 'PROCESSED' },
      });
    });
  });

  describe('cancelPayment', () => {
    it('should cancel payment successfully', async () => {
      const mockPayment = {
        id: 'payment-123',
        status: PaymentStatus.PENDING,
      };

      const mockUpdatedPayment = {
        ...mockPayment,
        status: PaymentStatus.FAILED,
      };

      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrisma.payment.update.mockResolvedValue(mockUpdatedPayment);

      const result = await paymentService.cancelPayment('payment-123');

      expect(result.success).toBe(true);
      expect(result.payment).toEqual(mockUpdatedPayment);
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-123' },
        data: { status: PaymentStatus.FAILED },
      });
    });

    it('should return error when payment not found', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      const result = await paymentService.cancelPayment('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment not found');
    });

    it('should return error when payment cannot be cancelled', async () => {
      const mockPayment = {
        id: 'payment-123',
        status: PaymentStatus.COMPLETED,
      };

      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);

      const result = await paymentService.cancelPayment('payment-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be cancelled');
    });
  });

  describe('getPaymentStatistics', () => {
    it('should return payment statistics', async () => {
      const mockStats = {
        totalPayments: 10,
        completedPayments: 8,
        pendingPayments: 1,
        failedPayments: 1,
        refundedPayments: 0,
        totalAmount: 1000,
        completedAmount: 800,
        successRate: 80,
      };

      mockPrisma.payment.count.mockImplementation((query: any) => {
        if (query.where.status === PaymentStatus.COMPLETED) return Promise.resolve(8);
        if (query.where.status === PaymentStatus.PENDING) return Promise.resolve(1);
        if (query.where.status === PaymentStatus.FAILED) return Promise.resolve(1);
        if (query.where.status === PaymentStatus.REFUNDED) return Promise.resolve(0);
        return Promise.resolve(10);
      });

      mockPrisma.payment.aggregate.mockImplementation((query: any) => {
        if (query.where.status === PaymentStatus.COMPLETED) {
          return Promise.resolve({ _sum: { amount: 800 } });
        }
        return Promise.resolve({ _sum: { amount: 1000 } });
      });

      const result = await paymentService.getPaymentStatistics();

      expect(result).toEqual(mockStats);
    });

    it('should return client-specific payment statistics', async () => {
      const clientId = 'client-123';

      mockPrisma.payment.count.mockImplementation((query: any) => {
        if (query.where.invoice?.clientId === clientId) {
          return Promise.resolve(5);
        }
        return Promise.resolve(0);
      });

      mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 500 } });

      const result = await paymentService.getPaymentStatistics(clientId);

      expect(result.totalPayments).toBe(5);
      expect(result.totalAmount).toBe(500);
    });
  });

  describe('getPaymentMethodStatistics', () => {
    it('should return payment method statistics', async () => {
      const mockStats = [
        {
          method: PaymentMethod.ALIPAY,
          count: 5,
          totalAmount: 500,
        },
        {
          method: PaymentMethod.WECHAT_PAY,
          count: 3,
          totalAmount: 300,
        },
      ];

      mockPrisma.payment.groupBy.mockResolvedValue([
        { method: PaymentMethod.ALIPAY, _count: { id: 5 }, _sum: { amount: 500 } },
        { method: PaymentMethod.WECHAT_PAY, _count: { id: 3 }, _sum: { amount: 300 } },
      ]);

      const result = await paymentService.getPaymentMethodStatistics();

      expect(result).toEqual(mockStats);
      expect(mockPrisma.payment.groupBy).toHaveBeenCalledWith({
        by: ['method'],
        _count: { id: true },
        _sum: { amount: true },
      });
    });
  });
});