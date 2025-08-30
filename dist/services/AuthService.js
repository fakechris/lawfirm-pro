"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const UserModel_1 = require("../models/UserModel");
const SessionModel_1 = require("../models/SessionModel");
const AuditLogModel_1 = require("../models/AuditLogModel");
const PermissionService_1 = require("./PermissionService");
const RolePermissionService_1 = require("./RolePermissionService");
const auth_1 = require("../utils/auth");
class AuthService {
    static async login(data, ipAddress, userAgent) {
        const user = await UserModel_1.UserModel.findByEmail(data.email);
        if (!user || !user.isActive) {
            throw new Error('Invalid credentials or account deactivated');
        }
        const isPasswordValid = await (0, auth_1.comparePassword)(data.password, user.password);
        if (!isPasswordValid) {
            throw new Error('Invalid credentials');
        }
        await UserModel_1.UserModel.updateLastLogin(user.id);
        const session = await SessionModel_1.SessionModel.create(user.id);
        const accessToken = (0, auth_1.generateAccessToken)({
            userId: user.id,
            username: user.username,
            email: user.email,
        });
        const refreshToken = session.refreshToken;
        const permissions = await PermissionService_1.PermissionService.getUserPermissions(user.id);
        await AuditLogModel_1.AuditLogModel.create({
            userId: user.id,
            action: 'login',
            resource: 'auth',
            metadata: {
                method: 'email_password',
            },
            ipAddress,
            userAgent,
        });
        return {
            accessToken,
            refreshToken,
            user,
            permissions,
        };
    }
    static async refreshToken(data, ipAddress, userAgent) {
        const session = await SessionModel_1.SessionModel.validateSession(data.refreshToken);
        if (!session) {
            throw new Error('Invalid or expired refresh token');
        }
        const user = await UserModel_1.UserModel.findById(session.userId);
        if (!user || !user.isActive) {
            throw new Error('User not found or account deactivated');
        }
        const newSession = await SessionModel_1.SessionModel.refresh(session.id);
        if (!newSession) {
            throw new Error('Failed to refresh session');
        }
        const accessToken = (0, auth_1.generateAccessToken)({
            userId: user.id,
            username: user.username,
            email: user.email,
        });
        const refreshToken = newSession.refreshToken;
        const permissions = await PermissionService_1.PermissionService.getUserPermissions(user.id);
        await AuditLogModel_1.AuditLogModel.create({
            userId: user.id,
            action: 'token_refresh',
            resource: 'auth',
            metadata: {
                sessionId: session.id,
            },
            ipAddress,
            userAgent,
        });
        return {
            accessToken,
            refreshToken,
            user,
            permissions,
        };
    }
    static async logout(refreshToken, ipAddress, userAgent) {
        const session = await SessionModel_1.SessionModel.findByRefreshToken(refreshToken);
        if (session) {
            await SessionModel_1.SessionModel.deleteByRefreshToken(refreshToken);
            await AuditLogModel_1.AuditLogModel.create({
                userId: session.userId,
                action: 'logout',
                resource: 'auth',
                metadata: {
                    sessionId: session.id,
                },
                ipAddress,
                userAgent,
            });
        }
    }
    static async logoutAll(userId, ipAddress, userAgent) {
        const sessionCount = await SessionModel_1.SessionModel.revokeAllUserSessions(userId);
        await AuditLogModel_1.AuditLogModel.create({
            userId,
            action: 'logout_all',
            resource: 'auth',
            metadata: {
                revokedSessions: sessionCount,
            },
            ipAddress,
            userAgent,
        });
        return sessionCount;
    }
    static async changePassword(userId, data, ipAddress, userAgent) {
        const user = await UserModel_1.UserModel.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        const isCurrentPasswordValid = await (0, auth_1.comparePassword)(data.currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            throw new Error('Current password is incorrect');
        }
        if (!(0, auth_1.isValidPassword)(data.newPassword)) {
            throw new Error('New password does not meet security requirements');
        }
        await UserModel_1.UserModel.changePassword(userId, data.newPassword);
        await SessionModel_1.SessionModel.revokeAllUserSessions(userId);
        await AuditLogModel_1.AuditLogModel.create({
            userId,
            action: 'password_change',
            resource: 'auth',
            metadata: {
                method: 'user_initiated',
            },
            ipAddress,
            userAgent,
        });
    }
    static async resetPassword(userId, newPassword, adminUserId, ipAddress, userAgent) {
        const user = await UserModel_1.UserModel.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        if (!(0, auth_1.isValidPassword)(newPassword)) {
            throw new Error('New password does not meet security requirements');
        }
        await UserModel_1.UserModel.changePassword(userId, newPassword);
        await SessionModel_1.SessionModel.revokeAllUserSessions(userId);
        await AuditLogModel_1.AuditLogModel.create({
            userId,
            action: 'password_reset',
            resource: 'auth',
            metadata: {
                method: 'admin_initiated',
                adminUserId,
            },
            ipAddress,
            userAgent,
        });
    }
    static async register(data, ipAddress, userAgent) {
        if (!(0, auth_1.isValidEmail)(data.email)) {
            throw new Error('Invalid email address');
        }
        if (!(0, auth_1.isValidPassword)(data.password)) {
            throw new Error('Password does not meet security requirements');
        }
        const existingUser = await UserModel_1.UserModel.findByEmail(data.email);
        if (existingUser) {
            throw new Error('User with this email already exists');
        }
        const existingUsername = await UserModel_1.UserModel.findByUsername(data.username);
        if (existingUsername) {
            throw new Error('Username already taken');
        }
        const user = await UserModel_1.UserModel.create(data);
        const session = await SessionModel_1.SessionModel.create(user.id);
        const accessToken = (0, auth_1.generateAccessToken)({
            userId: user.id,
            username: user.username,
            email: user.email,
        });
        const refreshToken = session.refreshToken;
        const permissions = await PermissionService_1.PermissionService.getUserPermissions(user.id);
        await AuditLogModel_1.AuditLogModel.create({
            userId: user.id,
            action: 'register',
            resource: 'auth',
            metadata: {
                method: 'self_registration',
            },
            ipAddress,
            userAgent,
        });
        return {
            accessToken,
            refreshToken,
            user,
            permissions,
        };
    }
    static async createUser(data, adminUserId, ipAddress, userAgent) {
        if (!(0, auth_1.isValidEmail)(data.email)) {
            throw new Error('Invalid email address');
        }
        if (!(0, auth_1.isValidPassword)(data.password)) {
            throw new Error('Password does not meet security requirements');
        }
        const existingUser = await UserModel_1.UserModel.findByEmail(data.email);
        if (existingUser) {
            throw new Error('User with this email already exists');
        }
        const existingUsername = await UserModel_1.UserModel.findByUsername(data.username);
        if (existingUsername) {
            throw new Error('Username already taken');
        }
        const user = await UserModel_1.UserModel.create(data);
        await AuditLogModel_1.AuditLogModel.create({
            userId: adminUserId,
            action: 'user_create',
            resource: 'users',
            resourceId: user.id,
            metadata: {
                method: 'admin_initiated',
                newUserEmail: user.email,
                newUsername: user.username,
            },
            ipAddress,
            userAgent,
        });
    }
    static async verifyAccessToken(accessToken) {
        try {
            return (0, auth_1.verifyToken)(accessToken);
        }
        catch (error) {
            throw new Error('Invalid access token');
        }
    }
    static async getUserSessions(userId) {
        return SessionModel_1.SessionModel.getUserActiveSessions(userId);
    }
    static async revokeSession(sessionId, userId) {
        const session = await SessionModel_1.SessionModel.findById(sessionId);
        if (!session || session.userId !== userId) {
            throw new Error('Session not found or access denied');
        }
        return SessionModel_1.SessionModel.delete(sessionId);
    }
    static async initialize() {
        await RolePermissionService_1.RolePermissionService.initializeSystemRoles();
        await RolePermissionService_1.RolePermissionService.initializeSystemPermissions();
        await this.assignDefaultPermissions();
    }
    static async assignDefaultPermissions() {
        const allPermissions = await RolePermissionService_1.RolePermissionService.getAllPermissions();
        const systemRoles = await RolePermissionService_1.RolePermissionService.getSystemRoles();
        for (const role of systemRoles) {
            let rolePermissions = [];
            switch (role.name) {
                case 'super_admin':
                    rolePermissions = allPermissions.map(p => p.id);
                    break;
                case 'firm_admin':
                    rolePermissions = allPermissions
                        .filter(p => !p.name.startsWith('system:'))
                        .map(p => p.id);
                    break;
                case 'lead_attorney':
                    rolePermissions = allPermissions
                        .filter(p => p.resource === 'cases' ||
                        p.resource === 'documents' ||
                        p.resource === 'users' ||
                        p.resource === 'reports')
                        .map(p => p.id);
                    break;
                case 'participating_attorney':
                    rolePermissions = allPermissions
                        .filter(p => (p.resource === 'cases' && p.action !== 'delete') ||
                        (p.resource === 'documents' && p.action !== 'delete') ||
                        (p.resource === 'reports' && p.action === 'read'))
                        .map(p => p.id);
                    break;
                case 'legal_assistant':
                    rolePermissions = allPermissions
                        .filter(p => (p.resource === 'cases' && p.action === 'read') ||
                        (p.resource === 'documents' && p.action !== 'delete') ||
                        (p.resource === 'reports' && p.action === 'read'))
                        .map(p => p.id);
                    break;
                case 'administrative_staff':
                    rolePermissions = allPermissions
                        .filter(p => (p.resource === 'cases' && p.action === 'read') ||
                        (p.resource === 'documents' && p.action === 'read'))
                        .map(p => p.id);
                    break;
            }
            await RolePermissionService_1.RolePermissionService.setRolePermissions(role.id, rolePermissions);
        }
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=AuthService.js.map