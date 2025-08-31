"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentMethodManager = void 0;
const financial_1 = require("../models/financial");
const PaymentGatewayService_1 = require("./PaymentGatewayService");
const financial_2 = require("../../config/financial");
class PaymentMethodManager {
    constructor(prisma) {
        this.config = (0, financial_2.getPaymentConfig)();
        this.prisma = prisma;
        this.gatewayService = new PaymentGatewayService_1.PaymentGatewayService(prisma);
    }
    async getAvailablePaymentMethods(clientId) {
        try {
            const supportedMethods = this.gatewayService.getSupportedPaymentMethods();
            const paymentMethods = [];
            let clientPreference = null;
            if (clientId) {
                clientPreference = await this.getClientPaymentPreference(clientId);
            }
            for (const method of supportedMethods) {
                const methodConfig = await this.getPaymentMethodConfig(method);
                if (methodConfig.enabled) {
                    paymentMethods.push(methodConfig);
                }
            }
            if (clientPreference) {
                paymentMethods.sort((a, b) => {
                    const aIndex = clientPreference.preferredMethods.indexOf(a.method);
                    const bIndex = clientPreference.preferredMethods.indexOf(b.method);
                    if (aIndex === -1 && bIndex === -1)
                        return 0;
                    if (aIndex === -1)
                        return 1;
                    if (bIndex === -1)
                        return -1;
                    return aIndex - bIndex;
                });
            }
            return {
                success: true,
                paymentMethods,
                message: 'Payment methods retrieved successfully',
            };
        }
        catch (error) {
            console.error('Failed to get available payment methods:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async getPaymentMethodConfig(method) {
        const gatewayConfig = this.config.supportedGateways[method.toLowerCase()];
        const processingConfig = this.config.processing;
        const baseConfig = {
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
        switch (method) {
            case financial_1.PaymentMethod.ALIPAY:
                return {
                    ...baseConfig,
                    icon: 'alipay',
                    color: '#1677FF',
                };
            case financial_1.PaymentMethod.WECHAT_PAY:
                return {
                    ...baseConfig,
                    icon: 'wechat',
                    color: '#07C160',
                };
            case financial_1.PaymentMethod.BANK_TRANSFER:
                return {
                    ...baseConfig,
                    icon: 'bank',
                    color: '#666666',
                };
            default:
                return baseConfig;
        }
    }
    async validatePaymentMethod(method, amount, currency, clientId) {
        try {
            if (!this.gatewayService.validatePaymentMethod(method)) {
                return {
                    valid: false,
                    reason: 'Payment method is not supported',
                };
            }
            const methodConfig = await this.getPaymentMethodConfig(method);
            if (!methodConfig.enabled) {
                return {
                    valid: false,
                    reason: 'Payment method is currently disabled',
                };
            }
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
            if (!methodConfig.supportedCurrencies.includes(currency)) {
                return {
                    valid: false,
                    reason: `Currency ${currency} is not supported by this payment method`,
                };
            }
            if (clientId) {
                const limitsCheck = await this.checkClientLimits(clientId, method, amount);
                if (!limitsCheck.valid) {
                    return limitsCheck;
                }
            }
            return { valid: true };
        }
        catch (error) {
            console.error('Payment method validation failed:', error);
            return {
                valid: false,
                reason: 'Validation failed due to internal error',
            };
        }
    }
    async getClientPaymentPreference(clientId) {
        try {
            const preference = await this.prisma.clientPaymentPreference.findUnique({
                where: { clientId },
            });
            if (!preference) {
                return null;
            }
            return {
                clientId: preference.clientId,
                preferredMethods: preference.preferredMethods,
                defaultMethod: preference.defaultMethod,
                lastUsed: preference.lastUsed,
            };
        }
        catch (error) {
            console.error('Failed to get client payment preference:', error);
            return null;
        }
    }
    async updateClientPaymentPreference(clientId, preference) {
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
            }
            else {
                await this.prisma.clientPaymentPreference.create({
                    data: {
                        clientId,
                        preferredMethods: preference.preferredMethods || [],
                        defaultMethod: preference.defaultMethod || financial_1.PaymentMethod.ALIPAY,
                        lastUsed: new Date(),
                    },
                });
            }
            return { success: true };
        }
        catch (error) {
            console.error('Failed to update client payment preference:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async recordPaymentMethodUsage(clientId, method, amount) {
        try {
            await this.prisma.clientPaymentPreference.updateMany({
                where: { clientId },
                data: { lastUsed: new Date() },
            });
            await this.prisma.paymentMethodUsage.create({
                data: {
                    clientId,
                    method,
                    amount,
                    usedAt: new Date(),
                },
            });
            await this.updatePreferredMethodsBasedOnUsage(clientId);
        }
        catch (error) {
            console.error('Failed to record payment method usage:', error);
        }
    }
    async getPaymentMethodStatistics() {
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
        }
        catch (error) {
            console.error('Failed to get payment method statistics:', error);
            throw error;
        }
    }
    async getPopularPaymentMethods(limit = 5) {
        try {
            const stats = await this.getPaymentMethodStatistics();
            return stats.slice(0, limit).map(stat => stat.method);
        }
        catch (error) {
            console.error('Failed to get popular payment methods:', error);
            return [];
        }
    }
    async getRecommendedPaymentMethods(clientId) {
        try {
            const preference = await this.getClientPaymentPreference(clientId);
            const popularMethods = await this.getPopularPaymentMethods(3);
            if (preference) {
                const recommended = [...preference.preferredMethods];
                for (const method of popularMethods) {
                    if (!recommended.includes(method)) {
                        recommended.push(method);
                    }
                }
                return recommended.slice(0, 5);
            }
            return popularMethods;
        }
        catch (error) {
            console.error('Failed to get recommended payment methods:', error);
            return [];
        }
    }
    supportsFeature(method, feature) {
        const features = this.getPaymentMethodFeatures(method);
        return features[feature] || false;
    }
    calculatePaymentFee(method, amount) {
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
    getEstimatedProcessingTime(method) {
        return this.getPaymentMethodProcessingTime(method);
    }
    getPaymentMethodDisplayName(method) {
        const displayNames = {
            [financial_1.PaymentMethod.ALIPAY]: '支付宝',
            [financial_1.PaymentMethod.WECHAT_PAY]: '微信支付',
            [financial_1.PaymentMethod.BANK_TRANSFER]: '银行转账',
            [financial_1.PaymentMethod.CASH]: '现金',
            [financial_1.PaymentMethod.CREDIT_CARD]: '信用卡',
            [financial_1.PaymentMethod.CHECK]: '支票',
            [financial_1.PaymentMethod.OTHER]: '其他',
        };
        return displayNames[method] || method;
    }
    getPaymentMethodDescription(method) {
        const descriptions = {
            [financial_1.PaymentMethod.ALIPAY]: '快速安全的在线支付方式',
            [financial_1.PaymentMethod.WECHAT_PAY]: '便捷的移动支付解决方案',
            [financial_1.PaymentMethod.BANK_TRANSFER]: '传统的银行转账方式',
            [financial_1.PaymentMethod.CASH]: '现金支付',
            [financial_1.PaymentMethod.CREDIT_CARD]: '信用卡支付',
            [financial_1.PaymentMethod.CHECK]: '支票支付',
            [financial_1.PaymentMethod.OTHER]: '其他支付方式',
        };
        return descriptions[method] || '';
    }
    getPaymentMethodProcessingTime(method) {
        const processingTimes = {
            [financial_1.PaymentMethod.ALIPAY]: { min: 1, max: 5 },
            [financial_1.PaymentMethod.WECHAT_PAY]: { min: 1, max: 3 },
            [financial_1.PaymentMethod.BANK_TRANSFER]: { min: 60, max: 1440 },
            [financial_1.PaymentMethod.CASH]: { min: 0, max: 0 },
            [financial_1.PaymentMethod.CREDIT_CARD]: { min: 1, max: 10 },
            [financial_1.PaymentMethod.CHECK]: { min: 1440, max: 4320 },
            [financial_1.PaymentMethod.OTHER]: { min: 10, max: 60 },
        };
        return processingTimes[method] || { min: 10, max: 60 };
    }
    getSupportedCurrencies(method) {
        const currencies = {
            [financial_1.PaymentMethod.ALIPAY]: ['CNY'],
            [financial_1.PaymentMethod.WECHAT_PAY]: ['CNY'],
            [financial_1.PaymentMethod.BANK_TRANSFER]: ['CNY', 'USD', 'EUR', 'GBP'],
            [financial_1.PaymentMethod.CASH]: ['CNY', 'USD', 'EUR', 'GBP'],
            [financial_1.PaymentMethod.CREDIT_CARD]: ['CNY', 'USD', 'EUR', 'GBP'],
            [financial_1.PaymentMethod.CHECK]: ['CNY', 'USD', 'EUR', 'GBP'],
            [financial_1.PaymentMethod.OTHER]: ['CNY', 'USD', 'EUR', 'GBP'],
        };
        return currencies[method] || ['CNY'];
    }
    getSupportedCountries(method) {
        const countries = {
            [financial_1.PaymentMethod.ALIPAY]: ['CN'],
            [financial_1.PaymentMethod.WECHAT_PAY]: ['CN'],
            [financial_1.PaymentMethod.BANK_TRANSFER]: ['CN', 'US', 'EU', 'GB'],
            [financial_1.PaymentMethod.CASH]: ['CN', 'US', 'EU', 'GB'],
            [financial_1.PaymentMethod.CREDIT_CARD]: ['CN', 'US', 'EU', 'GB'],
            [financial_1.PaymentMethod.CHECK]: ['CN', 'US', 'EU', 'GB'],
            [financial_1.PaymentMethod.OTHER]: ['CN', 'US', 'EU', 'GB'],
        };
        return countries[method] || ['CN'];
    }
    getPaymentMethodFeatures(method) {
        const features = {
            [financial_1.PaymentMethod.ALIPAY]: {
                instant: true,
                refundable: true,
                recurring: false,
                qrCode: true,
                mobilePayment: true,
            },
            [financial_1.PaymentMethod.WECHAT_PAY]: {
                instant: true,
                refundable: true,
                recurring: false,
                qrCode: true,
                mobilePayment: true,
            },
            [financial_1.PaymentMethod.BANK_TRANSFER]: {
                instant: false,
                refundable: true,
                recurring: true,
                qrCode: false,
                mobilePayment: false,
            },
            [financial_1.PaymentMethod.CASH]: {
                instant: true,
                refundable: false,
                recurring: false,
                qrCode: false,
                mobilePayment: false,
            },
            [financial_1.PaymentMethod.CREDIT_CARD]: {
                instant: true,
                refundable: true,
                recurring: true,
                qrCode: false,
                mobilePayment: true,
            },
            [financial_1.PaymentMethod.CHECK]: {
                instant: false,
                refundable: true,
                recurring: false,
                qrCode: false,
                mobilePayment: false,
            },
            [financial_1.PaymentMethod.OTHER]: {
                instant: false,
                refundable: false,
                recurring: false,
                qrCode: false,
                mobilePayment: false,
            },
        };
        return features[method] || features[financial_1.PaymentMethod.OTHER];
    }
    async checkClientLimits(clientId, method, amount) {
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
        }
        catch (error) {
            console.error('Failed to check client limits:', error);
            return {
                valid: false,
                reason: 'Failed to check limits due to internal error',
            };
        }
    }
    async updatePreferredMethodsBasedOnUsage(clientId) {
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
            const preferredMethods = usageStats.map(stat => stat.method);
            const defaultMethod = preferredMethods[0] || financial_1.PaymentMethod.ALIPAY;
            await this.updateClientPaymentPreference(clientId, {
                preferredMethods,
                defaultMethod,
            });
        }
        catch (error) {
            console.error('Failed to update preferred methods based on usage:', error);
        }
    }
}
exports.PaymentMethodManager = PaymentMethodManager;
//# sourceMappingURL=PaymentMethodManager.js.map