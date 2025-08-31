import { PrismaClient } from '@prisma/client';
import { 
  Invoice, 
  InvoiceItem, 
  InvoiceStatus,
  Payment,
  PaymentStatus
} from '../models/financial';
import { InvoiceTemplate, InvoiceTemplateType } from '../models/InvoiceTemplate';
import { v4 as uuidv4 } from 'uuid';
import nodeSchedule from 'node-schedule';

export interface InvoiceCreateRequest {
  caseId?: string;
  clientId: string;
  userId: string;
  templateId?: string;
  items: InvoiceItemRequest[];
  issueDate?: Date;
  dueDate?: Date;
  notes?: string;
  currency?: string;
  taxRate?: number;
}

export interface InvoiceItemRequest {
  type: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  referenceId?: string; // For linking to time entries, expenses, etc.
}

export interface InvoiceUpdateRequest {
  status?: InvoiceStatus;
  dueDate?: Date;
  notes?: string;
  items?: InvoiceItemRequest[];
}

export interface InvoiceSendRequest {
  invoiceId: string;
  sendMethod: 'email' | 'portal' | 'both';
  recipientEmail?: string;
  message?: string;
  scheduledDate?: Date;
}

export interface InvoiceFilter {
  status?: InvoiceStatus[];
  clientId?: string;
  caseId?: string;
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  currency?: string;
  tags?: string[];
}

export interface InvoiceStatistics {
  totalInvoices: number;
  totalAmount: number;
  totalPaid: number;
  totalOutstanding: number;
  overdueInvoices: number;
  overdueAmount: number;
  averageDaysToPay: number;
  topClients: {
    clientId: string;
    clientName: string;
    totalInvoiced: number;
    totalPaid: number;
  }[];
}

export interface InvoiceReminder {
  id: string;
  invoiceId: string;
  type: 'OVERDUE' | 'DUE_SOON' | 'PAYMENT_RECEIVED';
  sentAt: Date;
  recipient: string;
  message: string;
  status: 'SENT' | 'FAILED';
}

export interface ScheduledInvoiceJob {
  id: string;
  invoiceId: string;
  scheduledAt: Date;
  sendMethod: 'email' | 'portal' | 'both';
  recipientEmail?: string;
  message?: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
  createdAt: Date;
  executedAt?: Date;
  error?: string;
}

export interface AutoInvoiceConfig {
  enabled: boolean;
  schedule: 'daily' | 'weekly' | 'monthly';
  time: string; // HH:mm format
  timezone: string;
  autoSend: boolean;
  reminderDays: number;
  overdueReminderDays: number;
  clients: string[]; // Client IDs to include
  excludeClients: string[]; // Client IDs to exclude
}

