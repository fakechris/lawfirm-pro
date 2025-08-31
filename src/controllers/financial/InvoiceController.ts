import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { InvoiceService } from '../../services/financial/InvoiceService';
import { InvoiceTemplateService } from '../../services/financial/InvoiceTemplateService';
import { PDFGenerationService } from '../../services/financial/PDFGenerationService';
import { 
  Invoice,
  InvoiceStatus,
  InvoiceTemplate,
  InvoiceTemplateType,
  TemplateStatus
} from '../../models/financial';
import { z } from 'zod';

const prisma = new PrismaClient();
const invoiceService = new InvoiceService(prisma);
const templateService = new InvoiceTemplateService(prisma);
const pdfService = new PDFGenerationService(prisma);

// Validation schemas
const createInvoiceSchema = z.object({
  caseId: z.string().optional(),
  clientId: z.string(),
  userId: z.string(),
  templateId: z.string().optional(),
  items: z.array(z.object({
    type: z.string(),
    description: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    taxRate: z.number().min(0).max(1).optional(),
    referenceId: z.string().optional()
  })).min(1),
  issueDate: z.date().optional(),
  dueDate: z.date().optional(),
  notes: z.string().optional(),
  currency: z.string().default('CNY'),
  taxRate: z.number().min(0).max(1).optional()
});

const updateInvoiceSchema = z.object({
  status: z.nativeEnum(InvoiceStatus).optional(),
  dueDate: z.date().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    type: z.string(),
    description: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    taxRate: z.number().min(0).max(1).optional(),
    referenceId: z.string().optional()
  })).optional()
});

const sendInvoiceSchema = z.object({
  sendMethod: z.enum(['email', 'portal', 'both']),
  recipientEmail: z.string().email().optional(),
  message: z.string().optional(),
  scheduledDate: z.date().optional()
});

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.nativeEnum(InvoiceTemplateType),
  content: z.object({
    header: z.object({
      id: z.string(),
      type: z.string(),
      title: z.string().optional(),
      content: z.string(),
      isVisible: z.boolean(),
      order: z.number(),
      fields: z.array(z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        label: z.string(),
        value: z.string(),
        format: z.object({}).optional(),
        validation: z.object({}).optional(),
        isRequired: z.boolean(),
        order: z.number()
      })).optional()
    }),
    body: z.object({
      id: z.string(),
      type: z.string(),
      title: z.string().optional(),
      content: z.string(),
      isVisible: z.boolean(),
      order: z.number(),
      fields: z.array(z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        label: z.string(),
        value: z.string(),
        format: z.object({}).optional(),
        validation: z.object({}).optional(),
        isRequired: z.boolean(),
        order: z.number()
      })).optional()
    }),
    footer: z.object({
      id: z.string(),
      type: z.string(),
      title: z.string().optional(),
      content: z.string(),
      isVisible: z.boolean(),
      order: z.number(),
      fields: z.array(z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        label: z.string(),
        value: z.string(),
        format: z.object({}).optional(),
        validation: z.object({}).optional(),
        isRequired: z.boolean(),
        order: z.number()
      })).optional()
    }),
    sections: z.array(z.object({
      id: z.string(),
      type: z.string(),
      title: z.string().optional(),
      content: z.string(),
      isVisible: z.boolean(),
      order: z.number(),
      fields: z.array(z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        label: z.string(),
        value: z.string(),
        format: z.object({}).optional(),
        validation: z.object({}).optional(),
        isRequired: z.boolean(),
        order: z.number()
      })).optional()
    })).optional()
  }),
  settings: z.object({
    language: z.enum(['zh-CN', 'en-US']).optional(),
    currency: z.string().optional(),
    taxRate: z.number().min(0).max(1).optional(),
    paymentTerms: z.number().positive().optional(),
    logoUrl: z.string().url().optional(),
    colorScheme: z.object({
      primary: z.string(),
      secondary: z.string(),
      accent: z.string(),
      background: z.string(),
      text: z.string()
    }).optional(),
    font: z.object({
      family: z.string(),
      size: z.number().positive(),
      weight: z.enum(['normal', 'bold', 'light']).optional(),
      lineHeight: z.number().positive()
    }).optional(),
    layout: z.object({
      pageSize: z.enum(['A4', 'A5', 'Letter']).optional(),
      orientation: z.enum(['portrait', 'landscape']).optional(),
      margins: z.object({
        top: z.number().positive(),
        right: z.number().positive(),
        bottom: z.number().positive(),
        left: z.number().positive()
      }).optional(),
      columns: z.number().positive().optional()
    }).optional(),
    electronicSignature: z.object({
      enabled: z.boolean().optional(),
      required: z.boolean().optional(),
      type: z.enum(['digital', 'electronic', 'wet']).optional(),
      certificatePath: z.string().optional(),
      signatureField: z.string().optional()
    }).optional(),
    chineseCompliance: z.object({
      fapiaoType: z.enum(['SPECIAL_VAT', 'REGULAR_VAT', 'ELECTRONIC_VAT', 'NONE']).optional(),
      taxpayerType: z.enum(['general', 'small_scale']).optional(),
      taxId: z.string().optional(),
      businessLicense: z.string().optional(),
      bankAccount: z.string().optional(),
      bankName: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      requiresFapiaoCode: z.boolean().optional(),
      requiresQRCode: z.boolean().optional()
    }).optional()
  }).optional(),
  tags: z.array(z.string()).optional()
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  content: z.object({}).optional(),
  settings: z.object({}).optional(),
  tags: z.array(z.string()).optional(),
  status: z.nativeEnum(TemplateStatus).optional()
});

