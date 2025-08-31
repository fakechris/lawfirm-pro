"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeeCalculationService = void 0;
const financial_1 = require("../models/financial");
class FeeCalculationService {
    constructor(prisma) {
        this.exchangeRates = new Map();
        this.prisma = prisma;
        this.initializeExchangeRates();
    }
    async calculateFee(request) {
        this.validateFeeCalculationRequest(request);
        const baseFee = await this.calculateBaseFee(request);
        const complexityMultiplier = this.getComplexityMultiplier(request.complexity);
        const urgencyMultiplier = this.getUrgencyMultiplier(request.urgency);
        const jurisdictionMultiplier = this.getJurisdictionMultiplier(request.jurisdiction);
        const adjustedFee = baseFee * complexityMultiplier * urgencyMultiplier * jurisdictionMultiplier;
        const finalFee = this.applyMinMaxConstraints(adjustedFee, request.parameters);
        const taxCalculation = await this.calculateTax(finalFee, request.currency, request.jurisdiction);
        const totalWithTax = finalFee + taxCalculation.taxAmount;
        const breakdown = this.generateBreakdown(baseFee, complexityMultiplier, urgencyMultiplier, jurisdictionMultiplier, finalFee, taxCalculation, request);
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
    async calculateTimeEntryFees(timeEntries) {
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
    async calculateExpenseFees(expenses) {
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
    async calculateContingencyFee(settlementAmount, percentage, caseType, jurisdiction) {
        const legalLimits = this.getContingencyFeeLimits(caseType, jurisdiction);
        const baseFee = settlementAmount * (percentage / 100);
        let finalFee = baseFee;
        if (percentage > legalLimits.maximumPercentage) {
            finalFee = settlementAmount * (legalLimits.maximumPercentage / 100);
        }
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
    async calculateRetainerFee(caseType, complexity, estimatedDuration, currency) {
        const baseRates = this.getRetainerBaseRates(caseType);
        const complexityMultiplier = this.getComplexityMultiplier(complexity);
        const monthlyRetainer = baseRates.monthlyRate * complexityMultiplier;
        const totalRetainer = monthlyRetainer * estimatedDuration;
        const refundableAmount = totalRetainer * 0.8;
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
    async convertCurrency(conversion) {
        const exchangeRate = await this.getExchangeRate(conversion.fromCurrency, conversion.toCurrency);
        const convertedAmount = conversion.amount * exchangeRate;
        return {
            ...conversion,
            convertedAmount,
            exchangeRate,
            timestamp: new Date(),
        };
    }
    async calculateMultiCurrencyFee(request, targetCurrency) {
        const originalResult = await this.calculateFee(request);
        const conversion = await this.convertCurrency({
            fromCurrency: request.currency,
            toCurrency: targetCurrency,
            amount: originalResult.finalFee,
        });
        const convertedTax = await this.calculateTax(conversion.convertedAmount, targetCurrency, request.jurisdiction);
        const convertedResult = {
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
    async getCaseFeeEstimation(caseId) {
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
        const billingNodesTotal = caseData.billingNodes.reduce((sum, node) => sum + node.amount, 0);
        const timeEntriesTotal = caseData.timeEntries.reduce((sum, entry) => sum + entry.amount, 0);
        const expensesTotal = caseData.expenses.reduce((sum, expense) => sum + expense.amount, 0);
        const baseTotal = billingNodesTotal + timeEntriesTotal + expensesTotal;
        const minimum = baseTotal * 0.8;
        const maximum = baseTotal * 1.5;
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
    validateFeeCalculationRequest(request) {
        if (!request.feeType) {
            throw new Error('Fee type is required');
        }
        if (!request.caseType) {
            throw new Error('Case type is required');
        }
        if (!request.currency) {
            throw new Error('Currency is required');
        }
        switch (request.feeType) {
            case financial_1.FeeType.HOURLY:
                if (!request.parameters.hours || !request.parameters.rate) {
                    throw new Error('Hours and rate are required for hourly fees');
                }
                break;
            case financial_1.FeeType.FLAT:
                if (!request.parameters.baseAmount) {
                    throw new Error('Base amount is required for flat fees');
                }
                break;
            case financial_1.FeeType.CONTINGENCY:
                if (!request.parameters.settlementAmount || !request.parameters.percentage) {
                    throw new Error('Settlement amount and percentage are required for contingency fees');
                }
                break;
            case financial_1.FeeType.RETAINER:
                if (!request.parameters.baseAmount) {
                    throw new Error('Base amount is required for retainer fees');
                }
                break;
        }
    }
    async calculateBaseFee(request) {
        switch (request.feeType) {
            case financial_1.FeeType.HOURLY:
                return request.parameters.hours * request.parameters.rate;
            case financial_1.FeeType.FLAT:
                return request.parameters.baseAmount;
            case financial_1.FeeType.CONTINGENCY:
                return request.parameters.settlementAmount * (request.parameters.percentage / 100);
            case financial_1.FeeType.RETAINER:
                return request.parameters.baseAmount;
            case financial_1.FeeType.HYBRID:
                return this.calculateHybridFee(request.parameters);
            default:
                throw new Error(`Unsupported fee type: ${request.feeType}`);
        }
    }
    calculateHybridFee(parameters) {
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
    getComplexityMultiplier(complexity) {
        const multipliers = {
            simple: 1.0,
            medium: 1.3,
            complex: 1.8,
        };
        return multipliers[complexity] || 1.0;
    }
    getUrgencyMultiplier(urgency) {
        const multipliers = {
            normal: 1.0,
            urgent: 1.2,
            expedited: 1.5,
        };
        return multipliers[urgency] || 1.0;
    }
    getJurisdictionMultiplier(jurisdiction) {
        const multipliers = {
            local: 1.0,
            provincial: 1.2,
            national: 1.5,
        };
        return multipliers[jurisdiction] || 1.0;
    }
    applyMinMaxConstraints(fee, parameters) {
        if (parameters.minimum && fee < parameters.minimum) {
            return parameters.minimum;
        }
        if (parameters.maximum && fee > parameters.maximum) {
            return parameters.maximum;
        }
        return fee;
    }
    async calculateTax(amount, currency, jurisdiction) {
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
    getTaxRate(jurisdiction, currency) {
        if (currency === 'CNY') {
            return 0.06;
        }
        return 0.0;
    }
    generateBreakdown(baseFee, complexityMultiplier, urgencyMultiplier, jurisdictionMultiplier, finalFee, taxCalculation, request) {
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
    checkMinimumWageCompliance(request) {
        if (request.feeType === financial_1.FeeType.HOURLY && request.parameters.rate) {
            return request.parameters.rate >= 200;
        }
        return true;
    }
    checkLegalLimits(request) {
        if (request.feeType === financial_1.FeeType.CONTINGENCY && request.parameters.percentage) {
            return request.parameters.percentage <= 30;
        }
        return true;
    }
    getContingencyFeeLimits(caseType, jurisdiction) {
        return {
            maximumPercentage: 30,
            courtApprovalThreshold: 1000000,
        };
    }
    getRetainerBaseRates(caseType) {
        const baseRates = {
            labor_dispute: { monthlyRate: 5000 },
            contract_dispute: { monthlyRate: 8000 },
            criminal_defense: { monthlyRate: 10000 },
        };
        return baseRates[caseType] || { monthlyRate: 6000 };
    }
    async getExchangeRate(fromCurrency, toCurrency) {
        const key = `${fromCurrency}_${toCurrency}`;
        return this.exchangeRates.get(key) || 1.0;
    }
    initializeExchangeRates() {
        this.exchangeRates.set('CNY_USD', 0.14);
        this.exchangeRates.set('USD_CNY', 7.1);
        this.exchangeRates.set('CNY_EUR', 0.13);
        this.exchangeRates.set('EUR_CNY', 7.7);
    }
    groupByPhase(billingNodes) {
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
    groupByFeeType(billingNodes) {
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
exports.FeeCalculationService = FeeCalculationService;
//# sourceMappingURL=FeeCalculationService.js.map