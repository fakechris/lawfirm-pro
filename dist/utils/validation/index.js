"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = exports.DocumentValidator = exports.searchSchema = exports.documentWorkflowSchema = exports.evidenceChainSchema = exports.evidenceItemSchema = exports.documentTemplateSchema = exports.documentVersionSchema = exports.documentUpdateSchema = exports.documentUploadSchema = void 0;
const zod_1 = require("zod");
const config_1 = require("../config");
exports.documentUploadSchema = zod_1.z.object({
    filename: zod_1.z.string().min(1, 'Filename is required'),
    originalName: zod_1.z.string().min(1, 'Original name is required'),
    size: zod_1.z.number().positive('File size must be positive'),
    mimeType: zod_1.z.string().min(1, 'MIME type is required'),
    caseId: zod_1.z.string().optional(),
    isConfidential: zod_1.z.boolean().default(false),
    isTemplate: zod_1.z.boolean().default(false),
    category: zod_1.z.enum([
        'CONTRACT',
        'COURT_FILING',
        'EVIDENCE',
        'CORRESPONDENCE',
        'INVOICE',
        'REPORT',
        'TEMPLATE',
        'LEGAL_BRIEF',
        'MOTION',
        'ORDER',
        'TRANSCRIPT',
        'PHOTOGRAPH',
        'VIDEO',
        'AUDIO',
        'OTHER'
    ]).optional(),
    description: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).default([]),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional()
});
exports.documentUpdateSchema = zod_1.z.object({
    filename: zod_1.z.string().min(1, 'Filename is required').optional(),
    originalName: zod_1.z.string().min(1, 'Original name is required').optional(),
    isConfidential: zod_1.z.boolean().optional(),
    isTemplate: zod_1.z.boolean().optional(),
    category: zod_1.z.enum([
        'CONTRACT',
        'COURT_FILING',
        'EVIDENCE',
        'CORRESPONDENCE',
        'INVOICE',
        'REPORT',
        'TEMPLATE',
        'LEGAL_BRIEF',
        'MOTION',
        'ORDER',
        'TRANSCRIPT',
        'PHOTOGRAPH',
        'VIDEO',
        'AUDIO',
        'OTHER'
    ]).optional(),
    status: zod_1.z.enum([
        'ACTIVE',
        'ARCHIVED',
        'DELETED',
        'PROCESSING',
        'PENDING_REVIEW',
        'APPROVED',
        'REJECTED'
    ]).optional(),
    description: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional()
});
exports.documentVersionSchema = zod_1.z.object({
    documentId: zod_1.z.string().min(1, 'Document ID is required'),
    filePath: zod_1.z.string().min(1, 'File path is required'),
    fileSize: zod_1.z.number().positive('File size must be positive'),
    checksum: zod_1.z.string().min(1, 'Checksum is required'),
    changeDescription: zod_1.z.string().optional()
});
exports.documentTemplateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Template name is required'),
    description: zod_1.z.string().optional(),
    category: zod_1.z.enum([
        'CONTRACT',
        'COURT_FILING',
        'LEGAL_BRIEF',
        'MOTION',
        'LETTER',
        'AGREEMENT',
        'FORM',
        'REPORT',
        'INVOICE',
        'OTHER'
    ]),
    variables: zod_1.z.record(zod_1.z.unknown()).optional(),
    isActive: zod_1.z.boolean().default(true)
});
exports.evidenceItemSchema = zod_1.z.object({
    caseId: zod_1.z.string().min(1, 'Case ID is required'),
    name: zod_1.z.string().min(1, 'Evidence name is required'),
    description: zod_1.z.string().optional(),
    filePath: zod_1.z.string().min(1, 'File path is required'),
    thumbnailPath: zod_1.z.string().optional(),
    fileSize: zod_1.z.number().positive('File size must be positive'),
    mimeType: zod_1.z.string().min(1, 'MIME type is required'),
    collectedBy: zod_1.z.string().min(1, 'Collected by is required'),
    location: zod_1.z.string().optional(),
    isProcessed: zod_1.z.boolean().default(false),
    extractedText: zod_1.z.string().optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
    status: zod_1.z.enum([
        'ACTIVE',
        'ARCHIVED',
        'DELETED',
        'PROCESSING',
        'ANALYZED',
        'REVIEWED',
        'ADMITTED',
        'EXCLUDED'
    ]).default('ACTIVE')
});
exports.evidenceChainSchema = zod_1.z.object({
    evidenceId: zod_1.z.string().min(1, 'Evidence ID is required'),
    action: zod_1.z.enum([
        'COLLECTED',
        'PROCESSED',
        'ANALYZED',
        'REVIEWED',
        'ADMITTED',
        'EXCLUDED',
        'ARCHIVED',
        'DESTROYED',
        'TRANSFERRED'
    ]),
    location: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    ipAddress: zod_1.z.string().optional()
});
exports.documentWorkflowSchema = zod_1.z.object({
    documentId: zod_1.z.string().min(1, 'Document ID is required'),
    workflowType: zod_1.z.enum([
        'APPROVAL',
        'REVIEW',
        'SIGNATURE',
        'FILING',
        'DISTRIBUTION',
        'ARCHIVAL',
        'OTHER'
    ])
});
exports.searchSchema = zod_1.z.object({
    query: zod_1.z.string().min(1, 'Search query is required'),
    category: zod_1.z.enum([
        'CONTRACT',
        'COURT_FILING',
        'EVIDENCE',
        'CORRESPONDENCE',
        'INVOICE',
        'REPORT',
        'TEMPLATE',
        'LEGAL_BRIEF',
        'MOTION',
        'ORDER',
        'TRANSCRIPT',
        'PHOTOGRAPH',
        'VIDEO',
        'AUDIO',
        'OTHER'
    ]).optional(),
    caseId: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    status: zod_1.z.enum([
        'ACTIVE',
        'ARCHIVED',
        'DELETED',
        'PROCESSING',
        'PENDING_REVIEW',
        'APPROVED',
        'REJECTED'
    ]).optional(),
    mimeType: zod_1.z.string().optional(),
    fromDate: zod_1.z.date().optional(),
    toDate: zod_1.z.date().optional(),
    limit: zod_1.z.number().min(1).max(100).default(20),
    offset: zod_1.z.number().min(0).default(0)
});
class DocumentValidator {
    static validateMimeType(mimeType) {
        return config_1.config.storage.allowedMimeTypes.includes(mimeType);
    }
    static validateFileSize(size) {
        return size <= config_1.config.storage.maxFileSize;
    }
    static validateFileExtension(filename) {
        const allowedExtensions = [
            '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
            '.jpg', '.jpeg', '.png', '.tiff', '.mp3', '.wav', '.mp4', '.avi',
            '.txt', '.csv'
        ];
        const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
        return allowedExtensions.includes(ext);
    }
    static sanitizeFilename(filename) {
        return filename
            .replace(/[^\w\s.-]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 255);
    }
    static validateSearchQuery(query) {
        return query.length >= 2 && query.length <= 1000;
    }
    static validateTag(tag) {
        return tag.length >= 1 && tag.length <= 50 && /^[a-zA-Z0-9_\-\s]+$/.test(tag);
    }
    static validateTags(tags) {
        return tags.every(tag => this.validateTag(tag)) && tags.length <= 20;
    }
}
exports.DocumentValidator = DocumentValidator;
const validateRequest = (schema) => {
    return (req, res, next) => {
        try {
            schema.parse(req.body);
            next();
        }
        catch (error) {
            res.status(400).json({ error: 'Validation failed', details: error });
        }
    };
};
exports.validateRequest = validateRequest;
//# sourceMappingURL=index.js.map