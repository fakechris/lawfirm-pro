import { PaymentGatewayService } from '../services/financial/PaymentGatewayService';
import { PrismaClient } from '@prisma/client';
import { PaymentMethod, PaymentStatus } from '../models/financial';

// Mock PrismaClient
const mockPrisma = {
  payment: {
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  invoice: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  webhookLog: {
    create: jest.fn(),
  },
} as any;

describe('PaymentGatewayService', () => {
  let paymentGatewayService: PaymentGatewayService;

  beforeEach(() => {
    jest.clearAllMocks();
    paymentGatewayService = new PaymentGatewayService(mockPrisma);
  });

  describe('initializePayment', () => {
    it('should validate payment request', async () => {
      const invalidRequest = {
        amount: 0,
        currency: 'CNY',
        description: 'Test payment',
        orderId: 'ORDER_123',
        clientInfo: { name: 'Test Client', email: 'test@example.com' },
      };

      await expect(paymentGatewayService.initializePayment(PaymentMethod.ALIPAY, invalidRequest))
        .rejects.toThrow('Invalid payment request');
    });

    it('should check gateway configuration', async () => {
      const validRequest = {
        amount: 100,
        currency: 'CNY',
        description: 'Test payment',
        orderId: 'ORDER_123',
        clientInfo: { name: 'Test Client', email: 'test@example.com' },
      };

      // Mock configuration check
      jest.spyOn(paymentGatewayService as any, 'isGatewayConfigured').mockReturnValue(false);

      await expect(paymentGatewayService.initializePayment(PaymentMethod.ALIPAY, validRequest))
        .rejects.toThrow('Payment gateway ALIPAY is not configured');
    });

    it('should validate amount limits', async () => {
      const validRequest = {
        amount: 2000000, // 2M CNY - exceeds limit
        currency: 'CNY',
        description: 'Test payment',
        orderId: 'ORDER_123',
        clientInfo: { name: 'Test Client', email: 'test@example.com' },
      };

      jest.spyOn(paymentGatewayService as any, 'isGatewayConfigured').mockReturnValue(true);
      jest.spyOn(paymentGatewayService as any, 'validateAmount').mockReturnValue(false);

      await expect(paymentGatewayService.initializePayment(PaymentMethod.ALIPAY, validRequest))
        .rejects.toThrow('Amount is outside allowed limits');
    });

    it('should initialize Alipay payment successfully', async () => {
      const validRequest = {
        amount: 100,
        currency: 'CNY',
        description: 'Test payment',
        orderId: 'ORDER_123',
        clientInfo: { name: 'Test Client', email: 'test@example.com' },
      };

      jest.spyOn(paymentGatewayService as any, 'isGatewayConfigured').mockReturnValue(true);
      jest.spyOn(paymentGatewayService as any, 'validateAmount').mockReturnValue(true);
      jest.spyOn(paymentGatewayService as any, 'initializeAlipayPayment').mockResolvedValue({
        success: true,
        paymentUrl: 'https://alipay.com/pay',
        transactionId: 'ALIPAY_123',
      });

      const result = await paymentGatewayService.initializePayment(PaymentMethod.ALIPAY, validRequest);

      expect(result.success).toBe(true);
      expect(result.paymentUrl).toBe('https://alipay.com/pay');
      expect(result.transactionId).toBe('ALIPAY_123');
    });
  });

  describe('processWebhook', () => {
    it('should verify webhook signature', async () => {
      const payload = {
        transactionId: 'ALIPAY_123',
        orderId: 'ORDER_123',
        amount: 100,
        status: PaymentStatus.COMPLETED,
        gateway: 'ALIPAY',
        timestamp: new Date(),
      };

      jest.spyOn(paymentGatewayService as any, 'verifyWebhookSignature').mockReturnValue(false);

      const result = await paymentGatewayService.processWebhook(PaymentMethod.ALIPAY, payload);

      expect(result).toBe(false);
    });

    it('should update payment status on successful webhook', async () => {
      const payload = {
        transactionId: 'ALIPAY_123',
        orderId: 'ORDER_123',
        amount: 100,
        status: PaymentStatus.COMPLETED,
        gateway: 'ALIPAY',
        timestamp: new Date(),
      };

      const mockPayment = {
        id: 'PAYMENT_123',
        invoiceId: 'INVOICE_123',
        status: PaymentStatus.PENDING,
      };

      jest.spyOn(paymentGatewayService as any, 'verifyWebhookSignature').mockReturnValue(true);
      jest.spyOn(paymentGatewayService as any, 'parseWebhookPayload').mockReturnValue(payload);
      (mockPrisma.payment.findFirst as jest.Mock).mockResolvedValue(mockPayment);
      (mockPrisma.payment.update as jest.Mock).mockResolvedValue({ ...mockPayment, status: PaymentStatus.COMPLETED });

      const result = await paymentGatewayService.processWebhook(PaymentMethod.ALIPAY, payload);

      expect(result).toBe(true);
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'PAYMENT_123' },
        data: {
          status: PaymentStatus.COMPLETED,
          reference: JSON.stringify(payload),
        },
      });
    });

    it('should update invoice status when payment is completed', async () => {
      const payload = {
        transactionId: 'ALIPAY_123',
        orderId: 'ORDER_123',
        amount: 100,
        status: PaymentStatus.COMPLETED,
        gateway: 'ALIPAY',
        timestamp: new Date(),
      };

      const mockPayment = {
        id: 'PAYMENT_123',
        invoiceId: 'INVOICE_123',
        status: PaymentStatus.PENDING,
      };

      jest.spyOn(paymentGatewayService as any, 'verifyWebhookSignature').mockReturnValue(true);
      jest.spyOn(paymentGatewayService as any, 'parseWebhookPayload').mockReturnValue(payload);
      (mockPrisma.payment.findFirst as jest.Mock).mockResolvedValue(mockPayment);
      (mockPrisma.payment.update as jest.Mock).mockResolvedValue({ ...mockPayment, status: PaymentStatus.COMPLETED });

      await paymentGatewayService.processWebhook(PaymentMethod.ALIPAY, payload);

      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'INVOICE_123' },
        data: { status: 'PAID' },
      });
    });
  });

  describe('checkPaymentStatus', () => {
    it('should check Alipay payment status', async () => {
      jest.spyOn(paymentGatewayService as any, 'checkAlipayStatus').mockResolvedValue(PaymentStatus.COMPLETED);

      const result = await paymentGatewayService.checkPaymentStatus(PaymentMethod.ALIPAY, 'ALIPAY_123');

      expect(result).toBe(PaymentStatus.COMPLETED);
    });

    it('should check WeChat Pay payment status', async () => {
      jest.spyOn(paymentGatewayService as any, 'checkWechatStatus').mockResolvedValue(PaymentStatus.COMPLETED);

      const result = await paymentGatewayService.checkPaymentStatus(PaymentMethod.WECHAT_PAY, 'WECHAT_123');

      expect(result).toBe(PaymentStatus.COMPLETED);
    });

    it('should throw error for unsupported gateway', async () => {
      await expect(paymentGatewayService.checkPaymentStatus(PaymentMethod.CASH, 'CASH_123'))
        .rejects.toThrow('Status check not supported for gateway: CASH');
    });
  });

  describe('refundPayment', () => {
    it('should refund Alipay payment successfully', async () => {
      jest.spyOn(paymentGatewayService as any, 'refundAlipayPayment').mockResolvedValue({
        success: true,
        transactionId: 'REFUND_123',
        message: 'Alipay refund processed',
      });

      const result = await paymentGatewayService.refundPayment(PaymentMethod.ALIPAY, 'ALIPAY_123', 50, 'Test refund');

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('REFUND_123');
    });

    it('should refund WeChat Pay payment successfully', async () => {
      jest.spyOn(paymentGatewayService as any, 'refundWechatPayment').mockResolvedValue({
        success: true,
        transactionId: 'REFUND_123',
        message: 'WeChat Pay refund processed',
      });

      const result = await paymentGatewayService.refundPayment(PaymentMethod.WECHAT_PAY, 'WECHAT_123', 50, 'Test refund');

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('REFUND_123');
    });

    it('should throw error for unsupported gateway', async () => {
      await expect(paymentGatewayService.refundPayment(PaymentMethod.CASH, 'CASH_123', 50, 'Test refund'))
        .rejects.toThrow('Refund not supported for gateway: CASH');
    });
  });
});