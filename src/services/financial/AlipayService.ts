import crypto from 'crypto';
import axios from 'axios';
import { getPaymentConfig } from '../../config/financial';
import { PaymentGatewayRequest, PaymentGatewayResponse } from './PaymentGatewayService';

export class AlipayService {
  private config = getPaymentConfig().supportedGateways.alipay;
  private processingConfig = getPaymentConfig().processing;

  // Initialize Alipay payment
  async initializePayment(request: PaymentGatewayRequest): Promise<PaymentGatewayResponse> {
    try {
      const alipayParams = this.buildAlipayParams(request);
      const sign = this.generateSign(alipayParams);
      
      alipayParams.sign = sign;
      alipayParams.sign_type = this.config.signType;

      if (this.config.sandbox) {
        // Sandbox mode - return mock response
        return {
          success: true,
          paymentUrl: `https://openapi.alipaydev.com/gateway.do?${this.buildQueryString(alipayParams)}`,
          transactionId: `ALIPAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          message: 'Alipay payment initialized (sandbox mode)',
        };
      }

      // Production mode - would call actual Alipay API
      const response = await this.callAlipayAPI('alipay.trade.page.pay', alipayParams);
      
      return {
        success: true,
        paymentUrl: response,
        transactionId: alipayParams.out_trade_no,
        message: 'Alipay payment initialized',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Check Alipay payment status
  async checkPaymentStatus(transactionId: string): Promise<string> {
    try {
      const params = {
        app_id: this.config.appId,
        method: 'alipay.trade.query',
        charset: this.config.charset,
        sign_type: this.config.signType,
        timestamp: this.getTimestamp(),
        version: this.config.version,
        out_trade_no: transactionId,
      };

      const sign = this.generateSign(params);
      params.sign = sign;

      if (this.config.sandbox) {
        // Sandbox mode - return mock success
        return 'TRADE_SUCCESS';
      }

      const response = await this.callAlipayAPI('alipay.trade.query', params);
      return response.trade_status || 'UNKNOWN';
    } catch (error) {
      throw new Error(`Failed to check Alipay status: ${error.message}`);
    }
  }

  // Refund Alipay payment
  async refundPayment(transactionId: string, amount?: number, reason?: string): Promise<PaymentGatewayResponse> {
    try {
      const params = {
        app_id: this.config.appId,
        method: 'alipay.trade.refund',
        charset: this.config.charset,
        sign_type: this.config.signType,
        timestamp: this.getTimestamp(),
        version: this.config.version,
        out_trade_no: transactionId,
        refund_amount: amount?.toString() || '0',
        refund_reason: reason || 'Refund requested',
      };

      const sign = this.generateSign(params);
      params.sign = sign;

      if (this.config.sandbox) {
        // Sandbox mode - return mock success
        return {
          success: true,
          transactionId: `REFUND_${Date.now()}`,
          message: 'Alipay refund processed (sandbox mode)',
        };
      }

      const response = await this.callAlipayAPI('alipay.trade.refund', params);
      
      return {
        success: response.fund_change === 'Y',
        transactionId: response.out_trade_no,
        message: 'Alipay refund processed',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Verify Alipay webhook signature
  verifyWebhookSignature(params: any): boolean {
    try {
      const receivedSign = params.sign;
      const signType = params.sign_type;
      
      // Remove sign and sign_type from parameters
      const { sign, sign_type, ...filteredParams } = params;
      
      const calculatedSign = this.generateSign(filteredParams, signType);
      return calculatedSign === receivedSign;
    } catch (error) {
      console.error('Alipay webhook signature verification failed:', error);
      return false;
    }
  }

  // Parse Alipay webhook payload
  parseWebhookPayload(params: any) {
    return {
      transactionId: params.trade_no,
      orderId: params.out_trade_no,
      amount: parseFloat(params.total_amount),
      status: this.mapAlipayStatus(params.trade_status),
      gateway: 'ALIPAY',
      timestamp: new Date(params.gmt_payment || Date.now()),
      rawData: params,
    };
  }

  // Build Alipay API parameters
  private buildAlipayParams(request: PaymentGatewayRequest) {
    const orderId = request.orderId || `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      app_id: this.config.appId,
      method: 'alipay.trade.page.pay',
      charset: this.config.charset,
      sign_type: this.config.signType,
      timestamp: this.getTimestamp(),
      version: this.config.version,
      notify_url: this.config.notifyUrl,
      return_url: this.config.returnUrl,
      out_trade_no: orderId,
      total_amount: request.amount.toFixed(2),
      subject: request.description,
      body: request.description,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      timeout_express: '30m', // 30 minutes timeout
    };
  }

  // Generate RSA signature for Alipay
  private generateSign(params: any, signType?: string): string {
    try {
      const signTypeToUse = signType || this.config.signType;
      const sortedParams = this.sortObject(params);
      const queryString = this.buildQueryString(sortedParams);
      
      if (signTypeToUse === 'RSA2') {
        const signer = crypto.createSign('RSA-SHA256');
        signer.update(queryString, 'utf8');
        return signer.sign(this.config.privateKey, 'base64');
      } else {
        const signer = crypto.createSign('RSA-SHA1');
        signer.update(queryString, 'utf8');
        return signer.sign(this.config.privateKey, 'base64');
      }
    } catch (error) {
      throw new Error(`Failed to generate signature: ${error.message}`);
    }
  }

  // Verify RSA signature
  private verifySign(params: any, signature: string, signType?: string): boolean {
    try {
      const signTypeToUse = signType || this.config.signType;
      const sortedParams = this.sortObject(params);
      const queryString = this.buildQueryString(sortedParams);
      
      if (signTypeToUse === 'RSA2') {
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(queryString, 'utf8');
        return verifier.verify(this.config.publicKey, signature, 'base64');
      } else {
        const verifier = crypto.createVerify('RSA-SHA1');
        verifier.update(queryString, 'utf8');
        return verifier.verify(this.config.publicKey, signature, 'base64');
      }
    } catch (error) {
      return false;
    }
  }

  // Call Alipay API
  private async callAlipayAPI(method: string, params: any): Promise<any> {
    try {
      const baseUrl = this.config.sandbox 
        ? 'https://openapi.alipaydev.com/gateway.do'
        : 'https://openapi.alipay.com/gateway.do';
      
      const response = await axios.post(baseUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: this.processingConfig.timeout,
      });

      return response.data;
    } catch (error) {
      throw new Error(`Alipay API call failed: ${error.message}`);
    }
  }

  // Build query string from parameters
  private buildQueryString(params: any): string {
    return Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
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

  // Get current timestamp in Alipay format
  private getTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '').slice(0, -5);
  }

