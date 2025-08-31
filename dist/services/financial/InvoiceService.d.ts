import { PrismaClient } from '@prisma/client';
import { Invoice, InvoiceStatus } from '../models/financial';
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
    referenceId?: string;
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
    time: string;
    timezone: string;
    autoSend: boolean;
    reminderDays: number;
    overdueReminderDays: number;
    clients: string[];
    excludeClients: string[];
}
export declare class InvoiceService {
    private prisma;
    private scheduledJobs;
    private autoInvoiceConfig;
    constructor(prisma: PrismaClient);
    createInvoice(request: InvoiceCreateRequest): Promise<Invoice>;
    getInvoice(id: string): Promise<Invoice | null>;
    getInvoices(filters?: InvoiceFilter): Promise<Invoice[]>;
    updateInvoice(id: string, request: InvoiceUpdateRequest): Promise<Invoice>;
    deleteInvoice(id: string): Promise<void>;
    sendInvoice(request: InvoiceSendRequest): Promise<Invoice>;
    getInvoiceStatistics(filters?: InvoiceFilter): Promise<InvoiceStatistics>;
    generateInvoiceReminder(invoiceId: string, type: InvoiceReminder['type']): Promise<InvoiceReminder>;
    getInvoiceReminders(invoiceId?: string): Promise<InvoiceReminder[]>;
    private generateInvoiceNumber;
    private calculateDueDate;
    private sendInvoiceEmail;
    private sendToClientPortal;
    scheduleInvoiceSending(invoiceId: string, scheduledDate: Date, sendMethod: 'email' | 'portal' | 'both', recipientEmail?: string, message?: string): Promise<ScheduledInvoiceJob>;
    executeScheduledJob(jobId: string): Promise<void>;
    cancelScheduledJob(jobId: string): Promise<void>;
    getScheduledJobs(filters?: {
        status?: ScheduledInvoiceJob['status'][];
        invoiceId?: string;
        dateFrom?: Date;
        dateTo?: Date;
    }): Promise<ScheduledInvoiceJob[]>;
    configureAutoInvoicing(config: AutoInvoiceConfig): Promise<void>;
    private startAutoInvoicing;
    private stopAutoInvoicing;
    private runAutoInvoicing;
    private generateAutoInvoices;
    private getClientsWithUnbilledItems;
    private createInvoiceFromUnbilledItems;
    private sendAutoReminders;
    private processOverdueInvoices;
    private initializeScheduler;
    private loadScheduledJobs;
    getAutoInvoiceConfig(): Promise<AutoInvoiceConfig | null>;
    getSchedulerStatus(): Promise<{
        isActive: boolean;
        scheduledJobsCount: number;
        nextRun?: Date;
        config: AutoInvoiceConfig | null;
    }>;
}
//# sourceMappingURL=InvoiceService.d.ts.map