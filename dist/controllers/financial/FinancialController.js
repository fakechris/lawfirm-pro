"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinancialController = void 0;
const financial_1 = require("../models/financial");
class FinancialController {
    constructor(financialService) {
        this.financialService = financialService;
    }
    async createBillingNode(req, res) {
        try {
            const billingNode = await this.financialService.createBillingNode(req.body);
            res.status(201).json({ success: true, data: billingNode });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async getBillingNodesByCase(req, res) {
        try {
            const { caseId } = req.params;
            const billingNodes = await this.financialService.getBillingNodesByCase(caseId);
            res.json({ success: true, data: billingNodes });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async updateBillingNode(req, res) {
        try {
            const { id } = req.params;
            const billingNode = await this.financialService.updateBillingNode(id, req.body);
            res.json({ success: true, data: billingNode });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async createInvoice(req, res) {
        try {
            const invoice = await this.financialService.createInvoice(req.body);
            res.status(201).json({ success: true, data: invoice });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async getInvoiceById(req, res) {
        try {
            const { id } = req.params;
            const invoice = await this.financialService.getInvoiceById(id);
            if (!invoice) {
                return res.status(404).json({ success: false, error: 'Invoice not found' });
            }
            res.json({ success: true, data: invoice });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async getInvoicesByClient(req, res) {
        try {
            const { clientId } = req.params;
            const invoices = await this.financialService.getInvoicesByClient(clientId);
            res.json({ success: true, data: invoices });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async updateInvoiceStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const invoice = await this.financialService.updateInvoiceStatus(id, status);
            res.json({ success: true, data: invoice });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async createTimeEntry(req, res) {
        try {
            const timeEntry = await this.financialService.createTimeEntry(req.body);
            res.status(201).json({ success: true, data: timeEntry });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async getTimeEntriesByCase(req, res) {
        try {
            const { caseId } = req.params;
            const timeEntries = await this.financialService.getTimeEntriesByCase(caseId);
            res.json({ success: true, data: timeEntries });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async getTimeEntriesByUser(req, res) {
        try {
            const { userId } = req.params;
            const { startDate, endDate } = req.query;
            const timeEntries = await this.financialService.getTimeEntriesByUser(userId, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);
            res.json({ success: true, data: timeEntries });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async createExpense(req, res) {
        try {
            const expense = await this.financialService.createExpense(req.body);
            res.status(201).json({ success: true, data: expense });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async getExpensesByCase(req, res) {
        try {
            const { caseId } = req.params;
            const expenses = await this.financialService.getExpensesByCase(caseId);
            res.json({ success: true, data: expenses });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async getExpensesByUser(req, res) {
        try {
            const { userId } = req.params;
            const { startDate, endDate } = req.query;
            const expenses = await this.financialService.getExpensesByUser(userId, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);
            res.json({ success: true, data: expenses });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async createPayment(req, res) {
        try {
            const payment = await this.financialService.createPayment(req.body);
            res.status(201).json({ success: true, data: payment });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async updatePaymentStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const payment = await this.financialService.updatePaymentStatus(id, status);
            res.json({ success: true, data: payment });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async getPaymentsByInvoice(req, res) {
        try {
            const { invoiceId } = req.params;
            const payments = await this.financialService.getPaymentsByInvoice(invoiceId);
            res.json({ success: true, data: payments });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async createTrustAccount(req, res) {
        try {
            const trustAccount = await this.financialService.createTrustAccount(req.body);
            res.status(201).json({ success: true, data: trustAccount });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async getTrustAccountsByClient(req, res) {
        try {
            const { clientId } = req.params;
            const trustAccounts = await this.financialService.getTrustAccountsByClient(clientId);
            res.json({ success: true, data: trustAccounts });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async createTrustTransaction(req, res) {
        try {
            const transaction = await this.financialService.createTrustTransaction(req.body);
            res.status(201).json({ success: true, data: transaction });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async getFinancialReport(req, res) {
        try {
            const { caseId, clientId, startDate, endDate } = req.query;
            const report = await this.financialService.getFinancialReport(caseId, clientId, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);
            res.json({ success: true, data: report });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async generateCaseBilling(req, res) {
        try {
            const { caseId } = req.params;
            const billing = await this.financialService.generateCaseBilling(caseId);
            res.json({ success: true, data: billing });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async calculateFee(req, res) {
        try {
            const { feeType, ...params } = req.body;
            const fee = await this.financialService.calculateFee(feeType, params);
            res.json({ success: true, data: { fee, feeType, params } });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    getInvoiceStatuses(req, res) {
        const statuses = Object.values(financial_1.InvoiceStatus);
        res.json({ success: true, data: statuses });
    }
    getFeeTypes(req, res) {
        const types = Object.values(financial_1.FeeType);
        res.json({ success: true, data: types });
    }
    getExpenseCategories(req, res) {
        const categories = Object.values(financial_1.ExpenseCategory);
        res.json({ success: true, data: categories });
    }
    getPaymentMethods(req, res) {
        const methods = Object.values(financial_1.PaymentMethod);
        res.json({ success: true, data: methods });
    }
    getPaymentStatuses(req, res) {
        const statuses = Object.values(financial_1.PaymentStatus);
        res.json({ success: true, data: statuses });
    }
    getTrustTransactionTypes(req, res) {
        const types = Object.values(financial_1.TrustTransactionType);
        res.json({ success: true, data: types });
    }
    async processPayment(req, res) {
        try {
            const result = await this.financialService.processPayment(req.body);
            res.status(201).json({ success: true, data: result });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async checkPaymentStatus(req, res) {
        try {
            const { paymentId } = req.params;
            const status = await this.financialService.checkPaymentStatus(paymentId);
            res.json({ success: true, data: { status } });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async refundPayment(req, res) {
        try {
            const { paymentId } = req.params;
            const { amount, reason } = req.body;
            const result = await this.financialService.refundPayment(paymentId, amount, reason);
            res.json({ success: true, data: result });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async getPaymentHistory(req, res) {
        try {
            const { invoiceId, clientId, startDate, endDate } = req.query;
            const history = await this.financialService.getPaymentHistory(invoiceId, clientId, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);
            res.json({ success: true, data: history });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async getAvailablePaymentMethods(req, res) {
        try {
            const methods = await this.financialService.getPaymentMethods();
            res.json({ success: true, data: methods });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
}
exports.FinancialController = FinancialController;
//# sourceMappingURL=FinancialController.js.map