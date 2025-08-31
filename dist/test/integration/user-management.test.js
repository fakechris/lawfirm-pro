"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../app"));
const AuthService_1 = require("../services/AuthService");
const RolePermissionService_1 = require("../services/RolePermissionService");
describe('User Management API Integration Tests', () => {
    let adminToken;
    let userToken;
    let testUserId;
    beforeAll(async () => {
        await AuthService_1.AuthService.initialize();
    });
    describe('Authentication Endpoints', () => {
        it('should register a new user', async () => {
            const userData = {
                email: 'integration@example.com',
                username: 'integration',
                password: 'Integration123!',
                firstName: 'Integration',
                lastName: 'User',
            };
            const response = await (0, supertest_1.default)(app_1.default)
                .post('/api/auth/register')
                .send(userData)
                .expect(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.user.email).toBe(userData.email);
            expect(response.body.data.accessToken).toBeDefined();
            expect(response.body.data.refreshToken).toBeDefined();
            userToken = response.body.data.accessToken;
            testUserId = response.body.data.user.id;
        });
        it('should login with valid credentials', async () => {
            const loginData = {
                email: 'integration@example.com',
                password: 'Integration123!',
            };
            const response = await (0, supertest_1.default)(app_1.default)
                .post('/api/auth/login')
                .send(loginData)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.user.email).toBe(loginData.email);
            expect(response.body.data.accessToken).toBeDefined();
        });
        it('should fail login with invalid credentials', async () => {
            const loginData = {
                email: 'integration@example.com',
                password: 'wrongpassword',
            };
            const response = await (0, supertest_1.default)(app_1.default)
                .post('/api/auth/login')
                .send(loginData)
                .expect(401);
            expect(response.body.success).toBe(false);
        });
        it('should refresh access token', async () => {
            const loginResponse = await (0, supertest_1.default)(app_1.default)
                .post('/api/auth/login')
                .send({
                email: 'integration@example.com',
                password: 'Integration123!',
            });
            const refreshToken = loginResponse.body.data.refreshToken;
            const response = await (0, supertest_1.default)(app_1.default)
                .post('/api/auth/refresh')
                .send({ refreshToken })
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.accessToken).toBeDefined();
        });
        it('should get current user', async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get('/api/auth/current-user')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.email).toBe('integration@example.com');
        });
        it('should require authentication for protected endpoints', async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get('/api/auth/current-user')
                .expect(401);
            expect(response.body.success).toBe(false);
        });
    });
    describe('User Management Endpoints', () => {
        beforeAll(async () => {
            const adminData = {
                email: 'admin@example.com',
                username: 'admin',
                password: 'Admin123!',
                firstName: 'Admin',
                lastName: 'User',
            };
            await (0, supertest_1.default)(app_1.default)
                .post('/api/auth/register')
                .send(adminData);
            const adminResponse = await (0, supertest_1.default)(app_1.default)
                .post('/api/auth/login')
                .send({
                email: 'admin@example.com',
                password: 'Admin123!',
            });
            adminToken = adminResponse.body.data.accessToken;
            const roles = await RolePermissionService_1.RolePermissionService.getAllRoles();
            const adminRole = roles.find(r => r.name === 'super_admin');
            if (adminRole) {
                const { PermissionService } = await Promise.resolve().then(() => __importStar(require('../services/PermissionService')));
                await PermissionService.addUserRole(adminResponse.body.data.user.id, adminRole.id);
            }
        });
        it('should get all users', async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get('/api/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.users).toBeDefined();
            expect(Array.isArray(response.body.data.users)).toBe(true);
        });
        it('should get user by ID', async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get(`/api/users/${testUserId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(testUserId);
        });
        it('should create new user', async () => {
            const userData = {
                email: 'newuser@example.com',
                username: 'newuser',
                password: 'NewUser123!',
                firstName: 'New',
                lastName: 'User',
                phone: '+8613800138000',
            };
            const response = await (0, supertest_1.default)(app_1.default)
                .post('/api/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(userData)
                .expect(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.email).toBe(userData.email);
        });
        it('should update user', async () => {
            const updateData = {
                firstName: 'Updated',
                lastName: 'User',
                phone: '+8613900139000',
            };
            const response = await (0, supertest_1.default)(app_1.default)
                .put(`/api/users/${testUserId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(updateData)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.firstName).toBe(updateData.firstName);
        });
        it('should require permissions for user management', async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get('/api/users')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(403);
            expect(response.body.success).toBe(false);
        });
    });
    describe('Role and Permission Endpoints', () => {
        it('should get all roles', async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get('/api/roles')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(Array.isArray(response.body.data)).toBe(true);
        });
        it('should get all permissions', async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get('/api/permissions')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(Array.isArray(response.body.data)).toBe(true);
        });
        it('should get role hierarchy', async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get('/api/roles/hierarchy')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(Array.isArray(response.body.data)).toBe(true);
        });
    });
    describe('Profile Management Endpoints', () => {
        it('should create user profile', async () => {
            const profileData = {
                title: 'Software Engineer',
                department: 'IT',
                specialization: 'Backend Development',
                licenseNumber: 'LICENSE123',
                yearsOfExperience: 5,
                bio: 'Experienced backend developer',
                address: '123 Tech Street',
                city: 'Shanghai',
                province: 'Shanghai',
                country: 'China',
                postalCode: '200000',
                emergencyContact: 'Jane Doe',
                emergencyPhone: '+8613600136000',
                language: 'zh-CN',
                timezone: 'Asia/Shanghai',
                notifications: {
                    email: true,
                    sms: false,
                },
            };
            const response = await (0, supertest_1.default)(app_1.default)
                .post(`/api/profiles/users/${testUserId}/profile`)
                .set('Authorization', `Bearer ${userToken}`)
                .send(profileData)
                .expect(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.title).toBe(profileData.title);
            expect(response.body.data.department).toBe(profileData.department);
        });
        it('should get user profile', async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get(`/api/profiles/users/${testUserId}/profile`)
                .set('Authorization', `Bearer ${userToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
        });
        it('should update user profile', async () => {
            const updateData = {
                title: 'Senior Software Engineer',
                yearsOfExperience: 6,
            };
            const response = await (0, supertest_1.default)(app_1.default)
                .put(`/api/profiles/users/${testUserId}/profile`)
                .set('Authorization', `Bearer ${userToken}`)
                .send(updateData)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.title).toBe(updateData.title);
            expect(response.body.data.yearsOfExperience).toBe(updateData.yearsOfExperience);
        });
        it('should get user directory', async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get('/api/profiles/directory')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.users).toBeDefined();
            expect(response.body.data.total).toBeDefined();
        });
    });
    describe('Audit Log Endpoints', () => {
        it('should get audit logs', async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get('/api/audit')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.auditLogs).toBeDefined();
            expect(Array.isArray(response.body.data.auditLogs)).toBe(true);
        });
        it('should get audit dashboard', async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get('/api/audit/dashboard')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.actions).toBeDefined();
            expect(response.body.data.resources).toBeDefined();
            expect(response.body.data.users).toBeDefined();
        });
        it('should require audit permissions', async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get('/api/audit')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(403);
            expect(response.body.success).toBe(false);
        });
    });
    describe('Error Handling', () => {
        it('should handle 404 for non-existent routes', async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get('/api/non-existent')
                .expect(404);
            expect(response.body.success).toBe(false);
        });
        it('should handle invalid JSON', async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .post('/api/auth/login')
                .set('Content-Type', 'application/json')
                .send('invalid json')
                .expect(400);
            expect(response.body.success).toBe(false);
        });
        it('should handle validation errors', async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .post('/api/auth/register')
                .send({
                email: 'invalid-email',
                username: '',
                password: 'weak',
            })
                .expect(400);
            expect(response.body.success).toBe(false);
        });
    });
    describe('Health Check', () => {
        it('should return health status', async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get('/health')
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Law Firm Pro API is running');
            expect(response.body.timestamp).toBeDefined();
        });
    });
});
//# sourceMappingURL=user-management.test.js.map