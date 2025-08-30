import { Router } from 'express';
import { DocumentController } from '../controllers/document';
import { AuthMiddleware } from '../middleware/auth';
import { AuditMiddleware } from '../middleware/audit';
import { uploadSingle, handleUploadError } from '../middleware/upload';

const router = Router();
const documentController = new DocumentController();

// Client-specific document routes
router.post('/upload', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOnly,
  uploadSingle,
  handleUploadError,
  AuditMiddleware.logUserAction('CLIENT_DOCUMENT_UPLOAD', 'client_document'),
  documentController.uploadDocument.bind(documentController)
);

router.get('/case/:caseId', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOnly,
  documentController.getCaseDocuments.bind(documentController)
);

router.get('/:documentId', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOnly,
  documentController.getDocumentById.bind(documentController)
);

router.get('/:documentId/download', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOnly,
  AuditMiddleware.logUserAction('CLIENT_DOCUMENT_DOWNLOAD', 'client_document'),
  documentController.downloadDocument.bind(documentController)
);

router.patch('/:documentId', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOnly,
  AuditMiddleware.logDataModification('CLIENT_DOCUMENT_UPDATE', 'client_document'),
  documentController.updateDocument.bind(documentController)
);

router.delete('/:documentId', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOnly,
  AuditMiddleware.logUserAction('CLIENT_DOCUMENT_DELETE', 'client_document'),
  documentController.deleteDocument.bind(documentController)
);

router.get('/search', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOnly,
  documentController.searchDocuments.bind(documentController)
);

router.get('/stats', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOnly,
  documentController.getDocumentStats.bind(documentController)
);

export default router;