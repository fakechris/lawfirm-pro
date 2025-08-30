import { z } from 'zod';
export declare const documentUploadSchema: z.ZodObject<{
    filename: z.ZodString;
    originalName: z.ZodString;
    size: z.ZodNumber;
    mimeType: z.ZodString;
    caseId: z.ZodOptional<z.ZodString>;
    isConfidential: z.ZodDefault<z.ZodBoolean>;
    isTemplate: z.ZodDefault<z.ZodBoolean>;
    category: z.ZodOptional<z.ZodEnum<["CONTRACT", "COURT_FILING", "EVIDENCE", "CORRESPONDENCE", "INVOICE", "REPORT", "TEMPLATE", "LEGAL_BRIEF", "MOTION", "ORDER", "TRANSCRIPT", "PHOTOGRAPH", "VIDEO", "AUDIO", "OTHER"]>>;
    description: z.ZodOptional<z.ZodString>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    filename: string;
    originalName: string;
    size: number;
    mimeType: string;
    isConfidential: boolean;
    isTemplate: boolean;
    tags: string[];
    caseId?: string | undefined;
    category?: "LEGAL_BRIEF" | "CONTRACT" | "EVIDENCE" | "CORRESPONDENCE" | "COURT_FILING" | "OTHER" | "VIDEO" | "AUDIO" | "INVOICE" | "REPORT" | "TEMPLATE" | "MOTION" | "ORDER" | "TRANSCRIPT" | "PHOTOGRAPH" | undefined;
    description?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}, {
    filename: string;
    originalName: string;
    size: number;
    mimeType: string;
    caseId?: string | undefined;
    isConfidential?: boolean | undefined;
    isTemplate?: boolean | undefined;
    category?: "LEGAL_BRIEF" | "CONTRACT" | "EVIDENCE" | "CORRESPONDENCE" | "COURT_FILING" | "OTHER" | "VIDEO" | "AUDIO" | "INVOICE" | "REPORT" | "TEMPLATE" | "MOTION" | "ORDER" | "TRANSCRIPT" | "PHOTOGRAPH" | undefined;
    description?: string | undefined;
    tags?: string[] | undefined;
    metadata?: Record<string, unknown> | undefined;
}>;
export declare const documentUpdateSchema: z.ZodObject<{
    filename: z.ZodOptional<z.ZodString>;
    originalName: z.ZodOptional<z.ZodString>;
    isConfidential: z.ZodOptional<z.ZodBoolean>;
    isTemplate: z.ZodOptional<z.ZodBoolean>;
    category: z.ZodOptional<z.ZodEnum<["CONTRACT", "COURT_FILING", "EVIDENCE", "CORRESPONDENCE", "INVOICE", "REPORT", "TEMPLATE", "LEGAL_BRIEF", "MOTION", "ORDER", "TRANSCRIPT", "PHOTOGRAPH", "VIDEO", "AUDIO", "OTHER"]>>;
    status: z.ZodOptional<z.ZodEnum<["ACTIVE", "ARCHIVED", "DELETED", "PROCESSING", "PENDING_REVIEW", "APPROVED", "REJECTED"]>>;
    description: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    status?: "ACTIVE" | "ARCHIVED" | "DELETED" | "APPROVED" | "REJECTED" | "PROCESSING" | "PENDING_REVIEW" | undefined;
    filename?: string | undefined;
    originalName?: string | undefined;
    isConfidential?: boolean | undefined;
    isTemplate?: boolean | undefined;
    category?: "LEGAL_BRIEF" | "CONTRACT" | "EVIDENCE" | "CORRESPONDENCE" | "COURT_FILING" | "OTHER" | "VIDEO" | "AUDIO" | "INVOICE" | "REPORT" | "TEMPLATE" | "MOTION" | "ORDER" | "TRANSCRIPT" | "PHOTOGRAPH" | undefined;
    description?: string | undefined;
    tags?: string[] | undefined;
    metadata?: Record<string, unknown> | undefined;
}, {
    status?: "ACTIVE" | "ARCHIVED" | "DELETED" | "APPROVED" | "REJECTED" | "PROCESSING" | "PENDING_REVIEW" | undefined;
    filename?: string | undefined;
    originalName?: string | undefined;
    isConfidential?: boolean | undefined;
    isTemplate?: boolean | undefined;
    category?: "LEGAL_BRIEF" | "CONTRACT" | "EVIDENCE" | "CORRESPONDENCE" | "COURT_FILING" | "OTHER" | "VIDEO" | "AUDIO" | "INVOICE" | "REPORT" | "TEMPLATE" | "MOTION" | "ORDER" | "TRANSCRIPT" | "PHOTOGRAPH" | undefined;
    description?: string | undefined;
    tags?: string[] | undefined;
    metadata?: Record<string, unknown> | undefined;
}>;
export declare const documentVersionSchema: z.ZodObject<{
    documentId: z.ZodString;
    filePath: z.ZodString;
    fileSize: z.ZodNumber;
    checksum: z.ZodString;
    changeDescription: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    checksum: string;
    documentId: string;
    filePath: string;
    fileSize: number;
    changeDescription?: string | undefined;
}, {
    checksum: string;
    documentId: string;
    filePath: string;
    fileSize: number;
    changeDescription?: string | undefined;
}>;
export declare const documentTemplateSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodEnum<["CONTRACT", "COURT_FILING", "LEGAL_BRIEF", "MOTION", "LETTER", "AGREEMENT", "FORM", "REPORT", "INVOICE", "OTHER"]>;
    variables: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    category: "LEGAL_BRIEF" | "CONTRACT" | "COURT_FILING" | "OTHER" | "INVOICE" | "REPORT" | "MOTION" | "LETTER" | "AGREEMENT" | "FORM";
    isActive: boolean;
    description?: string | undefined;
    variables?: Record<string, unknown> | undefined;
}, {
    name: string;
    category: "LEGAL_BRIEF" | "CONTRACT" | "COURT_FILING" | "OTHER" | "INVOICE" | "REPORT" | "MOTION" | "LETTER" | "AGREEMENT" | "FORM";
    description?: string | undefined;
    isActive?: boolean | undefined;
    variables?: Record<string, unknown> | undefined;
}>;
export declare const evidenceItemSchema: z.ZodObject<{
    caseId: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    filePath: z.ZodString;
    thumbnailPath: z.ZodOptional<z.ZodString>;
    fileSize: z.ZodNumber;
    mimeType: z.ZodString;
    collectedBy: z.ZodString;
    location: z.ZodOptional<z.ZodString>;
    isProcessed: z.ZodDefault<z.ZodBoolean>;
    extractedText: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    status: z.ZodDefault<z.ZodEnum<["ACTIVE", "ARCHIVED", "DELETED", "PROCESSING", "ANALYZED", "REVIEWED", "ADMITTED", "EXCLUDED"]>>;
}, "strip", z.ZodTypeAny, {
    status: "ACTIVE" | "ARCHIVED" | "DELETED" | "PROCESSING" | "ANALYZED" | "REVIEWED" | "ADMITTED" | "EXCLUDED";
    name: string;
    mimeType: string;
    caseId: string;
    filePath: string;
    fileSize: number;
    collectedBy: string;
    isProcessed: boolean;
    description?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    thumbnailPath?: string | undefined;
    extractedText?: string | undefined;
    location?: string | undefined;
}, {
    name: string;
    mimeType: string;
    caseId: string;
    filePath: string;
    fileSize: number;
    collectedBy: string;
    status?: "ACTIVE" | "ARCHIVED" | "DELETED" | "PROCESSING" | "ANALYZED" | "REVIEWED" | "ADMITTED" | "EXCLUDED" | undefined;
    description?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    thumbnailPath?: string | undefined;
    extractedText?: string | undefined;
    location?: string | undefined;
    isProcessed?: boolean | undefined;
}>;
export declare const evidenceChainSchema: z.ZodObject<{
    evidenceId: z.ZodString;
    action: z.ZodEnum<["COLLECTED", "PROCESSED", "ANALYZED", "REVIEWED", "ADMITTED", "EXCLUDED", "ARCHIVED", "DESTROYED", "TRANSFERRED"]>;
    location: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    ipAddress: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    evidenceId: string;
    action: "ARCHIVED" | "DESTROYED" | "ANALYZED" | "REVIEWED" | "ADMITTED" | "EXCLUDED" | "COLLECTED" | "PROCESSED" | "TRANSFERRED";
    location?: string | undefined;
    notes?: string | undefined;
    ipAddress?: string | undefined;
}, {
    evidenceId: string;
    action: "ARCHIVED" | "DESTROYED" | "ANALYZED" | "REVIEWED" | "ADMITTED" | "EXCLUDED" | "COLLECTED" | "PROCESSED" | "TRANSFERRED";
    location?: string | undefined;
    notes?: string | undefined;
    ipAddress?: string | undefined;
}>;
export declare const documentWorkflowSchema: z.ZodObject<{
    documentId: z.ZodString;
    workflowType: z.ZodEnum<["APPROVAL", "REVIEW", "SIGNATURE", "FILING", "DISTRIBUTION", "ARCHIVAL", "OTHER"]>;
}, "strip", z.ZodTypeAny, {
    documentId: string;
    workflowType: "OTHER" | "REVIEW" | "APPROVAL" | "SIGNATURE" | "FILING" | "DISTRIBUTION" | "ARCHIVAL";
}, {
    documentId: string;
    workflowType: "OTHER" | "REVIEW" | "APPROVAL" | "SIGNATURE" | "FILING" | "DISTRIBUTION" | "ARCHIVAL";
}>;
export declare const searchSchema: z.ZodObject<{
    query: z.ZodString;
    category: z.ZodOptional<z.ZodEnum<["CONTRACT", "COURT_FILING", "EVIDENCE", "CORRESPONDENCE", "INVOICE", "REPORT", "TEMPLATE", "LEGAL_BRIEF", "MOTION", "ORDER", "TRANSCRIPT", "PHOTOGRAPH", "VIDEO", "AUDIO", "OTHER"]>>;
    caseId: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    status: z.ZodOptional<z.ZodEnum<["ACTIVE", "ARCHIVED", "DELETED", "PROCESSING", "PENDING_REVIEW", "APPROVED", "REJECTED"]>>;
    mimeType: z.ZodOptional<z.ZodString>;
    fromDate: z.ZodOptional<z.ZodDate>;
    toDate: z.ZodOptional<z.ZodDate>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    query: string;
    limit: number;
    offset: number;
    status?: "ACTIVE" | "ARCHIVED" | "DELETED" | "APPROVED" | "REJECTED" | "PROCESSING" | "PENDING_REVIEW" | undefined;
    mimeType?: string | undefined;
    caseId?: string | undefined;
    category?: "LEGAL_BRIEF" | "CONTRACT" | "EVIDENCE" | "CORRESPONDENCE" | "COURT_FILING" | "OTHER" | "VIDEO" | "AUDIO" | "INVOICE" | "REPORT" | "TEMPLATE" | "MOTION" | "ORDER" | "TRANSCRIPT" | "PHOTOGRAPH" | undefined;
    tags?: string[] | undefined;
    fromDate?: Date | undefined;
    toDate?: Date | undefined;
}, {
    query: string;
    status?: "ACTIVE" | "ARCHIVED" | "DELETED" | "APPROVED" | "REJECTED" | "PROCESSING" | "PENDING_REVIEW" | undefined;
    mimeType?: string | undefined;
    caseId?: string | undefined;
    category?: "LEGAL_BRIEF" | "CONTRACT" | "EVIDENCE" | "CORRESPONDENCE" | "COURT_FILING" | "OTHER" | "VIDEO" | "AUDIO" | "INVOICE" | "REPORT" | "TEMPLATE" | "MOTION" | "ORDER" | "TRANSCRIPT" | "PHOTOGRAPH" | undefined;
    tags?: string[] | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
    fromDate?: Date | undefined;
    toDate?: Date | undefined;
}>;
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
export type DocumentUpdateInput = z.infer<typeof documentUpdateSchema>;
export type DocumentVersionInput = z.infer<typeof documentVersionSchema>;
export type DocumentTemplateInput = z.infer<typeof documentTemplateSchema>;
export type EvidenceItemInput = z.infer<typeof evidenceItemSchema>;
export type EvidenceChainInput = z.infer<typeof evidenceChainSchema>;
export type DocumentWorkflowInput = z.infer<typeof documentWorkflowSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
export declare class DocumentValidator {
    static validateMimeType(mimeType: string): boolean;
    static validateFileSize(size: number): boolean;
    static validateFileExtension(filename: string): boolean;
    static sanitizeFilename(filename: string): string;
    static validateSearchQuery(query: string): boolean;
    static validateTag(tag: string): boolean;
    static validateTags(tags: string[]): boolean;
}
export declare const validateRequest: (schema: any) => (req: any, res: any, next: any) => void;
//# sourceMappingURL=index.d.ts.map