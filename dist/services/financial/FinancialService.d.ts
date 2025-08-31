import { PrismaClient } from '@prisma/client';
import { InvoiceItem, BillingNode, InvoiceStatus, FeeType, ExpenseCategory, PaymentMethod, PaymentStatus, TrustTransactionType } from '../models/financial';
export declare class FinancialService {
    private prisma;
    private paymentGatewayService;
    constructor(prisma: PrismaClient);
    createBillingNode(data: {
        name: string;
        description?: string;
        caseId: string;
        phase: string;
        order: number;
        amount: number;
        dueDate?: Date;
        notes?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        caseId: string;
        description: string | null;
        phase: string;
        notes: string | null;
        dueDate: Date | null;
        isActive: boolean;
        amount: number;
        order: number;
    }>;
    getBillingNodesByCase(caseId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        caseId: string;
        description: string | null;
        phase: string;
        notes: string | null;
        dueDate: Date | null;
        isActive: boolean;
        amount: number;
        order: number;
    }[]>;
    updateBillingNode(id: string, data: Partial<BillingNode>): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        caseId: string;
        description: string | null;
        phase: string;
        notes: string | null;
        dueDate: Date | null;
        isActive: boolean;
        amount: number;
        order: number;
    }>;
    createInvoice(data: {
        invoiceNumber: string;
        caseId?: string;
        clientId: string;
        userId: string;
        dueDate: Date;
        items: Omit<InvoiceItem, 'id' | 'invoiceId' | 'createdAt' | 'updatedAt'>[];
    }): Promise<{
        user: {
            password: string;
            email: string;
            firstName: string;
            lastName: string;
            role: import(".prisma/client").$Enums.UserRole;
            id: string;
            createdAt: Date;
            updatedAt: Date;
        };
        case: {
            status: import(".prisma/client").$Enums.CaseStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            title: string;
            caseType: import(".prisma/client").$Enums.CaseType;
            phase: import(".prisma/client").$Enums.CasePhase;
            clientId: string;
            attorneyId: string;
            closedAt: Date | null;
        } | null;
        client: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            phone: string | null;
            address: string | null;
            company: string | null;
        };
        items: {
            type: import(".prisma/client").$Enums.InvoiceItemType;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string;
            total: number;
            taxRate: number;
            taxAmount: number;
            amount: number;
            invoiceId: string;
            quantity: number;
            unitPrice: number;
        }[];
    } & {
        status: import(".prisma/client").$Enums.InvoiceStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        caseId: string | null;
        clientId: string;
        notes: string | null;
        dueDate: Date;
        total: number;
        invoiceNumber: string;
        issueDate: Date;
        subtotal: number;
        taxRate: number;
        taxAmount: number;
        currency: string;
    }>;
    getInvoiceById(id: string): Promise<({
        user: {
            password: string;
            email: string;
            firstName: string;
            lastName: string;
            role: import(".prisma/client").$Enums.UserRole;
            id: string;
            createdAt: Date;
            updatedAt: Date;
        };
        case: {
            status: import(".prisma/client").$Enums.CaseStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            title: string;
            caseType: import(".prisma/client").$Enums.CaseType;
            phase: import(".prisma/client").$Enums.CasePhase;
            clientId: string;
            attorneyId: string;
            closedAt: Date | null;
        } | null;
        client: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            phone: string | null;
            address: string | null;
            company: string | null;
        };
        items: {
            type: import(".prisma/client").$Enums.InvoiceItemType;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string;
            total: number;
            taxRate: number;
            taxAmount: number;
            amount: number;
            invoiceId: string;
            quantity: number;
            unitPrice: number;
        }[];
        payments: {
            status: import(".prisma/client").$Enums.PaymentStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            notes: string | null;
            amount: number;
            invoiceId: string;
            method: import(".prisma/client").$Enums.PaymentMethod;
            reference: string | null;
            transactionId: string | null;
        }[];
    } & {
        status: import(".prisma/client").$Enums.InvoiceStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        caseId: string | null;
        clientId: string;
        notes: string | null;
        dueDate: Date;
        total: number;
        invoiceNumber: string;
        issueDate: Date;
        subtotal: number;
        taxRate: number;
        taxAmount: number;
        currency: string;
    }) | null>;
    getInvoicesByClient(clientId: string): Promise<({
        case: {
            status: import(".prisma/client").$Enums.CaseStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            title: string;
            caseType: import(".prisma/client").$Enums.CaseType;
            phase: import(".prisma/client").$Enums.CasePhase;
            clientId: string;
            attorneyId: string;
            closedAt: Date | null;
        } | null;
        items: {
            type: import(".prisma/client").$Enums.InvoiceItemType;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string;
            total: number;
            taxRate: number;
            taxAmount: number;
            amount: number;
            invoiceId: string;
            quantity: number;
            unitPrice: number;
        }[];
        payments: {
            status: import(".prisma/client").$Enums.PaymentStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            notes: string | null;
            amount: number;
            invoiceId: string;
            method: import(".prisma/client").$Enums.PaymentMethod;
            reference: string | null;
            transactionId: string | null;
        }[];
    } & {
        status: import(".prisma/client").$Enums.InvoiceStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        caseId: string | null;
        clientId: string;
        notes: string | null;
        dueDate: Date;
        total: number;
        invoiceNumber: string;
        issueDate: Date;
        subtotal: number;
        taxRate: number;
        taxAmount: number;
        currency: string;
    })[]>;
    updateInvoiceStatus(id: string, status: InvoiceStatus): Promise<{
        status: import(".prisma/client").$Enums.InvoiceStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        caseId: string | null;
        clientId: string;
        notes: string | null;
        dueDate: Date;
        total: number;
        invoiceNumber: string;
        issueDate: Date;
        subtotal: number;
        taxRate: number;
        taxAmount: number;
        currency: string;
    }>;
    createTimeEntry(data: {
        caseId: string;
        userId: string;
        description: string;
        hours: number;
        rate: number;
        date: Date;
        notes?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        hours: number;
        userId: string;
        caseId: string;
        description: string;
        notes: string | null;
        date: Date;
        amount: number;
        rate: number;
        isBilled: boolean;
    }>;
    getTimeEntriesByCase(caseId: string): Promise<({
        user: {
            password: string;
            email: string;
            firstName: string;
            lastName: string;
            role: import(".prisma/client").$Enums.UserRole;
            id: string;
            createdAt: Date;
            updatedAt: Date;
        };
        case: {
            status: import(".prisma/client").$Enums.CaseStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            title: string;
            caseType: import(".prisma/client").$Enums.CaseType;
            phase: import(".prisma/client").$Enums.CasePhase;
            clientId: string;
            attorneyId: string;
            closedAt: Date | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        hours: number;
        userId: string;
        caseId: string;
        description: string;
        notes: string | null;
        date: Date;
        amount: number;
        rate: number;
        isBilled: boolean;
    })[]>;
    getTimeEntriesByUser(userId: string, startDate?: Date, endDate?: Date): Promise<({
        case: {
            status: import(".prisma/client").$Enums.CaseStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            title: string;
            caseType: import(".prisma/client").$Enums.CaseType;
            phase: import(".prisma/client").$Enums.CasePhase;
            clientId: string;
            attorneyId: string;
            closedAt: Date | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        hours: number;
        userId: string;
        caseId: string;
        description: string;
        notes: string | null;
        date: Date;
        amount: number;
        rate: number;
        isBilled: boolean;
    })[]>;
    createExpense(data: {
        caseId?: string;
        userId: string;
        category: ExpenseCategory;
        description: string;
        amount: number;
        date: Date;
        receiptUrl?: string;
        notes?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        caseId: string | null;
        category: import(".prisma/client").$Enums.ExpenseCategory;
        description: string;
        notes: string | null;
        date: Date;
        amount: number;
        isBilled: boolean;
        isBillable: boolean;
        receiptUrl: string | null;
    }>;
    getExpensesByCase(caseId: string): Promise<({
        user: {
            password: string;
            email: string;
            firstName: string;
            lastName: string;
            role: import(".prisma/client").$Enums.UserRole;
            id: string;
            createdAt: Date;
            updatedAt: Date;
        };
        case: {
            status: import(".prisma/client").$Enums.CaseStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            title: string;
            caseType: import(".prisma/client").$Enums.CaseType;
            phase: import(".prisma/client").$Enums.CasePhase;
            clientId: string;
            attorneyId: string;
            closedAt: Date | null;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        caseId: string | null;
        category: import(".prisma/client").$Enums.ExpenseCategory;
        description: string;
        notes: string | null;
        date: Date;
        amount: number;
        isBilled: boolean;
        isBillable: boolean;
        receiptUrl: string | null;
    })[]>;
    getExpensesByUser(userId: string, startDate?: Date, endDate?: Date): Promise<({
        case: {
            status: import(".prisma/client").$Enums.CaseStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            title: string;
            caseType: import(".prisma/client").$Enums.CaseType;
            phase: import(".prisma/client").$Enums.CasePhase;
            clientId: string;
            attorneyId: string;
            closedAt: Date | null;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        caseId: string | null;
        category: import(".prisma/client").$Enums.ExpenseCategory;
        description: string;
        notes: string | null;
        date: Date;
        amount: number;
        isBilled: boolean;
        isBillable: boolean;
        receiptUrl: string | null;
    })[]>;
    createPayment(data: {
        invoiceId: string;
        amount: number;
        method: PaymentMethod;
        reference?: string;
        transactionId?: string;
        notes?: string;
    }): Promise<{
        status: import(".prisma/client").$Enums.PaymentStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        notes: string | null;
        amount: number;
        invoiceId: string;
        method: import(".prisma/client").$Enums.PaymentMethod;
        reference: string | null;
        transactionId: string | null;
    }>;
    updatePaymentStatus(id: string, status: PaymentStatus): Promise<{
        status: import(".prisma/client").$Enums.PaymentStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        notes: string | null;
        amount: number;
        invoiceId: string;
        method: import(".prisma/client").$Enums.PaymentMethod;
        reference: string | null;
        transactionId: string | null;
    }>;
    getPaymentsByInvoice(invoiceId: string): Promise<{
        status: import(".prisma/client").$Enums.PaymentStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        notes: string | null;
        amount: number;
        invoiceId: string;
        method: import(".prisma/client").$Enums.PaymentMethod;
        reference: string | null;
        transactionId: string | null;
    }[]>;
    createTrustAccount(data: {
        clientId: string;
        caseId?: string;
        notes?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        caseId: string | null;
        clientId: string;
        notes: string | null;
        isActive: boolean;
        currency: string;
        balance: number;
    }>;
    getTrustAccountsByClient(clientId: string): Promise<({
        case: {
            status: import(".prisma/client").$Enums.CaseStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            title: string;
            caseType: import(".prisma/client").$Enums.CaseType;
            phase: import(".prisma/client").$Enums.CasePhase;
            clientId: string;
            attorneyId: string;
            closedAt: Date | null;
        } | null;
        client: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            phone: string | null;
            address: string | null;
            company: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        caseId: string | null;
        clientId: string;
        notes: string | null;
        isActive: boolean;
        currency: string;
        balance: number;
    })[]>;
    createTrustTransaction(data: {
        trustAccountId: string;
        type: TrustTransactionType;
        amount: number;
        description: string;
        reference?: string;
    }): Promise<{
        status: string;
        type: import(".prisma/client").$Enums.TrustTransactionType;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        amount: number;
        reference: string | null;
        trustAccountId: string;
    }>;
    getFinancialReport(caseId?: string, clientId?: string, startDate?: Date, endDate?: Date): Promise<{
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
            invoices: ({
                items: {
                    type: import(".prisma/client").$Enums.InvoiceItemType;
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    description: string;
                    total: number;
                    taxRate: number;
                    taxAmount: number;
                    amount: number;
                    invoiceId: string;
                    quantity: number;
                    unitPrice: number;
                }[];
                payments: {
                    status: import(".prisma/client").$Enums.PaymentStatus;
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    notes: string | null;
                    amount: number;
                    invoiceId: string;
                    method: import(".prisma/client").$Enums.PaymentMethod;
                    reference: string | null;
                    transactionId: string | null;
                }[];
            } & {
                status: import(".prisma/client").$Enums.InvoiceStatus;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                caseId: string | null;
                clientId: string;
                notes: string | null;
                dueDate: Date;
                total: number;
                invoiceNumber: string;
                issueDate: Date;
                subtotal: number;
                taxRate: number;
                taxAmount: number;
                currency: string;
            })[];
            payments: {
                status: import(".prisma/client").$Enums.PaymentStatus;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                notes: string | null;
                amount: number;
                invoiceId: string;
                method: import(".prisma/client").$Enums.PaymentMethod;
                reference: string | null;
                transactionId: string | null;
            }[];
            expenses: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                caseId: string | null;
                category: import(".prisma/client").$Enums.ExpenseCategory;
                description: string;
                notes: string | null;
                date: Date;
                amount: number;
                isBilled: boolean;
                isBillable: boolean;
                receiptUrl: string | null;
            }[];
            timeEntries: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                hours: number;
                userId: string;
                caseId: string;
                description: string;
                notes: string | null;
                date: Date;
                amount: number;
                rate: number;
                isBilled: boolean;
            }[];
        };
    }>;
    generateCaseBilling(caseId: string): Promise<{
        currentPhase: import(".prisma/client").$Enums.CasePhase;
        billingNodes: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            caseId: string;
            description: string | null;
            phase: string;
            notes: string | null;
            dueDate: Date | null;
            isActive: boolean;
            amount: number;
            order: number;
        }[];
        unbilledTimeEntries: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            hours: number;
            userId: string;
            caseId: string;
            description: string;
            notes: string | null;
            date: Date;
            amount: number;
            rate: number;
            isBilled: boolean;
        }[];
        unbilledExpenses: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            caseId: string | null;
            category: import(".prisma/client").$Enums.ExpenseCategory;
            description: string;
            notes: string | null;
            date: Date;
            amount: number;
            isBilled: boolean;
            isBillable: boolean;
            receiptUrl: string | null;
        }[];
        suggestedInvoice: {
            caseId: string;
            clientId: string;
            items: ({
                type: "billing_node";
                description: string;
                quantity: number;
                unitPrice: number;
                amount: number;
            } | {
                type: "time_entry";
                description: string;
                quantity: number;
                unitPrice: number;
                amount: number;
            } | {
                type: "expense";
                description: string;
                quantity: number;
                unitPrice: number;
                amount: number;
            })[];
        };
    }>;
    calculateFee(feeType: FeeType, params: {
        hours?: number;
        rate?: number;
        settlementAmount?: number;
        baseAmount?: number;
        percentage?: number;
        minimum?: number;
        maximum?: number;
    }): number;
    processPayment(data: {
        invoiceId: string;
        amount: number;
        method: PaymentMethod;
        clientInfo: {
            name: string;
            email: string;
            phone?: string;
        };
        description?: string;
    }): Promise<{
        payment: {
            status: import(".prisma/client").$Enums.PaymentStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            notes: string | null;
            amount: number;
            invoiceId: string;
            method: import(".prisma/client").$Enums.PaymentMethod;
            reference: string | null;
            transactionId: string | null;
        };
        gatewayResponse: import("./PaymentGatewayService").PaymentGatewayResponse;
    }>;
    checkPaymentStatus(paymentId: string): Promise<PaymentStatus>;
    refundPayment(paymentId: string, amount?: number, reason?: string): Promise<import("./PaymentGatewayService").PaymentGatewayResponse>;
    getPaymentMethods(): Promise<PaymentMethod[]>;
    getPaymentHistory(invoiceId?: string, clientId?: string, startDate?: Date, endDate?: Date): Promise<({
        invoice: {
            case: {
                status: import(".prisma/client").$Enums.CaseStatus;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                description: string | null;
                title: string;
                caseType: import(".prisma/client").$Enums.CaseType;
                phase: import(".prisma/client").$Enums.CasePhase;
                clientId: string;
                attorneyId: string;
                closedAt: Date | null;
            } | null;
            client: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                phone: string | null;
                address: string | null;
                company: string | null;
            };
        } & {
            status: import(".prisma/client").$Enums.InvoiceStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            caseId: string | null;
            clientId: string;
            notes: string | null;
            dueDate: Date;
            total: number;
            invoiceNumber: string;
            issueDate: Date;
            subtotal: number;
            taxRate: number;
            taxAmount: number;
            currency: string;
        };
    } & {
        status: import(".prisma/client").$Enums.PaymentStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        notes: string | null;
        amount: number;
        invoiceId: string;
        method: import(".prisma/client").$Enums.PaymentMethod;
        reference: string | null;
        transactionId: string | null;
    })[]>;
    private getTotalPaidAmount;
    private updateInvoicePaymentStatus;
}
//# sourceMappingURL=FinancialService.d.ts.map