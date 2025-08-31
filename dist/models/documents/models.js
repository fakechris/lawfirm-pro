"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOCUMENT_EVENTS = exports.DOCUMENT_ERROR_CODES = exports.PHONE_REGEX = exports.EMAIL_REGEX = exports.FILENAME_REGEX = exports.DOCUMENT_ID_REGEX = exports.DEFAULT_WORKFLOW_CONFIG = exports.DEFAULT_SEARCH_CONFIG = exports.DEFAULT_DOCUMENT_CONFIG = exports.DOCUMENT_SHARE_PERMISSIONS = exports.WORKFLOW_STEP_STATUSES = exports.WORKFLOW_STATUSES = exports.EVIDENCE_TYPES = exports.DOCUMENT_TYPES = exports.DOCUMENT_STATUSES = exports.DOCUMENT_CATEGORIES = exports.isDocumentWorkflow = exports.isEvidenceItem = exports.isDocument = exports.SearchIndex = exports.EvidenceChain = exports.EvidenceItem = exports.DocumentWorkflowStep = exports.DocumentWorkflow = exports.DocumentShare = exports.DocumentComment = exports.DocumentTemplate = void 0;
__exportStar(require("./index"), exports);
__exportStar(require("./evidence"), exports);
__exportStar(require("./storage"), exports);
__exportStar(require("./workflow"), exports);
__exportStar(require("./search"), exports);
var client_1 = require("@prisma/client");
Object.defineProperty(exports, "DocumentTemplate", { enumerable: true, get: function () { return client_1.DocumentTemplate; } });
Object.defineProperty(exports, "DocumentComment", { enumerable: true, get: function () { return client_1.DocumentComment; } });
Object.defineProperty(exports, "DocumentShare", { enumerable: true, get: function () { return client_1.DocumentShare; } });
Object.defineProperty(exports, "DocumentWorkflow", { enumerable: true, get: function () { return client_1.DocumentWorkflow; } });
Object.defineProperty(exports, "DocumentWorkflowStep", { enumerable: true, get: function () { return client_1.DocumentWorkflowStep; } });
Object.defineProperty(exports, "EvidenceItem", { enumerable: true, get: function () { return client_1.EvidenceItem; } });
Object.defineProperty(exports, "EvidenceChain", { enumerable: true, get: function () { return client_1.EvidenceChain; } });
Object.defineProperty(exports, "SearchIndex", { enumerable: true, get: function () { return client_1.SearchIndex; } });
const isDocument = (obj) => {
    return typeof obj === 'object' && obj !== null && 'id' in obj && 'filename' in obj;
};
exports.isDocument = isDocument;
const isEvidenceItem = (obj) => {
    return typeof obj === 'object' && obj !== null && 'id' in obj && 'title' in obj && 'caseId' in obj;
};
exports.isEvidenceItem = isEvidenceItem;
const isDocumentWorkflow = (obj) => {
    return typeof obj === 'object' && obj !== null && 'id' in obj && 'documentId' in obj && 'status' in obj;
};
exports.isDocumentWorkflow = isDocumentWorkflow;
exports.DOCUMENT_CATEGORIES = [
    'LEGAL_BRIEF',
    'CONTRACT',
    'EVIDENCE',
    'CORRESPONDENCE',
    'COURT_FILING',
    'RESEARCH',
    'FINANCIAL',
    'MEDICAL',
    'INVOICE',
    'REPORT',
    'TEMPLATE',
    'MOTION',
    'ORDER',
    'TRANSCRIPT',
    'PHOTOGRAPH',
    'VIDEO',
    'AUDIO',
    'OTHER'
];
exports.DOCUMENT_STATUSES = [
    'DRAFT',
    'ACTIVE',
    'ARCHIVED',
    'DELETED',
    'UNDER_REVIEW',
    'APPROVED',
    'REJECTED',
    'PROCESSING'
];
exports.DOCUMENT_TYPES = [
    'LEGAL_DOCUMENT',
    'EVIDENCE',
    'CONTRACT',
    'CORRESPONDENCE',
    'COURT_FILING',
    'RESEARCH',
    'TEMPLATE',
    'OTHER'
];
exports.EVIDENCE_TYPES = [
    'PHYSICAL',
    'DIGITAL',
    'DOCUMENT',
    'PHOTO',
    'VIDEO',
    'AUDIO',
    'TESTIMONY',
    'EXPERT_REPORT'
];
exports.WORKFLOW_STATUSES = [
    'DRAFT',
    'IN_PROGRESS',
    'REVIEW',
    'APPROVED',
    'REJECTED',
    'COMPLETED'
];
exports.WORKFLOW_STEP_STATUSES = [
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'SKIPPED',
    'REJECTED'
];
exports.DOCUMENT_SHARE_PERMISSIONS = [
    'VIEW',
    'COMMENT',
    'EDIT',
    'DOWNLOAD'
];
exports.DEFAULT_DOCUMENT_CONFIG = {
    maxFileSize: 100 * 1024 * 1024,
    allowedMimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'image/jpeg',
        'image/png',
        'image/tiff',
        'audio/mpeg',
        'video/mp4',
        'application/zip'
    ],
    allowedExtensions: [
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.txt', '.jpg', '.jpeg', '.png', '.tiff', '.mp3', '.wav', '.mp4', '.avi', '.zip'
    ],
    thumbnailSizes: {
        small: { width: 150, height: 150 },
        medium: { width: 300, height: 300 },
        large: { width: 600, height: 600 }
    },
    retention: {
        drafts: 30,
        temp: 7,
        versions: 365,
        deleted: 90
    }
};
exports.DEFAULT_SEARCH_CONFIG = {
    maxResults: 100,
    defaultLimit: 20,
    minQueryLength: 2,
    fuzzySearch: true,
    highlightResults: true,
    searchInContent: true,
    searchInMetadata: true,
    boost: {
        title: 3,
        content: 1,
        metadata: 2,
        tags: 2
    }
};
exports.DEFAULT_WORKFLOW_CONFIG = {
    autoAssign: true,
    sendNotifications: true,
    createTasks: true,
    defaultDueDateOffset: 3,
    maxSteps: 50,
    allowParallel: true,
    requireCompletion: true
};
exports.DOCUMENT_ID_REGEX = /^[a-zA-Z0-9_-]{8,32}$/;
exports.FILENAME_REGEX = /^[a-zA-Z0-9._-]{1,255}$/;
exports.EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
exports.PHONE_REGEX = /^[\+]?[1-9][\d]{0,15}$/;
exports.DOCUMENT_ERROR_CODES = {
    FILE_TOO_LARGE: 'FILE_TOO_LARGE',
    INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
    FILE_NOT_FOUND: 'FILE_NOT_FOUND',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    DUPLICATE_FILE: 'DUPLICATE_FILE',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    STORAGE_ERROR: 'STORAGE_ERROR',
    PROCESSING_ERROR: 'PROCESSING_ERROR',
    QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
    WORKFLOW_ERROR: 'WORKFLOW_ERROR',
    SEARCH_ERROR: 'SEARCH_ERROR'
};
exports.DOCUMENT_EVENTS = {
    CREATED: 'document.created',
    UPDATED: 'document.updated',
    DELETED: 'document.deleted',
    UPLOADED: 'document.uploaded',
    DOWNLOADED: 'document.downloaded',
    SHARED: 'document.shared',
    APPROVED: 'document.approved',
    REJECTED: 'document.rejected',
    VERSION_CREATED: 'document.version.created',
    COMMENT_ADDED: 'document.comment.added',
    WORKFLOW_STARTED: 'document.workflow.started',
    WORKFLOW_COMPLETED: 'document.workflow.completed',
    SEARCH_PERFORMED: 'document.search.performed'
};
//# sourceMappingURL=models.js.map