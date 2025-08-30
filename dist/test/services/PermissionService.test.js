"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const PermissionService_1 = require("../services/PermissionService");
const UserModel_1 = require("../models/UserModel");
const RolePermissionService_1 = require("../services/RolePermissionService");
describe('PermissionService', () => {
    let testUser;
    let adminUser;
    let testRole;
    let testPermission;
    beforeEach(async () => {
        await RolePermissionService_1.RolePermissionService.initializeSystemRoles();
        await RolePermissionService_1.RolePermissionService.initializeSystemPermissions();
        const userData = {
            email: 'test@example.com',
            username: 'testuser',
            password: 'TestPassword123!',
            firstName: 'Test',
            lastName: 'User',
        };
        const adminData = {
            email: 'admin@example.com',
            username: 'admin',
            password: 'AdminPassword123!',
            firstName: 'Admin',
            lastName: 'User',
        };
        testUser = await UserModel_1.UserModel.create(userData);
        adminUser = await UserModel_1.UserModel.create(adminData);
        const roles = await RolePermissionService_1.RolePermissionService.getAllRoles();
        const permissions = await RolePermissionService_1.RolePermissionService.getAllPermissions();
        testRole = roles.find(r => r.name === 'lead_attorney');
        testPermission = permissions.find(p => p.name === 'users:read');
        if (testRole) {
            await PermissionService_1.PermissionService.addUserRole(testUser.id, testRole.id);
        }
    });
    describe('hasPermission', () => {
        it('should return true for direct permission', async () => {
            if (testPermission) {
                await PermissionService_1.PermissionService.addUserPermission(testUser.id, testPermission.id);
                const hasPermission = await PermissionService_1.PermissionService.hasPermission(testUser.id, 'users:read');
                expect(hasPermission).toBe(true);
            }
        });
        it('should return true for role-based permission', async () => {
            const hasPermission = await PermissionService_1.PermissionService.hasPermission(testUser.id, 'cases:read');
            expect(hasPermission).toBe(true);
        });
        it('should return false for non-existent permission', async () => {
            const hasPermission = await PermissionService_1.PermissionService.hasPermission(testUser.id, 'non:existent');
            expect(hasPermission).toBe(false);
        });
        it('should return false for inactive user', async () => {
            await UserModel_1.UserModel.update(testUser.id, { isActive: false });
            const hasPermission = await PermissionService_1.PermissionService.hasPermission(testUser.id, 'users:read');
            expect(hasPermission).toBe(false);
        });
    });
    describe('hasAnyPermission', () => {
        it('should return true if user has any of the specified permissions', async () => {
            const permissions = ['users:read', 'cases:create', 'non:existent'];
            const hasAnyPermission = await PermissionService_1.PermissionService.hasAnyPermission(testUser.id, permissions);
            expect(hasAnyPermission).toBe(true);
        });
        it('should return false if user has none of the specified permissions', async () => {
            const permissions = ['non:existent1', 'non:existent2'];
            const hasAnyPermission = await PermissionService_1.PermissionService.hasAnyPermission(testUser.id, permissions);
            expect(hasAnyPermission).toBe(false);
        });
    });
    describe('hasAllPermissions', () => {
        it('should return true if user has all specified permissions', async () => {
            const permissions = ['cases:read', 'documents:read'];
            const hasAllPermissions = await PermissionService_1.PermissionService.hasAllPermissions(testUser.id, permissions);
            expect(hasAllPermissions).toBe(true);
        });
        it('should return false if user lacks any specified permission', async () => {
            const permissions = ['cases:read', 'non:existent'];
            const hasAllPermissions = await PermissionService_1.PermissionService.hasAllPermissions(testUser.id, permissions);
            expect(hasAllPermissions).toBe(false);
        });
    });
    describe('getUserPermissions', () => {
        it('should return all user permissions', async () => {
            const permissions = await PermissionService_1.PermissionService.getUserPermissions(testUser.id);
            expect(Array.isArray(permissions)).toBe(true);
            expect(permissions.length).toBeGreaterThan(0);
            expect(permissions.includes('cases:read')).toBe(true);
        });
        it('should return empty array for non-existent user', async () => {
            const permissions = await PermissionService_1.PermissionService.getUserPermissions('non_existent_id');
            expect(permissions).toEqual([]);
        });
    });
    describe('getUserRoles', () => {
        it('should return user roles', async () => {
            const roles = await PermissionService_1.PermissionService.getUserRoles(testUser.id);
            expect(Array.isArray(roles)).toBe(true);
            expect(roles.length).toBeGreaterThan(0);
            expect(roles.includes('lead_attorney')).toBe(true);
        });
        it('should return empty array for user with no roles', async () => {
            const roles = await PermissionService_1.PermissionService.getUserRoles(adminUser.id);
            expect(Array.isArray(roles)).toBe(true);
            expect(roles.length).toBe(0);
        });
    });
    describe('hasRole', () => {
        it('should return true for assigned role', async () => {
            const hasRole = await PermissionService_1.PermissionService.hasRole(testUser.id, 'lead_attorney');
            expect(hasRole).toBe(true);
        });
        it('should return false for unassigned role', async () => {
            const hasRole = await PermissionService_1.PermissionService.hasRole(testUser.id, 'super_admin');
            expect(hasRole).toBe(false);
        });
    });
    describe('hasAnyRole', () => {
        it('should return true if user has any of the specified roles', async () => {
            const roles = ['lead_attorney', 'participating_attorney', 'non_existent'];
            const hasAnyRole = await PermissionService_1.PermissionService.hasAnyRole(testUser.id, roles);
            expect(hasAnyRole).toBe(true);
        });
        it('should return false if user has none of the specified roles', async () => {
            const roles = ['super_admin', 'firm_admin'];
            const hasAnyRole = await PermissionService_1.PermissionService.hasAnyRole(testUser.id, roles);
            expect(hasAnyRole).toBe(false);
        });
    });
    describe('getUserMaxRoleLevel', () => {
        it('should return correct role level', async () => {
            const maxLevel = await PermissionService_1.PermissionService.getUserMaxRoleLevel(testUser.id);
            expect(maxLevel).toBe(80);
        });
        it('should return 0 for user with no roles', async () => {
            const maxLevel = await PermissionService_1.PermissionService.getUserMaxRoleLevel(adminUser.id);
            expect(maxLevel).toBe(0);
        });
    });
    describe('hasRoleLevel', () => {
        it('should return true for users with sufficient role level', async () => {
            const hasLevel = await PermissionService_1.PermissionService.hasRoleLevel(testUser.id, 70);
            expect(hasLevel).toBe(true);
        });
        it('should return false for users with insufficient role level', async () => {
            const hasLevel = await PermissionService_1.PermissionService.hasRoleLevel(testUser.id, 90);
            expect(hasLevel).toBe(false);
        });
    });
    describe('canManageUser', () => {
        it('should return true when manager has higher role level', async () => {
            const lowerUserData = {
                email: 'lower@example.com',
                username: 'loweruser',
                password: 'TestPassword123!',
                firstName: 'Lower',
                lastName: 'User',
            };
            const lowerUser = await UserModel_1.UserModel.create(lowerUserData);
            const assistantRole = (await RolePermissionService_1.RolePermissionService.getAllRoles()).find(r => r.name === 'legal_assistant');
            if (assistantRole) {
                await PermissionService_1.PermissionService.addUserRole(lowerUser.id, assistantRole.id);
            }
            const canManage = await PermissionService_1.PermissionService.canManageUser(testUser.id, lowerUser.id);
            expect(canManage).toBe(true);
        });
        it('should return false when manager has lower or equal role level', async () => {
            const canManage = await PermissionService_1.PermissionService.canManageUser(adminUser.id, testUser.id);
            expect(canManage).toBe(false);
        });
    });
    describe('getAuthContext', () => {
        it('should return complete auth context for active user', async () => {
            const authContext = await PermissionService_1.PermissionService.getAuthContext(testUser.id);
            expect(authContext).toBeDefined();
            expect(authContext.userId).toBe(testUser.id);
            expect(authContext.username).toBe(testUser.username);
            expect(authContext.email).toBe(testUser.email);
            expect(Array.isArray(authContext.roles)).toBe(true);
            expect(Array.isArray(authContext.permissions)).toBe(true);
        });
        it('should return null for non-existent user', async () => {
            const authContext = await PermissionService_1.PermissionService.getAuthContext('non_existent_id');
            expect(authContext).toBeNull();
        });
        it('should return null for inactive user', async () => {
            await UserModel_1.UserModel.update(testUser.id, { isActive: false });
            const authContext = await PermissionService_1.PermissionService.getAuthContext(testUser.id);
            expect(authContext).toBeNull();
        });
    });
    describe('permission management', () => {
        it('should add and remove user permissions', async () => {
            if (testPermission) {
                await PermissionService_1.PermissionService.addUserPermission(testUser.id, testPermission.id);
                let hasPermission = await PermissionService_1.PermissionService.hasPermission(testUser.id, testPermission.name);
                expect(hasPermission).toBe(true);
                await PermissionService_1.PermissionService.removeUserPermission(testUser.id, testPermission.id);
                hasPermission = await PermissionService_1.PermissionService.hasPermission(testUser.id, testPermission.name);
                expect(hasPermission).toBe(false);
            }
        });
        it('should add and remove user roles', async () => {
            const adminRole = (await RolePermissionService_1.RolePermissionService.getAllRoles()).find(r => r.name === 'firm_admin');
            if (adminRole) {
                await PermissionService_1.PermissionService.addUserRole(testUser.id, adminRole.id);
                let hasRole = await PermissionService_1.PermissionService.hasRole(testUser.id, 'firm_admin');
                expect(hasRole).toBe(true);
                await PermissionService_1.PermissionService.removeUserRole(testUser.id, adminRole.id);
                hasRole = await PermissionService_1.PermissionService.hasRole(testUser.id, 'firm_admin');
                expect(hasRole).toBe(false);
            }
        });
        it('should set user roles', async () => {
            const adminRole = (await RolePermissionService_1.RolePermissionService.getAllRoles()).find(r => r.name === 'firm_admin');
            const superAdminRole = (await RolePermissionService_1.RolePermissionService.getAllRoles()).find(r => r.name === 'super_admin');
            if (adminRole && superAdminRole) {
                const roleIds = [adminRole.id, superAdminRole.id];
                await PermissionService_1.PermissionService.setUserRoles(testUser.id, roleIds);
                const hasAdminRole = await PermissionService_1.PermissionService.hasRole(testUser.id, 'firm_admin');
                const hasSuperAdminRole = await PermissionService_1.PermissionService.hasRole(testUser.id, 'super_admin');
                expect(hasAdminRole).toBe(true);
                expect(hasSuperAdminRole).toBe(true);
            }
        });
    });
});
//# sourceMappingURL=PermissionService.test.js.map