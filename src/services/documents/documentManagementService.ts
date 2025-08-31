import { PrismaClient } from '@prisma/client';
import { 
  Document, 
  DocumentVersion,
  DocumentTemplate,
  EvidenceItem,
  EvidenceRelationship,
  TemplateVariable,
  TemplateVersion,
  DocumentWorkflow,
  DocumentWorkflowStep,
  DocumentApproval,
  DocumentComment,
  DocumentShare,
  User,
  Case
} from '@prisma/client';

import { DocumentStorageService, FileUploadOptions, FileStorageResult } from '../services/documents/storage';
import { VersionControlStorageService, VersionedFileUploadOptions, VersionedFileStorageResult } from '../services/documents/versionStorage';
import { EvidenceStorageService, EvidenceUploadOptions, EvidenceStorageResult } from '../services/documents/evidenceStorage';
import { BackupService, BackupConfig, BackupResult } from '../services/documents/backupService';
import { StorageOptimizationService, OptimizationOptions, OptimizationResult } from '../services/documents/optimizationService';

export interface DocumentManagementConfig {
  storage: {
    basePath: string;
    maxFileSize: number;
    allowedMimeTypes: string[];
    allowedExtensions: string[];
  };
  versioning: {
    enabled: boolean;
    maxVersions: number;
    autoCleanup: boolean;
    retentionDays: number;
  };
  backup: {
    enabled: boolean;
    schedule: string;
    compression: boolean;
    encryption: boolean;
    retentionDays: number;
  };
  optimization: {
    enabled: boolean;
    schedule: string;
    cleanupTempFiles: boolean;
    cleanupOldVersions: boolean;
    cleanupDuplicates: boolean;
    compressLargeFiles: boolean;
  };
  security: {
    encryptionEnabled: boolean;
    virusScanEnabled: boolean;
    checksumValidation: boolean;
  };
}

export interface DocumentUploadRequest {
  file: Buffer;
  filename: string;
  mimeType: string;
  caseId?: string;
  clientId?: string;
  category?: string;
  description?: string;
  tags?: string[];
  isConfidential?: boolean;
  uploadedBy: string;
  generateThumbnail?: boolean;
  validateChecksum?: boolean;
}

export interface DocumentCreateResult {
  success: boolean;
  document?: Document;
  error?: string;
  warnings?: string[];
  storageResult?: FileStorageResult;
}

export interface DocumentVersionRequest {
  documentId: string;
  file: Buffer;
  filename: string;
  mimeType: string;
  changeDescription?: string;
  createdBy: string;
  generateChecksum?: boolean;
}

export interface TemplateCreateRequest {
  name: string;
  description?: string;
  category?: string;
  file: Buffer;
  filename: string;
  mimeType: string;
  variables?: Array<{
    name: string;
    type: string;
    description?: string;
    defaultValue?: string;
    required: boolean;
  }>;
  isPublic?: boolean;
  createdBy: string;
}

export interface EvidenceCreateRequest {
  title: string;
  description?: string;
  type: string;
  caseId: string;
  file: Buffer;
  filename: string;
  mimeType: string;
  collectedBy: string;
  location?: string;
  tags?: string[];
  generateChecksum?: boolean;
}

export interface DocumentSearchRequest {
  query?: string;
  caseId?: string;
  clientId?: string;
  category?: string;
  tags?: string[];
  uploadedBy?: string;
  dateFrom?: Date;
  dateTo?: Date;
  isConfidential?: boolean;
  limit?: number;
  offset?: number;
}

export interface DocumentListResult {
  data: Document[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  filters: Record<string, unknown>;
}

export class DocumentManagementService {
  private prisma: PrismaClient;
  private storageService: DocumentStorageService;
  private versionService: VersionControlStorageService;
  private evidenceService: EvidenceStorageService;
  private backupService: BackupService;
  private optimizationService: StorageOptimizationService;
  private config: DocumentManagementConfig;

