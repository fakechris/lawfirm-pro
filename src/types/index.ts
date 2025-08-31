import { 
  Document, 
  DocumentVersion, 
  DocumentTemplate, 
  EvidenceItem, 
  EvidenceChain, 
  DocumentWorkflow,
  DocumentWorkflowStep,
  SearchIndex,
  User,
  Case
} from '@prisma/client';

export type DocumentWithDetails = Document & {
  versions?: DocumentVersion[];
  case?: Case;
  uploadedByUser?: User;
  _count?: {
    versions: number;
  };
};

export type DocumentTemplateWithDetails = DocumentTemplate & {
  versions?: DocumentTemplateVersion[];
  createdByUser?: User;
  _count?: {
    versions: number;
    generatedDocuments: number;
  };
};

export type EvidenceItemWithDetails = EvidenceItem & {
  chainOfCustody?: EvidenceChain[];
  tags?: EvidenceTag[];
  relationships?: EvidenceRelationship[];
  case?: Case;
  collectedByUser?: User;
  document?: Document;
};

export type DocumentWorkflowWithDetails = DocumentWorkflow & {
  steps?: DocumentWorkflowStep[];
  document?: Document;
  createdByUser?: User;
};

export type SearchResult = {
  id: string;
  type: 'document' | 'evidence';
  title: string;
  excerpt: string;
  score: number;
  metadata: {
    category?: string;
    mimeType?: string;
    caseId?: string;
    tags?: string[];
    createdAt: Date;
  };
};

export type DocumentProcessingResult = {
  success: boolean;
  filePath: string;
  filename: string;
  size: number;
  mimeType: string;
  checksum: string;
  extractedText?: string;
  thumbnailPath?: string;
  error?: string;
};

export type VersionComparisonResult = {
  version1: DocumentVersion;
  version2: DocumentVersion;
  differences: {
    added: string[];
    removed: string[];
    modified: string[];
  };
  summary: string;
};

export type TemplateVariable = {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'select';
  description?: string;
  required: boolean;
  defaultValue?: string | number | boolean;
  options?: string[]; // For select type
};

export type TemplateGenerationInput = {
  templateId: string;
  variables: Record<string, unknown>;
  outputFilename?: string;
  caseId?: string;
};

export type TemplateGenerationResult = {
  success: boolean;
  documentId?: string;
  filePath?: string;
  filename?: string;
  error?: string;
};

export type DocumentSearchParams = {
  query: string;
  category?: string;
  caseId?: string;
  tags?: string[];
  status?: string;
  mimeType?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
};

export type EvidenceSearchParams = {
  query: string;
  caseId?: string;
  tags?: string[];
  status?: string;
  mimeType?: string;
  location?: string;
  collectedBy?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
};

export type WorkflowStepInput = {
  stepName: string;
  description?: string;
  assignedTo?: string;
  dueDate?: Date;
  order: number;
};

export type WorkflowStepUpdate = {
  status?: string;
  action?: string;
  notes?: string;
  completedAt?: Date;
};

export type DocumentStats = {
  totalDocuments: number;
  totalSize: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  byMimeType: Record<string, number>;
  recentUploads: number; // Last 7 days
};

export type EvidenceStats = {
  totalItems: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  recentCollections: number; // Last 7 days
  chainOfCustodyIntact: number; // Percentage
};

export type StorageUsage = {
  totalUsed: number;
  totalAvailable: number;
  byCategory: Record<string, {
    used: number;
    fileCount: number;
  }>;
};

export type BackupConfig = {
  enabled: boolean;
  schedule: string; // cron expression
  retentionDays: number;
  destination: string;
  compression: boolean;
  includeVersions: boolean;
};

export type AuditLogOptions = {
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
};

// Extended Prisma types for better TypeScript support
declare module '@prisma/client' {
  export interface PrismaClient {
    document: {
      findManyWithDetails: (args?: any) => Promise<DocumentWithDetails[]>;
      findUniqueWithDetails: (args: { where: { id: string } }) => Promise<DocumentWithDetails | null>;
    };
    
    evidenceItem: {
      findManyWithDetails: (args?: any) => Promise<EvidenceItemWithDetails[]>;
      findUniqueWithDetails: (args: { where: { id: string } }) => Promise<EvidenceItemWithDetails | null>;
    };
    
    searchIndex: {
      searchDocuments: (params: DocumentSearchParams) => Promise<SearchResult[]>;
      searchEvidence: (params: EvidenceSearchParams) => Promise<SearchResult[]>;
    };
  }
}