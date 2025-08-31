import { InvoiceTemplateService } from '../../src/services/financial/InvoiceTemplateService';
import { InvoiceTemplateModel } from '../../src/models/financial/InvoiceTemplate';
import { PrismaClient } from '@prisma/client';
import { InvoiceTemplateType, TemplateStatus, SectionType, FieldType } from '../../src/models/financial/InvoiceTemplate';

// Mock PrismaClient
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    invoiceTemplate: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
    },
    templateVersion: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    templateActivityLog: {
      create: jest.fn(),
    },
    invoice: {
      findMany: jest.fn(),
    },
    payment: {
      findMany: jest.fn(),
    },
    client: {
      findMany: jest.fn(),
    },
    $disconnect: jest.fn(),
  };

  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

// Mock InvoiceTemplateModel
jest.mock('../../src/models/financial/InvoiceTemplate', () => {
  return {
    InvoiceTemplateModel: jest.fn().mockImplementation(() => ({
      createTemplate: jest.fn(),
      getTemplate: jest.fn(),
      getTemplates: jest.fn(),
      updateTemplate: jest.fn(),
      deleteTemplate: jest.fn(),
      submitForApproval: jest.fn(),
      approveTemplate: jest.fn(),
      setDefaultTemplate: jest.fn(),
      getDefaultTemplate: jest.fn(),
      getTemplateVersions: jest.fn(),
      getTemplateVersion: jest.fn(),
    })),
  };
});

