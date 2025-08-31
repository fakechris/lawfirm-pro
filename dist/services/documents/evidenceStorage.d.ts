export interface EvidenceUploadOptions {
    title: string;
    description?: string;
    type: 'PHYSICAL' | 'DIGITAL' | 'DOCUMENT' | 'PHOTO' | 'VIDEO' | 'AUDIO' | 'TESTIMONY' | 'EXPERT_REPORT';
    caseId: string;
    collectedBy: string;
    location?: string;
    generateChecksum?: boolean;
    generateThumbnail?: boolean;
    encrypt?: boolean;
    compress?: boolean;
    overwrite?: boolean;
    metadata?: Record<string, unknown>;
    tags?: string[];
    chainOfCustody?: Array<{
        transferredTo: string;
        transferredBy: string;
        transferDate: Date;
        reason: string;
        notes?: string;
        signature?: string;
    }>;
}
export interface EvidenceStorageResult {
    success: boolean;
    evidenceId?: string;
    filePath?: string;
    filename: string;
    size: number;
    mimeType?: string;
    checksum?: string;
    thumbnailPath?: string;
    error?: string;
    warnings?: string[];
    processingTime?: number;
    metadata?: Record<string, unknown>;
}
export interface ChainOfCustodyEntry {
    id: string;
    evidenceId: string;
    action: string;
    performedBy: string;
    performedAt: Date;
    location?: string;
    notes?: string;
    signature?: string;
}
export interface EvidenceIntegrityResult {
    isValid: boolean;
    checksumMatches: boolean;
    chainOfCustodyComplete: boolean;
    tamperingDetected: boolean;
    issues: string[];
    recommendations: string[];
}
export declare class EvidenceStorageService {
    private basePath;
    private maxFileSize;
    private allowedMimeTypes;
    private baseStorageService;
    constructor();
    private ensureDirectoryExists;
    private generateEvidenceFilename;
    private getFileExtensionFromType;
    private getStoragePath;
    private calculateFileHash;
    private getFileChecksum;
    private generateEvidenceId;
    private validateEvidenceFile;
    uploadEvidence(fileBuffer: Buffer, filename: string, options: EvidenceUploadOptions): Promise<EvidenceStorageResult>;
    private generateThumbnail;
    addToChainOfCustody(evidenceId: string, entry: {
        action: string;
        performedBy: string;
        location?: string;
        notes?: string;
        signature?: string;
    }): Promise<ChainOfCustodyEntry>;
    getChainOfCustody(evidenceId: string): Promise<ChainOfCustodyEntry[]>;
    verifyEvidenceIntegrity(evidenceId: string): Promise<EvidenceIntegrityResult>;
    sealEvidence(evidenceId: string, sealedBy: string): Promise<boolean>;
    transferEvidence(evidenceId: string, transferTo: string, transferBy: string, reason: string, location?: string): Promise<boolean>;
    disposeEvidence(evidenceId: string, disposedBy: string, method: string): Promise<boolean>;
    generateEvidenceReport(evidenceId: string): Promise<{
        evidenceInfo: Record<string, unknown>;
        chainOfCustody: ChainOfCustodyEntry[];
        integrityStatus: EvidenceIntegrityResult;
        recommendations: string[];
    }>;
}
export declare const evidenceStorageService: EvidenceStorageService;
//# sourceMappingURL=evidenceStorage.d.ts.map