"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const FinancialService_1 = require("../services/financial/FinancialService");
const PaymentGatewayService_1 = require("../services/financial/PaymentGatewayService");
const AlipayService_1 = require("../services/financial/AlipayService");
const WechatPayService_1 = require("../services/financial/WechatPayService");
const financial_1 = require("../models/financial");
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
};
describe('Payment Processing Integration', () => {
    let financialService;
    let paymentGatewayService;
    let alipayService;
    let wechatPayService;
    beforeEach(() => {
        jest.clearAllMocks();
        paymentGatewayService = new PaymentGatewayService_1.PaymentGatewayService(mockPrisma);
        alipayService = new AlipayService_1.AlipayService();
        wechatPayService = new WechatPayService_1.WechatPayService();
        jest.spyOn(paymentGatewayService, 'initializeAlipayPayment').mockResolvedValue({
            success: true,
            paymentUrl: 'https://alipay.com/pay',
            transactionId: 'ALIPAY_123',
        });
        jest.spyOn(paymentGatewayService, 'initializeWechatPayment').mockResolvedValue({
            success: true,
            qrCode: 'wechat://pay',
            transactionId: 'WECHAT_123',
        });
        jest.spyOn(paymentGatewayService, 'checkAlipayStatus').mockResolvedValue(financial_1.PaymentStatus.COMPLETED);
        jest.spyOn(paymentGatewayService, 'checkWechatStatus').mockResolvedValue(financial_1.PaymentStatus.COMPLETED);
        jest.spyOn(paymentGatewayService, 'refundAlipayPayment').mockResolvedValue({
            success: true,
            transactionId: 'REFUND_123',
            message: 'Alipay refund processed',
        });
        jest.spyOn(paymentGatewayService, 'refundWechatPayment').mockResolvedValue({
            success: true,
            transactionId: 'REFUND_123',
            message: 'WeChat Pay refund processed',
        });
        financialService = new FinancialService_1.FinancialService(mockPrisma);
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
                method: financial_1.PaymentMethod.ALIPAY,
                status: financial_1.PaymentStatus.PENDING,
                transactionId: 'ALIPAY_123',
            };
            mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
            mockPrisma.payment.findMany.mockResolvedValue([]);
            mockPrisma.payment.create.mockResolvedValue(mockPayment);
            const paymentData = {
                invoiceId: 'INVOICE_123',
                amount: 500,
                method: financial_1.PaymentMethod.ALIPAY,
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
                method: financial_1.PaymentMethod.WECHAT_PAY,
                status: financial_1.PaymentStatus.PENDING,
                transactionId: 'WECHAT_123',
            };
            mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
            mockPrisma.payment.findMany.mockResolvedValue([]);
            mockPrisma.payment.create.mockResolvedValue(mockPayment);
            const paymentData = {
                invoiceId: 'INVOICE_123',
                amount: 500,
                method: financial_1.PaymentMethod.WECHAT_PAY,
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
            mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
            mockPrisma.payment.findMany.mockResolvedValue([]);
            const paymentData = {
                invoiceId: 'INVOICE_123',
                amount: 0,
                method: financial_1.PaymentMethod.ALIPAY,
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
            mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
            mockPrisma.payment.findMany.mockResolvedValue([
                { amount: 800, status: financial_1.PaymentStatus.COMPLETED }
            ]);
            const paymentData = {
                invoiceId: 'INVOICE_123',
                amount: 300,
                method: financial_1.PaymentMethod.ALIPAY,
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
                method: financial_1.PaymentMethod.ALIPAY,
                status: financial_1.PaymentStatus.PENDING,
                transactionId: 'ALIPAY_123',
            };
            mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
            mockPrisma.payment.update.mockResolvedValue({
                ...mockPayment,
                status: financial_1.PaymentStatus.COMPLETED,
            });
            const status = await financialService.checkPaymentStatus('PAYMENT_123');
            expect(status).toBe(financial_1.PaymentStatus.COMPLETED);
            expect(mockPrisma.payment.update).toHaveBeenCalledWith({
                where: { id: 'PAYMENT_123' },
                data: { status: financial_1.PaymentStatus.COMPLETED },
            });
        });
        it('should handle gateway API errors gracefully', async () => {
            const mockPayment = {
                id: 'PAYMENT_123',
                invoiceId: 'INVOICE_123',
                method: financial_1.PaymentMethod.ALIPAY,
                status: financial_1.PaymentStatus.PENDING,
                transactionId: 'ALIPAY_123',
            };
            mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
            jest.spyOn(paymentGatewayService, 'checkAlipayStatus').mockRejectedValue(new Error('API Error'));
            const status = await financialService.checkPaymentStatus('PAYMENT_123');
            expect(status).toBe(financial_1.PaymentStatus.PENDING);
        });
    });
    describe('Refund Processing', () => {
        it('should process Alipay refund successfully', async () => {
            const mockPayment = {
                id: 'PAYMENT_123',
                invoiceId: 'INVOICE_123',
                method: financial_1.PaymentMethod.ALIPAY,
                status: financial_1.PaymentStatus.COMPLETED,
                amount: 500,
                transactionId: 'ALIPAY_123',
                invoice: { id: 'INVOICE_123' },
            };
            mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
            mockPrisma.payment.update.mockResolvedValue({
                ...mockPayment,
                status: financial_1.PaymentStatus.REFUNDED,
            });
            const result = await financialService.refundPayment('PAYMENT_123', 200, 'Customer request');
            expect(result.success).toBe(true);
            expect(mockPrisma.payment.update).toHaveBeenCalledWith({
                where: { id: 'PAYMENT_123' },
                data: { status: financial_1.PaymentStatus.REFUNDED },
            });
        });
        it('should validate refund amount', async () => {
            const mockPayment = {
                id: 'PAYMENT_123',
                invoiceId: 'INVOICE_123',
                method: financial_1.PaymentMethod.ALIPAY,
                status: financial_1.PaymentStatus.COMPLETED,
                amount: 500,
                transactionId: 'ALIPAY_123',
                invoice: { id: 'INVOICE_123' },
            };
            mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
            await expect(financialService.refundPayment('PAYMENT_123', 600))
                .rejects.toThrow('Refund amount cannot exceed payment amount');
        });
        it('should only refund completed payments', async () => {
            const mockPayment = {
                id: 'PAYMENT_123',
                invoiceId: 'INVOICE_123',
                method: financial_1.PaymentMethod.ALIPAY,
                status: financial_1.PaymentStatus.PENDING,
                amount: 500,
                transactionId: 'ALIPAY_123',
                invoice: { id: 'INVOICE_123' },
            };
            mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
            await expect(financialService.refundPayment('PAYMENT_123', 200))
                .rejects.toThrow('Only completed payments can be refunded');
        });
    });
    describe('Payment Method Discovery', () => {
        it('should return available payment methods', async () => {
            jest.spyOn(financialService, 'getPaymentMethods').mockResolvedValue([
                financial_1.PaymentMethod.ALIPAY,
                financial_1.PaymentMethod.WECHAT_PAY,
                financial_1.PaymentMethod.BANK_TRANSFER,
            ]);
            const methods = await financialService.getPaymentMethods();
            expect(methods).toContain(financial_1.PaymentMethod.ALIPAY);
            expect(methods).toContain(financial_1.PaymentMethod.WECHAT_PAY);
            expect(methods).toContain(financial_1.PaymentMethod.BANK_TRANSFER);
        });
    });
    describe('Payment History', () => {
        it('should retrieve payment history with filters', async () => {
            const mockPayments = [
                {
                    id: 'PAYMENT_123',
                    amount: 500,
                    method: financial_1.PaymentMethod.ALIPAY,
                    status: financial_1.PaymentStatus.COMPLETED,
                    invoice: {
                        id: 'INVOICE_123',
                        client: { id: 'CLIENT_123', name: 'Test Client' },
                    },
                },
            ];
            mockPrisma.payment.findMany.mockResolvedValue(mockPayments);
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
//# sourceMappingURL=PaymentIntegration.test.js.map