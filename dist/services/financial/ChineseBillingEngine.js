"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChineseBillingEngine = void 0;
const financial_1 = require("../models/financial");
const financial_2 = require("../config/financial");
class ChineseBillingEngine {
    constructor(prisma) {
        this.chinaConfig = (0, financial_2.getChinaConfig)();
        this.billingConfig = (0, financial_2.getBillingConfig)();
        this.prisma = prisma;
    }
    async calculateLegalFee(caseType, feeType, params) {
        const { complexity = 'medium', jurisdiction = 'local' } = params;
        let baseFee = 0;
        let breakdown = {};
        let compliance = {};
        switch (feeType) {
            case financial_1.FeeType.HOURLY:
                if (!params.hours || !params.rate) {
                    throw new Error('Hours and rate are required for hourly fees');
                }
                const minRate = this.chinaConfig.feeRegulations.minimumHourlyRate;
                const effectiveRate = Math.max(params.rate, minRate);
                baseFee = params.hours * effectiveRate;
                breakdown = {
                    hours: params.hours,
                    rate: effectiveRate,
                    baseAmount: baseFee,
                    adjustments: params.rate < minRate ? {
                        originalRate: params.rate,
                        adjustedRate: effectiveRate,
                        reason: 'Minimum wage requirement'
                    } : null
                };
                compliance = {
                    meetsMinimumWage: true,
                    writtenAgreementRequired: this.chinaConfig.feeRegulations.requiresWrittenAgreement,
                    disclosureRequired: this.chinaConfig.feeRegulations.disclosureRequirements,
                };
                break;
            case financial_1.FeeType.CONTINGENCY:
                if (!params.settlementAmount || !params.percentage) {
                    throw new Error('Settlement amount and percentage are required for contingency fees');
                }
                const maxPercentage = this.chinaConfig.feeRegulations.maximumContingency;
                const effectivePercentage = Math.min(params.percentage, maxPercentage);
                baseFee = params.settlementAmount * (effectivePercentage / 100);
                breakdown = {
                    settlementAmount: params.settlementAmount,
                    percentage: effectivePercentage,
                    baseAmount: baseFee,
                    adjustments: params.percentage > maxPercentage ? {
                        originalPercentage: params.percentage,
                        adjustedPercentage: effectivePercentage,
                        reason: 'Maximum contingency fee limit'
                    } : null
                };
                compliance = {
                    withinLegalLimits: true,
                    writtenAgreementRequired: true,
                    courtApprovalRequired: params.settlementAmount > 1000000,
                    disclosureRequired: true,
                };
                break;
            case financial_1.FeeType.FLAT:
                if (!params.baseAmount) {
                    throw new Error('Base amount is required for flat fees');
                }
                const jurisdictionMultiplier = {
                    local: 1.0,
                    provincial: 1.2,
                    national: 1.5
                }[jurisdiction];
                baseFee = params.baseAmount * jurisdictionMultiplier;
                breakdown = {
                    baseAmount: params.baseAmount,
                    jurisdiction,
                    multiplier: jurisdictionMultiplier,
                    finalAmount: baseFee
                };
                compliance = {
                    writtenAgreementRequired: true,
                    disclosureRequired: true,
                    jurisdictionRulesApplied: true,
                };
                break;
            case financial_1.FeeType.RETAINER:
                if (!params.baseAmount) {
                    throw new Error('Base amount is required for retainer fees');
                }
                baseFee = params.baseAmount;
                breakdown = {
                    retainerAmount: baseFee,
                    type: 'retainer',
                    refundable: true,
                };
                compliance = {
                    writtenAgreementRequired: true,
                    refundableRequired: true,
                    trustAccountRequired: true,
                    disclosureRequired: true,
                };
                break;
            default:
                throw new Error(`Unsupported fee type: ${feeType}`);
        }
        const complexityMultiplier = {
            simple: 1.0,
            medium: 1.3,
            complex: 1.8
        }[complexity];
        const finalFee = baseFee * complexityMultiplier;
        breakdown.complexityAdjustment = {
            complexity,
            multiplier: complexityMultiplier,
            adjustedAmount: finalFee
        };
        const vatAmount = finalFee * this.chinaConfig.vatRate;
        const totalWithVAT = finalFee + vatAmount;
        breakdown.vat = {
            rate: this.chinaConfig.vatRate,
            amount: vatAmount,
            totalWithVAT
        };
        return {
            fee: totalWithVAT,
            breakdown,
            compliance
        };
    }
    async generateCompliantInvoice(data) {
        const client = await this.prisma.clientProfile.findUnique({
            where: { id: data.clientId },
            include: { user: true }
        });
        if (!client) {
            throw new Error('Client not found');
        }
        if (!client.taxId && this.chinaConfig.invoice.requiresTaxNumber) {
            throw new Error('Client tax ID (税号) is required for invoicing');
        }
        const invoiceNumber = await this.generateInvoiceNumber();
        const subtotal = data.items.reduce((sum, item) => sum + item.amount, 0);
        const vatAmount = subtotal * this.chinaConfig.vatRate;
        const total = subtotal + vatAmount;
        const invoice = await this.prisma.invoice.create({
            data: {
                invoiceNumber,
                caseId: data.caseId,
                clientId: data.clientId,
                userId: data.items[0]?.userId || '',
                status: financial_1.InvoiceStatus.DRAFT,
                issueDate: data.issueDate || new Date(),
                dueDate: data.dueDate || this.calculateDueDate(data.issueDate || new Date()),
                subtotal,
                taxRate: this.chinaConfig.vatRate,
                taxAmount: vatAmount,
                total,
                currency: this.chinaConfig.currency,
                notes: data.notes,
                items: {
                    create: data.items.map(item => ({
                        type: item.type,
                        description: item.description,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        amount: item.amount,
                        taxRate: this.chinaConfig.vatRate,
                        taxAmount: item.amount * this.chinaConfig.vatRate,
                        total: item.amount * (1 + this.chinaConfig.vatRate),
                    })),
                },
            },
            include: {
                items: true,
                client: true,
                case: true,
            },
        });
        if (this.chinaConfig.invoice.requiresFapiao) {
            await this.generateFapiao(invoice.id);
        }
        return invoice;
    }
    async generateFapiao(invoiceId) {
        const invoice = await this.prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
                client: true,
                items: true,
            },
        });
        if (!invoice) {
            throw new Error('Invoice not found');
        }
        console.log(`Fapiao generation required for invoice ${invoice.invoiceNumber}`);
        console.log(`Client tax ID: ${invoice.client.taxId}`);
        console.log(`Total amount: ${invoice.total} ${invoice.currency}`);
    }
    async generateInvoiceNumber() {
        const currentYear = new Date().getFullYear();
        const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
        const lastInvoice = await this.prisma.invoice.findFirst({
            where: {
                invoiceNumber: {
                    startsWith: `${this.billingConfig.invoiceNumberPrefix}${currentYear}${currentMonth}`
                }
            },
            orderBy: {
                invoiceNumber: 'desc'
            }
        });
        let sequence = 1;
        if (lastInvoice) {
            const lastSequence = parseInt(lastInvoice.invoiceNumber.slice(-4));
            sequence = lastSequence + 1;
        }
        const sequenceStr = String(sequence).padStart(4, '0');
        return `${this.billingConfig.invoiceNumberPrefix}${currentYear}${currentMonth}${sequenceStr}`;
    }
    calculateDueDate(issueDate) {
        const dueDate = new Date(issueDate);
        dueDate.setDate(dueDate.getDate() + this.billingConfig.defaultPaymentTerms);
        return dueDate;
    }
    async generateStageBilling(caseId) {
        const caseData = await this.prisma.case.findUnique({
            where: { id: caseId },
            include: {
                client: true,
                billingNodes: { where: { isActive: true }, orderBy: { order: 'asc' } },
                timeEntries: { where: { isBilled: false } },
                expenses: { where: { isBilled: false, isBillable: true } },
            },
        });
        if (!caseData) {
            throw new Error('Case not found');
        }
        const currentPhase = caseData.phase;
        const phaseBillingNodes = caseData.billingNodes.filter(node => node.phase === currentPhase);
        const unbilledTimeEntries = caseData.timeEntries;
        const unbilledExpenses = caseData.expenses;
        const compliance = await this.checkStageBillingCompliance(caseData, currentPhase);
        const invoiceItems = [
            ...phaseBillingNodes.map(node => ({
                type: 'billing_node',
                description: `${node.name} (${currentPhase})`,
                quantity: 1,
                unitPrice: node.amount,
                amount: node.amount,
                userId: caseData.attorneyId,
            })),
            ...unbilledTimeEntries.map(entry => ({
                type: 'time_entry',
                description: entry.description,
                quantity: entry.hours,
                unitPrice: entry.rate,
                amount: entry.amount,
                userId: entry.userId,
            })),
            ...unbilledExpenses.map(expense => ({
                type: 'expense',
                description: expense.description,
                quantity: 1,
                unitPrice: expense.amount,
                amount: expense.amount,
                userId: expense.userId,
            })),
        ];
        return {
            currentPhase,
            billingNodes: phaseBillingNodes,
            suggestedInvoice: {
                caseId,
                clientId: caseData.clientId,
                items: invoiceItems,
                estimatedTotal: invoiceItems.reduce((sum, item) => sum + item.amount, 0),
            },
            compliance,
        };
    }
    async checkStageBillingCompliance(caseData, phase) {
        const compliance = {
            phaseAppropriate: true,
            disclosureRequired: true,
            clientApprovalRequired: false,
            courtApprovalRequired: false,
            documentationRequired: [],
        };
        switch (phase) {
            case 'INTAKE_RISK_ASSESSMENT':
                compliance.clientApprovalRequired = true;
                compliance.documentationRequired.push('fee_agreement', 'engagement_letter');
                break;
            case 'FORMAL_PROCEEDINGS':
                compliance.documentationRequired.push('court_filing_receipt', 'service_proof');
                break;
            case 'RESOLUTION_POST_PROCEEDING':
                compliance.documentationRequired.push('settlement_agreement', 'judgment_copy');
                break;
        }
        const totalCaseValue = await this.calculateCaseValue(caseData.id);
        if (totalCaseValue > 1000000) {
            compliance.courtApprovalRequired = true;
            compliance.documentationRequired.push('court_approval');
        }
        return compliance;
    }
    async calculateCaseValue(caseId) {
        return 0;
    }
    async manageTrustAccount(data) {
        const compliance = {
            segregationRequired: this.chinaConfig.trustAccount.requiresSegregation,
            interestHandling: this.chinaConfig.trustAccount.interestHandling,
            documentationRequired: true,
            clientNotificationRequired: true,
        };
        let trustAccount = await this.prisma.trustAccount.findFirst({
            where: {
                clientId: data.clientId,
                caseId: data.caseId,
                isActive: true,
            },
        });
        if (!trustAccount) {
            trustAccount = await this.prisma.trustAccount.create({
                data: {
                    clientId: data.clientId,
                    caseId: data.caseId,
                    currency: this.chinaConfig.currency,
                },
            });
        }
        const transaction = await this.prisma.trustTransaction.create({
            data: {
                trustAccountId: trustAccount.id,
                type: data.type,
                amount: data.amount,
                description: data.description,
                status: 'pending',
            },
        });
        if (data.type === financial_1.TrustTransactionType.DEPOSIT) {
            await this.prisma.trustAccount.update({
                where: { id: trustAccount.id },
                data: { balance: { increment: data.amount } },
            });
        }
        else if (data.type === financial_1.TrustTransactionType.WITHDRAWAL) {
            if (trustAccount.balance < data.amount) {
                throw new Error('Insufficient trust account balance');
            }
            await this.prisma.trustAccount.update({
                where: { id: trustAccount.id },
                data: { balance: { decrement: data.amount } },
            });
        }
        return {
            success: true,
            transaction,
            compliance,
        };
    }
}
exports.ChineseBillingEngine = ChineseBillingEngine;
//# sourceMappingURL=ChineseBillingEngine.js.map