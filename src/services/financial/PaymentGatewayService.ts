import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import axios from 'axios';
import { getPaymentConfig } from '../../config/financial';
import { PaymentMethod, PaymentStatus } from '../models/financial';

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

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
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
    // In production, implement proper signature verification
    // For now, return true for development
    return process.env.NODE_ENV === 'development';
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

  // Alipay specific methods (to be implemented)
  private async initializeAlipayPayment(request: PaymentGatewayRequest): Promise<PaymentGatewayResponse> {
    // Placeholder implementation
    return {
      success: true,
      paymentUrl: 'https://alipay.com/pay',
      message: 'Alipay payment initialized',
    };
  }

  private async checkAlipayStatus(transactionId: string): Promise<PaymentStatus> {
    // Placeholder implementation
    return PaymentStatus.COMPLETED;
  }

  private async refundAlipayPayment(
    transactionId: string,
    amount?: number,
    reason?: string
  ): Promise<PaymentGatewayResponse> {
    // Placeholder implementation
    return {
      success: true,
      message: 'Alipay refund processed',
    };
  }

  private parseAlipayWebhook(payload: any): PaymentWebhookPayload {
    // Placeholder implementation
    return {
      transactionId: payload.trade_no,
      orderId: payload.out_trade_no,
      amount: parseFloat(payload.total_amount),
      status: payload.trade_status === 'TRADE_SUCCESS' ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
      gateway: 'ALIPAY',
      timestamp: new Date(),
    };
  }

  // WeChat Pay specific methods (to be implemented)
  private async initializeWechatPayment(request: PaymentGatewayRequest): Promise<PaymentGatewayResponse> {
    // Placeholder implementation
    return {
      success: true,
      qrCode: 'wechat://pay',
      message: 'WeChat Pay payment initialized',
    };
  }

  private async checkWechatStatus(transactionId: string): Promise<PaymentStatus> {
    // Placeholder implementation
    return PaymentStatus.COMPLETED;
  }

  private async refundWechatPayment(
    transactionId: string,
    amount?: number,
    reason?: string
  ): Promise<PaymentGatewayResponse> {
    // Placeholder implementation
    return {
      success: true,
      message: 'WeChat Pay refund processed',
    };
  }

  private parseWechatWebhook(payload: any): PaymentWebhookPayload {
    // Placeholder implementation
    return {
      transactionId: payload.transaction_id,
      orderId: payload.out_trade_no,
      amount: parseFloat(payload.total_fee) / 100, // Convert from fen to yuan
      status: payload.result_code === 'SUCCESS' ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
      gateway: 'WECHAT_PAY',
      timestamp: new Date(),
    };
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
}