import { Router } from 'express';
import { FinancialController } from '../controllers/financial/FinancialController';
import { FinancialService } from '../services/financial/FinancialService';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const financialService = new FinancialService(prisma);
const financialController = new FinancialController(financialService);

// Billing Node routes
router.post('/billing-nodes', financialController.createBillingNode.bind(financialController));
router.get('/billing-nodes/case/:caseId', financialController.getBillingNodesByCase.bind(financialController));
router.put('/billing-nodes/:id', financialController.updateBillingNode.bind(financialController));

// Invoice routes
router.post('/invoices', financialController.createInvoice.bind(financialController));
router.get('/invoices/:id', financialController.getInvoiceById.bind(financialController));
router.get('/invoices/client/:clientId', financialController.getInvoicesByClient.bind(financialController));
router.put('/invoices/:id/status', financialController.updateInvoiceStatus.bind(financialController));

// Time Entry routes
router.post('/time-entries', financialController.createTimeEntry.bind(financialController));
router.get('/time-entries/case/:caseId', financialController.getTimeEntriesByCase.bind(financialController));
router.get('/time-entries/user/:userId', financialController.getTimeEntriesByUser.bind(financialController));

// Expense routes
router.post('/expenses', financialController.createExpense.bind(financialController));
router.get('/expenses/case/:caseId', financialController.getExpensesByCase.bind(financialController));
router.get('/expenses/user/:userId', financialController.getExpensesByUser.bind(financialController));

// Payment routes
router.post('/payments', financialController.createPayment.bind(financialController));
router.put('/payments/:id/status', financialController.updatePaymentStatus.bind(financialController));
router.get('/payments/invoice/:invoiceId', financialController.getPaymentsByInvoice.bind(financialController));

// Payment Processing routes
router.post('/payments/process', financialController.processPayment.bind(financialController));
router.get('/payments/:paymentId/status', financialController.checkPaymentStatus.bind(financialController));
router.post('/payments/:paymentId/refund', financialController.refundPayment.bind(financialController));
router.get('/payments/history', financialController.getPaymentHistory.bind(financialController));
router.get('/payments/methods/available', financialController.getAvailablePaymentMethods.bind(financialController));

// Trust Account routes
router.post('/trust-accounts', financialController.createTrustAccount.bind(financialController));
router.get('/trust-accounts/client/:clientId', financialController.getTrustAccountsByClient.bind(financialController));
router.post('/trust-transactions', financialController.createTrustTransaction.bind(financialController));

// Financial Reporting routes
router.get('/reports', financialController.getFinancialReport.bind(financialController));

// Stage-based Billing routes
router.get('/cases/:caseId/billing', financialController.generateCaseBilling.bind(financialController));

// Fee Calculation routes
router.post('/fees/calculate', financialController.calculateFee.bind(financialController));

// Utility routes
router.get('/utils/invoice-statuses', financialController.getInvoiceStatuses.bind(financialController));
router.get('/utils/fee-types', financialController.getFeeTypes.bind(financialController));
router.get('/utils/expense-categories', financialController.getExpenseCategories.bind(financialController));
router.get('/utils/payment-methods', financialController.getPaymentMethods.bind(financialController));
router.get('/utils/payment-statuses', financialController.getPaymentStatuses.bind(financialController));
router.get('/utils/trust-transaction-types', financialController.getTrustTransactionTypes.bind(financialController));

export default router;