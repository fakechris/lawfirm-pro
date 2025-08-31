import { Router } from 'express';
import { AuditController } from './audit-controller';
import { EnhancedAuditMiddleware } from './enhanced-audit-middleware';
import { requireAuth } from '../../src/middleware/auth';
import { requireRole } from '../../src/middleware/roles';

const router = Router();

// Apply audit logging to all audit routes
router.use(
  EnhancedAuditMiddleware.logAction(
    'AUDIT_API_ACCESS',
    'AUDIT_SYSTEM',
    undefined,
    undefined,
    undefined,
    'INFO',
    'SYSTEM_EVENT',
    ['CSL_ACCESS_CONTROL']
  )
);

// Get audit logs
router.get('/logs', 
  requireAuth,
  requireRole(['ADMIN', 'AUDITOR', 'COMPLIANCE_OFFICER']),
  AuditController.getAuditLogs
);

// Get audit analytics
router.get('/analytics', 
  requireAuth,
  requireRole(['ADMIN', 'AUDITOR', 'COMPLIANCE_OFFICER']),
  AuditController.getAuditAnalytics
);

// Get compliance report
router.get('/compliance/report', 
  requireAuth,
  requireRole(['ADMIN', 'COMPLIANCE_OFFICER']),
  AuditController.getComplianceReport
);

// Get compliance summary
router.get('/compliance/summary', 
  requireAuth,
  requireRole(['ADMIN', 'COMPLIANCE_OFFICER', 'MANAGER']),
  AuditController.getComplianceSummary
);

// Export audit logs
router.get('/export', 
  requireAuth,
  requireRole(['ADMIN', 'AUDITOR', 'COMPLIANCE_OFFICER']),
  AuditController.exportAuditLogs
);

// Get real-time metrics
router.get('/metrics/realtime', 
  requireAuth,
  requireRole(['ADMIN', 'AUDITOR', 'SECURITY_ANALYST']),
  AuditController.getRealTimeMetrics
);

// Detect anomalies
router.get('/anomalies', 
  requireAuth,
  requireRole(['ADMIN', 'AUDITOR', 'SECURITY_ANALYST']),
  AuditController.detectAnomalies
);

// Get audit dashboard
router.get('/dashboard', 
  requireAuth,
  requireRole(['ADMIN', 'AUDITOR', 'COMPLIANCE_OFFICER', 'MANAGER']),
  AuditController.getAuditDashboard
);

// Get user activity report
router.get('/users/:userId/activity', 
  requireAuth,
  requireRole(['ADMIN', 'AUDITOR', 'MANAGER']),
  AuditController.getUserActivityReport
);

// Cleanup old logs
router.post('/cleanup', 
  requireAuth,
  requireRole(['ADMIN']),
  AuditController.cleanupOldLogs
);

