"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StageBillingService = void 0;
const financial_1 = require("../models/financial");
class StageBillingService {
    constructor(prisma, configuration) {
        this.prisma = prisma;
        this.configuration = configuration || this.getDefaultConfiguration();
    }
    async createStageBillingSystem(caseId, billingNodes, configuration) {
        const caseData = await this.prisma.case.findUnique({
            where: { id: caseId },
            include: { client: true },
        });
        if (!caseData) {
            throw new Error('Case not found');
        }
        const validation = await this.validateBillingNodes(billingNodes, caseData.caseType);
        if (!validation.isValid) {
            return {
                success: false,
                createdNodes: [],
                validation,
                automation: this.getAutomationRules(),
            };
        }
        await this.prisma.billingNode.updateMany({
            where: { caseId },
            data: { isActive: false },
        });
        const createdNodes = await Promise.all(billingNodes.map(async (node) => {
            return this.prisma.billingNode.create({
                data: {
                    name: node.name,
                    description: node.description,
                    caseId,
                    phase: node.phase,
                    order: node.order,
                    amount: node.amount,
                    dueDate: node.dueDate,
                    notes: `Requirements: ${node.requirements.join(', ')} | Dependencies: ${node.dependencies.join(', ')}`,
                    isActive: true,
                },
            });
        }));
        if (configuration) {
            await this.storeConfiguration(caseId, configuration);
        }
        return {
            success: true,
            createdNodes,
            validation,
            automation: this.getAutomationRules(),
        };
    }
    async getStageBillingProgress(caseId) {
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
                timeEntries: { where: { isBilled: false } },
                expenses: { where: { isBilled: false, isBillable: true } },
            },
        });
        if (!caseData) {
            throw new Error('Case not found');
        }
        const stageNodes = await this.convertToStageBillingNodes(caseData.billingNodes);
        const completedNodes = stageNodes.filter(node => node.isCompleted);
        const pendingNodes = stageNodes.filter(node => !node.isCompleted);
        const blockedNodes = await this.getBlockedNodes(stageNodes);
        const readyNodes = await this.getReadyNodes(stageNodes);
        const overallProgress = this.calculateOverallProgress(stageNodes);
        const phaseProgress = this.calculatePhaseProgress(stageNodes);
        const nextMilestone = readyNodes.length > 0 ? readyNodes[0] : undefined;
        const billingSummary = await this.calculateBillingSummary(caseData);
        return {
            currentPhase: caseData.phase,
            completedNodes,
            pendingNodes,
            blockedNodes,
            readyNodes,
            overallProgress,
            phaseProgress,
            nextMilestone,
            billingSummary,
        };
    }
    async completeBillingMilestone(billingNodeId, completionData) {
        const billingNode = await this.prisma.billingNode.findUnique({
            where: { id: billingNodeId },
            include: {
                case: {
                    include: {
                        billingNodes: {
                            where: { isActive: true, isPaid: false },
                            orderBy: { order: 'asc' },
                        },
                    },
                },
            },
        });
        if (!billingNode) {
            throw new Error('Billing node not found');
        }
        const validation = await this.validateCompletion(billingNodeId, completionData);
        if (!validation.isValid) {
            throw new Error(`Cannot complete milestone: ${validation.errors.join(', ')}`);
        }
        const updatedNode = await this.prisma.billingNode.update({
            where: { id: billingNodeId },
            data: {
                isPaid: true,
                paidDate: completionData.completionDate,
                notes: completionData.notes,
            },
        });
        let invoice;
        if (completionData.generateInvoice) {
            invoice = await this.generateInvoiceForMilestone(billingNodeId);
        }
        const nextNodes = await this.getNextAvailableNodes(billingNode.caseId, billingNode.order);
        const automationResults = await this.handleAutomation(billingNode.caseId, billingNodeId, 'COMPLETION');
        return {
            billingNode: updatedNode,
            nextNodes,
            invoice,
            automationResults,
        };
    }
    async validateCompletion(billingNodeId, completionData) {
        const billingNode = await this.prisma.billingNode.findUnique({
            where: { id: billingNodeId },
            include: {
                case: {
                    include: {
                        billingNodes: {
                            where: { isActive: true },
                            orderBy: { order: 'asc' },
                        },
                    },
                },
            },
        });
        if (!billingNode) {
            return {
                isValid: false,
                errors: ['Billing node not found'],
                warnings: [],
                recommendations: [],
                compliance: {
                    meetsRequirements: false,
                    violations: ['Billing node not found'],
                    suggestions: [],
                },
            };
        }
        const errors = [];
        const warnings = [];
        const recommendations = [];
        const violations = [];
        const suggestions = [];
        if (billingNode.isPaid) {
            errors.push('Billing node is already completed');
        }
        const dependencies = await this.checkDependencies(billingNode);
        if (!dependencies.allMet) {
            errors.push(`Dependencies not met: ${dependencies.unmet.join(', ')}`);
        }
        if (completionData.documents && completionData.documents.length > 0) {
            console.log(`Validating ${completionData.documents.length} documents`);
        }
        const timeThresholdMet = await this.checkTimeThreshold(billingNode);
        if (!timeThresholdMet) {
            warnings.push('Time threshold not yet met');
        }
        const complianceCheck = await this.checkComplianceRequirements(billingNode);
        if (!complianceCheck.passed) {
            violations.push(...complianceCheck.violations);
            suggestions.push(...complianceCheck.suggestions);
        }
        if (billingNode.amount > 100000) {
            recommendations.push('Consider obtaining client approval for large amounts');
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            recommendations,
            compliance: {
                meetsRequirements: violations.length === 0,
                violations,
                suggestions,
            },
        };
    }
    async generateBillingSuggestions(caseId) {
        const progress = await this.getStageBillingProgress(caseId);
        const caseData = await this.prisma.case.findUnique({
            where: { id: caseId },
            include: {
                timeEntries: { where: { isBilled: false } },
                expenses: { where: { isBilled: false, isBillable: true } },
            },
        });
        const suggestions = [];
        const readyToBill = [];
        const upcomingDeadlines = [];
        const overdueItems = [];
        for (const node of progress.readyNodes) {
            if (node.amount > 0) {
                readyToBill.push({
                    node,
                    reason: 'All dependencies met and requirements fulfilled',
                    priority: this.calculatePriority(node, progress),
                });
            }
        }
        if (caseData?.timeEntries && caseData.timeEntries.length > 0) {
            const totalUnbilledTime = caseData.timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
            if (totalUnbilledTime > 10) {
                suggestions.push({
                    type: 'time_entries',
                    message: `Consider billing ${totalUnbilledTime} hours of unbilled time`,
                    priority: 'medium',
                });
            }
        }
        if (caseData?.expenses && caseData.expenses.length > 0) {
            const totalUnbilledExpenses = caseData.expenses.reduce((sum, expense) => sum + expense.amount, 0);
            if (totalUnbilledExpenses > 5000) {
                suggestions.push({
                    type: 'expenses',
                    message: `Consider billing ${totalUnbilledExpenses} CNY in unbilled expenses`,
                    priority: 'high',
                });
            }
        }
        const now = new Date();
        for (const node of progress.pendingNodes) {
            if (node.dueDate) {
                const daysUntilDue = Math.ceil((node.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                if (daysUntilDue <= 7 && daysUntilDue > 0) {
                    upcomingDeadlines.push({
                        node,
                        daysUntilDue,
                        priority: daysUntilDue <= 3 ? 'high' : 'medium',
                    });
                }
                else if (daysUntilDue <= 0) {
                    overdueItems.push({
                        node,
                        daysOverdue: Math.abs(daysUntilDue),
                        priority: 'critical',
                    });
                }
            }
        }
        return {
            suggestions,
            readyToBill,
            upcomingDeadlines,
            overdueItems,
        };
    }
    async processAutomation(caseId) {
        const automation = this.getAutomationRules();
        const processed = [];
        const results = [];
        const errors = [];
        if (!automation.enabled) {
            return { processed, results, errors: ['Automation is disabled'] };
        }
        try {
            if (automation.rules.autoGenerateInvoices) {
                const invoiceResult = await this.autoGenerateInvoices(caseId);
                processed.push('auto_generate_invoices');
                results.push(invoiceResult);
            }
            if (automation.rules.autoSendReminders) {
                const reminderResult = await this.sendDeadlineReminders(caseId);
                processed.push('send_reminders');
                results.push(reminderResult);
            }
            if (automation.rules.autoAdvanceStages) {
                const advanceResult = await this.autoAdvanceStages(caseId);
                processed.push('auto_advance_stages');
                results.push(advanceResult);
            }
        }
        catch (error) {
            errors.push(`Automation processing failed: ${error.message}`);
        }
        return { processed, results, errors };
    }
    getDefaultConfiguration() {
        return {
            autoAdvance: true,
            requireCompletion: true,
            allowPartialBilling: false,
            sendNotifications: true,
            approvalRequired: false,
            gracePeriod: 7,
            currency: 'CNY',
        };
    }
    async validateBillingNodes(billingNodes, caseType) {
        const errors = [];
        const warnings = [];
        const recommendations = [];
        const violations = [];
        const suggestions = [];
        const orders = billingNodes.map(n => n.order);
        const uniqueOrders = new Set(orders);
        if (orders.length !== uniqueOrders.size) {
            errors.push('Duplicate milestone orders detected');
        }
        billingNodes.forEach((node, index) => {
            if (!node.name || node.name.trim() === '') {
                errors.push(`Node ${index + 1}: Name is required`);
            }
            if (node.amount <= 0) {
                errors.push(`Node ${index + 1}: Amount must be greater than 0`);
            }
            if (node.requirements.length === 0) {
                warnings.push(`Node ${index + 1}: No requirements specified`);
            }
            if (node.dependencies.includes(node.id)) {
                errors.push(`Node ${index + 1}: Cannot depend on itself`);
            }
        });
        const phases = billingNodes.map(n => n.phase);
        const uniquePhases = new Set(phases);
        if (uniquePhases.size > 1) {
            recommendations.push('Consider organizing nodes by phase for better clarity');
        }
        const totalAmount = billingNodes.reduce((sum, node) => sum + node.amount, 0);
        if (totalAmount > 1000000) {
            suggestions.push('Consider court approval for cases over 1M CNY');
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            recommendations,
            compliance: {
                meetsRequirements: violations.length === 0,
                violations,
                suggestions,
            },
        };
    }
    async convertToStageBillingNodes(billingNodes) {
        return billingNodes.map(node => ({
            id: node.id,
            name: node.name,
            description: node.description || '',
            phase: node.phase,
            order: node.order,
            amount: node.amount,
            requirements: this.parseRequirements(node.notes),
            dependencies: this.parseDependencies(node.notes),
            triggers: this.parseTriggers(node.notes),
            completionCriteria: {},
            dueDate: node.dueDate,
            isCompleted: node.isPaid,
            completionDate: node.paidDate,
            isActive: node.isActive,
        }));
    }
    parseRequirements(notes) {
        if (!notes)
            return [];
        const requirementsMatch = notes.match(/Requirements:\s*([^|]*)/);
        return requirementsMatch ? requirementsMatch[1].split(',').map(r => r.trim()) : [];
    }
    parseDependencies(notes) {
        if (!notes)
            return [];
        const dependenciesMatch = notes.match(/Dependencies:\s*([^|]*)/);
        return dependenciesMatch ? dependenciesMatch[1].split(',').map(d => d.trim()) : [];
    }
    parseTriggers(notes) {
        if (!notes)
            return [];
        const triggersMatch = notes.match(/Triggers:\s*([^|]*)/);
        return triggersMatch ? triggersMatch[1].split(',').map(t => t.trim()) : [];
    }
    async getBlockedNodes(nodes) {
        const blockedNodes = [];
        for (const node of nodes) {
            if (node.isCompleted)
                continue;
            const dependencies = await this.checkDependencies(node);
            if (!dependencies.allMet) {
                blockedNodes.push(node);
            }
        }
        return blockedNodes;
    }
    async getReadyNodes(nodes) {
        const readyNodes = [];
        for (const node of nodes) {
            if (node.isCompleted)
                continue;
            const dependencies = await this.checkDependencies(node);
            const timeThreshold = await this.checkTimeThreshold(node);
            if (dependencies.allMet && timeThreshold) {
                readyNodes.push(node);
            }
        }
        return readyNodes;
    }
    async checkDependencies(node) {
        const unmet = [];
        for (const dependency of node.dependencies) {
            console.log(`Checking dependency: ${dependency}`);
        }
        return {
            allMet: unmet.length === 0,
            unmet,
        };
    }
    async checkTimeThreshold(node) {
        return true;
    }
    calculateOverallProgress(nodes) {
        if (nodes.length === 0)
            return 0;
        const completedCount = nodes.filter(n => n.isCompleted).length;
        return (completedCount / nodes.length) * 100;
    }
    calculatePhaseProgress(nodes) {
        const phases = [...new Set(nodes.map(n => n.phase))];
        const progress = {};
        for (const phase of phases) {
            const phaseNodes = nodes.filter(n => n.phase === phase);
            const completedCount = phaseNodes.filter(n => n.isCompleted).length;
            progress[phase] = phaseNodes.length > 0 ? (completedCount / phaseNodes.length) * 100 : 0;
        }
        return progress;
    }
    async calculateBillingSummary(caseData) {
        const totalBilled = caseData.invoices.reduce((sum, invoice) => sum + invoice.total, 0);
        const totalPaid = caseData.invoices.reduce((sum, invoice) => {
            const paidAmount = invoice.payments
                .filter((p) => p.status === financial_1.PaymentStatus.COMPLETED)
                .reduce((paymentSum, payment) => paymentSum + payment.amount, 0);
            return sum + paidAmount;
        }, 0);
        const upcomingPayments = caseData.billingNodes
            .filter((node) => !node.isPaid && node.dueDate)
            .map((node) => ({
            node,
            dueDate: node.dueDate,
            amount: node.amount,
        }));
        return {
            totalBilled,
            totalPaid,
            outstandingBalance: totalBilled - totalPaid,
            upcomingPayments,
        };
    }
    async generateInvoiceForMilestone(billingNodeId) {
        throw new Error('Invoice generation not implemented');
    }
    async getNextAvailableNodes(caseId, currentOrder) {
        return this.prisma.billingNode.findMany({
            where: {
                caseId,
                isActive: true,
                isPaid: false,
                order: { gt: currentOrder },
            },
            orderBy: { order: 'asc' },
        });
    }
    async checkComplianceRequirements(billingNode) {
        const violations = [];
        const suggestions = [];
        if (billingNode.amount > 1000000) {
            violations.push('Large amount requires court approval');
            suggestions.push('Submit for court approval before proceeding');
        }
        return {
            passed: violations.length === 0,
            violations,
            suggestions,
        };
    }
    calculatePriority(node, progress) {
        if (node.dueDate && new Date() > node.dueDate) {
            return 'critical';
        }
        if (node.amount > 50000) {
            return 'high';
        }
        if (progress.overallProgress > 75) {
            return 'medium';
        }
        return 'low';
    }
    getAutomationRules() {
        return {
            enabled: true,
            rules: {
                autoGenerateInvoices: true,
                autoApproveCompletions: false,
                autoSendReminders: true,
                autoAdvanceStages: false,
            },
            triggers: {
                onTimeEntry: true,
                onDocumentUpload: true,
                onMilestoneCompletion: true,
                onPaymentReceived: true,
            },
            conditions: {
                minimumAmount: 1000,
                maximumDelay: 30,
                requiredApprovals: 1,
            },
        };
    }
    async handleAutomation(caseId, billingNodeId, trigger) {
        console.log(`Processing automation for case ${caseId}, node ${billingNodeId}, trigger ${trigger}`);
        return { processed: true };
    }
    async autoGenerateInvoices(caseId) {
        return { generated: 0 };
    }
    async sendDeadlineReminders(caseId) {
        return { sent: 0 };
    }
    async autoAdvanceStages(caseId) {
        return { advanced: false };
    }
    async storeConfiguration(caseId, configuration) {
        console.log(`Storing configuration for case ${caseId}`);
    }
}
exports.StageBillingService = StageBillingService;
//# sourceMappingURL=StageBillingService.js.map