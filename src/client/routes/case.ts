import { Router } from 'express';
import { CaseController } from '../controllers/case';
import { AuthMiddleware } from '../middleware/auth';
import { AuditMiddleware } from '../middleware/audit';

const router = Router();
const caseController = new CaseController();

// Client-specific case routes
router.get('/', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOnly,
  caseController.getClientCases.bind(caseController)
);

router.get('/dashboard', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOnly,
  caseController.getClientDashboard.bind(caseController)
);

router.get('/stats', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOnly,
  caseController.getCaseStats.bind(caseController)
);

router.get('/:id', 
  AuthMiddleware.authenticate,
  AuthMiddleware.clientOnly,
  caseController.getCaseById.bind(caseController)
);

export default router;