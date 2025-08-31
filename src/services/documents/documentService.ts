import { PrismaClient } from '@prisma/client';
import { DocumentRepository } from '../repositories/documentRepository';
import { storageService } from '../utils/storage';
import { DocumentValidator } from '../utils/validation';
import { ocrService } from '../utils/document-processing/ocrService';
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

      // Process OCR for supported file types
      let extractedText = '';
      if (await ocrService.isFormatSupported(mimeType)) {
        try {
          const ocrResult = await ocrService.processDocument(storageResult.filePath, {
            languages: ['eng', 'chi_sim'],
            autoRotate: true,
            preserveFormatting: true,
          });
          
          extractedText = ocrResult.text;
          
          // Update document with extracted text
          await this.documentRepository.update(document.id, {
            extractedText,
            metadata: {
              ...options.metadata,
              ocrConfidence: ocrResult.confidence,
              ocrLanguage: ocrResult.language,
              ocrProcessingTime: ocrResult.processingTime,
            }
          });
        } catch (error) {
          console.error('OCR processing failed:', error);
          // Don't fail the upload if OCR fails
        }
      }

      return {
        success: true,
        filePath: storageResult.filePath,
        filename: storageResult.filename,
        size: storageResult.size,
        mimeType,
        checksum,
        extractedText
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

  // OCR-specific methods
  async reprocessOCR(documentId: string): Promise<{
    success: boolean;
    extractedText?: string;
    confidence?: number;
    error?: string;
  }> {
    try {
      const document = await this.getDocument(documentId);
      if (!document) {
        return { success: false, error: 'Document not found' };
      }

      if (!(await ocrService.isFormatSupported(document.mimeType))) {
        return { success: false, error: 'Unsupported format for OCR' };
      }

      const ocrResult = await ocrService.processDocument(document.path, {
        languages: ['eng', 'chi_sim'],
        autoRotate: true,
        preserveFormatting: true,
      });

      await this.documentRepository.update(documentId, {
        extractedText: ocrResult.text,
        metadata: {
          ...document.metadata,
          ocrConfidence: ocrResult.confidence,
          ocrLanguage: ocrResult.language,
          ocrProcessingTime: ocrResult.processingTime,
          lastOCRTimestamp: new Date().toISOString(),
        }
      });

      return {
        success: true,
        extractedText: ocrResult.text,
        confidence: ocrResult.confidence,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async searchByOCRText(query: string, options?: {
    caseId?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }): Promise<DocumentWithDetails[]> {
    const { caseId, category, limit = 20, offset = 0 } = options || {};

    const where: any = {
      extractedText: {
        contains: query,
        mode: 'insensitive'
      }
    };

    if (caseId) where.caseId = caseId;
    if (category) where.category = category;

    return await this.prisma.document.findMany({
      where,
      include: {
        case: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1
        },
        _count: {
          select: {
            versions: true
          }
        }
      },
      orderBy: { uploadedAt: 'desc' },
      take: limit,
      skip: offset
    });
  }

  async getOCRStats(): Promise<{
    totalDocuments: number;
    documentsWithOCR: number;
    averageConfidence: number;
    byLanguage: Record<string, number>;
    processingTimes: {
      min: number;
      max: number;
      average: number;
    };
  }> {
    const documents = await this.prisma.document.findMany({
      where: {
        extractedText: {
          not: ''
        }
      },
      select: {
        metadata: true,
        extractedText: true
      }
    });

    const totalDocuments = await this.prisma.document.count();
    const documentsWithOCR = documents.length;

    let totalConfidence = 0;
    let totalProcessingTime = 0;
    const languageCounts: Record<string, number> = {};
    const processingTimes: number[] = [];

    documents.forEach(doc => {
      const metadata = doc.metadata as any;
      if (metadata.ocrConfidence) {
        totalConfidence += metadata.ocrConfidence;
      }
      if (metadata.ocrProcessingTime) {
        processingTimes.push(metadata.ocrProcessingTime);
        totalProcessingTime += metadata.ocrProcessingTime;
      }
      if (metadata.ocrLanguage) {
        languageCounts[metadata.ocrLanguage] = (languageCounts[metadata.ocrLanguage] || 0) + 1;
      }
    });

    const averageConfidence = documentsWithOCR > 0 ? totalConfidence / documentsWithOCR : 0;

    return {
      totalDocuments,
      documentsWithOCR,
      averageConfidence,
      byLanguage: languageCounts,
      processingTimes: {
        min: processingTimes.length > 0 ? Math.min(...processingTimes) : 0,
        max: processingTimes.length > 0 ? Math.max(...processingTimes) : 0,
        average: processingTimes.length > 0 ? totalProcessingTime / processingTimes.length : 0,
      }
    };
  }

  async validateOCRQuality(documentId: string): Promise<{
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    try {
      const document = await this.getDocument(documentId);
      if (!document || !document.extractedText) {
        return {
          isValid: false,
          issues: ['No OCR text available'],
          suggestions: ['Run OCR processing first']
        };
      }

      const metadata = document.metadata as any;
      const confidence = metadata.ocrConfidence || 0;

      // Create a mock OCR result for validation
      const ocrResult = {
        text: document.extractedText,
        confidence,
        language: metadata.ocrLanguage || 'eng',
        pages: [{
          pageNumber: 1,
          text: document.extractedText,
          confidence,
          blocks: []
        }],
        processingTime: metadata.ocrProcessingTime || 0
      };

      return await ocrService.validateOCRQuality(ocrResult);
    } catch (error) {
      return {
        isValid: false,
        issues: ['Validation failed'],
        suggestions: ['Try reprocessing OCR']
      };
    }
  }
}