// Core Document Models
export * from './index';

// Evidence Management Models
export * from './evidence';

// Storage Models
export * from './storage';

// Workflow Models
export * from './workflow';

// Search Models
export * from './search';

// Re-export Prisma types for convenience
export {
  Document,
  DocumentVersion,
  DocumentTemplate,
  DocumentComment,
  DocumentShare,
  DocumentWorkflow,
  DocumentWorkflowStep,
  EvidenceItem,
  EvidenceChain,
  SearchIndex,
  User,
  Case,
  Client,
} from '@prisma/client';

// Type Guards
export const isDocument = (obj: unknown): obj is Document => {
  return typeof obj === 'object' && obj !== null && 'id' in obj && 'filename' in obj;
};

export const isEvidenceItem = (obj: unknown): obj is EvidenceItem => {
  return typeof obj === 'object' && obj !== null && 'id' in obj && 'title' in obj && 'caseId' in obj;
};

export const isDocumentWorkflow = (obj: unknown): obj is DocumentWorkflow => {
  return typeof obj === 'object' && obj !== null && 'id' in obj && 'documentId' in obj && 'status' in obj;
};

// Utility Types
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

// Constants
export const DOCUMENT_CATEGORIES = [
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
] as const;

export const DOCUMENT_STATUSES = [
  'DRAFT',
  'ACTIVE',
  'ARCHIVED',
  'DELETED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'PROCESSING'
] as const;

export const DOCUMENT_TYPES = [
  'LEGAL_DOCUMENT',
  'EVIDENCE',
  'CONTRACT',
  'CORRESPONDENCE',
  'COURT_FILING',
  'RESEARCH',
  'TEMPLATE',
  'OTHER'
] as const;

export const EVIDENCE_TYPES = [
  'PHYSICAL',
  'DIGITAL',
  'DOCUMENT',
  'PHOTO',
  'VIDEO',
  'AUDIO',
  'TESTIMONY',
  'EXPERT_REPORT'
] as const;

export const WORKFLOW_STATUSES = [
  'DRAFT',
  'IN_PROGRESS',
  'REVIEW',
  'APPROVED',
  'REJECTED',
  'COMPLETED'
] as const;

export const WORKFLOW_STEP_STATUSES = [
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'SKIPPED',
  'REJECTED'
] as const;

export const DOCUMENT_SHARE_PERMISSIONS = [
  'VIEW',
  'COMMENT',
  'EDIT',
  'DOWNLOAD'
] as const;

// Default configurations
export const DEFAULT_DOCUMENT_CONFIG = {
  maxFileSize: 100 * 1024 * 1024, // 100MB
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
    drafts: 30, // days
    temp: 7, // days
    versions: 365, // days
    deleted: 90 // days
  }
};

export const DEFAULT_SEARCH_CONFIG = {
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

export const DEFAULT_WORKFLOW_CONFIG = {
  autoAssign: true,
  sendNotifications: true,
  createTasks: true,
  defaultDueDateOffset: 3, // days
  maxSteps: 50,
  allowParallel: true,
  requireCompletion: true
};

// Validation schemas (for reference)
export const DOCUMENT_ID_REGEX = /^[a-zA-Z0-9_-]{8,32}$/;
export const FILENAME_REGEX = /^[a-zA-Z0-9._-]{1,255}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_REGEX = /^[\+]?[1-9][\d]{0,15}$/;

// Error codes
export const DOCUMENT_ERROR_CODES = {
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
} as const;

// Event types
export const DOCUMENT_EVENTS = {
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
} as const;