"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionModel = void 0;
const database_1 = require("../utils/database");
const auth_1 = require("../utils/auth");
class SessionModel {
    static async create(userId) {
        const refreshToken = (0, auth_1.generateRandomString)(64);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        const session = await database_1.prisma.session.create({
            data: {
                userId,
                refreshToken,
                expiresAt,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        isActive: true,
                    },
                },
            },
        });
        return session;
    }
    static async findByRefreshToken(refreshToken) {
        return database_1.prisma.session.findUnique({
            where: { refreshToken },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        isActive: true,
                    },
                },
            },
        });
    }
    static async findById(id) {
        return database_1.prisma.session.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        isActive: true,
                    },
                },
            },
        });
    }
    static async findByUserId(userId) {
        return database_1.prisma.session.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }
    static async delete(id) {
        try {
            await database_1.prisma.session.delete({
                where: { id },
            });
            return true;
        }
        catch (error) {
            return false;
        }
    }
    static async deleteByRefreshToken(refreshToken) {
        try {
            await database_1.prisma.session.delete({
                where: { refreshToken },
            });
            return true;
        }
        catch (error) {
            return false;
        }
    }
    static async deleteByUserId(userId) {
        const result = await database_1.prisma.session.deleteMany({
            where: { userId },
        });
        return result.count;
    }
    static async refresh(sessionId) {
        const session = await database_1.prisma.session.findUnique({
            where: { id: sessionId },
        });
        if (!session) {
            return null;
        }
        if (session.expiresAt < new Date()) {
            await this.delete(sessionId);
            return null;
        }
        const newRefreshToken = (0, auth_1.generateRandomString)(64);
        const newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + 30);
        const updatedSession = await database_1.prisma.session.update({
            where: { id: sessionId },
            data: {
                refreshToken: newRefreshToken,
                expiresAt: newExpiresAt,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        isActive: true,
                    },
                },
            },
        });
        return updatedSession;
    }
    static async cleanup() {
        const result = await database_1.prisma.session.deleteMany({
            where: {
                expiresAt: {
                    lt: new Date(),
                },
            },
        });
        return result.count;
    }
    static async validateSession(refreshToken) {
        const session = await this.findByRefreshToken(refreshToken);
        if (!session) {
            return null;
        }
        if (session.expiresAt < new Date()) {
            await this.deleteByRefreshToken(refreshToken);
            return null;
        }
        if (!session.user.isActive) {
            await this.deleteByRefreshToken(refreshToken);
            return null;
        }
        return session;
    }
    static async getUserActiveSessions(userId) {
        return database_1.prisma.session.findMany({
            where: {
                userId,
                expiresAt: {
                    gt: new Date(),
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    static async revokeAllUserSessions(userId) {
        const result = await database_1.prisma.session.deleteMany({
            where: { userId },
        });
        return result.count;
    }
}
exports.SessionModel = SessionModel;
//# sourceMappingURL=SessionModel.js.map