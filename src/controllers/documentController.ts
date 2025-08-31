import { Request, Response, NextFunction } from 'express';
import { 
  documentStorageService,
  documentVersionService,
  documentMetadataService,
  documentSearchService
} from '../services/documents';
import { DocumentRepository } from '../repositories/documentRepository';
import { PrismaClient } from '@prisma/client';
import { 
  DocumentUploadInput,
  DocumentUpdateInput,
  DocumentSearchOptions,
  DocumentOperationResult,
  DocumentWithDetails,
  VersionControlOptions,
  MetadataExtractionOptions
} from '../models/documents';
import { DOCUMENT_ERROR_CODES } from '../models/documents/models';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    firstName?: string;
    lastName?: string;
  };
}

export class DocumentController {
  private prisma: PrismaClient;
  private repository: DocumentRepository;

  constructor() {
    this.prisma = new PrismaClient();
    this.repository = new DocumentRepository(this.prisma);
  }

  // Document Upload and Management
  async uploadDocument(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          error: {
            code: 'NO_FILE',
            message: 'No file uploaded'
          }
        });
        return;
      }

      const { 
        caseId, 
        clientId, 
        category, 
        description, 
        tags, 
        isConfidential,
        isTemplate 
      } = req.body;

      // Validate file
      const validationResult = await documentStorageService.validateFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      if (!validationResult.isValid) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_FILE',
            message: validationResult.error || 'File validation failed'
          }
        });
        return;
      }

      // Check for duplicate files
      const checksum = await documentStorageService.calculateFileHash(req.file.buffer);
      const existingDocument = await this.repository.findByChecksum(checksum);
      
      if (existingDocument) {
        res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_FILE',
            message: 'A document with this content already exists',
            data: {
              documentId: existingDocument.id,
              filename: existingDocument.originalName
            }
          }
        });
        return;
      }

      // Store the file
      const storageResult = await documentStorageService.uploadFile(
        req.file.buffer,
        req.file.originalname,
        {
          filename: req.file.originalname,
          mimeType: req.file.mimetype,
          category: 'documents',
          subcategory: 'original',
          metadata: {
            uploadedBy: req.user.id,
            caseId,
            clientId,
            category
          }
        }
      );

      if (!storageResult.success) {
        res.status(500).json({
          success: false,
          error: {
            code: 'STORAGE_ERROR',
            message: storageResult.error || 'Failed to store file'
          }
        });
        return;
      }

      // Create document record
      const documentData: DocumentUploadInput & { path: string; checksum: string; uploadedBy: string } = {
        filename: storageResult.filename,
        originalName: req.file.originalname,
        path: storageResult.filePath,
        size: storageResult.size,
        mimeType: req.file.mimetype,
        checksum,
        uploadedBy: req.user.id,
        caseId: caseId || undefined,
        clientId: clientId || undefined,
        category,
        description,
        tags: tags ? JSON.parse(tags) : undefined,
        isConfidential: isConfidential === 'true',
        isTemplate: isTemplate === 'true'
      };

      const document = await this.repository.create(documentData);

      // Extract metadata asynchronously
      documentMetadataService.extractMetadata(
        document.id,
        storageResult.filePath,
        req.file.mimetype
      ).catch(error => {
        console.error(`Metadata extraction failed for document ${document.id}:`, error);
      });

      // Index for search
      documentSearchService.indexDocument(document.id).catch(error => {
        console.error(`Search indexing failed for document ${document.id}:`, error);
      });

      res.status(201).json({
        success: true,
        data: {
          id: document.id,
          filename: document.filename,
          originalName: document.originalName,
          size: document.size,
          mimeType: document.mimeType,
          category: document.category,
          uploadedAt: document.uploadedAt,
          message: 'Document uploaded successfully'
        }
      });

    } catch (error) {
      next(error);
    }
  }

  async getDocument(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
        return;
      }

      const document = await this.repository.findById(id);

      if (!document) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Document not found'
          }
        });
        return;
      }

      // Check access permissions
      const hasAccess = await this.repository.isAccessible(
        id, 
        req.user.id, 
        req.user.role
      );

      if (!hasAccess) {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied to this document'
          }
        });
        return;
      }

      res.json({
        success: true,
        data: document
      });

    } catch (error) {
      next(error);
    }
  }

  async downloadDocument(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
        return;
      }

      const document = await this.repository.findById(id);

      if (!document) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Document not found'
          }
        });
        return;
      }

      // Check access permissions
      const hasAccess = await this.repository.isAccessible(
        id, 
        req.user.id, 
        req.user.role
      );

      if (!hasAccess) {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied to this document'
          }
        });
        return;
      }

      // Download the file
      const downloadResult = await documentStorageService.downloadFile(document.path);

      if (!downloadResult.success || !downloadResult.buffer) {
        res.status(500).json({
          success: false,
          error: {
            code: 'DOWNLOAD_ERROR',
            message: downloadResult.error || 'Failed to download file'
          }
        });
        return;
      }

      // Set appropriate headers
      res.setHeader('Content-Type', document.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
      res.setHeader('Content-Length', downloadResult.buffer.length.toString());

      // Send the file
      res.send(downloadResult.buffer);

      // Log the download
      console.log(`Document ${document.id} downloaded by user ${req.user.id}`);

    } catch (error) {
      next(error);
    }
  }

  async updateDocument(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: DocumentUpdateInput = req.body;

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
        return;
      }

      // Check if document exists and user has permission
      const existingDocument = await this.repository.findById(id);
      if (!existingDocument) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Document not found'
          }
        });
        return;
      }

      // Only document owner or admin can update
      if (existingDocument.uploadedBy !== req.user.id && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Only document owner or admin can update document'
          }
        });
        return;
      }

      const updatedDocument = await this.repository.update(id, updateData);

      // Re-index for search if metadata changed
      if (updateData.tags || updateData.category || updateData.description) {
        documentSearchService.indexDocument(id).catch(error => {
          console.error(`Search re-indexing failed for document ${id}:`, error);
        });
      }

      res.json({
        success: true,
        data: updatedDocument,
        message: 'Document updated successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  async deleteDocument(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { permanent = false } = req.query;

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
        return;
      }

      // Check if document exists and user has permission
      const existingDocument = await this.repository.findById(id);
      if (!existingDocument) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Document not found'
          }
        });
        return;
      }

      // Only document owner or admin can delete
      if (existingDocument.uploadedBy !== req.user.id && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Only document owner or admin can delete document'
          }
        });
        return;
      }

      await this.repository.delete(id, permanent === true);

      // Remove from search index
      documentSearchService.removeFromIndex(id).catch(error => {
        console.error(`Search index removal failed for document ${id}:`, error);
      });

      res.json({
        success: true,
        message: permanent ? 'Document permanently deleted' : 'Document moved to trash'
      });

    } catch (error) {
      next(error);
    }
  }

  async listDocuments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
        return;
      }

      const {
        caseId,
        clientId,
        category,
        status,
        tags,
        limit = 20,
        offset = 0,
        sortBy = 'uploadedAt',
        sortOrder = 'desc'
      } = req.query;

      const result = await this.repository.findMany({
        caseId: caseId as string,
        clientId: clientId as string,
        category: category as string,
        status: status as string,
        tags: tags ? JSON.parse(tags as string) : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        orderBy: {
          field: sortBy as string,
          order: sortOrder as 'asc' | 'desc'
        }
      });

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      next(error);
    }
  }

  // Document Version Management
  async createVersion(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { 
        file, 
        changeDescription, 
        isMajor = false 
      } = req.body;

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
        return;
      }

      // Check if document exists and user has permission
      const existingDocument = await this.repository.findById(id);
      if (!existingDocument) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Document not found'
          }
        });
        return;
      }

      // Only document owner or admin can create versions
      if (existingDocument.uploadedBy !== req.user.id && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Only document owner or admin can create versions'
          }
        });
        return;
      }

      // In a real implementation, you would handle file upload here
      // For now, we'll assume the file is processed and available as buffer
      const versionResult = await documentVersionService.createVersion({
        documentId: id,
        fileBuffer: Buffer.from(file, 'base64'), // Assuming base64 encoded file
        originalName: existingDocument.originalName,
        mimeType: existingDocument.mimeType,
        changeDescription,
        createdBy: req.user.id,
        isMajor: isMajor === true
      });

      if (!versionResult.success) {
        res.status(500).json({
          success: false,
          error: {
            code: 'VERSION_ERROR',
            message: versionResult.error || 'Failed to create version'
          }
        });
        return;
      }

      res.json({
        success: true,
        data: {
          versionNumber: versionResult.versionNumber,
          filePath: versionResult.filePath,
          message: 'Version created successfully'
        }
      });

    } catch (error) {
      next(error);
    }
  }

  async getVersions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { limit = 20, offset = 0 } = req.query;

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
        return;
      }

      // Check access permissions
      const hasAccess = await this.repository.isAccessible(
        id, 
        req.user.id, 
        req.user.role
      );

      if (!hasAccess) {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied to this document'
          }
        });
        return;
      }

      const versions = await this.repository.getVersions(id, {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });

      res.json({
        success: true,
        data: versions
      });

    } catch (error) {
      next(error);
    }
  }

  // Document Search
  async searchDocuments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
        return;
      }

      const {
        query,
        caseId,
        clientId,
        category,
        tags,
        mimeType,
        language,
        dateFrom,
        dateTo,
        fuzzySearch = true,
        searchInContent = true,
        searchInMetadata = true,
        limit = 20,
        offset = 0,
        sortBy = 'relevance',
        sortOrder = 'desc'
      } = req.query;

      const searchOptions: DocumentSearchOptions = {
        query: query as string,
        caseId: caseId as string,
        clientId: clientId as string,
        category: category as string,
        tags: tags ? JSON.parse(tags as string) : undefined,
        mimeType: mimeType as string,
        language: language as string,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        fuzzySearch: fuzzySearch === 'true',
        searchInContent: searchInContent === 'true',
        searchInMetadata: searchInMetadata === 'true',
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc'
      };

      const results = await documentSearchService.searchDocuments(
        searchOptions.query || '',
        searchOptions
      );

      res.json({
        success: true,
        data: {
          results,
          total: results.length,
          query: searchOptions.query,
          filters: searchOptions
        }
      });

    } catch (error) {
      next(error);
    }
  }

  async getSearchSuggestions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { query, limit = 10 } = req.query;

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
        return;
      }

      const suggestions = await documentSearchService.getSearchSuggestions(
        query as string,
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: suggestions
      });

    } catch (error) {
      next(error);
    }
  }

  // Document Statistics and Analytics
  async getDocumentStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
        return;
      }

      // Only admins and managers can access statistics
      if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Insufficient permissions to access statistics'
          }
        });
        return;
      }

      const stats = await this.repository.getDocumentStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      next(error);
    }
  }

  async getUserDocuments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
        return;
      }

      const { limit = 20, offset = 0, status } = req.query;

      const documents = await this.repository.getUserDocuments(req.user.id, {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        status: status as string
      });

      res.json({
        success: true,
        data: documents
      });

    } catch (error) {
      next(error);
    }
  }

  // Document Processing and Metadata
  async reprocessDocument(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
        return;
      }

      // Check if document exists and user has permission
      const existingDocument = await this.repository.findById(id);
      if (!existingDocument) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Document not found'
          }
        });
        return;
      }

      // Only document owner or admin can reprocess
      if (existingDocument.uploadedBy !== req.user.id && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Only document owner or admin can reprocess document'
          }
        });
        return;
      }

      const result = await documentMetadataService.extractMetadata(
        id,
        existingDocument.path,
        existingDocument.mimeType
      );

      if (!result.success) {
        res.status(500).json({
          success: false,
          error: {
            code: 'PROCESSING_ERROR',
            message: result.error || 'Failed to reprocess document'
          }
        });
        return;
      }

      // Re-index for search
      documentSearchService.indexDocument(id).catch(error => {
        console.error(`Search re-indexing failed for document ${id}:`, error);
      });

      res.json({
        success: true,
        data: {
          processingTime: result.processingTime,
          extractedMetadata: result.extractedMetadata,
          message: 'Document reprocessed successfully'
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // Error handling middleware
  static handleError(error: any, req: Request, res: Response, next: NextFunction): void {
    console.error('Document Controller Error:', error);

    if (error.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_ENTRY',
          message: 'A duplicate entry was found'
        }
      });
      return;
    }

    if (error.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Requested resource not found'
        }
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal server error occurred'
      }
    });
  }
}

export const documentController = new DocumentController();