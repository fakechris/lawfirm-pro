import { Document, DocumentVersion, DocumentTemplate, DocumentWorkflow, DocumentComment, DocumentShare, User, Case, Client } from '@prisma/client';
export interface DocumentWithDetails extends Document {
    versions?: DocumentVersion[];
    case?: Case;
    client?: Client;
    uploadedByUser?: User;
    approvals?: DocumentApproval[];
    template?: DocumentTemplate;
    workflow?: DocumentWorkflow;
    comments?: DocumentComment[];
    shares?: DocumentShare[];
    _count?: {
        versions: number;
        comments: number;
        shares: number;
    };
}
export interface DocumentVersionWithDetails extends DocumentVersion {
    document?: Document;
    createdByUser?: User;
}
export interface DocumentTemplateWithDetails extends DocumentTemplate {
    createdByUser?: User;
    generatedDocuments?: Document[];
    _count?: {
        generatedDocuments: number;
    };
}
export interface DocumentWorkflowWithDetails extends DocumentWorkflow {
    document?: Document;
    steps?: DocumentWorkflowStep[];
    startedByUser?: User;
}
export interface DocumentWorkflowStepWithDetails extends DocumentWorkflowStep {
    workflow?: DocumentWorkflow;
    assignedToUser?: User;
}
export interface DocumentCommentWithDetails extends DocumentComment {
    document?: Document;
    user?: User;
    parent?: DocumentComment;
    replies?: DocumentComment[];
}
export interface DocumentShareWithDetails extends DocumentShare {
    document?: Document;
    sharedByUser?: User;
    sharedWithUser?: User;
}
export interface CreateDocumentInput {
    filename: string;
    originalName: string;
    path: string;
    size: number;
    mimeType: string;
    type: string;
    caseId?: string;
    clientId?: string;
    uploadedById: string;
    isConfidential?: boolean;
    isTemplate?: boolean;
    category?: string;
    description?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
    checksum?: string;
    thumbnailPath?: string;
    extractedText?: string;
}
export interface UpdateDocumentInput {
    filename?: string;
    originalName?: string;
    type?: string;
    status?: string;
    category?: string;
    isConfidential?: boolean;
    isTemplate?: boolean;
    description?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
    extractedText?: string;
    thumbnailPath?: string;
}
export interface CreateDocumentVersionInput {
    documentId: string;
    filePath: string;
    fileSize: number;
    checksum: string;
    changeDescription?: string;
    createdBy: string;
}
export interface CreateDocumentTemplateInput {
    name: string;
    description?: string;
    category?: string;
    filePath: string;
    variableSchema: Record<string, unknown>;
    isPublic?: boolean;
    createdBy: string;
}
export interface UpdateDocumentTemplateInput {
    name?: string;
    description?: string;
    category?: string;
    variableSchema?: Record<string, unknown>;
    isPublic?: boolean;
}
export interface CreateDocumentCommentInput {
    documentId: string;
    userId: string;
    content: string;
    position?: Record<string, unknown>;
    parentId?: string;
}
export interface UpdateDocumentCommentInput {
    content?: string;
    position?: Record<string, unknown>;
    isResolved?: boolean;
}
export interface CreateDocumentShareInput {
    documentId: string;
    sharedBy: string;
    sharedWith: string;
    permission: string;
    expiresAt?: Date;
    message?: string;
}
export interface CreateDocumentWorkflowInput {
    documentId: string;
    status: string;
    startedBy: string;
    steps?: CreateDocumentWorkflowStepInput[];
}
export interface CreateDocumentWorkflowStepInput {
    workflowId: string;
    stepNumber: number;
    name: string;
    description?: string;
    assignedTo?: string;
    dueDate?: Date;
}
export interface UpdateDocumentWorkflowStepInput {
    status?: string;
    action?: string;
    notes?: string;
    completedAt?: Date;
}
export interface DocumentQuery {
    id?: string;
    filename?: string;
    originalName?: string;
    type?: string;
    status?: string;
    category?: string;
    caseId?: string;
    clientId?: string;
    uploadedById?: string;
    isConfidential?: boolean;
    isTemplate?: boolean;
    tags?: string[];
    mimeType?: string;
    fromDate?: Date;
    toDate?: Date;
    search?: string;
}
export interface DocumentVersionQuery {
    documentId?: string;
    versionNumber?: number;
    createdBy?: string;
    fromDate?: Date;
    toDate?: Date;
}
export interface DocumentTemplateQuery {
    id?: string;
    name?: string;
    category?: string;
    isPublic?: boolean;
    createdBy?: string;
    search?: string;
}
export interface DocumentWorkflowQuery {
    documentId?: string;
    status?: string;
    startedBy?: string;
    fromDate?: Date;
    toDate?: Date;
}
export interface DocumentPaginationParams {
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'updatedAt' | 'filename' | 'size' | 'status';
    sortOrder?: 'asc' | 'desc';
}
export interface PaginatedDocumentResult {
    data: DocumentWithDetails[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
export interface DocumentSearchParams {
    query: string;
    filters?: {
        caseId?: string;
        category?: string;
        type?: string;
        status?: string;
        tags?: string[];
        mimeType?: string;
        uploadedById?: string;
        fromDate?: Date;
        toDate?: Date;
    };
    pagination?: DocumentPaginationParams;
}
export interface DocumentSearchResult {
    id: string;
    filename: string;
    originalName: string;
    type: string;
    category?: string;
    status: string;
    excerpt?: string;
    score: number;
    highlights?: string[];
    case?: {
        id: string;
        caseNumber: string;
        title: string;
    };
    uploadedBy?: {
        id: string;
        firstName: string;
        lastName: string;
    };
    createdAt: Date;
    size: number;
    mimeType: string;
}
export interface DocumentProcessingOptions {
    generateThumbnail?: boolean;
    extractText?: boolean;
    extractMetadata?: boolean;
    virusScan?: boolean;
    validateChecksum?: boolean;
}
export interface DocumentProcessingResult {
    success: boolean;
    documentId?: string;
    filePath?: string;
    filename?: string;
    size?: number;
    mimeType?: string;
    checksum?: string;
    thumbnailPath?: string;
    extractedText?: string;
    metadata?: Record<string, unknown>;
    error?: string;
    warnings?: string[];
}
export interface OCRProcessingOptions {
    languages?: string[];
    autoRotate?: boolean;
    preserveFormatting?: boolean;
    confidenceThreshold?: number;
}
export interface OCRProcessingResult {
    success: boolean;
    text?: string;
    confidence?: number;
    language?: string;
    processingTime?: number;
    pages?: OCRPageResult[];
    error?: string;
}
export interface OCRPageResult {
    pageNumber: number;
    text: string;
    confidence: number;
    blocks?: OCRTextBlock[];
}
export interface OCRTextBlock {
    type: 'text' | 'table' | 'image';
    text: string;
    confidence: number;
    boundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}
export interface VersionComparisonResult {
    version1: DocumentVersionWithDetails;
    version2: DocumentVersionWithDetails;
    differences: {
        added: string[];
        removed: string[];
        modified: string[];
    };
    summary: string;
    similarity: number;
}
export interface VersionHistoryOptions {
    includeChanges?: boolean;
    includeMetadata?: boolean;
    maxVersions?: number;
}
export interface TemplateVariable {
    name: string;
    type: 'string' | 'number' | 'date' | 'boolean' | 'select' | 'array';
    description?: string;
    required: boolean;
    defaultValue?: unknown;
    options?: string[];
    validation?: {
        pattern?: string;
        min?: number;
        max?: number;
    };
}
export interface TemplateGenerationInput {
    templateId: string;
    variables: Record<string, unknown>;
    outputFilename?: string;
    caseId?: string;
    clientId?: string;
    uploadedById: string;
}
export interface TemplateGenerationResult {
    success: boolean;
    documentId?: string;
    filePath?: string;
    filename?: string;
    errors?: string[];
    warnings?: string[];
}
export interface DocumentPermission {
    userId: string;
    permissions: {
        read: boolean;
        write: boolean;
        delete: boolean;
        share: boolean;
        download: boolean;
    };
    expiresAt?: Date;
}
export interface DocumentAccessLog {
    id: string;
    documentId: string;
    userId: string;
    action: 'view' | 'download' | 'edit' | 'share' | 'delete';
    ipAddress?: string;
    userAgent?: string;
    timestamp: Date;
}
export interface DocumentStatistics {
    totalDocuments: number;
    totalSize: number;
    byCategory: Record<string, {
        count: number;
        size: number;
    }>;
    byType: Record<string, {
        count: number;
        size: number;
    }>;
    byStatus: Record<string, number>;
    byMimeType: Record<string, number>;
    recentUploads: number;
    storageUsage: {
        used: number;
        available: number;
        byCategory: Record<string, number>;
    };
}
export interface DocumentActivityMetrics {
    totalViews: number;
    totalDownloads: number;
    totalShares: number;
    uniqueUsers: number;
    topDocuments: Array<{
        documentId: string;
        filename: string;
        views: number;
        downloads: number;
    }>;
    activityByDay: Array<{
        date: string;
        views: number;
        downloads: number;
        uploads: number;
    }>;
}
export interface DocumentExportOptions {
    format: 'pdf' | 'zip' | 'csv';
    includeMetadata?: boolean;
    includeVersions?: boolean;
    includeComments?: boolean;
    filters?: DocumentQuery;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export interface DocumentExportResult {
    success: boolean;
    filePath?: string;
    filename?: string;
    size?: number;
    documentCount?: number;
    error?: string;
}
export interface DocumentValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    checksum?: {
        expected: string;
        actual: string;
        matches: boolean;
    };
    virusScan?: {
        isClean: boolean;
        threats?: string[];
    };
    fileFormat?: {
        isSupported: boolean;
        format?: string;
        version?: string;
    };
}
export interface DocumentError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: Date;
    userId?: string;
    documentId?: string;
}
export interface DocumentEvent {
    type: 'created' | 'updated' | 'deleted' | 'shared' | 'downloaded' | 'approved' | 'rejected';
    documentId: string;
    userId: string;
    timestamp: Date;
    data?: Record<string, unknown>;
}
export interface DocumentWebhookPayload {
    event: string;
    document: DocumentWithDetails;
    user?: User;
    timestamp: Date;
}
export interface DocumentIntegrationConfig {
    id: string;
    name: string;
    type: 'webhook' | 'api' | 'storage';
    isEnabled: boolean;
    config: Record<string, unknown>;
    events: string[];
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=index.d.ts.map