"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadataExtractor = exports.MetadataExtractor = void 0;
const promises_1 = __importDefault(require("fs/promises"));
class MetadataExtractor {
    constructor() {
        this.legalDocumentPatterns = {
            caseNumber: /(?:案件编号|Case No\.|Case Number)\s*[:：]?\s*([A-Za-z0-9\-_]+)/gi,
            court: /(?:法院|Court)\s*[:：]?\s*([^\n\r]+)/gi,
            parties: /(?:当事人|Parties?)\s*[:：]?\s*([^\n\r]+)/gi,
            attorney: /(?:律师|Attorney)\s*[:：]?\s*([^\n\r]+)/gi,
            judge: /(?:法官|Judge)\s*[:：]?\s*([^\n\r]+)/gi,
        };
    }
    async extractEnhancedMetadata(filePath, content, mimeType) {
        const baseMetadata = {};
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
    async extractSecurityMetadata(filePath) {
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
    async extractContentMetadata(content) {
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
    async extractTechnicalMetadata(filePath, mimeType) {
        const buffer = await promises_1.default.readFile(filePath);
        const metadata = {
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
            }
            catch (error) {
            }
        }
        if (mimeType === 'application/pdf') {
            metadata.version = '1.7';
            metadata.compression = 'flate';
        }
        return metadata;
    }
    async extractLegalMetadata(content) {
        const legal = {};
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
        legal.documentType = this.classifyLegalDocument(content);
        legal.confidentiality = this.determineConfidentiality(content);
        return legal;
    }
    detectLanguage(content) {
        const chineseRegex = /[\u4e00-\u9fff]/;
        const englishRegex = /^[a-zA-Z\s\d.,!?;:'"()-]+$/;
        if (chineseRegex.test(content)) {
            return 'zh-CN';
        }
        else if (englishRegex.test(content)) {
            return 'en';
        }
        else {
            return 'unknown';
        }
    }
    calculateReadabilityScore(content) {
        const sentences = content.split(/[.!?]+/).length;
        const words = content.split(/\s+/).length;
        const syllables = this.countSyllables(content);
        if (sentences === 0 || words === 0)
            return 0;
        const score = 206.835 - (1.015 * (words / sentences)) - (84.6 * (syllables / words));
        return Math.max(0, Math.min(100, score));
    }
    countSyllables(text) {
        const words = text.toLowerCase().split(/\s+/);
        let count = 0;
        for (const word of words) {
            const syllableMatches = word.match(/[aeiouAEIOU]+/g);
            count += syllableMatches ? syllableMatches.length : 1;
        }
        return count;
    }
    analyzeSentiment(content) {
        const positiveWords = ['同意', '批准', '支持', '通过', '胜诉', '成功'];
        const negativeWords = ['拒绝', '反对', '驳回', '败诉', '失败', '违法'];
        const positiveCount = positiveWords.filter(word => content.includes(word)).length;
        const negativeCount = negativeWords.filter(word => content.includes(word)).length;
        if (positiveCount > negativeCount)
            return 'positive';
        if (negativeCount > positiveCount)
            return 'negative';
        return 'neutral';
    }
    extractKeywords(content) {
        const words = content.toLowerCase().split(/\s+/);
        const wordFreq = {};
        for (const word of words) {
            if (word.length > 3) {
                wordFreq[word] = (wordFreq[word] || 0) + 1;
            }
        }
        return Object.entries(wordFreq)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([word]) => word);
    }
    extractEntities(content) {
        const entities = {
            people: [],
            organizations: [],
            locations: [],
            dates: [],
        };
        const datePattern = /\d{4}年\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2}\/\d{4}/g;
        entities.dates = content.match(datePattern) || [];
        const locationPattern = /(北京|上海|广州|深圳|天津|重庆|省|市|区|县|镇|村)/g;
        entities.locations = content.match(locationPattern) || [];
        return entities;
    }
    analyzeStructure(content) {
        return {
            hasHeadings: /#{1,6}\s/.test(content) || /\n[A-Z][A-Z\s]+\n/.test(content),
            hasLists: /^\s*[-*+]\s/.test(content) || /^\s*\d+\.\s/.test(content),
            hasTables: /\|.*\|/.test(content),
            hasImages: /!\[.*\]\(.*\)/.test(content),
            hasLinks: /https?:\/\/[^\s]+/.test(content),
        };
    }
    classifyLegalDocument(content) {
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
    determineConfidentiality(content) {
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
    async validateMetadata(metadata) {
        const issues = [];
        const warnings = [];
        if (!metadata.technical.format) {
            issues.push('Technical metadata missing format');
        }
        if (metadata.security.isEncrypted && !metadata.security.hasPassword) {
            issues.push('Encrypted document requires password');
        }
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
    async sanitizeMetadata(metadata) {
        const sanitized = { ...metadata };
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
exports.MetadataExtractor = MetadataExtractor;
exports.metadataExtractor = new MetadataExtractor();
//# sourceMappingURL=metadataExtractor.js.map