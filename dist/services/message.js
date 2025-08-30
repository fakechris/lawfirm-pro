"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageService = void 0;
const tsyringe_1 = require("tsyringe");
const database_1 = require("../utils/database");
const websocket_1 = require("./websocket");
const client_1 = require("@prisma/client");
let MessageService = class MessageService {
    constructor(db, wsService) {
        this.db = db;
        this.wsService = wsService;
    }
    async sendMessage(messageRequest, senderId) {
        const { content, caseId, receiverId } = messageRequest;
        if (!content.trim()) {
            throw new Error('Message content cannot be empty');
        }
        await this.verifyCaseAccess(caseId, senderId);
        const receiver = await this.db.client.user.findUnique({
            where: { id: receiverId },
            include: {
                clientProfile: true,
                attorneyProfile: true,
            },
        });
        if (!receiver) {
            throw new Error('Receiver not found');
        }
        await this.verifyCaseAccess(caseId, receiverId);
        const message = await this.db.client.message.create({
            data: {
                content: content.trim(),
                caseId,
                senderId,
                receiverId,
            },
            include: {
                sender: true,
                receiver: true,
                case: true,
            },
        });
        const messageResponse = this.transformMessageResponse(message);
        this.wsService.broadcastMessage(caseId, messageResponse);
        this.wsService.broadcastToUser(receiverId, {
            type: 'new_message',
            data: messageResponse,
        });
        return messageResponse;
    }
    async getMessagesByCaseId(caseId, userId) {
        await this.verifyCaseAccess(caseId, userId);
        const messages = await this.db.client.message.findMany({
            where: { caseId },
            include: {
                sender: true,
                receiver: true,
            },
            orderBy: { createdAt: 'asc' },
        });
        return messages.map(message => this.transformMessageResponse(message));
    }
    async getMessagesBetweenUsers(user1Id, user2Id, userId) {
        if (userId !== user1Id && userId !== user2Id) {
            throw new Error('Access denied');
        }
        const messages = await this.db.client.message.findMany({
            where: {
                OR: [
                    {
                        senderId: user1Id,
                        receiverId: user2Id,
                    },
                    {
                        senderId: user2Id,
                        receiverId: user1Id,
                    },
                ],
            },
            include: {
                sender: true,
                receiver: true,
                case: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        return messages.reverse().map(message => this.transformMessageResponse(message));
    }
    async getUnreadMessages(userId) {
        const messages = await this.db.client.message.findMany({
            where: {
                receiverId: userId,
                isRead: false,
            },
            include: {
                sender: true,
                receiver: true,
                case: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        return messages.map(message => this.transformMessageResponse(message));
    }
    async markMessageAsRead(messageId, userId) {
        const message = await this.db.client.message.findUnique({
            where: { id: messageId },
        });
        if (!message) {
            throw new Error('Message not found');
        }
        if (message.receiverId !== userId) {
            throw new Error('Access denied');
        }
        if (message.isRead) {
            return this.transformMessageResponse(message);
        }
        const updatedMessage = await this.db.client.message.update({
            where: { id: messageId },
            data: {
                isRead: true,
                readAt: new Date(),
            },
            include: {
                sender: true,
                receiver: true,
                case: true,
            },
        });
        return this.transformMessageResponse(updatedMessage);
    }
    async markAllMessagesAsRead(userId, caseId) {
        const where = {
            receiverId: userId,
            isRead: false,
        };
        if (caseId) {
            where.caseId = caseId;
        }
        await this.db.client.message.updateMany({
            where,
            data: {
                isRead: true,
                readAt: new Date(),
            },
        });
    }
    async deleteMessage(messageId, userId) {
        const message = await this.db.client.message.findUnique({
            where: { id: messageId },
        });
        if (!message) {
            throw new Error('Message not found');
        }
        if (message.senderId !== userId) {
            throw new Error('Access denied');
        }
        await this.db.client.message.delete({
            where: { id: messageId },
        });
    }
    async getMessageStats(userId) {
        const [total, unread, sent, received] = await Promise.all([
            this.db.client.message.count({
                where: {
                    OR: [
                        { senderId: userId },
                        { receiverId: userId },
                    ],
                },
            }),
            this.db.client.message.count({
                where: {
                    receiverId: userId,
                    isRead: false,
                },
            }),
            this.db.client.message.count({
                where: {
                    senderId: userId,
                },
            }),
            this.db.client.message.count({
                where: {
                    receiverId: userId,
                },
            }),
        ]);
        return { total, unread, sent, received };
    }
    async searchMessages(userId, query, caseId) {
        const where = {
            AND: [
                {
                    OR: [
                        { senderId: userId },
                        { receiverId: userId },
                    ],
                },
                {
                    content: {
                        contains: query,
                        mode: 'insensitive',
                    },
                },
            ],
        };
        if (caseId) {
            where.AND.push({ caseId });
        }
        const messages = await this.db.client.message.findMany({
            where,
            include: {
                sender: true,
                receiver: true,
                case: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        return messages.map(message => this.transformMessageResponse(message));
    }
    async verifyCaseAccess(caseId, userId) {
        const user = await this.db.client.user.findUnique({
            where: { id: userId },
            include: {
                clientProfile: true,
                attorneyProfile: true,
            },
        });
        if (!user) {
            throw new Error('User not found');
        }
        let hasAccess = false;
        if (user.role === client_1.UserRole.CLIENT && user.clientProfile) {
            const caseAccess = await this.db.client.case.findFirst({
                where: {
                    id: caseId,
                    clientId: user.clientProfile.id,
                },
            });
            hasAccess = !!caseAccess;
        }
        else if (user.role === client_1.UserRole.ATTORNEY && user.attorneyProfile) {
            const caseAccess = await this.db.client.case.findFirst({
                where: {
                    id: caseId,
                    attorneyId: user.attorneyProfile.id,
                },
            });
            hasAccess = !!caseAccess;
        }
        if (!hasAccess) {
            throw new Error('Access denied to this case');
        }
    }
    transformMessageResponse(message) {
        return {
            id: message.id,
            content: message.content,
            caseId: message.caseId,
            senderId: message.senderId,
            receiverId: message.receiverId,
            isRead: message.isRead,
            createdAt: message.createdAt,
            readAt: message.readAt,
            sender: {
                id: message.sender.id,
                email: message.sender.email,
                firstName: message.sender.firstName,
                lastName: message.sender.lastName,
                role: message.sender.role,
                createdAt: message.sender.createdAt,
                updatedAt: message.sender.updatedAt,
            },
            receiver: {
                id: message.receiver.id,
                email: message.receiver.email,
                firstName: message.receiver.firstName,
                lastName: message.receiver.lastName,
                role: message.receiver.role,
                createdAt: message.receiver.createdAt,
                updatedAt: message.receiver.updatedAt,
            },
        };
    }
};
exports.MessageService = MessageService;
exports.MessageService = MessageService = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(database_1.Database)),
    __param(1, (0, tsyringe_1.inject)(websocket_1.WebSocketService)),
    __metadata("design:paramtypes", [database_1.Database,
        websocket_1.WebSocketService])
], MessageService);
//# sourceMappingURL=message.js.map