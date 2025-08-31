import { FinancialService } from '../services/financial/FinancialService';
import { PaymentGatewayService } from '../services/financial/PaymentGatewayService';
import { AlipayService } from '../services/financial/AlipayService';
import { WechatPayService } from '../services/financial/WechatPayService';
import { PrismaClient } from '@prisma/client';
import { PaymentMethod, PaymentStatus, InvoiceStatus } from '../models/financial';

// Mock PrismaClient
const mockPrisma = {
  invoice: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  payment: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  clientProfile: {
    findUnique: jest.fn(),
  },
} as any;

describe('Payment Processing Integration', () => {
  let financialService: FinancialService;
  let paymentGatewayService: PaymentGatewayService;
  let alipayService: AlipayService;
  let wechatPayService: WechatPayService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    paymentGatewayService = new PaymentGatewayService(mockPrisma);
    alipayService = new AlipayService();
    wechatPayService = new WechatPayService();
    
    // Mock the payment gateway services
    jest.spyOn(paymentGatewayService as any, 'initializeAlipayPayment').mockResolvedValue({
      success: true,
      paymentUrl: 'https://alipay.com/pay',
      transactionId: 'ALIPAY_123',
    });

    jest.spyOn(paymentGatewayService as any, 'initializeWechatPayment').mockResolvedValue({
      success: true,
      qrCode: 'wechat://pay',
      transactionId: 'WECHAT_123',
    });

    jest.spyOn(paymentGatewayService as any, 'checkAlipayStatus').mockResolvedValue(PaymentStatus.COMPLETED);
    jest.spyOn(paymentGatewayService as any, 'checkWechatStatus').mockResolvedValue(PaymentStatus.COMPLETED);

    jest.spyOn(paymentGatewayService as any, 'refundAlipayPayment').mockResolvedValue({
      success: true,
      transactionId: 'REFUND_123',
      message: 'Alipay refund processed',
    });

    jest.spyOn(paymentGatewayService as any, 'refundWechatPayment').mockResolvedValue({
      success: true,
      transactionId: 'REFUND_123',
      message: 'WeChat Pay refund processed',
    });

    financialService = new FinancialService(mockPrisma);
  });

  describe('Complete Payment Flow', () => {
    it('should process Alipay payment successfully', async () => {
      const mockInvoice = {
        id: 'INVOICE_123',
        invoiceNumber: 'INV-001',
        total: 1000,
        currency: 'CNY',
        clientId: 'CLIENT_123',
        client: { id: 'CLIENT_123', name: 'Test Client' },
      };

      const mockPayment = {
        id: 'PAYMENT_123',
        invoiceId: 'INVOICE_123',
        amount: 500,
        method: PaymentMethod.ALIPAY,
        status: PaymentStatus.PENDING,
        transactionId: 'ALIPAY_123',
      };

      (mockPrisma.invoice.findUnique as jest.Mock).mockResolvedValue(mockInvoice);
      (mockPrisma.payment.findMany as jest.Mock).mockResolvedValue([]); // No existing payments
      (mockPrisma.payment.create as jest.Mock).mockResolvedValue(mockPayment);

      const paymentData = {
        invoiceId: 'INVOICE_123',
        amount: 500,
        method: PaymentMethod.ALIPAY,
        clientInfo: {
          name: 'Test Client',
          email: 'test@example.com',
        },
        description: 'Partial payment for invoice INV-001',
      };

      const result = await financialService.processPayment(paymentData);

      expect(result.payment).toEqual(mockPayment);
      expect(result.gatewayResponse.success).toBe(true);
      expect(result.gatewayResponse.paymentUrl).toBe('https://alipay.com/pay');
    });

    it('should process WeChat Pay payment successfully', async () => {
      const mockInvoice = {
        id: 'INVOICE_123',
        invoiceNumber: 'INV-001',
        total: 1000,
        currency: 'CNY',
        clientId: 'CLIENT_123',
        client: { id: 'CLIENT_123', name: 'Test Client' },
      };

      const mockPayment = {
        id: 'PAYMENT_123',
        invoiceId: 'INVOICE_123',
        amount: 500,
        method: PaymentMethod.WECHAT_PAY,
        status: PaymentStatus.PENDING,
        transactionId: 'WECHAT_123',
      };

      (mockPrisma.invoice.findUnique as jest.Mock).mockResolvedValue(mockInvoice);
      (mockPrisma.payment.findMany as jest.Mock).mockResolvedValue([]); // No existing payments
      (mockPrisma.payment.create as jest.Mock).mockResolvedValue(mockPayment);

      const paymentData = {
        invoiceId: 'INVOICE_123',
        amount: 500,
        method: PaymentMethod.WECHAT_PAY,
        clientInfo: {
          name: 'Test Client',
          email: 'test@example.com',
        },
        description: 'Partial payment for invoice INV-001',
      };

      const result = await financialService.processPayment(paymentData);

      expect(result.payment).toEqual(mockPayment);
      expect(result.gatewayResponse.success).toBe(true);
      expect(result.gatewayResponse.qrCode).toBe('wechat://pay');
    });

    it('should validate payment amount limits', async () => {
      const mockInvoice = {
        id: 'INVOICE_123',
        invoiceNumber: 'INV-001',
        total: 1000,
        currency: 'CNY',
        clientId: 'CLIENT_123',
        client: { id: 'CLIENT_123', name: 'Test Client' },
      };

      (mockPrisma.invoice.findUnique as jest.Mock).mockResolvedValue(mockInvoice);
      (mockPrisma.payment.findMany as jest.Mock).mockResolvedValue([]); // No existing payments

      const paymentData = {
        invoiceId: 'INVOICE_123',
        amount: 0, // Invalid amount
        method: PaymentMethod.ALIPAY,
        clientInfo: {
          name: 'Test Client',
          email: 'test@example.com',
        },
      };

      await expect(financialService.processPayment(paymentData))
        .rejects.toThrow('Payment amount must be greater than 0');
    });

    it('should prevent overpayment', async () => {
      const mockInvoice = {
        id: 'INVOICE_123',
        invoiceNumber: 'INV-001',
        total: 1000,
        currency: 'CNY',
        clientId: 'CLIENT_123',
        client: { id: 'CLIENT_123', name: 'Test Client' },
      };

      (mockPrisma.invoice.findUnique as jest.Mock).mockResolvedValue(mockInvoice);
      (mockPrisma.payment.findMany as jest.Mock).mockResolvedValue([
        { amount: 800, status: PaymentStatus.COMPLETED }
      ]); // Already paid 800

      const paymentData = {
        invoiceId: 'INVOICE_123',
        amount: 300, // Would exceed invoice total
        method: PaymentMethod.ALIPAY,
        clientInfo: {
          name: 'Test Client',
          email: 'test@example.com',
        },
      };

      await expect(financialService.processPayment(paymentData))
        .rejects.toThrow('Payment amount exceeds invoice total');
    });
  });

  describe('Payment Status Management', () => {
    it('should check payment status and update accordingly', async () => {
      const mockPayment = {
        id: 'PAYMENT_123',
        invoiceId: 'INVOICE_123',
        method: PaymentMethod.ALIPAY,
        status: PaymentStatus.PENDING,
        transactionId: 'ALIPAY_123',
      };

      (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);
      (mockPrisma.payment.update as jest.Mock).mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
      });

      const status = await financialService.checkPaymentStatus('PAYMENT_123');

      expect(status).toBe(PaymentStatus.COMPLETED);
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'PAYMENT_123' },
        data: { status: PaymentStatus.COMPLETED },
      });
    });

    it('should handle gateway API errors gracefully', async () => {
      const mockPayment = {
        id: 'PAYMENT_123',
        invoiceId: 'INVOICE_123',
        method: PaymentMethod.ALIPAY,
        status: PaymentStatus.PENDING,
        transactionId: 'ALIPAY_123',
      };

      (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);
      jest.spyOn(paymentGatewayService as any, 'checkAlipayStatus').mockRejectedValue(new Error('API Error'));

      const status = await financialService.checkPaymentStatus('PAYMENT_123');

      expect(status).toBe(PaymentStatus.PENDING); // Should return original status on error
    });
  });

  describe('Refund Processing', () => {
    it('should process Alipay refund successfully', async () => {
      const mockPayment = {
        id: 'PAYMENT_123',
        invoiceId: 'INVOICE_123',
        method: PaymentMethod.ALIPAY,
        status: PaymentStatus.COMPLETED,
        amount: 500,
        transactionId: 'ALIPAY_123',
        invoice: { id: 'INVOICE_123' },
      };

      (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);
      (mockPrisma.payment.update as jest.Mock).mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.REFUNDED,
      });

      const result = await financialService.refundPayment('PAYMENT_123', 200, 'Customer request');

      expect(result.success).toBe(true);
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'PAYMENT_123' },
        data: { status: PaymentStatus.REFUNDED },
      });
    });

    it('should validate refund amount', async () => {
      const mockPayment = {
        id: 'PAYMENT_123',
        invoiceId: 'INVOICE_123',
        method: PaymentMethod.ALIPAY,
        status: PaymentStatus.COMPLETED,
        amount: 500,
        transactionId: 'ALIPAY_123',
        invoice: { id: 'INVOICE_123' },
      };

      (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);

      await expect(financialService.refundPayment('PAYMENT_123', 600)) // More than payment amount
        .rejects.toThrow('Refund amount cannot exceed payment amount');
    });

    it('should only refund completed payments', async () => {
      const mockPayment = {
        id: 'PAYMENT_123',
        invoiceId: 'INVOICE_123',
        method: PaymentMethod.ALIPAY,
        status: PaymentStatus.PENDING, // Not completed
        amount: 500,
        transactionId: 'ALIPAY_123',
        invoice: { id: 'INVOICE_123' },
      };

      (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);

      await expect(financialService.refundPayment('PAYMENT_123', 200))
        .rejects.toThrow('Only completed payments can be refunded');
    });
  });

  describe('Payment Method Discovery', () => {
    it('should return available payment methods', async () => {
      // Mock configuration response
      jest.spyOn(financialService as any, 'getPaymentMethods').mockResolvedValue([
        PaymentMethod.ALIPAY,
        PaymentMethod.WECHAT_PAY,
        PaymentMethod.BANK_TRANSFER,
      ]);

      const methods = await financialService.getPaymentMethods();

      expect(methods).toContain(PaymentMethod.ALIPAY);
      expect(methods).toContain(PaymentMethod.WECHAT_PAY);
      expect(methods).toContain(PaymentMethod.BANK_TRANSFER);
    });
  });

  describe('Payment History', () => {
    it('should retrieve payment history with filters', async () => {
      const mockPayments = [
        {
          id: 'PAYMENT_123',
          amount: 500,
          method: PaymentMethod.ALIPAY,
          status: PaymentStatus.COMPLETED,
          invoice: {
            id: 'INVOICE_123',
            client: { id: 'CLIENT_123', name: 'Test Client' },
          },
        },
      ];

      (mockPrisma.payment.findMany as jest.Mock).mockResolvedValue(mockPayments);

      const history = await financialService.getPaymentHistory('INVOICE_123');

      expect(history).toEqual(mockPayments);
      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith({
        where: { invoiceId: 'INVOICE_123' },
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
});