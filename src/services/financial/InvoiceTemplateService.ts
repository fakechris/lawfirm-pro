import { PrismaClient } from '@prisma/client';
import { 
  InvoiceTemplate, 
  InvoiceTemplateModel,
  TemplateCreateRequest,
  TemplateUpdateRequest,
  TemplateApprovalRequest,
  TemplateVersion,
  InvoiceTemplateType,
  TemplateStatus
} from '../models/InvoiceTemplate';
import { v4 as uuidv4 } from 'uuid';

export interface TemplateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface TemplateUsageStats {
  templateId: string;
  templateName: string;
  totalInvoices: number;
  totalAmount: number;
  lastUsed?: Date;
  averageRating?: number;
  userFeedback: {
    positive: number;
    negative: number;
    neutral: number;
  };
}

export interface TemplateExportRequest {
  templateIds: string[];
  format: 'json' | 'xml' | 'pdf';
  includeVersions: boolean;
  includeUsageData: boolean;
}

export interface TemplateImportRequest {
  fileData: string;
  format: 'json' | 'xml';
  overwriteExisting: boolean;
  createdBy: string;
}

export interface TemplateWorkflowConfig {
  requireApproval: boolean;
  approvers: string[]; // User IDs who can approve templates
  autoApprovalThreshold?: number; // Number of approvals required
  maxVersions?: number; // Maximum versions to keep
  retentionPeriod?: number; // Days to keep old versions
  notificationSettings: {
    notifyOnSubmission: boolean;
    notifyOnApproval: boolean;
    notifyOnRejection: boolean;
    notifyOnVersion: boolean;
  };
}

