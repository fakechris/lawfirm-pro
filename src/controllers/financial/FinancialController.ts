import { Request, Response } from 'express';
import { FinancialService } from '../services/financial/FinancialService';
import { 
  InvoiceStatus, 
  FeeType, 
  ExpenseCategory, 
  PaymentMethod, 
  PaymentStatus,
  TrustTransactionType 
} from '../models/financial';

export class FinancialController {
  private financialService: FinancialService;

  constructor(financialService: FinancialService) {
    this.financialService = financialService;
  }

  // Billing Node endpoints
  async createBillingNode(req: Request, res: Response) {
    try {
      const billingNode = await this.financialService.createBillingNode(req.body);
      res.status(201).json({ success: true, data: billingNode });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }

  async getBillingNodesByCase(req: Request, res: Response) {
    try {
      const { caseId } = req.params;
      const billingNodes = await this.financialService.getBillingNodesByCase(caseId);
      res.json({ success: true, data: billingNodes });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }

  async updateBillingNode(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const billingNode = await this.financialService.updateBillingNode(id, req.body);
      res.json({ success: true, data: billingNode });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }

  // Invoice endpoints
  async createInvoice(req: Request, res: Response) {
    try {
      const invoice = await this.financialService.createInvoice(req.body);
      res.status(201).json({ success: true, data: invoice });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }

  async getInvoiceById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const invoice = await this.financialService.getInvoiceById(id);
      if (!invoice) {
        return res.status(404).json({ success: false, error: 'Invoice not found' });
      }
      res.json({ success: true, data: invoice });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }

  async getInvoicesByClient(req: Request, res: Response) {
    try {
      const { clientId } = req.params;
      const invoices = await this.financialService.getInvoicesByClient(clientId);
      res.json({ success: true, data: invoices });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }

  async updateInvoiceStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const invoice = await this.financialService.updateInvoiceStatus(id, status);
      res.json({ success: true, data: invoice });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }

  // Time Entry endpoints
  async createTimeEntry(req: Request, res: Response) {
    try {
      const timeEntry = await this.financialService.createTimeEntry(req.body);
      res.status(201).json({ success: true, data: timeEntry });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }

  async getTimeEntriesByCase(req: Request, res: Response) {
    try {
      const { caseId } = req.params;
      const timeEntries = await this.financialService.getTimeEntriesByCase(caseId);
      res.json({ success: true, data: timeEntries });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }

  async getTimeEntriesByUser(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { startDate, endDate } = req.query;
      const timeEntries = await this.financialService.getTimeEntriesByUser(
        userId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json({ success: true, data: timeEntries });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }

  // Expense endpoints
  async createExpense(req: Request, res: Response) {
    try {
      const expense = await this.financialService.createExpense(req.body);
      res.status(201).json({ success: true, data: expense });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }

  async getExpensesByCase(req: Request, res: Response) {
    try {
      const { caseId } = req.params;
      const expenses = await this.financialService.getExpensesByCase(caseId);
      res.json({ success: true, data: expenses });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }

  async getExpensesByUser(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { startDate, endDate } = req.query;
      const expenses = await this.financialService.getExpensesByUser(
        userId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json({ success: true, data: expenses });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }

  // Payment endpoints
  async createPayment(req: Request, res: Response) {
    try {
      const payment = await this.financialService.createPayment(req.body);
      res.status(201).json({ success: true, data: payment });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }

  async updatePaymentStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const payment = await this.financialService.updatePaymentStatus(id, status);
      res.json({ success: true, data: payment });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }

  async getPaymentsByInvoice(req: Request, res: Response) {
    try {
      const { invoiceId } = req.params;
      const payments = await this.financialService.getPaymentsByInvoice(invoiceId);
      res.json({ success: true, data: payments });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }

  // Trust Account endpoints
  async createTrustAccount(req: Request, res: Response) {
    try {
      const trustAccount = await this.financialService.createTrustAccount(req.body);
      res.status(201).json({ success: true, data: trustAccount });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }

  async getTrustAccountsByClient(req: Request, res: Response) {
    try {
      const { clientId } = req.params;
      const trustAccounts = await this.financialService.getTrustAccountsByClient(clientId);
      res.json({ success: true, data: trustAccounts });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }

  async createTrustTransaction(req: Request, res: Response) {
    try {
      const transaction = await this.financialService.createTrustTransaction(req.body);
      res.status(201).json({ success: true, data: transaction });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }

  // Financial Reporting endpoints
  async getFinancialReport(req: Request, res: Response) {
    try {
      const { caseId, clientId, startDate, endDate } = req.query;
      const report = await this.financialService.getFinancialReport(
        caseId as string,
        clientId as string,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json({ success: true, data: report });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }

  // Stage-based Billing endpoints
  async generateCaseBilling(req: Request, res: Response) {
    try {
      const { caseId } = req.params;
      const billing = await this.financialService.generateCaseBilling(caseId);
      res.json({ success: true, data: billing });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }

  // Fee Calculation endpoints
  async calculateFee(req: Request, res: Response) {
    try {
      const { feeType, ...params } = req.body;
      const fee = await this.financialService.calculateFee(feeType, params);
      res.json({ success: true, data: { fee, feeType, params } });
    } catch (error) {
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  }

  // Utility endpoints
  getInvoiceStatuses(req: Request, res: Response) {
    const statuses = Object.values(InvoiceStatus);
    res.json({ success: true, data: statuses });
  }

  getFeeTypes(req: Request, res: Response) {
    const types = Object.values(FeeType);
    res.json({ success: true, data: types });
  }

  getExpenseCategories(req: Request, res: Response) {
    const categories = Object.values(ExpenseCategory);
    res.json({ success: true, data: categories });
  }

  getPaymentMethods(req: Request, res: Response) {
    const methods = Object.values(PaymentMethod);
    res.json({ success: true, data: methods });
  }

  getPaymentStatuses(req: Request, res: Response) {
    const statuses = Object.values(PaymentStatus);
    res.json({ success: true, data: statuses });
  }

  getTrustTransactionTypes(req: Request, res: Response) {
    const types = Object.values(TrustTransactionType);
    res.json({ success: true, data: types });
  }
}