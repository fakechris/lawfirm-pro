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

export enum InvoiceTemplateType {
  STANDARD = 'STANDARD',
  INTERIM = 'INTERIM',
  FINAL = 'FINAL',
  CREDIT = 'CREDIT',
  PROFORMA = 'PROFORMA',
  CUSTOM = 'CUSTOM'
}

export enum TemplateStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED'
}

export enum SectionType {
  HEADER = 'HEADER',
  CLIENT_INFO = 'CLIENT_INFO',
  INVOICE_DETAILS = 'INVOICE_DETAILS',
  LINE_ITEMS = 'LINE_ITEMS',
  TAX_CALCULATION = 'TAX_CALCULATION',
  PAYMENT_INFO = 'PAYMENT_INFO',
  TERMS = 'TERMS',
  FOOTER = 'FOOTER',
  CUSTOM = 'CUSTOM'
}

export enum FieldType {
  TEXT = 'TEXT',
  NUMBER = 'NUMBER',
  CURRENCY = 'CURRENCY',
  DATE = 'DATE',
  BOOLEAN = 'BOOLEAN',
  SELECT = 'SELECT',
  MULTILINE_TEXT = 'MULTILINE_TEXT'
}

export enum FapiaoType {
  SPECIAL_VAT = 'SPECIAL_VAT',
  REGULAR_VAT = 'REGULAR_VAT',
  ELECTRONIC_VAT = 'ELECTRONIC_VAT',
  NONE = 'NONE'
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

export class InvoiceTemplateModel {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createTemplate(
    request: TemplateCreateRequest,
    createdBy: string
  ): Promise<InvoiceTemplate> {
    const defaultSettings: TemplateSettings = {
      language: 'zh-CN',
      currency: 'CNY',
      taxRate: 0.06,
      paymentTerms: 30,
      colorScheme: {
        primary: '#2563eb',
        secondary: '#64748b',
        accent: '#f59e0b',
        background: '#ffffff',
        text: '#1f2937'
      },
      font: {
        family: 'Arial',
        size: 12,
        weight: 'normal',
        lineHeight: 1.5
      },
      layout: {
        pageSize: 'A4',
        orientation: 'portrait',
        margins: { top: 20, right: 20, bottom: 20, left: 20 },
        columns: 1
      },
      electronicSignature: {
        enabled: false,
        required: false,
        type: 'electronic',
        signatureField: 'client_signature'
      },
      chineseCompliance: {
        fapiaoType: FapiaoType.NONE,
        taxpayerType: 'general',
        taxId: '',
        requiresFapiaoCode: false,
        requiresQRCode: false
      }
    };

    const settings = { ...defaultSettings, ...request.settings };

    // Validate Chinese compliance settings
    this.validateChineseCompliance(settings.chineseCompliance);

    const template = await this.prisma.invoiceTemplate.create({
      data: {
        name: request.name,
        description: request.description,
        type: request.type,
        content: request.content as any,
        settings: settings as any,
        version: 1,
        status: TemplateStatus.DRAFT,
        createdBy,
        isDefault: false,
        tags: request.tags || [],
      }
    });

    // Create initial version
    await this.createTemplateVersion(template.id, 1, request.content, settings, createdBy, ['Initial version']);

    return template as InvoiceTemplate;
  }

