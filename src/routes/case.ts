import { Router } from 'express';
import { CaseController } from '../controllers/case';
import { AuthMiddleware } from '../middleware/auth';
import { AuditMiddleware } from '../middleware/audit';

const router = Router();
const caseController = new CaseController();

// Case CRUD operations
router.post('/', 
  AuthMiddleware.authenticate,
  AuthMiddleware.attorneyOnly,
  AuditMiddleware.logUserAction('CASE_CREATE', 'case'),
  caseController.createCase.bind(caseController)
);

router.get('/', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOrAttorney,
  caseController.getClientCases.bind(caseController)
);

router.get('/attorney', 
  AuthMiddleware.authenticate,
  AuthMiddleware.attorneyOnly,
  caseController.getAttorneyCases.bind(caseController)
);

router.get('/dashboard', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOnly,
  caseController.getClientDashboard.bind(caseController)
);

router.get('/attorney-dashboard', 
  AuthMiddleware.authenticate,
  AuthMiddleware.attorneyOnly,
  caseController.getAttorneyDashboard.bind(caseController)
);

router.get('/stats', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOrAttorney,
  caseController.getCaseStats.bind(caseController)
);

router.get('/:id', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOrAttorney,
  caseController.getCaseById.bind(caseController)
);

router.patch('/:id/status', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOrAttorney,
  AuditMiddleware.logDataModification('CASE_STATUS_UPDATE', 'case'),
  caseController.updateCaseStatus.bind(caseController)
);

router.patch('/:id/phase', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOrAttorney,
  AuditMiddleware.logDataModification('CASE_PHASE_UPDATE', 'case'),
  caseController.updateCasePhase.bind(caseController)
);

export default router;