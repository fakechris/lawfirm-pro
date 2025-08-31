import { PrismaClient } from '@prisma/client';
export interface InvoiceTemplate {
    id: string;
    name: string;
    description?: string;
    type: InvoiceTemplateType;
    content: TemplateContent;
    settings: TemplateSettings;
    version: number;
    status: TemplateStatus;
    createdBy: string;
    approvedBy?: string;
    approvedAt?: Date;
    isDefault: boolean;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}
export interface TemplateContent {
    header: TemplateSection;
    body: TemplateSection;
    footer: TemplateSection;
    sections: TemplateSection[];
}
export interface TemplateSection {
    id: string;
    type: SectionType;
    title?: string;
    content: string;
    isVisible: boolean;
    order: number;
    fields: TemplateField[];
}
export interface TemplateField {
    id: string;
    name: string;
    type: FieldType;
    label: string;
    value: string;
    format?: FieldFormat;
    validation?: FieldValidation;
    isRequired: boolean;
    order: number;
}
export interface TemplateSettings {
    language: 'zh-CN' | 'en-US';
    currency: string;
    taxRate: number;
    paymentTerms: number;
    logoUrl?: string;
    colorScheme: ColorScheme;
    font: TemplateFont;
    layout: TemplateLayout;
    electronicSignature: ElectronicSignatureSettings;
    chineseCompliance: ChineseInvoiceCompliance;
}
export interface ColorScheme {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
}
export interface TemplateFont {
    family: string;
    size: number;
    weight: 'normal' | 'bold' | 'light';
    lineHeight: number;
}
export interface TemplateLayout {
    pageSize: 'A4' | 'A5' | 'Letter';
    orientation: 'portrait' | 'landscape';
    margins: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
    columns: number;
}
export interface ElectronicSignatureSettings {
    enabled: boolean;
    required: boolean;
    type: 'digital' | 'electronic' | 'wet';
    certificatePath?: string;
    signatureField: string;
}
export interface ChineseInvoiceCompliance {
    fapiaoType: FapiaoType;
    taxpayerType: 'general' | 'small_scale';
    taxId: string;
    businessLicense?: string;
    bankAccount?: string;
    bankName?: string;
    address?: string;
    phone?: string;
    requiresFapiaoCode: boolean;
    requiresQRCode: boolean;
}
export interface FieldFormat {
    type: 'currency' | 'date' | 'percentage' | 'number' | 'text';
    precision?: number;
    currency?: string;
    dateFormat?: string;
}
export interface FieldValidation {
    required: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
}
export declare enum InvoiceTemplateType {
    STANDARD = "STANDARD",
    INTERIM = "INTERIM",
    FINAL = "FINAL",
    CREDIT = "CREDIT",
    PROFORMA = "PROFORMA",
    CUSTOM = "CUSTOM"
}
export declare enum TemplateStatus {
    DRAFT = "DRAFT",
    PENDING_APPROVAL = "PENDING_APPROVAL",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    ARCHIVED = "ARCHIVED"
}
export declare enum SectionType {
    HEADER = "HEADER",
    CLIENT_INFO = "CLIENT_INFO",
    INVOICE_DETAILS = "INVOICE_DETAILS",
    LINE_ITEMS = "LINE_ITEMS",
    TAX_CALCULATION = "TAX_CALCULATION",
    PAYMENT_INFO = "PAYMENT_INFO",
    TERMS = "TERMS",
    FOOTER = "FOOTER",
    CUSTOM = "CUSTOM"
}
export declare enum FieldType {
    TEXT = "TEXT",
    NUMBER = "NUMBER",
    CURRENCY = "CURRENCY",
    DATE = "DATE",
    BOOLEAN = "BOOLEAN",
    SELECT = "SELECT",
    MULTILINE_TEXT = "MULTILINE_TEXT"
}
export declare enum FapiaoType {
    SPECIAL_VAT = "SPECIAL_VAT",
    REGULAR_VAT = "REGULAR_VAT",
    ELECTRONIC_VAT = "ELECTRONIC_VAT",
    NONE = "NONE"
}
export interface TemplateCreateRequest {
    name: string;
    description?: string;
    type: InvoiceTemplateType;
    content: TemplateContent;
    settings: Partial<TemplateSettings>;
    tags?: string[];
}
export interface TemplateUpdateRequest {
    name?: string;
    description?: string;
    content?: Partial<TemplateContent>;
    settings?: Partial<TemplateSettings>;
    tags?: string[];
    status?: TemplateStatus;
}
export interface TemplateApprovalRequest {
    templateId: string;
    approved: boolean;
    comments?: string;
}
export interface TemplateVersion {
    id: string;
    templateId: string;
    version: number;
    content: TemplateContent;
    settings: TemplateSettings;
    createdBy: string;
    createdAt: Date;
    changes: string[];
}
export declare class InvoiceTemplateModel {
    private prisma;
    constructor(prisma: PrismaClient);
    createTemplate(request: TemplateCreateRequest, createdBy: string): Promise<InvoiceTemplate>;
    getTemplate(id: string): Promise<InvoiceTemplate | null>;
    getTemplates(filters?: {
        type?: InvoiceTemplateType;
        status?: TemplateStatus;
        createdBy?: string;
        tags?: string[];
    }): Promise<InvoiceTemplate[]>;
    updateTemplate(id: string, request: TemplateUpdateRequest, updatedBy: string): Promise<InvoiceTemplate>;
    approveTemplate(id: string, approvalRequest: TemplateApprovalRequest, approvedBy: string): Promise<InvoiceTemplate>;
    submitForApproval(id: string, submittedBy: string): Promise<InvoiceTemplate>;
    deleteTemplate(id: string): Promise<void>;
    setDefaultTemplate(id: string): Promise<InvoiceTemplate>;
    getDefaultTemplate(type: InvoiceTemplateType): Promise<InvoiceTemplate | null>;
    getTemplateVersions(templateId: string): Promise<TemplateVersion[]>;
    getTemplateVersion(templateId: string, version: number): Promise<TemplateVersion | null>;
    private createTemplateVersion;
    private validateChineseCompliance;
}
//# sourceMappingURL=InvoiceTemplate.d.ts.map