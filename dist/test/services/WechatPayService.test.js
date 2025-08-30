"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const WechatPayService_1 = require("../services/financial/WechatPayService");
const financial_1 = require("../config/financial");
jest.mock('axios');
jest.mock('crypto');
jest.mock('fs');
jest.mock('../config/financial');
const mockAxios = require('axios');
const mockCrypto = require('crypto');
const mockFs = require('fs');
const mockGetPaymentConfig = financial_1.getPaymentConfig;
describe('WechatPayService', () => {
    let wechatPayService;
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetPaymentConfig.mockReturnValue({
            supportedGateways: {
                wechat: {
                    enabled: true,
                    appId: 'test_app_id',
                    mchId: 'test_mch_id',
                    apiKey: 'test_api_key',
                    sandbox: true,
                    notifyUrl: 'http://localhost:3001/api/payments/wechat/notify',
                    tradeType: 'NATIVE',
                    spbillCreateIp: '127.0.0.1',
                    certPath: './certs/wechat/apiclient_cert.pem',
                    keyPath: './certs/wechat/apiclient_key.pem',
                },
            },
            processing: {
                timeout: 30000,
            },
        });
        mockCrypto.createHash.mockReturnValue({
            update: jest.fn().mockReturnThis(),
            digest: jest.fn().mockReturnValue('MOCK_HASH'),
        });
        mockFs.readFileSync.mockReturnValue('mock_certificate');
        wechatPayService = new WechatPayService_1.WechatPayService();
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
            const result = await wechatPayService.initializePayment(request);
            expect(result.success).toBe(true);
            expect(result.qrCode).toBeDefined();
            expect(result.transactionId).toBeDefined();
        });
        it('should handle API errors gracefully', async () => {
            mockAxios.post.mockRejectedValue(new Error('API Error'));
            mockGetPaymentConfig.mockReturnValue({
                supportedGateways: {
                    wechat: {
                        ...mockGetPaymentConfig().supportedGateways.wechat,
                        sandbox: false,
                    },
                },
                processing: {
                    timeout: 30000,
                },
            });
            const request = {
                amount: 100,
                currency: 'CNY',
                description: 'Test payment',
                orderId: 'ORDER_123',
                clientInfo: { name: 'Test Client', email: 'test@example.com' },
            };
            const result = await wechatPayService.initializePayment(request);
            expect(result.success).toBe(false);
            expect(result.error).toBe('API Error');
        });
    });
    describe('checkPaymentStatus', () => {
        it('should check payment status in sandbox mode', async () => {
            const result = await wechatPayService.checkPaymentStatus('WECHAT_123');
            expect(result).toBe('SUCCESS');
        });
        it('should handle API errors when checking status', async () => {
            mockAxios.post.mockRejectedValue(new Error('API Error'));
            mockGetPaymentConfig.mockReturnValue({
                supportedGateways: {
                    wechat: {
                        ...mockGetPaymentConfig().supportedGateways.wechat,
                        sandbox: false,
                    },
                },
                processing: {
                    timeout: 30000,
                },
            });
            await expect(wechatPayService.checkPaymentStatus('WECHAT_123'))
                .rejects.toThrow('Failed to check WeChat Pay status: API Error');
        });
    });
    describe('refundPayment', () => {
        it('should process refund in sandbox mode', async () => {
            const result = await wechatPayService.refundPayment('WECHAT_123', 50, 'Test refund');
            expect(result.success).toBe(true);
            expect(result.transactionId).toBeDefined();
        });
        it('should handle refund errors gracefully', async () => {
            mockAxios.post.mockRejectedValue(new Error('Refund Error'));
            mockGetPaymentConfig.mockReturnValue({
                supportedGateways: {
                    wechat: {
                        ...mockGetPaymentConfig().supportedGateways.wechat,
                        sandbox: false,
                    },
                },
                processing: {
                    timeout: 30000,
                },
            });
            const result = await wechatPayService.refundPayment('WECHAT_123', 50, 'Test refund');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Refund Error');
        });
    });
    describe('verifyWebhookSignature', () => {
        it('should verify webhook signature correctly', () => {
            const params = {
                sign: 'mock_hash',
                appid: 'test_app_id',
                mch_id: 'test_mch_id',
                out_trade_no: 'ORDER_123',
                total_fee: '10000',
            };
            const result = wechatPayService.verifyWebhookSignature(params);
            expect(result).toBe(true);
            expect(mockCrypto.createHash).toHaveBeenCalledWith('md5');
        });
        it('should handle signature verification failure', () => {
            mockCrypto.createHash.mockReturnValue({
                update: jest.fn().mockReturnThis(),
                digest: jest.fn().mockReturnValue('DIFFERENT_HASH'),
            });
            const params = {
                sign: 'wrong_hash',
                appid: 'test_app_id',
                mch_id: 'test_mch_id',
                out_trade_no: 'ORDER_123',
                total_fee: '10000',
            };
            const result = wechatPayService.verifyWebhookSignature(params);
            expect(result).toBe(false);
        });
    });
    describe('generateJSAPIPayment', () => {
        it('should generate JSAPI payment parameters in sandbox mode', async () => {
            const request = {
                amount: 100,
                currency: 'CNY',
                description: 'Test payment',
                orderId: 'ORDER_123',
                clientInfo: { name: 'Test Client', email: 'test@example.com' },
            };
            const result = await wechatPayService.generateJSAPIPayment(request, 'test_openid');
            expect(result.success).toBe(true);
            expect(result.transactionId).toBeDefined();
        });
    });
    describe('generateAPPPayment', () => {
        it('should generate APP payment parameters in sandbox mode', async () => {
            const request = {
                amount: 100,
                currency: 'CNY',
                description: 'Test payment',
                orderId: 'ORDER_123',
                clientInfo: { name: 'Test Client', email: 'test@example.com' },
            };
            const result = await wechatPayService.generateAPPPayment(request);
            expect(result.success).toBe(true);
            expect(result.transactionId).toBeDefined();
        });
    });
    describe('buildWechatParams', () => {
        it('should build correct WeChat Pay parameters', () => {
            const request = {
                amount: 100,
                currency: 'CNY',
                description: 'Test payment',
                orderId: 'ORDER_123',
                clientInfo: { name: 'Test Client', email: 'test@example.com' },
            };
            const params = wechatPayService.buildWechatParams(request);
            expect(params.appid).toBe('test_app_id');
            expect(params.mch_id).toBe('test_mch_id');
            expect(params.total_fee).toBe(10000);
            expect(params.body).toBe('Test payment');
            expect(params.out_trade_no).toBe('ORDER_123');
            expect(params.trade_type).toBe('NATIVE');
        });
    });
    describe('generateSign', () => {
        it('should generate MD5 signature', () => {
            const params = {
                appid: 'test_app_id',
                mch_id: 'test_mch_id',
                total_fee: '10000',
            };
            const signature = wechatPayService.generateSign(params);
            expect(signature).toBe('MOCK_HASH');
            expect(mockCrypto.createHash).toHaveBeenCalledWith('md5');
        });
    });
    describe('convertToYuan and convertFromYuan', () => {
        it('should convert amount to fen correctly', () => {
            const service = wechatPayService;
            expect(service.convertToYuan(100)).toBe(10000);
            expect(service.convertToYuan(99.99)).toBe(9999);
        });
        it('should convert amount from fen to yuan correctly', () => {
            const service = wechatPayService;
            expect(service.convertFromYuan(10000)).toBe(100);
            expect(service.convertFromYuan(9999)).toBe(99.99);
        });
    });
    describe('generateNonceStr', () => {
        it('should generate nonce string with correct length', () => {
            const service = wechatPayService;
            const nonce = service.generateNonceStr(32);
            expect(nonce).toHaveLength(32);
            expect(typeof nonce).toBe('string');
        });
        it('should generate different nonce strings', () => {
            const service = wechatPayService;
            const nonce1 = service.generateNonceStr(32);
            const nonce2 = service.generateNonceStr(32);
            expect(nonce1).not.toBe(nonce2);
        });
    });
    describe('buildXML and parseXML', () => {
        it('should build correct XML', () => {
            const service = wechatPayService;
            const params = {
                appid: 'test_app_id',
                mch_id: 'test_mch_id',
                total_fee: '10000',
            };
            const xml = service.buildXML(params);
            expect(xml).toContain('<appid><![CDATA[test_app_id]]></appid>');
            expect(xml).toContain('<mch_id><![CDATA[test_mch_id]]></mch_id>');
            expect(xml).toContain('<total_fee><![CDATA[10000]]></total_fee>');
        });
        it('should parse XML response', () => {
            const service = wechatPayService;
            const xml = '<xml><return_code><![CDATA[SUCCESS]]></return_code><result_code><![CDATA[SUCCESS]]></result_code></xml>';
            const result = service.parseXML(xml);
            expect(result.return_code).toBe('SUCCESS');
            expect(result.result_code).toBe('SUCCESS');
        });
    });
    describe('mapWechatStatus', () => {
        it('should map WeChat Pay statuses correctly', () => {
            const service = wechatPayService;
            expect(service.mapWechatStatus('SUCCESS', 'SUCCESS')).toBe('COMPLETED');
            expect(service.mapWechatStatus('SUCCESS', 'REFUND')).toBe('REFUNDED');
            expect(service.mapWechatStatus('SUCCESS', 'NOTPAY')).toBe('PENDING');
            expect(service.mapWechatStatus('SUCCESS', 'CLOSED')).toBe('CANCELLED');
            expect(service.mapWechatStatus('FAIL', 'PAYERROR')).toBe('FAILED');
        });
    });
    describe('closePayment', () => {
        it('should close payment in sandbox mode', async () => {
            const result = await wechatPayService.closePayment('WECHAT_123');
            expect(result.success).toBe(true);
        });
    });
});
//# sourceMappingURL=WechatPayService.test.js.map