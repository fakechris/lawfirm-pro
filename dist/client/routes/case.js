"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const case_1 = require("../controllers/case");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const caseController = new case_1.CaseController();
router.get('/', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.clientOnly, caseController.getClientCases.bind(caseController));
router.get('/dashboard', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.clientOnly, caseController.getClientDashboard.bind(caseController));
router.get('/stats', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.clientOnly, caseController.getCaseStats.bind(caseController));
router.get('/:id', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.clientOnly, caseController.getCaseById.bind(caseController));
exports.default = router;
//# sourceMappingURL=case.js.map