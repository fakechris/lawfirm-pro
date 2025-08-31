"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const message_1 = require("../controllers/message");
const auth_1 = require("../middleware/auth");
const audit_1 = require("../middleware/audit");
const router = (0, express_1.Router)();
const messageController = new message_1.MessageController();
router.post('/', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.clientOnly, audit_1.AuditMiddleware.logUserAction('CLIENT_MESSAGE_SEND', 'client_message'), messageController.sendMessage.bind(messageController));
router.get('/case/:caseId', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.clientOnly, messageController.getCaseMessages.bind(messageController));
router.get('/unread', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.clientOnly, messageController.getUnreadMessages.bind(messageController));
router.post('/:messageId/read', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.clientOnly, messageController.markMessageAsRead.bind(messageController));
router.post('/mark-all-read', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.clientOnly, messageController.markAllMessagesAsRead.bind(messageController));
router.delete('/:messageId', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.clientOnly, audit_1.AuditMiddleware.logUserAction('CLIENT_MESSAGE_DELETE', 'client_message'), messageController.deleteMessage.bind(messageController));
router.get('/stats', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.clientOnly, messageController.getMessageStats.bind(messageController));
router.get('/search', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.clientOnly, messageController.searchMessages.bind(messageController));
exports.default = router;
//# sourceMappingURL=message.js.map