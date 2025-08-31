import fs from 'fs/promises';
import path from 'path';
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
  duration?: number; // For audio/video
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

export class MetadataExtractor {
  private legalDocumentPatterns = {
    caseNumber: /(?:案件编号|Case No\.|Case Number)\s*[:：]?\s*([A-Za-z0-9\-_]+)/gi,
    court: /(?:法院|Court)\s*[:：]?\s*([^\n\r]+)/gi,
    parties: /(?:当事人|Parties?)\s*[:：]?\s*([^\n\r]+)/gi,
    attorney: /(?:律师|Attorney)\s*[:：]?\s*([^\n\r]+)/gi,
    judge: /(?:法官|Judge)\s*[:：]?\s*([^\n\r]+)/gi,
  };

  async extractEnhancedMetadata(
    filePath: string,
    content: string,
    mimeType: string
  ): Promise<EnhancedMetadata> {
    const baseMetadata: DocumentMetadata = {};
    const security = await this.extractSecurityMetadata(filePath);
    const contentMeta = await this.extractContentMetadata(content);
    const technical = await this.extractTechnicalMetadata(filePath, mimeType);
    const legal = await this.extractLegalMetadata(content);

    return {
      ...baseMetadata,
      security,
      content: contentMeta,
      technical,
      legal,
    };
  }

  private async extractSecurityMetadata(filePath: string): Promise<SecurityMetadata> {
    // Simplified security metadata extraction
    // In a real implementation, you would use specialized libraries
    
    return {
      hasPassword: false,
      isEncrypted: false,
      hasDigitalSignature: false,
      permissions: {
        printing: true,
        copying: true,
        modifying: true,
        annotating: true,
      },
      virusScanStatus: 'clean',
    };
  }

  private async extractContentMetadata(content: string): Promise<ContentMetadata> {
    const language = this.detectLanguage(content);
    const readabilityScore = this.calculateReadabilityScore(content);
    const sentiment = this.analyzeSentiment(content);
    const keywords = this.extractKeywords(content);
    const entities = this.extractEntities(content);
    const structure = this.analyzeStructure(content);

    return {
      language,
      readabilityScore,
      sentiment,
      keywords,
      entities,
      structure,
    };
  }

  private async extractTechnicalMetadata(
    filePath: string,
    mimeType: string
  ): Promise<TechnicalMetadata> {
    const buffer = await fs.readFile(filePath);
    
    const metadata: TechnicalMetadata = {
      format: mimeType,
    };

    if (mimeType.startsWith('image/')) {
      try {
        const sharp = require('sharp');
        const imageMetadata = await sharp(buffer).metadata();
        metadata.resolution = {
          width: imageMetadata.width,
          height: imageMetadata.height,
          dpi: imageMetadata.density,
        };
        metadata.colorSpace = imageMetadata.space;
        metadata.compression = imageMetadata.compression;
      } catch (error) {
        // Sharp not available or failed
      }
    }

    // Add more technical metadata extraction based on file type
    if (mimeType === 'application/pdf') {
      // Extract PDF-specific metadata
      metadata.version = '1.7'; // Default
      metadata.compression = 'flate';
    }

    return metadata;
  }

