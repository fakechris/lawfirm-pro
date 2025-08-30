"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const PaymentGatewayService_1 = require("../services/financial/PaymentGatewayService");
const financial_1 = require("../models/financial");
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
};
describe('PaymentGatewayService', () => {
    let paymentGatewayService;
    beforeEach(() => {
        jest.clearAllMocks();
        paymentGatewayService = new PaymentGatewayService_1.PaymentGatewayService(mockPrisma);
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
            await expect(paymentGatewayService.initializePayment(financial_1.PaymentMethod.ALIPAY, invalidRequest))
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
            jest.spyOn(paymentGatewayService, 'isGatewayConfigured').mockReturnValue(false);
            await expect(paymentGatewayService.initializePayment(financial_1.PaymentMethod.ALIPAY, validRequest))
                .rejects.toThrow('Payment gateway ALIPAY is not configured');
        });
        it('should validate amount limits', async () => {
            const validRequest = {
                amount: 2000000,
                currency: 'CNY',
                description: 'Test payment',
                orderId: 'ORDER_123',
                clientInfo: { name: 'Test Client', email: 'test@example.com' },
            };
            jest.spyOn(paymentGatewayService, 'isGatewayConfigured').mockReturnValue(true);
            jest.spyOn(paymentGatewayService, 'validateAmount').mockReturnValue(false);
            await expect(paymentGatewayService.initializePayment(financial_1.PaymentMethod.ALIPAY, validRequest))
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
            jest.spyOn(paymentGatewayService, 'isGatewayConfigured').mockReturnValue(true);
            jest.spyOn(paymentGatewayService, 'validateAmount').mockReturnValue(true);
            jest.spyOn(paymentGatewayService, 'initializeAlipayPayment').mockResolvedValue({
                success: true,
                paymentUrl: 'https://alipay.com/pay',
                transactionId: 'ALIPAY_123',
            });
            const result = await paymentGatewayService.initializePayment(financial_1.PaymentMethod.ALIPAY, validRequest);
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
                status: financial_1.PaymentStatus.COMPLETED,
                gateway: 'ALIPAY',
                timestamp: new Date(),
            };
            jest.spyOn(paymentGatewayService, 'verifyWebhookSignature').mockReturnValue(false);
            const result = await paymentGatewayService.processWebhook(financial_1.PaymentMethod.ALIPAY, payload);
            expect(result).toBe(false);
        });
        it('should update payment status on successful webhook', async () => {
            const payload = {
                transactionId: 'ALIPAY_123',
                orderId: 'ORDER_123',
                amount: 100,
                status: financial_1.PaymentStatus.COMPLETED,
                gateway: 'ALIPAY',
                timestamp: new Date(),
            };
            const mockPayment = {
                id: 'PAYMENT_123',
                invoiceId: 'INVOICE_123',
                status: financial_1.PaymentStatus.PENDING,
            };
            jest.spyOn(paymentGatewayService, 'verifyWebhookSignature').mockReturnValue(true);
            jest.spyOn(paymentGatewayService, 'parseWebhookPayload').mockReturnValue(payload);
            mockPrisma.payment.findFirst.mockResolvedValue(mockPayment);
            mockPrisma.payment.update.mockResolvedValue({ ...mockPayment, status: financial_1.PaymentStatus.COMPLETED });
            const result = await paymentGatewayService.processWebhook(financial_1.PaymentMethod.ALIPAY, payload);
            expect(result).toBe(true);
            expect(mockPrisma.payment.update).toHaveBeenCalledWith({
                where: { id: 'PAYMENT_123' },
                data: {
                    status: financial_1.PaymentStatus.COMPLETED,
                    reference: JSON.stringify(payload),
                },
            });
        });
        it('should update invoice status when payment is completed', async () => {
            const payload = {
                transactionId: 'ALIPAY_123',
                orderId: 'ORDER_123',
                amount: 100,
                status: financial_1.PaymentStatus.COMPLETED,
                gateway: 'ALIPAY',
                timestamp: new Date(),
            };
            const mockPayment = {
                id: 'PAYMENT_123',
                invoiceId: 'INVOICE_123',
                status: financial_1.PaymentStatus.PENDING,
            };
            jest.spyOn(paymentGatewayService, 'verifyWebhookSignature').mockReturnValue(true);
            jest.spyOn(paymentGatewayService, 'parseWebhookPayload').mockReturnValue(payload);
            mockPrisma.payment.findFirst.mockResolvedValue(mockPayment);
            mockPrisma.payment.update.mockResolvedValue({ ...mockPayment, status: financial_1.PaymentStatus.COMPLETED });
            await paymentGatewayService.processWebhook(financial_1.PaymentMethod.ALIPAY, payload);
            expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
                where: { id: 'INVOICE_123' },
                data: { status: 'PAID' },
            });
        });
    });
    describe('checkPaymentStatus', () => {
        it('should check Alipay payment status', async () => {
            jest.spyOn(paymentGatewayService, 'checkAlipayStatus').mockResolvedValue(financial_1.PaymentStatus.COMPLETED);
            const result = await paymentGatewayService.checkPaymentStatus(financial_1.PaymentMethod.ALIPAY, 'ALIPAY_123');
            expect(result).toBe(financial_1.PaymentStatus.COMPLETED);
        });
        it('should check WeChat Pay payment status', async () => {
            jest.spyOn(paymentGatewayService, 'checkWechatStatus').mockResolvedValue(financial_1.PaymentStatus.COMPLETED);
            const result = await paymentGatewayService.checkPaymentStatus(financial_1.PaymentMethod.WECHAT_PAY, 'WECHAT_123');
            expect(result).toBe(financial_1.PaymentStatus.COMPLETED);
        });
        it('should throw error for unsupported gateway', async () => {
            await expect(paymentGatewayService.checkPaymentStatus(financial_1.PaymentMethod.CASH, 'CASH_123'))
                .rejects.toThrow('Status check not supported for gateway: CASH');
        });
    });
    describe('refundPayment', () => {
        it('should refund Alipay payment successfully', async () => {
            jest.spyOn(paymentGatewayService, 'refundAlipayPayment').mockResolvedValue({
                success: true,
                transactionId: 'REFUND_123',
                message: 'Alipay refund processed',
            });
            const result = await paymentGatewayService.refundPayment(financial_1.PaymentMethod.ALIPAY, 'ALIPAY_123', 50, 'Test refund');
            expect(result.success).toBe(true);
            expect(result.transactionId).toBe('REFUND_123');
        });
        it('should refund WeChat Pay payment successfully', async () => {
            jest.spyOn(paymentGatewayService, 'refundWechatPayment').mockResolvedValue({
                success: true,
                transactionId: 'REFUND_123',
                message: 'WeChat Pay refund processed',
            });
            const result = await paymentGatewayService.refundPayment(financial_1.PaymentMethod.WECHAT_PAY, 'WECHAT_123', 50, 'Test refund');
            expect(result.success).toBe(true);
            expect(result.transactionId).toBe('REFUND_123');
        });
        it('should throw error for unsupported gateway', async () => {
            await expect(paymentGatewayService.refundPayment(financial_1.PaymentMethod.CASH, 'CASH_123', 50, 'Test refund'))
                .rejects.toThrow('Refund not supported for gateway: CASH');
        });
    });
});
//# sourceMappingURL=PaymentGatewayService.test.js.map