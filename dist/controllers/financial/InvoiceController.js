"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceController = void 0;
const client_1 = require("@prisma/client");
const InvoiceService_1 = require("../../services/financial/InvoiceService");
const InvoiceTemplateService_1 = require("../../services/financial/InvoiceTemplateService");
const PDFGenerationService_1 = require("../../services/financial/PDFGenerationService");
const financial_1 = require("../../models/financial");
const zod_1 = require("zod");
const prisma = new client_1.PrismaClient();
const invoiceService = new InvoiceService_1.InvoiceService(prisma);
const templateService = new InvoiceTemplateService_1.InvoiceTemplateService(prisma);
const pdfService = new PDFGenerationService_1.PDFGenerationService(prisma);
const createInvoiceSchema = zod_1.z.object({
    caseId: zod_1.z.string().optional(),
    clientId: zod_1.z.string(),
    userId: zod_1.z.string(),
    templateId: zod_1.z.string().optional(),
    items: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.string(),
        description: zod_1.z.string(),
        quantity: zod_1.z.number().positive(),
        unitPrice: zod_1.z.number().positive(),
        taxRate: zod_1.z.number().min(0).max(1).optional(),
        referenceId: zod_1.z.string().optional()
    })).min(1),
    issueDate: zod_1.z.date().optional(),
    dueDate: zod_1.z.date().optional(),
    notes: zod_1.z.string().optional(),
    currency: zod_1.z.string().default('CNY'),
    taxRate: zod_1.z.number().min(0).max(1).optional()
});
const updateInvoiceSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(financial_1.InvoiceStatus).optional(),
    dueDate: zod_1.z.date().optional(),
    notes: zod_1.z.string().optional(),
    items: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.string(),
        description: zod_1.z.string(),
        quantity: zod_1.z.number().positive(),
        unitPrice: zod_1.z.number().positive(),
        taxRate: zod_1.z.number().min(0).max(1).optional(),
        referenceId: zod_1.z.string().optional()
    })).optional()
});
const sendInvoiceSchema = zod_1.z.object({
    sendMethod: zod_1.z.enum(['email', 'portal', 'both']),
    recipientEmail: zod_1.z.string().email().optional(),
    message: zod_1.z.string().optional(),
    scheduledDate: zod_1.z.date().optional()
});
const createTemplateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    description: zod_1.z.string().max(500).optional(),
    type: zod_1.z.nativeEnum(financial_1.InvoiceTemplateType),
    content: zod_1.z.object({
        header: zod_1.z.object({
            id: zod_1.z.string(),
            type: zod_1.z.string(),
            title: zod_1.z.string().optional(),
            content: zod_1.z.string(),
            isVisible: zod_1.z.boolean(),
            order: zod_1.z.number(),
            fields: zod_1.z.array(zod_1.z.object({
                id: zod_1.z.string(),
                name: zod_1.z.string(),
                type: zod_1.z.string(),
                label: zod_1.z.string(),
                value: zod_1.z.string(),
                format: zod_1.z.object({}).optional(),
                validation: zod_1.z.object({}).optional(),
                isRequired: zod_1.z.boolean(),
                order: zod_1.z.number()
            })).optional()
        }),
        body: zod_1.z.object({
            id: zod_1.z.string(),
            type: zod_1.z.string(),
            title: zod_1.z.string().optional(),
            content: zod_1.z.string(),
            isVisible: zod_1.z.boolean(),
            order: zod_1.z.number(),
            fields: zod_1.z.array(zod_1.z.object({
                id: zod_1.z.string(),
                name: zod_1.z.string(),
                type: zod_1.z.string(),
                label: zod_1.z.string(),
                value: zod_1.z.string(),
                format: zod_1.z.object({}).optional(),
                validation: zod_1.z.object({}).optional(),
                isRequired: zod_1.z.boolean(),
                order: zod_1.z.number()
            })).optional()
        }),
        footer: zod_1.z.object({
            id: zod_1.z.string(),
            type: zod_1.z.string(),
            title: zod_1.z.string().optional(),
            content: zod_1.z.string(),
            isVisible: zod_1.z.boolean(),
            order: zod_1.z.number(),
            fields: zod_1.z.array(zod_1.z.object({
                id: zod_1.z.string(),
                name: zod_1.z.string(),
                type: zod_1.z.string(),
                label: zod_1.z.string(),
                value: zod_1.z.string(),
                format: zod_1.z.object({}).optional(),
                validation: zod_1.z.object({}).optional(),
                isRequired: zod_1.z.boolean(),
                order: zod_1.z.number()
            })).optional()
        }),
        sections: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(),
            type: zod_1.z.string(),
            title: zod_1.z.string().optional(),
            content: zod_1.z.string(),
            isVisible: zod_1.z.boolean(),
            order: zod_1.z.number(),
            fields: zod_1.z.array(zod_1.z.object({
                id: zod_1.z.string(),
                name: zod_1.z.string(),
                type: zod_1.z.string(),
                label: zod_1.z.string(),
                value: zod_1.z.string(),
                format: zod_1.z.object({}).optional(),
                validation: zod_1.z.object({}).optional(),
                isRequired: zod_1.z.boolean(),
                order: zod_1.z.number()
            })).optional()
        })).optional()
    }),
    settings: zod_1.z.object({
        language: zod_1.z.enum(['zh-CN', 'en-US']).optional(),
        currency: zod_1.z.string().optional(),
        taxRate: zod_1.z.number().min(0).max(1).optional(),
        paymentTerms: zod_1.z.number().positive().optional(),
        logoUrl: zod_1.z.string().url().optional(),
        colorScheme: zod_1.z.object({
            primary: zod_1.z.string(),
            secondary: zod_1.z.string(),
            accent: zod_1.z.string(),
            background: zod_1.z.string(),
            text: zod_1.z.string()
        }).optional(),
        font: zod_1.z.object({
            family: zod_1.z.string(),
            size: zod_1.z.number().positive(),
            weight: zod_1.z.enum(['normal', 'bold', 'light']).optional(),
            lineHeight: zod_1.z.number().positive()
        }).optional(),
        layout: zod_1.z.object({
            pageSize: zod_1.z.enum(['A4', 'A5', 'Letter']).optional(),
            orientation: zod_1.z.enum(['portrait', 'landscape']).optional(),
            margins: zod_1.z.object({
                top: zod_1.z.number().positive(),
                right: zod_1.z.number().positive(),
                bottom: zod_1.z.number().positive(),
                left: zod_1.z.number().positive()
            }).optional(),
            columns: zod_1.z.number().positive().optional()
        }).optional(),
        electronicSignature: zod_1.z.object({
            enabled: zod_1.z.boolean().optional(),
            required: zod_1.z.boolean().optional(),
            type: zod_1.z.enum(['digital', 'electronic', 'wet']).optional(),
            certificatePath: zod_1.z.string().optional(),
            signatureField: zod_1.z.string().optional()
        }).optional(),
        chineseCompliance: zod_1.z.object({
            fapiaoType: zod_1.z.enum(['SPECIAL_VAT', 'REGULAR_VAT', 'ELECTRONIC_VAT', 'NONE']).optional(),
            taxpayerType: zod_1.z.enum(['general', 'small_scale']).optional(),
            taxId: zod_1.z.string().optional(),
            businessLicense: zod_1.z.string().optional(),
            bankAccount: zod_1.z.string().optional(),
            bankName: zod_1.z.string().optional(),
            address: zod_1.z.string().optional(),
            phone: zod_1.z.string().optional(),
            requiresFapiaoCode: zod_1.z.boolean().optional(),
            requiresQRCode: zod_1.z.boolean().optional()
        }).optional()
    }).optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional()
});
const updateTemplateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).optional(),
    description: zod_1.z.string().max(500).optional(),
    content: zod_1.z.object({}).optional(),
    settings: zod_1.z.object({}).optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    status: zod_1.z.nativeEnum(financial_1.TemplateStatus).optional()
});
class InvoiceController {
    async createInvoice(req, res) {
        try {
            const validatedData = createInvoiceSchema.parse(req.body);
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const invoice = await invoiceService.createInvoice({
                ...validatedData,
                userId
            });
            res.status(201).json({
                success: true,
                data: invoice,
                message: 'Invoice created successfully'
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                res.status(400).json({ error: 'Validation failed', details: error.errors });
                return;
            }
            console.error('Error creating invoice:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    async getInvoice(req, res) {
        try {
            const { id } = req.params;
            const invoice = await invoiceService.getInvoice(id);
            if (!invoice) {
                res.status(404).json({ error: 'Invoice not found' });
                return;
            }
            res.json({
                success: true,
                data: invoice
            });
        }
        catch (error) {
            console.error('Error getting invoice:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    async getInvoices(req, res) {
        try {
            const filters = {
                status: req.query.status || undefined,
                clientId: req.query.clientId || undefined,
                caseId: req.query.caseId || undefined,
                userId: req.query.userId || undefined,
                dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom) : undefined,
                dateTo: req.query.dateTo ? new Date(req.query.dateTo) : undefined,
                currency: req.query.currency || undefined,
                tags: req.query.tags ? req.query.tags.split(',') : undefined
            };
            const invoices = await invoiceService.getInvoices(filters);
            res.json({
                success: true,
                data: invoices,
                count: invoices.length
            });
        }
        catch (error) {
            console.error('Error getting invoices:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    async updateInvoice(req, res) {
        try {
            const { id } = req.params;
            const validatedData = updateInvoiceSchema.parse(req.body);
            const invoice = await invoiceService.updateInvoice(id, validatedData);
            res.json({
                success: true,
                data: invoice,
                message: 'Invoice updated successfully'
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                res.status(400).json({ error: 'Validation failed', details: error.errors });
                return;
            }
            console.error('Error updating invoice:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    async deleteInvoice(req, res) {
        try {
            const { id } = req.params;
            await invoiceService.deleteInvoice(id);
            res.json({
                success: true,
                message: 'Invoice deleted successfully'
            });
        }
        catch (error) {
            console.error('Error deleting invoice:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    async sendInvoice(req, res) {
        try {
            const { id } = req.params;
            const validatedData = sendInvoiceSchema.parse(req.body);
            const invoice = await invoiceService.sendInvoice({
                invoiceId: id,
                ...validatedData
            });
            res.json({
                success: true,
                data: invoice,
                message: 'Invoice sent successfully'
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                res.status(400).json({ error: 'Validation failed', details: error.errors });
                return;
            }
            console.error('Error sending invoice:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    async getInvoiceStatistics(req, res) {
        try {
            const filters = {
                clientId: req.query.clientId || undefined,
                caseId: req.query.caseId || undefined,
                userId: req.query.userId || undefined,
                dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom) : undefined,
                dateTo: req.query.dateTo ? new Date(req.query.dateTo) : undefined
            };
            const statistics = await invoiceService.getInvoiceStatistics(filters);
            res.json({
                success: true,
                data: statistics
            });
        }
        catch (error) {
            console.error('Error getting invoice statistics:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    async generateInvoicePDF(req, res) {
        try {
            const { id } = req.params;
            const invoice = await invoiceService.getInvoice(id);
            if (!invoice || !invoice.template) {
                res.status(404).json({ error: 'Invoice or template not found' });
                return;
            }
            const options = {
                includeQRCode: req.query.qr === 'true',
                includeWatermark: req.query.watermark === 'true',
                language: req.query.language || 'en-US',
                password: req.query.password || undefined
            };
            const result = await pdfService.generateInvoicePDF({
                invoice,
                template: invoice.template,
                options
            });
            if (!result.success) {
                res.status(500).json({ error: 'Failed to generate PDF', details: result.errors });
                return;
            }
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
            res.send(result.pdfData);
        }
        catch (error) {
            console.error('Error generating invoice PDF:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    async generateInvoicePreview(req, res) {
        try {
            const { id } = req.params;
            const options = {
                format: req.query.format || 'png',
                quality: parseInt(req.query.quality) || 80,
                width: req.query.width ? parseInt(req.query.width) : undefined,
                height: req.query.height ? parseInt(req.query.height) : undefined,
                page: req.query.page ? parseInt(req.query.page) : undefined
            };
            const preview = await pdfService.generateInvoicePreview(id, options);
            res.setHeader('Content-Type', `image/${options.format}`);
            res.send(preview);
        }
        catch (error) {
            console.error('Error generating invoice preview:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    async createTemplate(req, res) {
        try {
            const validatedData = createTemplateSchema.parse(req.body);
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const template = await templateService.createTemplate(validatedData, userId);
            res.status(201).json({
                success: true,
                data: template,
                message: 'Template created successfully'
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                res.status(400).json({ error: 'Validation failed', details: error.errors });
                return;
            }
            console.error('Error creating template:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    async getTemplate(req, res) {
        try {
            const { id } = req.params;
            const template = await templateService.getTemplate(id);
            if (!template) {
                res.status(404).json({ error: 'Template not found' });
                return;
            }
            res.json({
                success: true,
                data: template
            });
        }
        catch (error) {
            console.error('Error getting template:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    async getTemplates(req, res) {
        try {
            const filters = {
                type: req.query.type || undefined,
                status: req.query.status || undefined,
                createdBy: req.query.createdBy || undefined,
                tags: req.query.tags ? req.query.tags.split(',') : undefined,
                search: req.query.search || undefined
            };
            const templates = await templateService.getTemplates(filters);
            res.json({
                success: true,
                data: templates,
                count: templates.length
            });
        }
        catch (error) {
            console.error('Error getting templates:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    async updateTemplate(req, res) {
        try {
            const { id } = req.params;
            const validatedData = updateTemplateSchema.parse(req.body);
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const template = await templateService.updateTemplate(id, validatedData, userId);
            res.json({
                success: true,
                data: template,
                message: 'Template updated successfully'
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                res.status(400).json({ error: 'Validation failed', details: error.errors });
                return;
            }
            console.error('Error updating template:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    async deleteTemplate(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            await templateService.deleteTemplate(id, userId);
            res.json({
                success: true,
                message: 'Template deleted successfully'
            });
        }
        catch (error) {
            console.error('Error deleting template:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    async submitTemplateForApproval(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const template = await templateService.submitForApproval(id, userId);
            res.json({
                success: true,
                data: template,
                message: 'Template submitted for approval successfully'
            });
        }
        catch (error) {
            console.error('Error submitting template for approval:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    async approveTemplate(req, res) {
        try {
            const { id } = req.params;
            const { approved, comments } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const template = await templateService.approveTemplate(id, {
                approved,
                comments
            }, userId);
            res.json({
                success: true,
                data: template,
                message: `Template ${approved ? 'approved' : 'rejected'} successfully`
            });
        }
        catch (error) {
            console.error('Error approving template:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    async setDefaultTemplate(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const template = await templateService.setDefaultTemplate(id, userId);
            res.json({
                success: true,
                data: template,
                message: 'Template set as default successfully'
            });
        }
        catch (error) {
            console.error('Error setting default template:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    async getTemplateVersions(req, res) {
        try {
            const { id } = req.params;
            const versions = await templateService.getTemplateVersions(id);
            res.json({
                success: true,
                data: versions,
                count: versions.length
            });
        }
        catch (error) {
            console.error('Error getting template versions:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    async duplicateTemplate(req, res) {
        try {
            const { id } = req.params;
            const { name } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const template = await templateService.duplicateTemplate(id, userId, name);
            res.status(201).json({
                success: true,
                data: template,
                message: 'Template duplicated successfully'
            });
        }
        catch (error) {
            console.error('Error duplicating template:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    async getTemplateUsage(req, res) {
        try {
            const { id } = req.params;
            const usage = await templateService.getTemplateUsage(id);
            res.json({
                success: true,
                data: usage
            });
        }
        catch (error) {
            console.error('Error getting template usage:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
exports.InvoiceController = InvoiceController;
//# sourceMappingURL=InvoiceController.js.map