import { PrismaClient } from '@prisma/client';
import { PaymentMethod, PaymentStatus } from '../models/financial';
import { PaymentGatewayService } from './PaymentGatewayService';
import { getPaymentConfig } from '../../config/financial';

export interface PaymentMethodConfig {
  method: PaymentMethod;
  enabled: boolean;
  displayName: string;
  description: string;
  icon?: string;
  color?: string;
  limits: {
    min: number;
    max: number;
    dailyLimit?: number;
    monthlyLimit?: number;
  };
  fees: {
    percentage?: number;
    fixed?: number;
  };
  processingTime: {
    min: number; // in minutes
    max: number; // in minutes
  };
  supportedCurrencies: string[];
  countries: string[];
  features: {
    instant: boolean;
    refundable: boolean;
    recurring: boolean;
    qrCode: boolean;
    mobilePayment: boolean;
  };
}

export interface PaymentMethodResponse {
  success: boolean;
  paymentMethods?: PaymentMethodConfig[];
  error?: string;
  message?: string;
}

export interface PaymentPreference {
  clientId: string;
  preferredMethods: PaymentMethod[];
  defaultMethod: PaymentMethod;
  lastUsed?: Date;
}

export class PaymentMethodManager {
  private prisma: PrismaClient;
  private gatewayService: PaymentGatewayService;
  private config = getPaymentConfig();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.gatewayService = new PaymentGatewayService(prisma);
  }

  // Get all available payment methods
  async getAvailablePaymentMethods(clientId?: string): Promise<PaymentMethodResponse> {
    try {
      const supportedMethods = this.gatewayService.getSupportedPaymentMethods();
      const paymentMethods: PaymentMethodConfig[] = [];

      // Get client preferences if clientId is provided
      let clientPreference: PaymentPreference | null = null;
      if (clientId) {
        clientPreference = await this.getClientPaymentPreference(clientId);
      }

      for (const method of supportedMethods) {
        const methodConfig = await this.getPaymentMethodConfig(method);
        if (methodConfig.enabled) {
          paymentMethods.push(methodConfig);
        }
      }

      // Sort by client preference if available
      if (clientPreference) {
        paymentMethods.sort((a, b) => {
          const aIndex = clientPreference.preferredMethods.indexOf(a.method);
          const bIndex = clientPreference.preferredMethods.indexOf(b.method);
          
          if (aIndex === -1 && bIndex === -1) return 0;
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        });
      }

      return {
        success: true,
        paymentMethods,
        message: 'Payment methods retrieved successfully',
      };
    } catch (error) {
      console.error('Failed to get available payment methods:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Get payment method configuration
  async getPaymentMethodConfig(method: PaymentMethod): Promise<PaymentMethodConfig> {
    const gatewayConfig = this.config.supportedGateways[method.toLowerCase()];
    const processingConfig = this.config.processing;

    const baseConfig: PaymentMethodConfig = {
      method,
      enabled: gatewayConfig?.enabled || false,
      displayName: this.getPaymentMethodDisplayName(method),
      description: this.getPaymentMethodDescription(method),
      limits: {
        min: processingConfig.minAmount,
        max: processingConfig.maxAmount,
        dailyLimit: gatewayConfig?.dailyLimit,
        monthlyLimit: gatewayConfig?.monthlyLimit,
      },
      fees: {
        percentage: gatewayConfig?.feePercentage,
        fixed: gatewayConfig?.feeFixed,
      },
      processingTime: this.getPaymentMethodProcessingTime(method),
      supportedCurrencies: this.getSupportedCurrencies(method),
      countries: this.getSupportedCountries(method),
      features: this.getPaymentMethodFeatures(method),
    };

    // Add method-specific configurations
    switch (method) {
      case PaymentMethod.ALIPAY:
        return {
          ...baseConfig,
          icon: 'alipay',
          color: '#1677FF',
        };
      case PaymentMethod.WECHAT_PAY:
        return {
          ...baseConfig,
          icon: 'wechat',
          color: '#07C160',
        };
      case PaymentMethod.BANK_TRANSFER:
        return {
          ...baseConfig,
          icon: 'bank',
          color: '#666666',
        };
      default:
        return baseConfig;
    }
  }

  // Validate payment method for specific transaction
  async validatePaymentMethod(
    method: PaymentMethod,
    amount: number,
    currency: string,
    clientId?: string
  ): Promise<{ valid: boolean; reason?: string }> {
    try {
      // Check if method is supported
      if (!this.gatewayService.validatePaymentMethod(method)) {
        return {
          valid: false,
          reason: 'Payment method is not supported',
        };
      }

      // Get method configuration
      const methodConfig = await this.getPaymentMethodConfig(method);
      
      // Check if method is enabled
      if (!methodConfig.enabled) {
        return {
          valid: false,
          reason: 'Payment method is currently disabled',
        };
      }

      // Check amount limits
      if (amount < methodConfig.limits.min) {
        return {
          valid: false,
          reason: `Amount is below minimum limit of ${methodConfig.limits.min}`,
        };
      }

      if (amount > methodConfig.limits.max) {
        return {
          valid: false,
          reason: `Amount exceeds maximum limit of ${methodConfig.limits.max}`,
        };
      }

      // Check currency support
      if (!methodConfig.supportedCurrencies.includes(currency)) {
        return {
          valid: false,
          reason: `Currency ${currency} is not supported by this payment method`,
        };
      }

      // Check daily and monthly limits if clientId is provided
      if (clientId) {
        const limitsCheck = await this.checkClientLimits(clientId, method, amount);
        if (!limitsCheck.valid) {
          return limitsCheck;
        }
      }

      return { valid: true };
    } catch (error) {
      console.error('Payment method validation failed:', error);
      return {
        valid: false,
        reason: 'Validation failed due to internal error',
      };
    }
  }

  // Get client payment preference
  async getClientPaymentPreference(clientId: string): Promise<PaymentPreference | null> {
    try {
      const preference = await this.prisma.clientPaymentPreference.findUnique({
        where: { clientId },
      });

      if (!preference) {
        return null;
      }

      return {
        clientId: preference.clientId,
        preferredMethods: preference.preferredMethods as PaymentMethod[],
        defaultMethod: preference.defaultMethod as PaymentMethod,
        lastUsed: preference.lastUsed,
      };
    } catch (error) {
      console.error('Failed to get client payment preference:', error);
      return null;
    }
  }

  // Update client payment preference
  async updateClientPaymentPreference(
    clientId: string,
    preference: Partial<PaymentPreference>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const existingPreference = await this.getClientPaymentPreference(clientId);

      if (existingPreference) {
        await this.prisma.clientPaymentPreference.update({
          where: { clientId },
          data: {
            preferredMethods: preference.preferredMethods || existingPreference.preferredMethods,
            defaultMethod: preference.defaultMethod || existingPreference.defaultMethod,
            lastUsed: new Date(),
          },
        });
      } else {
        await this.prisma.clientPaymentPreference.create({
          data: {
            clientId,
            preferredMethods: preference.preferredMethods || [],
            defaultMethod: preference.defaultMethod || PaymentMethod.ALIPAY,
            lastUsed: new Date(),
          },
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to update client payment preference:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Record payment method usage
  async recordPaymentMethodUsage(
    clientId: string,
    method: PaymentMethod,
    amount: number
  ): Promise<void> {
    try {
      // Update last used in preference
      await this.prisma.clientPaymentPreference.updateMany({
        where: { clientId },
        data: { lastUsed: new Date() },
      });

      // Record usage statistics
      await this.prisma.paymentMethodUsage.create({
        data: {
          clientId,
          method,
          amount,
          usedAt: new Date(),
        },
      });

      // Update client's preferred methods based on usage
      await this.updatePreferredMethodsBasedOnUsage(clientId);
    } catch (error) {
      console.error('Failed to record payment method usage:', error);
    }
  }

  // Get payment method statistics
  async getPaymentMethodStatistics(): Promise<any> {
    try {
      const stats = await this.prisma.paymentMethodUsage.groupBy({
        by: ['method'],
        _count: { id: true },
        _sum: { amount: true },
        _avg: { amount: true },
        orderBy: { _count: { id: 'desc' } },
      });

      return stats.map(stat => ({
        method: stat.method,
        usageCount: stat._count.id,
        totalAmount: stat._sum.amount || 0,
        averageAmount: stat._avg.amount || 0,
      }));
    } catch (error) {
      console.error('Failed to get payment method statistics:', error);
      throw error;
    }
  }

  // Get popular payment methods
  async getPopularPaymentMethods(limit: number = 5): Promise<PaymentMethod[]> {
    try {
      const stats = await this.getPaymentMethodStatistics();
      return stats.slice(0, limit).map(stat => stat.method);
    } catch (error) {
      console.error('Failed to get popular payment methods:', error);
      return [];
    }
  }

  // Get recommended payment methods for client
  async getRecommendedPaymentMethods(clientId: string): Promise<PaymentMethod[]> {
    try {
      const preference = await this.getClientPaymentPreference(clientId);
      const popularMethods = await this.getPopularPaymentMethods(3);

      if (preference) {
        // Combine client preference with popular methods
        const recommended = [...preference.preferredMethods];
        
        // Add popular methods not already in preference
        for (const method of popularMethods) {
          if (!recommended.includes(method)) {
            recommended.push(method);
          }
        }

        return recommended.slice(0, 5); // Return top 5 recommendations
      }

      return popularMethods;
    } catch (error) {
      console.error('Failed to get recommended payment methods:', error);
      return [];
    }
  }

  // Check if payment method supports specific features
  supportsFeature(method: PaymentMethod, feature: string): boolean {
    const features = this.getPaymentMethodFeatures(method);
    return features[feature as keyof typeof features] || false;
  }

  // Calculate payment fees
  calculatePaymentFee(method: PaymentMethod, amount: number): number {
    const methodConfig = this.config.supportedGateways[method.toLowerCase()];
    let fee = 0;

    if (methodConfig.feePercentage) {
      fee += amount * (methodConfig.feePercentage / 100);
    }

    if (methodConfig.feeFixed) {
      fee += methodConfig.feeFixed;
    }

    return fee;
  }

  // Get estimated processing time
  getEstimatedProcessingTime(method: PaymentMethod): { min: number; max: number } {
    return this.getPaymentMethodProcessingTime(method);
  }

  // Helper methods
  private getPaymentMethodDisplayName(method: PaymentMethod): string {
    const displayNames = {
      [PaymentMethod.ALIPAY]: '支付宝',
      [PaymentMethod.WECHAT_PAY]: '微信支付',
      [PaymentMethod.BANK_TRANSFER]: '银行转账',
      [PaymentMethod.CASH]: '现金',
      [PaymentMethod.CREDIT_CARD]: '信用卡',
      [PaymentMethod.CHECK]: '支票',
      [PaymentMethod.OTHER]: '其他',
    };
    return displayNames[method] || method;
  }

  private getPaymentMethodDescription(method: PaymentMethod): string {
    const descriptions = {
      [PaymentMethod.ALIPAY]: '快速安全的在线支付方式',
      [PaymentMethod.WECHAT_PAY]: '便捷的移动支付解决方案',
      [PaymentMethod.BANK_TRANSFER]: '传统的银行转账方式',
      [PaymentMethod.CASH]: '现金支付',
      [PaymentMethod.CREDIT_CARD]: '信用卡支付',
      [PaymentMethod.CHECK]: '支票支付',
      [PaymentMethod.OTHER]: '其他支付方式',
    };
    return descriptions[method] || '';
  }

  private getPaymentMethodProcessingTime(method: PaymentMethod): { min: number; max: number } {
    const processingTimes = {
      [PaymentMethod.ALIPAY]: { min: 1, max: 5 },
      [PaymentMethod.WECHAT_PAY]: { min: 1, max: 3 },
      [PaymentMethod.BANK_TRANSFER]: { min: 60, max: 1440 }, // 1 hour to 24 hours
      [PaymentMethod.CASH]: { min: 0, max: 0 },
      [PaymentMethod.CREDIT_CARD]: { min: 1, max: 10 },
      [PaymentMethod.CHECK]: { min: 1440, max: 4320 }, // 1-3 days
      [PaymentMethod.OTHER]: { min: 10, max: 60 },
    };
    return processingTimes[method] || { min: 10, max: 60 };
  }

  private getSupportedCurrencies(method: PaymentMethod): string[] {
    const currencies = {
      [PaymentMethod.ALIPAY]: ['CNY'],
      [PaymentMethod.WECHAT_PAY]: ['CNY'],
      [PaymentMethod.BANK_TRANSFER]: ['CNY', 'USD', 'EUR', 'GBP'],
      [PaymentMethod.CASH]: ['CNY', 'USD', 'EUR', 'GBP'],
      [PaymentMethod.CREDIT_CARD]: ['CNY', 'USD', 'EUR', 'GBP'],
      [PaymentMethod.CHECK]: ['CNY', 'USD', 'EUR', 'GBP'],
      [PaymentMethod.OTHER]: ['CNY', 'USD', 'EUR', 'GBP'],
    };
    return currencies[method] || ['CNY'];
  }

  private getSupportedCountries(method: PaymentMethod): string[] {
    const countries = {
      [PaymentMethod.ALIPAY]: ['CN'],
      [PaymentMethod.WECHAT_PAY]: ['CN'],
      [PaymentMethod.BANK_TRANSFER]: ['CN', 'US', 'EU', 'GB'],
      [PaymentMethod.CASH]: ['CN', 'US', 'EU', 'GB'],
      [PaymentMethod.CREDIT_CARD]: ['CN', 'US', 'EU', 'GB'],
      [PaymentMethod.CHECK]: ['CN', 'US', 'EU', 'GB'],
      [PaymentMethod.OTHER]: ['CN', 'US', 'EU', 'GB'],
    };
    return countries[method] || ['CN'];
  }

  private getPaymentMethodFeatures(method: PaymentMethod) {
    const features = {
      [PaymentMethod.ALIPAY]: {
        instant: true,
        refundable: true,
        recurring: false,
        qrCode: true,
        mobilePayment: true,
      },
      [PaymentMethod.WECHAT_PAY]: {
        instant: true,
        refundable: true,
        recurring: false,
        qrCode: true,
        mobilePayment: true,
      },
      [PaymentMethod.BANK_TRANSFER]: {
        instant: false,
        refundable: true,
        recurring: true,
        qrCode: false,
        mobilePayment: false,
      },
      [PaymentMethod.CASH]: {
        instant: true,
        refundable: false,
        recurring: false,
        qrCode: false,
        mobilePayment: false,
      },
      [PaymentMethod.CREDIT_CARD]: {
        instant: true,
        refundable: true,
        recurring: true,
        qrCode: false,
        mobilePayment: true,
      },
      [PaymentMethod.CHECK]: {
        instant: false,
        refundable: true,
        recurring: false,
        qrCode: false,
        mobilePayment: false,
      },
      [PaymentMethod.OTHER]: {
        instant: false,
        refundable: false,
        recurring: false,
        qrCode: false,
        mobilePayment: false,
      },
    };
    return features[method] || features[PaymentMethod.OTHER];
  }

  private async checkClientLimits(
    clientId: string,
    method: PaymentMethod,
    amount: number
  ): Promise<{ valid: boolean; reason?: string }> {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [dayUsage, monthUsage] = await Promise.all([
        this.prisma.paymentMethodUsage.aggregate({
          where: {
            clientId,
            method,
            usedAt: { gte: startOfDay },
          },
          _sum: { amount: true },
        }),
        this.prisma.paymentMethodUsage.aggregate({
          where: {
            clientId,
            method,
            usedAt: { gte: startOfMonth },
          },
          _sum: { amount: true },
        }),
      ]);

      const methodConfig = await this.getPaymentMethodConfig(method);
      const dayTotal = dayUsage._sum.amount || 0;
      const monthTotal = monthUsage._sum.amount || 0;

      if (methodConfig.limits.dailyLimit && dayTotal + amount > methodConfig.limits.dailyLimit) {
        return {
          valid: false,
          reason: `Daily limit of ${methodConfig.limits.dailyLimit} would be exceeded`,
        };
      }

      if (methodConfig.limits.monthlyLimit && monthTotal + amount > methodConfig.limits.monthlyLimit) {
        return {
          valid: false,
          reason: `Monthly limit of ${methodConfig.limits.monthlyLimit} would be exceeded`,
        };
      }

      return { valid: true };
    } catch (error) {
      console.error('Failed to check client limits:', error);
      return {
        valid: false,
        reason: 'Failed to check limits due to internal error',
      };
    }
  }

  private async updatePreferredMethodsBasedOnUsage(clientId: string): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const usageStats = await this.prisma.paymentMethodUsage.groupBy({
        by: ['method'],
        where: {
          clientId,
          usedAt: { gte: thirtyDaysAgo },
        },
        _count: { id: true },
        _sum: { amount: true },
        orderBy: { _count: { id: 'desc' } },
        take: 3,
      });

      const preferredMethods = usageStats.map(stat => stat.method as PaymentMethod);
      const defaultMethod = preferredMethods[0] || PaymentMethod.ALIPAY;

      await this.updateClientPaymentPreference(clientId, {
        preferredMethods,
        defaultMethod,
      });
    } catch (error) {
      console.error('Failed to update preferred methods based on usage:', error);
    }
  }
}