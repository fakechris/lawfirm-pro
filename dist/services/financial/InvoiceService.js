"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceService = void 0;
const financial_1 = require("../models/financial");
const InvoiceTemplate_1 = require("../models/InvoiceTemplate");
const uuid_1 = require("uuid");
const node_schedule_1 = __importDefault(require("node-schedule"));
class InvoiceService {
    constructor(prisma) {
        this.scheduledJobs = new Map();
        this.autoInvoiceConfig = null;
        this.prisma = prisma;
        this.initializeScheduler();
    }
    async createInvoice(request) {
        const client = await this.prisma.client.findUnique({
            where: { id: request.clientId }
        });
        if (!client) {
            throw new Error('Client not found');
        }
        const user = await this.prisma.user.findUnique({
            where: { id: request.userId }
        });
        if (!user) {
            throw new Error('User not found');
        }
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
        let template = null;
        if (request.templateId) {
            template = await this.prisma.invoiceTemplate.findUnique({
                where: { id: request.templateId }
            });
        }
        else {
            template = await this.prisma.invoiceTemplate.findFirst({
                where: {
                    type: InvoiceTemplate_1.InvoiceTemplateType.STANDARD,
                    isDefault: true,
                    status: 'APPROVED'
                }
            });
        }
        const subtotal = request.items.reduce((sum, item) => {
            return sum + (item.quantity * item.unitPrice);
        }, 0);
        const taxRate = request.taxRate || template?.settings.taxRate || 0.06;
        const taxAmount = subtotal * taxRate;
        const total = subtotal + taxAmount;
        const invoiceNumber = await this.generateInvoiceNumber();
        const issueDate = request.issueDate || new Date();
        const dueDate = request.dueDate || this.calculateDueDate(issueDate, template?.settings.paymentTerms || 30);
        const invoice = await this.prisma.invoice.create({
            data: {
                invoiceNumber,
                caseId: request.caseId,
                clientId: request.clientId,
                userId: request.userId,
                templateId: template?.id,
                status: financial_1.InvoiceStatus.DRAFT,
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
        return invoice;
    }
    async getInvoice(id) {
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
        return invoice;
    }
    async getInvoices(filters = {}) {
        const where = {};
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
        return invoices;
    }
    async updateInvoice(id, request) {
        const existingInvoice = await this.prisma.invoice.findUnique({
            where: { id },
            include: { items: true }
        });
        if (!existingInvoice) {
            throw new Error('Invoice not found');
        }
        if (existingInvoice.status !== financial_1.InvoiceStatus.DRAFT) {
            throw new Error('Only draft invoices can be updated');
        }
        const updateData = {};
        if (request.status)
            updateData.status = request.status;
        if (request.dueDate)
            updateData.dueDate = request.dueDate;
        if (request.notes !== undefined)
            updateData.notes = request.notes;
        if (request.items) {
            await this.prisma.invoiceItem.deleteMany({
                where: { invoiceId: id }
            });
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
        return updatedInvoice;
    }
    async deleteInvoice(id) {
        const invoice = await this.prisma.invoice.findUnique({
            where: { id }
        });
        if (!invoice) {
            throw new Error('Invoice not found');
        }
        if (invoice.status !== financial_1.InvoiceStatus.DRAFT) {
            throw new Error('Only draft invoices can be deleted');
        }
        await this.prisma.invoice.delete({
            where: { id }
        });
    }
    async sendInvoice(request) {
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
        if (invoice.status !== financial_1.InvoiceStatus.DRAFT) {
            throw new Error('Only draft invoices can be sent');
        }
        if (request.scheduledDate && request.scheduledDate > new Date()) {
            await this.prisma.invoice.update({
                where: { id: request.invoiceId },
                data: {
                    status: financial_1.InvoiceStatus.SENT,
                    sentAt: request.scheduledDate
                }
            });
            return this.getInvoice(request.invoiceId);
        }
        let sent = false;
        let error = null;
        try {
            if (request.sendMethod === 'email' || request.sendMethod === 'both') {
                await this.sendInvoiceEmail(invoice, request.recipientEmail || invoice.client.email, request.message);
            }
            if (request.sendMethod === 'portal' || request.sendMethod === 'both') {
                await this.sendToClientPortal(invoice);
            }
            sent = true;
        }
        catch (err) {
            error = err instanceof Error ? err.message : 'Unknown error';
        }
        const status = sent ? financial_1.InvoiceStatus.SENT : financial_1.InvoiceStatus.DRAFT;
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
        return this.getInvoice(request.invoiceId);
    }
    async getInvoiceStatistics(filters = {}) {
        const where = {};
        if (filters.clientId)
            where.clientId = filters.clientId;
        if (filters.caseId)
            where.caseId = filters.caseId;
        if (filters.userId)
            where.userId = filters.userId;
        if (filters.dateFrom || filters.dateTo) {
            where.issueDate = {};
            if (filters.dateFrom)
                where.issueDate.gte = filters.dateFrom;
            if (filters.dateTo)
                where.issueDate.lte = filters.dateTo;
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
                .filter(p => p.status === financial_1.PaymentStatus.COMPLETED)
                .reduce((paymentSum, payment) => paymentSum + payment.amount, 0);
            return sum + paid;
        }, 0);
        const totalOutstanding = totalAmount - totalPaid;
        const overdueInvoices = invoices.filter(inv => inv.status === financial_1.InvoiceStatus.OVERDUE ||
            (inv.dueDate < new Date() && inv.status !== financial_1.InvoiceStatus.PAID && inv.status !== financial_1.InvoiceStatus.CANCELLED));
        const overdueAmount = overdueInvoices.reduce((sum, inv) => {
            const paid = inv.payments
                .filter(p => p.status === financial_1.PaymentStatus.COMPLETED)
                .reduce((paymentSum, payment) => paymentSum + payment.amount, 0);
            return sum + (inv.total - paid);
        }, 0);
        const paidInvoices = invoices.filter(inv => inv.status === financial_1.InvoiceStatus.PAID);
        const averageDaysToPay = paidInvoices.length > 0
            ? paidInvoices.reduce((sum, inv) => {
                const payment = inv.payments.find(p => p.status === financial_1.PaymentStatus.COMPLETED);
                if (payment) {
                    const days = Math.ceil((payment.createdAt.getTime() - inv.issueDate.getTime()) / (1000 * 60 * 60 * 24));
                    return sum + days;
                }
                return sum;
            }, 0) / paidInvoices.length
            : 0;
        const clientStats = new Map();
        invoices.forEach(inv => {
            const key = inv.clientId;
            const current = clientStats.get(key) || { clientName: inv.client.name, totalInvoiced: 0, totalPaid: 0 };
            const paid = inv.payments
                .filter(p => p.status === financial_1.PaymentStatus.COMPLETED)
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
    async generateInvoiceReminder(invoiceId, type) {
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
                id: (0, uuid_1.v4)(),
                invoiceId,
                type,
                sentAt: new Date(),
                recipient: invoice.client.email,
                message,
                status: 'SENT'
            }
        });
        return reminder;
    }
    async getInvoiceReminders(invoiceId) {
        const where = {};
        if (invoiceId) {
            where.invoiceId = invoiceId;
        }
        const reminders = await this.prisma.invoiceReminder.findMany({
            where,
            orderBy: { sentAt: 'desc' }
        });
        return reminders;
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
    async sendInvoiceEmail(invoice, email, message) {
        console.log(`Sending invoice ${invoice.invoiceNumber} to ${email}`);
    }
    async sendToClientPortal(invoice) {
        console.log(`Sending invoice ${invoice.invoiceNumber} to client portal`);
    }
    async scheduleInvoiceSending(invoiceId, scheduledDate, sendMethod, recipientEmail, message) {
        const invoice = await this.prisma.invoice.findUnique({
            where: { id: invoiceId }
        });
        if (!invoice) {
            throw new Error('Invoice not found');
        }
        if (scheduledDate <= new Date()) {
            throw new Error('Scheduled date must be in the future');
        }
        const job = {
            id: (0, uuid_1.v4)(),
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
        const scheduledJob = node_schedule_1.default.scheduleJob(scheduledDate, async () => {
            await this.executeScheduledJob(savedJob.id);
        });
        this.scheduledJobs.set(savedJob.id, scheduledJob);
        return savedJob;
    }
    async executeScheduledJob(jobId) {
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
            await this.sendInvoice({
                invoiceId: job.invoiceId,
                sendMethod: job.sendMethod,
                recipientEmail: job.recipientEmail || job.invoice.client.email,
                message: job.message
            });
            await this.prisma.scheduledInvoiceJob.update({
                where: { id: jobId },
                data: {
                    status: 'SENT',
                    executedAt: new Date()
                }
            });
            this.scheduledJobs.delete(jobId);
        }
        catch (error) {
            console.error(`Failed to execute scheduled job ${jobId}:`, error);
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
    async cancelScheduledJob(jobId) {
        const job = await this.prisma.scheduledInvoiceJob.findUnique({
            where: { id: jobId }
        });
        if (!job) {
            throw new Error('Scheduled job not found');
        }
        if (job.status !== 'PENDING') {
            throw new Error('Cannot cancel job that is not pending');
        }
        const scheduledJob = this.scheduledJobs.get(jobId);
        if (scheduledJob) {
            scheduledJob.cancel();
            this.scheduledJobs.delete(jobId);
        }
        await this.prisma.scheduledInvoiceJob.update({
            where: { id: jobId },
            data: {
                status: 'CANCELLED',
                executedAt: new Date()
            }
        });
    }
    async getScheduledJobs(filters = {}) {
        const where = {};
        if (filters.status && filters.status.length > 0) {
            where.status = { in: filters.status };
        }
        if (filters.invoiceId) {
            where.invoiceId = filters.invoiceId;
        }
        if (filters.dateFrom || filters.dateTo) {
            where.scheduledAt = {};
            if (filters.dateFrom)
                where.scheduledAt.gte = filters.dateFrom;
            if (filters.dateTo)
                where.scheduledAt.lte = filters.dateTo;
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
        return jobs;
    }
    async configureAutoInvoicing(config) {
        this.stopAutoInvoicing();
        this.autoInvoiceConfig = config;
        if (config.enabled) {
            this.startAutoInvoicing();
        }
    }
    startAutoInvoicing() {
        if (!this.autoInvoiceConfig || !this.autoInvoiceConfig.enabled) {
            return;
        }
        const { schedule, time, timezone } = this.autoInvoiceConfig;
        const [hours, minutes] = time.split(':').map(Number);
        let rule;
        switch (schedule) {
            case 'daily':
                rule = new node_schedule_1.default.RecurrenceRule();
                rule.hour = hours;
                rule.minute = minutes;
                rule.tz = timezone;
                break;
            case 'weekly':
                rule = new node_schedule_1.default.RecurrenceRule();
                rule.dayOfWeek = 1;
                rule.hour = hours;
                rule.minute = minutes;
                rule.tz = timezone;
                break;
            case 'monthly':
                rule = new node_schedule_1.default.RecurrenceRule();
                rule.date = 1;
                rule.hour = hours;
                rule.minute = minutes;
                rule.tz = timezone;
                break;
        }
        const job = node_schedule_1.default.scheduleJob(rule, async () => {
            await this.runAutoInvoicing();
        });
        this.scheduledJobs.set('auto-invoicing', job);
    }
    stopAutoInvoicing() {
        const job = this.scheduledJobs.get('auto-invoicing');
        if (job) {
            job.cancel();
            this.scheduledJobs.delete('auto-invoicing');
        }
    }
    async runAutoInvoicing() {
        if (!this.autoInvoiceConfig) {
            return;
        }
        try {
            console.log('Running auto-invoicing...');
            await this.generateAutoInvoices();
            await this.sendAutoReminders();
            await this.processOverdueInvoices();
            console.log('Auto-invoicing completed successfully');
        }
        catch (error) {
            console.error('Auto-invoicing failed:', error);
        }
    }
    async generateAutoInvoices() {
        if (!this.autoInvoiceConfig || !this.autoInvoiceConfig.autoSend) {
            return;
        }
        const clientsWithUnbilled = await this.getClientsWithUnbilledItems();
        for (const client of clientsWithUnbilled) {
            if (this.autoInvoiceConfig.excludeClients.includes(client.id)) {
                continue;
            }
            if (this.autoInvoiceConfig.clients.length > 0 &&
                !this.autoInvoiceConfig.clients.includes(client.id)) {
                continue;
            }
            try {
                const invoice = await this.createInvoiceFromUnbilledItems(client.id);
                if (invoice && this.autoInvoiceConfig.autoSend) {
                    await this.scheduleInvoiceSending(invoice.id, new Date(), 'email', client.email, 'Your monthly invoice is ready');
                }
            }
            catch (error) {
                console.error(`Failed to generate auto-invoice for client ${client.id}:`, error);
            }
        }
    }
    async getClientsWithUnbilledItems() {
        return [];
    }
    async createInvoiceFromUnbilledItems(clientId) {
        return null;
    }
    async sendAutoReminders() {
        if (!this.autoInvoiceConfig) {
            return;
        }
        const { reminderDays, overdueReminderDays } = this.autoInvoiceConfig;
        if (reminderDays > 0) {
            const dueSoonDate = new Date();
            dueSoonDate.setDate(dueSoonDate.getDate() + reminderDays);
            const dueSoonInvoices = await this.prisma.invoice.findMany({
                where: {
                    status: financial_1.InvoiceStatus.SENT,
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
                }
                catch (error) {
                    console.error(`Failed to send due soon reminder for invoice ${invoice.id}:`, error);
                }
            }
        }
        if (overdueReminderDays > 0) {
            const overdueDate = new Date();
            overdueDate.setDate(overdueDate.getDate() - overdueReminderDays);
            const overdueInvoices = await this.prisma.invoice.findMany({
                where: {
                    status: {
                        in: [financial_1.InvoiceStatus.SENT, financial_1.InvoiceStatus.OVERDUE]
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
                }
                catch (error) {
                    console.error(`Failed to send overdue reminder for invoice ${invoice.id}:`, error);
                }
            }
        }
    }
    async processOverdueInvoices() {
        const overdueInvoices = await this.prisma.invoice.findMany({
            where: {
                status: financial_1.InvoiceStatus.SENT,
                dueDate: {
                    lt: new Date()
                }
            }
        });
        for (const invoice of overdueInvoices) {
            try {
                await this.prisma.invoice.update({
                    where: { id: invoice.id },
                    data: { status: financial_1.InvoiceStatus.OVERDUE }
                });
            }
            catch (error) {
                console.error(`Failed to update invoice ${invoice.id} to overdue:`, error);
            }
        }
    }
    initializeScheduler() {
        this.loadScheduledJobs();
    }
    async loadScheduledJobs() {
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
                const scheduledJob = node_schedule_1.default.scheduleJob(job.scheduledAt, async () => {
                    await this.executeScheduledJob(job.id);
                });
                this.scheduledJobs.set(job.id, scheduledJob);
            }
        }
        catch (error) {
            console.error('Failed to load scheduled jobs:', error);
        }
    }
    async getAutoInvoiceConfig() {
        return this.autoInvoiceConfig;
    }
    async getSchedulerStatus() {
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
exports.InvoiceService = InvoiceService;
//# sourceMappingURL=InvoiceService.js.map