// PIPL compliance endpoints
router.get('/pipl/data-access', 
  requireAuth,
  requireRole(['ADMIN', 'COMPLIANCE_OFFICER']),
  async (req, res, next) => {
    try {
      const filter = {
        ...req.query,
        complianceFlags: ['PIPL_DATA_ACCESS'],
        category: ['DATA_ACCESS']
      };
      req.query = filter;
      AuditController.getAuditLogs(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/pipl/consent-records', 
  requireAuth,
  requireRole(['ADMIN', 'COMPLIANCE_OFFICER']),
  async (req, res, next) => {
    try {
      const filter = {
        ...req.query,
        complianceFlags: ['PIPL_CONSENT'],
        category: ['USER_ACTION']
      };
      req.query = filter;
      AuditController.getAuditLogs(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/pipl/cross-border', 
  requireAuth,
  requireRole(['ADMIN', 'COMPLIANCE_OFFICER']),
  async (req, res, next) => {
    try {
      const filter = {
        ...req.query,
        complianceFlags: ['PIPL_CROSS_BORDER'],
        category: ['DATA_MODIFICATION']
      };
      req.query = filter;
      AuditController.getAuditLogs(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// CSL compliance endpoints
router.get('/csl/security-events', 
  requireAuth,
  requireRole(['ADMIN', 'SECURITY_ANALYST', 'COMPLIANCE_OFFICER']),
  async (req, res, next) => {
    try {
      const filter = {
        ...req.query,
        complianceFlags: ['CSL_NETWORK_SECURITY'],
        category: ['SECURITY_EVENT']
      };
      req.query = filter;
      AuditController.getAuditLogs(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/csl/access-control', 
  requireAuth,
  requireRole(['ADMIN', 'AUDITOR', 'COMPLIANCE_OFFICER']),
  async (req, res, next) => {
    try {
      const filter = {
        ...req.query,
        complianceFlags: ['CSL_ACCESS_CONTROL'],
        category: ['USER_ACTION']
      };
      req.query = filter;
      AuditController.getAuditLogs(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// DSL compliance endpoints
router.get('/dsl/data-subject-requests', 
  requireAuth,
  requireRole(['ADMIN', 'COMPLIANCE_OFFICER']),
  async (req, res, next) => {
    try {
      const filter = {
        ...req.query,
        complianceFlags: ['DSL_DATA_SUBJECT'],
        category: ['USER_ACTION']
      };
      req.query = filter;
      AuditController.getAuditLogs(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/dsl/retention', 
  requireAuth,
  requireRole(['ADMIN', 'COMPLIANCE_OFFICER']),
  async (req, res, next) => {
    try {
      const filter = {
        ...req.query,
        complianceFlags: ['DSL_RETENTION'],
        category: ['SYSTEM_EVENT']
      };
      req.query = filter;
      AuditController.getAuditLogs(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// Security event endpoints
router.get('/security/authentication', 
  requireAuth,
  requireRole(['ADMIN', 'SECURITY_ANALYST']),
  async (req, res, next) => {
    try {
      const filter = {
        ...req.query,
        action: 'LOGIN',
        category: ['USER_ACTION']
      };
      req.query = filter;
      AuditController.getAuditLogs(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/security/authorization', 
  requireAuth,
  requireRole(['ADMIN', 'SECURITY_ANALYST']),
  async (req, res, next) => {
    try {
      const filter = {
        ...req.query,
        category: ['SECURITY_EVENT'],
        result: ['FAILURE']
      };
      req.query = filter;
      AuditController.getAuditLogs(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// Data access endpoints
router.get('/data/document-access', 
  requireAuth,
  requireRole(['ADMIN', 'AUDITOR', 'MANAGER']),
  async (req, res, next) => {
    try {
      const filter = {
        ...req.query,
        entityType: 'Document',
        category: ['DATA_ACCESS']
      };
      req.query = filter;
      AuditController.getAuditLogs(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/data/client-access', 
  requireAuth,
  requireRole(['ADMIN', 'AUDITOR', 'MANAGER']),
  async (req, res, next) => {
    try {
      const filter = {
        ...req.query,
        entityType: 'Client',
        category: ['DATA_ACCESS']
      };
      req.query = filter;
      AuditController.getAuditLogs(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// System event endpoints
router.get('/system/backups', 
  requireAuth,
  requireRole(['ADMIN', 'AUDITOR']),
  async (req, res, next) => {
    try {
      const filter = {
        ...req.query,
        action: ['BACKUP_START', 'BACKUP_COMPLETE', 'BACKUP_FAILED'],
        category: ['SYSTEM_EVENT']
      };
      req.query = filter;
      AuditController.getAuditLogs(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/system/configuration', 
  requireAuth,
  requireRole(['ADMIN', 'AUDITOR']),
  async (req, res, next) => {
    try {
      const filter = {
        ...req.query,
        action: 'CONFIGURATION_CHANGE',
        category: ['SYSTEM_EVENT']
      };
      req.query = filter;
      AuditController.getAuditLogs(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

export default router;