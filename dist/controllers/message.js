"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageController = void 0;
const tsyringe_1 = require("tsyringe");
const message_1 = require("../services/message");
const audit_1 = require("../middleware/audit");
class MessageController {
    constructor() {
        this.messageService = tsyringe_1.container.resolve(message_1.MessageService);
    }
    async sendMessage(req, res) {
        try {
            const userId = req.user.id;
            const messageRequest = req.body;
            if (!messageRequest.content || !messageRequest.caseId || !messageRequest.receiverId) {
                res.status(400).json({
                    success: false,
                    message: 'Content, case ID, and receiver ID are required',
                });
                return;
            }
            const result = await this.messageService.sendMessage(messageRequest, userId);
            await audit_1.AuditMiddleware.createAuditLog(req, 'MESSAGE_SEND', 'message', result.id, null, {
                content: result.content,
                caseId: result.caseId,
                receiverId: result.receiverId
            });
            res.status(201).json({
                success: true,
                data: result,
                message: 'Message sent successfully',
            });
        }
        catch (error) {
            console.error('Send message error:', error);
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to send message',
            });
        }
    }
    async getCaseMessages(req, res) {
        try {
            const { caseId } = req.params;
            const userId = req.user.id;
            const messages = await this.messageService.getMessagesByCaseId(caseId, userId);
            res.json({
                success: true,
                data: messages,
                message: 'Messages retrieved successfully',
            });
        }
        catch (error) {
            console.error('Get case messages error:', error);
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to retrieve messages',
            });
        }
    }
    async getUserMessages(req, res) {
        try {
            const { userId } = req.params;
            const currentUserId = req.user.id;
            const currentUserRole = req.user.role;
            if (userId !== currentUserId && currentUserRole !== 'ADMIN') {
                res.status(403).json({
                    success: false,
                    message: 'Access denied',
                });
                return;
            }
            const messages = await this.messageService.getMessagesBetweenUsers(currentUserId, userId, currentUserId);
            res.json({
                success: true,
                data: messages,
                message: 'Messages retrieved successfully',
            });
        }
        catch (error) {
            console.error('Get user messages error:', error);
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to retrieve messages',
            });
        }
    }
    async getUnreadMessages(req, res) {
        try {
            const userId = req.user.id;
            const messages = await this.messageService.getUnreadMessages(userId);
            res.json({
                success: true,
                data: messages,
                message: 'Unread messages retrieved successfully',
            });
        }
        catch (error) {
            console.error('Get unread messages error:', error);
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to retrieve unread messages',
            });
        }
    }
    async markMessageAsRead(req, res) {
        try {
            const { messageId } = req.params;
            const userId = req.user.id;
            const result = await this.messageService.markMessageAsRead(messageId, userId);
            await audit_1.AuditMiddleware.createAuditLog(req, 'MESSAGE_READ', 'message', messageId, null, { readAt: new Date() });
            res.json({
                success: true,
                data: result,
                message: 'Message marked as read',
            });
        }
        catch (error) {
            console.error('Mark message as read error:', error);
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to mark message as read',
            });
        }
    }
    async markAllMessagesAsRead(req, res) {
        try {
            const userId = req.user.id;
            const { caseId } = req.query;
            await this.messageService.markAllMessagesAsRead(userId, caseId);
            await audit_1.AuditMiddleware.createAuditLog(req, 'MESSAGES_READ_ALL', 'message', undefined, null, { userId, caseId });
            res.json({
                success: true,
                message: 'All messages marked as read',
            });
        }
        catch (error) {
            console.error('Mark all messages as read error:', error);
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to mark all messages as read',
            });
        }
    }
    async deleteMessage(req, res) {
        try {
            const { messageId } = req.params;
            const userId = req.user.id;
            await this.messageService.deleteMessage(messageId, userId);
            await audit_1.AuditMiddleware.createAuditLog(req, 'MESSAGE_DELETE', 'message', messageId, null, { deletedBy: userId });
            res.json({
                success: true,
                message: 'Message deleted successfully',
            });
        }
        catch (error) {
            console.error('Delete message error:', error);
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to delete message',
            });
        }
    }
    async getMessageStats(req, res) {
        try {
            const userId = req.user.id;
            const stats = await this.messageService.getMessageStats(userId);
            res.json({
                success: true,
                data: stats,
                message: 'Message statistics retrieved successfully',
            });
        }
        catch (error) {
            console.error('Get message stats error:', error);
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to retrieve message statistics',
            });
        }
    }
    async searchMessages(req, res) {
        try {
            const { q: query, caseId } = req.query;
            const userId = req.user.id;
            if (!query || typeof query !== 'string') {
                res.status(400).json({
                    success: false,
                    message: 'Search query is required',
                });
                return;
            }
            const messages = await this.messageService.searchMessages(userId, query, caseId);
            res.json({
                success: true,
                data: messages,
                message: 'Messages searched successfully',
            });
        }
        catch (error) {
            console.error('Search messages error:', error);
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to search messages',
            });
        }
    }
}
exports.MessageController = MessageController;
//# sourceMappingURL=message.js.map