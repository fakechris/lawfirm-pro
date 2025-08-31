"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PDFGenerationService = void 0;
const uuid_1 = require("uuid");
class PDFGenerationService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async generateInvoicePDF(request) {
        try {
            const startTime = Date.now();
            if (!request.invoice || !request.template) {
                throw new Error('Invoice and template are required');
            }
            const processedContent = this.processTemplateContent(request.template.content, request.invoice);
            const pdfContent = await this.generatePDFContent(processedContent, request.invoice, request.template, request.options);
            let finalPdfContent = pdfContent;
            if (request.options.electronicSignature?.enabled) {
                finalPdfContent = await this.applyElectronicSignature(pdfContent, request.options.electronicSignature);
            }
            if (request.options.password) {
                finalPdfContent = await this.applyPasswordProtection(finalPdfContent, request.options.password);
            }
            const filename = this.generateFilename(request.invoice, request.template);
            const checksum = this.calculateChecksum(finalPdfContent);
            const result = {
                success: true,
                pdfData: finalPdfContent,
                filename,
                size: finalPdfContent.length,
                checksum,
                generatedAt: new Date()
            };
            await this.logPDFGeneration(request.invoice.id, result, Date.now() - startTime);
            return result;
        }
        catch (error) {
            const errorResult = {
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
    async generateInvoicePreview(invoiceId, options) {
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
        const previewContent = this.generatePreviewContent(invoice, invoice.template, options);
        return previewContent;
    }
    async generateBatchPDFs(request) {
        const startTime = Date.now();
        const results = [];
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
                const pdfRequest = {
                    invoice: invoice,
                    template: template,
                    options: request.options
                };
                const result = await this.generateInvoicePDF(pdfRequest);
                results.push(result);
                totalSize += result.size;
            }
            catch (error) {
                console.error(`Failed to generate PDF for invoice ${invoiceId}:`, error);
            }
        }
        let mergedPdf;
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
    async generateChineseFapiao(invoice, template) {
        const requirements = this.buildChineseInvoiceRequirements(invoice, template);
        this.validateChineseInvoiceRequirements(requirements);
        const request = {
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
    processTemplateContent(content, invoice) {
        const processedContent = { ...content };
        if (processedContent.header) {
            processedContent.header = this.processSection(processedContent.header, invoice);
        }
        if (processedContent.body) {
            processedContent.body = this.processSection(processedContent.body, invoice);
        }
        if (processedContent.footer) {
            processedContent.footer = this.processSection(processedContent.footer, invoice);
        }
        if (processedContent.sections) {
            processedContent.sections = processedContent.sections.map(section => this.processSection(section, invoice));
        }
        return processedContent;
    }
    processSection(section, invoice) {
        const processedSection = { ...section };
        processedSection.content = this.replaceTemplateVariables(processedSection.content, invoice);
        if (processedSection.fields) {
            processedSection.fields = processedSection.fields.map(field => ({
                ...field,
                value: this.replaceTemplateVariables(field.value, invoice)
            }));
        }
        return processedSection;
    }
    replaceTemplateVariables(content, invoice) {
        const variables = {
            '{{invoiceNumber}}': invoice.invoiceNumber,
            '{{invoiceDate}}': invoice.issueDate.toLocaleDateString(),
            '{{dueDate}}': invoice.dueDate.toLocaleDateString(),
            '{{clientName}}': invoice.client?.name || '',
            '{{clientAddress}}': invoice.client?.address || '',
            '{{clientPhone}}': invoice.client?.phone || '',
            '{{clientEmail}}': invoice.client?.email || '',
            '{{attorneyName}}': invoice.user?.name || '',
            '{{caseNumber}}': invoice.case?.caseNumber || '',
            '{{caseTitle}}': invoice.case?.title || '',
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
    async generatePDFContent(content, invoice, template, options) {
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
      ${invoice.items.map(item => `${item.description} - ${this.formatCurrency(item.amount, invoice.currency)}`).join('\n')}
      
      Footer:
      ${content.footer.content}
    `;
        return Buffer.from(pdfContent, 'utf-8');
    }
    async applyElectronicSignature(pdfContent, signatureRequest) {
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
    async applyPasswordProtection(pdfContent, password) {
        const protectionInfo = `PDF Protected with Password: ${password}\n\n`;
        return Buffer.concat([Buffer.from(protectionInfo, 'utf-8'), pdfContent]);
    }
    generateFilename(invoice, template) {
        const sanitizedClientName = (invoice.client?.name || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_');
        const sanitizedInvoiceNumber = invoice.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_');
        const dateStr = invoice.issueDate.toISOString().split('T')[0];
        return `${sanitizedClientName}_${sanitizedInvoiceNumber}_${dateStr}.pdf`;
    }
    calculateChecksum(data) {
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum += data[i];
        }
        return sum.toString(16);
    }
    formatCurrency(amount, currency) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'USD'
        }).format(amount);
    }
    generatePreviewContent(invoice, template, options) {
        const previewText = `
      Invoice Preview: ${invoice.invoiceNumber}
      Client: ${invoice.client?.name}
      Total: ${this.formatCurrency(invoice.total, invoice.currency)}
      Status: ${invoice.status}
    `;
        return Buffer.from(previewText, 'utf-8');
    }
    async mergePDFs(pdfs) {
        return Buffer.concat(pdfs);
    }
    buildChineseInvoiceRequirements(invoice, template) {
        const compliance = template.settings.chineseCompliance;
        return {
            fapiaoType: compliance.fapiaoType,
            taxpayerType: compliance.taxpayerType,
            taxId: compliance.taxId,
            buyerName: invoice.client?.name || '',
            buyerTaxId: invoice.client?.taxId,
            sellerName: 'Law Firm Pro',
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
    validateChineseInvoiceRequirements(requirements) {
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
    async logPDFGeneration(invoiceId, result, processingTime, error) {
        await this.prisma.pDFGenerationLog.create({
            data: {
                id: (0, uuid_1.v4)(),
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
exports.PDFGenerationService = PDFGenerationService;
//# sourceMappingURL=PDFGenerationService.js.map