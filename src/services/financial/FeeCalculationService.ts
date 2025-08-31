import { PrismaClient } from '@prisma/client';
import { 
  FeeType,
  FeeStructure,
  TimeEntry,
  Expense,
  Invoice,
  InvoiceItem
} from '../models/financial';

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

export class FeeCalculationService {
  private prisma: PrismaClient;
  private exchangeRates: Map<string, number> = new Map();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.initializeExchangeRates();
  }

  // Main fee calculation method
  async calculateFee(request: FeeCalculationRequest): Promise<FeeCalculationResult> {
    // Validate input
    this.validateFeeCalculationRequest(request);

    // Get base fee calculation
    const baseFee = await this.calculateBaseFee(request);

    // Apply multipliers
    const complexityMultiplier = this.getComplexityMultiplier(request.complexity);
    const urgencyMultiplier = this.getUrgencyMultiplier(request.urgency);
    const jurisdictionMultiplier = this.getJurisdictionMultiplier(request.jurisdiction);

    // Calculate final fee
    const adjustedFee = baseFee * complexityMultiplier * urgencyMultiplier * jurisdictionMultiplier;
    
    // Apply minimum/maximum constraints
    const finalFee = this.applyMinMaxConstraints(adjustedFee, request.parameters);

    // Calculate tax
    const taxCalculation = await this.calculateTax(finalFee, request.currency, request.jurisdiction);
    const totalWithTax = finalFee + taxCalculation.taxAmount;

    // Generate breakdown
    const breakdown = this.generateBreakdown(
      baseFee,
      complexityMultiplier,
      urgencyMultiplier,
      jurisdictionMultiplier,
      finalFee,
      taxCalculation,
      request
    );

    return {
      baseFee,
      complexityMultiplier,
      urgencyMultiplier,
      jurisdictionMultiplier,
      finalFee,
      taxAmount: taxCalculation.taxAmount,
      totalWithTax,
      breakdown,
      currency: request.currency,
    };
  }

  // Calculate fee for time entries
  async calculateTimeEntryFees(timeEntries: TimeEntry[]): Promise<{
    totalHours: number;
    totalAmount: number;
    averageRate: number;
    breakdown: TimeEntry[];
    currency: string;
  }> {
    if (timeEntries.length === 0) {
      return {
        totalHours: 0,
        totalAmount: 0,
        averageRate: 0,
        breakdown: [],
        currency: 'CNY',
      };
    }

    const totalHours = timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const totalAmount = timeEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const averageRate = totalHours > 0 ? totalAmount / totalHours : 0;
    const currency = timeEntries[0].currency || 'CNY';

    return {
      totalHours,
      totalAmount,
      averageRate,
      breakdown: timeEntries,
      currency,
    };
  }

  // Calculate fee for expenses
  async calculateExpenseFees(expenses: Expense[]): Promise<{
    totalExpenses: number;
    billableExpenses: number;
    nonBillableExpenses: number;
    breakdown: Expense[];
    currency: string;
  }> {
    if (expenses.length === 0) {
      return {
        totalExpenses: 0,
        billableExpenses: 0,
        nonBillableExpenses: 0,
        breakdown: [],
        currency: 'CNY',
      };
    }

    const billableExpenses = expenses.filter(e => e.isBillable);
    const nonBillableExpenses = expenses.filter(e => !e.isBillable);

    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const billableAmount = billableExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const nonBillableAmount = nonBillableExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const currency = expenses[0].currency || 'CNY';

    return {
      totalExpenses,
      billableExpenses: billableAmount,
      nonBillableExpenses: nonBillableAmount,
      breakdown: expenses,
      currency,
    };
  }

  // Calculate fee for contingency cases
  async calculateContingencyFee(
    settlementAmount: number,
    percentage: number,
    caseType: string,
    jurisdiction: string
  ): Promise<{
    baseFee: number;
    maximumAllowedFee: number;
    requiresCourtApproval: boolean;
    finalFee: number;
    breakdown: any;
  }> {
    // Get legal limits for contingency fees based on jurisdiction
    const legalLimits = this.getContingencyFeeLimits(caseType, jurisdiction);
    
    // Calculate base contingency fee
    const baseFee = settlementAmount * (percentage / 100);
    
    // Apply legal limits
    let finalFee = baseFee;
    if (percentage > legalLimits.maximumPercentage) {
      finalFee = settlementAmount * (legalLimits.maximumPercentage / 100);
    }

    // Check if court approval is required
    const requiresCourtApproval = settlementAmount > legalLimits.courtApprovalThreshold;

    return {
      baseFee,
      maximumAllowedFee: settlementAmount * (legalLimits.maximumPercentage / 100),
      requiresCourtApproval,
      finalFee,
      breakdown: {
        settlementAmount,
        requestedPercentage: percentage,
        legalLimitPercentage: legalLimits.maximumPercentage,
        appliedPercentage: Math.min(percentage, legalLimits.maximumPercentage),
        courtApprovalRequired: requiresCourtApproval,
      },
    };
  }

  // Calculate retainer fees
  async calculateRetainerFee(
    caseType: string,
    complexity: string,
    estimatedDuration: number,
    currency: string
  ): Promise<{
    monthlyRetainer: number;
    totalRetainer: number;
    refundableAmount: number;
    breakdown: any;
  }> {
    // Get base retainer rates
    const baseRates = this.getRetainerBaseRates(caseType);
    const complexityMultiplier = this.getComplexityMultiplier(complexity as any);
    
    // Calculate monthly retainer
    const monthlyRetainer = baseRates.monthlyRate * complexityMultiplier;
    const totalRetainer = monthlyRetainer * estimatedDuration;
    
    // Calculate refundable amount (Chinese law requires retainers to be refundable)
    const refundableAmount = totalRetainer * 0.8; // 80% refundable

    return {
      monthlyRetainer,
      totalRetainer,
      refundableAmount,
      breakdown: {
        baseMonthlyRate: baseRates.monthlyRate,
        complexityMultiplier,
        estimatedDuration,
        refundablePercentage: 80,
      },
    };
  }

  // Currency conversion
  async convertCurrency(conversion: CurrencyConversion): Promise<CurrencyConversion> {
    const exchangeRate = await this.getExchangeRate(conversion.fromCurrency, conversion.toCurrency);
    const convertedAmount = conversion.amount * exchangeRate;

    return {
      ...conversion,
      convertedAmount,
      exchangeRate,
      timestamp: new Date(),
    };
  }

  // Multi-currency fee calculation
  async calculateMultiCurrencyFee(
    request: FeeCalculationRequest,
    targetCurrency: string
  ): Promise<{
    originalResult: FeeCalculationResult;
    convertedResult: FeeCalculationResult;
    conversion: CurrencyConversion;
  }> {
    // Calculate fee in original currency
    const originalResult = await this.calculateFee(request);

    // Convert to target currency
    const conversion = await this.convertCurrency({
      fromCurrency: request.currency,
      toCurrency: targetCurrency,
      amount: originalResult.finalFee,
    });

    // Calculate tax in target currency
    const convertedTax = await this.calculateTax(conversion.convertedAmount, targetCurrency, request.jurisdiction);

    const convertedResult: FeeCalculationResult = {
      baseFee: conversion.convertedAmount / (originalResult.finalFee / originalResult.baseFee),
      complexityMultiplier: originalResult.complexityMultiplier,
      urgencyMultiplier: originalResult.urgencyMultiplier,
      jurisdictionMultiplier: originalResult.jurisdictionMultiplier,
      finalFee: conversion.convertedAmount,
      taxAmount: convertedTax.taxAmount,
      totalWithTax: conversion.convertedAmount + convertedTax.taxAmount,
      breakdown: {
        calculationSteps: originalResult.breakdown.calculationSteps,
        adjustments: originalResult.breakdown.adjustments,
        compliance: originalResult.breakdown.compliance,
      },
      currency: targetCurrency,
    };

    return {
      originalResult,
      convertedResult,
      conversion,
    };
  }

  // Get fee estimation for case
  async getCaseFeeEstimation(caseId: string): Promise<{
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
  }> {
    const caseData = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: {
        billingNodes: true,
        timeEntries: true,
        expenses: true,
      },
    });

    if (!caseData) {
      throw new Error('Case not found');
    }

    // Calculate estimated range based on case data
    const billingNodesTotal = caseData.billingNodes.reduce((sum, node) => sum + node.amount, 0);
    const timeEntriesTotal = caseData.timeEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const expensesTotal = caseData.expenses.reduce((sum, expense) => sum + expense.amount, 0);

    const baseTotal = billingNodesTotal + timeEntriesTotal + expensesTotal;
    const minimum = baseTotal * 0.8; // 20% buffer
    const maximum = baseTotal * 1.5; // 50% buffer

    return {
      estimatedRange: {
        minimum,
        maximum,
        currency: 'CNY',
      },
      breakdown: {
        byPhase: this.groupByPhase(caseData.billingNodes),
        byFeeType: this.groupByFeeType(caseData.billingNodes),
      },
      assumptions: [
        'Based on current billing nodes and time entries',
        'Excludes potential unexpected developments',
        'Subject to change based on case complexity',
      ],
    };
  }

  // Helper methods
  private validateFeeCalculationRequest(request: FeeCalculationRequest): void {
    if (!request.feeType) {
      throw new Error('Fee type is required');
    }

    if (!request.caseType) {
      throw new Error('Case type is required');
    }

    if (!request.currency) {
      throw new Error('Currency is required');
    }

    // Validate parameters based on fee type
    switch (request.feeType) {
      case FeeType.HOURLY:
        if (!request.parameters.hours || !request.parameters.rate) {
          throw new Error('Hours and rate are required for hourly fees');
        }
        break;
      case FeeType.FLAT:
        if (!request.parameters.baseAmount) {
          throw new Error('Base amount is required for flat fees');
        }
        break;
      case FeeType.CONTINGENCY:
        if (!request.parameters.settlementAmount || !request.parameters.percentage) {
          throw new Error('Settlement amount and percentage are required for contingency fees');
        }
        break;
      case FeeType.RETAINER:
        if (!request.parameters.baseAmount) {
          throw new Error('Base amount is required for retainer fees');
        }
        break;
    }
  }

  private async calculateBaseFee(request: FeeCalculationRequest): Promise<number> {
    switch (request.feeType) {
      case FeeType.HOURLY:
        return request.parameters.hours! * request.parameters.rate!;
      case FeeType.FLAT:
        return request.parameters.baseAmount!;
      case FeeType.CONTINGENCY:
        return request.parameters.settlementAmount! * (request.parameters.percentage! / 100);
      case FeeType.RETAINER:
        return request.parameters.baseAmount!;
      case FeeType.HYBRID:
        return this.calculateHybridFee(request.parameters);
      default:
        throw new Error(`Unsupported fee type: ${request.feeType}`);
    }
  }

  private calculateHybridFee(parameters: any): number {
    let total = 0;
    
    if (parameters.hours && parameters.rate) {
      total += parameters.hours * parameters.rate;
    }
    
    if (parameters.settlementAmount && parameters.percentage) {
      total += parameters.settlementAmount * (parameters.percentage / 100);
    }
    
    if (parameters.successFee) {
      total += parameters.successFee;
    }
    
    return total;
  }

  private getComplexityMultiplier(complexity: string): number {
    const multipliers: Record<string, number> = {
      simple: 1.0,
      medium: 1.3,
      complex: 1.8,
    };
    return multipliers[complexity] || 1.0;
  }

  private getUrgencyMultiplier(urgency: string): number {
    const multipliers: Record<string, number> = {
      normal: 1.0,
      urgent: 1.2,
      expedited: 1.5,
    };
    return multipliers[urgency] || 1.0;
  }

  private getJurisdictionMultiplier(jurisdiction: string): number {
    const multipliers: Record<string, number> = {
      local: 1.0,
      provincial: 1.2,
      national: 1.5,
    };
    return multipliers[jurisdiction] || 1.0;
  }

  private applyMinMaxConstraints(fee: number, parameters: any): number {
    if (parameters.minimum && fee < parameters.minimum) {
      return parameters.minimum;
    }
    if (parameters.maximum && fee > parameters.maximum) {
      return parameters.maximum;
    }
    return fee;
  }

  private async calculateTax(amount: number, currency: string, jurisdiction: string): Promise<TaxCalculation> {
    // Get tax rate based on jurisdiction and currency
    const taxRate = this.getTaxRate(jurisdiction, currency);
    const taxAmount = amount * taxRate;

    return {
      amount,
      currency,
      taxRate,
      taxAmount,
      taxType: 'VAT',
      jurisdiction,
    };
  }

  private getTaxRate(jurisdiction: string, currency: string): number {
    // Default VAT rates for China
    if (currency === 'CNY') {
      return 0.06; // 6% VAT for legal services in China
    }
    return 0.0; // No tax for other currencies (simplified)
  }

  private generateBreakdown(
    baseFee: number,
    complexityMultiplier: number,
    urgencyMultiplier: number,
    jurisdictionMultiplier: number,
    finalFee: number,
    taxCalculation: TaxCalculation,
    request: FeeCalculationRequest
  ): any {
    const calculationSteps = [
      `Base fee: ${baseFee.toFixed(2)} ${request.currency}`,
      `Complexity multiplier: ${complexityMultiplier}x`,
      `Urgency multiplier: ${urgencyMultiplier}x`,
      `Jurisdiction multiplier: ${jurisdictionMultiplier}x`,
      `Final fee: ${finalFee.toFixed(2)} ${request.currency}`,
      `Tax (${(taxCalculation.taxRate * 100).toFixed(1)}%): ${taxCalculation.taxAmount.toFixed(2)} ${request.currency}`,
      `Total with tax: ${(finalFee + taxCalculation.taxAmount).toFixed(2)} ${request.currency}`,
    ];

    const adjustments = [];
    
    if (complexityMultiplier !== 1.0) {
      adjustments.push({
        type: 'complexity',
        multiplier: complexityMultiplier,
        reason: `Case complexity: ${request.complexity}`,
      });
    }
    
    if (urgencyMultiplier !== 1.0) {
      adjustments.push({
        type: 'urgency',
        multiplier: urgencyMultiplier,
        reason: `Case urgency: ${request.urgency}`,
      });
    }
    
    if (jurisdictionMultiplier !== 1.0) {
      adjustments.push({
        type: 'jurisdiction',
        multiplier: jurisdictionMultiplier,
        reason: `Jurisdiction: ${request.jurisdiction}`,
      });
    }

    const compliance = {
      meetsMinimumWage: this.checkMinimumWageCompliance(request),
      withinLegalLimits: this.checkLegalLimits(request),
      disclosureRequired: true,
    };

    return {
      calculationSteps,
      adjustments,
      compliance,
    };
  }

  private checkMinimumWageCompliance(request: FeeCalculationRequest): boolean {
    if (request.feeType === FeeType.HOURLY && request.parameters.rate) {
      return request.parameters.rate >= 200; // Minimum wage requirement for Chinese legal services
    }
    return true;
  }

  private checkLegalLimits(request: FeeCalculationRequest): boolean {
    if (request.feeType === FeeType.CONTINGENCY && request.parameters.percentage) {
      return request.parameters.percentage <= 30; // Maximum 30% contingency fee in China
    }
    return true;
  }

  private getContingencyFeeLimits(caseType: string, jurisdiction: string): any {
    // Simplified - in reality would come from configuration
    return {
      maximumPercentage: 30, // 30% maximum in China
      courtApprovalThreshold: 1000000, // 1M CNY threshold for court approval
    };
  }

  private getRetainerBaseRates(caseType: string): any {
    // Simplified - in reality would come from configuration
    const baseRates: Record<string, any> = {
      labor_dispute: { monthlyRate: 5000 },
      contract_dispute: { monthlyRate: 8000 },
      criminal_defense: { monthlyRate: 10000 },
    };
    return baseRates[caseType] || { monthlyRate: 6000 };
  }

  private async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    // Simplified - in reality would call exchange rate API
    const key = `${fromCurrency}_${toCurrency}`;
    return this.exchangeRates.get(key) || 1.0;
  }

  private initializeExchangeRates(): void {
    // Initialize with some common exchange rates (simplified)
    this.exchangeRates.set('CNY_USD', 0.14);
    this.exchangeRates.set('USD_CNY', 7.1);
    this.exchangeRates.set('CNY_EUR', 0.13);
    this.exchangeRates.set('EUR_CNY', 7.7);
  }

  private groupByPhase(billingNodes: any[]): any[] {
    // Group billing nodes by phase
    const grouped = billingNodes.reduce((acc, node) => {
      if (!acc[node.phase]) {
        acc[node.phase] = { phase: node.phase, total: 0, count: 0 };
      }
      acc[node.phase].total += node.amount;
      acc[node.phase].count += 1;
      return acc;
    }, {});

    return Object.values(grouped);
  }

  private groupByFeeType(billingNodes: any[]): any[] {
    // Group billing nodes by fee type (simplified)
    const grouped = billingNodes.reduce((acc, node) => {
      const feeType = node.name.includes('flat') ? 'FLAT' : 'OTHER';
      if (!acc[feeType]) {
        acc[feeType] = { feeType, total: 0, count: 0 };
      }
      acc[feeType].total += node.amount;
      acc[feeType].count += 1;
      return acc;
    }, {});

    return Object.values(grouped);
  }
}