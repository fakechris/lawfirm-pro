"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WechatPayService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const fs_1 = require("fs");
const financial_1 = require("../../config/financial");
class WechatPayService {
    constructor() {
        this.config = (0, financial_1.getPaymentConfig)().supportedGateways.wechat;
        this.processingConfig = (0, financial_1.getPaymentConfig)().processing;
    }
    async initializePayment(request) {
        try {
            const wechatParams = this.buildWechatParams(request);
            const sign = this.generateSign(wechatParams);
            wechatParams.sign = sign;
            if (this.config.sandbox) {
                return {
                    success: true,
                    qrCode: this.generateMockQRCode(wechatParams.out_trade_no),
                    transactionId: wechatParams.out_trade_no,
                    message: 'WeChat Pay payment initialized (sandbox mode)',
                };
            }
            const response = await this.callWechatAPI('pay/unifiedorder', wechatParams);
            if (response.return_code === 'SUCCESS' && response.result_code === 'SUCCESS') {
                return {
                    success: true,
                    qrCode: response.code_url,
                    transactionId: wechatParams.out_trade_no,
                    message: 'WeChat Pay payment initialized',
                };
            }
            else {
                throw new Error(response.return_msg || 'WeChat Pay initialization failed');
            }
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async checkPaymentStatus(transactionId) {
        try {
            const params = {
                appid: this.config.appId,
                mch_id: this.config.mchId,
                out_trade_no: transactionId,
                nonce_str: this.generateNonceStr(),
            };
            const sign = this.generateSign(params);
            params.sign = sign;
            if (this.config.sandbox) {
                return 'SUCCESS';
            }
            const response = await this.callWechatAPI('pay/orderquery', params);
            if (response.return_code === 'SUCCESS' && response.result_code === 'SUCCESS') {
                return response.trade_state;
            }
            else {
                throw new Error(response.return_msg || 'Status check failed');
            }
        }
        catch (error) {
            throw new Error(`Failed to check WeChat Pay status: ${error.message}`);
        }
    }
    async refundPayment(transactionId, amount, reason) {
        try {
            const params = {
                appid: this.config.appId,
                mch_id: this.config.mchId,
                out_trade_no: transactionId,
                out_refund_no: `REFUND_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                total_fee: this.convertToYuan(amount || 0),
                refund_fee: this.convertToYuan(amount || 0),
                refund_desc: reason || 'Refund requested',
                nonce_str: this.generateNonceStr(),
            };
            const sign = this.generateSign(params);
            params.sign = sign;
            if (this.config.sandbox) {
                return {
                    success: true,
                    transactionId: params.out_refund_no,
                    message: 'WeChat Pay refund processed (sandbox mode)',
                };
            }
            const response = await this.callWechatAPI('secapi/pay/refund', params, true);
            if (response.return_code === 'SUCCESS' && response.result_code === 'SUCCESS') {
                return {
                    success: true,
                    transactionId: response.refund_id,
                    message: 'WeChat Pay refund processed',
                };
            }
            else {
                throw new Error(response.return_msg || 'Refund failed');
            }
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    }
    verifyWebhookSignature(params) {
        try {
            const receivedSign = params.sign;
            const { sign, ...filteredParams } = params;
            const calculatedSign = this.generateSign(filteredParams);
            return calculatedSign === receivedSign;
        }
        catch (error) {
            console.error('WeChat Pay webhook signature verification failed:', error);
            return false;
        }
    }
    parseWebhookPayload(params) {
        return {
            transactionId: params.transaction_id,
            orderId: params.out_trade_no,
            amount: this.convertFromYuan(params.total_fee),
            status: this.mapWechatStatus(params.result_code, params.trade_state),
            gateway: 'WECHAT_PAY',
            timestamp: new Date(params.time_end || Date.now()),
            rawData: params,
        };
    }
    async generateJSAPIPayment(request, openid) {
        try {
            const params = {
                ...this.buildWechatParams(request),
                trade_type: 'JSAPI',
                openid: openid,
            };
            const sign = this.generateSign(params);
            params.sign = sign;
            if (this.config.sandbox) {
                return {
                    success: true,
                    message: 'JSAPI payment parameters generated (sandbox mode)',
                    transactionId: params.out_trade_no,
                };
            }
            const response = await this.callWechatAPI('pay/unifiedorder', params);
            if (response.return_code === 'SUCCESS' && response.result_code === 'SUCCESS') {
                const jsapiParams = {
                    appId: this.config.appId,
                    timeStamp: Math.floor(Date.now() / 1000).toString(),
                    nonceStr: this.generateNonceStr(),
                    package: `prepay_id=${response.prepay_id}`,
                    signType: 'MD5',
                };
                jsapiParams['paySign'] = this.generateSign(jsapiParams);
                return {
                    success: true,
                    message: 'JSAPI payment parameters generated',
                    transactionId: params.out_trade_no,
                };
            }
            else {
                throw new Error(response.return_msg || 'JSAPI payment generation failed');
            }
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async generateAPPPayment(request) {
        try {
            const params = {
                ...this.buildWechatParams(request),
                trade_type: 'APP',
            };
            const sign = this.generateSign(params);
            params.sign = sign;
            if (this.config.sandbox) {
                return {
                    success: true,
                    message: 'APP payment parameters generated (sandbox mode)',
                    transactionId: params.out_trade_no,
                };
            }
            const response = await this.callWechatAPI('pay/unifiedorder', params);
            if (response.return_code === 'SUCCESS' && response.result_code === 'SUCCESS') {
                const appParams = {
                    appid: this.config.appId,
                    partnerid: this.config.mchId,
                    prepayid: response.prepay_id,
                    package: 'Sign=WXPay',
                    noncestr: this.generateNonceStr(),
                    timestamp: Math.floor(Date.now() / 1000),
                };
                appParams['sign'] = this.generateSign(appParams);
                return {
                    success: true,
                    message: 'APP payment parameters generated',
                    transactionId: params.out_trade_no,
                };
            }
            else {
                throw new Error(response.return_msg || 'APP payment generation failed');
            }
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    }
    buildWechatParams(request) {
        const orderId = request.orderId || `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        return {
            appid: this.config.appId,
            mch_id: this.config.mchId,
            nonce_str: this.generateNonceStr(),
            body: request.description,
            out_trade_no: orderId,
            total_fee: this.convertToYuan(request.amount),
            spbill_create_ip: this.config.spbillCreateIp,
            notify_url: this.config.notifyUrl,
            trade_type: this.config.tradeType,
        };
    }
    generateSign(params) {
        try {
            const sortedParams = this.sortObject(params);
            const queryString = this.buildQueryString(sortedParams) + `&key=${this.config.apiKey}`;
            return crypto_1.default.createHash('md5').update(queryString, 'utf8').digest('hex').toUpperCase();
        }
        catch (error) {
            throw new Error(`Failed to generate signature: ${error.message}`);
        }
    }
    async callWechatAPI(endpoint, params, requireCert = false) {
        try {
            const baseUrl = this.config.sandbox
                ? 'https://api.mch.weixin.qq.com/sandboxnew'
                : 'https://api.mch.weixin.qq.com';
            const url = `${baseUrl}/${endpoint}`;
            const config = {
                headers: {
                    'Content-Type': 'application/xml',
                },
                timeout: this.processingConfig.timeout,
            };
            if (requireCert && this.config.certPath && this.config.keyPath) {
                config.httpsAgent = new (require('https').Agent)({
                    cert: (0, fs_1.readFileSync)(this.config.certPath),
                    key: (0, fs_1.readFileSync)(this.config.keyPath),
                });
            }
            const xml = this.buildXML(params);
            const response = await axios_1.default.post(url, xml, config);
            return this.parseXML(response.data);
        }
        catch (error) {
            throw new Error(`WeChat Pay API call failed: ${error.message}`);
        }
    }
    convertToYuan(amount) {
        return Math.round(amount * 100);
    }
    convertFromYuan(fen) {
        return fen / 100;
    }
    generateNonceStr(length = 32) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    buildQueryString(params) {
        return Object.entries(params)
            .map(([key, value]) => `${key}=${value}`)
            .join('&');
    }
    sortObject(obj) {
        return Object.keys(obj)
            .sort()
            .reduce((sorted, key) => {
            sorted[key] = obj[key];
            return sorted;
        }, {});
    }
    buildXML(params) {
        let xml = '<xml>';
        for (const [key, value] of Object.entries(params)) {
            xml += `<${key}><![CDATA[${value}]]></${key}>`;
        }
        xml += '</xml>';
        return xml;
    }
    parseXML(xml) {
        const result = {};
        const regex = /<([^>]+)><!\[CDATA\[([^]]*)\]\]><\/\1>/g;
        let match;
        while ((match = regex.exec(xml)) !== null) {
            result[match[1]] = match[2];
        }
        return result;
    }
    mapWechatStatus(resultCode, tradeState) {
        if (resultCode !== 'SUCCESS') {
            return 'FAILED';
        }
        const statusMap = {
            'SUCCESS': 'COMPLETED',
            'REFUND': 'REFUNDED',
            'NOTPAY': 'PENDING',
            'CLOSED': 'CANCELLED',
            'REVOKED': 'CANCELLED',
            'USERPAYING': 'PENDING',
            'PAYERROR': 'FAILED',
        };
        return statusMap[tradeState] || 'UNKNOWN';
    }
    generateMockQRCode(transactionId) {
        return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;
    }
    async closePayment(transactionId) {
        try {
            const params = {
                appid: this.config.appId,
                mch_id: this.config.mchId,
                out_trade_no: transactionId,
                nonce_str: this.generateNonceStr(),
            };
            const sign = this.generateSign(params);
            params.sign = sign;
            if (this.config.sandbox) {
                return {
                    success: true,
                    message: 'WeChat Pay payment closed (sandbox mode)',
                };
            }
            const response = await this.callWechatAPI('pay/closeorder', params);
            if (response.return_code === 'SUCCESS' && response.result_code === 'SUCCESS') {
                return {
                    success: true,
                    message: 'WeChat Pay payment closed',
                };
            }
            else {
                throw new Error(response.return_msg || 'Close payment failed');
            }
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    }
}
exports.WechatPayService = WechatPayService;
//# sourceMappingURL=WechatPayService.js.map