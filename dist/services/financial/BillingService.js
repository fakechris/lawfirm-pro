"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingService = void 0;
const financial_1 = require("../models/financial");
const ChineseBillingEngine_1 = require("./ChineseBillingEngine");
class BillingService {
    constructor(prisma) {
        this.prisma = prisma;
        this.chineseBillingEngine = new ChineseBillingEngine_1.ChineseBillingEngine(prisma);
    }
    async createStageBilling(request) {
        const caseData = await this.prisma.case.findUnique({
            where: { id: request.caseId },
            include: { client: true }
        });
        if (!caseData) {
            throw new Error('Case not found');
        }
        await this.validatePhaseCompatibility(request.caseId, request.phase);
        const billingNodes = await Promise.all(request.milestones.map(async (milestone, index) => {
            return this.prisma.billingNode.create({
                data: {
                    name: milestone.name,
                    description: milestone.description,
                    caseId: request.caseId,
                    phase: request.phase,
                    order: milestone.order,
                    amount: milestone.amount,
                    dueDate: milestone.dueDate,
                    notes: `Milestone requirements: ${milestone.requirements.join(', ')}`,
                },
            });
        }));
        const configuration = await this.storeBillingConfiguration(request.caseId, request.configuration);
        const compliance = await this.checkStageBillingCompliance(request);
        return {
            billingNodes,
            configuration,
            compliance,
        };
    }
    async getBillingNodesByCase(caseId, options = {}) {
        const where = { caseId, isActive: true };
        if (options.phase) {
            where.phase = options.phase;
        }
        if (!options.includeCompleted) {
            where.isPaid = false;
        }
        return this.prisma.billingNode.findMany({
            where,
            orderBy: { order: 'asc' },
            include: {
                case: {
                    include: {
                        client: true,
                    },
                },
            },
        });
    }
    async completeBillingNode(billingNodeId, completionData) {
        const billingNode = await this.prisma.billingNode.update({
            where: { id: billingNodeId },
            data: {
                isPaid: true,
                paidDate: completionData.completionDate,
                notes: completionData.notes,
            },
            include: {
                case: {
                    include: {
                        client: true,
                        billingNodes: {
                            where: { isActive: true, isPaid: false },
                            orderBy: { order: 'asc' },
                        },
                    },
                },
            },
        });
        let invoice;
        if (completionData.generateInvoice) {
            invoice = await this.generateInvoiceForBillingNode(billingNodeId);
        }
        const nextMilestones = billingNode.case.billingNodes.filter(node => node.order > billingNode.order && node.phase === billingNode.phase);
        return {
            billingNode,
            invoice,
            nextMilestones,
        };
    }
    async generateInvoiceForBillingNode(billingNodeId) {
        const billingNode = await this.prisma.billingNode.findUnique({
            where: { id: billingNodeId },
            include: {
                case: {
                    include: {
                        client: true,
                        timeEntries: { where: { isBilled: false } },
                        expenses: { where: { isBilled: false, isBillable: true } },
                    },
                },
            },
        });
        if (!billingNode) {
            throw new Error('Billing node not found');
        }
        const configuration = await this.getBillingConfiguration(billingNode.caseId);
        const invoiceItems = [
            {
                type: 'billing_node',
                description: `${billingNode.name} - ${billingNode.phase}`,
                quantity: 1,
                unitPrice: billingNode.amount,
                amount: billingNode.amount,
                taxRate: configuration.taxRate,
            },
        ];
        const timeEntryItems = billingNode.case.timeEntries.map(entry => ({
            type: 'time_entry',
            description: entry.description,
            quantity: entry.hours,
            unitPrice: entry.rate,
            amount: entry.amount,
            taxRate: configuration.taxRate,
        }));
        const expenseItems = billingNode.case.expenses.map(expense => ({
            type: 'expense',
            description: expense.description,
            quantity: 1,
            unitPrice: expense.amount,
            amount: expense.amount,
            taxRate: configuration.taxRate,
        }));
        invoiceItems.push(...timeEntryItems, ...expenseItems);
        const invoiceNumber = await this.generateInvoiceNumber();
        const subtotal = invoiceItems.reduce((sum, item) => sum + item.amount, 0);
        const taxAmount = subtotal * configuration.taxRate;
        const total = subtotal + taxAmount;
        const invoice = await this.prisma.invoice.create({
            data: {
                invoiceNumber,
                caseId: billingNode.caseId,
                clientId: billingNode.case.clientId,
                userId: billingNode.case.attorneyId,
                status: financial_1.InvoiceStatus.DRAFT,
                issueDate: new Date(),
                dueDate: this.calculateDueDate(new Date(), configuration.paymentTerms),
                subtotal,
                taxRate: configuration.taxRate,
                taxAmount,
                total,
                currency: configuration.currency,
                notes: `Invoice for ${billingNode.name} milestone`,
                items: {
                    create: invoiceItems.map(item => ({
                        type: item.type,
                        description: item.description,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        amount: item.amount,
                        taxRate: item.taxRate,
                        taxAmount: item.amount * item.taxRate,
                        total: item.amount * (1 + item.taxRate),
                    })),
                },
            },
            include: {
                items: true,
                client: true,
                case: true,
            },
        });
        await this.markItemsAsBilled(billingNode.caseId, invoiceItems);
        return invoice;
    }
    async autoGenerateInvoices(caseId) {
        const configuration = await this.getBillingConfiguration(caseId);
        if (!configuration.autoGenerateInvoices) {
            return [];
        }
        const completedNodes = await this.prisma.billingNode.findMany({
            where: {
                caseId,
                isActive: true,
                isPaid: true,
                invoice: null,
            },
        });
        const invoices = [];
        for (const node of completedNodes) {
            try {
                const invoice = await this.generateInvoiceForBillingNode(node.id);
                invoices.push(invoice);
            }
            catch (error) {
                console.error(`Failed to generate invoice for billing node ${node.id}:`, error);
            }
        }
        return invoices;
    }
    async getBillingProgress(caseId) {
        const caseData = await this.prisma.case.findUnique({
            where: { id: caseId },
            include: {
                billingNodes: {
                    where: { isActive: true },
                    orderBy: { order: 'asc' },
                },
                invoices: {
                    include: { payments: true },
                },
            },
        });
        if (!caseData) {
            throw new Error('Case not found');
        }
        const completedNodes = caseData.billingNodes.filter(node => node.isPaid);
        const pendingNodes = caseData.billingNodes.filter(node => !node.isPaid);
        const totalBilled = caseData.invoices.reduce((sum, invoice) => sum + invoice.total, 0);
        const totalPaid = caseData.invoices.reduce((sum, invoice) => {
            const paidAmount = invoice.payments
                .filter(p => p.status === financial_1.PaymentStatus.COMPLETED)
                .reduce((paymentSum, payment) => paymentSum + payment.amount, 0);
            return sum + paidAmount;
        }, 0);
        const completionPercentage = caseData.billingNodes.length > 0
            ? (completedNodes.length / caseData.billingNodes.length) * 100
            : 0;
        const nextMilestone = pendingNodes.length > 0 ? pendingNodes[0] : undefined;
        return {
            currentPhase: caseData.phase,
            completedNodes,
            pendingNodes,
            totalBilled,
            totalPaid,
            completionPercentage,
            nextMilestone,
        };
    }
    async validateBillingMilestones(milestones) {
        const errors = [];
        const warnings = [];
        const orders = milestones.map(m => m.order);
        const uniqueOrders = new Set(orders);
        if (orders.length !== uniqueOrders.size) {
            errors.push('Duplicate milestone orders detected');
        }
        milestones.forEach((milestone, index) => {
            if (!milestone.name || milestone.name.trim() === '') {
                errors.push(`Milestone ${index + 1}: Name is required`);
            }
            if (milestone.amount <= 0) {
                errors.push(`Milestone ${index + 1}: Amount must be greater than 0`);
            }
            if (milestone.requirements.length === 0) {
                warnings.push(`Milestone ${index + 1}: No requirements specified`);
            }
        });
        const phases = milestones.map(m => m.phase);
        const uniquePhases = new Set(phases);
        if (uniquePhases.size > 1) {
            warnings.push('Milestones span multiple phases - consider creating separate billing configurations');
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
        };
    }
    async validatePhaseCompatibility(caseId, phase) {
        const caseData = await this.prisma.case.findUnique({
            where: { id: caseId },
        });
        if (!caseData) {
            throw new Error('Case not found');
        }
        const compatiblePhases = this.getCompatiblePhases(caseData.caseType);
        if (!compatiblePhases.includes(phase)) {
            throw new Error(`Phase ${phase} is not compatible with case type ${caseData.caseType}`);
        }
    }
    getCompatiblePhases(caseType) {
        const phaseMap = {
            'labor_dispute': [
                'INTAKE_RISK_ASSESSMENT',
                'FORMAL_PROCEEDINGS',
                'RESOLUTION_POST_PROCEEDING',
            ],
            'contract_dispute': [
                'INTAKE_RISK_ASSESSMENT',
                'FORMAL_PROCEEDINGS',
                'RESOLUTION_POST_PROCEEDING',
            ],
            'criminal_defense': [
                'INTAKE_RISK_ASSESSMENT',
                'FORMAL_PROCEEDINGS',
                'RESOLUTION_POST_PROCEEDING',
            ],
        };
        return phaseMap[caseType] || [];
    }
    async storeBillingConfiguration(caseId, configuration) {
        return configuration;
    }
    async getBillingConfiguration(caseId) {
        return {
            autoGenerateInvoices: true,
            requireClientApproval: false,
            sendNotifications: true,
            paymentTerms: 30,
            lateFeeRate: 0.02,
            currency: 'CNY',
            taxRate: 0.06,
        };
    }
    async checkStageBillingCompliance(request) {
        const compliance = await this.chineseBillingEngine.calculateLegalFee('general', financial_1.FeeType.FLAT, {
            baseAmount: request.milestones.reduce((sum, m) => sum + m.amount, 0),
        });
        return {
            ...compliance.compliance,
            milestoneCount: request.milestones.length,
            totalAmount: request.milestones.reduce((sum, m) => sum + m.amount, 0),
            phase: request.phase,
        };
    }
    async generateInvoiceNumber() {
        const prefix = 'INV';
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const lastInvoice = await this.prisma.invoice.findFirst({
            where: {
                invoiceNumber: {
                    startsWith: `${prefix}${year}${month}`,
                },
            },
            orderBy: {
                invoiceNumber: 'desc',
            },
        });
        let sequence = 1;
        if (lastInvoice) {
            const lastSequence = parseInt(lastInvoice.invoiceNumber.slice(-4));
            sequence = lastSequence + 1;
        }
        const sequenceStr = String(sequence).padStart(4, '0');
        return `${prefix}${year}${month}${sequenceStr}`;
    }
    calculateDueDate(issueDate, paymentTerms) {
        const dueDate = new Date(issueDate);
        dueDate.setDate(dueDate.getDate() + paymentTerms);
        return dueDate;
    }
    async markItemsAsBilled(caseId, items) {
        const timeEntryIds = items
            .filter(item => item.type === 'time_entry')
            .map(item => item.id);
        if (timeEntryIds.length > 0) {
            await this.prisma.timeEntry.updateMany({
                where: { id: { in: timeEntryIds } },
                data: { isBilled: true },
            });
        }
        const expenseIds = items
            .filter(item => item.type === 'expense')
            .map(item => item.id);
        if (expenseIds.length > 0) {
            await this.prisma.expense.updateMany({
                where: { id: { in: expenseIds } },
                data: { isBilled: true },
            });
        }
    }
}
exports.BillingService = BillingService;
//# sourceMappingURL=BillingService.js.map