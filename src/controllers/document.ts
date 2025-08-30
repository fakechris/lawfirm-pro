import { Request, Response } from 'express';
import { container } from 'tsyringe';
import { DocumentService } from '../services/document';
import { AuditMiddleware } from '../middleware/audit';
import { AuthenticatedRequest } from '../middleware/auth';
import { DocumentResponse, ApiResponse } from '../types';

export class DocumentController {
  private documentService = container.resolve(DocumentService);

  async uploadDocument(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user!.id;
      const { caseId, isConfidential } = req.body;

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded',
        } as ApiResponse<null>);
        return;
      }

      if (!caseId) {
        res.status(400).json({
          success: false,
          message: 'Case ID is required',
        } as ApiResponse<null>);
        return;
      }

      const result: DocumentResponse = await this.documentService.uploadDocument(
        req.file,
        caseId,
        userId,
        isConfidential === 'true' || isConfidential === true
      );
      
      await AuditMiddleware.createAuditLog(
        req as AuthenticatedRequest,
        'DOCUMENT_UPLOAD',
        'document',
        result.id,
        null,
        { 
          filename: result.originalName,
          size: result.size,
          caseId: result.caseId,
          isConfidential: result.isConfidential
        }
      );

      res.status(201).json({
        success: true,
        data: result,
        message: 'Document uploaded successfully',
      } as ApiResponse<DocumentResponse>);
    } catch (error) {
      console.error('Upload document error:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to upload document',
      } as ApiResponse<null>);
    }
  }

  async getCaseDocuments(req: Request, res: Response): Promise<void> {
    try {
      const { caseId } = req.params;
      const userId = (req as AuthenticatedRequest).user!.id;

      const documents: DocumentResponse[] = await this.documentService.getDocumentsByCaseId(caseId, userId);

      res.json({
        success: true,
        data: documents,
        message: 'Documents retrieved successfully',
      } as ApiResponse<DocumentResponse[]>);
    } catch (error) {
      console.error('Get case documents error:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve documents',
      } as ApiResponse<null>);
    }
  }

  async getDocumentById(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;
      const userId = (req as AuthenticatedRequest).user!.id;

      const document: DocumentResponse = await this.documentService.getDocumentById(documentId, userId);

      res.json({
        success: true,
        data: document,
        message: 'Document retrieved successfully',
      } as ApiResponse<DocumentResponse>);
    } catch (error) {
      console.error('Get document error:', error);
      res.status(404).json({
        success: false,
        message: error instanceof Error ? error.message : 'Document not found',
      } as ApiResponse<null>);
    }
  }

  async downloadDocument(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;
      const userId = (req as AuthenticatedRequest).user!.id;

      const { filePath, filename, mimeType } = await this.documentService.downloadDocument(documentId, userId);

      res.download(filePath, filename, (err) => {
        if (err) {
          console.error('Download error:', err);
          res.status(500).json({
            success: false,
            message: 'Failed to download document',
          } as ApiResponse<null>);
        }
      });

      await AuditMiddleware.createAuditLog(
        req as AuthenticatedRequest,
        'DOCUMENT_DOWNLOAD',
        'document',
        documentId,
        null,
        { filename }
      );
    } catch (error) {
      console.error('Download document error:', error);
      res.status(404).json({
        success: false,
        message: error instanceof Error ? error.message : 'Document not found',
      } as ApiResponse<null>);
    }
  }

  async updateDocument(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;
      const { isConfidential } = req.body;
      const userId = (req as AuthenticatedRequest).user!.id;

      const result: DocumentResponse = await this.documentService.updateDocument(
        documentId,
        { isConfidential },
        userId
      );
      
      await AuditMiddleware.createAuditLog(
        req as AuthenticatedRequest,
        'DOCUMENT_UPDATE',
        'document',
        documentId,
        null,
        { isConfidential: result.isConfidential }
      );

      res.json({
        success: true,
        data: result,
        message: 'Document updated successfully',
      } as ApiResponse<DocumentResponse>);
    } catch (error) {
      console.error('Update document error:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update document',
      } as ApiResponse<null>);
    }
  }

  async deleteDocument(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;
      const userId = (req as AuthenticatedRequest).user!.id;

      await this.documentService.deleteDocument(documentId, userId);
      
      await AuditMiddleware.createAuditLog(
        req as AuthenticatedRequest,
        'DOCUMENT_DELETE',
        'document',
        documentId,
        null,
        { deletedBy: userId }
      );

      res.json({
        success: true,
        message: 'Document deleted successfully',
      } as ApiResponse<null>);
    } catch (error) {
      console.error('Delete document error:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete document',
      } as ApiResponse<null>);
    }
  }

  async grantDocumentAccess(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;
      const { userId } = req.body;
      const grantedBy = (req as AuthenticatedRequest).user!.id;

      await this.documentService.grantDocumentAccess(documentId, userId, grantedBy);
      
      await AuditMiddleware.createAuditLog(
        req as AuthenticatedRequest,
        'DOCUMENT_ACCESS_GRANT',
        'document_access',
        undefined,
        null,
        { documentId, userId, grantedBy }
      );

      res.json({
        success: true,
        message: 'Document access granted successfully',
      } as ApiResponse<null>);
    } catch (error) {
      console.error('Grant document access error:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to grant document access',
      } as ApiResponse<null>);
    }
  }

  async revokeDocumentAccess(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;
      const { userId } = req.body;
      const revokedBy = (req as AuthenticatedRequest).user!.id;

      await this.documentService.revokeDocumentAccess(documentId, userId, revokedBy);
      
      await AuditMiddleware.createAuditLog(
        req as AuthenticatedRequest,
        'DOCUMENT_ACCESS_REVOKE',
        'document_access',
        undefined,
        null,
        { documentId, userId, revokedBy }
      );

      res.json({
        success: true,
        message: 'Document access revoked successfully',
      } as ApiResponse<null>);
    } catch (error) {
      console.error('Revoke document access error:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to revoke document access',
      } as ApiResponse<null>);
    }
  }

  async getDocumentAccess(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;
      const userId = (req as AuthenticatedRequest).user!.id;

      const accessList = await this.documentService.getDocumentAccess(documentId, userId);

      res.json({
        success: true,
        data: accessList,
        message: 'Document access list retrieved successfully',
      } as ApiResponse<any>);
    } catch (error) {
      console.error('Get document access error:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve document access',
      } as ApiResponse<null>);
    }
  }

  async searchDocuments(req: Request, res: Response): Promise<void> {
    try {
      const { q: query, caseId } = req.query;
      const userId = (req as AuthenticatedRequest).user!.id;

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Search query is required',
        } as ApiResponse<null>);
        return;
      }

      const documents: DocumentResponse[] = await this.documentService.searchDocuments(
        userId, 
        query, 
        caseId as string
      );

      res.json({
        success: true,
        data: documents,
        message: 'Documents searched successfully',
      } as ApiResponse<DocumentResponse[]>);
    } catch (error) {
      console.error('Search documents error:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to search documents',
      } as ApiResponse<null>);
    }
  }

  async getDocumentStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user!.id;

      const stats = await this.documentService.getDocumentStats(userId);

      res.json({
        success: true,
        data: stats,
        message: 'Document statistics retrieved successfully',
      } as ApiResponse<any>);
    } catch (error) {
      console.error('Get document stats error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve document statistics',
      } as ApiResponse<null>);
    }
  }
}