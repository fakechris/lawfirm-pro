"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AuthService_1 = require("../services/AuthService");
const UserModel_1 = require("../models/UserModel");
const RolePermissionService_1 = require("../services/RolePermissionService");
describe('AuthService', () => {
    let testUser;
    let testPassword = 'TestPassword123!';
    beforeEach(async () => {
        const userData = {
            email: 'test@example.com',
            username: 'testuser',
            password: testPassword,
            firstName: 'Test',
            lastName: 'User',
        };
        testUser = await UserModel_1.UserModel.create(userData);
    });
    describe('login', () => {
        it('should successfully login with valid credentials', async () => {
            const loginData = {
                email: testUser.email,
                password: testPassword,
            };
            const result = await AuthService_1.AuthService.login(loginData);
            expect(result).toBeDefined();
            expect(result.accessToken).toBeDefined();
            expect(result.refreshToken).toBeDefined();
            expect(result.user).toBeDefined();
            expect(result.user.email).toBe(testUser.email);
            expect(result.permissions).toBeDefined();
            expect(Array.isArray(result.permissions)).toBe(true);
        });
        it('should fail with invalid email', async () => {
            const loginData = {
                email: 'invalid@example.com',
                password: testPassword,
            };
            await expect(AuthService_1.AuthService.login(loginData)).rejects.toThrow('Invalid credentials');
        });
        it('should fail with invalid password', async () => {
            const loginData = {
                email: testUser.email,
                password: 'invalidpassword',
            };
            await expect(AuthService_1.AuthService.login(loginData)).rejects.toThrow('Invalid credentials');
        });
        it('should fail with inactive user', async () => {
            await UserModel_1.UserModel.update(testUser.id, { isActive: false });
            const loginData = {
                email: testUser.email,
                password: testPassword,
            };
            await expect(AuthService_1.AuthService.login(loginData)).rejects.toThrow('Invalid credentials or account deactivated');
        });
    });
    describe('register', () => {
        it('should successfully register new user', async () => {
            const userData = {
                email: 'newuser@example.com',
                username: 'newuser',
                password: 'NewPassword123!',
                firstName: 'New',
                lastName: 'User',
            };
            const result = await AuthService_1.AuthService.register(userData);
            expect(result).toBeDefined();
            expect(result.accessToken).toBeDefined();
            expect(result.refreshToken).toBeDefined();
            expect(result.user).toBeDefined();
            expect(result.user.email).toBe(userData.email);
            expect(result.user.username).toBe(userData.username);
        });
        it('should fail with duplicate email', async () => {
            const userData = {
                email: testUser.email,
                username: 'differentuser',
                password: 'Password123!',
                firstName: 'Different',
                lastName: 'User',
            };
            await expect(AuthService_1.AuthService.register(userData)).rejects.toThrow('User with this email already exists');
        });
        it('should fail with duplicate username', async () => {
            const userData = {
                email: 'different@example.com',
                username: testUser.username,
                password: 'Password123!',
                firstName: 'Different',
                lastName: 'User',
            };
            await expect(AuthService_1.AuthService.register(userData)).rejects.toThrow('Username already taken');
        });
        it('should fail with invalid email format', async () => {
            const userData = {
                email: 'invalid-email',
                username: 'newuser',
                password: 'Password123!',
                firstName: 'New',
                lastName: 'User',
            };
            await expect(AuthService_1.AuthService.register(userData)).rejects.toThrow('Invalid email address');
        });
        it('should fail with weak password', async () => {
            const userData = {
                email: 'newuser@example.com',
                username: 'newuser',
                password: 'weak',
                firstName: 'New',
                lastName: 'User',
            };
            await expect(AuthService_1.AuthService.register(userData)).rejects.toThrow('Password does not meet security requirements');
        });
    });
    describe('changePassword', () => {
        it('should successfully change password', async () => {
            const newPassword = 'NewPassword123!';
            await expect(AuthService_1.AuthService.changePassword(testUser.id, {
                currentPassword: testPassword,
                newPassword,
            })).resolves.not.toThrow();
            await expect(AuthService_1.AuthService.login({
                email: testUser.email,
                password: testPassword,
            })).rejects.toThrow('Invalid credentials');
            await expect(AuthService_1.AuthService.login({
                email: testUser.email,
                password: newPassword,
            })).resolves.toBeDefined();
        });
        it('should fail with incorrect current password', async () => {
            await expect(AuthService_1.AuthService.changePassword(testUser.id, {
                currentPassword: 'wrongpassword',
                newPassword: 'NewPassword123!',
            })).rejects.toThrow('Current password is incorrect');
        });
        it('should fail with weak new password', async () => {
            await expect(AuthService_1.AuthService.changePassword(testUser.id, {
                currentPassword: testPassword,
                newPassword: 'weak',
            })).rejects.toThrow('New password does not meet security requirements');
        });
    });
    describe('refreshToken', () => {
        it('should successfully refresh access token', async () => {
            const loginResult = await AuthService_1.AuthService.login({
                email: testUser.email,
                password: testPassword,
            });
            const refreshResult = await AuthService_1.AuthService.refreshToken({
                refreshToken: loginResult.refreshToken,
            });
            expect(refreshResult).toBeDefined();
            expect(refreshResult.accessToken).toBeDefined();
            expect(refreshResult.refreshToken).toBeDefined();
            expect(refreshResult.user).toBeDefined();
        });
        it('should fail with invalid refresh token', async () => {
            await expect(AuthService_1.AuthService.refreshToken({
                refreshToken: 'invalid_token',
            })).rejects.toThrow('Invalid or expired refresh token');
        });
    });
    describe('initialize', () => {
        it('should initialize system roles and permissions', async () => {
            await expect(AuthService_1.AuthService.initialize()).resolves.not.toThrow();
            const systemRoles = await RolePermissionService_1.RolePermissionService.getSystemRoles();
            expect(systemRoles.length).toBeGreaterThan(0);
            const allPermissions = await RolePermissionService_1.RolePermissionService.getAllPermissions();
            expect(allPermissions.length).toBeGreaterThan(0);
        });
    });
});
//# sourceMappingURL=AuthService.test.js.map