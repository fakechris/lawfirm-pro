import { PaymentGatewayService } from '../../src/services/financial/PaymentGatewayService';
import { PaymentMethod, PaymentStatus } from '../../src/models/financial';
import { PrismaClient } from '@prisma/client';

// Mock PrismaClient
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    payment: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    invoice: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  })),
}));

// Mock other services
jest.mock('../../src/services/financial/AlipayService', () => ({
  AlipayService: jest.fn().mockImplementation(() => ({
    initializePayment: jest.fn(),
    checkPaymentStatus: jest.fn(),
    refundPayment: jest.fn(),
    verifyWebhookSignature: jest.fn(),
    parseWebhookPayload: jest.fn(),
    generateQRCode: jest.fn(),
    closePayment: jest.fn(),
  })),
}));

jest.mock('../../src/services/financial/WechatPayService', () => ({
  WechatPayService: jest.fn().mockImplementation(() => ({
    initializePayment: jest.fn(),
    checkPaymentStatus: jest.fn(),
    refundPayment: jest.fn(),
    verifyWebhookSignature: jest.fn(),
    parseWebhookPayload: jest.fn(),
    closePayment: jest.fn(),
  })),
}));

jest.mock('../../src/config/financial', () => ({
  getPaymentConfig: jest.fn().mockReturnValue({
    supportedGateways: {
      alipay: {
        enabled: true,
        appId: 'test-alipay-app-id',
        sandbox: true,
      },
      wechat: {
        enabled: true,
        appId: 'test-wechat-app-id',
        sandbox: true,
      },
      bank: {
        enabled: true,
        accountNumber: '123456789',
      },
    },
    processing: {
      minAmount: 1,
      maxAmount: 1000000,
      currency: 'CNY',
    },
  }),
}));

