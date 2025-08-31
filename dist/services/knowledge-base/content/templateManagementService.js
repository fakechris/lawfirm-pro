"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateManagementService = void 0;
const documentService_1 = require("../../documents/documentService");
class TemplateManagementService {
    constructor(prisma) {
        this.prisma = prisma;
        this.documentService = new documentService_1.DocumentService(prisma);
    }
    async createTemplate(input) {
        const template = await this.prisma.contentTemplate.create({
            data: {
                name: input.name,
                description: input.description,
                category: input.category,
                contentType: input.contentType,
                templateContent: input.templateContent,
                variableSchema: input.variableSchema,
                isPublic: input.isPublic,
                requiredRole: input.requiredRole,
                tags: input.tags,
                usageCount: 0,
                createdBy: input.createdBy
            },
            include: {
                createdBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });
        return template;
    }
    async getTemplateById(id) {
        return await this.prisma.contentTemplate.findUnique({
            where: { id },
            include: {
                createdBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                usages: {
                    include: {
                        content: {
                            select: {
                                id: true,
                                title: true,
                                contentType: true
                            }
                        },
                        createdBy: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true
                            }
                        }
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 10
                }
            }
        });
    }
    async updateTemplate(id, input) {
        const updatedTemplate = await this.prisma.contentTemplate.update({
            where: { id },
            data: {
                ...input,
                updatedAt: new Date()
            },
            include: {
                createdBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });
        return updatedTemplate;
    }
    async deleteTemplate(id) {
        await this.prisma.contentTemplate.delete({
            where: { id }
        });
    }
    async queryTemplates(query = {}) {
        const where = {};
        if (query.id)
            where.id = query.id;
        if (query.name)
            where.name = { contains: query.name, mode: 'insensitive' };
        if (query.category)
            where.category = query.category;
        if (query.contentType)
            where.contentType = query.contentType;
        if (query.isPublic !== undefined)
            where.isPublic = query.isPublic;
        if (query.createdBy)
            where.createdBy = query.createdBy;
        if (query.tags)
            where.tags = { hasSome: query.tags };
        if (query.search) {
            where.OR = [
                { name: { contains: query.search, mode: 'insensitive' } },
                { description: { contains: query.search, mode: 'insensitive' } },
                { tags: { hasSome: [query.search] } }
            ];
        }
        return await this.prisma.contentTemplate.findMany({
            where,
            include: {
                createdBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                _count: {
                    select: {
                        usages: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
    async useTemplate(templateId, contentId, variables, createdBy) {
        const template = await this.getTemplateById(templateId);
        if (!template) {
            throw new Error('Template not found');
        }
        const validation = this.validateVariables(variables, template.variableSchema);
        if (!validation.isValid) {
            throw new Error(`Variable validation failed: ${validation.errors.join(', ')}`);
        }
        const usage = await this.prisma.templateUsage.create({
            data: {
                templateId,
                contentId,
                variables,
                createdBy
            },
            include: {
                template: true,
                content: true,
                createdBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });
        await this.prisma.contentTemplate.update({
            where: { id: templateId },
            data: {
                usageCount: { increment: 1 },
                updatedAt: new Date()
            }
        });
        return usage;
    }
    async getTemplateUsages(templateId) {
        return await this.prisma.templateUsage.findMany({
            where: { templateId },
            include: {
                content: {
                    select: {
                        id: true,
                        title: true,
                        contentType: true,
                        status: true
                    }
                },
                createdBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
    async generateFromTemplate(templateId, variables) {
        const template = await this.getTemplateById(templateId);
        if (!template) {
            throw new Error('Template not found');
        }
        const validation = this.validateVariables(variables, template.variableSchema);
        if (!validation.isValid) {
            throw new Error(`Variable validation failed: ${validation.errors.join(', ')}`);
        }
        let generatedContent = template.templateContent;
        for (const [key, value] of Object.entries(variables)) {
            const placeholder = `{{${key}}}`;
            generatedContent = generatedContent.replace(new RegExp(placeholder, 'g'), String(value));
        }
        generatedContent = this.processConditionalBlocks(generatedContent, variables);
        generatedContent = this.processLoops(generatedContent, variables);
        return generatedContent;
    }
    validateVariables(variables, schema) {
        const errors = [];
        const schemaMap = new Map(schema.map(v => [v.name, v]));
        for (const variable of schema) {
            if (variable.required && !(variable.name in variables)) {
                errors.push(`Required variable '${variable.name}' is missing`);
            }
        }
        for (const [key, value] of Object.entries(variables)) {
            const variableSchema = schemaMap.get(key);
            if (!variableSchema) {
                errors.push(`Unknown variable '${key}'`);
                continue;
            }
            if (!this.validateType(value, variableSchema.type)) {
                errors.push(`Variable '${key}' must be of type ${variableSchema.type}`);
            }
            if (variableSchema.validation) {
                const validationError = this.validateCustomRules(value, variableSchema.validation);
                if (validationError) {
                    errors.push(`Variable '${key}': ${validationError}`);
                }
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    validateType(value, type) {
        switch (type) {
            case 'string':
                return typeof value === 'string';
            case 'number':
                return typeof value === 'number' && !isNaN(value);
            case 'boolean':
                return typeof value === 'boolean';
            case 'date':
                return value instanceof Date || !isNaN(Date.parse(value));
            case 'select':
                return typeof value === 'string';
            case 'array':
                return Array.isArray(value);
            case 'object':
                return typeof value === 'object' && value !== null && !Array.isArray(value);
            default:
                return false;
        }
    }
    validateCustomRules(value, validation) {
        if (validation.pattern && typeof value === 'string') {
            const regex = new RegExp(validation.pattern);
            if (!regex.test(value)) {
                return `Value does not match required pattern`;
            }
        }
        if (validation.min !== undefined && typeof value === 'number') {
            if (value < validation.min) {
                return `Value must be at least ${validation.min}`;
            }
        }
        if (validation.max !== undefined && typeof value === 'number') {
            if (value > validation.max) {
                return `Value must be at most ${validation.max}`;
            }
        }
        if (validation.min !== undefined && typeof value === 'string') {
            if (value.length < validation.min) {
                return `Value must be at least ${validation.min} characters long`;
            }
        }
        if (validation.max !== undefined && typeof value === 'string') {
            if (value.length > validation.max) {
                return `Value must be at most ${validation.max} characters long`;
            }
        }
        return null;
    }
    processConditionalBlocks(content, variables) {
        const ifPattern = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
        return content.replace(ifPattern, (match, variable, innerContent) => {
            const value = variables[variable];
            if (value && value !== false && value !== 0 && value !== '') {
                return innerContent;
            }
            return '';
        });
    }
    processLoops(content, variables) {
        const eachPattern = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
        return content.replace(eachPattern, (match, arrayName, innerTemplate) => {
            const arrayValue = variables[arrayName];
            if (!Array.isArray(arrayValue)) {
                return '';
            }
            return arrayValue.map((item, index) => {
                let processed = innerTemplate;
                processed = processed.replace(/\{\{this\}\}/g, String(item));
                processed = processed.replace(/\{\{@index\}\}/g, String(index));
                if (typeof item === 'object' && item !== null) {
                    for (const [key, value] of Object.entries(item)) {
                        processed = processed.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
                    }
                }
                return processed;
            }).join('');
        });
    }
    async getTemplateCategories() {
        const categories = await this.prisma.contentTemplate.findMany({
            select: { category: true },
            distinct: ['category'],
            orderBy: { category: 'asc' }
        });
        return categories.map(c => c.category);
    }
    async getTemplatesByCategory(category) {
        return await this.prisma.contentTemplate.findMany({
            where: { category, isPublic: true },
            include: {
                createdBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                _count: {
                    select: {
                        usages: true
                    }
                }
            },
            orderBy: { usageCount: 'desc' }
        });
    }
    async getPopularTemplates(limit = 10) {
        return await this.prisma.contentTemplate.findMany({
            where: { isPublic: true },
            include: {
                createdBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                _count: {
                    select: {
                        usages: true
                    }
                }
            },
            orderBy: { usageCount: 'desc' },
            take: limit
        });
    }
    async getTemplateAnalytics(templateId) {
        const [usageStats, recentUsages, topUsers] = await Promise.all([
            this.prisma.templateUsage.groupBy({
                by: ['createdAt'],
                where: { templateId },
                _count: { id: true },
                orderBy: { createdAt: 'asc' }
            }),
            this.prisma.templateUsage.findMany({
                where: { templateId },
                include: {
                    createdBy: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: 10
            }),
            this.prisma.templateUsage.groupBy({
                by: ['createdBy'],
                where: { templateId },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
                take: 5
            })
        ]);
        return {
            usageStats,
            recentUsages,
            topUsers
        };
    }
    async exportTemplate(templateId) {
        const template = await this.getTemplateById(templateId);
        if (!template) {
            throw new Error('Template not found');
        }
        return JSON.stringify({
            name: template.name,
            description: template.description,
            category: template.category,
            contentType: template.contentType,
            templateContent: template.templateContent,
            variableSchema: template.variableSchema,
            tags: template.tags,
            exportedAt: new Date().toISOString()
        }, null, 2);
    }
    async importTemplate(templateData, createdBy) {
        try {
            const parsed = JSON.parse(templateData);
            return await this.createTemplate({
                name: parsed.name,
                description: parsed.description,
                category: parsed.category,
                contentType: parsed.contentType,
                templateContent: parsed.templateContent,
                variableSchema: parsed.variableSchema,
                isPublic: false,
                requiredRole: [],
                tags: parsed.tags || [],
                createdBy
            });
        }
        catch (error) {
            throw new Error('Invalid template format');
        }
    }
    async createTemplateVersion(templateId, changeLog) {
        const template = await this.getTemplateById(templateId);
        if (!template) {
            throw new Error('Template not found');
        }
        await this.prisma.templateVersion.create({
            data: {
                templateId,
                version: template.usageCount + 1,
                name: template.name,
                description: template.description,
                templateContent: template.templateContent,
                variableSchema: template.variableSchema,
                changeLog,
                createdBy: template.createdBy
            }
        });
    }
    async getTemplateVersions(templateId) {
        return await this.prisma.templateVersion.findMany({
            where: { templateId },
            include: {
                createdBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
            },
            orderBy: { version: 'desc' }
        });
    }
}
exports.TemplateManagementService = TemplateManagementService;
//# sourceMappingURL=templateManagementService.js.map