import { PrismaClient } from '@prisma/client';
import { FeeType, TimeEntry, Expense } from '../models/financial';
export interface FeeCalculationRequest {
    feeType: FeeType;
    caseType: string;
    jurisdiction: 'local' | 'provincial' | 'national';
    complexity: 'simple' | 'medium' | 'complex';
    urgency: 'normal' | 'urgent' | 'expedited';
    currency: string;
    parameters: {
        hours?: number;
        rate?: number;
        settlementAmount?: number;
        baseAmount?: number;
        percentage?: number;
        minimum?: number;
        maximum?: number;
        successFee?: number;
    };
}
export interface FeeCalculationResult {
    baseFee: number;
    complexityMultiplier: number;
    urgencyMultiplier: number;
    jurisdictionMultiplier: number;
    finalFee: number;
    taxAmount: number;
    totalWithTax: number;
    breakdown: {
        calculationSteps: string[];
        adjustments: any[];
        compliance: any;
    };
    currency: string;
}
export interface CurrencyConversion {
    fromCurrency: string;
    toCurrency: string;
    amount: number;
    convertedAmount: number;
    exchangeRate: number;
    timestamp: Date;
}
export interface TaxCalculation {
    amount: number;
    currency: string;
    taxRate: number;
    taxAmount: number;
    taxType: 'VAT' | 'SERVICE_TAX' | 'INCOME_TAX' | 'OTHER';
    jurisdiction: string;
}
export declare class FeeCalculationService {
    private prisma;
    private exchangeRates;
    constructor(prisma: PrismaClient);
    calculateFee(request: FeeCalculationRequest): Promise<FeeCalculationResult>;
    calculateTimeEntryFees(timeEntries: TimeEntry[]): Promise<{
        totalHours: number;
        totalAmount: number;
        averageRate: number;
        breakdown: TimeEntry[];
        currency: string;
    }>;
    calculateExpenseFees(expenses: Expense[]): Promise<{
        totalExpenses: number;
        billableExpenses: number;
        nonBillableExpenses: number;
        breakdown: Expense[];
        currency: string;
    }>;
    calculateContingencyFee(settlementAmount: number, percentage: number, caseType: string, jurisdiction: string): Promise<{
        baseFee: number;
        maximumAllowedFee: number;
        requiresCourtApproval: boolean;
        finalFee: number;
        breakdown: any;
    }>;
    calculateRetainerFee(caseType: string, complexity: string, estimatedDuration: number, currency: string): Promise<{
        monthlyRetainer: number;
        totalRetainer: number;
        refundableAmount: number;
        breakdown: any;
    }>;
    convertCurrency(conversion: CurrencyConversion): Promise<CurrencyConversion>;
    calculateMultiCurrencyFee(request: FeeCalculationRequest, targetCurrency: string): Promise<{
        originalResult: FeeCalculationResult;
        convertedResult: FeeCalculationResult;
        conversion: CurrencyConversion;
    }>;
    getCaseFeeEstimation(caseId: string): Promise<{
        estimatedRange: {
            minimum: number;
            maximum: number;
            currency: string;
        };
        breakdown: {
            byPhase: any[];
            byFeeType: any[];
        };
        assumptions: string[];
    }>;
    private validateFeeCalculationRequest;
    private calculateBaseFee;
    private calculateHybridFee;
    private getComplexityMultiplier;
    private getUrgencyMultiplier;
    private getJurisdictionMultiplier;
    private applyMinMaxConstraints;
    private calculateTax;
    private getTaxRate;
    private generateBreakdown;
    private checkMinimumWageCompliance;
    private checkLegalLimits;
    private getContingencyFeeLimits;
    private getRetainerBaseRates;
    private getExchangeRate;
    private initializeExchangeRates;
    private groupByPhase;
    private groupByFeeType;
}
//# sourceMappingURL=FeeCalculationService.d.ts.map