  constructor(config?: Partial<DocumentManagementConfig>) {
    this.prisma = new PrismaClient();
    this.storageService = new DocumentStorageService();
    this.versionService = new VersionControlStorageService();
    this.evidenceService = new EvidenceStorageService();
    this.backupService = new BackupService();
    this.optimizationService = new StorageOptimizationService();
    
    this.config = {
      storage: {
        basePath: config?.storage?.basePath || './storage',
        maxFileSize: config?.storage?.maxFileSize || 100 * 1024 * 1024, // 100MB
        allowedMimeTypes: config?.storage?.allowedMimeTypes || [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg',
          'image/png'
        ],
        allowedExtensions: config?.storage?.allowedExtensions || ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']
      },
      versioning: {
        enabled: config?.versioning?.enabled ?? true,
        maxVersions: config?.versioning?.maxVersions || 50,
        autoCleanup: config?.versioning?.autoCleanup ?? true,
        retentionDays: config?.versioning?.retentionDays || 90
      },
      backup: {
        enabled: config?.backup?.enabled ?? true,
        schedule: config?.backup?.schedule || '0 2 * * *', // Daily at 2 AM
        compression: config?.backup?.compression ?? true,
        encryption: config?.backup?.encryption ?? false,
        retentionDays: config?.backup?.retentionDays || 30
      },
      optimization: {
        enabled: config?.optimization?.enabled ?? true,
        schedule: config?.optimization?.schedule || '0 3 * * 0', // Weekly at 3 AM on Sunday
        cleanupTempFiles: config?.optimization?.cleanupTempFiles ?? true,
        cleanupOldVersions: config?.optimization?.cleanupOldVersions ?? true,
        cleanupDuplicates: config?.optimization?.cleanupDuplicates ?? true,
        compressLargeFiles: config?.optimization?.compressLargeFiles ?? true
      },
      security: {
        encryptionEnabled: config?.security?.encryptionEnabled ?? false,
        virusScanEnabled: config?.security?.virusScanEnabled ?? false,
        checksumValidation: config?.security?.checksumValidation ?? true
      }
    };

    this.initializeServices();
  }

  private async initializeServices(): Promise<void> {
    // Initialize backup schedules if enabled
    if (this.config.backup.enabled) {
      await this.setupBackupSchedule();
    }

    // Initialize optimization schedule if enabled
    if (this.config.optimization.enabled) {
      await this.setupOptimizationSchedule();
    }
  }

  private async setupBackupSchedule(): Promise<void> {
    try {
      const backupConfig: BackupConfig = {
        enabled: true,
        schedule: this.config.backup.schedule,
        compression: this.config.backup.compression,
        encryption: this.config.backup.encryption,
        includeVersions: true,
        includeThumbnails: true,
        retention: this.config.backup.retentionDays,
        destination: {
          type: 'local',
          path: './storage/backups'
        },
        notifications: {
          onSuccess: false,
          onFailure: true
        }
      };

      await this.backupService.createBackupSchedule('Daily Document Backup', backupConfig);
    } catch (error) {
      console.error('Error setting up backup schedule:', error);
    }
  }

  private async setupOptimizationSchedule(): Promise<void> {
    try {
      const optimizationOptions: OptimizationOptions = {
        cleanupTempFiles: this.config.optimization.cleanupTempFiles,
        cleanupOldVersions: this.config.optimization.cleanupOldVersions,
        cleanupDuplicates: this.config.optimization.cleanupDuplicates,
        compressLargeFiles: this.config.optimization.compressLargeFiles,
        maxAge: {
          tempFiles: 24,
          versions: this.config.versioning.retentionDays
        }
      };

      await this.optimizationService.scheduleOptimization(this.config.optimization.schedule, optimizationOptions);
    } catch (error) {
      console.error('Error setting up optimization schedule:', error);
    }
  }

