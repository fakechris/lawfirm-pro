"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AuditLogController_1 = require("../controllers/AuditLogController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.AuthMiddleware.authenticate);
router.get('/', auth_1.AuthMiddleware.requirePermission('system:audit'), AuditLogController_1.AuditLogController.getAllAuditLogs);
router.get('/dashboard', auth_1.AuthMiddleware.requirePermission('system:audit'), AuditLogController_1.AuditLogController.getAuditDashboard);
router.get('/stats/actions', auth_1.AuthMiddleware.requirePermission('system:audit'), AuditLogController_1.AuditLogController.getActionStats);
router.get('/stats/resources', auth_1.AuthMiddleware.requirePermission('system:audit'), AuditLogController_1.AuditLogController.getResourceStats);
router.get('/stats/users', auth_1.AuthMiddleware.requirePermission('system:audit'), AuditLogController_1.AuditLogController.getUserStats);
router.get('/:id', auth_1.AuthMiddleware.requirePermission('system:audit'), AuditLogController_1.AuditLogController.getAuditLogById);
router.get('/users/:userId/activity', auth_1.AuthMiddleware.requireOwnershipOrPermission('system:audit', (req) => req.params.userId), AuditLogController_1.AuditLogController.getUserActivity);
router.get('/resources/:resource/activity', auth_1.AuthMiddleware.requirePermission('system:audit'), AuditLogController_1.AuditLogController.getResourceActivity);
router.post('/cleanup', auth_1.AuthMiddleware.requirePermission('system:audit'), AuditLogController_1.AuditLogController.cleanupAuditLogs);
exports.default = router;
//# sourceMappingURL=audit.js.map