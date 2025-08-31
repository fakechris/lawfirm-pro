import { PrismaClient } from '@prisma/client';
import { InvoiceTemplate, TemplateCreateRequest, TemplateUpdateRequest, TemplateApprovalRequest, TemplateVersion, InvoiceTemplateType, TemplateStatus } from '../models/InvoiceTemplate';
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
    approvers: string[];
    autoApprovalThreshold?: number;
    maxVersions?: number;
    retentionPeriod?: number;
    notificationSettings: {
        notifyOnSubmission: boolean;
        notifyOnApproval: boolean;
        notifyOnRejection: boolean;
        notifyOnVersion: boolean;
    };
}
export declare class InvoiceTemplateService {
    private prisma;
    private model;
    private workflowConfig;
    constructor(prisma: PrismaClient);
    createTemplate(request: TemplateCreateRequest, createdBy: string): Promise<InvoiceTemplate>;
    getTemplate(id: string): Promise<InvoiceTemplate | null>;
    getTemplates(filters?: {
        type?: InvoiceTemplateType;
        status?: TemplateStatus;
        createdBy?: string;
        tags?: string[];
        search?: string;
    }): Promise<InvoiceTemplate[]>;
    updateTemplate(id: string, request: TemplateUpdateRequest, updatedBy: string): Promise<InvoiceTemplate>;
    deleteTemplate(id: string, deletedBy: string): Promise<void>;
    submitForApproval(id: string, submittedBy: string): Promise<InvoiceTemplate>;
    approveTemplate(id: string, request: TemplateApprovalRequest, approvedBy: string): Promise<InvoiceTemplate>;
    setDefaultTemplate(id: string, setBy: string): Promise<InvoiceTemplate>;
    getDefaultTemplate(type: InvoiceTemplateType): Promise<InvoiceTemplate | null>;
    getTemplateVersions(templateId: string): Promise<TemplateVersion[]>;
    getTemplateVersion(templateId: string, version: number): Promise<TemplateVersion | null>;
    restoreTemplateVersion(templateId: string, version: number, restoredBy: string): Promise<InvoiceTemplate>;
    getTemplateUsage(templateId: string): Promise<TemplateUsageStats>;
    getAllTemplateUsageStats(): Promise<TemplateUsageStats[]>;
    exportTemplates(request: TemplateExportRequest): Promise<string>;
    importTemplates(request: TemplateImportRequest): Promise<InvoiceTemplate[]>;
    archiveTemplate(id: string, archivedBy: string): Promise<InvoiceTemplate>;
    duplicateTemplate(id: string, duplicatedBy: string, newName?: string): Promise<InvoiceTemplate>;
    private validateTemplate;
    private logTemplateActivity;
    private notifyApprovers;
    private notifyCreator;
    private convertToXML;
    private parseXML;
    private escapeXML;
    updateWorkflowConfig(config: Partial<TemplateWorkflowConfig>): Promise<TemplateWorkflowConfig>;
    getWorkflowConfig(): Promise<TemplateWorkflowConfig>;
    submitTemplateWithWorkflow(templateId: string, submittedBy: string, message?: string): Promise<InvoiceTemplate>;
    approveTemplateWithWorkflow(templateId: string, approved: boolean, approvedBy: string, comments?: string): Promise<InvoiceTemplate>;
    createApprovalRequest(templateId: string, requestedBy: string, message?: string): Promise<void>;
    updateApprovalRequest(templateId: string, approved: boolean, approvedBy: string, comments?: string): Promise<void>;
    getApprovalRequests(filters?: {
        status?: 'PENDING' | 'APPROVED' | 'REJECTED';
        templateId?: string;
        requestedBy?: string;
        approver?: string;
    }): Promise<any[]>;
    cleanupOldVersions(): Promise<void>;
    getTemplateWorkflowHistory(templateId: string): Promise<any[]>;
    bulkApproveTemplates(templateIds: string[], approved: boolean, approvedBy: string, comments?: string): Promise<InvoiceTemplate[]>;
    getPendingApprovals(userId: string): Promise<InvoiceTemplate[]>;
    private isAuthorizedApprover;
    private getDefaultWorkflowConfig;
}
//# sourceMappingURL=InvoiceTemplateService.d.ts.map