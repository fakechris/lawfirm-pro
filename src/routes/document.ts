import { Router } from 'express';
import { DocumentController } from '../controllers/document';
import { AuthMiddleware } from '../middleware/auth';
import { AuditMiddleware } from '../middleware/audit';
import { uploadSingle, handleUploadError } from '../middleware/upload';

const router = Router();
const documentController = new DocumentController();

// Upload document
router.post('/upload', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOrAttorney,
  uploadSingle,
  handleUploadError,
  AuditMiddleware.logUserAction('DOCUMENT_UPLOAD', 'document'),
  documentController.uploadDocument.bind(documentController)
);

// Get documents for a specific case
router.get('/case/:caseId', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOrAttorney,
  documentController.getCaseDocuments.bind(documentController)
);

// Get document by ID
router.get('/:documentId', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOrAttorney,
  documentController.getDocumentById.bind(documentController)
);

// Download document
router.get('/:documentId/download', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOrAttorney,
  AuditMiddleware.logUserAction('DOCUMENT_DOWNLOAD', 'document'),
  documentController.downloadDocument.bind(documentController)
);

// Update document (confidentiality settings)
router.patch('/:documentId', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOrAttorney,
  AuditMiddleware.logDataModification('DOCUMENT_UPDATE', 'document'),
  documentController.updateDocument.bind(documentController)
);

// Delete document
router.delete('/:documentId', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOrAttorney,
  AuditMiddleware.logUserAction('DOCUMENT_DELETE', 'document'),
  documentController.deleteDocument.bind(documentController)
);

// Grant document access
router.post('/:documentId/access/grant', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOrAttorney,
  documentController.grantDocumentAccess.bind(documentController)
);

// Revoke document access
router.post('/:documentId/access/revoke', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOrAttorney,
  documentController.revokeDocumentAccess.bind(documentController)
);

// Get document access list
router.get('/:documentId/access', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOrAttorney,
  documentController.getDocumentAccess.bind(documentController)
);

// Search documents
router.get('/search', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOrAttorney,
  documentController.searchDocuments.bind(documentController)
);

// Get document statistics
router.get('/stats', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOrAttorney,
  documentController.getDocumentStats.bind(documentController)
);

export default router;