describe('PaymentGatewayService', () => {
  let paymentGatewayService: PaymentGatewayService;
  let mockPrisma: any;
  let mockAlipayService: any;
  let mockWechatService: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    mockAlipayService = {
      initializePayment: jest.fn(),
      checkPaymentStatus: jest.fn(),
      refundPayment: jest.fn(),
      verifyWebhookSignature: jest.fn(),
      parseWebhookPayload: jest.fn(),
      generateQRCode: jest.fn(),
      closePayment: jest.fn(),
    };
    
    mockWechatService = {
      initializePayment: jest.fn(),
      checkPaymentStatus: jest.fn(),
      refundPayment: jest.fn(),
      verifyWebhookSignature: jest.fn(),
      parseWebhookPayload: jest.fn(),
      closePayment: jest.fn(),
    };

    // Replace the service instances
    paymentGatewayService = new PaymentGatewayService(mockPrisma);
    (paymentGatewayService as any).alipayService = mockAlipayService;
    (paymentGatewayService as any).wechatPayService = mockWechatService;
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('initializePayment', () => {
    it('should initialize Alipay payment successfully', async () => {
      const request = {
        amount: 100,
        currency: 'CNY',
        description: 'Test payment',
        orderId: 'order-123',
        clientInfo: {
          name: 'Test Client',
          email: 'test@example.com',
        },
      };

      const mockAlipayResponse = {
        success: true,
        transactionId: 'alipay-txn-123',
        paymentUrl: 'https://alipay.com/pay',
        message: 'Alipay payment initialized',
      };

      mockAlipayService.initializePayment.mockResolvedValue(mockAlipayResponse);

      const result = await paymentGatewayService.initializePayment(PaymentMethod.ALIPAY, request);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe(mockAlipayResponse.transactionId);
      expect(result.paymentUrl).toBe(mockAlipayResponse.paymentUrl);
      expect(mockAlipayService.initializePayment).toHaveBeenCalledWith(request);
    });

    it('should initialize WeChat Pay payment successfully', async () => {
      const request = {
        amount: 100,
        currency: 'CNY',
        description: 'Test payment',
        orderId: 'order-123',
        clientInfo: {
          name: 'Test Client',
          email: 'test@example.com',
        },
      };

      const mockWechatResponse = {
        success: true,
        transactionId: 'wechat-txn-123',
        qrCode: 'wechat://pay',
        message: 'WeChat Pay payment initialized',
      };

      mockWechatService.initializePayment.mockResolvedValue(mockWechatResponse);

      const result = await paymentGatewayService.initializePayment(PaymentMethod.WECHAT_PAY, request);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe(mockWechatResponse.transactionId);
      expect(result.qrCode).toBe(mockWechatResponse.qrCode);
      expect(mockWechatService.initializePayment).toHaveBeenCalledWith(request);
    });

    it('should initialize bank transfer successfully', async () => {
      const request = {
        amount: 100,
        currency: 'CNY',
        description: 'Test payment',
        orderId: 'order-123',
        clientInfo: {
          name: 'Test Client',
          email: 'test@example.com',
        },
      };

      const result = await paymentGatewayService.initializePayment(PaymentMethod.BANK_TRANSFER, request);

      expect(result.success).toBe(true);
      expect(result.transactionId).toMatch(/^BT_\d+_/);
      expect(result.message).toBe('Bank transfer instructions generated');
    });

    it('should throw error for invalid payment request', async () => {
      const invalidRequest = {
        amount: 0,
        currency: 'CNY',
        description: 'Test payment',
        orderId: 'order-123',
        clientInfo: {
          name: 'Test Client',
          email: 'test@example.com',
        },
      };

      await expect(
        paymentGatewayService.initializePayment(PaymentMethod.ALIPAY, invalidRequest)
      ).rejects.toThrow('Invalid payment request');
    });

    it('should throw error for unconfigured gateway', async () => {
      const request = {
        amount: 100,
        currency: 'CNY',
        description: 'Test payment',
        orderId: 'order-123',
        clientInfo: {
          name: 'Test Client',
          email: 'test@example.com',
        },
      };

      // Mock gateway as not configured
      jest.spyOn(paymentGatewayService as any, 'isGatewayConfigured').mockReturnValue(false);

      await expect(
        paymentGatewayService.initializePayment(PaymentMethod.ALIPAY, request)
      ).rejects.toThrow('is not configured');
    });

    it('should throw error for amount outside limits', async () => {
      const request = {
        amount: 2000000, // Exceeds max amount
        currency: 'CNY',
        description: 'Test payment',
        orderId: 'order-123',
        clientInfo: {
          name: 'Test Client',
          email: 'test@example.com',
        },
      };

      await expect(
        paymentGatewayService.initializePayment(PaymentMethod.ALIPAY, request)
      ).rejects.toThrow('outside allowed limits');
    });

    it('should throw error for unsupported payment method', async () => {
      const request = {
        amount: 100,
        currency: 'CNY',
        description: 'Test payment',
        orderId: 'order-123',
        clientInfo: {
          name: 'Test Client',
          email: 'test@example.com',
        },
      };

      await expect(
        paymentGatewayService.initializePayment(PaymentMethod.CASH, request)
      ).rejects.toThrow('Unsupported payment gateway');
    });
  });

  describe('processWebhook', () => {
    it('should process Alipay webhook successfully', async () => {
      const payload = {
        trade_no: 'alipay-txn-123',
        out_trade_no: 'order-123',
        total_amount: '100.00',
        trade_status: 'TRADE_SUCCESS',
        sign: 'valid-signature',
      };

      const mockPayment = {
        id: 'payment-123',
        invoiceId: 'invoice-123',
        status: PaymentStatus.PENDING,
      };

      const mockWebhookData = {
        transactionId: 'alipay-txn-123',
        orderId: 'order-123',
        amount: 100,
        status: PaymentStatus.COMPLETED,
        gateway: 'ALIPAY',
        timestamp: new Date(),
      };

      mockAlipayService.verifyWebhookSignature.mockReturnValue(true);
      mockAlipayService.parseWebhookPayload.mockReturnValue(mockWebhookData);
      mockPrisma.payment.findFirst.mockResolvedValue(mockPayment);
      mockPrisma.payment.update.mockResolvedValue({ ...mockPayment, status: PaymentStatus.COMPLETED });

      const result = await paymentGatewayService.processWebhook(PaymentMethod.ALIPAY, payload);

      expect(result).toBe(true);
      expect(mockAlipayService.verifyWebhookSignature).toHaveBeenCalledWith(payload);
      expect(mockAlipayService.parseWebhookPayload).toHaveBeenCalledWith(payload);
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-123' },
        data: {
          status: PaymentStatus.COMPLETED,
          reference: JSON.stringify(payload),
        },
      });
    });

    it('should process WeChat Pay webhook successfully', async () => {
      const payload = {
        transaction_id: 'wechat-txn-123',
        out_trade_no: 'order-123',
        total_fee: '10000',
        result_code: 'SUCCESS',
        trade_state: 'SUCCESS',
        sign: 'valid-signature',
      };

      const mockPayment = {
        id: 'payment-123',
        invoiceId: 'invoice-123',
        status: PaymentStatus.PENDING,
      };

      const mockWebhookData = {
        transactionId: 'wechat-txn-123',
        orderId: 'order-123',
        amount: 100,
        status: PaymentStatus.COMPLETED,
        gateway: 'WECHAT_PAY',
        timestamp: new Date(),
      };

      mockWechatService.verifyWebhookSignature.mockReturnValue(true);
      mockWechatService.parseWebhookPayload.mockReturnValue(mockWebhookData);
      mockPrisma.payment.findFirst.mockResolvedValue(mockPayment);
      mockPrisma.payment.update.mockResolvedValue({ ...mockPayment, status: PaymentStatus.COMPLETED });

      const result = await paymentGatewayService.processWebhook(PaymentMethod.WECHAT_PAY, payload);

      expect(result).toBe(true);
      expect(mockWechatService.verifyWebhookSignature).toHaveBeenCalledWith(payload);
      expect(mockWechatService.parseWebhookPayload).toHaveBeenCalledWith(payload);
    });

    it('should return false for invalid webhook signature', async () => {
      const payload = {
        trade_no: 'alipay-txn-123',
        out_trade_no: 'order-123',
        total_amount: '100.00',
        trade_status: 'TRADE_SUCCESS',
        sign: 'invalid-signature',
      };

      mockAlipayService.verifyWebhookSignature.mockReturnValue(false);

      const result = await paymentGatewayService.processWebhook(PaymentMethod.ALIPAY, payload);

      expect(result).toBe(false);
    });

    it('should return false when payment not found', async () => {
      const payload = {
        trade_no: 'alipay-txn-123',
        out_trade_no: 'order-123',
        total_amount: '100.00',
        trade_status: 'TRADE_SUCCESS',
        sign: 'valid-signature',
      };

      mockAlipayService.verifyWebhookSignature.mockReturnValue(true);
      mockAlipayService.parseWebhookPayload.mockReturnValue({
        transactionId: 'alipay-txn-123',
        orderId: 'order-123',
        amount: 100,
        status: PaymentStatus.COMPLETED,
        gateway: 'ALIPAY',
        timestamp: new Date(),
      });
      mockPrisma.payment.findFirst.mockResolvedValue(null);

      const result = await paymentGatewayService.processWebhook(PaymentMethod.ALIPAY, payload);

      expect(result).toBe(false);
    });

    it('should handle webhook processing errors', async () => {
      const payload = {
        trade_no: 'alipay-txn-123',
        out_trade_no: 'order-123',
        total_amount: '100.00',
        trade_status: 'TRADE_SUCCESS',
        sign: 'valid-signature',
      };

      mockAlipayService.verifyWebhookSignature.mockReturnValue(true);
      mockAlipayService.parseWebhookPayload.mockImplementation(() => {
        throw new Error('Parse error');
      });

      const result = await paymentGatewayService.processWebhook(PaymentMethod.ALIPAY, payload);

      expect(result).toBe(false);
    });
  });

  describe('checkPaymentStatus', () => {
    it('should check Alipay payment status', async () => {
      const transactionId = 'alipay-txn-123';
      const mockAlipayStatus = 'TRADE_SUCCESS';

      mockAlipayService.checkPaymentStatus.mockResolvedValue(mockAlipayStatus);

      const result = await paymentGatewayService.checkPaymentStatus(PaymentMethod.ALIPAY, transactionId);

      expect(result).toBe(PaymentStatus.COMPLETED);
      expect(mockAlipayService.checkPaymentStatus).toHaveBeenCalledWith(transactionId);
    });

    it('should check WeChat Pay payment status', async () => {
      const transactionId = 'wechat-txn-123';
      const mockWechatStatus = 'SUCCESS';

      mockWechatService.checkPaymentStatus.mockResolvedValue(mockWechatStatus);

      const result = await paymentGatewayService.checkPaymentStatus(PaymentMethod.WECHAT_PAY, transactionId);

      expect(result).toBe(PaymentStatus.COMPLETED);
      expect(mockWechatService.checkPaymentStatus).toHaveBeenCalledWith(transactionId);
    });

    it('should handle Alipay status check errors', async () => {
      const transactionId = 'alipay-txn-123';

      mockAlipayService.checkPaymentStatus.mockRejectedValue(new Error('Status check failed'));

      const result = await paymentGatewayService.checkPaymentStatus(PaymentMethod.ALIPAY, transactionId);

      expect(result).toBe(PaymentStatus.FAILED);
    });

    it('should throw error for unsupported gateway', async () => {
      await expect(
        paymentGatewayService.checkPaymentStatus(PaymentMethod.CASH, 'txn-123')
      ).rejects.toThrow('Status check not supported');
    });
  });

  describe('refundPayment', () => {
    it('should refund Alipay payment successfully', async () => {
      const transactionId = 'alipay-txn-123';
      const amount = 50;
      const reason = 'Customer request';

      const mockAlipayResponse = {
        success: true,
        transactionId: 'alipay-refund-123',
        message: 'Alipay refund processed',
      };

      mockAlipayService.refundPayment.mockResolvedValue(mockAlipayResponse);

      const result = await paymentGatewayService.refundPayment(
        PaymentMethod.ALIPAY,
        transactionId,
        amount,
        reason
      );

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe(mockAlipayResponse.transactionId);
      expect(result.message).toBe(mockAlipayResponse.message);
      expect(mockAlipayService.refundPayment).toHaveBeenCalledWith(transactionId, amount, reason);
    });

    it('should refund WeChat Pay payment successfully', async () => {
      const transactionId = 'wechat-txn-123';
      const amount = 50;
      const reason = 'Customer request';

      const mockWechatResponse = {
        success: true,
        transactionId: 'wechat-refund-123',
        message: 'WeChat Pay refund processed',
      };

      mockWechatService.refundPayment.mockResolvedValue(mockWechatResponse);

      const result = await paymentGatewayService.refundPayment(
        PaymentMethod.WECHAT_PAY,
        transactionId,
        amount,
        reason
      );

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe(mockWechatResponse.transactionId);
      expect(result.message).toBe(mockWechatResponse.message);
      expect(mockWechatService.refundPayment).toHaveBeenCalledWith(transactionId, amount, reason);
    });

    it('should handle refund errors', async () => {
      const transactionId = 'alipay-txn-123';

      mockAlipayService.refundPayment.mockRejectedValue(new Error('Refund failed'));

      const result = await paymentGatewayService.refundPayment(PaymentMethod.ALIPAY, transactionId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Refund failed');
    });

    it('should throw error for unsupported gateway', async () => {
      await expect(
        paymentGatewayService.refundPayment(PaymentMethod.CASH, 'txn-123')
      ).rejects.toThrow('Refund not supported');
    });
  });

  describe('generateQRCode', () => {
    it('should generate QR code for Alipay', async () => {
      const request = {
        amount: 100,
        currency: 'CNY',
        description: 'Test payment',
        orderId: 'order-123',
        clientInfo: {
          name: 'Test Client',
          email: 'test@example.com',
        },
      };

      const mockResponse = {
        success: true,
        qrCode: 'data:image/png;base64,...',
        message: 'QR code generated',
      };

      mockAlipayService.generateQRCode.mockResolvedValue(mockResponse);

      const result = await paymentGatewayService.generateQRCode(PaymentMethod.ALIPAY, request);

      expect(result.success).toBe(true);
      expect(result.qrCode).toBe(mockResponse.qrCode);
      expect(mockAlipayService.generateQRCode).toHaveBeenCalledWith(request);
    });

    it('should generate QR code for WeChat Pay', async () => {
      const request = {
        amount: 100,
        currency: 'CNY',
        description: 'Test payment',
        orderId: 'order-123',
        clientInfo: {
          name: 'Test Client',
          email: 'test@example.com',
        },
      };

      const mockResponse = {
        success: true,
        qrCode: 'wechat://pay',
        message: 'QR code generated',
      };

      mockWechatService.initializePayment.mockResolvedValue(mockResponse);

      const result = await paymentGatewayService.generateQRCode(PaymentMethod.WECHAT_PAY, request);

      expect(result.success).toBe(true);
      expect(result.qrCode).toBe(mockResponse.qrCode);
      expect(mockWechatService.initializePayment).toHaveBeenCalledWith(request);
    });

    it('should handle QR code generation errors', async () => {
      const request = {
        amount: 100,
        currency: 'CNY',
        description: 'Test payment',
        orderId: 'order-123',
        clientInfo: {
          name: 'Test Client',
          email: 'test@example.com',
        },
      };

      mockAlipayService.generateQRCode.mockRejectedValue(new Error('QR code generation failed'));

      const result = await paymentGatewayService.generateQRCode(PaymentMethod.ALIPAY, request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('QR code generation failed');
    });

    it('should throw error for unsupported gateway', async () => {
      const request = {
        amount: 100,
        currency: 'CNY',
        description: 'Test payment',
        orderId: 'order-123',
        clientInfo: {
          name: 'Test Client',
          email: 'test@example.com',
        },
      };

      await expect(
        paymentGatewayService.generateQRCode(PaymentMethod.CASH, request)
      ).rejects.toThrow('QR code generation not supported');
    });
  });

  describe('closePayment', () => {
    it('should close Alipay payment successfully', async () => {
      const transactionId = 'alipay-txn-123';

      const mockResponse = {
        success: true,
        message: 'Payment closed',
      };

      mockAlipayService.closePayment.mockResolvedValue(mockResponse);

      const result = await paymentGatewayService.closePayment(PaymentMethod.ALIPAY, transactionId);

      expect(result.success).toBe(true);
      expect(result.message).toBe(mockResponse.message);
      expect(mockAlipayService.closePayment).toHaveBeenCalledWith(transactionId);
    });

    it('should close WeChat Pay payment successfully', async () => {
      const transactionId = 'wechat-txn-123';

      const mockResponse = {
        success: true,
        message: 'Payment closed',
      };

      mockWechatService.closePayment.mockResolvedValue(mockResponse);

      const result = await paymentGatewayService.closePayment(PaymentMethod.WECHAT_PAY, transactionId);

      expect(result.success).toBe(true);
      expect(result.message).toBe(mockResponse.message);
      expect(mockWechatService.closePayment).toHaveBeenCalledWith(transactionId);
    });

    it('should handle payment closing errors', async () => {
      const transactionId = 'alipay-txn-123';

      mockAlipayService.closePayment.mockRejectedValue(new Error('Close payment failed'));

      const result = await paymentGatewayService.closePayment(PaymentMethod.ALIPAY, transactionId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Close payment failed');
    });

    it('should throw error for unsupported gateway', async () => {
      await expect(
        paymentGatewayService.closePayment(PaymentMethod.CASH, 'txn-123')
      ).rejects.toThrow('Payment closing not supported');
    });
  });

  describe('getSupportedPaymentMethods', () => {
    it('should return all supported payment methods', () => {
      const methods = paymentGatewayService.getSupportedPaymentMethods();

      expect(methods).toContain(PaymentMethod.ALIPAY);
      expect(methods).toContain(PaymentMethod.WECHAT_PAY);
      expect(methods).toContain(PaymentMethod.BANK_TRANSFER);
    });

    it('should return only enabled payment methods', () => {
      // Mock WeChat Pay as disabled
      jest.spyOn(paymentGatewayService as any, 'getPaymentConfig').mockReturnValue({
        supportedGateways: {
          alipay: { enabled: true },
          wechat: { enabled: false },
          bank: { enabled: true },
        },
      });

      const methods = paymentGatewayService.getSupportedPaymentMethods();

      expect(methods).toContain(PaymentMethod.ALIPAY);
      expect(methods).toContain(PaymentMethod.BANK_TRANSFER);
      expect(methods).not.toContain(PaymentMethod.WECHAT_PAY);
    });
  });

  describe('validatePaymentMethod', () => {
    it('should return true for valid payment method', () => {
      const isValid = paymentGatewayService.validatePaymentMethod(PaymentMethod.ALIPAY);

      expect(isValid).toBe(true);
    });

    it('should return false for invalid payment method', () => {
      const isValid = paymentGatewayService.validatePaymentMethod(PaymentMethod.CASH);

      expect(isValid).toBe(false);
    });
  });

  describe('getPaymentMethodLimits', () => {
    it('should return correct limits for payment method', () => {
      const limits = paymentGatewayService.getPaymentMethodLimits(PaymentMethod.ALIPAY);

      expect(limits.min).toBe(1);
      expect(limits.max).toBe(1000000);
    });

    it('should respect gateway-specific limits', () => {
      // Mock Alipay with specific limit
      jest.spyOn(paymentGatewayService as any, 'getPaymentConfig').mockReturnValue({
        processing: {
          minAmount: 1,
          maxAmount: 1000000,
        },
        supportedGateways: {
          alipay: {
            enabled: true,
            maxAmount: 500000,
          },
        },
      });

      const limits = paymentGatewayService.getPaymentMethodLimits(PaymentMethod.ALIPAY);

      expect(limits.min).toBe(1);
      expect(limits.max).toBe(500000);
    });
  });

  describe('status mapping', () => {
    describe('mapAlipayStatus', () => {
      it('should map Alipay WAIT_BUYER_PAY to PENDING', () => {
        const status = (paymentGatewayService as any).mapAlipayStatus('WAIT_BUYER_PAY');
        expect(status).toBe(PaymentStatus.PENDING);
      });

      it('should map Alipay TRADE_SUCCESS to COMPLETED', () => {
        const status = (paymentGatewayService as any).mapAlipayStatus('TRADE_SUCCESS');
        expect(status).toBe(PaymentStatus.COMPLETED);
      });

      it('should map Alipay TRADE_CLOSED to FAILED', () => {
        const status = (paymentGatewayService as any).mapAlipayStatus('TRADE_CLOSED');
        expect(status).toBe(PaymentStatus.FAILED);
      });

      it('should map unknown status to FAILED', () => {
        const status = (paymentGatewayService as any).mapAlipayStatus('UNKNOWN_STATUS');
        expect(status).toBe(PaymentStatus.FAILED);
      });
    });

    describe('mapWechatStatus', () => {
      it('should map WeChat SUCCESS to COMPLETED', () => {
        const status = (paymentGatewayService as any).mapWechatStatus('SUCCESS');
        expect(status).toBe(PaymentStatus.COMPLETED);
      });

      it('should map WeChat NOTPAY to PENDING', () => {
        const status = (paymentGatewayService as any).mapWechatStatus('NOTPAY');
        expect(status).toBe(PaymentStatus.PENDING);
      });

      it('should map WeChat CLOSED to FAILED', () => {
        const status = (paymentGatewayService as any).mapWechatStatus('CLOSED');
        expect(status).toBe(PaymentStatus.FAILED);
      });

      it('should map unknown status to FAILED', () => {
        const status = (paymentGatewayService as any).mapWechatStatus('UNKNOWN_STATUS');
        expect(status).toBe(PaymentStatus.FAILED);
      });
    });
  });
});