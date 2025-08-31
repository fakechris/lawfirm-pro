import { PrismaClient } from '@prisma/client';
import { ContentTemplate, TemplateUsage, CreateTemplateInput, UpdateTemplateInput, TemplateQuery } from '../../../models/knowledge-base';
export declare class TemplateManagementService {
    private prisma;
    private documentService;
    constructor(prisma: PrismaClient);
    createTemplate(input: CreateTemplateInput): Promise<ContentTemplate>;
    getTemplateById(id: string): Promise<ContentTemplate | null>;
    updateTemplate(id: string, input: UpdateTemplateInput): Promise<ContentTemplate>;
    deleteTemplate(id: string): Promise<void>;
    queryTemplates(query?: TemplateQuery): Promise<ContentTemplate[]>;
    useTemplate(templateId: string, contentId: string, variables: Record<string, any>, createdBy: string): Promise<TemplateUsage>;
    getTemplateUsages(templateId: string): Promise<TemplateUsage[]>;
    generateFromTemplate(templateId: string, variables: Record<string, any>): Promise<string>;
    private validateVariables;
    private validateType;
    private validateCustomRules;
    private processConditionalBlocks;
    private processLoops;
    getTemplateCategories(): Promise<string[]>;
    getTemplatesByCategory(category: string): Promise<ContentTemplate[]>;
    getPopularTemplates(limit?: number): Promise<ContentTemplate[]>;
    getTemplateAnalytics(templateId: string): Promise<any>;
    exportTemplate(templateId: string): Promise<string>;
    importTemplate(templateData: string, createdBy: string): Promise<ContentTemplate>;
    createTemplateVersion(templateId: string, changeLog: string): Promise<void>;
    getTemplateVersions(templateId: string): Promise<any[]>;
}
//# sourceMappingURL=templateManagementService.d.ts.map