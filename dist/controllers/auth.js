"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const tsyringe_1 = require("tsyringe");
const auth_1 = require("../services/auth");
const audit_1 = require("../middleware/audit");
class AuthController {
    constructor() {
        this.authService = tsyringe_1.container.resolve(auth_1.AuthService);
    }
    async login(req, res) {
        try {
            const loginRequest = req.body;
            if (!loginRequest.email || !loginRequest.password) {
                res.status(400).json({
                    success: false,
                    message: 'Email and password are required',
                });
                return;
            }
            const result = await this.authService.login(loginRequest);
            await audit_1.AuditMiddleware.createAuditLog(req, 'USER_LOGIN', 'user', result.user.id, null, { email: result.user.email });
            res.json({
                success: true,
                data: result,
                message: 'Login successful',
            });
        }
        catch (error) {
            console.error('Login error:', error);
            res.status(401).json({
                success: false,
                message: error instanceof Error ? error.message : 'Login failed',
            });
        }
    }
    async register(req, res) {
        try {
            const registerRequest = req.body;
            if (!registerRequest.email || !registerRequest.password ||
                !registerRequest.firstName || !registerRequest.lastName || !registerRequest.role) {
                res.status(400).json({
                    success: false,
                    message: 'All required fields must be provided',
                });
                return;
            }
            const result = await this.authService.register(registerRequest);
            await audit_1.AuditMiddleware.createAuditLog(req, 'USER_REGISTER', 'user', result.user.id, null, {
                email: result.user.email,
                role: result.user.role,
                firstName: result.user.firstName,
                lastName: result.user.lastName
            });
            res.status(201).json({
                success: true,
                data: result,
                message: 'Registration successful',
            });
        }
        catch (error) {
            console.error('Registration error:', error);
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Registration failed',
            });
        }
    }
    async verify(req, res) {
        try {
            const token = req.header('Authorization')?.replace('Bearer ', '');
            if (!token) {
                res.status(401).json({
                    success: false,
                    message: 'No token provided',
                });
                return;
            }
            const user = await this.authService.verifyToken(token);
            res.json({
                success: true,
                data: user,
                message: 'Token verified',
            });
        }
        catch (error) {
            console.error('Token verification error:', error);
            res.status(401).json({
                success: false,
                message: error instanceof Error ? error.message : 'Token verification failed',
            });
        }
    }
    async changePassword(req, res) {
        try {
            const { oldPassword, newPassword } = req.body;
            const userId = req.user.id;
            if (!oldPassword || !newPassword) {
                res.status(400).json({
                    success: false,
                    message: 'Old password and new password are required',
                });
                return;
            }
            await this.authService.changePassword(userId, oldPassword, newPassword);
            await audit_1.AuditMiddleware.createAuditLog(req, 'PASSWORD_CHANGE', 'user', userId, null, { action: 'password_changed' });
            res.json({
                success: true,
                message: 'Password changed successfully',
            });
        }
        catch (error) {
            console.error('Password change error:', error);
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Password change failed',
            });
        }
    }
    async updateProfile(req, res) {
        try {
            const updates = req.body;
            const userId = req.user.id;
            const user = await this.authService.updateProfile(userId, updates);
            await audit_1.AuditMiddleware.createAuditLog(req, 'PROFILE_UPDATE', 'user', userId, null, updates);
            res.json({
                success: true,
                data: user,
                message: 'Profile updated successfully',
            });
        }
        catch (error) {
            console.error('Profile update error:', error);
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Profile update failed',
            });
        }
    }
    async logout(req, res) {
        try {
            const userId = req.user.id;
            await audit_1.AuditMiddleware.createAuditLog(req, 'USER_LOGOUT', 'user', userId, null, { action: 'logout' });
            res.json({
                success: true,
                message: 'Logout successful',
            });
        }
        catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({
                success: false,
                message: 'Logout failed',
            });
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=auth.js.map