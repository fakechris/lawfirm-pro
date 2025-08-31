export interface Invoice {
    id: string;
    invoiceNumber: string;
    caseId?: string;
    clientId: string;
    userId: string;
    status: InvoiceStatus;
    issueDate: Date;
    dueDate: Date;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    total: number;
    currency: string;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface InvoiceItem {
    id: string;
    invoiceId: string;
    type: string;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    taxRate: number;
    taxAmount: number;
    total: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface BillingNode {
    id: string;
    name: string;
    description?: string;
    caseId: string;
    phase: string;
    order: number;
    amount: number;
    isPaid: boolean;
    dueDate?: Date;
    paidDate?: Date;
    notes?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface FeeStructure {
    id: string;
    name: string;
    type: string;
    description?: string;
    rate?: number;
    percentage?: number;
    minimum?: number;
    maximum?: number;
    currency: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface TimeEntry {
    id: string;
    caseId: string;
    userId: string;
    description: string;
    hours: number;
    rate: number;
    amount: number;
    date: Date;
    isBillable: boolean;
    isBilled: boolean;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface Expense {
    id: string;
    caseId?: string;
    userId: string;
    category: ExpenseCategory;
    description: string;
    amount: number;
    currency: string;
    date: Date;
    isBillable: boolean;
    isBilled: boolean;
    isReimbursed: boolean;
    receiptUrl?: string;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface Payment {
    id: string;
    invoiceId: string;
    amount: number;
    currency: string;
    method: PaymentMethod;
    reference?: string;
    status: PaymentStatus;
    transactionId?: string;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface TrustAccount {
    id: string;
    clientId: string;
    caseId?: string;
    balance: number;
    currency: string;
    isActive: boolean;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface TrustTransaction {
    id: string;
    trustAccountId: string;
    type: TrustTransactionType;
    amount: number;
    description: string;
    reference?: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare enum InvoiceStatus {
    DRAFT = "DRAFT",
    SENT = "SENT",
    PARTIALLY_PAID = "PARTIALLY_PAID",
    PAID = "PAID",
    OVERDUE = "OVERDUE",
    CANCELLED = "CANCELLED"
}
export declare enum FeeType {
    HOURLY = "HOURLY",
    FLAT = "FLAT",
    CONTINGENCY = "CONTINGENCY",
    RETAINER = "RETAINER",
    HYBRID = "HYBRID"
}
export declare enum ExpenseCategory {
    FILING_FEES = "FILING_FEES",
    COURT_COSTS = "COURT_COSTS",
    TRAVEL = "TRAVEL",
    RESEARCH = "RESEARCH",
    EXPERT_WITNESS = "EXPERT_WITNESS",
    COPYING = "COPYING",
    POSTAGE = "POSTAGE",
    MEALS = "MEALS",
    ACCOMMODATION = "ACCOMMODATION",
    TRANSLATION = "TRANSLATION",
    OTHER = "OTHER"
}
export declare enum PaymentMethod {
    CASH = "CASH",
    BANK_TRANSFER = "BANK_TRANSFER",
    ALIPAY = "ALIPAY",
    WECHAT_PAY = "WECHAT_PAY",
    CREDIT_CARD = "CREDIT_CARD",
    CHECK = "CHECK",
    OTHER = "OTHER"
}
export declare enum PaymentStatus {
    PENDING = "PENDING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
    REFUNDED = "REFUNDED",
    PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED"
}
export declare enum TrustTransactionType {
    DEPOSIT = "DEPOSIT",
    WITHDRAWAL = "WITHDRAWAL",
    TRANSFER = "TRANSFER",
    INTEREST = "INTEREST"
}
export interface FinancialReport {
    summary: {
        totalInvoiced: number;
        totalPaid: number;
        totalExpenses: number;
        totalHours: number;
        totalTimeValue: number;
        outstandingBalance: number;
        profit: number;
    };
    details: {
        invoices: Invoice[];
        payments: Payment[];
        expenses: Expense[];
        timeEntries: TimeEntry[];
    };
}
export interface BillingSuggestion {
    currentPhase: string;
    billingNodes: BillingNode[];
    unbilledTimeEntries: TimeEntry[];
    unbilledExpenses: Expense[];
    suggestedInvoice: {
        caseId: string;
        clientId: string;
        items: InvoiceItem[];
    };
}
export interface FeeCalculationParams {
    hours?: number;
    rate?: number;
    settlementAmount?: number;
    baseAmount?: number;
    percentage?: number;
    minimum?: number;
    maximum?: number;
}
//# sourceMappingURL=index.d.ts.map