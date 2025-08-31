import { PrismaClient } from '@prisma/client';
import { Invoice } from '../models/financial';
import { InvoiceTemplate } from '../models/InvoiceTemplate';
export interface PDFGenerationRequest {
    invoice: Invoice;
    template: InvoiceTemplate;
    options: {
        includeQRCode?: boolean;
        includeWatermark?: boolean;
        electronicSignature?: ElectronicSignatureRequest;
        language?: 'zh-CN' | 'en-US';
        password?: string;
    };
}
export interface ElectronicSignatureRequest {
    enabled: boolean;
    type: 'digital' | 'electronic' | 'wet';
    certificatePath?: string;
    signatureData?: string;
    signaturePosition: {
        x: number;
        y: number;
        width: number;
        height: number;
        page: number;
    };
    signerName: string;
    signerTitle: string;
    signatureDate: Date;
}
export interface PDFGenerationResult {
    success: boolean;
    pdfData: Buffer;
    filename: string;
    size: number;
    checksum: string;
    generatedAt: Date;
    errors?: string[];
}
export interface PDFPreviewOptions {
    format: 'png' | 'jpg';
    quality: number;
    width?: number;
    height?: number;
    page?: number;
}
export interface ChineseInvoiceRequirements {
    fapiaoType: 'SPECIAL_VAT' | 'REGULAR_VAT' | 'ELECTRONIC_VAT' | 'NONE';
    taxpayerType: 'general' | 'small_scale';
    taxId: string;
    buyerName: string;
    buyerTaxId?: string;
    sellerName: string;
    sellerTaxId: string;
    sellerAddress?: string;
    sellerPhone?: string;
    sellerBankAccount?: string;
    sellerBankName?: string;
    items: ChineseInvoiceItem[];
    totalAmount: number;
    taxAmount: number;
    totalWithTax: number;
    remarks?: string;
}
export interface ChineseInvoiceItem {
    name: string;
    specification?: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    taxRate: number;
    taxAmount: number;
    totalWithTax: number;
}
export interface PDFBatchRequest {
    invoiceIds: string[];
    templateId?: string;
    options: PDFGenerationRequest['options'];
    merge?: boolean;
}
export interface PDFBatchResult {
    results: PDFGenerationResult[];
    mergedPdf?: Buffer;
    totalSize: number;
    totalInvoices: number;
    processingTime: number;
}
export declare class PDFGenerationService {
    private prisma;
    constructor(prisma: PrismaClient);
    generateInvoicePDF(request: PDFGenerationRequest): Promise<PDFGenerationResult>;
    generateInvoicePreview(invoiceId: string, options: PDFPreviewOptions): Promise<Buffer>;
    generateBatchPDFs(request: PDFBatchRequest): Promise<PDFBatchResult>;
    generateChineseFapiao(invoice: Invoice, template: InvoiceTemplate): Promise<PDFGenerationResult>;
    private processTemplateContent;
    private processSection;
    private replaceTemplateVariables;
    private generatePDFContent;
    private applyElectronicSignature;
    private applyPasswordProtection;
    private generateFilename;
    private calculateChecksum;
    private formatCurrency;
    private generatePreviewContent;
    private mergePDFs;
    private buildChineseInvoiceRequirements;
    private validateChineseInvoiceRequirements;
    private logPDFGeneration;
}
//# sourceMappingURL=PDFGenerationService.d.ts.map