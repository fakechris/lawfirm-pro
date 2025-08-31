import { injectable, inject } from 'tsyringe';
import { Database } from '../utils/database';
import { WebSocketService } from './websocket';
import { UserRole } from '@prisma/client';
import { DocumentResponse, FileUploadResponse } from '../types';
import * as fs from 'fs';
import * as path from 'path';

@injectable()
export class DocumentService {
  constructor(
    @inject(Database) private db: Database,
    @inject(WebSocketService) private wsService: WebSocketService
  ) {}

  async uploadDocument(
    file: Express.Multer.File,
    caseId: string,
    uploadedBy: string,
    isConfidential: boolean = false
  ): Promise<DocumentResponse> {
    // Verify user has access to the case
    await this.verifyCaseAccess(caseId, uploadedBy);

    // Validate file
    this.validateFile(file);

    // Generate unique filename
    const filename = this.generateUniqueFilename(file.originalname);
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const filePath = path.join(uploadDir, filename);

    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Save file
    fs.writeFileSync(filePath, file.buffer);

    // Create document record
    const document = await this.db.client.document.create({
      data: {
        filename,
        originalName: file.originalname,
        path: filePath,
        size: file.size,
        mimeType: file.mimetype,
        caseId,
        uploadedBy,
        isConfidential,
      },
      include: {
        case: true,
      },
    });

    const documentResponse = this.transformDocumentResponse(document);

    // Broadcast real-time update
    this.wsService.broadcastDocument(caseId, documentResponse);

    return documentResponse;
  }

  async getDocumentsByCaseId(caseId: string, userId: string): Promise<DocumentResponse[]> {
    // Verify user has access to the case
    await this.verifyCaseAccess(caseId, userId);

    const documents = await this.db.client.document.findMany({
      where: { caseId },
      include: {
        case: true,
      },
      orderBy: { uploadedAt: 'desc' },
    });

    return documents.map(doc => this.transformDocumentResponse(doc));
  }

