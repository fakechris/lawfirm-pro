export * from './index';
export * from './evidence';
export * from './storage';
export * from './workflow';
export * from './search';
export { Document, DocumentVersion, DocumentTemplate, DocumentComment, DocumentShare, DocumentWorkflow, DocumentWorkflowStep, EvidenceItem, EvidenceChain, SearchIndex, User, Case, Client, } from '@prisma/client';
export declare const isDocument: (obj: unknown) => obj is Document;
export declare const isEvidenceItem: (obj: unknown) => obj is EvidenceItem;
export declare const isDocumentWorkflow: (obj: unknown) => obj is DocumentWorkflow;
export type DocumentEntity = Document | EvidenceItem | DocumentTemplate;
export type SearchableEntity = Document | EvidenceItem | Case | User;
export interface DocumentServiceContext {
    userId: string;
    userRole: string;
    tenantId?: string;
    ipAddress?: string;
    userAgent?: string;
}
export interface DocumentOperationResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
    warnings?: string[];
    metadata?: Record<string, unknown>;
}
export interface DocumentListResult<T = unknown> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    filters?: Record<string, unknown>;
    sort?: {
        field: string;
        order: 'asc' | 'desc';
    };
}
export declare const DOCUMENT_CATEGORIES: readonly ["LEGAL_BRIEF", "CONTRACT", "EVIDENCE", "CORRESPONDENCE", "COURT_FILING", "RESEARCH", "FINANCIAL", "MEDICAL", "INVOICE", "REPORT", "TEMPLATE", "MOTION", "ORDER", "TRANSCRIPT", "PHOTOGRAPH", "VIDEO", "AUDIO", "OTHER"];
export declare const DOCUMENT_STATUSES: readonly ["DRAFT", "ACTIVE", "ARCHIVED", "DELETED", "UNDER_REVIEW", "APPROVED", "REJECTED", "PROCESSING"];
export declare const DOCUMENT_TYPES: readonly ["LEGAL_DOCUMENT", "EVIDENCE", "CONTRACT", "CORRESPONDENCE", "COURT_FILING", "RESEARCH", "TEMPLATE", "OTHER"];
export declare const EVIDENCE_TYPES: readonly ["PHYSICAL", "DIGITAL", "DOCUMENT", "PHOTO", "VIDEO", "AUDIO", "TESTIMONY", "EXPERT_REPORT"];
export declare const WORKFLOW_STATUSES: readonly ["DRAFT", "IN_PROGRESS", "REVIEW", "APPROVED", "REJECTED", "COMPLETED"];
export declare const WORKFLOW_STEP_STATUSES: readonly ["PENDING", "IN_PROGRESS", "COMPLETED", "SKIPPED", "REJECTED"];
export declare const DOCUMENT_SHARE_PERMISSIONS: readonly ["VIEW", "COMMENT", "EDIT", "DOWNLOAD"];
export declare const DEFAULT_DOCUMENT_CONFIG: {
    maxFileSize: number;
    allowedMimeTypes: string[];
    allowedExtensions: string[];
    thumbnailSizes: {
        small: {
            width: number;
            height: number;
        };
        medium: {
            width: number;
            height: number;
        };
        large: {
            width: number;
            height: number;
        };
    };
    retention: {
        drafts: number;
        temp: number;
        versions: number;
        deleted: number;
    };
};
export declare const DEFAULT_SEARCH_CONFIG: {
    maxResults: number;
    defaultLimit: number;
    minQueryLength: number;
    fuzzySearch: boolean;
    highlightResults: boolean;
    searchInContent: boolean;
    searchInMetadata: boolean;
    boost: {
        title: number;
        content: number;
        metadata: number;
        tags: number;
    };
};
export declare const DEFAULT_WORKFLOW_CONFIG: {
    autoAssign: boolean;
    sendNotifications: boolean;
    createTasks: boolean;
    defaultDueDateOffset: number;
    maxSteps: number;
    allowParallel: boolean;
    requireCompletion: boolean;
};
export declare const DOCUMENT_ID_REGEX: RegExp;
export declare const FILENAME_REGEX: RegExp;
export declare const EMAIL_REGEX: RegExp;
export declare const PHONE_REGEX: RegExp;
export declare const DOCUMENT_ERROR_CODES: {
    readonly FILE_TOO_LARGE: "FILE_TOO_LARGE";
    readonly INVALID_FILE_TYPE: "INVALID_FILE_TYPE";
    readonly FILE_NOT_FOUND: "FILE_NOT_FOUND";
    readonly PERMISSION_DENIED: "PERMISSION_DENIED";
    readonly DUPLICATE_FILE: "DUPLICATE_FILE";
    readonly VALIDATION_ERROR: "VALIDATION_ERROR";
    readonly STORAGE_ERROR: "STORAGE_ERROR";
    readonly PROCESSING_ERROR: "PROCESSING_ERROR";
    readonly QUOTA_EXCEEDED: "QUOTA_EXCEEDED";
    readonly WORKFLOW_ERROR: "WORKFLOW_ERROR";
    readonly SEARCH_ERROR: "SEARCH_ERROR";
};
export declare const DOCUMENT_EVENTS: {
    readonly CREATED: "document.created";
    readonly UPDATED: "document.updated";
    readonly DELETED: "document.deleted";
    readonly UPLOADED: "document.uploaded";
    readonly DOWNLOADED: "document.downloaded";
    readonly SHARED: "document.shared";
    readonly APPROVED: "document.approved";
    readonly REJECTED: "document.rejected";
    readonly VERSION_CREATED: "document.version.created";
    readonly COMMENT_ADDED: "document.comment.added";
    readonly WORKFLOW_STARTED: "document.workflow.started";
    readonly WORKFLOW_COMPLETED: "document.workflow.completed";
    readonly SEARCH_PERFORMED: "document.search.performed";
};
//# sourceMappingURL=models.d.ts.map