export class InvoiceService {
  private prisma: PrismaClient;
  private scheduledJobs: Map<string, nodeSchedule.Job> = new Map();
  private autoInvoiceConfig: AutoInvoiceConfig | null = null;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.initializeScheduler();
  }

  async createInvoice(request: InvoiceCreateRequest): Promise<Invoice> {
    // Validate client exists
    const client = await this.prisma.client.findUnique({
      where: { id: request.clientId }
    });

    if (!client) {
      throw new Error('Client not found');
    }

    // Validate user exists
    const user = await this.prisma.user.findUnique({
      where: { id: request.userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Validate case if provided
    if (request.caseId) {
      const caseData = await this.prisma.case.findUnique({
        where: { id: request.caseId }
      });

      if (!caseData) {
        throw new Error('Case not found');
      }

      if (caseData.clientId !== request.clientId) {
        throw new Error('Case does not belong to the specified client');
      }
    }

    // Get template if specified, otherwise use default
    let template: InvoiceTemplate | null = null;
    if (request.templateId) {
      template = await this.prisma.invoiceTemplate.findUnique({
        where: { id: request.templateId }
      }) as InvoiceTemplate | null;
    } else {
      template = await this.prisma.invoiceTemplate.findFirst({
        where: { 
          type: InvoiceTemplateType.STANDARD,
          isDefault: true,
          status: 'APPROVED'
        }
      }) as InvoiceTemplate | null;
    }

    // Calculate totals
    const subtotal = request.items.reduce((sum, item) => {
      return sum + (item.quantity * item.unitPrice);
    }, 0);

    const taxRate = request.taxRate || template?.settings.taxRate || 0.06;
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber();

    // Set dates
    const issueDate = request.issueDate || new Date();
    const dueDate = request.dueDate || this.calculateDueDate(issueDate, template?.settings.paymentTerms || 30);

    // Create invoice
    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        caseId: request.caseId,
        clientId: request.clientId,
        userId: request.userId,
        templateId: template?.id,
        status: InvoiceStatus.DRAFT,
        issueDate,
        dueDate,
        subtotal,
        taxRate,
        taxAmount,
        total,
        currency: request.currency || template?.settings.currency || 'CNY',
        notes: request.notes,
        items: {
          create: request.items.map(item => ({
            type: item.type,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.quantity * item.unitPrice,
            taxRate: item.taxRate || taxRate,
            taxAmount: (item.quantity * item.unitPrice) * (item.taxRate || taxRate),
            total: (item.quantity * item.unitPrice) * (1 + (item.taxRate || taxRate)),
            referenceId: item.referenceId
          }))
        }
      },
      include: {
        items: true,
        client: true,
        user: true,
        case: true,
        template: true
      }
    });

    return invoice as Invoice;
  }

  async getInvoice(id: string): Promise<Invoice | null> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        items: true,
        client: true,
        user: true,
        case: true,
        template: true,
        payments: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    return invoice as Invoice | null;
  }

  async getInvoices(filters: InvoiceFilter = {}): Promise<Invoice[]> {
    const where: any = {};

    if (filters.status && filters.status.length > 0) {
      where.status = { in: filters.status };
    }

    if (filters.clientId) {
      where.clientId = filters.clientId;
    }

    if (filters.caseId) {
      where.caseId = filters.caseId;
    }

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.dateFrom || filters.dateTo) {
      where.issueDate = {};
      if (filters.dateFrom) {
        where.issueDate.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.issueDate.lte = filters.dateTo;
      }
    }

    if (filters.currency) {
      where.currency = filters.currency;
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
      include: {
        items: true,
        client: true,
        user: true,
        case: true,
        template: true,
        payments: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { issueDate: 'desc' }
    });

    return invoices as Invoice[];
  }

  async updateInvoice(id: string, request: InvoiceUpdateRequest): Promise<Invoice> {
    const existingInvoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!existingInvoice) {
      throw new Error('Invoice not found');
    }

    if (existingInvoice.status !== InvoiceStatus.DRAFT) {
      throw new Error('Only draft invoices can be updated');
    }

    const updateData: any = {};

    if (request.status) updateData.status = request.status;
    if (request.dueDate) updateData.dueDate = request.dueDate;
    if (request.notes !== undefined) updateData.notes = request.notes;

    // Handle item updates
    if (request.items) {
      // Delete existing items
      await this.prisma.invoiceItem.deleteMany({
        where: { invoiceId: id }
      });

      // Calculate new totals
      const subtotal = request.items.reduce((sum, item) => {
        return sum + (item.quantity * item.unitPrice);
      }, 0);

      const taxRate = request.items[0]?.taxRate || existingInvoice.taxRate;
      const taxAmount = subtotal * taxRate;
      const total = subtotal + taxAmount;

      updateData.subtotal = subtotal;
      updateData.taxAmount = taxAmount;
      updateData.total = total;
      updateData.taxRate = taxRate;

      // Create new items
      updateData.items = {
        create: request.items.map(item => ({
          type: item.type,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.quantity * item.unitPrice,
          taxRate: item.taxRate || taxRate,
          taxAmount: (item.quantity * item.unitPrice) * (item.taxRate || taxRate),
          total: (item.quantity * item.unitPrice) * (1 + (item.taxRate || taxRate)),
          referenceId: item.referenceId
        }))
      };
    }

    const updatedInvoice = await this.prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        items: true,
        client: true,
        user: true,
        case: true,
        template: true,
        payments: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    return updatedInvoice as Invoice;
  }

  async deleteInvoice(id: string): Promise<void> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id }
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new Error('Only draft invoices can be deleted');
    }

    await this.prisma.invoice.delete({
      where: { id }
    });
  }

  async sendInvoice(request: InvoiceSendRequest): Promise<Invoice> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: request.invoiceId },
      include: {
        client: true,
        user: true,
        template: true
      }
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new Error('Only draft invoices can be sent');
    }

    // Schedule sending if future date is specified
    if (request.scheduledDate && request.scheduledDate > new Date()) {
      await this.prisma.invoice.update({
        where: { id: request.invoiceId },
        data: {
          status: InvoiceStatus.SENT,
          sentAt: request.scheduledDate
        }
      });

      // TODO: Add to scheduling system
      return this.getInvoice(request.invoiceId) as Promise<Invoice>;
    }

    // Send immediately
    let sent = false;
    let error: string | null = null;

    try {
      if (request.sendMethod === 'email' || request.sendMethod === 'both') {
        await this.sendInvoiceEmail(invoice, request.recipientEmail || invoice.client.email, request.message);
      }

      if (request.sendMethod === 'portal' || request.sendMethod === 'both') {
        await this.sendToClientPortal(invoice);
      }

      sent = true;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    // Update invoice status
    const status = sent ? InvoiceStatus.SENT : InvoiceStatus.DRAFT;
    await this.prisma.invoice.update({
      where: { id: request.invoiceId },
      data: {
        status,
        sentAt: sent ? new Date() : null,
        lastSentError: error
      }
    });

    if (!sent) {
      throw new Error(`Failed to send invoice: ${error}`);
    }

    return this.getInvoice(request.invoiceId) as Promise<Invoice>;
  }

  async getInvoiceStatistics(filters: InvoiceFilter = {}): Promise<InvoiceStatistics> {
    const where: any = {};

    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.caseId) where.caseId = filters.caseId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.dateFrom || filters.dateTo) {
      where.issueDate = {};
      if (filters.dateFrom) where.issueDate.gte = filters.dateFrom;
      if (filters.dateTo) where.issueDate.lte = filters.dateTo;
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
      include: {
        payments: true,
        client: true
      }
    });

    const totalInvoices = invoices.length;
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.total, 0);
    
    const totalPaid = invoices.reduce((sum, inv) => {
      const paid = inv.payments
        .filter(p => p.status === PaymentStatus.COMPLETED)
        .reduce((paymentSum, payment) => paymentSum + payment.amount, 0);
      return sum + paid;
    }, 0);

    const totalOutstanding = totalAmount - totalPaid;

    const overdueInvoices = invoices.filter(inv => 
      inv.status === InvoiceStatus.OVERDUE ||
      (inv.dueDate < new Date() && inv.status !== InvoiceStatus.PAID && inv.status !== InvoiceStatus.CANCELLED)
    );

    const overdueAmount = overdueInvoices.reduce((sum, inv) => {
      const paid = inv.payments
        .filter(p => p.status === PaymentStatus.COMPLETED)
        .reduce((paymentSum, payment) => paymentSum + payment.amount, 0);
      return sum + (inv.total - paid);
    }, 0);

    // Calculate average days to pay
    const paidInvoices = invoices.filter(inv => inv.status === InvoiceStatus.PAID);
    const averageDaysToPay = paidInvoices.length > 0 
      ? paidInvoices.reduce((sum, inv) => {
          const payment = inv.payments.find(p => p.status === PaymentStatus.COMPLETED);
          if (payment) {
            const days = Math.ceil((payment.createdAt.getTime() - inv.issueDate.getTime()) / (1000 * 60 * 60 * 24));
            return sum + days;
          }
          return sum;
        }, 0) / paidInvoices.length
      : 0;

    // Top clients
    const clientStats = new Map<string, { clientName: string; totalInvoiced: number; totalPaid: number }>();
    invoices.forEach(inv => {
      const key = inv.clientId;
      const current = clientStats.get(key) || { clientName: inv.client.name, totalInvoiced: 0, totalPaid: 0 };
      const paid = inv.payments
        .filter(p => p.status === PaymentStatus.COMPLETED)
        .reduce((paymentSum, payment) => paymentSum + payment.amount, 0);
      
      clientStats.set(key, {
        clientName: current.clientName,
        totalInvoiced: current.totalInvoiced + inv.total,
        totalPaid: current.totalPaid + paid
      });
    });

    const topClients = Array.from(clientStats.entries())
      .map(([clientId, stats]) => ({
        clientId,
        clientName: stats.clientName,
        totalInvoiced: stats.totalInvoiced,
        totalPaid: stats.totalPaid
      }))
      .sort((a, b) => b.totalInvoiced - a.totalInvoiced)
      .slice(0, 10);

    return {
      totalInvoices,
      totalAmount,
      totalPaid,
      totalOutstanding,
      overdueInvoices: overdueInvoices.length,
      overdueAmount,
      averageDaysToPay,
      topClients
    };
  }

  async generateInvoiceReminder(invoiceId: string, type: InvoiceReminder['type']): Promise<InvoiceReminder> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: true }
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    let message = '';
    switch (type) {
      case 'OVERDUE':
        message = `Reminder: Invoice ${invoice.invoiceNumber} is overdue. Please arrange payment at your earliest convenience.`;
        break;
      case 'DUE_SOON':
        message = `Friendly reminder: Invoice ${invoice.invoiceNumber} is due soon. Payment due date: ${invoice.dueDate.toDateString()}.`;
        break;
      case 'PAYMENT_RECEIVED':
        message = `Thank you for your payment on invoice ${invoice.invoiceNumber}. We appreciate your business.`;
        break;
    }

    const reminder = await this.prisma.invoiceReminder.create({
      data: {
        id: uuidv4(),
        invoiceId,
        type,
        sentAt: new Date(),
        recipient: invoice.client.email,
        message,
        status: 'SENT'
      }
    });

    // TODO: Actually send the reminder email
    // await this.sendReminderEmail(reminder);

    return reminder as InvoiceReminder;
  }

  async getInvoiceReminders(invoiceId?: string): Promise<InvoiceReminder[]> {
    const where: any = {};
    if (invoiceId) {
      where.invoiceId = invoiceId;
    }

    const reminders = await this.prisma.invoiceReminder.findMany({
      where,
      orderBy: { sentAt: 'desc' }
    });

    return reminders as InvoiceReminder[];
  }

  private async generateInvoiceNumber(): Promise<string> {
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

  private calculateDueDate(issueDate: Date, paymentTerms: number): Date {
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + paymentTerms);
    return dueDate;
  }

  private async sendInvoiceEmail(invoice: any, email: string, message?: string): Promise<void> {
    // TODO: Implement email sending using nodemailer
    console.log(`Sending invoice ${invoice.invoiceNumber} to ${email}`);
    
    // This would integrate with the email service
    // For now, we'll just log the action
  }

  private async sendToClientPortal(invoice: any): Promise<void> {
    // TODO: Implement client portal notification
    console.log(`Sending invoice ${invoice.invoiceNumber} to client portal`);
  }

  // Automated Invoice Scheduling Methods
  async scheduleInvoiceSending(
    invoiceId: string,
    scheduledDate: Date,
    sendMethod: 'email' | 'portal' | 'both',
    recipientEmail?: string,
    message?: string
  ): Promise<ScheduledInvoiceJob> {
    // Validate invoice exists
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId }
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (scheduledDate <= new Date()) {
      throw new Error('Scheduled date must be in the future');
    }

    // Create scheduled job
    const job: ScheduledInvoiceJob = {
      id: uuidv4(),
      invoiceId,
      scheduledAt: scheduledDate,
      sendMethod,
      recipientEmail,
      message,
      status: 'PENDING',
      createdAt: new Date()
    };

    const savedJob = await this.prisma.scheduledInvoiceJob.create({
      data: job
    });

    // Schedule the job
    const scheduledJob = nodeSchedule.scheduleJob(scheduledDate, async () => {
      await this.executeScheduledJob(savedJob.id);
    });

    this.scheduledJobs.set(savedJob.id, scheduledJob);

    return savedJob as ScheduledInvoiceJob;
  }

  async executeScheduledJob(jobId: string): Promise<void> {
    try {
      const job = await this.prisma.scheduledInvoiceJob.findUnique({
        where: { id: jobId },
        include: {
          invoice: {
            include: {
              client: true,
              template: true
            }
          }
        }
      });

      if (!job || job.status !== 'PENDING') {
        return;
      }

      // Execute the scheduled send
      await this.sendInvoice({
        invoiceId: job.invoiceId,
        sendMethod: job.sendMethod,
        recipientEmail: job.recipientEmail || job.invoice.client.email,
        message: job.message
      });

      // Update job status
      await this.prisma.scheduledInvoiceJob.update({
        where: { id: jobId },
        data: {
          status: 'SENT',
          executedAt: new Date()
        }
      });

      // Remove from memory
      this.scheduledJobs.delete(jobId);

    } catch (error) {
      console.error(`Failed to execute scheduled job ${jobId}:`, error);

      // Update job status to failed
      await this.prisma.scheduledInvoiceJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          executedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  async cancelScheduledJob(jobId: string): Promise<void> {
    const job = await this.prisma.scheduledInvoiceJob.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      throw new Error('Scheduled job not found');
    }

    if (job.status !== 'PENDING') {
      throw new Error('Cannot cancel job that is not pending');
    }

    // Cancel the scheduled job
    const scheduledJob = this.scheduledJobs.get(jobId);
    if (scheduledJob) {
      scheduledJob.cancel();
      this.scheduledJobs.delete(jobId);
    }

    // Update job status
    await this.prisma.scheduledInvoiceJob.update({
      where: { id: jobId },
      data: {
        status: 'CANCELLED',
        executedAt: new Date()
      }
    });
  }

  async getScheduledJobs(filters: {
    status?: ScheduledInvoiceJob['status'][];
    invoiceId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  } = {}): Promise<ScheduledInvoiceJob[]> {
    const where: any = {};

    if (filters.status && filters.status.length > 0) {
      where.status = { in: filters.status };
    }

    if (filters.invoiceId) {
      where.invoiceId = filters.invoiceId;
    }

    if (filters.dateFrom || filters.dateTo) {
      where.scheduledAt = {};
      if (filters.dateFrom) where.scheduledAt.gte = filters.dateFrom;
      if (filters.dateTo) where.scheduledAt.lte = filters.dateTo;
    }

    const jobs = await this.prisma.scheduledInvoiceJob.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
      include: {
        invoice: {
          include: {
            client: true,
            user: true
          }
        }
      }
    });

    return jobs as ScheduledInvoiceJob[];
  }

  async configureAutoInvoicing(config: AutoInvoiceConfig): Promise<void> {
    // Stop existing auto-invoicing if running
    this.stopAutoInvoicing();

    // Save configuration
    this.autoInvoiceConfig = config;

    if (config.enabled) {
      this.startAutoInvoicing();
    }
  }

  private startAutoInvoicing(): void {
    if (!this.autoInvoiceConfig || !this.autoInvoiceConfig.enabled) {
      return;
    }

    const { schedule, time, timezone } = this.autoInvoiceConfig;

    // Parse time
    const [hours, minutes] = time.split(':').map(Number);
    
    // Create schedule rule
    let rule: nodeSchedule.RecurrenceRule;
    switch (schedule) {
      case 'daily':
        rule = new nodeSchedule.RecurrenceRule();
        rule.hour = hours;
        rule.minute = minutes;
        rule.tz = timezone;
        break;
      case 'weekly':
        rule = new nodeSchedule.RecurrenceRule();
        rule.dayOfWeek = 1; // Monday
        rule.hour = hours;
        rule.minute = minutes;
        rule.tz = timezone;
        break;
      case 'monthly':
        rule = new nodeSchedule.RecurrenceRule();
        rule.date = 1; // First day of month
        rule.hour = hours;
        rule.minute = minutes;
        rule.tz = timezone;
        break;
    }

    // Schedule the job
    const job = nodeSchedule.scheduleJob(rule, async () => {
      await this.runAutoInvoicing();
    });

    this.scheduledJobs.set('auto-invoicing', job);
  }

  private stopAutoInvoicing(): void {
    const job = this.scheduledJobs.get('auto-invoicing');
    if (job) {
      job.cancel();
      this.scheduledJobs.delete('auto-invoicing');
    }
  }

  private async runAutoInvoicing(): Promise<void> {
    if (!this.autoInvoiceConfig) {
      return;
    }

    try {
      console.log('Running auto-invoicing...');

      // Generate invoices for unbilled items
      await this.generateAutoInvoices();

      // Send invoice reminders
      await this.sendAutoReminders();

      // Check for overdue invoices
      await this.processOverdueInvoices();

      console.log('Auto-invoicing completed successfully');
    } catch (error) {
      console.error('Auto-invoicing failed:', error);
    }
  }

  private async generateAutoInvoices(): Promise<void> {
    if (!this.autoInvoiceConfig || !this.autoInvoiceConfig.autoSend) {
      return;
    }

    // Get clients with unbilled items
    const clientsWithUnbilled = await this.getClientsWithUnbilledItems();

    for (const client of clientsWithUnbilled) {
      if (this.autoInvoiceConfig!.excludeClients.includes(client.id)) {
        continue;
      }

      if (this.autoInvoiceConfig!.clients.length > 0 && 
          !this.autoInvoiceConfig!.clients.includes(client.id)) {
        continue;
      }

      try {
        // Create invoice for unbilled items
        const invoice = await this.createInvoiceFromUnbilledItems(client.id);
        
        if (invoice && this.autoInvoiceConfig!.autoSend) {
          // Schedule immediate sending
          await this.scheduleInvoiceSending(
            invoice.id,
            new Date(),
            'email',
            client.email,
            'Your monthly invoice is ready'
          );
        }
      } catch (error) {
        console.error(`Failed to generate auto-invoice for client ${client.id}:`, error);
      }
    }
  }

  private async getClientsWithUnbilledItems(): Promise<any[]> {
    // This would query for clients with unbilled time entries and expenses
    // For now, return mock data
    return [];
  }

  private async createInvoiceFromUnbilledItems(clientId: string): Promise<Invoice | null> {
    // This would create an invoice from unbilled time entries and expenses
    // For now, return null
    return null;
  }

  private async sendAutoReminders(): Promise<void> {
    if (!this.autoInvoiceConfig) {
      return;
    }

    const { reminderDays, overdueReminderDays } = this.autoInvoiceConfig;

    // Send due soon reminders
    if (reminderDays > 0) {
      const dueSoonDate = new Date();
      dueSoonDate.setDate(dueSoonDate.getDate() + reminderDays);

      const dueSoonInvoices = await this.prisma.invoice.findMany({
        where: {
          status: InvoiceStatus.SENT,
          dueDate: {
            lte: dueSoonDate,
            gte: new Date()
          }
        },
        include: {
          client: true
        }
      });

      for (const invoice of dueSoonInvoices) {
        try {
          await this.generateInvoiceReminder(invoice.id, 'DUE_SOON');
        } catch (error) {
          console.error(`Failed to send due soon reminder for invoice ${invoice.id}:`, error);
        }
      }
    }

    // Send overdue reminders
    if (overdueReminderDays > 0) {
      const overdueDate = new Date();
      overdueDate.setDate(overdueDate.getDate() - overdueReminderDays);

      const overdueInvoices = await this.prisma.invoice.findMany({
        where: {
          status: {
            in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE]
          },
          dueDate: {
            lte: overdueDate
          }
        },
        include: {
          client: true
        }
      });

      for (const invoice of overdueInvoices) {
        try {
          await this.generateInvoiceReminder(invoice.id, 'OVERDUE');
        } catch (error) {
          console.error(`Failed to send overdue reminder for invoice ${invoice.id}:`, error);
        }
      }
    }
  }

  private async processOverdueInvoices(): Promise<void> {
    const overdueInvoices = await this.prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.SENT,
        dueDate: {
          lt: new Date()
        }
      }
    });

    for (const invoice of overdueInvoices) {
      try {
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: InvoiceStatus.OVERDUE }
        });
      } catch (error) {
        console.error(`Failed to update invoice ${invoice.id} to overdue:`, error);
      }
    }
  }

  private initializeScheduler(): void {
    // Load existing scheduled jobs from database
    this.loadScheduledJobs();
  }

  private async loadScheduledJobs(): Promise<void> {
    try {
      const pendingJobs = await this.prisma.scheduledInvoiceJob.findMany({
        where: {
          status: 'PENDING',
          scheduledAt: {
            gt: new Date()
          }
        }
      });

      for (const job of pendingJobs) {
        const scheduledJob = nodeSchedule.scheduleJob(job.scheduledAt, async () => {
          await this.executeScheduledJob(job.id);
        });

        this.scheduledJobs.set(job.id, scheduledJob);
      }
    } catch (error) {
      console.error('Failed to load scheduled jobs:', error);
    }
  }

  async getAutoInvoiceConfig(): Promise<AutoInvoiceConfig | null> {
    return this.autoInvoiceConfig;
  }

  async getSchedulerStatus(): Promise<{
    isActive: boolean;
    scheduledJobsCount: number;
    nextRun?: Date;
    config: AutoInvoiceConfig | null;
  }> {
    const autoJob = this.scheduledJobs.get('auto-invoicing');
    const nextRun = autoJob?.nextInvocation();

    return {
      isActive: autoJob !== undefined,
      scheduledJobsCount: this.scheduledJobs.size,
      nextRun,
      config: this.autoInvoiceConfig
    };
  }
}