  async getDocumentById(documentId: string, userId: string): Promise<DocumentResponse> {
    const document = await this.db.client.document.findUnique({
      where: { id: documentId },
      include: {
        case: true,
      },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Verify user has access to the case
    await this.verifyCaseAccess(document.caseId, userId);

    return this.transformDocumentResponse(document);
  }

  async downloadDocument(documentId: string, userId: string): Promise<{ filePath: string; filename: string; mimeType: string }> {
    const document = await this.db.client.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Verify user has access to the case
    await this.verifyCaseAccess(document.caseId, userId);

    // Check if file exists
    if (!fs.existsSync(document.path)) {
      throw new Error('File not found on server');
    }

    return {
      filePath: document.path,
      filename: document.originalName,
      mimeType: document.mimeType,
    };
  }

  async updateDocument(
    documentId: string,
    updates: {
      isConfidential?: boolean;
    },
    userId: string
  ): Promise<DocumentResponse> {
    const document = await this.db.client.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Verify user has access to the case and is the uploader
    await this.verifyCaseAccess(document.caseId, userId);
    
    if (document.uploadedBy !== userId) {
      throw new Error('Only the uploader can update document settings');
    }

    const updatedDocument = await this.db.client.document.update({
      where: { id: documentId },
      data: updates,
      include: {
        case: true,
      },
    });

    return this.transformDocumentResponse(updatedDocument);
  }

  async deleteDocument(documentId: string, userId: string): Promise<void> {
    const document = await this.db.client.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Verify user has access to the case and is the uploader
    await this.verifyCaseAccess(document.caseId, userId);
    
    if (document.uploadedBy !== userId) {
      throw new Error('Only the uploader can delete the document');
    }

    // Delete file from filesystem
    if (fs.existsSync(document.path)) {
      fs.unlinkSync(document.path);
    }

    // Delete document record
    await this.db.client.document.delete({
      where: { id: documentId },
    });
  }

  async grantDocumentAccess(documentId: string, userId: string, grantedBy: string): Promise<void> {
    const document = await this.db.client.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Verify granter has access to the case
    await this.verifyCaseAccess(document.caseId, grantedBy);

    // Verify target user exists
    const targetUser = await this.db.client.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      throw new Error('Target user not found');
    }

    // Check if access already exists
    const existingAccess = await this.db.client.documentAccess.findUnique({
      where: {
        documentId_userId: {
          documentId,
          userId,
        },
      },
    });

    if (existingAccess) {
      return; // Access already granted
    }

    // Grant access
    await this.db.client.documentAccess.create({
      data: {
        documentId,
        userId,
        grantedAt: new Date(),
      },
    });
  }

  async revokeDocumentAccess(documentId: string, userId: string, revokedBy: string): Promise<void> {
    const document = await this.db.client.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Verify revoker has access to the case
    await this.verifyCaseAccess(document.caseId, revokedBy);

    // Revoke access
    await this.db.client.documentAccess.delete({
      where: {
        documentId_userId: {
          documentId,
          userId,
        },
      },
    });
  }

  async getDocumentAccess(documentId: string, userId: string): Promise<any[]> {
    const document = await this.db.client.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Verify user has access to the case
    await this.verifyCaseAccess(document.caseId, userId);

    const accessList = await this.db.client.documentAccess.findMany({
      where: { documentId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    return accessList.map(access => ({
      id: access.id,
      userId: access.userId,
      user: access.user,
      grantedAt: access.grantedAt,
      expiresAt: access.expiresAt,
    }));
  }

  async searchDocuments(userId: string, query: string, caseId?: string): Promise<DocumentResponse[]> {
    const where: any = {
      AND: [
        {
          OR: [
            { case: { clientId: userId } },
            { case: { attorneyId: userId } },
            { uploadedBy: userId },
          ],
        },
        {
          OR: [
            { originalName: { contains: query, mode: 'insensitive' } },
            { filename: { contains: query, mode: 'insensitive' } },
          ],
        },
      ],
    };

    if (caseId) {
      where.AND.push({ caseId });
    }

    const documents = await this.db.client.document.findMany({
      where,
      include: {
        case: true,
      },
      orderBy: { uploadedAt: 'desc' },
      take: 100,
    });

    return documents.map(doc => this.transformDocumentResponse(doc));
  }

  async getDocumentStats(userId: string): Promise<{
    total: number;
    totalSize: number;
    byType: Record<string, number>;
    recentUploads: DocumentResponse[];
  }> {
    const where = {
      OR: [
        { case: { clientId: userId } },
        { case: { attorneyId: userId } },
        { uploadedBy: userId },
      ],
    };

    const [documents, total, totalSizeResult] = await Promise.all([
      this.db.client.document.findMany({
        where,
        include: {
          case: true,
        },
        orderBy: { uploadedAt: 'desc' },
        take: 10, // Recent uploads
      }),
      this.db.client.document.count({ where }),
      this.db.client.document.aggregate({
        where,
        _sum: { size: true },
      }),
    ]);

    const byType: Record<string, number> = {};
    documents.forEach(doc => {
      const type = doc.mimetype.split('/')[0] || 'other';
      byType[type] = (byType[type] || 0) + 1;
    });

    return {
      total,
      totalSize: totalSizeResult._sum.size || 0,
      byType,
      recentUploads: documents.map(doc => this.transformDocumentResponse(doc)),
    };
  }

  private validateFile(file: Express.Multer.File): void {
    const maxSize = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB default
    
    if (file.size > maxSize) {
      throw new Error(`File size exceeds maximum limit of ${maxSize / 1024 / 1024}MB`);
    }

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error('File type not allowed');
    }
  }

  private generateUniqueFilename(originalName: string): string {
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    
    // Sanitize filename
    const sanitizedName = name.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_');
    
    return `${sanitizedName}_${timestamp}_${random}${ext}`;
  }

  private async verifyCaseAccess(caseId: string, userId: string): Promise<void> {
    const user = await this.db.client.user.findUnique({
      where: { id: userId },
      include: {
        clientProfile: true,
        attorneyProfile: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    let hasAccess = false;

    if (user.role === UserRole.CLIENT && user.clientProfile) {
      const caseAccess = await this.db.client.case.findFirst({
        where: {
          id: caseId,
          clientId: user.clientProfile.id,
        },
      });
      hasAccess = !!caseAccess;
    } else if (user.role === UserRole.ATTORNEY && user.attorneyProfile) {
      const caseAccess = await this.db.client.case.findFirst({
        where: {
          id: caseId,
          attorneyId: user.attorneyProfile.id,
        },
      });
      hasAccess = !!caseAccess;
    }

    if (!hasAccess) {
      throw new Error('Access denied to this case');
    }
  }

  private transformDocumentResponse(document: any): DocumentResponse {
    return {
      id: document.id,
      filename: document.filename,
      originalName: document.originalName,
      size: document.size,
      mimeType: document.mimeType,
      caseId: document.caseId,
      uploadedBy: document.uploadedBy,
      uploadedAt: document.uploadedAt,
      isConfidential: document.isConfidential,
    };
  }
}