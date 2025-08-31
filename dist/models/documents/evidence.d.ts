import { EvidenceItem, EvidenceChain, Case, User } from '@prisma/client';
export interface EvidenceItemWithDetails extends EvidenceItem {
    case?: Case;
    collectedByUser?: User;
    chainOfCustody?: EvidenceChain[];
    tags?: EvidenceTag[];
    relationships?: EvidenceRelationship[];
    document?: any;
    _count?: {
        chainOfCustody: number;
        tags: number;
        relationships: number;
    };
}
export interface EvidenceChainWithDetails extends EvidenceChain {
    evidence?: EvidenceItem;
    performedByUser?: User;
}
export interface EvidenceTag {
    id: string;
    evidenceId: string;
    tagName: string;
    color?: string;
    description?: string;
    createdAt: Date;
    createdBy: string;
}
export interface EvidenceRelationship {
    id: string;
    evidenceId: string;
    relatedEvidenceId: string;
    relationshipType: string;
    description?: string;
    createdAt: Date;
    createdBy: string;
}
export interface CreateEvidenceItemInput {
    caseId: string;
    title: string;
    description?: string;
    type: string;
    filePath?: string;
    fileSize?: number;
    mimeType?: string;
    location?: string;
    collectedBy: string;
    collectedAt?: Date;
    tags?: string[];
    metadata?: Record<string, unknown>;
    checksum?: string;
}
export interface UpdateEvidenceItemInput {
    title?: string;
    description?: string;
    type?: string;
    status?: string;
    location?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
}
export interface CreateEvidenceChainInput {
    evidenceId: string;
    action: string;
    performedBy: string;
    location?: string;
    notes?: string;
    signature?: string;
    performedAt?: Date;
}
export interface CreateEvidenceTagInput {
    evidenceId: string;
    tagName: string;
    color?: string;
    description?: string;
    createdBy: string;
}
export interface CreateEvidenceRelationshipInput {
    evidenceId: string;
    relatedEvidenceId: string;
    relationshipType: string;
    description?: string;
    createdBy: string;
}
export interface EvidenceItemQuery {
    id?: string;
    caseId?: string;
    title?: string;
    type?: string;
    status?: string;
    location?: string;
    collectedBy?: string;
    tags?: string[];
    mimeType?: string;
    fromDate?: Date;
    toDate?: Date;
    search?: string;
}
export interface EvidenceChainQuery {
    evidenceId?: string;
    action?: string;
    performedBy?: string;
    fromDate?: Date;
    toDate?: Date;
}
export interface EvidencePaginationParams {
    page?: number;
    limit?: number;
    sortBy?: 'collectedAt' | 'title' | 'type' | 'status';
    sortOrder?: 'asc' | 'desc';
}
export interface PaginatedEvidenceResult {
    data: EvidenceItemWithDetails[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
export interface EvidenceSearchParams {
    query: string;
    filters?: {
        caseId?: string;
        type?: string;
        status?: string;
        tags?: string[];
        location?: string;
        collectedBy?: string;
        fromDate?: Date;
        toDate?: Date;
    };
    pagination?: EvidencePaginationParams;
}
export interface EvidenceSearchResult {
    id: string;
    title: string;
    type: string;
    status: string;
    excerpt?: string;
    score: number;
    highlights?: string[];
    case?: {
        id: string;
        caseNumber: string;
        title: string;
    };
    collectedBy?: {
        id: string;
        firstName: string;
        lastName: string;
    };
    collectedAt: Date;
    location?: string;
    tags?: string[];
}
export interface EvidenceProcessingOptions {
    generateThumbnail?: boolean;
    extractText?: boolean;
    extractMetadata?: boolean;
    analyzeContent?: boolean;
    validateIntegrity?: boolean;
}
export interface EvidenceProcessingResult {
    success: boolean;
    evidenceId?: string;
    filePath?: string;
    thumbnailPath?: string;
    extractedText?: string;
    metadata?: Record<string, unknown>;
    analysisResults?: EvidenceAnalysisResult;
    error?: string;
    warnings?: string[];
}
export interface EvidenceAnalysisResult {
    contentAnalysis?: {
        textContent: string;
        entities: Array<{
            type: string;
            value: string;
            confidence: number;
        }>;
        sentiment?: {
            score: number;
            magnitude: number;
        };
    };
    imageAnalysis?: {
        objects: Array<{
            label: string;
            confidence: number;
        }>;
        faces?: Array<{
            confidence: number;
            boundingBox?: {
                x: number;
                y: number;
                width: number;
                height: number;
            };
        }>;
        text?: string;
    };
    documentAnalysis?: {
        documentType: string;
        fields?: Record<string, unknown>;
        tables?: Array<{
            rows: number;
            columns: number;
            data: unknown[][];
        }>;
    };
}
export interface ChainOfCustodyOptions {
    includeSignature?: boolean;
    requireLocation?: boolean;
    requireNotes?: boolean;
    autoGenerateReport?: boolean;
}
export interface ChainOfCustodyReport {
    evidenceId: string;
    evidenceTitle: string;
    caseId: string;
    caseNumber: string;
    chain: EvidenceChainWithDetails[];
    summary: {
        totalActions: number;
        firstAction: Date;
        lastAction: Date;
        duration: number;
        locations: string[];
        handlers: string[];
    };
    integrity: {
        isComplete: boolean;
        hasGaps: boolean;
        issues: string[];
    };
    generatedAt: Date;
    generatedBy: string;
}
export interface EvidenceRelationshipType {
    id: string;
    name: string;
    description?: string;
    isBidirectional: boolean;
    color?: string;
}
export interface EvidenceRelationshipGraph {
    nodes: Array<{
        id: string;
        label: string;
        type: string;
        status: string;
        x?: number;
        y?: number;
    }>;
    edges: Array<{
        from: string;
        to: string;
        type: string;
        label?: string;
        color?: string;
    }>;
}
export interface EvidenceStatistics {
    totalItems: number;
    byType: Record<string, {
        count: number;
        size?: number;
    }>;
    byStatus: Record<string, number>;
    byCase: Record<string, {
        caseTitle: string;
        itemCount: number;
    }>;
    byLocation: Record<string, number>;
    recentCollections: number;
    chainOfCustodyStats: {
        averageChainLength: number;
        completeChains: number;
        incompleteChains: number;
        integrityPercentage: number;
    };
}
export interface EvidenceActivityMetrics {
    totalViews: number;
    totalDownloads: number;
    totalAnalysis: number;
    uniqueUsers: number;
    topEvidenceItems: Array<{
        evidenceId: string;
        title: string;
        views: number;
        downloads: number;
    }>;
    activityByDay: Array<{
        date: string;
        collections: number;
        analysis: number;
        views: number;
    }>;
}
export interface EvidenceExportOptions {
    format: 'pdf' | 'zip' | 'csv';
    includeChainOfCustody?: boolean;
    includeMetadata?: boolean;
    includeAnalysis?: boolean;
    includeRelationships?: boolean;
    filters?: EvidenceItemQuery;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export interface EvidenceExportResult {
    success: boolean;
    filePath?: string;
    filename?: string;
    size?: number;
    itemCount?: number;
    error?: string;
}
export interface EvidenceValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    integrity?: {
        checksum?: {
            expected: string;
            actual: string;
            matches: boolean;
        };
        chainOfCustody?: {
            isComplete: boolean;
            hasGaps: boolean;
            lastAction: Date;
        };
    };
    fileFormat?: {
        isSupported: boolean;
        format?: string;
        version?: string;
    };
    legalAdmissibility?: {
        isAdmissible: boolean;
        concerns: string[];
        recommendations: string[];
    };
}
export interface EvidenceError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: Date;
    userId?: string;
    evidenceId?: string;
}
export interface EvidenceEvent {
    type: 'collected' | 'processed' | 'analyzed' | 'updated' | 'transferred' | 'archived' | 'destroyed';
    evidenceId: string;
    caseId: string;
    userId: string;
    timestamp: Date;
    data?: Record<string, unknown>;
}
export interface EvidenceComplianceCheck {
    evidenceId: string;
    checks: Array<{
        name: string;
        description: string;
        status: 'passed' | 'failed' | 'warning';
        details?: string;
        recommendation?: string;
    }>;
    overallStatus: 'compliant' | 'non_compliant' | 'warning';
    lastChecked: Date;
    checkedBy: string;
}
export interface EvidenceRetentionPolicy {
    id: string;
    name: string;
    description: string;
    caseTypes: string[];
    evidenceTypes: string[];
    retentionPeriod: number;
    disposition: 'archive' | 'destroy' | 'transfer';
    requiresApproval: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=evidence.d.ts.map