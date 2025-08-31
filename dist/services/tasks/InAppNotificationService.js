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
exports.InAppNotificationService = void 0;
const tsyringe_1 = require("tsyringe");
const database_1 = require("../../utils/database");
const client_1 = require("@prisma/client");
let InAppNotificationService = class InAppNotificationService {
    constructor(db) {
        this.db = db;
    }
    async createNotification(request) {
        const { userId, type, title, message, priority, data, expiresAt } = request;
        const user = await this.db.client.user.findUnique({
            where: { id: userId }
        });
        if (!user) {
            throw new Error('User not found');
        }
        const notification = await this.db.client.notification.create({
            data: {
                userId,
                type,
                title,
                message,
                priority: priority || client_1.NotificationPriority.MEDIUM,
                data: data || {},
                expiresAt
            }
        });
        return this.mapNotificationToResponse(notification);
    }
    async getNotifications(userId, filters) {
        const whereClause = { userId };
        if (filters?.type)
            whereClause.type = filters.type;
        if (filters?.priority)
            whereClause.priority = filters.priority;
        if (filters?.isRead !== undefined)
            whereClause.isRead = filters.isRead;
        if (filters?.expiresOnly)
            whereClause.expiresAt = { not: null };
        if (filters?.fromDate || filters?.toDate) {
            whereClause.createdAt = {};
            if (filters.fromDate)
                whereClause.createdAt.gte = filters.fromDate;
            if (filters.toDate)
                whereClause.createdAt.lte = filters.toDate;
        }
        const notifications = await this.db.client.notification.findMany({
            where: whereClause,
            orderBy: [
                { priority: 'desc' },
                { createdAt: 'desc' }
            ]
        });
        return notifications.map(notification => this.mapNotificationToResponse(notification));
    }
    async getUnreadNotifications(userId, limit) {
        const notifications = await this.db.client.notification.findMany({
            where: {
                userId,
                isRead: false,
                expiresAt: {
                    or: [
                        null,
                        { gte: new Date() }
                    ]
                }
            },
            orderBy: [
                { priority: 'desc' },
                { createdAt: 'desc' }
            ],
            take: limit || 50
        });
        return notifications.map(notification => this.mapNotificationToResponse(notification));
    }
    async getNotificationById(notificationId, userId) {
        const notification = await this.db.client.notification.findFirst({
            where: {
                id: notificationId,
                userId
            }
        });
        if (!notification) {
            throw new Error('Notification not found');
        }
        return this.mapNotificationToResponse(notification);
    }
    async markAsRead(notificationId, userId) {
        const notification = await this.db.client.notification.findFirst({
            where: {
                id: notificationId,
                userId
            }
        });
        if (!notification) {
            throw new Error('Notification not found');
        }
        if (notification.isRead) {
            return this.mapNotificationToResponse(notification);
        }
        const updatedNotification = await this.db.client.notification.update({
            where: { id: notificationId },
            data: { isRead: true }
        });
        return this.mapNotificationToResponse(updatedNotification);
    }
    async markAllAsRead(userId, filters) {
        const whereClause = {
            userId,
            isRead: false
        };
        if (filters?.type)
            whereClause.type = filters.type;
        if (filters?.priority)
            whereClause.priority = filters.priority;
        const result = await this.db.client.notification.updateMany({
            where: whereClause,
            data: { isRead: true }
        });
        return result.count;
    }
    async deleteNotification(notificationId, userId) {
        const notification = await this.db.client.notification.findFirst({
            where: {
                id: notificationId,
                userId
            }
        });
        if (!notification) {
            throw new Error('Notification not found');
        }
        await this.db.client.notification.delete({
            where: { id: notificationId }
        });
    }
    async deleteExpiredNotifications() {
        const result = await this.db.client.notification.deleteMany({
            where: {
                expiresAt: {
                    lt: new Date()
                }
            }
        });
        return result.count;
    }
    async getNotificationStats(userId) {
        const notifications = await this.db.client.notification.findMany({
            where: { userId }
        });
        const stats = {
            total: notifications.length,
            unread: notifications.filter(n => !n.isRead).length,
            read: notifications.filter(n => n.isRead).length,
            expired: notifications.filter(n => n.expiresAt && n.expiresAt < new Date()).length,
            highPriority: notifications.filter(n => n.priority === client_1.NotificationPriority.HIGH).length,
            urgent: notifications.filter(n => n.priority === client_1.NotificationPriority.URGENT).length,
            byType: {}
        };
        Object.values(client_1.NotificationType).forEach(type => {
            stats.byType[type] = notifications.filter(n => n.type === type).length;
        });
        return stats;
    }
    async createBulkNotifications(requests) {
        const notifications = await this.db.client.notification.createMany({
            data: requests.map(request => ({
                userId: request.userId,
                type: request.type,
                title: request.title,
                message: request.message,
                priority: request.priority || client_1.NotificationPriority.MEDIUM,
                data: request.data || {},
                expiresAt: request.expiresAt
            }))
        });
        const createdNotifications = await this.db.client.notification.findMany({
            where: {
                userId: { in: requests.map(r => r.userId) },
                title: { in: requests.map(r => r.title) },
                createdAt: { gte: new Date(Date.now() - 1000) }
            }
        });
        return createdNotifications.map(notification => this.mapNotificationToResponse(notification));
    }
    async getNotificationsByType(userId, type, limit) {
        const notifications = await this.db.client.notification.findMany({
            where: {
                userId,
                type,
                expiresAt: {
                    or: [
                        null,
                        { gte: new Date() }
                    ]
                }
            },
            orderBy: { createdAt: 'desc' },
            take: limit || 20
        });
        return notifications.map(notification => this.mapNotificationToResponse(notification));
    }
    async getHighPriorityNotifications(userId, limit) {
        const notifications = await this.db.client.notification.findMany({
            where: {
                userId,
                priority: {
                    in: [client_1.NotificationPriority.HIGH, client_1.NotificationPriority.URGENT]
                },
                isRead: false,
                expiresAt: {
                    or: [
                        null,
                        { gte: new Date() }
                    ]
                }
            },
            orderBy: [
                { priority: 'desc' },
                { createdAt: 'desc' }
            ],
            take: limit || 10
        });
        return notifications.map(notification => this.mapNotificationToResponse(notification));
    }
    async cleanupOldNotifications(daysToKeep = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        const result = await this.db.client.notification.deleteMany({
            where: {
                createdAt: {
                    lt: cutoffDate
                },
                isRead: true
            }
        });
        return result.count;
    }
    async searchNotifications(userId, query, filters) {
        const whereClause = {
            userId,
            OR: [
                {
                    title: {
                        contains: query,
                        mode: 'insensitive'
                    }
                },
                {
                    message: {
                        contains: query,
                        mode: 'insensitive'
                    }
                }
            ]
        };
        if (filters?.type)
            whereClause.type = filters.type;
        if (filters?.priority)
            whereClause.priority = filters.priority;
        if (filters?.isRead !== undefined)
            whereClause.isRead = filters.isRead;
        const notifications = await this.db.client.notification.findMany({
            where: whereClause,
            orderBy: [
                { priority: 'desc' },
                { createdAt: 'desc' }
            ],
            take: 100
        });
        return notifications.map(notification => this.mapNotificationToResponse(notification));
    }
    async getRecentNotifications(userId, hours = 24) {
        const cutoffDate = new Date();
        cutoffDate.setHours(cutoffDate.getHours() - hours);
        const notifications = await this.db.client.notification.findMany({
            where: {
                userId,
                createdAt: {
                    gte: cutoffDate
                },
                expiresAt: {
                    or: [
                        null,
                        { gte: new Date() }
                    ]
                }
            },
            orderBy: [
                { priority: 'desc' },
                { createdAt: 'desc' }
            ]
        });
        return notifications.map(notification => this.mapNotificationToResponse(notification));
    }
    async updateNotificationPriority(notificationId, userId, newPriority) {
        const notification = await this.db.client.notification.findFirst({
            where: {
                id: notificationId,
                userId
            }
        });
        if (!notification) {
            throw new Error('Notification not found');
        }
        const updatedNotification = await this.db.client.notification.update({
            where: { id: notificationId },
            data: { priority: newPriority }
        });
        return this.mapNotificationToResponse(updatedNotification);
    }
    async extendNotificationExpiry(notificationId, userId, newExpiryDate) {
        const notification = await this.db.client.notification.findFirst({
            where: {
                id: notificationId,
                userId
            }
        });
        if (!notification) {
            throw new Error('Notification not found');
        }
        const updatedNotification = await this.db.client.notification.update({
            where: { id: notificationId },
            data: { expiresAt: newExpiryDate }
        });
        return this.mapNotificationToResponse(updatedNotification);
    }
    mapNotificationToResponse(notification) {
        return {
            id: notification.id,
            userId: notification.userId,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            priority: notification.priority,
            isRead: notification.isRead,
            data: notification.data || undefined,
            expiresAt: notification.expiresAt,
            createdAt: notification.createdAt,
            updatedAt: notification.updatedAt
        };
    }
};
exports.InAppNotificationService = InAppNotificationService;
exports.InAppNotificationService = InAppNotificationService = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(database_1.Database)),
    __metadata("design:paramtypes", [database_1.Database])
], InAppNotificationService);
//# sourceMappingURL=InAppNotificationService.js.map