export class InvoiceController {
  // Invoice CRUD operations
  async createInvoice(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = createInvoiceSchema.parse(req.body);
      const userId = (req as any).user?.id;

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
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }

      console.error('Error creating invoice:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getInvoice(req: Request, res: Response): Promise<void> {
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
    } catch (error) {
      console.error('Error getting invoice:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getInvoices(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        status: req.query.status as InvoiceStatus[] || undefined,
        clientId: req.query.clientId as string || undefined,
        caseId: req.query.caseId as string || undefined,
        userId: req.query.userId as string || undefined,
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
        currency: req.query.currency as string || undefined,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined
      };

      const invoices = await invoiceService.getInvoices(filters);

      res.json({
        success: true,
        data: invoices,
        count: invoices.length
      });
    } catch (error) {
      console.error('Error getting invoices:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async updateInvoice(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const validatedData = updateInvoiceSchema.parse(req.body);

      const invoice = await invoiceService.updateInvoice(id, validatedData);

      res.json({
        success: true,
        data: invoice,
        message: 'Invoice updated successfully'
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }

      console.error('Error updating invoice:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async deleteInvoice(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await invoiceService.deleteInvoice(id);

      res.json({
        success: true,
        message: 'Invoice deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting invoice:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async sendInvoice(req: Request, res: Response): Promise<void> {
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
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }

      console.error('Error sending invoice:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getInvoiceStatistics(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        clientId: req.query.clientId as string || undefined,
        caseId: req.query.caseId as string || undefined,
        userId: req.query.userId as string || undefined,
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined
      };

      const statistics = await invoiceService.getInvoiceStatistics(filters);

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('Error getting invoice statistics:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async generateInvoicePDF(req: Request, res: Response): Promise<void> {
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
        language: req.query.language as 'zh-CN' | 'en-US' || 'en-US',
        password: req.query.password as string || undefined
      };

      const result = await pdfService.generateInvoicePDF({
        invoice,
        template: invoice.template as InvoiceTemplate,
        options
      });

      if (!result.success) {
        res.status(500).json({ error: 'Failed to generate PDF', details: result.errors });
        return;
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.pdfData);
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async generateInvoicePreview(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const options = {
        format: (req.query.format as 'png' | 'jpg') || 'png',
        quality: parseInt(req.query.quality as string) || 80,
        width: req.query.width ? parseInt(req.query.width as string) : undefined,
        height: req.query.height ? parseInt(req.query.height as string) : undefined,
        page: req.query.page ? parseInt(req.query.page as string) : undefined
      };

      const preview = await pdfService.generateInvoicePreview(id, options);

      res.setHeader('Content-Type', `image/${options.format}`);
      res.send(preview);
    } catch (error) {
      console.error('Error generating invoice preview:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Template CRUD operations
  async createTemplate(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = createTemplateSchema.parse(req.body);
      const userId = (req as any).user?.id;

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
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }

      console.error('Error creating template:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getTemplate(req: Request, res: Response): Promise<void> {
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
    } catch (error) {
      console.error('Error getting template:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getTemplates(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        type: req.query.type as InvoiceTemplateType || undefined,
        status: req.query.status as TemplateStatus || undefined,
        createdBy: req.query.createdBy as string || undefined,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        search: req.query.search as string || undefined
      };

      const templates = await templateService.getTemplates(filters);

      res.json({
        success: true,
        data: templates,
        count: templates.length
      });
    } catch (error) {
      console.error('Error getting templates:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async updateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const validatedData = updateTemplateSchema.parse(req.body);
      const userId = (req as any).user?.id;

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
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }

      console.error('Error updating template:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async deleteTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      await templateService.deleteTemplate(id, userId);

      res.json({
        success: true,
        message: 'Template deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async submitTemplateForApproval(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

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
    } catch (error) {
      console.error('Error submitting template for approval:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async approveTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { approved, comments } = req.body;
      const userId = (req as any).user?.id;

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
    } catch (error) {
      console.error('Error approving template:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async setDefaultTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

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
    } catch (error) {
      console.error('Error setting default template:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getTemplateVersions(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const versions = await templateService.getTemplateVersions(id);

      res.json({
        success: true,
        data: versions,
        count: versions.length
      });
    } catch (error) {
      console.error('Error getting template versions:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async duplicateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name } = req.body;
      const userId = (req as any).user?.id;

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
    } catch (error) {
      console.error('Error duplicating template:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getTemplateUsage(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const usage = await templateService.getTemplateUsage(id);

      res.json({
        success: true,
        data: usage
      });
    } catch (error) {
      console.error('Error getting template usage:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}