  // Map Alipay status to our PaymentStatus
  private mapAlipayStatus(alipayStatus: string): string {
    const statusMap = {
      'WAIT_BUYER_PAY': 'PENDING',
      'TRADE_CLOSED': 'CANCELLED',
      'TRADE_SUCCESS': 'COMPLETED',
      'TRADE_FINISHED': 'COMPLETED',
      'TRADE_PENDING': 'PENDING',
    };
    return statusMap[alipayStatus] || 'UNKNOWN';
  }

  // Generate QR code for Alipay payment (for in-person payments)
  async generateQRCode(request: PaymentGatewayRequest): Promise<PaymentGatewayResponse> {
    try {
      const params = {
        ...this.buildAlipayParams(request),
        method: 'alipay.trade.precreate',
        qr_code_mode: 'TWO_DIMENSION',
      };

      const sign = this.generateSign(params);
      params.sign = sign;

      if (this.config.sandbox) {
        return {
          success: true,
          qrCode: 'https://example.com/alipay-qr-code.png',
          transactionId: params.out_trade_no,
          message: 'Alipay QR code generated (sandbox mode)',
        };
      }

      const response = await this.callAlipayAPI('alipay.trade.precreate', params);
      
      return {
        success: true,
        qrCode: response.qr_code,
        transactionId: params.out_trade_no,
        message: 'Alipay QR code generated',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Close Alipay payment
  async closePayment(transactionId: string): Promise<PaymentGatewayResponse> {
    try {
      const params = {
        app_id: this.config.appId,
        method: 'alipay.trade.close',
        charset: this.config.charset,
        sign_type: this.config.signType,
        timestamp: this.getTimestamp(),
        version: this.config.version,
        out_trade_no: transactionId,
        operator_id: 'SYSTEM',
      };

      const sign = this.generateSign(params);
      params.sign = sign;

      if (this.config.sandbox) {
        return {
          success: true,
          message: 'Alipay payment closed (sandbox mode)',
        };
      }

      const response = await this.callAlipayAPI('alipay.trade.close', params);
      
      return {
        success: response.code === '10000',
        message: response.msg || 'Alipay payment closed',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}