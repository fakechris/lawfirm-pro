import { PrismaClient } from '@prisma/client';
import { Invoice, InvoiceItem } from '../models/financial';
import { InvoiceTemplate, TemplateContent, TemplateSection, TemplateField } from '../models/InvoiceTemplate';
import { v4 as uuidv4 } from 'uuid';

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

export class PDFGenerationService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async generateInvoicePDF(request: PDFGenerationRequest): Promise<PDFGenerationResult> {
    try {
      const startTime = Date.now();
      
      // Validate inputs
      if (!request.invoice || !request.template) {
        throw new Error('Invoice and template are required');
      }

      // Process template content
      const processedContent = this.processTemplateContent(request.template.content, request.invoice);
      
      // Generate PDF content
      const pdfContent = await this.generatePDFContent(processedContent, request.invoice, request.template, request.options);
      
      // Apply electronic signature if requested
      let finalPdfContent = pdfContent;
      if (request.options.electronicSignature?.enabled) {
        finalPdfContent = await this.applyElectronicSignature(pdfContent, request.options.electronicSignature);
      }
      
      // Apply password protection if requested
      if (request.options.password) {
        finalPdfContent = await this.applyPasswordProtection(finalPdfContent, request.options.password);
      }
      
      // Generate filename
      const filename = this.generateFilename(request.invoice, request.template);
      
      // Calculate checksum
      const checksum = this.calculateChecksum(finalPdfContent);
      
      const result: PDFGenerationResult = {
        success: true,
        pdfData: finalPdfContent,
        filename,
        size: finalPdfContent.length,
        checksum,
        generatedAt: new Date()
      };

      // Log generation
      await this.logPDFGeneration(request.invoice.id, result, Date.now() - startTime);

      return result;
    } catch (error) {
      const errorResult: PDFGenerationResult = {
        success: false,
        pdfData: Buffer.alloc(0),
        filename: '',
        size: 0,
        checksum: '',
        generatedAt: new Date(),
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };

      await this.logPDFGeneration(request.invoice.id, errorResult, 0, error);
      return errorResult;
    }
  }

  async generateInvoicePreview(invoiceId: string, options: PDFPreviewOptions): Promise<Buffer> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: true,
        user: true,
        case: true,
        template: true,
        items: true
      }
    });

    if (!invoice || !invoice.template) {
      throw new Error('Invoice or template not found');
    }

    // Generate a simplified preview
    const previewContent = this.generatePreviewContent(invoice as Invoice, invoice.template as InvoiceTemplate, options);
    
    return previewContent;
  }

  async generateBatchPDFs(request: PDFBatchRequest): Promise<PDFBatchResult> {
    const startTime = Date.now();
    const results: PDFGenerationResult[] = [];
    let totalSize = 0;

    for (const invoiceId of request.invoiceIds) {
      try {
        const invoice = await this.prisma.invoice.findUnique({
          where: { id: invoiceId },
          include: {
            client: true,
            user: true,
            case: true,
            template: true,
            items: true
          }
        });

        if (!invoice) {
          console.warn(`Invoice ${invoiceId} not found`);
          continue;
        }

        const template = request.templateId 
          ? await this.prisma.invoiceTemplate.findUnique({ where: { id: request.templateId } })
          : invoice.template;

        if (!template) {
          console.warn(`Template not found for invoice ${invoiceId}`);
          continue;
        }

        const pdfRequest: PDFGenerationRequest = {
          invoice: invoice as Invoice,
          template: template as InvoiceTemplate,
          options: request.options
        };

        const result = await this.generateInvoicePDF(pdfRequest);
        results.push(result);
        totalSize += result.size;
      } catch (error) {
        console.error(`Failed to generate PDF for invoice ${invoiceId}:`, error);
      }
    }

    let mergedPdf: Buffer | undefined;
    if (request.merge && results.length > 1) {
      mergedPdf = await this.mergePDFs(results.map(r => r.pdfData));
    }

    return {
      results,
      mergedPdf,
      totalSize,
      totalInvoices: results.length,
      processingTime: Date.now() - startTime
    };
  }

  async generateChineseFapiao(invoice: Invoice, template: InvoiceTemplate): Promise<PDFGenerationResult> {
    const requirements = this.buildChineseInvoiceRequirements(invoice, template);
    
    // Validate Chinese invoice requirements
    this.validateChineseInvoiceRequirements(requirements);

    const request: PDFGenerationRequest = {
      invoice,
      template,
      options: {
        includeQRCode: true,
        includeWatermark: true,
        language: 'zh-CN'
      }
    };

    return this.generateInvoicePDF(request);
  }

  private processTemplateContent(content: TemplateContent, invoice: Invoice): TemplateContent {
    const processedContent = { ...content };

    // Process each section
    if (processedContent.header) {
      processedContent.header = this.processSection(processedContent.header, invoice);
    }

    if (processedContent.body) {
      processedContent.body = this.processSection(processedContent.body, invoice);
    }

    if (processedContent.footer) {
      processedContent.footer = this.processSection(processedContent.footer, invoice);
    }

    // Process additional sections
    if (processedContent.sections) {
      processedContent.sections = processedContent.sections.map(section => 
        this.processSection(section, invoice)
      );
    }

    return processedContent;
  }

  private processSection(section: TemplateSection, invoice: Invoice): TemplateSection {
    const processedSection = { ...section };
    
    // Replace template variables in content
    processedSection.content = this.replaceTemplateVariables(processedSection.content, invoice);
    
    // Process fields
    if (processedSection.fields) {
      processedSection.fields = processedSection.fields.map(field => ({
        ...field,
        value: this.replaceTemplateVariables(field.value, invoice)
      }));
    }

    return processedSection;
  }

  private replaceTemplateVariables(content: string, invoice: Invoice): string {
    const variables = {
      '{{invoiceNumber}}': invoice.invoiceNumber,
      '{{invoiceDate}}': invoice.issueDate.toLocaleDateString(),
      '{{dueDate}}': invoice.dueDate.toLocaleDateString(),
      '{{clientName}}': (invoice as any).client?.name || '',
      '{{clientAddress}}': (invoice as any).client?.address || '',
      '{{clientPhone}}': (invoice as any).client?.phone || '',
      '{{clientEmail}}': (invoice as any).client?.email || '',
      '{{attorneyName}}': (invoice as any).user?.name || '',
      '{{caseNumber}}': (invoice as any).case?.caseNumber || '',
      '{{caseTitle}}': (invoice as any).case?.title || '',
      '{{subtotal}}': this.formatCurrency(invoice.subtotal, invoice.currency),
      '{{taxAmount}}': this.formatCurrency(invoice.taxAmount, invoice.currency),
      '{{total}}': this.formatCurrency(invoice.total, invoice.currency),
      '{{taxRate}}': `${(invoice.taxRate * 100).toFixed(1)}%`,
      '{{notes}}': invoice.notes || '',
      '{{status}}': invoice.status,
      '{{currency}}': invoice.currency
    };

    let processedContent = content;
    for (const [key, value] of Object.entries(variables)) {
      processedContent = processedContent.replace(new RegExp(key, 'g'), value);
    }

    return processedContent;
  }

  private async generatePDFContent(
    content: TemplateContent,
    invoice: Invoice,
    template: InvoiceTemplate,
    options: PDFGenerationRequest['options']
  ): Promise<Buffer> {
    // This would integrate with a PDF generation library like PDFKit, jsPDF, or similar
    // For now, we'll return a mock PDF buffer
    
    const pdfContent = `
      PDF Content for Invoice: ${invoice.invoiceNumber}
      Template: ${template.name}
      Generated at: ${new Date().toISOString()}
      Language: ${options.language || 'en-US'}
      Include QR Code: ${options.includeQRCode || false}
      Include Watermark: ${options.includeWatermark || false}
      
      Header:
      ${content.header.content}
      
      Body:
      ${content.body.content}
      
      Items:
      ${invoice.items.map(item => 
        `${item.description} - ${this.formatCurrency(item.amount, invoice.currency)}`
      ).join('\n')}
      
      Footer:
      ${content.footer.content}
    `;

    return Buffer.from(pdfContent, 'utf-8');
  }

  private async applyElectronicSignature(
    pdfContent: Buffer,
    signatureRequest: ElectronicSignatureRequest
  ): Promise<Buffer> {
    // This would integrate with a digital signature library
    // For now, we'll just append signature information
    
    const signatureInfo = `
      
      Electronic Signature Applied:
      Type: ${signatureRequest.type}
      Signer: ${signatureRequest.signerName}
      Title: ${signatureRequest.signerTitle}
      Date: ${signatureRequest.signatureDate.toISOString()}
      Position: ${JSON.stringify(signatureRequest.signaturePosition)}
    `;

    return Buffer.concat([pdfContent, Buffer.from(signatureInfo, 'utf-8')]);
  }

  private async applyPasswordProtection(pdfContent: Buffer, password: string): Promise<Buffer> {
    // This would integrate with a PDF encryption library
    // For now, we'll just prepend password protection info
    
    const protectionInfo = `PDF Protected with Password: ${password}\n\n`;
    return Buffer.concat([Buffer.from(protectionInfo, 'utf-8'), pdfContent]);
  }

  private generateFilename(invoice: Invoice, template: InvoiceTemplate): string {
    const sanitizedClientName = ((invoice as any).client?.name || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedInvoiceNumber = invoice.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_');
    const dateStr = invoice.issueDate.toISOString().split('T')[0];
    
    return `${sanitizedClientName}_${sanitizedInvoiceNumber}_${dateStr}.pdf`;
  }

  private calculateChecksum(data: Buffer): string {
    // Simple checksum calculation - in production, use a proper hash function
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    return sum.toString(16);
  }

  private formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount);
  }

  private generatePreviewContent(
    invoice: Invoice,
    template: InvoiceTemplate,
    options: PDFPreviewOptions
  ): Buffer {
    // Generate a simplified preview (could be implemented as an image)
    const previewText = `
      Invoice Preview: ${invoice.invoiceNumber}
      Client: ${(invoice as any).client?.name}
      Total: ${this.formatCurrency(invoice.total, invoice.currency)}
      Status: ${invoice.status}
    `;
    
    return Buffer.from(previewText, 'utf-8');
  }

  private async mergePDFs(pdfs: Buffer[]): Promise<Buffer> {
    // This would integrate with a PDF merging library
    // For now, we'll just concatenate the content
    return Buffer.concat(pdfs);
  }

  private buildChineseInvoiceRequirements(invoice: Invoice, template: InvoiceTemplate): ChineseInvoiceRequirements {
    const compliance = template.settings.chineseCompliance;
    
    return {
      fapiaoType: compliance.fapiaoType,
      taxpayerType: compliance.taxpayerType,
      taxId: compliance.taxId,
      buyerName: (invoice as any).client?.name || '',
      buyerTaxId: (invoice as any).client?.taxId,
      sellerName: 'Law Firm Pro', // This would come from firm settings
      sellerTaxId: compliance.taxId,
      sellerAddress: compliance.address,
      sellerPhone: compliance.phone,
      sellerBankAccount: compliance.bankAccount,
      sellerBankName: compliance.bankName,
      items: invoice.items.map(item => ({
        name: item.description,
        unit: 'unit',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount,
        totalWithTax: item.total
      })),
      totalAmount: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      totalWithTax: invoice.total,
      remarks: invoice.notes
    };
  }

  private validateChineseInvoiceRequirements(requirements: ChineseInvoiceRequirements): void {
    if (requirements.fapiaoType !== 'NONE') {
      if (!requirements.taxId || requirements.taxId.trim() === '') {
        throw new Error('Tax ID is required for Chinese fapiao');
      }

      if (!requirements.buyerName || requirements.buyerName.trim() === '') {
        throw new Error('Buyer name is required for Chinese fapiao');
      }

      if (!requirements.sellerName || requirements.sellerName.trim() === '') {
        throw new Error('Seller name is required for Chinese fapiao');
      }

      if (!requirements.sellerTaxId || requirements.sellerTaxId.trim() === '') {
        throw new Error('Seller tax ID is required for Chinese fapiao');
      }
    }
  }

  private async logPDFGeneration(
    invoiceId: string,
    result: PDFGenerationResult,
    processingTime: number,
    error?: any
  ): Promise<void> {
    await this.prisma.pDFGenerationLog.create({
      data: {
        id: uuidv4(),
        invoiceId,
        success: result.success,
        filename: result.filename,
        size: result.size,
        checksum: result.checksum,
        processingTime,
        generatedAt: result.generatedAt,
        error: error ? error.message : null
      }
    });
  }
}