  // Document Management
  async uploadDocument(request: DocumentUploadRequest): Promise<DocumentCreateResult> {
    try {
      // Validate file
      if (!request.file || request.file.length === 0) {
        return {
          success: false,
          error: 'No file provided'
        };
      }

      if (request.file.length > this.config.storage.maxFileSize) {
        return {
          success: false,
          error: `File size exceeds maximum limit of ${this.config.storage.maxFileSize} bytes`
        };
      }

      // Check MIME type
      if (!this.config.storage.allowedMimeTypes.includes(request.mimeType)) {
        return {
          success: false,
          error: `File type ${request.mimeType} is not allowed`
        };
      }

      // Store file
      const storageOptions: FileUploadOptions = {
        filename: request.filename,
        mimeType: request.mimeType,
        category: 'documents',
        subcategory: 'original',
        generateChecksum: this.config.security.checksumValidation,
        generateThumbnail: request.generateThumbnail,
        metadata: {
          caseId: request.caseId,
          clientId: request.clientId,
          category: request.category,
          description: request.description,
          tags: request.tags,
          isConfidential: request.isConfidential,
          uploadedBy: request.uploadedBy
        }
      };

      const storageResult = await this.storageService.uploadFile(request.file, request.filename, storageOptions);

      if (!storageResult.success) {
        return {
          success: false,
          error: storageResult.error || 'Failed to store file'
        };
      }

      // Create database record
      const document = await this.prisma.document.create({
        data: {
          filename: storageResult.filename,
          originalName: request.filename,
          path: storageResult.filePath,
          size: request.file.length,
          mimeType: request.mimeType,
          caseId: request.caseId,
          clientId: request.clientId,
          uploadedById: request.uploadedBy,
          category: request.category,
          description: request.description,
          tags: request.tags || [],
          isConfidential: request.isConfidential || false,
          checksum: storageResult.checksum,
          thumbnailPath: storageResult.thumbnailPath,
          metadata: storageResult.metadata || {},
          status: 'ACTIVE'
        }
      });

      return {
        success: true,
        document,
        storageResult,
        warnings: storageResult.warnings
      };

    } catch (error) {
      console.error('Error uploading document:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getDocument(id: string): Promise<Document | null> {
    try {
      return await this.prisma.document.findUnique({
        where: { id },
        include: {
          case: true,
          client: true,
          uploadedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
            include: {
              createdByUser: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Error getting document:', error);
      return null;
    }
  }

  async searchDocuments(request: DocumentSearchRequest): Promise<DocumentListResult> {
    try {
      const {
        query,
        caseId,
        clientId,
        category,
        tags,
        uploadedBy,
        dateFrom,
        dateTo,
        isConfidential,
        limit = 20,
        offset = 0
      } = request;

      const where: any = { status: { not: 'DELETED' } };

      if (query) {
        where.OR = [
          { originalName: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { extractedText: { contains: query, mode: 'insensitive' } }
        ];
      }

      if (caseId) where.caseId = caseId;
      if (clientId) where.clientId = clientId;
      if (category) where.category = category;
      if (uploadedBy) where.uploadedById = uploadedBy;
      if (isConfidential !== undefined) where.isConfidential = isConfidential;
      if (tags && tags.length > 0) {
        where.tags = { hasSome: tags };
      }

      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt.gte = dateFrom;
        if (dateTo) where.createdAt.lte = dateTo;
      }

      const [data, total] = await Promise.all([
        this.prisma.document.findMany({
          where,
          include: {
            case: true,
            client: true,
            uploadedByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset
        }),
        this.prisma.document.count({ where })
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data,
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
        totalPages,
        filters: { query, caseId, clientId, category, tags, uploadedBy, dateFrom, dateTo, isConfidential }
      };

    } catch (error) {
      console.error('Error searching documents:', error);
      return {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        filters: {}
      };
    }
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | null> {
    try {
      return await this.prisma.document.update({
        where: { id },
        data: {
          ...updates,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error updating document:', error);
      return null;
    }
  }

  async deleteDocument(id: string, permanent: boolean = false): Promise<boolean> {
    try {
      if (permanent) {
        const document = await this.prisma.document.findUnique({ where: { id } });
        if (document?.path) {
          await this.storageService.deleteFile(document.path, true);
        }
        await this.prisma.document.delete({ where: { id } });
      } else {
        await this.prisma.document.update({
          where: { id },
          data: { 
            status: 'DELETED',
            deletedAt: new Date()
          }
        });
      }
      return true;
    } catch (error) {
      console.error('Error deleting document:', error);
      return false;
    }
  }

  // Version Management
  async createDocumentVersion(request: DocumentVersionRequest): Promise<DocumentVersion | null> {
    try {
      if (!this.config.versioning.enabled) {
        throw new Error('Versioning is not enabled');
      }

      const document = await this.prisma.document.findUnique({
        where: { id: request.documentId }
      });

      if (!document) {
        throw new Error('Document not found');
      }

      // Store version file
      const versionOptions: VersionedFileUploadOptions = {
        filename: request.filename,
        mimeType: request.mimeType,
        category: 'versions',
        versionNumber: document.version + 1,
        changeDescription: request.changeDescription,
        generateChecksum: this.config.security.checksumValidation,
        metadata: {
          documentId: request.documentId,
          createdBy: request.createdBy
        }
      };

      const versionResult = await this.versionService.uploadVersion(
        request.file,
        request.filename,
        versionOptions
      );

      if (!versionResult.success) {
        throw new Error(versionResult.error || 'Failed to store version');
      }

      // Create version record
      const version = await this.prisma.documentVersion.create({
        data: {
          documentId: request.documentId,
          versionNumber: versionResult.versionNumber,
          filePath: versionResult.filePath,
          fileSize: request.file.length,
          checksum: versionResult.checksum,
          changeDescription: request.changeDescription,
          createdBy: request.createdBy
        }
      });

      // Update document
      await this.prisma.document.update({
        where: { id: request.documentId },
        data: {
          version: versionResult.versionNumber,
          updatedAt: new Date()
        }
      });

      // Auto-cleanup old versions if enabled
      if (this.config.versioning.autoCleanup) {
        await this.cleanupOldVersions(request.documentId);
      }

      return version;

    } catch (error) {
      console.error('Error creating document version:', error);
      return null;
    }
  }

  private async cleanupOldVersions(documentId: string): Promise<void> {
    try {
      const versions = await this.prisma.documentVersion.findMany({
        where: { documentId },
        orderBy: { versionNumber: 'desc' }
      });

      if (versions.length > this.config.versioning.maxVersions) {
        const versionsToDelete = versions.slice(this.config.versioning.maxVersions);
        
        for (const version of versionsToDelete) {
          await this.prisma.documentVersion.delete({
            where: { id: version.id }
          });
          
          if (version.filePath) {
            await this.storageService.deleteFile(version.filePath);
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up old versions:', error);
    }
  }

  // Template Management
  async createTemplate(request: TemplateCreateRequest): Promise<DocumentTemplate | null> {
    try {
      // Store template file
      const storageResult = await this.storageService.uploadFile(
        request.file,
        request.filename,
        {
          filename: request.filename,
          mimeType: request.mimeType,
          category: 'templates',
          subcategory: 'active',
          generateChecksum: this.config.security.checksumValidation,
          metadata: {
            name: request.name,
            description: request.description,
            category: request.category,
            variables: request.variables,
            isPublic: request.isPublic,
            createdBy: request.createdBy
          }
        }
      );

      if (!storageResult.success) {
        throw new Error(storageResult.error || 'Failed to store template');
      }

      // Create template record
      const template = await this.prisma.documentTemplate.create({
        data: {
          name: request.name,
          description: request.description,
          category: request.category,
          filePath: storageResult.filePath,
          fileSize: request.file.length,
          mimeType: request.mimeType,
          checksum: storageResult.checksum,
          variableSchema: request.variables || [],
          isPublic: request.isPublic || false,
          createdBy: request.createdBy
        }
      });

      // Create template variables
      if (request.variables && request.variables.length > 0) {
        await this.prisma.templateVariable.createMany({
          data: request.variables.map((variable, index) => ({
            templateId: template.id,
            name: variable.name,
            type: variable.type,
            description: variable.description,
            defaultValue: variable.defaultValue,
            required: variable.required,
            order: index
          }))
        });
      }

      return template;

    } catch (error) {
      console.error('Error creating template:', error);
      return null;
    }
  }

  // Evidence Management
  async createEvidence(request: EvidenceCreateRequest): Promise<EvidenceItem | null> {
    try {
      // Store evidence file
      const evidenceOptions: EvidenceUploadOptions = {
        title: request.title,
        description: request.description,
        type: request.type as any,
        caseId: request.caseId,
        collectedBy: request.collectedBy,
        generateChecksum: this.config.security.checksumValidation,
        metadata: {
          originalFilename: request.filename,
          tags: request.tags
        }
      };

      const evidenceResult = await this.evidenceService.uploadEvidence(
        request.file,
        request.filename,
        evidenceOptions
      );

      if (!evidenceResult.success) {
        throw new Error(evidenceResult.error || 'Failed to store evidence');
      }

      // Create evidence record
      const evidence = await this.prisma.evidenceItem.create({
        data: {
          title: request.title,
          description: request.description,
          caseId: request.caseId,
          type: request.type as any,
          filePath: evidenceResult.filePath,
          fileSize: request.file.length,
          mimeType: request.mimeType,
          checksum: evidenceResult.checksum,
          collectedBy: request.collectedBy,
          tags: request.tags || [],
          metadata: evidenceResult.metadata || {}
        }
      });

      return evidence;

    } catch (error) {
      console.error('Error creating evidence:', error);
      return null;
    }
  }

  // Backup and Restore
  async performBackup(config?: Partial<BackupConfig>): Promise<BackupResult> {
    try {
      const backupConfig: BackupConfig = {
        enabled: true,
        schedule: '0 2 * * *',
        compression: true,
        encryption: false,
        includeVersions: true,
        includeThumbnails: true,
        retention: 30,
        destination: {
          type: 'local',
          path: './storage/backups'
        },
        notifications: {
          onSuccess: false,
          onFailure: true
        },
        ...config
      };

      return await this.backupService.performBackup(backupConfig);
    } catch (error) {
      console.error('Error performing backup:', error);
      throw error;
    }
  }

  async restoreFromBackup(backupId: string, options?: {
    overwrite?: boolean;
    validateIntegrity?: boolean;
    dryRun?: boolean;
  }): Promise<any> {
    try {
      return await this.backupService.restoreFromBackup(backupId, options);
    } catch (error) {
      console.error('Error restoring from backup:', error);
      throw error;
    }
  }

  // Optimization
  async performOptimization(options?: OptimizationOptions): Promise<OptimizationResult> {
    try {
      const optimizationOptions: OptimizationOptions = {
        cleanupTempFiles: this.config.optimization.cleanupTempFiles,
        cleanupOldVersions: this.config.optimization.cleanupOldVersions,
        cleanupDuplicates: this.config.optimization.cleanupDuplicates,
        compressLargeFiles: this.config.optimization.compressLargeFiles,
        maxAge: {
          tempFiles: 24,
          versions: this.config.versioning.retentionDays
        },
        ...options
      };

      return await this.optimizationService.performOptimization(optimizationOptions);
    } catch (error) {
      console.error('Error performing optimization:', error);
      throw error;
    }
  }

  // Utility Methods
  async getStorageMetrics() {
    try {
      return await this.optimizationService.getStorageMetrics();
    } catch (error) {
      console.error('Error getting storage metrics:', error);
      throw error;
    }
  }

  async getBackupInfo(backupId: string) {
    try {
      return await this.backupService.getBackupInfo(backupId);
    } catch (error) {
      console.error('Error getting backup info:', error);
      throw error;
    }
  }

  async verifyEvidenceIntegrity(evidenceId: string) {
    try {
      return await this.evidenceService.verifyEvidenceIntegrity(evidenceId);
    } catch (error) {
      console.error('Error verifying evidence integrity:', error);
      throw error;
    }
  }

  async dispose() {
    await this.prisma.$disconnect();
  }
}

export const documentManagementService = new DocumentManagementService();