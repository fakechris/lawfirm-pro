import { PrismaClient } from '@prisma/client';
import { DocumentRepository } from '../repositories/documentRepository';
import { storageService } from '../utils/storage';
import { DocumentValidator } from '../utils/validation';
import { 
  DocumentUploadInput,
  DocumentUpdateInput,
  DocumentVersionInput,
  DocumentWithDetails,
  DocumentProcessingResult
} from '../types';

export class DocumentService {
  private documentRepository: DocumentRepository;
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.documentRepository = new DocumentRepository(prisma);
  }

  async uploadDocument(
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    options: {
      caseId?: string;
      isConfidential?: boolean;
      isTemplate?: boolean;
      category?: string;
      description?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
      uploadedBy: string;
    }
  ): Promise<DocumentProcessingResult> {
    try {
      // Validate input
      if (!DocumentValidator.validateMimeType(mimeType)) {
        throw new Error(`Unsupported MIME type: ${mimeType}`);
      }

      if (!DocumentValidator.validateFileSize(fileBuffer.length)) {
        throw new Error('File size exceeds maximum limit');
      }

      if (!DocumentValidator.validateFileExtension(originalName)) {
        throw new Error('Unsupported file extension');
      }

      if (options.tags && !DocumentValidator.validateTags(options.tags)) {
        throw new Error('Invalid tags provided');
      }

      // Sanitize filename
      const sanitizedFilename = DocumentValidator.sanitizeFilename(originalName);
      
      // Calculate checksum
      const checksum = storageService.calculateChecksum(fileBuffer);

      // Check for duplicate files
      const existingDocument = await this.documentRepository.findByChecksum(checksum);
      if (existingDocument) {
        return {
          success: false,
          filePath: '',
          filename: '',
          size: 0,
          mimeType: '',
          checksum: '',
          error: 'Duplicate file detected'
        };
      }

      // Save file to storage
      const storageResult = await storageService.saveFile(
        fileBuffer,
        sanitizedFilename,
        {
          category: 'documents',
          subcategory: 'original'
        }
      );

      // Create document record
      const documentData: DocumentUploadInput & { path: string; checksum: string; uploadedBy: string } = {
        filename: storageResult.filename,
        originalName: sanitizedFilename,
        path: storageResult.filePath,
        size: storageResult.size,
        mimeType,
        checksum,
        uploadedBy: options.uploadedBy,
        caseId: options.caseId,
        isConfidential: options.isConfidential || false,
        isTemplate: options.isTemplate || false,
        category: options.category as any,
        description: options.description,
        tags: options.tags || [],
        metadata: options.metadata
      };

      const document = await this.documentRepository.create(documentData);

      // Create initial version
      await this.documentRepository.createVersion({
        documentId: document.id,
        filePath: storageResult.filePath,
        fileSize: storageResult.size,
        checksum,
        changeDescription: 'Initial version'
      });

      return {
        success: true,
        filePath: storageResult.filePath,
        filename: storageResult.filename,
        size: storageResult.size,
        mimeType,
        checksum
      };
    } catch (error) {
      return {
        success: false,
        filePath: '',
        filename: '',
        size: 0,
        mimeType: '',
        checksum: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getDocument(id: string): Promise<DocumentWithDetails | null> {
    return await this.documentRepository.findById(id);
  }

  async getDocuments(params: {
    caseId?: string;
    category?: string;
    status?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<DocumentWithDetails[]> {
    return await this.documentRepository.findMany(params);
  }

  async updateDocument(id: string, data: DocumentUpdateInput): Promise<DocumentWithDetails> {
    // Validate input
    if (data.tags && !DocumentValidator.validateTags(data.tags)) {
      throw new Error('Invalid tags provided');
    }

    const document = await this.documentRepository.update(id, data);
    return await this.getDocument(id) as DocumentWithDetails;
  }

  async deleteDocument(id: string): Promise<void> {
    await this.documentRepository.delete(id);
  }

  async createVersion(
    documentId: string,
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    changeDescription?: string
  ): Promise<DocumentProcessingResult> {
    try {
      // Get the original document
      const document = await this.documentRepository.findById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Validate input
      if (!DocumentValidator.validateMimeType(mimeType)) {
        throw new Error(`Unsupported MIME type: ${mimeType}`);
      }

      if (!DocumentValidator.validateFileSize(fileBuffer.length)) {
        throw new Error('File size exceeds maximum limit');
      }

      // Sanitize filename
      const sanitizedFilename = DocumentValidator.sanitizeFilename(originalName);
      
      // Calculate checksum
      const checksum = storageService.calculateChecksum(fileBuffer);

      // Save version file
      const storageResult = await storageService.saveFile(
        fileBuffer,
        sanitizedFilename,
        {
          category: 'documents',
          subcategory: 'versions'
        }
      );

      // Create version record
      await this.documentRepository.createVersion({
        documentId,
        filePath: storageResult.filePath,
        fileSize: storageResult.size,
        checksum,
        changeDescription
      });

      // Update document version
      await this.documentRepository.update(documentId, {
        version: (document.version || 1) + 1
      });

      return {
        success: true,
        filePath: storageResult.filePath,
        filename: storageResult.filename,
        size: storageResult.size,
        mimeType,
        checksum
      };
    } catch (error) {
      return {
        success: false,
        filePath: '',
        filename: '',
        size: 0,
        mimeType: '',
        checksum: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getDocumentVersions(documentId: string) {
    return await this.documentRepository.getVersions(documentId);
  }

  async getDocumentVersion(documentId: string, versionNumber: number) {
    return await this.documentRepository.getVersion(documentId, versionNumber);
  }

  async downloadDocument(id: string, versionNumber?: number): Promise<{
    buffer: Buffer;
    filename: string;
    mimeType: string;
  } | null> {
    try {
      if (versionNumber) {
        const version = await this.documentRepository.getVersion(id, versionNumber);
        if (!version) {
          return null;
        }

        const buffer = await storageService.getFile(version.filePath);
        return {
          buffer,
          filename: `v${versionNumber}_${version.filePath.split('/').pop()}`,
          mimeType: 'application/octet-stream'
        };
      } else {
        const document = await this.documentRepository.findById(id);
        if (!document) {
          return null;
        }

        const buffer = await storageService.getFile(document.path);
        return {
          buffer,
          filename: document.originalName,
          mimeType: document.mimeType
        };
      }
    } catch (error) {
      return null;
    }
  }

  async searchDocuments(query: string, options?: {
    caseId?: string;
    category?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<DocumentWithDetails[]> {
    return await this.documentRepository.search({
      query,
      ...options
    });
  }

  async getDocumentsByCase(caseId: string): Promise<DocumentWithDetails[]> {
    return await this.documentRepository.getDocumentsByCase(caseId);
  }

  async getDocumentsByUser(userId: string): Promise<DocumentWithDetails[]> {
    return await this.documentRepository.getDocumentsByUser(userId);
  }

  async getDocumentStats() {
    return await this.documentRepository.getStats();
  }

  async getStorageUsage() {
    // This would need to be implemented to scan storage directories
    // For now, return a basic structure
    return {
      totalUsed: 0,
      totalAvailable: 0,
      byCategory: {
        documents: { used: 0, fileCount: 0 },
        templates: { used: 0, fileCount: 0 },
        evidence: { used: 0, fileCount: 0 },
        temp: { used: 0, fileCount: 0 }
      }
    };
  }
}