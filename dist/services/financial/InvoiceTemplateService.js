"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceTemplateService = void 0;
const InvoiceTemplate_1 = require("../models/InvoiceTemplate");
const uuid_1 = require("uuid");
class InvoiceTemplateService {
    constructor(prisma) {
        this.prisma = prisma;
        this.model = new InvoiceTemplate_1.InvoiceTemplateModel(prisma);
        this.workflowConfig = this.getDefaultWorkflowConfig();
    }
    async createTemplate(request, createdBy) {
        const validation = await this.validateTemplate(request);
        if (!validation.isValid) {
            throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
        }
        const template = await this.model.createTemplate(request, createdBy);
        await this.logTemplateActivity(template.id, 'CREATED', createdBy, 'Template created');
        return template;
    }
    async getTemplate(id) {
        return this.model.getTemplate(id);
    }
    async getTemplates(filters = {}) {
        let templates = await this.model.getTemplates(filters);
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            templates = templates.filter(template => template.name.toLowerCase().includes(searchLower) ||
                template.description?.toLowerCase().includes(searchLower) ||
                template.tags.some(tag => tag.toLowerCase().includes(searchLower)));
        }
        return templates;
    }
    async updateTemplate(id, request, updatedBy) {
        const existingTemplate = await this.model.getTemplate(id);
        if (!existingTemplate) {
            throw new Error('Template not found');
        }
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
        await this.logTemplateActivity(id, 'UPDATED', updatedBy, 'Template updated');
        return updatedTemplate;
    }
    async deleteTemplate(id, deletedBy) {
        const template = await this.model.getTemplate(id);
        if (!template) {
            throw new Error('Template not found');
        }
        const usage = await this.getTemplateUsage(id);
        if (usage.totalInvoices > 0) {
            throw new Error('Cannot delete template that is in use. Archive it instead.');
        }
        await this.model.deleteTemplate(id);
        await this.logTemplateActivity(id, 'DELETED', deletedBy, 'Template deleted');
    }
    async submitForApproval(id, submittedBy) {
        const template = await this.model.getTemplate(id);
        if (!template) {
            throw new Error('Template not found');
        }
        const validation = await this.validateTemplate(template);
        if (!validation.isValid) {
            throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
        }
        const updatedTemplate = await this.model.submitForApproval(id, submittedBy);
        await this.logTemplateActivity(id, 'SUBMITTED_FOR_APPROVAL', submittedBy, 'Template submitted for approval');
        await this.notifyApprovers(updatedTemplate);
        return updatedTemplate;
    }
    async approveTemplate(id, request, approvedBy) {
        const template = await this.model.approveTemplate(id, request, approvedBy);
        const action = request.approved ? 'APPROVED' : 'REJECTED';
        await this.logTemplateActivity(id, action, approvedBy, request.comments);
        await this.notifyCreator(template, request.approved, request.comments);
        return template;
    }
    async setDefaultTemplate(id, setBy) {
        const template = await this.model.setDefaultTemplate(id);
        await this.logTemplateActivity(id, 'SET_DEFAULT', setBy, 'Template set as default');
        return template;
    }
    async getDefaultTemplate(type) {
        return this.model.getDefaultTemplate(type);
    }
    async getTemplateVersions(templateId) {
        return this.model.getTemplateVersions(templateId);
    }
    async getTemplateVersion(templateId, version) {
        return this.model.getTemplateVersion(templateId, version);
    }
    async restoreTemplateVersion(templateId, version, restoredBy) {
        const templateVersion = await this.model.getTemplateVersion(templateId, version);
        if (!templateVersion) {
            throw new Error('Template version not found');
        }
        const updateRequest = {
            content: templateVersion.content,
            settings: templateVersion.settings,
            status: InvoiceTemplate_1.TemplateStatus.DRAFT
        };
        const restoredTemplate = await this.model.updateTemplate(templateId, updateRequest, restoredBy);
        await this.logTemplateActivity(templateId, 'RESTORED', restoredBy, `Restored to version ${version}`);
        return restoredTemplate;
    }
    async getTemplateUsage(templateId) {
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
    async getAllTemplateUsageStats() {
        const templates = await this.model.getTemplates();
        const statsPromises = templates.map(template => this.getTemplateUsage(template.id));
        return Promise.all(statsPromises);
    }
    async exportTemplates(request) {
        const templates = await Promise.all(request.templateIds.map(id => this.model.getTemplate(id)));
        const validTemplates = templates.filter(t => t !== null);
        if (validTemplates.length === 0) {
            throw new Error('No valid templates found for export');
        }
        const exportData = {
            templates: validTemplates,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        if (request.includeVersions) {
            exportData.versions = await Promise.all(validTemplates.map(template => this.model.getTemplateVersions(template.id)));
        }
        if (request.includeUsageData) {
            exportData.usage = await Promise.all(validTemplates.map(template => this.getTemplateUsage(template.id)));
        }
        switch (request.format) {
            case 'json':
                return JSON.stringify(exportData, null, 2);
            case 'xml':
                return this.convertToXML(exportData);
            case 'pdf':
                throw new Error('PDF export not implemented yet');
            default:
                throw new Error('Unsupported export format');
        }
    }
    async importTemplates(request) {
        let importData;
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
        }
        catch (error) {
            throw new Error(`Failed to parse import data: ${error}`);
        }
        if (!importData.templates || !Array.isArray(importData.templates)) {
            throw new Error('Invalid import data format');
        }
        const importedTemplates = [];
        for (const templateData of importData.templates) {
            try {
                const existingTemplate = await this.model.getTemplates({
                    search: templateData.name
                });
                if (existingTemplate.length > 0 && !request.overwriteExisting) {
                    console.warn(`Template "${templateData.name}" already exists. Skipping.`);
                    continue;
                }
                const createRequest = {
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
            }
            catch (error) {
                console.error(`Failed to import template "${templateData.name}":`, error);
            }
        }
        return importedTemplates;
    }
    async archiveTemplate(id, archivedBy) {
        const template = await this.model.getTemplate(id);
        if (!template) {
            throw new Error('Template not found');
        }
        if (template.status === InvoiceTemplate_1.TemplateStatus.APPROVED) {
            throw new Error('Cannot archive approved template. Set status to archived instead.');
        }
        const updateRequest = {
            status: InvoiceTemplate_1.TemplateStatus.ARCHIVED
        };
        const archivedTemplate = await this.model.updateTemplate(id, updateRequest, archivedBy);
        await this.logTemplateActivity(id, 'ARCHIVED', archivedBy, 'Template archived');
        return archivedTemplate;
    }
    async duplicateTemplate(id, duplicatedBy, newName) {
        const originalTemplate = await this.model.getTemplate(id);
        if (!originalTemplate) {
            throw new Error('Template not found');
        }
        const createRequest = {
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
    async validateTemplate(template) {
        const errors = [];
        const warnings = [];
        const suggestions = [];
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
            if (template.settings.chineseCompliance) {
                const compliance = template.settings.chineseCompliance;
                if (compliance.fapiaoType !== 'NONE' && (!compliance.taxId || compliance.taxId.trim() === '')) {
                    errors.push('Tax ID is required for Chinese fapiao templates');
                }
            }
        }
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
    async logTemplateActivity(templateId, action, userId, details) {
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
    async notifyApprovers(template) {
        console.log(`Notifying approvers about template "${template.name}"`);
    }
    async notifyCreator(template, approved, comments) {
        console.log(`Notifying creator about template "${template.name}" - ${approved ? 'Approved' : 'Rejected'}`);
    }
    convertToXML(data) {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<templateExport>\n';
        xml += `  <exportDate>${data.exportDate}</exportDate>\n`;
        xml += `  <version>${data.version}</version>\n`;
        xml += '  <templates>\n';
        data.templates.forEach((template) => {
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
    parseXML(xml) {
        throw new Error('XML import not implemented yet');
    }
    escapeXML(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    async updateWorkflowConfig(config) {
        this.workflowConfig = { ...this.workflowConfig, ...config };
        return this.workflowConfig;
    }
    async getWorkflowConfig() {
        return this.workflowConfig;
    }
    async submitTemplateWithWorkflow(templateId, submittedBy, message) {
        const template = await this.model.getTemplate(templateId);
        if (!template) {
            throw new Error('Template not found');
        }
        if (template.status !== InvoiceTemplate_1.TemplateStatus.DRAFT) {
            throw new Error('Only draft templates can be submitted for approval');
        }
        if (this.workflowConfig.requireApproval) {
            await this.createApprovalRequest(templateId, submittedBy, message);
            const updatedTemplate = await this.model.submitForApproval(templateId, submittedBy);
            if (this.workflowConfig.notificationSettings.notifyOnSubmission) {
                await this.notifyApprovers(updatedTemplate, message);
            }
            return updatedTemplate;
        }
        else {
            return await this.model.approveTemplate(templateId, {
                approved: true,
                comments: 'Auto-approved (workflow approval not required)'
            }, submittedBy);
        }
    }
    async approveTemplateWithWorkflow(templateId, approved, approvedBy, comments) {
        const template = await this.model.getTemplate(templateId);
        if (!template) {
            throw new Error('Template not found');
        }
        if (template.status !== InvoiceTemplate_1.TemplateStatus.PENDING_APPROVAL) {
            throw new Error('Template must be in pending approval status');
        }
        if (!this.isAuthorizedApprover(approvedBy)) {
            throw new Error('User is not authorized to approve templates');
        }
        await this.updateApprovalRequest(templateId, approved, approvedBy, comments);
        const updatedTemplate = await this.model.approveTemplate(templateId, {
            approved,
            comments
        }, approvedBy);
        if (this.workflowConfig.notificationSettings.notifyOnApproval ||
            this.workflowConfig.notificationSettings.notifyOnRejection) {
            await this.notifyCreator(updatedTemplate, approved, comments);
        }
        return updatedTemplate;
    }
    async createApprovalRequest(templateId, requestedBy, message) {
        await this.prisma.templateApprovalRequest.create({
            data: {
                id: (0, uuid_1.v4)(),
                templateId,
                requestedBy,
                status: 'PENDING',
                message,
                requestedAt: new Date()
            }
        });
    }
    async updateApprovalRequest(templateId, approved, approvedBy, comments) {
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
    async getApprovalRequests(filters = {}) {
        const where = {};
        if (filters.status)
            where.status = filters.status;
        if (filters.templateId)
            where.templateId = filters.templateId;
        if (filters.requestedBy)
            where.requestedBy = filters.requestedBy;
        if (filters.approver)
            where.approver = filters.approver;
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
    async cleanupOldVersions() {
        if (!this.workflowConfig.maxVersions && !this.workflowConfig.retentionPeriod) {
            return;
        }
        const templates = await this.model.getTemplates();
        for (const template of templates) {
            const versions = await this.model.getTemplateVersions(template.id);
            if (this.workflowConfig.maxVersions && versions.length > this.workflowConfig.maxVersions) {
                const versionsToDelete = versions.slice(this.workflowConfig.maxVersions);
                for (const version of versionsToDelete) {
                    await this.prisma.templateVersion.delete({
                        where: { id: version.id }
                    });
                }
            }
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
    async getTemplateWorkflowHistory(templateId) {
        const [versions, approvalRequests, activityLogs] = await Promise.all([
            this.model.getTemplateVersions(templateId),
            this.getApprovalRequests({ templateId }),
            this.prisma.templateActivityLog.findMany({
                where: { templateId },
                orderBy: { timestamp: 'desc' }
            })
        ]);
        const events = [];
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
        return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    async bulkApproveTemplates(templateIds, approved, approvedBy, comments) {
        const results = [];
        for (const templateId of templateIds) {
            try {
                const template = await this.approveTemplateWithWorkflow(templateId, approved, approvedBy, comments);
                results.push(template);
            }
            catch (error) {
                console.error(`Failed to approve template ${templateId}:`, error);
            }
        }
        return results;
    }
    async getPendingApprovals(userId) {
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
    isAuthorizedApprover(userId) {
        return this.workflowConfig.approvers.includes(userId);
    }
    getDefaultWorkflowConfig() {
        return {
            requireApproval: true,
            approvers: [],
            autoApprovalThreshold: 1,
            maxVersions: 10,
            retentionPeriod: 365,
            notificationSettings: {
                notifyOnSubmission: true,
                notifyOnApproval: true,
                notifyOnRejection: true,
                notifyOnVersion: false
            }
        };
    }
}
exports.InvoiceTemplateService = InvoiceTemplateService;
//# sourceMappingURL=InvoiceTemplateService.js.map