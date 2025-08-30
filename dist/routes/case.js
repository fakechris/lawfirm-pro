"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const case_1 = require("../controllers/case");
const auth_1 = require("../middleware/auth");
const audit_1 = require("../middleware/audit");
const router = (0, express_1.Router)();
const caseController = new case_1.CaseController();
router.post('/', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.attorneyOnly, audit_1.AuditMiddleware.logUserAction('CASE_CREATE', 'case'), caseController.createCase.bind(caseController));
router.get('/', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.clientOrAttorney, caseController.getClientCases.bind(caseController));
router.get('/attorney', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.attorneyOnly, caseController.getAttorneyCases.bind(caseController));
router.get('/dashboard', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.clientOnly, caseController.getClientDashboard.bind(caseController));
router.get('/attorney-dashboard', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.attorneyOnly, caseController.getAttorneyDashboard.bind(caseController));
router.get('/stats', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.clientOrAttorney, caseController.getCaseStats.bind(caseController));
router.get('/:id', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.clientOrAttorney, caseController.getCaseById.bind(caseController));
router.patch('/:id/status', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.clientOrAttorney, audit_1.AuditMiddleware.logDataModification('CASE_STATUS_UPDATE', 'case'), caseController.updateCaseStatus.bind(caseController));
router.patch('/:id/phase', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.clientOrAttorney, audit_1.AuditMiddleware.logDataModification('CASE_PHASE_UPDATE', 'case'), caseController.updateCasePhase.bind(caseController));
exports.default = router;
//# sourceMappingURL=case.js.map