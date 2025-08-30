import { Router } from 'express';
import { AuditLogController } from '../controllers/AuditLogController';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

// All audit routes require authentication
router.use(AuthMiddleware.authenticate);

// Audit log CRUD operations
router.get('/', 
  AuthMiddleware.requirePermission('system:audit'),
  AuditLogController.getAllAuditLogs
);

router.get('/dashboard', 
  AuthMiddleware.requirePermission('system:audit'),
  AuditLogController.getAuditDashboard
);

router.get('/stats/actions', 
  AuthMiddleware.requirePermission('system:audit'),
  AuditLogController.getActionStats
);

router.get('/stats/resources', 
  AuthMiddleware.requirePermission('system:audit'),
  AuditLogController.getResourceStats
);

router.get('/stats/users', 
  AuthMiddleware.requirePermission('system:audit'),
  AuditLogController.getUserStats
);

router.get('/:id', 
  AuthMiddleware.requirePermission('system:audit'),
  AuditLogController.getAuditLogById
);

// User activity
router.get('/users/:userId/activity', 
  AuthMiddleware.requireOwnershipOrPermission('system:audit', (req) => req.params.userId),
  AuditLogController.getUserActivity
);

// Resource activity
router.get('/resources/:resource/activity', 
  AuthMiddleware.requirePermission('system:audit'),
  AuditLogController.getResourceActivity
);

// Cleanup operations
router.post('/cleanup', 
  AuthMiddleware.requirePermission('system:audit'),
  AuditLogController.cleanupAuditLogs
);

export default router;