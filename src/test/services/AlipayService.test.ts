import { AlipayService } from '../services/financial/AlipayService';
import { getPaymentConfig } from '../config/financial';

// Mock dependencies
jest.mock('axios');
jest.mock('crypto');
jest.mock('../config/financial');

const mockAxios = require('axios');
const mockCrypto = require('crypto');
const mockGetPaymentConfig = getPaymentConfig as jest.MockedFunction<typeof getPaymentConfig>;

describe('AlipayService', () => {
  let alipayService: AlipayService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock configuration
    mockGetPaymentConfig.mockReturnValue({
      supportedGateways: {
        alipay: {
          enabled: true,
          appId: 'test_app_id',
          privateKey: 'test_private_key',
          publicKey: 'test_public_key',
          sandbox: true,
          notifyUrl: 'http://localhost:3001/api/payments/alipay/notify',
          returnUrl: 'http://localhost:3000/payment/alipay/return',
          charset: 'UTF-8',
          signType: 'RSA2',
          version: '1.0',
        },
      },
      processing: {
        timeout: 30000,
      },
    } as any);

    // Mock crypto functions
    mockCrypto.createSign.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      sign: jest.fn().mockReturnValue('mock_signature'),
    });

    mockCrypto.createVerify.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      verify: jest.fn().mockReturnValue(true),
    });

    alipayService = new AlipayService();
  });

  describe('initializePayment', () => {
    it('should initialize payment in sandbox mode', async () => {
      const request = {
        amount: 100,
        currency: 'CNY',
        description: 'Test payment',
        orderId: 'ORDER_123',
        clientInfo: { name: 'Test Client', email: 'test@example.com' },
      };

      const result = await alipayService.initializePayment(request);

      expect(result.success).toBe(true);
      expect(result.paymentUrl).toContain('openapi.alipaydev.com');
      expect(result.transactionId).toBeDefined();
    });

    it('should handle API errors gracefully', async () => {
      mockAxios.post.mockRejectedValue(new Error('API Error'));

      // Set to production mode
      mockGetPaymentConfig.mockReturnValue({
        supportedGateways: {
          alipay: {
            ...mockGetPaymentConfig().supportedGateways.alipay,
            sandbox: false,
          },
        },
        processing: {
          timeout: 30000,
        },
      } as any);

      const request = {
        amount: 100,
        currency: 'CNY',
        description: 'Test payment',
        orderId: 'ORDER_123',
        clientInfo: { name: 'Test Client', email: 'test@example.com' },
      };

      const result = await alipayService.initializePayment(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
    });
  });

  describe('checkPaymentStatus', () => {
    it('should check payment status in sandbox mode', async () => {
      const result = await alipayService.checkPaymentStatus('ALIPAY_123');

      expect(result).toBe('TRADE_SUCCESS');
    });

    it('should handle API errors when checking status', async () => {
      mockAxios.post.mockRejectedValue(new Error('API Error'));

      // Set to production mode
      mockGetPaymentConfig.mockReturnValue({
        supportedGateways: {
          alipay: {
            ...mockGetPaymentConfig().supportedGateways.alipay,
            sandbox: false,
          },
        },
        processing: {
          timeout: 30000,
        },
      } as any);

      await expect(alipayService.checkPaymentStatus('ALIPAY_123'))
        .rejects.toThrow('Failed to check Alipay status: API Error');
    });
  });

  describe('refundPayment', () => {
    it('should process refund in sandbox mode', async () => {
      const result = await alipayService.refundPayment('ALIPAY_123', 50, 'Test refund');

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
    });

    it('should handle refund errors gracefully', async () => {
      mockAxios.post.mockRejectedValue(new Error('Refund Error'));

      // Set to production mode
      mockGetPaymentConfig.mockReturnValue({
        supportedGateways: {
          alipay: {
            ...mockGetPaymentConfig().supportedGateways.alipay,
            sandbox: false,
          },
        },
        processing: {
          timeout: 30000,
        },
      } as any);

      const result = await alipayService.refundPayment('ALIPAY_123', 50, 'Test refund');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Refund Error');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify webhook signature correctly', () => {
      const params = {
        sign: 'received_signature',
        sign_type: 'RSA2',
        trade_no: 'ALIPAY_123',
        out_trade_no: 'ORDER_123',
        total_amount: '100.00',
      };

      const result = alipayService.verifyWebhookSignature(params);

      expect(result).toBe(true);
      expect(mockCrypto.createVerify).toHaveBeenCalledWith('RSA-SHA256');
    });

    it('should handle signature verification failure', () => {
      mockCrypto.createVerify.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        verify: jest.fn().mockReturnValue(false),
      });

      const params = {
        sign: 'invalid_signature',
        sign_type: 'RSA2',
        trade_no: 'ALIPAY_123',
        out_trade_no: 'ORDER_123',
        total_amount: '100.00',
      };

      const result = alipayService.verifyWebhookSignature(params);

      expect(result).toBe(false);
    });
  });

  describe('generateQRCode', () => {
    it('should generate QR code in sandbox mode', async () => {
      const request = {
        amount: 100,
        currency: 'CNY',
        description: 'Test payment',
        orderId: 'ORDER_123',
        clientInfo: { name: 'Test Client', email: 'test@example.com' },
      };

      const result = await alipayService.generateQRCode(request);

      expect(result.success).toBe(true);
      expect(result.qrCode).toBeDefined();
      expect(result.transactionId).toBeDefined();
    });
  });

  describe('closePayment', () => {
    it('should close payment in sandbox mode', async () => {
      const result = await alipayService.closePayment('ALIPAY_123');

      expect(result.success).toBe(true);
    });
  });

  describe('buildAlipayParams', () => {
    it('should build correct Alipay parameters', () => {
      const request = {
        amount: 100,
        currency: 'CNY',
        description: 'Test payment',
        orderId: 'ORDER_123',
        clientInfo: { name: 'Test Client', email: 'test@example.com' },
      };

      const params = (alipayService as any).buildAlipayParams(request);

      expect(params.app_id).toBe('test_app_id');
      expect(params.method).toBe('alipay.trade.page.pay');
      expect(params.total_amount).toBe('100.00');
      expect(params.subject).toBe('Test payment');
      expect(params.out_trade_no).toBe('ORDER_123');
    });
  });

  describe('generateSign', () => {
    it('should generate RSA2 signature', () => {
      const params = {
        app_id: 'test_app_id',
        method: 'alipay.trade.page.pay',
        total_amount: '100.00',
      };

      const signature = (alipayService as any).generateSign(params, 'RSA2');

      expect(signature).toBe('mock_signature');
      expect(mockCrypto.createSign).toHaveBeenCalledWith('RSA-SHA256');
    });

    it('should generate RSA signature', () => {
      const params = {
        app_id: 'test_app_id',
        method: 'alipay.trade.page.pay',
        total_amount: '100.00',
      };

      const signature = (alipayService as any).generateSign(params, 'RSA');

      expect(signature).toBe('mock_signature');
      expect(mockCrypto.createSign).toHaveBeenCalledWith('RSA-SHA1');
    });
  });

  describe('mapAlipayStatus', () => {
    it('should map Alipay statuses correctly', () => {
      const service = alipayService as any;

      expect(service.mapAlipayStatus('WAIT_BUYER_PAY')).toBe('PENDING');
      expect(service.mapAlipayStatus('TRADE_SUCCESS')).toBe('COMPLETED');
      expect(service.mapAlipayStatus('TRADE_FINISHED')).toBe('COMPLETED');
      expect(service.mapAlipayStatus('TRADE_CLOSED')).toBe('CANCELLED');
      expect(service.mapAlipayStatus('UNKNOWN')).toBe('UNKNOWN');
    });
  });
});