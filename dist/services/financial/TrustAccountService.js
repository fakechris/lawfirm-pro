"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrustAccountService = void 0;
const financial_1 = require("../models/financial");
class TrustAccountService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createTrustAccount(request) {
        const client = await this.prisma.clientProfile.findUnique({
            where: { id: request.clientId },
        });
        if (!client) {
            throw new Error('Client not found');
        }
        const existingAccount = await this.prisma.trustAccount.findFirst({
            where: {
                clientId: request.clientId,
                caseId: request.caseId,
                isActive: true,
            },
        });
        if (existingAccount) {
            throw new Error('Trust account already exists for this client/case combination');
        }
        const trustAccount = await this.prisma.trustAccount.create({
            data: {
                clientId: request.clientId,
                caseId: request.caseId,
                balance: request.initialBalance || 0,
                currency: request.currency || 'CNY',
                notes: request.notes,
                isActive: true,
            },
            include: {
                client: true,
                case: true,
            },
        });
        if (request.initialBalance && request.initialBalance > 0) {
            await this.createTrustTransaction({
                trustAccountId: trustAccount.id,
                type: financial_1.TrustTransactionType.DEPOSIT,
                amount: request.initialBalance,
                description: 'Initial deposit',
                reference: 'INITIAL_DEPOSIT',
            });
        }
        return trustAccount;
    }
    async getTrustAccountById(id) {
        return this.prisma.trustAccount.findUnique({
            where: { id },
            include: {
                client: true,
                case: true,
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
            },
        });
    }
    async getTrustAccountsByClient(clientId) {
        return this.prisma.trustAccount.findMany({
            where: { clientId, isActive: true },
            include: {
                case: true,
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getTrustAccountsByCase(caseId) {
        return this.prisma.trustAccount.findMany({
            where: { caseId, isActive: true },
            include: {
                client: true,
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async createTrustTransaction(request) {
        const trustAccount = await this.prisma.trustAccount.findUnique({
            where: { id: request.trustAccountId },
        });
        if (!trustAccount) {
            throw new Error('Trust account not found');
        }
        if (!trustAccount.isActive) {
            throw new Error('Trust account is not active');
        }
        if (request.amount <= 0) {
            throw new Error('Transaction amount must be greater than 0');
        }
        if (request.type === financial_1.TrustTransactionType.WITHDRAWAL) {
            if (trustAccount.balance < request.amount) {
                throw new Error('Insufficient trust account balance');
            }
        }
        const transaction = await this.prisma.trustTransaction.create({
            data: {
                trustAccountId: request.trustAccountId,
                type: request.type,
                amount: request.amount,
                description: request.description,
                reference: request.reference,
                status: 'completed',
            },
        });
        await this.updateTrustAccountBalance(request.trustAccountId, request.type, request.amount);
        await this.handleTransactionCompliance(transaction);
        return transaction;
    }
    async getTrustAccountBalance(trustAccountId) {
        const trustAccount = await this.prisma.trustAccount.findUnique({
            where: { id: trustAccountId },
        });
        if (!trustAccount) {
            throw new Error('Trust account not found');
        }
        const pendingTransactions = await this.prisma.trustTransaction.findMany({
            where: {
                trustAccountId,
                status: 'pending',
            },
        });
        const pendingBalance = pendingTransactions.reduce((sum, transaction) => {
            return sum + transaction.amount;
        }, 0);
        return {
            totalBalance: trustAccount.balance,
            availableBalance: trustAccount.balance - pendingBalance,
            pendingBalance,
            currency: trustAccount.currency,
            lastUpdated: trustAccount.updatedAt,
        };
    }
    async generateTrustAccountStatement(trustAccountId, period) {
        const trustAccount = await this.prisma.trustAccount.findUnique({
            where: { id: trustAccountId },
            include: {
                client: true,
                case: true,
            },
        });
        if (!trustAccount) {
            throw new Error('Trust account not found');
        }
        const transactions = await this.prisma.trustTransaction.findMany({
            where: {
                trustAccountId,
                createdAt: {
                    gte: period.startDate,
                    lte: period.endDate,
                },
            },
            orderBy: { createdAt: 'asc' },
        });
        const balance = await this.getTrustAccountBalance(trustAccountId);
        const summary = {
            totalDeposits: transactions
                .filter(t => t.type === financial_1.TrustTransactionType.DEPOSIT)
                .reduce((sum, t) => sum + t.amount, 0),
            totalWithdrawals: transactions
                .filter(t => t.type === financial_1.TrustTransactionType.WITHDRAWAL)
                .reduce((sum, t) => sum + t.amount, 0),
            totalInterest: transactions
                .filter(t => t.type === financial_1.TrustTransactionType.INTEREST)
                .reduce((sum, t) => sum + t.amount, 0),
            netChange: 0,
        };
        summary.netChange = summary.totalDeposits - summary.totalWithdrawals + summary.totalInterest;
        return {
            account: trustAccount,
            transactions,
            balance,
            period,
            summary,
        };
    }
    async checkTrustAccountCompliance(trustAccountId) {
        const trustAccount = await this.prisma.trustAccount.findUnique({
            where: { id: trustAccountId },
            include: {
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 100,
                },
            },
        });
        if (!trustAccount) {
            throw new Error('Trust account not found');
        }
        const violations = [];
        const warnings = [];
        const segregationViolation = await this.checkFundSegregation(trustAccount);
        if (segregationViolation) {
            violations.push(segregationViolation);
        }
        const interestViolation = await this.checkInterestHandling(trustAccount);
        if (interestViolation) {
            violations.push(interestViolation);
        }
        const reconciliationViolation = await this.checkReconciliationStatus(trustAccount);
        if (reconciliationViolation) {
            violations.push(reconciliationViolation);
        }
        const documentationWarnings = await this.checkDocumentationCompleteness(trustAccount);
        warnings.push(...documentationWarnings);
        const notificationWarnings = await this.checkClientNotificationRequirements(trustAccount);
        warnings.push(...notificationWarnings);
        const lastReconciliationDate = await this.getLastReconciliationDate(trustAccountId);
        const nextReconciliationDate = this.calculateNextReconciliationDate(lastReconciliationDate);
        return {
            isCompliant: violations.length === 0,
            violations,
            warnings,
            requirements: {
                segregationRequired: true,
                interestHandlingRequired: true,
                reconciliationRequired: true,
                documentationRequired: true,
                clientNotificationRequired: true,
            },
            lastReconciliationDate,
            nextReconciliationDate,
        };
    }
    async processMonthlyInterest(trustAccountId) {
        const trustAccount = await this.prisma.trustAccount.findUnique({
            where: { id: trustAccountId },
        });
        if (!trustAccount) {
            throw new Error('Trust account not found');
        }
        const interestRate = 0.0025;
        const monthlyInterest = trustAccount.balance * interestRate;
        if (monthlyInterest <= 0) {
            throw new Error('No interest to accrue');
        }
        const transaction = await this.createTrustTransaction({
            trustAccountId,
            type: financial_1.TrustTransactionType.INTEREST,
            amount: monthlyInterest,
            description: 'Monthly interest accrual',
            reference: `INTEREST_${new Date().toISOString().slice(0, 7)}`,
        });
        return transaction;
    }
    async reconcileTrustAccount(trustAccountId, reconciliationData) {
        const trustAccount = await this.prisma.trustAccount.findUnique({
            where: { id: trustAccountId },
        });
        if (!trustAccount) {
            throw new Error('Trust account not found');
        }
        const balanceDiscrepancy = Math.abs(trustAccount.balance - reconciliationData.reconciledBalance);
        if (balanceDiscrepancy > 0.01) {
            throw new Error(`Balance discrepancy detected: ${balanceDiscrepancy}`);
        }
        const reconciliation = await this.prisma.trustReconciliation.create({
            data: {
                trustAccountId,
                reconciledBalance: reconciliationData.reconciledBalance,
                systemBalance: trustAccount.balance,
                discrepancies: reconciliationData.discrepancies,
                corrections: reconciliationData.corrections,
                reconciledBy: reconciliationData.reconciledBy,
                reconciledAt: new Date(),
            },
        });
        const compliance = await this.checkTrustAccountCompliance(trustAccountId);
        return {
            success: true,
            reconciliation,
            compliance,
        };
    }
    async transferTrustFunds(fromAccountId, toAccountId, amount, description, reference) {
        const fromAccount = await this.prisma.trustAccount.findUnique({
            where: { id: fromAccountId },
        });
        const toAccount = await this.prisma.trustAccount.findUnique({
            where: { id: toAccountId },
        });
        if (!fromAccount || !toAccount) {
            throw new Error('One or both trust accounts not found');
        }
        if (!fromAccount.isActive || !toAccount.isActive) {
            throw new Error('One or both trust accounts are not active');
        }
        if (fromAccount.currency !== toAccount.currency) {
            throw new Error('Currency mismatch between trust accounts');
        }
        if (fromAccount.balance < amount) {
            throw new Error('Insufficient balance in source trust account');
        }
        const fromTransaction = await this.createTrustTransaction({
            trustAccountId: fromAccountId,
            type: financial_1.TrustTransactionType.WITHDRAWAL,
            amount,
            description: `Transfer to ${toAccount.id}: ${description}`,
            reference: reference || `TRANSFER_${Date.now()}`,
        });
        const toTransaction = await this.createTrustTransaction({
            trustAccountId: toAccountId,
            type: financial_1.TrustTransactionType.DEPOSIT,
            amount,
            description: `Transfer from ${fromAccount.id}: ${description}`,
            reference: reference || `TRANSFER_${Date.now()}`,
        });
        return {
            fromTransaction,
            toTransaction,
        };
    }
    async updateTrustAccountBalance(trustAccountId, transactionType, amount) {
        let updateData;
        switch (transactionType) {
            case financial_1.TrustTransactionType.DEPOSIT:
            case financial_1.TrustTransactionType.INTEREST:
                updateData = { balance: { increment: amount } };
                break;
            case financial_1.TrustTransactionType.WITHDRAWAL:
                updateData = { balance: { decrement: amount } };
                break;
            default:
                throw new Error(`Unsupported transaction type: ${transactionType}`);
        }
        await this.prisma.trustAccount.update({
            where: { id: trustAccountId },
            data: updateData,
        });
    }
    async handleTransactionCompliance(transaction) {
        console.log(`Processing compliance for transaction ${transaction.id}`);
    }
    async checkFundSegregation(trustAccount) {
        return null;
    }
    async checkInterestHandling(trustAccount) {
        return null;
    }
    async checkReconciliationStatus(trustAccount) {
        const lastReconciliation = await this.getLastReconciliationDate(trustAccount.id);
        const nextReconciliation = this.calculateNextReconciliationDate(lastReconciliation);
        if (new Date() > nextReconciliation) {
            return 'Monthly reconciliation is overdue';
        }
        return null;
    }
    async checkDocumentationCompleteness(trustAccount) {
        const warnings = [];
        return warnings;
    }
    async checkClientNotificationRequirements(trustAccount) {
        const warnings = [];
        return warnings;
    }
    async getLastReconciliationDate(trustAccountId) {
        const reconciliation = await this.prisma.trustReconciliation.findFirst({
            where: { trustAccountId },
            orderBy: { reconciledAt: 'desc' },
        });
        return reconciliation?.reconciledAt || null;
    }
    calculateNextReconciliationDate(lastReconciliation) {
        const baseDate = lastReconciliation || new Date();
        const nextDate = new Date(baseDate);
        nextDate.setMonth(nextDate.getMonth() + 1);
        return nextDate;
    }
}
exports.TrustAccountService = TrustAccountService;
//# sourceMappingURL=TrustAccountService.js.map