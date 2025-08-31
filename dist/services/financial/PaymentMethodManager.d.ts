import { PrismaClient } from '@prisma/client';
import { PaymentMethod } from '../models/financial';
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
        min: number;
        max: number;
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
export declare class PaymentMethodManager {
    private prisma;
    private gatewayService;
    private config;
    constructor(prisma: PrismaClient);
    getAvailablePaymentMethods(clientId?: string): Promise<PaymentMethodResponse>;
    getPaymentMethodConfig(method: PaymentMethod): Promise<PaymentMethodConfig>;
    validatePaymentMethod(method: PaymentMethod, amount: number, currency: string, clientId?: string): Promise<{
        valid: boolean;
        reason?: string;
    }>;
    getClientPaymentPreference(clientId: string): Promise<PaymentPreference | null>;
    updateClientPaymentPreference(clientId: string, preference: Partial<PaymentPreference>): Promise<{
        success: boolean;
        error?: string;
    }>;
    recordPaymentMethodUsage(clientId: string, method: PaymentMethod, amount: number): Promise<void>;
    getPaymentMethodStatistics(): Promise<any>;
    getPopularPaymentMethods(limit?: number): Promise<PaymentMethod[]>;
    getRecommendedPaymentMethods(clientId: string): Promise<PaymentMethod[]>;
    supportsFeature(method: PaymentMethod, feature: string): boolean;
    calculatePaymentFee(method: PaymentMethod, amount: number): number;
    getEstimatedProcessingTime(method: PaymentMethod): {
        min: number;
        max: number;
    };
    private getPaymentMethodDisplayName;
    private getPaymentMethodDescription;
    private getPaymentMethodProcessingTime;
    private getSupportedCurrencies;
    private getSupportedCountries;
    private getPaymentMethodFeatures;
    private checkClientLimits;
    private updatePreferredMethodsBasedOnUsage;
}
//# sourceMappingURL=PaymentMethodManager.d.ts.map