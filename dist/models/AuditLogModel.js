"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogModel = void 0;
const database_1 = require("../utils/database");
class AuditLogModel {
    static async create(data) {
        const auditLog = await database_1.prisma.auditLog.create({
            data: {
                userId: data.userId,
                action: data.action,
                resource: data.resource,
                resourceId: data.resourceId,
                metadata: data.metadata,
                ipAddress: data.ipAddress,
                userAgent: data.userAgent,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });
        return auditLog;
    }
    static async findById(id) {
        return database_1.prisma.auditLog.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });
    }
    static async findAll(page = 1, limit = 10, filters) {
        const skip = (page - 1) * limit;
        const where = {};
        if (filters?.userId) {
            where.userId = filters.userId;
        }
        if (filters?.action) {
            where.action = { contains: filters.action, mode: 'insensitive' };
        }
        if (filters?.resource) {
            where.resource = { contains: filters.resource, mode: 'insensitive' };
        }
        if (filters?.resourceId) {
            where.resourceId = filters.resourceId;
        }
        if (filters?.startDate || filters?.endDate) {
            where.createdAt = {};
            if (filters.startDate) {
                where.createdAt.gte = filters.startDate;
            }
            if (filters.endDate) {
                where.createdAt.lte = filters.endDate;
            }
        }
        const [auditLogs, total] = await Promise.all([
            database_1.prisma.auditLog.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
            }),
            database_1.prisma.auditLog.count({ where }),
        ]);
        return {
            auditLogs,
            total,
        };
    }
    static async getUserActivity(userId, limit = 50) {
        return database_1.prisma.auditLog.findMany({
            where: { userId },
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });
    }
    static async getResourceActivity(resource, resourceId, limit = 50) {
        return database_1.prisma.auditLog.findMany({
            where: { resource, resourceId },
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });
    }
    static async getActionStats(startDate, endDate) {
        const where = {};
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = startDate;
            if (endDate)
                where.createdAt.lte = endDate;
        }
        const stats = await database_1.prisma.auditLog.groupBy({
            by: ['action'],
            where,
            _count: {
                action: true,
            },
            orderBy: {
                _count: {
                    action: 'desc',
                },
            },
        });
        return stats.map(stat => ({
            action: stat.action,
            count: stat._count.action,
        }));
    }
    static async getResourceStats(startDate, endDate) {
        const where = {};
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = startDate;
            if (endDate)
                where.createdAt.lte = endDate;
        }
        const stats = await database_1.prisma.auditLog.groupBy({
            by: ['resource'],
            where,
            _count: {
                resource: true,
            },
            orderBy: {
                _count: {
                    resource: 'desc',
                },
            },
        });
        return stats.map(stat => ({
            resource: stat.resource,
            count: stat._count.resource,
        }));
    }
    static async getUserStats(startDate, endDate) {
        const where = {};
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = startDate;
            if (endDate)
                where.createdAt.lte = endDate;
        }
        const stats = await database_1.prisma.auditLog.groupBy({
            by: ['userId'],
            where,
            _count: {
                userId: true,
            },
            orderBy: {
                _count: {
                    userId: 'desc',
                },
            },
            take: 10,
        });
        const userIds = stats.map(stat => stat.userId);
        const users = await database_1.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
                id: true,
                username: true,
                email: true,
            },
        });
        const userMap = new Map(users.map(user => [user.id, user]));
        return stats.map(stat => ({
            user: userMap.get(stat.userId) || { id: stat.userId, username: 'Unknown', email: '' },
            count: stat._count.userId,
        }));
    }
    static async cleanup(olderThanDays = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
        const result = await database_1.prisma.auditLog.deleteMany({
            where: {
                createdAt: {
                    lt: cutoffDate,
                },
            },
        });
        return result.count;
    }
}
exports.AuditLogModel = AuditLogModel;
//# sourceMappingURL=AuditLogModel.js.map