"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const AuthService_1 = require("../services/AuthService");
const UserModel_1 = require("../models/UserModel");
class AuthController {
    static async login(req, res) {
        try {
            const { email, password } = req.body;
            const ipAddress = req.ip;
            const userAgent = req.get('User-Agent');
            const result = await AuthService_1.AuthService.login({ email, password }, ipAddress, userAgent);
            res.json({
                success: true,
                data: result,
                message: 'Login successful',
            });
        }
        catch (error) {
            res.status(401).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async refreshToken(req, res) {
        try {
            const { refreshToken } = req.body;
            const ipAddress = req.ip;
            const userAgent = req.get('User-Agent');
            const result = await AuthService_1.AuthService.refreshToken({ refreshToken }, ipAddress, userAgent);
            res.json({
                success: true,
                data: result,
                message: 'Token refreshed successfully',
            });
        }
        catch (error) {
            res.status(401).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async logout(req, res) {
        try {
            const { refreshToken } = req.body;
            const ipAddress = req.ip;
            const userAgent = req.get('User-Agent');
            await AuthService_1.AuthService.logout(refreshToken, ipAddress, userAgent);
            res.json({
                success: true,
                message: 'Logout successful',
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async logoutAll(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
                return;
            }
            const ipAddress = req.ip;
            const userAgent = req.get('User-Agent');
            const sessionCount = await AuthService_1.AuthService.logoutAll(userId, ipAddress, userAgent);
            res.json({
                success: true,
                data: { revokedSessions: sessionCount },
                message: 'Logged out from all devices successfully',
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async changePassword(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
                return;
            }
            const { currentPassword, newPassword } = req.body;
            const ipAddress = req.ip;
            const userAgent = req.get('User-Agent');
            await AuthService_1.AuthService.changePassword(userId, { currentPassword, newPassword }, ipAddress, userAgent);
            res.json({
                success: true,
                message: 'Password changed successfully',
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async resetPassword(req, res) {
        try {
            const adminUserId = req.user?.userId;
            if (!adminUserId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
                return;
            }
            const { userId, newPassword } = req.body;
            const ipAddress = req.ip;
            const userAgent = req.get('User-Agent');
            await AuthService_1.AuthService.resetPassword(userId, newPassword, adminUserId, ipAddress, userAgent);
            res.json({
                success: true,
                message: 'Password reset successfully',
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async register(req, res) {
        try {
            const data = req.body;
            const ipAddress = req.ip;
            const userAgent = req.get('User-Agent');
            const result = await AuthService_1.AuthService.register(data, ipAddress, userAgent);
            res.status(201).json({
                success: true,
                data: result,
                message: 'Registration successful',
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async createUser(req, res) {
        try {
            const adminUserId = req.user?.userId;
            if (!adminUserId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
                return;
            }
            const data = req.body;
            const ipAddress = req.ip;
            const userAgent = req.get('User-Agent');
            await AuthService_1.AuthService.createUser(data, adminUserId, ipAddress, userAgent);
            res.status(201).json({
                success: true,
                message: 'User created successfully',
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getCurrentUser(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
                return;
            }
            const user = await UserModel_1.UserModel.findById(userId);
            if (!user) {
                res.status(404).json({
                    success: false,
                    error: 'User not found',
                });
                return;
            }
            res.json({
                success: true,
                data: user,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getUserSessions(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
                return;
            }
            const sessions = await AuthService_1.AuthService.getUserSessions(userId);
            res.json({
                success: true,
                data: sessions,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async revokeSession(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
                return;
            }
            const { sessionId } = req.params;
            const success = await AuthService_1.AuthService.revokeSession(sessionId, userId);
            if (!success) {
                res.status(400).json({
                    success: false,
                    error: 'Failed to revoke session',
                });
                return;
            }
            res.json({
                success: true,
                message: 'Session revoked successfully',
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async verifyToken(req, res) {
        try {
            const { token } = req.body;
            const decoded = await AuthService_1.AuthService.verifyAccessToken(token);
            res.json({
                success: true,
                data: decoded,
            });
        }
        catch (error) {
            res.status(401).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async initialize(req, res) {
        try {
            await AuthService_1.AuthService.initialize();
            res.json({
                success: true,
                message: 'Authentication system initialized successfully',
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=AuthController.js.map