describe('InvoiceTemplateService', () => {
  let templateService: InvoiceTemplateService;
  let prisma: any;
  let mockModel: InvoiceTemplateModel;

  beforeEach(() => {
    prisma = new PrismaClient();
    mockModel = new InvoiceTemplateModel(prisma);
    templateService = new InvoiceTemplateService(prisma);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('createTemplate', () => {
    it('should create template successfully', async () => {
      const request = {
        name: 'Test Template',
        description: 'Test template description',
        type: InvoiceTemplateType.STANDARD,
        content: {
          header: {
            id: 'header-1',
            type: SectionType.HEADER,
            content: 'Header content',
            isVisible: true,
            order: 1,
            fields: [],
          },
          body: {
            id: 'body-1',
            type: SectionType.BODY,
            content: 'Body content',
            isVisible: true,
            order: 2,
            fields: [],
          },
          footer: {
            id: 'footer-1',
            type: SectionType.FOOTER,
            content: 'Footer content',
            isVisible: true,
            order: 3,
            fields: [],
          },
          sections: [],
        },
        settings: {
          currency: 'CNY',
          taxRate: 0.06,
          paymentTerms: 30,
          colorScheme: {
            primary: '#2563eb',
            secondary: '#64748b',
            accent: '#f59e0b',
            background: '#ffffff',
            text: '#1f2937',
          },
          font: {
            family: 'Arial',
            size: 12,
            weight: 'normal' as const,
            lineHeight: 1.5,
          },
          layout: {
            pageSize: 'A4' as const,
            orientation: 'portrait' as const,
            margins: { top: 20, right: 20, bottom: 20, left: 20 },
            columns: 1,
          },
          electronicSignature: {
            enabled: false,
            required: false,
            type: 'electronic' as const,
            signatureField: 'client_signature',
          },
          chineseCompliance: {
            fapiaoType: 'NONE' as const,
            taxpayerType: 'general' as const,
            taxId: '',
            requiresFapiaoCode: false,
            requiresQRCode: false,
          },
        },
        tags: ['test', 'invoice'],
      };

      const mockTemplate = {
        id: 'template-1',
        name: 'Test Template',
        type: InvoiceTemplateType.STANDARD,
        status: TemplateStatus.DRAFT,
        version: 1,
        createdBy: 'user-1',
        createdAt: new Date(),
      };

      mockModel.createTemplate.mockResolvedValue(mockTemplate);
      prisma.templateActivityLog.create.mockResolvedValue({});

      const result = await templateService.createTemplate(request, 'user-1');

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Template');
      expect(mockModel.createTemplate).toHaveBeenCalledWith(request, 'user-1');
      expect(prisma.templateActivityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          templateId: 'template-1',
          action: 'CREATED',
          userId: 'user-1',
          details: 'Template created',
        }),
      });
    });

    it('should throw validation error for invalid template', async () => {
      const invalidRequest = {
        name: '', // Empty name
        type: InvoiceTemplateType.STANDARD,
        content: {
          header: {
            id: 'header-1',
            type: SectionType.HEADER,
            content: '',
            isVisible: true,
            order: 1,
            fields: [],
          },
          body: null as any, // Missing body
          footer: {
            id: 'footer-1',
            type: SectionType.FOOTER,
            content: 'Footer content',
            isVisible: true,
            order: 3,
            fields: [],
          },
          sections: [],
        },
        settings: {
          currency: 'CNY',
          taxRate: 1.5, // Invalid tax rate (> 1)
          paymentTerms: 30,
        },
      };

      await expect(templateService.createTemplate(invalidRequest, 'user-1'))
        .rejects.toThrow('Template validation failed');
    });

    it('should throw validation error for Chinese fapiao without tax ID', async () => {
      const invalidRequest = {
        name: 'Chinese Template',
        type: InvoiceTemplateType.STANDARD,
        content: {
          header: {
            id: 'header-1',
            type: SectionType.HEADER,
            content: 'Header content',
            isVisible: true,
            order: 1,
            fields: [],
          },
          body: {
            id: 'body-1',
            type: SectionType.BODY,
            content: 'Body content',
            isVisible: true,
            order: 2,
            fields: [],
          },
          footer: {
            id: 'footer-1',
            type: SectionType.FOOTER,
            content: 'Footer content',
            isVisible: true,
            order: 3,
            fields: [],
          },
          sections: [],
        },
        settings: {
          currency: 'CNY',
          taxRate: 0.06,
          paymentTerms: 30,
          chineseCompliance: {
            fapiaoType: 'SPECIAL_VAT' as const,
            taxpayerType: 'general' as const,
            taxId: '', // Missing tax ID
            requiresFapiaoCode: true,
            requiresQRCode: true,
          },
        },
      };

      await expect(templateService.createTemplate(invalidRequest, 'user-1'))
        .rejects.toThrow('Template validation failed');
    });
  });

  describe('getTemplates', () => {
    it('should return templates with filters', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          name: 'Template 1',
          type: InvoiceTemplateType.STANDARD,
          status: TemplateStatus.APPROVED,
          tags: ['standard', 'approved'],
        },
        {
          id: 'template-2',
          name: 'Template 2',
          type: InvoiceTemplateType.CUSTOM,
          status: TemplateStatus.DRAFT,
          tags: ['custom'],
        },
      ];

      mockModel.getTemplates.mockResolvedValue(mockTemplates);

      const result = await templateService.getTemplates({
        type: InvoiceTemplateType.STANDARD,
        status: TemplateStatus.APPROVED,
        tags: ['approved'],
        search: 'Template',
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Template 1');
      expect(mockModel.getTemplates).toHaveBeenCalledWith({
        type: InvoiceTemplateType.STANDARD,
        status: TemplateStatus.APPROVED,
        tags: ['approved'],
      });
    });

    it('should return all templates when no filters provided', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          name: 'Template 1',
          type: InvoiceTemplateType.STANDARD,
          status: TemplateStatus.APPROVED,
          tags: [],
        },
      ];

      mockModel.getTemplates.mockResolvedValue(mockTemplates);

      const result = await templateService.getTemplates();

      expect(result).toHaveLength(1);
      expect(mockModel.getTemplates).toHaveBeenCalledWith({});
    });

    it('should filter templates by search term', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          name: 'Invoice Template',
          type: InvoiceTemplateType.STANDARD,
          status: TemplateStatus.APPROVED,
          tags: ['invoice'],
        },
        {
          id: 'template-2',
          name: 'Custom Template',
          type: InvoiceTemplateType.CUSTOM,
          status: TemplateStatus.DRAFT,
          tags: ['custom'],
        },
      ];

      mockModel.getTemplates.mockResolvedValue(mockTemplates);

      const result = await templateService.getTemplates({
        search: 'invoice',
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Invoice Template');
    });
  });

  describe('updateTemplate', () => {
    it('should update template successfully', async () => {
      const existingTemplate = {
        id: 'template-1',
        name: 'Old Name',
        type: InvoiceTemplateType.STANDARD,
        status: TemplateStatus.DRAFT,
        content: {
          header: {
            id: 'header-1',
            type: SectionType.HEADER,
            content: 'Old header',
            isVisible: true,
            order: 1,
            fields: [],
          },
          body: {
            id: 'body-1',
            type: SectionType.BODY,
            content: 'Old body',
            isVisible: true,
            order: 2,
            fields: [],
          },
          footer: {
            id: 'footer-1',
            type: SectionType.FOOTER,
            content: 'Old footer',
            isVisible: true,
            order: 3,
            fields: [],
          },
          sections: [],
        },
        settings: {
          currency: 'CNY',
          taxRate: 0.06,
          paymentTerms: 30,
        },
      };

      const updateRequest = {
        name: 'New Name',
        description: 'Updated description',
        content: {
          header: {
            content: 'Updated header',
          },
        },
        settings: {
          taxRate: 0.08,
        },
      };

      const updatedTemplate = {
        id: 'template-1',
        name: 'New Name',
        type: InvoiceTemplateType.STANDARD,
        status: TemplateStatus.DRAFT,
        content: {
          header: {
            id: 'header-1',
            type: SectionType.HEADER,
            content: 'Updated header',
            isVisible: true,
            order: 1,
            fields: [],
          },
          body: {
            id: 'body-1',
            type: SectionType.BODY,
            content: 'Old body',
            isVisible: true,
            order: 2,
            fields: [],
          },
          footer: {
            id: 'footer-1',
            type: SectionType.FOOTER,
            content: 'Old footer',
            isVisible: true,
            order: 3,
            fields: [],
          },
          sections: [],
        },
        settings: {
          currency: 'CNY',
          taxRate: 0.08,
          paymentTerms: 30,
        },
      };

      mockModel.getTemplate.mockResolvedValue(existingTemplate);
      mockModel.updateTemplate.mockResolvedValue(updatedTemplate);
      prisma.templateActivityLog.create.mockResolvedValue({});

      const result = await templateService.updateTemplate('template-1', updateRequest, 'user-1');

      expect(result).toBeDefined();
      expect(result.name).toBe('New Name');
      expect(result.settings.taxRate).toBe(0.08);
      expect(prisma.templateActivityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          templateId: 'template-1',
          action: 'UPDATED',
          userId: 'user-1',
          details: 'Template updated',
        }),
      });
    });

    it('should throw error when template not found', async () => {
      mockModel.getTemplate.mockResolvedValue(null);

      await expect(templateService.updateTemplate('non-existent-template', {}, 'user-1'))
        .rejects.toThrow('Template not found');
    });

    it('should throw error when updating approved template', async () => {
      const approvedTemplate = {
        id: 'template-1',
        name: 'Approved Template',
        type: InvoiceTemplateType.STANDARD,
        status: TemplateStatus.APPROVED, // Approved status
      };

      mockModel.getTemplate.mockResolvedValue(approvedTemplate);

      await expect(templateService.updateTemplate('template-1', {}, 'user-1'))
        .rejects.toThrow('Cannot update approved template');
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template successfully', async () => {
      const mockTemplate = {
        id: 'template-1',
        name: 'Template to delete',
        type: InvoiceTemplateType.STANDARD,
        status: TemplateStatus.DRAFT,
      };

      mockModel.getTemplate.mockResolvedValue(mockTemplate);
      mockModel.getTemplateUsage.mockResolvedValue({
        templateId: 'template-1',
        templateName: 'Template to delete',
        totalInvoices: 0, // No usage
        totalAmount: 0,
      });
      mockModel.deleteTemplate.mockResolvedValue({});
      prisma.templateActivityLog.create.mockResolvedValue({});

      await templateService.deleteTemplate('template-1', 'user-1');

      expect(mockModel.deleteTemplate).toHaveBeenCalledWith('template-1');
      expect(prisma.templateActivityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          templateId: 'template-1',
          action: 'DELETED',
          userId: 'user-1',
          details: 'Template deleted',
        }),
      });
    });

    it('should throw error when template not found', async () => {
      mockModel.getTemplate.mockResolvedValue(null);

      await expect(templateService.deleteTemplate('non-existent-template', 'user-1'))
        .rejects.toThrow('Template not found');
    });

    it('should throw error when template is in use', async () => {
      const mockTemplate = {
        id: 'template-1',
        name: 'Template in use',
        type: InvoiceTemplateType.STANDARD,
        status: TemplateStatus.DRAFT,
      };

      mockModel.getTemplate.mockResolvedValue(mockTemplate);
      mockModel.getTemplateUsage.mockResolvedValue({
        templateId: 'template-1',
        templateName: 'Template in use',
        totalInvoices: 5, // Has usage
        totalAmount: 5000,
      });

      await expect(templateService.deleteTemplate('template-1', 'user-1'))
        .rejects.toThrow('Cannot delete template that is in use');
    });
  });

  describe('submitForApproval', () => {
    it('should submit template for approval successfully', async () => {
      const mockTemplate = {
        id: 'template-1',
        name: 'Template for approval',
        type: InvoiceTemplateType.STANDARD,
        status: TemplateStatus.DRAFT,
        content: {
          header: {
            id: 'header-1',
            type: SectionType.HEADER,
            content: 'Header content',
            isVisible: true,
            order: 1,
            fields: [],
          },
          body: {
            id: 'body-1',
            type: SectionType.BODY,
            content: 'Body content',
            isVisible: true,
            order: 2,
            fields: [],
          },
          footer: {
            id: 'footer-1',
            type: SectionType.FOOTER,
            content: 'Footer content',
            isVisible: true,
            order: 3,
            fields: [],
          },
          sections: [],
        },
        settings: {
          currency: 'CNY',
          taxRate: 0.06,
          paymentTerms: 30,
        },
      };

      const updatedTemplate = {
        id: 'template-1',
        name: 'Template for approval',
        type: InvoiceTemplateType.STANDARD,
        status: TemplateStatus.PENDING_APPROVAL,
      };

      mockModel.getTemplate.mockResolvedValue(mockTemplate);
      mockModel.submitForApproval.mockResolvedValue(updatedTemplate);
      prisma.templateActivityLog.create.mockResolvedValue({});

      const result = await templateService.submitForApproval('template-1', 'user-1');

      expect(result).toBeDefined();
      expect(result.status).toBe(TemplateStatus.PENDING_APPROVAL);
      expect(mockModel.submitForApproval).toHaveBeenCalledWith('template-1', 'user-1');
      expect(prisma.templateActivityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          templateId: 'template-1',
          action: 'SUBMITTED_FOR_APPROVAL',
          userId: 'user-1',
          details: 'Template submitted for approval',
        }),
      });
    });

    it('should throw error when template not found', async () => {
      mockModel.getTemplate.mockResolvedValue(null);

      await expect(templateService.submitForApproval('non-existent-template', 'user-1'))
        .rejects.toThrow('Template not found');
    });

    it('should throw error when template validation fails', async () => {
      const invalidTemplate = {
        id: 'template-1',
        name: 'Invalid Template',
        type: InvoiceTemplateType.STANDARD,
        status: TemplateStatus.DRAFT,
        content: {
          header: null as any, // Invalid content
          body: null as any,
          footer: null as any,
          sections: [],
        },
        settings: {
          currency: 'CNY',
          taxRate: 0.06,
          paymentTerms: 30,
        },
      };

      mockModel.getTemplate.mockResolvedValue(invalidTemplate);

      await expect(templateService.submitForApproval('template-1', 'user-1'))
        .rejects.toThrow('Template validation failed');
    });
  });

  describe('approveTemplate', () => {
    it('should approve template successfully', async () => {
      const mockTemplate = {
        id: 'template-1',
        name: 'Template to approve',
        type: InvoiceTemplateType.STANDARD,
        status: TemplateStatus.PENDING_APPROVAL,
      };

      const approvedTemplate = {
        id: 'template-1',
        name: 'Template to approve',
        type: InvoiceTemplateType.STANDARD,
        status: TemplateStatus.APPROVED,
        approvedBy: 'approver-1',
        approvedAt: new Date(),
      };

      const approvalRequest = {
        approved: true,
        comments: 'Template looks good',
      };

      mockModel.approveTemplate.mockResolvedValue(approvedTemplate);
      prisma.templateActivityLog.create.mockResolvedValue({});

      const result = await templateService.approveTemplate('template-1', approvalRequest, 'approver-1');

      expect(result).toBeDefined();
      expect(result.status).toBe(TemplateStatus.APPROVED);
      expect(result.approvedBy).toBe('approver-1');
      expect(mockModel.approveTemplate).toHaveBeenCalledWith('template-1', approvalRequest, 'approver-1');
      expect(prisma.templateActivityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          templateId: 'template-1',
          action: 'APPROVED',
          userId: 'approver-1',
          details: 'Template looks good',
        }),
      });
    });

    it('should reject template successfully', async () => {
      const mockTemplate = {
        id: 'template-1',
        name: 'Template to reject',
        type: InvoiceTemplateType.STANDARD,
        status: TemplateStatus.PENDING_APPROVAL,
      };

      const rejectedTemplate = {
        id: 'template-1',
        name: 'Template to reject',
        type: InvoiceTemplateType.STANDARD,
        status: TemplateStatus.REJECTED,
      };

      const approvalRequest = {
        approved: false,
        comments: 'Template needs revision',
      };

      mockModel.approveTemplate.mockResolvedValue(rejectedTemplate);
      prisma.templateActivityLog.create.mockResolvedValue({});

      const result = await templateService.approveTemplate('template-1', approvalRequest, 'approver-1');

      expect(result).toBeDefined();
      expect(result.status).toBe(TemplateStatus.REJECTED);
      expect(prisma.templateActivityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          templateId: 'template-1',
          action: 'REJECTED',
          userId: 'approver-1',
          details: 'Template needs revision',
        }),
      });
    });
  });

  describe('getTemplateUsage', () => {
    it('should return template usage statistics', async () => {
      const mockInvoices = [
        {
          id: 'invoice-1',
          total: 1000,
          templateId: 'template-1',
          issueDate: new Date(),
          payments: [
            { amount: 1000, status: 'COMPLETED' },
          ],
        },
        {
          id: 'invoice-2',
          total: 2000,
          templateId: 'template-1',
          issueDate: new Date(),
          payments: [
            { amount: 500, status: 'COMPLETED' },
          ],
        },
      ];

      prisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockModel.getTemplate.mockResolvedValue({
        id: 'template-1',
        name: 'Test Template',
      });

      const result = await templateService.getTemplateUsage('template-1');

      expect(result).toBeDefined();
      expect(result.templateId).toBe('template-1');
      expect(result.templateName).toBe('Test Template');
      expect(result.totalInvoices).toBe(2);
      expect(result.totalAmount).toBe(3000);
      expect(result.totalPaid).toBe(1500);
      expect(result.lastUsed).toBeDefined();
    });

    it('should return zero usage when no invoices found', async () => {
      prisma.invoice.findMany.mockResolvedValue([]);
      mockModel.getTemplate.mockResolvedValue({
        id: 'template-1',
        name: 'Unused Template',
      });

      const result = await templateService.getTemplateUsage('template-1');

      expect(result).toBeDefined();
      expect(result.totalInvoices).toBe(0);
      expect(result.totalAmount).toBe(0);
      expect(result.totalPaid).toBe(0);
      expect(result.lastUsed).toBeUndefined();
    });
  });

  describe('duplicateTemplate', () => {
    it('should duplicate template successfully', async () => {
      const originalTemplate = {
        id: 'template-1',
        name: 'Original Template',
        type: InvoiceTemplateType.STANDARD,
        status: TemplateStatus.APPROVED,
        content: {
          header: {
            id: 'header-1',
            type: SectionType.HEADER,
            content: 'Header content',
            isVisible: true,
            order: 1,
            fields: [],
          },
          body: {
            id: 'body-1',
            type: SectionType.BODY,
            content: 'Body content',
            isVisible: true,
            order: 2,
            fields: [],
          },
          footer: {
            id: 'footer-1',
            type: SectionType.FOOTER,
            content: 'Footer content',
            isVisible: true,
            order: 3,
            fields: [],
          },
          sections: [],
        },
        settings: {
          currency: 'CNY',
          taxRate: 0.06,
          paymentTerms: 30,
        },
        tags: ['original'],
      };

      const duplicatedTemplate = {
        id: 'template-2',
        name: 'Original Template (Copy)',
        type: InvoiceTemplateType.STANDARD,
        status: TemplateStatus.DRAFT,
      };

      mockModel.getTemplate.mockResolvedValue(originalTemplate);
      mockModel.createTemplate.mockResolvedValue(duplicatedTemplate);
      prisma.templateActivityLog.create.mockResolvedValue({});

      const result = await templateService.duplicateTemplate('template-1', 'user-1', 'Custom Copy Name');

      expect(result).toBeDefined();
      expect(result.name).toBe('Custom Copy Name');
      expect(result.status).toBe(TemplateStatus.DRAFT);
      expect(mockModel.createTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Custom Copy Name',
          type: InvoiceTemplateType.STANDARD,
          content: originalTemplate.content,
          settings: originalTemplate.settings,
          tags: originalTemplate.tags,
        }),
        'user-1'
      );
    });

    it('should use default copy name when not provided', async () => {
      const originalTemplate = {
        id: 'template-1',
        name: 'Original Template',
        type: InvoiceTemplateType.STANDARD,
        status: TemplateStatus.APPROVED,
        content: {
          header: {
            id: 'header-1',
            type: SectionType.HEADER,
            content: 'Header content',
            isVisible: true,
            order: 1,
            fields: [],
          },
          body: {
            id: 'body-1',
            type: SectionType.BODY,
            content: 'Body content',
            isVisible: true,
            order: 2,
            fields: [],
          },
          footer: {
            id: 'footer-1',
            type: SectionType.FOOTER,
            content: 'Footer content',
            isVisible: true,
            order: 3,
            fields: [],
          },
          sections: [],
        },
        settings: {
          currency: 'CNY',
          taxRate: 0.06,
          paymentTerms: 30,
        },
        tags: ['original'],
      };

      const duplicatedTemplate = {
        id: 'template-2',
        name: 'Original Template (Copy)',
        type: InvoiceTemplateType.STANDARD,
        status: TemplateStatus.DRAFT,
      };

      mockModel.getTemplate.mockResolvedValue(originalTemplate);
      mockModel.createTemplate.mockResolvedValue(duplicatedTemplate);
      prisma.templateActivityLog.create.mockResolvedValue({});

      const result = await templateService.duplicateTemplate('template-1', 'user-1');

      expect(result).toBeDefined();
      expect(result.name).toBe('Original Template (Copy)');
    });
  });
});