  private async extractLegalMetadata(content: string): Promise<LegalMetadata> {
    const legal: LegalMetadata = {};

    // Extract legal-specific patterns
    for (const [key, pattern] of Object.entries(this.legalDocumentPatterns)) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        switch (key) {
          case 'caseNumber':
            legal.caseNumber = matches[0].split(/[:：]/)[1]?.trim();
            break;
          case 'court':
            legal.court = matches[0].split(/[:：]/)[1]?.trim();
            break;
          case 'parties':
            legal.parties = matches.map(m => m.split(/[:：]/)[1]?.trim()).filter(Boolean);
            break;
          case 'attorney':
            legal.attorneys = matches.map(m => m.split(/[:：]/)[1]?.trim()).filter(Boolean);
            break;
          case 'judge':
            legal.judges = matches.map(m => m.split(/[:：]/)[1]?.trim()).filter(Boolean);
            break;
        }
      }
    }

    // Determine document type based on content
    legal.documentType = this.classifyLegalDocument(content);
    
    // Set default confidentiality
    legal.confidentiality = this.determineConfidentiality(content);

    return legal;
  }

  private detectLanguage(content: string): string {
    const chineseRegex = /[\u4e00-\u9fff]/;
    const englishRegex = /^[a-zA-Z\s\d.,!?;:'"()-]+$/;

    if (chineseRegex.test(content)) {
      return 'zh-CN';
    } else if (englishRegex.test(content)) {
      return 'en';
    } else {
      return 'unknown';
    }
  }

  private calculateReadabilityScore(content: string): number {
    // Simplified Flesch Reading Ease calculation
    const sentences = content.split(/[.!?]+/).length;
    const words = content.split(/\s+/).length;
    const syllables = this.countSyllables(content);

    if (sentences === 0 || words === 0) return 0;

    const score = 206.835 - (1.015 * (words / sentences)) - (84.6 * (syllables / words));
    return Math.max(0, Math.min(100, score));
  }

  private countSyllables(text: string): number {
    // Simplified syllable counting
    const words = text.toLowerCase().split(/\s+/);
    let count = 0;

    for (const word of words) {
      const syllableMatches = word.match(/[aeiouAEIOU]+/g);
      count += syllableMatches ? syllableMatches.length : 1;
    }

    return count;
  }

  private analyzeSentiment(content: string): 'positive' | 'negative' | 'neutral' {
    // Simplified sentiment analysis
    const positiveWords = ['同意', '批准', '支持', '通过', '胜诉', '成功'];
    const negativeWords = ['拒绝', '反对', '驳回', '败诉', '失败', '违法'];

    const positiveCount = positiveWords.filter(word => content.includes(word)).length;
    const negativeCount = negativeWords.filter(word => content.includes(word)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private extractKeywords(content: string): string[] {
    // Simple keyword extraction
    const words = content.toLowerCase().split(/\s+/);
    const wordFreq: Record<string, number> = {};

    // Count word frequencies
    for (const word of words) {
      if (word.length > 3) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    }

    // Sort by frequency and return top keywords
    return Object.entries(wordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  private extractEntities(content: string): ContentMetadata['entities'] {
    const entities: ContentMetadata['entities'] = {
      people: [],
      organizations: [],
      locations: [],
      dates: [],
    };

    // Simple entity extraction patterns
    const datePattern = /\d{4}年\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2}\/\d{4}/g;
    entities.dates = content.match(datePattern) || [];

    // Chinese location patterns
    const locationPattern = /(北京|上海|广州|深圳|天津|重庆|省|市|区|县|镇|村)/g;
    entities.locations = content.match(locationPattern) || [];

    return entities;
  }

  private analyzeStructure(content: string): ContentMetadata['structure'] {
    return {
      hasHeadings: /#{1,6}\s/.test(content) || /\n[A-Z][A-Z\s]+\n/.test(content),
      hasLists: /^\s*[-*+]\s/.test(content) || /^\s*\d+\.\s/.test(content),
      hasTables: /\|.*\|/.test(content),
      hasImages: /!\[.*\]\(.*\)/.test(content),
      hasLinks: /https?:\/\/[^\s]+/.test(content),
    };
  }

  private classifyLegalDocument(content: string): string {
    const patterns = {
      contract: /合同|协议|Agreement|Contract/i,
      petition: /起诉书|申请书|Petition|Application/i,
      judgment: /判决书|裁定书|Judgment|Order/i,
      evidence: /证据|Evidence|Exhibit/i,
      brief: /辩护词|Brief|Memorandum/i,
      notice: /通知书|Notice|Memo/i,
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(content)) {
        return type;
      }
    }

    return 'unknown';
  }

  private determineConfidentiality(content: string): LegalMetadata['confidentiality'] {
    const confidentialPatterns = [
      /机密|Confidential|保密/i,
      /内部文件|Internal/i,
      /仅限律师|Attorney Eyes Only/i,
    ];

    for (const pattern of confidentialPatterns) {
      if (pattern.test(content)) {
        return 'confidential';
      }
    }

    return 'public';
  }

  async validateMetadata(metadata: EnhancedMetadata): Promise<{
    isValid: boolean;
    issues: string[];
    warnings: string[];
  }> {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!metadata.technical.format) {
      issues.push('Technical metadata missing format');
    }

    // Validate security constraints
    if (metadata.security.isEncrypted && !metadata.security.hasPassword) {
      issues.push('Encrypted document requires password');
    }

    // Check for potential issues
    if (metadata.content.readabilityScore && metadata.content.readabilityScore < 30) {
      warnings.push('Document has low readability score');
    }

    if (metadata.security.virusScanStatus === 'failed') {
      issues.push('Virus scan failed');
    }

    return {
      isValid: issues.length === 0,
      issues,
      warnings,
    };
  }

  async sanitizeMetadata(metadata: EnhancedMetadata): Promise<EnhancedMetadata> {
    // Remove sensitive information from metadata
    const sanitized = { ...metadata };

    // Remove potentially sensitive custom fields
    if (sanitized.custom) {
      const sensitiveKeys = ['password', 'token', 'secret', 'key'];
      for (const key of Object.keys(sanitized.custom)) {
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
          delete sanitized.custom[key];
        }
      }
    }

    return sanitized;
  }
}

export const metadataExtractor = new MetadataExtractor();