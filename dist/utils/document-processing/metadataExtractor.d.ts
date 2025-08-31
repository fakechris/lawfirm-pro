import { DocumentMetadata } from './documentProcessor';
export interface EnhancedMetadata extends DocumentMetadata {
    security: SecurityMetadata;
    content: ContentMetadata;
    technical: TechnicalMetadata;
    legal: LegalMetadata;
    custom?: Record<string, any>;
}
export interface SecurityMetadata {
    hasPassword?: boolean;
    isEncrypted?: boolean;
    hasDigitalSignature?: boolean;
    permissions?: {
        printing?: boolean;
        copying?: boolean;
        modifying?: boolean;
        annotating?: boolean;
    };
    checksum?: string;
    virusScanStatus?: 'clean' | 'infected' | 'scanning' | 'failed';
}
export interface ContentMetadata {
    language?: string;
    readabilityScore?: number;
    sentiment?: 'positive' | 'negative' | 'neutral';
    topics?: string[];
    keywords?: string[];
    entities?: {
        people?: string[];
        organizations?: string[];
        locations?: string[];
        dates?: string[];
    };
    structure?: {
        hasHeadings?: boolean;
        hasLists?: boolean;
        hasTables?: boolean;
        hasImages?: boolean;
        hasLinks?: boolean;
    };
}
export interface TechnicalMetadata {
    format: string;
    version?: string;
    compression?: string;
    encoding?: string;
    colorSpace?: string;
    resolution?: {
        width?: number;
        height?: number;
        dpi?: number;
    };
    duration?: number;
    bitrate?: number;
    codec?: string;
    frames?: number;
}
export interface LegalMetadata {
    documentType?: string;
    jurisdiction?: string;
    caseNumber?: string;
    court?: string;
    parties?: string[];
    dates?: {
        filed?: Date;
        served?: Date;
        heard?: Date;
        decided?: Date;
    };
    attorneys?: string[];
    judges?: string[];
    confidentiality?: 'public' | 'confidential' | 'restricted' | 'secret';
    retention?: {
        policy?: string;
        expirationDate?: Date;
        requiresArchiving?: boolean;
    };
}
export declare class MetadataExtractor {
    private legalDocumentPatterns;
    extractEnhancedMetadata(filePath: string, content: string, mimeType: string): Promise<EnhancedMetadata>;
    private extractSecurityMetadata;
    private extractContentMetadata;
    private extractTechnicalMetadata;
    private extractLegalMetadata;
    private detectLanguage;
    private calculateReadabilityScore;
    private countSyllables;
    private analyzeSentiment;
    private extractKeywords;
    private extractEntities;
    private analyzeStructure;
    private classifyLegalDocument;
    private determineConfidentiality;
    validateMetadata(metadata: EnhancedMetadata): Promise<{
        isValid: boolean;
        issues: string[];
        warnings: string[];
    }>;
    sanitizeMetadata(metadata: EnhancedMetadata): Promise<EnhancedMetadata>;
}
export declare const metadataExtractor: MetadataExtractor;
//# sourceMappingURL=metadataExtractor.d.ts.map