  async getTemplate(id: string): Promise<InvoiceTemplate | null> {
    const template = await this.prisma.invoiceTemplate.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1
        }
      }
    });

    return template as InvoiceTemplate | null;
  }

  async getTemplates(filters: {
    type?: InvoiceTemplateType;
    status?: TemplateStatus;
    createdBy?: string;
    tags?: string[];
  } = {}): Promise<InvoiceTemplate[]> {
    const where: any = {};

    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    if (filters.createdBy) where.createdBy = filters.createdBy;
    if (filters.tags && filters.tags.length > 0) {
      where.tags = {
        hasSome: filters.tags
      };
    }

    const templates = await this.prisma.invoiceTemplate.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1
        }
      }
    });

    return templates as InvoiceTemplate[];
  }

  async updateTemplate(
    id: string,
    request: TemplateUpdateRequest,
    updatedBy: string
  ): Promise<InvoiceTemplate> {
    const existingTemplate = await this.prisma.invoiceTemplate.findUnique({
      where: { id }
    });

    if (!existingTemplate) {
      throw new Error('Template not found');
    }

    if (existingTemplate.status === TemplateStatus.APPROVED) {
      throw new Error('Cannot update approved template. Create a new version instead.');
    }

    const updateData: any = {};
    
    if (request.name) updateData.name = request.name;
    if (request.description) updateData.description = request.description;
    if (request.tags) updateData.tags = request.tags;
    if (request.status) updateData.status = request.status;

    // Handle content updates
    let newContent = existingTemplate.content as any;
    let newSettings = existingTemplate.settings as any;
    const changes: string[] = [];

    if (request.content) {
      newContent = { ...newContent, ...request.content };
      changes.push('Updated template content');
    }

    if (request.settings) {
      newSettings = { ...newSettings, ...request.settings };
      changes.push('Updated template settings');
      
      // Validate Chinese compliance settings if updated
      if (request.settings.chineseCompliance) {
        this.validateChineseCompliance(newSettings.chineseCompliance);
      }
    }

    if (Object.keys(updateData).length > 0 || changes.length > 0) {
      updateData.content = newContent;
      updateData.settings = newSettings;
      updateData.updatedBy = updatedBy;
      updateData.updatedAt = new Date();
    }

    const updatedTemplate = await this.prisma.invoiceTemplate.update({
      where: { id },
      data: updateData
    });

    // Create new version if there are changes
    if (changes.length > 0) {
      const newVersion = existingTemplate.version + 1;
      await this.createTemplateVersion(
        id,
        newVersion,
        newContent,
        newSettings,
        updatedBy,
        changes
      );

      await this.prisma.invoiceTemplate.update({
        where: { id },
        data: { version: newVersion }
      });
    }

    return updatedTemplate as InvoiceTemplate;
  }

  async approveTemplate(
    id: string,
    approvalRequest: TemplateApprovalRequest,
    approvedBy: string
  ): Promise<InvoiceTemplate> {
    const template = await this.prisma.invoiceTemplate.findUnique({
      where: { id }
    });

    if (!template) {
      throw new Error('Template not found');
    }

    if (template.status !== TemplateStatus.PENDING_APPROVAL) {
      throw new Error('Template must be in pending approval status');
    }

    const status = approvalRequest.approved 
      ? TemplateStatus.APPROVED 
      : TemplateStatus.REJECTED;

    const updateData: any = {
      status,
      updatedAt: new Date()
    };

    if (approvalRequest.approved) {
      updateData.approvedBy = approvedBy;
      updateData.approvedAt = new Date();
    }

    const updatedTemplate = await this.prisma.invoiceTemplate.update({
      where: { id },
      data: updateData
    });

    return updatedTemplate as InvoiceTemplate;
  }

  async submitForApproval(id: string, submittedBy: string): Promise<InvoiceTemplate> {
    const template = await this.prisma.invoiceTemplate.findUnique({
      where: { id }
    });

    if (!template) {
      throw new Error('Template not found');
    }

    if (template.status !== TemplateStatus.DRAFT) {
      throw new Error('Only draft templates can be submitted for approval');
    }

    const updatedTemplate = await this.prisma.invoiceTemplate.update({
      where: { id },
      data: {
        status: TemplateStatus.PENDING_APPROVAL,
        updatedAt: new Date()
      }
    });

    return updatedTemplate as InvoiceTemplate;
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.prisma.invoiceTemplate.delete({
      where: { id }
    });
  }

  async setDefaultTemplate(id: string): Promise<InvoiceTemplate> {
    // Remove default from all templates of the same type
    const template = await this.prisma.invoiceTemplate.findUnique({
      where: { id }
    });

    if (!template) {
      throw new Error('Template not found');
    }

    await this.prisma.invoiceTemplate.updateMany({
      where: { 
        type: template.type,
        isDefault: true 
      },
      data: { isDefault: false }
    });

    const updatedTemplate = await this.prisma.invoiceTemplate.update({
      where: { id },
      data: { 
        isDefault: true,
        updatedAt: new Date()
      }
    });

    return updatedTemplate as InvoiceTemplate;
  }

  async getDefaultTemplate(type: InvoiceTemplateType): Promise<InvoiceTemplate | null> {
    const template = await this.prisma.invoiceTemplate.findFirst({
      where: { 
        type,
        isDefault: true,
        status: TemplateStatus.APPROVED
      }
    });

    return template as InvoiceTemplate | null;
  }

  async getTemplateVersions(templateId: string): Promise<TemplateVersion[]> {
    const versions = await this.prisma.templateVersion.findMany({
      where: { templateId },
      orderBy: { version: 'desc' }
    });

    return versions as TemplateVersion[];
  }

  async getTemplateVersion(templateId: string, version: number): Promise<TemplateVersion | null> {
    const templateVersion = await this.prisma.templateVersion.findFirst({
      where: { 
        templateId,
        version 
      }
    });

    return templateVersion as TemplateVersion | null;
  }

  private async createTemplateVersion(
    templateId: string,
    version: number,
    content: TemplateContent,
    settings: TemplateSettings,
    createdBy: string,
    changes: string[]
  ): Promise<void> {
    await this.prisma.templateVersion.create({
      data: {
        templateId,
        version,
        content: content as any,
        settings: settings as any,
        createdBy,
        changes
      }
    });
  }

  private validateChineseCompliance(compliance: ChineseInvoiceCompliance): void {
    if (compliance.fapiaoType !== FapiaoType.NONE) {
      if (!compliance.taxId || compliance.taxId.trim() === '') {
        throw new Error('Tax ID is required for Chinese fapiao templates');
      }

      if (compliance.requiresFapiaoCode && !compliance.businessLicense) {
        throw new Error('Business license is required for fapiao templates with fapiao code');
      }
    }
  }
}