export class InvoiceTemplateService {
  private prisma: PrismaClient;
  private model: InvoiceTemplateModel;
  private workflowConfig: TemplateWorkflowConfig;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.model = new InvoiceTemplateModel(prisma);
    this.workflowConfig = this.getDefaultWorkflowConfig();
  }

  async createTemplate(
    request: TemplateCreateRequest,
    createdBy: string
  ): Promise<InvoiceTemplate> {
    // Validate template structure
    const validation = await this.validateTemplate(request);
    if (!validation.isValid) {
      throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
    }

    const template = await this.model.createTemplate(request, createdBy);
    
    // Log template creation
    await this.logTemplateActivity(template.id, 'CREATED', createdBy, 'Template created');
    
    return template;
  }

  async getTemplate(id: string): Promise<InvoiceTemplate | null> {
    return this.model.getTemplate(id);
  }

  async getTemplates(filters: {
    type?: InvoiceTemplateType;
    status?: TemplateStatus;
    createdBy?: string;
    tags?: string[];
    search?: string;
  } = {}): Promise<InvoiceTemplate[]> {
    let templates = await this.model.getTemplates(filters);

    // Apply search filter if provided
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      templates = templates.filter(template => 
        template.name.toLowerCase().includes(searchLower) ||
        template.description?.toLowerCase().includes(searchLower) ||
        template.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    return templates;
  }

  async updateTemplate(
    id: string,
    request: TemplateUpdateRequest,
    updatedBy: string
  ): Promise<InvoiceTemplate> {
    const existingTemplate = await this.model.getTemplate(id);
    if (!existingTemplate) {
      throw new Error('Template not found');
    }

    // Validate updates if content or settings are provided
    if (request.content || request.settings) {
      const tempTemplate = {
        ...existingTemplate,
        content: request.content ? { ...existingTemplate.content, ...request.content } : existingTemplate.content,
        settings: request.settings ? { ...existingTemplate.settings, ...request.settings } : existingTemplate.settings
      };
      
      const validation = await this.validateTemplate(tempTemplate);
      if (!validation.isValid) {
        throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
      }
    }

    const updatedTemplate = await this.model.updateTemplate(id, request, updatedBy);
    
    // Log template update
    await this.logTemplateActivity(id, 'UPDATED', updatedBy, 'Template updated');
    
    return updatedTemplate;
  }

  async deleteTemplate(id: string, deletedBy: string): Promise<void> {
    const template = await this.model.getTemplate(id);
    if (!template) {
      throw new Error('Template not found');
    }

    // Check if template is in use
    const usage = await this.getTemplateUsage(id);
    if (usage.totalInvoices > 0) {
      throw new Error('Cannot delete template that is in use. Archive it instead.');
    }

    await this.model.deleteTemplate(id);
    
    // Log template deletion
    await this.logTemplateActivity(id, 'DELETED', deletedBy, 'Template deleted');
  }

  async submitForApproval(id: string, submittedBy: string): Promise<InvoiceTemplate> {
    const template = await this.model.getTemplate(id);
    if (!template) {
      throw new Error('Template not found');
    }

    // Validate template before submission
    const validation = await this.validateTemplate(template);
    if (!validation.isValid) {
      throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
    }

    const updatedTemplate = await this.model.submitForApproval(id, submittedBy);
    
    // Log approval submission
    await this.logTemplateActivity(id, 'SUBMITTED_FOR_APPROVAL', submittedBy, 'Template submitted for approval');
    
    // Notify approvers
    await this.notifyApprovers(updatedTemplate);
    
    return updatedTemplate;
  }

  async approveTemplate(
    id: string,
    request: TemplateApprovalRequest,
    approvedBy: string
  ): Promise<InvoiceTemplate> {
    const template = await this.model.approveTemplate(id, request, approvedBy);
    
    // Log approval decision
    const action = request.approved ? 'APPROVED' : 'REJECTED';
    await this.logTemplateActivity(id, action, approvedBy, request.comments);
    
    // Notify creator
    await this.notifyCreator(template, request.approved, request.comments);
    
    return template;
  }

  async setDefaultTemplate(id: string, setBy: string): Promise<InvoiceTemplate> {
    const template = await this.model.setDefaultTemplate(id);
    
    // Log default change
    await this.logTemplateActivity(id, 'SET_DEFAULT', setBy, 'Template set as default');
    
    return template;
  }

  async getDefaultTemplate(type: InvoiceTemplateType): Promise<InvoiceTemplate | null> {
    return this.model.getDefaultTemplate(type);
  }

  async getTemplateVersions(templateId: string): Promise<TemplateVersion[]> {
    return this.model.getTemplateVersions(templateId);
  }

  async getTemplateVersion(templateId: string, version: number): Promise<TemplateVersion | null> {
    return this.model.getTemplateVersion(templateId, version);
  }

  async restoreTemplateVersion(templateId: string, version: number, restoredBy: string): Promise<InvoiceTemplate> {
    const templateVersion = await this.model.getTemplateVersion(templateId, version);
    if (!templateVersion) {
      throw new Error('Template version not found');
    }

    const updateRequest: TemplateUpdateRequest = {
      content: templateVersion.content,
      settings: templateVersion.settings,
      status: TemplateStatus.DRAFT
    };

    const restoredTemplate = await this.model.updateTemplate(templateId, updateRequest, restoredBy);
    
    // Log restoration
    await this.logTemplateActivity(templateId, 'RESTORED', restoredBy, `Restored to version ${version}`);
    
    return restoredTemplate;
  }

  async getTemplateUsage(templateId: string): Promise<TemplateUsageStats> {
    const invoices = await this.prisma.invoice.findMany({
      where: { templateId },
      include: {
        payments: true
      }
    });

    const totalInvoices = invoices.length;
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const lastUsed = invoices.length > 0 
      ? invoices.reduce((latest, inv) => inv.issueDate > latest ? inv.issueDate : latest, invoices[0].issueDate)
      : undefined;

    // Get feedback (simplified - in real app this would be from a feedback table)
    const userFeedback = {
      positive: Math.floor(Math.random() * 10),
      negative: Math.floor(Math.random() * 2),
      neutral: Math.floor(Math.random() * 5)
    };

    const totalFeedback = userFeedback.positive + userFeedback.negative + userFeedback.neutral;
    const averageRating = totalFeedback > 0 
      ? (userFeedback.positive * 5 + userFeedback.neutral * 3 + userFeedback.negative * 1) / totalFeedback
      : undefined;

    return {
      templateId,
      templateName: (await this.model.getTemplate(templateId))?.name || 'Unknown',
      totalInvoices,
      totalAmount,
      lastUsed,
      averageRating,
      userFeedback
    };
  }

  async getAllTemplateUsageStats(): Promise<TemplateUsageStats[]> {
    const templates = await this.model.getTemplates();
    const statsPromises = templates.map(template => this.getTemplateUsage(template.id));
    return Promise.all(statsPromises);
  }

  async exportTemplates(request: TemplateExportRequest): Promise<string> {
    const templates = await Promise.all(
      request.templateIds.map(id => this.model.getTemplate(id))
    );

    const validTemplates = templates.filter(t => t !== null) as InvoiceTemplate[];

    if (validTemplates.length === 0) {
      throw new Error('No valid templates found for export');
    }

    const exportData: any = {
      templates: validTemplates,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };

    if (request.includeVersions) {
      exportData.versions = await Promise.all(
        validTemplates.map(template => this.model.getTemplateVersions(template.id))
      );
    }

    if (request.includeUsageData) {
      exportData.usage = await Promise.all(
        validTemplates.map(template => this.getTemplateUsage(template.id))
      );
    }

    switch (request.format) {
      case 'json':
        return JSON.stringify(exportData, null, 2);
      case 'xml':
        return this.convertToXML(exportData);
      case 'pdf':
        // This would integrate with PDF generation service
        throw new Error('PDF export not implemented yet');
      default:
        throw new Error('Unsupported export format');
    }
  }

  async importTemplates(request: TemplateImportRequest): Promise<InvoiceTemplate[]> {
    let importData: any;

    try {
      switch (request.format) {
        case 'json':
          importData = JSON.parse(request.fileData);
          break;
        case 'xml':
          importData = this.parseXML(request.fileData);
          break;
        default:
          throw new Error('Unsupported import format');
      }
    } catch (error) {
      throw new Error(`Failed to parse import data: ${error}`);
    }

    if (!importData.templates || !Array.isArray(importData.templates)) {
      throw new Error('Invalid import data format');
    }

    const importedTemplates: InvoiceTemplate[] = [];

    for (const templateData of importData.templates) {
      try {
        // Check if template with same name exists
        const existingTemplate = await this.model.getTemplates({
          search: templateData.name
        });

        if (existingTemplate.length > 0 && !request.overwriteExisting) {
          console.warn(`Template "${templateData.name}" already exists. Skipping.`);
          continue;
        }

        const createRequest: TemplateCreateRequest = {
          name: templateData.name,
          description: templateData.description,
          type: templateData.type,
          content: templateData.content,
          settings: templateData.settings,
          tags: templateData.tags
        };

        const template = await this.createTemplate(createRequest, request.createdBy);
        importedTemplates.push(template);
        
        await this.logTemplateActivity(template.id, 'IMPORTED', request.createdBy, 'Template imported');
      } catch (error) {
        console.error(`Failed to import template "${templateData.name}":`, error);
      }
    }

    return importedTemplates;
  }

  async archiveTemplate(id: string, archivedBy: string): Promise<InvoiceTemplate> {
    const template = await this.model.getTemplate(id);
    if (!template) {
      throw new Error('Template not found');
    }

    if (template.status === TemplateStatus.APPROVED) {
      throw new Error('Cannot archive approved template. Set status to archived instead.');
    }

    const updateRequest: TemplateUpdateRequest = {
      status: TemplateStatus.ARCHIVED
    };

    const archivedTemplate = await this.model.updateTemplate(id, updateRequest, archivedBy);
    
    await this.logTemplateActivity(id, 'ARCHIVED', archivedBy, 'Template archived');
    
    return archivedTemplate;
  }

  async duplicateTemplate(id: string, duplicatedBy: string, newName?: string): Promise<InvoiceTemplate> {
    const originalTemplate = await this.model.getTemplate(id);
    if (!originalTemplate) {
      throw new Error('Template not found');
    }

    const createRequest: TemplateCreateRequest = {
      name: newName || `${originalTemplate.name} (Copy)`,
      description: originalTemplate.description,
      type: originalTemplate.type,
      content: originalTemplate.content,
      settings: originalTemplate.settings,
      tags: originalTemplate.tags
    };

    const duplicatedTemplate = await this.createTemplate(createRequest, duplicatedBy);
    
    await this.logTemplateActivity(duplicatedTemplate.id, 'DUPLICATED', duplicatedBy, `Duplicated from ${id}`);
    
    return duplicatedTemplate;
  }

  private async validateTemplate(template: Partial<InvoiceTemplate>): Promise<TemplateValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Validate required fields
    if (!template.name || template.name.trim() === '') {
      errors.push('Template name is required');
    }

    if (!template.type) {
      errors.push('Template type is required');
    }

    if (!template.content) {
      errors.push('Template content is required');
    }

    if (!template.settings) {
      errors.push('Template settings are required');
    }

    // Validate content structure
    if (template.content) {
      if (!template.content.header) {
        errors.push('Template header section is required');
      }

      if (!template.content.body) {
        errors.push('Template body section is required');
      }

      if (!template.content.footer) {
        warnings.push('Template footer section is recommended');
      }

      // Validate sections
      if (template.content.sections) {
        template.content.sections.forEach((section, index) => {
          if (!section.type) {
            errors.push(`Section ${index + 1}: Type is required`);
          }

          if (!section.content || section.content.trim() === '') {
            errors.push(`Section ${index + 1}: Content is required`);
          }

          if (section.fields) {
            section.fields.forEach((field, fieldIndex) => {
              if (!field.name || field.name.trim() === '') {
                errors.push(`Section ${index + 1}, Field ${fieldIndex + 1}: Field name is required`);
              }

              if (!field.type) {
                errors.push(`Section ${index + 1}, Field ${fieldIndex + 1}: Field type is required`);
              }
            });
          }
        });
      }
    }

    // Validate settings
    if (template.settings) {
      if (!template.settings.currency) {
        errors.push('Currency setting is required');
      }

      if (template.settings.taxRate === undefined || template.settings.taxRate === null) {
        errors.push('Tax rate setting is required');
      }

      if (template.settings.taxRate < 0 || template.settings.taxRate > 1) {
        errors.push('Tax rate must be between 0 and 1');
      }

      // Validate Chinese compliance
      if (template.settings.chineseCompliance) {
        const compliance = template.settings.chineseCompliance;
        if (compliance.fapiaoType !== 'NONE' && (!compliance.taxId || compliance.taxId.trim() === '')) {
          errors.push('Tax ID is required for Chinese fapiao templates');
        }
      }
    }

    // Check for suggestions
    if (template.name && template.name.length > 50) {
      suggestions.push('Consider using a shorter template name for better readability');
    }

    if (template.description && template.description.length > 200) {
      suggestions.push('Consider using a shorter description');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  private async logTemplateActivity(
    templateId: string,
    action: string,
    userId: string,
    details?: string
  ): Promise<void> {
    await this.prisma.templateActivityLog.create({
      data: {
        templateId,
        action,
        userId,
        details,
        timestamp: new Date()
      }
    });
  }

  private async notifyApprovers(template: InvoiceTemplate): Promise<void> {
    // TODO: Implement approval notification system
    console.log(`Notifying approvers about template "${template.name}"`);
  }

  private async notifyCreator(template: InvoiceTemplate, approved: boolean, comments?: string): Promise<void> {
    // TODO: Implement creator notification system
    console.log(`Notifying creator about template "${template.name}" - ${approved ? 'Approved' : 'Rejected'}`);
  }

  private convertToXML(data: any): string {
    // Simple XML conversion - in production, use a proper XML library
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<templateExport>\n';
    xml += `  <exportDate>${data.exportDate}</exportDate>\n`;
    xml += `  <version>${data.version}</version>\n`;
    xml += '  <templates>\n';
    
    data.templates.forEach((template: any) => {
      xml += '    <template>\n';
      xml += `      <name>${this.escapeXML(template.name)}</name>\n`;
      xml += `      <type>${template.type}</type>\n`;
      xml += `      <status>${template.status}</status>\n`;
      xml += '    </template>\n';
    });
    
    xml += '  </templates>\n';
    xml += '</templateExport>';
    
    return xml;
  }

  private parseXML(xml: string): any {
    // Simple XML parsing - in production, use a proper XML parser
    throw new Error('XML import not implemented yet');
  }

  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Workflow Configuration Methods
  async updateWorkflowConfig(config: Partial<TemplateWorkflowConfig>): Promise<TemplateWorkflowConfig> {
    this.workflowConfig = { ...this.workflowConfig, ...config };
    return this.workflowConfig;
  }

  async getWorkflowConfig(): Promise<TemplateWorkflowConfig> {
    return this.workflowConfig;
  }

  async submitTemplateWithWorkflow(
    templateId: string,
    submittedBy: string,
    message?: string
  ): Promise<InvoiceTemplate> {
    const template = await this.model.getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    if (template.status !== TemplateStatus.DRAFT) {
      throw new Error('Only draft templates can be submitted for approval');
    }

    // Check if workflow requires approval
    if (this.workflowConfig.requireApproval) {
      // Create approval request
      await this.createApprovalRequest(templateId, submittedBy, message);
      
      // Update template status
      const updatedTemplate = await this.model.submitForApproval(templateId, submittedBy);
      
      // Notify approvers if configured
      if (this.workflowConfig.notificationSettings.notifyOnSubmission) {
        await this.notifyApprovers(updatedTemplate, message);
      }
      
      return updatedTemplate;
    } else {
      // Auto-approve if no approval required
      return await this.model.approveTemplate(templateId, {
        approved: true,
        comments: 'Auto-approved (workflow approval not required)'
      }, submittedBy);
    }
  }

  async approveTemplateWithWorkflow(
    templateId: string,
    approved: boolean,
    approvedBy: string,
    comments?: string
  ): Promise<InvoiceTemplate> {
    const template = await this.model.getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    if (template.status !== TemplateStatus.PENDING_APPROVAL) {
      throw new Error('Template must be in pending approval status');
    }

    // Check if user is authorized to approve
    if (!this.isAuthorizedApprover(approvedBy)) {
      throw new Error('User is not authorized to approve templates');
    }

    // Update approval request
    await this.updateApprovalRequest(templateId, approved, approvedBy, comments);

    // Approve or reject template
    const updatedTemplate = await this.model.approveTemplate(templateId, {
      approved,
      comments
    }, approvedBy);

    // Notify creator if configured
    if (this.workflowConfig.notificationSettings.notifyOnApproval || 
        this.workflowConfig.notificationSettings.notifyOnRejection) {
      await this.notifyCreator(updatedTemplate, approved, comments);
    }

    return updatedTemplate;
  }

  async createApprovalRequest(
    templateId: string,
    requestedBy: string,
    message?: string
  ): Promise<void> {
    await this.prisma.templateApprovalRequest.create({
      data: {
        id: uuidv4(),
        templateId,
        requestedBy,
        status: 'PENDING',
        message,
        requestedAt: new Date()
      }
    });
  }

  async updateApprovalRequest(
    templateId: string,
    approved: boolean,
    approvedBy: string,
    comments?: string
  ): Promise<void> {
    await this.prisma.templateApprovalRequest.updateMany({
      where: {
        templateId,
        status: 'PENDING'
      },
      data: {
        status: approved ? 'APPROVED' : 'REJECTED',
        approvedBy,
        approvedAt: new Date(),
        comments
      }
    });
  }

  async getApprovalRequests(filters: {
    status?: 'PENDING' | 'APPROVED' | 'REJECTED';
    templateId?: string;
    requestedBy?: string;
    approver?: string;
  } = {}): Promise<any[]> {
    const where: any = {};

    if (filters.status) where.status = filters.status;
    if (filters.templateId) where.templateId = filters.templateId;
    if (filters.requestedBy) where.requestedBy = filters.requestedBy;
    if (filters.approver) where.approver = filters.approver;

    return this.prisma.templateApprovalRequest.findMany({
      where,
      include: {
        template: true,
        requester: true,
        approver: true
      },
      orderBy: { requestedAt: 'desc' }
    });
  }

  async cleanupOldVersions(): Promise<void> {
    if (!this.workflowConfig.maxVersions && !this.workflowConfig.retentionPeriod) {
      return;
    }

    const templates = await this.model.getTemplates();

    for (const template of templates) {
      const versions = await this.model.getTemplateVersions(template.id);

      // Apply max versions limit
      if (this.workflowConfig.maxVersions && versions.length > this.workflowConfig.maxVersions) {
        const versionsToDelete = versions.slice(this.workflowConfig.maxVersions);
        for (const version of versionsToDelete) {
          await this.prisma.templateVersion.delete({
            where: { id: version.id }
          });
        }
      }

      // Apply retention period
      if (this.workflowConfig.retentionPeriod) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.workflowConfig.retentionPeriod);

        const oldVersions = versions.filter(v => v.createdAt < cutoffDate);
        for (const version of oldVersions) {
          await this.prisma.templateVersion.delete({
            where: { id: version.id }
          });
        }
      }
    }
  }

  async getTemplateWorkflowHistory(templateId: string): Promise<any[]> {
    const [versions, approvalRequests, activityLogs] = await Promise.all([
      this.model.getTemplateVersions(templateId),
      this.getApprovalRequests({ templateId }),
      this.prisma.templateActivityLog.findMany({
        where: { templateId },
        orderBy: { timestamp: 'desc' }
      })
    ]);

    // Combine and sort all events
    const events = [];

    // Add version events
    versions.forEach(version => {
      events.push({
        type: 'VERSION_CREATED',
        timestamp: version.createdAt,
        data: {
          version: version.version,
          createdBy: version.createdBy,
          changes: version.changes
        }
      });
    });

    // Add approval request events
    approvalRequests.forEach(request => {
      events.push({
        type: 'APPROVAL_REQUEST',
        timestamp: request.requestedAt,
        data: {
          status: request.status,
          requestedBy: request.requestedBy,
          approvedBy: request.approvedBy,
          comments: request.comments
        }
      });
    });

    // Add activity log events
    activityLogs.forEach(log => {
      events.push({
        type: 'ACTIVITY',
        timestamp: log.timestamp,
        data: {
          action: log.action,
          userId: log.userId,
          details: log.details
        }
      });
    });

    // Sort by timestamp (most recent first)
    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async bulkApproveTemplates(
    templateIds: string[],
    approved: boolean,
    approvedBy: string,
    comments?: string
  ): Promise<InvoiceTemplate[]> {
    const results: InvoiceTemplate[] = [];

    for (const templateId of templateIds) {
      try {
        const template = await this.approveTemplateWithWorkflow(
          templateId,
          approved,
          approvedBy,
          comments
        );
        results.push(template);
      } catch (error) {
        console.error(`Failed to approve template ${templateId}:`, error);
      }
    }

    return results;
  }

  async getPendingApprovals(userId: string): Promise<InvoiceTemplate[]> {
    if (!this.isAuthorizedApprover(userId)) {
      return [];
    }

    const approvalRequests = await this.getApprovalRequests({
      status: 'PENDING',
      approver: userId
    });

    const templateIds = approvalRequests.map(req => req.templateId);
    const templates = await this.model.getTemplates();

    return templates.filter(template => templateIds.includes(template.id));
  }

  private isAuthorizedApprover(userId: string): boolean {
    return this.workflowConfig.approvers.includes(userId);
  }

  private getDefaultWorkflowConfig(): TemplateWorkflowConfig {
    return {
      requireApproval: true,
      approvers: [], // Should be configured based on user roles
      autoApprovalThreshold: 1,
      maxVersions: 10,
      retentionPeriod: 365, // 1 year
      notificationSettings: {
        notifyOnSubmission: true,
        notifyOnApproval: true,
        notifyOnRejection: true,
        notifyOnVersion: false
      }
    };
  }
}