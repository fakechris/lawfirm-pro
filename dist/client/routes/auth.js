"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../controllers/auth");
const auth_2 = require("../middleware/auth");
const audit_1 = require("../middleware/audit");
const router = (0, express_1.Router)();
const authController = new auth_1.AuthController();
router.post('/login', audit_1.AuditMiddleware.logUserAction('CLIENT_LOGIN', 'client_auth'), authController.login.bind(authController));
router.post('/register', audit_1.AuditMiddleware.logUserAction('CLIENT_REGISTER', 'client_auth'), authController.register.bind(authController));
router.post('/verify', auth_2.AuthMiddleware.authenticate, auth_2.AuthMiddleware.clientOnly, authController.verify.bind(authController));
router.post('/change-password', auth_2.AuthMiddleware.authenticate, auth_2.AuthMiddleware.clientOnly, authController.changePassword.bind(authController));
router.put('/profile', auth_2.AuthMiddleware.authenticate, auth_2.AuthMiddleware.clientOnly, authController.updateProfile.bind(authController));
router.post('/logout', auth_2.AuthMiddleware.authenticate, auth_2.AuthMiddleware.clientOnly, audit_1.AuditMiddleware.logUserAction('CLIENT_LOGOUT', 'client_auth'), authController.logout.bind(authController));
exports.default = router;
//# sourceMappingURL=auth.js.map