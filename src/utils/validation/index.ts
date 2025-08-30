import { z } from 'zod';
import { config } from '../config';

export const documentUploadSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  originalName: z.string().min(1, 'Original name is required'),
  size: z.number().positive('File size must be positive'),
  mimeType: z.string().min(1, 'MIME type is required'),
  caseId: z.string().optional(),
  isConfidential: z.boolean().default(false),
  isTemplate: z.boolean().default(false),
  category: z.enum([
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
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).optional()
});

export const documentUpdateSchema = z.object({
  filename: z.string().min(1, 'Filename is required').optional(),
  originalName: z.string().min(1, 'Original name is required').optional(),
  isConfidential: z.boolean().optional(),
  isTemplate: z.boolean().optional(),
  category: z.enum([
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
  status: z.enum([
    'ACTIVE',
    'ARCHIVED',
    'DELETED',
    'PROCESSING',
    'PENDING_REVIEW',
    'APPROVED',
    'REJECTED'
  ]).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const documentVersionSchema = z.object({
  documentId: z.string().min(1, 'Document ID is required'),
  filePath: z.string().min(1, 'File path is required'),
  fileSize: z.number().positive('File size must be positive'),
  checksum: z.string().min(1, 'Checksum is required'),
  changeDescription: z.string().optional()
});

export const documentTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  category: z.enum([
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
  variables: z.record(z.unknown()).optional(),
  isActive: z.boolean().default(true)
});

export const evidenceItemSchema = z.object({
  caseId: z.string().min(1, 'Case ID is required'),
  name: z.string().min(1, 'Evidence name is required'),
  description: z.string().optional(),
  filePath: z.string().min(1, 'File path is required'),
  thumbnailPath: z.string().optional(),
  fileSize: z.number().positive('File size must be positive'),
  mimeType: z.string().min(1, 'MIME type is required'),
  collectedBy: z.string().min(1, 'Collected by is required'),
  location: z.string().optional(),
  isProcessed: z.boolean().default(false),
  extractedText: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  status: z.enum([
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

export const evidenceChainSchema = z.object({
  evidenceId: z.string().min(1, 'Evidence ID is required'),
  action: z.enum([
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
  location: z.string().optional(),
  notes: z.string().optional(),
  ipAddress: z.string().optional()
});

export const documentWorkflowSchema = z.object({
  documentId: z.string().min(1, 'Document ID is required'),
  workflowType: z.enum([
    'APPROVAL',
    'REVIEW',
    'SIGNATURE',
    'FILING',
    'DISTRIBUTION',
    'ARCHIVAL',
    'OTHER'
  ])
});

export const searchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  category: z.enum([
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
  caseId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum([
    'ACTIVE',
    'ARCHIVED',
    'DELETED',
    'PROCESSING',
    'PENDING_REVIEW',
    'APPROVED',
    'REJECTED'
  ]).optional(),
  mimeType: z.string().optional(),
  fromDate: z.date().optional(),
  toDate: z.date().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0)
});

export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
export type DocumentUpdateInput = z.infer<typeof documentUpdateSchema>;
export type DocumentVersionInput = z.infer<typeof documentVersionSchema>;
export type DocumentTemplateInput = z.infer<typeof documentTemplateSchema>;
export type EvidenceItemInput = z.infer<typeof evidenceItemSchema>;
export type EvidenceChainInput = z.infer<typeof evidenceChainSchema>;
export type DocumentWorkflowInput = z.infer<typeof documentWorkflowSchema>;
export type SearchInput = z.infer<typeof searchSchema>;

export class DocumentValidator {
  static validateMimeType(mimeType: string): boolean {
    return config.storage.allowedMimeTypes.includes(mimeType);
  }

  static validateFileSize(size: number): boolean {
    return size <= config.storage.maxFileSize;
  }

  static validateFileExtension(filename: string): boolean {
    const allowedExtensions = [
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.jpg', '.jpeg', '.png', '.tiff', '.mp3', '.wav', '.mp4', '.avi',
      '.txt', '.csv'
    ];
    
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return allowedExtensions.includes(ext);
  }

  static sanitizeFilename(filename: string): string {
    // Remove potentially dangerous characters
    return filename
      .replace(/[^\w\s.-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 255);
  }

  static validateSearchQuery(query: string): boolean {
    return query.length >= 2 && query.length <= 1000;
  }

  static validateTag(tag: string): boolean {
    return tag.length >= 1 && tag.length <= 50 && /^[a-zA-Z0-9_\-\s]+$/.test(tag);
  }

  static validateTags(tags: string[]): boolean {
    return tags.every(tag => this.validateTag(tag)) && tags.length <= 20;
  }
}