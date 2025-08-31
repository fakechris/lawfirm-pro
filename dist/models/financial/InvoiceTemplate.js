"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceTemplateModel = exports.FapiaoType = exports.FieldType = exports.SectionType = exports.TemplateStatus = exports.InvoiceTemplateType = void 0;
var InvoiceTemplateType;
(function (InvoiceTemplateType) {
    InvoiceTemplateType["STANDARD"] = "STANDARD";
    InvoiceTemplateType["INTERIM"] = "INTERIM";
    InvoiceTemplateType["FINAL"] = "FINAL";
    InvoiceTemplateType["CREDIT"] = "CREDIT";
    InvoiceTemplateType["PROFORMA"] = "PROFORMA";
    InvoiceTemplateType["CUSTOM"] = "CUSTOM";
})(InvoiceTemplateType || (exports.InvoiceTemplateType = InvoiceTemplateType = {}));
var TemplateStatus;
(function (TemplateStatus) {
    TemplateStatus["DRAFT"] = "DRAFT";
    TemplateStatus["PENDING_APPROVAL"] = "PENDING_APPROVAL";
    TemplateStatus["APPROVED"] = "APPROVED";
    TemplateStatus["REJECTED"] = "REJECTED";
    TemplateStatus["ARCHIVED"] = "ARCHIVED";
})(TemplateStatus || (exports.TemplateStatus = TemplateStatus = {}));
var SectionType;
(function (SectionType) {
    SectionType["HEADER"] = "HEADER";
    SectionType["CLIENT_INFO"] = "CLIENT_INFO";
    SectionType["INVOICE_DETAILS"] = "INVOICE_DETAILS";
    SectionType["LINE_ITEMS"] = "LINE_ITEMS";
    SectionType["TAX_CALCULATION"] = "TAX_CALCULATION";
    SectionType["PAYMENT_INFO"] = "PAYMENT_INFO";
    SectionType["TERMS"] = "TERMS";
    SectionType["FOOTER"] = "FOOTER";
    SectionType["CUSTOM"] = "CUSTOM";
})(SectionType || (exports.SectionType = SectionType = {}));
var FieldType;
(function (FieldType) {
    FieldType["TEXT"] = "TEXT";
    FieldType["NUMBER"] = "NUMBER";
    FieldType["CURRENCY"] = "CURRENCY";
    FieldType["DATE"] = "DATE";
    FieldType["BOOLEAN"] = "BOOLEAN";
    FieldType["SELECT"] = "SELECT";
    FieldType["MULTILINE_TEXT"] = "MULTILINE_TEXT";
})(FieldType || (exports.FieldType = FieldType = {}));
var FapiaoType;
(function (FapiaoType) {
    FapiaoType["SPECIAL_VAT"] = "SPECIAL_VAT";
    FapiaoType["REGULAR_VAT"] = "REGULAR_VAT";
    FapiaoType["ELECTRONIC_VAT"] = "ELECTRONIC_VAT";
    FapiaoType["NONE"] = "NONE";
})(FapiaoType || (exports.FapiaoType = FapiaoType = {}));
class InvoiceTemplateModel {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createTemplate(request, createdBy) {
        const defaultSettings = {
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
        this.validateChineseCompliance(settings.chineseCompliance);
        const template = await this.prisma.invoiceTemplate.create({
            data: {
                name: request.name,
                description: request.description,
                type: request.type,
                content: request.content,
                settings: settings,
                version: 1,
                status: TemplateStatus.DRAFT,
                createdBy,
                isDefault: false,
                tags: request.tags || [],
            }
        });
        await this.createTemplateVersion(template.id, 1, request.content, settings, createdBy, ['Initial version']);
        return template;
    }
    async getTemplate(id) {
        const template = await this.prisma.invoiceTemplate.findUnique({
            where: { id },
            include: {
                versions: {
                    orderBy: { version: 'desc' },
                    take: 1
                }
            }
        });
        return template;
    }
    async getTemplates(filters = {}) {
        const where = {};
        if (filters.type)
            where.type = filters.type;
        if (filters.status)
            where.status = filters.status;
        if (filters.createdBy)
            where.createdBy = filters.createdBy;
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
        return templates;
    }
    async updateTemplate(id, request, updatedBy) {
        const existingTemplate = await this.prisma.invoiceTemplate.findUnique({
            where: { id }
        });
        if (!existingTemplate) {
            throw new Error('Template not found');
        }
        if (existingTemplate.status === TemplateStatus.APPROVED) {
            throw new Error('Cannot update approved template. Create a new version instead.');
        }
        const updateData = {};
        if (request.name)
            updateData.name = request.name;
        if (request.description)
            updateData.description = request.description;
        if (request.tags)
            updateData.tags = request.tags;
        if (request.status)
            updateData.status = request.status;
        let newContent = existingTemplate.content;
        let newSettings = existingTemplate.settings;
        const changes = [];
        if (request.content) {
            newContent = { ...newContent, ...request.content };
            changes.push('Updated template content');
        }
        if (request.settings) {
            newSettings = { ...newSettings, ...request.settings };
            changes.push('Updated template settings');
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
        if (changes.length > 0) {
            const newVersion = existingTemplate.version + 1;
            await this.createTemplateVersion(id, newVersion, newContent, newSettings, updatedBy, changes);
            await this.prisma.invoiceTemplate.update({
                where: { id },
                data: { version: newVersion }
            });
        }
        return updatedTemplate;
    }
    async approveTemplate(id, approvalRequest, approvedBy) {
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
        const updateData = {
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
        return updatedTemplate;
    }
    async submitForApproval(id, submittedBy) {
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
        return updatedTemplate;
    }
    async deleteTemplate(id) {
        await this.prisma.invoiceTemplate.delete({
            where: { id }
        });
    }
    async setDefaultTemplate(id) {
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
        return updatedTemplate;
    }
    async getDefaultTemplate(type) {
        const template = await this.prisma.invoiceTemplate.findFirst({
            where: {
                type,
                isDefault: true,
                status: TemplateStatus.APPROVED
            }
        });
        return template;
    }
    async getTemplateVersions(templateId) {
        const versions = await this.prisma.templateVersion.findMany({
            where: { templateId },
            orderBy: { version: 'desc' }
        });
        return versions;
    }
    async getTemplateVersion(templateId, version) {
        const templateVersion = await this.prisma.templateVersion.findFirst({
            where: {
                templateId,
                version
            }
        });
        return templateVersion;
    }
    async createTemplateVersion(templateId, version, content, settings, createdBy, changes) {
        await this.prisma.templateVersion.create({
            data: {
                templateId,
                version,
                content: content,
                settings: settings,
                createdBy,
                changes
            }
        });
    }
    validateChineseCompliance(compliance) {
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
exports.InvoiceTemplateModel = InvoiceTemplateModel;
//# sourceMappingURL=InvoiceTemplate.js.map