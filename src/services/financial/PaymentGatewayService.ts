import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import axios from 'axios';
import { getPaymentConfig } from '../../config/financial';
import { PaymentMethod, PaymentStatus } from '../models/financial';
import { AlipayService } from './AlipayService';
import { WechatPayService } from './WechatPayService';

export interface PaymentGatewayRequest {
  amount: number;
  currency: string;
  description: string;
  orderId: string;
  clientInfo: {
    name: string;
    email: string;
    phone?: string;
  };
  returnUrl?: string;
  notifyUrl?: string;
}

export interface PaymentGatewayResponse {
  success: boolean;
  transactionId?: string;
  paymentUrl?: string;
  qrCode?: string;
  message?: string;
  error?: string;
}

export interface PaymentWebhookPayload {
  transactionId: string;
  orderId: string;
  amount: number;
  status: PaymentStatus;
  gateway: string;
  timestamp: Date;
  signature?: string;
}

export class PaymentGatewayService {
  private prisma: PrismaClient;
  private config = getPaymentConfig();
  private alipayService: AlipayService;
  private wechatPayService: WechatPayService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.alipayService = new AlipayService();
    this.wechatPayService = new WechatPayService();
  }

  // Initialize payment with specified gateway
  async initializePayment(
    gateway: PaymentMethod,
    request: PaymentGatewayRequest
  ): Promise<PaymentGatewayResponse> {
    // Validate request
    if (!this.validatePaymentRequest(request)) {
      throw new Error('Invalid payment request');
    }

    // Check gateway configuration
    if (!this.isGatewayConfigured(gateway)) {
      throw new Error(`Payment gateway ${gateway} is not configured`);
    }

    // Check amount limits
    if (!this.validateAmount(request.amount)) {
      throw new Error('Amount is outside allowed limits');
    }

    switch (gateway) {
      case PaymentMethod.ALIPAY:
        return this.initializeAlipayPayment(request);
      case PaymentMethod.WECHAT_PAY:
        return this.initializeWechatPayment(request);
      case PaymentMethod.BANK_TRANSFER:
        return this.initializeBankTransfer(request);
      default:
        throw new Error(`Unsupported payment gateway: ${gateway}`);
    }
  }

  // Process payment webhook
  async processWebhook(gateway: PaymentMethod, payload: any): Promise<boolean> {
    try {
      // Verify webhook signature
      if (!this.verifyWebhookSignature(gateway, payload)) {
        throw new Error('Invalid webhook signature');
      }

      const webhookPayload = this.parseWebhookPayload(gateway, payload);
      
      // Find payment record
      const payment = await this.prisma.payment.findFirst({
        where: { transactionId: webhookPayload.transactionId },
      });

      if (!payment) {
        throw new Error('Payment not found');
      }

      // Update payment status
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: webhookPayload.status,
          reference: JSON.stringify(payload),
        },
      });

      // If payment is completed, update invoice status
      if (webhookPayload.status === PaymentStatus.COMPLETED) {
        await this.updateInvoicePaymentStatus(payment.invoiceId);
      }

      return true;
    } catch (error) {
      console.error(`Webhook processing failed for ${gateway}:`, error);
      return false;
    }
  }

  // Check payment status
  async checkPaymentStatus(
    gateway: PaymentMethod,
    transactionId: string
  ): Promise<PaymentStatus> {
    switch (gateway) {
      case PaymentMethod.ALIPAY:
        return this.checkAlipayStatus(transactionId);
      case PaymentMethod.WECHAT_PAY:
        return this.checkWechatStatus(transactionId);
      default:
        throw new Error(`Status check not supported for gateway: ${gateway}`);
    }
  }

  // Refund payment
  async refundPayment(
    gateway: PaymentMethod,
    transactionId: string,
    amount?: number,
    reason?: string
  ): Promise<PaymentGatewayResponse> {
    switch (gateway) {
      case PaymentMethod.ALIPAY:
        return this.refundAlipayPayment(transactionId, amount, reason);
      case PaymentMethod.WECHAT_PAY:
        return this.refundWechatPayment(transactionId, amount, reason);
      default:
        throw new Error(`Refund not supported for gateway: ${gateway}`);
    }
  }

  // Helper methods
  private validatePaymentRequest(request: PaymentGatewayRequest): boolean {
    return (
      request.amount > 0 &&
      request.currency &&
      request.description &&
      request.orderId &&
      request.clientInfo.name &&
      request.clientInfo.email
    );
  }

  private isGatewayConfigured(gateway: PaymentMethod): boolean {
    const gatewayConfig = this.config.supportedGateways[gateway.toLowerCase()];
    return gatewayConfig && gatewayConfig.enabled;
  }

  private validateAmount(amount: number): boolean {
    const { minAmount, maxAmount } = this.config.processing;
    return amount >= minAmount && amount <= maxAmount;
  }

  private verifyWebhookSignature(gateway: PaymentMethod, payload: any): boolean {
    try {
      switch (gateway) {
        case PaymentMethod.ALIPAY:
          return this.alipayService.verifyWebhookSignature(payload);
        case PaymentMethod.WECHAT_PAY:
          return this.wechatPayService.verifyWebhookSignature(payload);
        default:
          return process.env.NODE_ENV === 'development';
      }
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return false;
    }
  }

  private parseWebhookPayload(gateway: PaymentMethod, payload: any): PaymentWebhookPayload {
    // Parse different webhook formats based on gateway
    switch (gateway) {
      case PaymentMethod.ALIPAY:
        return this.parseAlipayWebhook(payload);
      case PaymentMethod.WECHAT_PAY:
        return this.parseWechatWebhook(payload);
      default:
        throw new Error(`Webhook parsing not supported for gateway: ${gateway}`);
    }
  }

  private async updateInvoicePaymentStatus(invoiceId: string): Promise<void> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true },
    });

    if (!invoice) return;

    const totalPaid = invoice.payments
      .filter(p => p.status === PaymentStatus.COMPLETED)
      .reduce((sum, p) => sum + p.amount, 0);

    let status: any;
    if (totalPaid >= invoice.total) {
      status = 'PAID';
    } else if (totalPaid > 0) {
      status = 'PARTIALLY_PAID';
    } else {
      status = 'UNPAID';
    }

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status },
    });
  }

  // Alipay specific methods
  private async initializeAlipayPayment(request: PaymentGatewayRequest): Promise<PaymentGatewayResponse> {
    try {
      const response = await this.alipayService.initializePayment(request);
      return {
        success: response.success,
        transactionId: response.transactionId,
        paymentUrl: response.paymentUrl,
        qrCode: response.qrCode,
        message: response.message,
        error: response.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Alipay payment initialization failed',
      };
    }
  }

  private async checkAlipayStatus(transactionId: string): Promise<PaymentStatus> {
    try {
      const status = await this.alipayService.checkPaymentStatus(transactionId);
      return this.mapAlipayStatus(status);
    } catch (error) {
      console.error('Alipay status check failed:', error);
      return PaymentStatus.FAILED;
    }
  }

  private async refundAlipayPayment(
    transactionId: string,
    amount?: number,
    reason?: string
  ): Promise<PaymentGatewayResponse> {
    try {
      const response = await this.alipayService.refundPayment(transactionId, amount, reason);
      return {
        success: response.success,
        transactionId: response.transactionId,
        message: response.message,
        error: response.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Alipay refund failed',
      };
    }
  }

  private parseAlipayWebhook(payload: any): PaymentWebhookPayload {
    try {
      const webhookData = this.alipayService.parseWebhookPayload(payload);
      return {
        transactionId: webhookData.transactionId,
        orderId: webhookData.orderId,
        amount: webhookData.amount,
        status: webhookData.status as PaymentStatus,
        gateway: 'ALIPAY',
        timestamp: webhookData.timestamp,
        signature: payload.sign,
      };
    } catch (error) {
      console.error('Alipay webhook parsing failed:', error);
      throw new Error('Failed to parse Alipay webhook');
    }
  }

  // WeChat Pay specific methods
  private async initializeWechatPayment(request: PaymentGatewayRequest): Promise<PaymentGatewayResponse> {
    try {
      const response = await this.wechatPayService.initializePayment(request);
      return {
        success: response.success,
        transactionId: response.transactionId,
        qrCode: response.qrCode,
        message: response.message,
        error: response.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'WeChat Pay payment initialization failed',
      };
    }
  }

  private async checkWechatStatus(transactionId: string): Promise<PaymentStatus> {
    try {
      const status = await this.wechatPayService.checkPaymentStatus(transactionId);
      return this.mapWechatStatus(status);
    } catch (error) {
      console.error('WeChat Pay status check failed:', error);
      return PaymentStatus.FAILED;
    }
  }

  private async refundWechatPayment(
    transactionId: string,
    amount?: number,
    reason?: string
  ): Promise<PaymentGatewayResponse> {
    try {
      const response = await this.wechatPayService.refundPayment(transactionId, amount, reason);
      return {
        success: response.success,
        transactionId: response.transactionId,
        message: response.message,
        error: response.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'WeChat Pay refund failed',
      };
    }
  }

  private parseWechatWebhook(payload: any): PaymentWebhookPayload {
    try {
      const webhookData = this.wechatPayService.parseWebhookPayload(payload);
      return {
        transactionId: webhookData.transactionId,
        orderId: webhookData.orderId,
        amount: webhookData.amount,
        status: webhookData.status as PaymentStatus,
        gateway: 'WECHAT_PAY',
        timestamp: webhookData.timestamp,
        signature: payload.sign,
      };
    } catch (error) {
      console.error('WeChat Pay webhook parsing failed:', error);
      throw new Error('Failed to parse WeChat Pay webhook');
    }
  }

  // Bank transfer initialization
  private async initializeBankTransfer(request: PaymentGatewayRequest): Promise<PaymentGatewayResponse> {
    const bankConfig = this.config.supportedGateways.bank;
    
    return {
      success: true,
      message: 'Bank transfer instructions generated',
      transactionId: `BT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  // Status mapping methods
  private mapAlipayStatus(alipayStatus: string): PaymentStatus {
    const statusMap: { [key: string]: PaymentStatus } = {
      'WAIT_BUYER_PAY': PaymentStatus.PENDING,
      'TRADE_CLOSED': PaymentStatus.FAILED,
      'TRADE_SUCCESS': PaymentStatus.COMPLETED,
      'TRADE_FINISHED': PaymentStatus.COMPLETED,
      'TRADE_PENDING': PaymentStatus.PENDING,
    };
    return statusMap[alipayStatus] || PaymentStatus.FAILED;
  }

  private mapWechatStatus(wechatStatus: string): PaymentStatus {
    const statusMap: { [key: string]: PaymentStatus } = {
      'SUCCESS': PaymentStatus.COMPLETED,
      'REFUND': PaymentStatus.REFUNDED,
      'NOTPAY': PaymentStatus.PENDING,
      'CLOSED': PaymentStatus.FAILED,
      'REVOKED': PaymentStatus.FAILED,
      'USERPAYING': PaymentStatus.PENDING,
      'PAYERROR': PaymentStatus.FAILED,
    };
    return statusMap[wechatStatus] || PaymentStatus.FAILED;
  }

  // Enhanced payment methods for additional functionality
  async generateQRCode(gateway: PaymentMethod, request: PaymentGatewayRequest): Promise<PaymentGatewayResponse> {
    try {
      switch (gateway) {
        case PaymentMethod.ALIPAY:
          return await this.alipayService.generateQRCode(request);
        case PaymentMethod.WECHAT_PAY:
          return await this.wechatPayService.initializePayment(request);
        default:
          throw new Error(`QR code generation not supported for gateway: ${gateway}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'QR code generation failed',
      };
    }
  }

  async closePayment(gateway: PaymentMethod, transactionId: string): Promise<PaymentGatewayResponse> {
    try {
      switch (gateway) {
        case PaymentMethod.ALIPAY:
          return await this.alipayService.closePayment(transactionId);
        case PaymentMethod.WECHAT_PAY:
          return await this.wechatPayService.closePayment(transactionId);
        default:
          throw new Error(`Payment closing not supported for gateway: ${gateway}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Payment closing failed',
      };
    }
  }

  // Get supported payment methods
  getSupportedPaymentMethods(): PaymentMethod[] {
    const methods: PaymentMethod[] = [];
    
    if (this.config.supportedGateways.alipay?.enabled) {
      methods.push(PaymentMethod.ALIPAY);
    }
    
    if (this.config.supportedGateways.wechat?.enabled) {
      methods.push(PaymentMethod.WECHAT_PAY);
    }
    
    if (this.config.supportedGateways.bank?.enabled) {
      methods.push(PaymentMethod.BANK_TRANSFER);
    }

    return methods;
  }

  // Validate payment method configuration
  validatePaymentMethod(method: PaymentMethod): boolean {
    return this.getSupportedPaymentMethods().includes(method);
  }

  // Get payment method limits
  getPaymentMethodLimits(method: PaymentMethod): { min: number; max: number } {
    const processing = this.config.processing;
    const gatewayConfig = this.config.supportedGateways[method.toLowerCase()];
    
    return {
      min: processing.minAmount,
      max: Math.min(processing.maxAmount, gatewayConfig?.maxAmount || processing.maxAmount),
    };
  }
}