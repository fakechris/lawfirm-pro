import crypto from 'crypto';
import axios from 'axios';
import { readFileSync } from 'fs';
import { getPaymentConfig } from '../../config/financial';
import { PaymentGatewayRequest, PaymentGatewayResponse } from './PaymentGatewayService';

export class WechatPayService {
  private config = getPaymentConfig().supportedGateways.wechat;
  private processingConfig = getPaymentConfig().processing;

  // Initialize WeChat Pay payment
  async initializePayment(request: PaymentGatewayRequest): Promise<PaymentGatewayResponse> {
    try {
      const wechatParams = this.buildWechatParams(request);
      const sign = this.generateSign(wechatParams);
      
      wechatParams.sign = sign;

      if (this.config.sandbox) {
        // Sandbox mode - return mock response
        return {
          success: true,
          qrCode: this.generateMockQRCode(wechatParams.out_trade_no),
          transactionId: wechatParams.out_trade_no,
          message: 'WeChat Pay payment initialized (sandbox mode)',
        };
      }

      // Production mode - would call actual WeChat Pay API
      const response = await this.callWechatAPI('pay/unifiedorder', wechatParams);
      
      if (response.return_code === 'SUCCESS' && response.result_code === 'SUCCESS') {
        return {
          success: true,
          qrCode: response.code_url,
          transactionId: wechatParams.out_trade_no,
          message: 'WeChat Pay payment initialized',
        };
      } else {
        throw new Error(response.return_msg || 'WeChat Pay initialization failed');
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Check WeChat Pay payment status
  async checkPaymentStatus(transactionId: string): Promise<string> {
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
        // Sandbox mode - return mock success
        return 'SUCCESS';
      }

      const response = await this.callWechatAPI('pay/orderquery', params);
      
      if (response.return_code === 'SUCCESS' && response.result_code === 'SUCCESS') {
        return response.trade_state;
      } else {
        throw new Error(response.return_msg || 'Status check failed');
      }
    } catch (error) {
      throw new Error(`Failed to check WeChat Pay status: ${error.message}`);
    }
  }

  // Refund WeChat Pay payment
  async refundPayment(transactionId: string, amount?: number, reason?: string): Promise<PaymentGatewayResponse> {
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
        // Sandbox mode - return mock success
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
      } else {
        throw new Error(response.return_msg || 'Refund failed');
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Verify WeChat Pay webhook signature
  verifyWebhookSignature(params: any): boolean {
    try {
      const receivedSign = params.sign;
      
      // Remove sign from parameters
      const { sign, ...filteredParams } = params;
      
      const calculatedSign = this.generateSign(filteredParams);
      return calculatedSign === receivedSign;
    } catch (error) {
      console.error('WeChat Pay webhook signature verification failed:', error);
      return false;
    }
  }

  // Parse WeChat Pay webhook payload
  parseWebhookPayload(params: any) {
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

  // Generate JSAPI payment parameters for mobile/web
  async generateJSAPIPayment(request: PaymentGatewayRequest, openid: string): Promise<PaymentGatewayResponse> {
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
      } else {
        throw new Error(response.return_msg || 'JSAPI payment generation failed');
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Generate APP payment parameters
  async generateAPPPayment(request: PaymentGatewayRequest): Promise<PaymentGatewayResponse> {
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
      } else {
        throw new Error(response.return_msg || 'APP payment generation failed');
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Build WeChat Pay API parameters
  private buildWechatParams(request: PaymentGatewayRequest) {
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

  // Generate MD5 signature for WeChat Pay
  private generateSign(params: any): string {
    try {
      const sortedParams = this.sortObject(params);
      const queryString = this.buildQueryString(sortedParams) + `&key=${this.config.apiKey}`;
      
      return crypto.createHash('md5').update(queryString, 'utf8').digest('hex').toUpperCase();
    } catch (error) {
      throw new Error(`Failed to generate signature: ${error.message}`);
    }
  }

  // Call WeChat Pay API
  private async callWechatAPI(endpoint: string, params: any, requireCert: boolean = false): Promise<any> {
    try {
      const baseUrl = this.config.sandbox 
        ? 'https://api.mch.weixin.qq.com/sandboxnew'
        : 'https://api.mch.weixin.qq.com';
      
      const url = `${baseUrl}/${endpoint}`;
      
      const config: any = {
        headers: {
          'Content-Type': 'application/xml',
        },
        timeout: this.processingConfig.timeout,
      };

      // Add certificate if required
      if (requireCert && this.config.certPath && this.config.keyPath) {
        config.httpsAgent = new (require('https').Agent)({
          cert: readFileSync(this.config.certPath),
          key: readFileSync(this.config.keyPath),
        });
      }

      const xml = this.buildXML(params);
      const response = await axios.post(url, xml, config);
      
      return this.parseXML(response.data);
    } catch (error) {
      throw new Error(`WeChat Pay API call failed: ${error.message}`);
    }
  }

  // Convert amount to fen (WeChat Pay uses fen as unit)
  private convertToYuan(amount: number): number {
    return Math.round(amount * 100);
  }

  // Convert amount from fen to yuan
  private convertFromYuan(fen: number): number {
    return fen / 100;
  }

  // Generate nonce string
  private generateNonceStr(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Build query string from parameters
  private buildQueryString(params: any): string {
    return Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
  }

  // Sort object by keys for signature generation
  private sortObject(obj: any): any {
    return Object.keys(obj)
      .sort()
      .reduce((sorted: any, key) => {
        sorted[key] = obj[key];
        return sorted;
      }, {});
  }

  // Build XML for WeChat Pay API
  private buildXML(params: any): string {
    let xml = '<xml>';
    for (const [key, value] of Object.entries(params)) {
      xml += `<${key}><![CDATA[${value}]]></${key}>`;
    }
    xml += '</xml>';
    return xml;
  }

  // Parse XML response from WeChat Pay
  private parseXML(xml: string): any {
    // Simple XML parser - in production, use a proper XML parser
    const result: any = {};
    const regex = /<([^>]+)><!\[CDATA\[([^]]*)\]\]><\/\1>/g;
    let match;
    
    while ((match = regex.exec(xml)) !== null) {
      result[match[1]] = match[2];
    }
    
    return result;
  }

  // Map WeChat Pay status to our PaymentStatus
  private mapWechatStatus(resultCode: string, tradeState?: string): string {
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

  // Generate mock QR code for sandbox mode
  private generateMockQRCode(transactionId: string): string {
    return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;
  }

  // Close WeChat Pay payment
  async closePayment(transactionId: string): Promise<PaymentGatewayResponse> {
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
      } else {
        throw new Error(response.return_msg || 'Close payment failed');
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}