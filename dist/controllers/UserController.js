"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const UserModel_1 = require("../models/UserModel");
const UserProfileService_1 = require("../services/UserProfileService");
const PermissionService_1 = require("../services/PermissionService");
const AuditLogModel_1 = require("../models/AuditLogModel");
class UserController {
    static async getAllUsers(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
            const department = req.query.department;
            const search = req.query.search;
            const result = await UserModel_1.UserModel.findAll(page, limit, {
                isActive,
                department,
                search,
            });
            res.json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getUserById(req, res) {
        try {
            const { id } = req.params;
            const user = await UserModel_1.UserModel.findById(id);
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
            const user = await UserModel_1.UserModel.create(data);
            if (data.profile) {
                await UserProfileService_1.UserProfileService.createProfile(user.id, data.profile, ipAddress, userAgent);
            }
            await AuditLogModel_1.AuditLogModel.create({
                userId: adminUserId,
                action: 'user_create',
                resource: 'users',
                resourceId: user.id,
                metadata: {
                    newUserEmail: user.email,
                    newUsername: user.username,
                    hasProfile: !!data.profile,
                },
                ipAddress,
                userAgent,
            });
            res.status(201).json({
                success: true,
                data: user,
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
    static async updateUser(req, res) {
        try {
            const { id } = req.params;
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
            const user = await UserModel_1.UserModel.update(id, data);
            if (!user) {
                res.status(404).json({
                    success: false,
                    error: 'User not found',
                });
                return;
            }
            await AuditLogModel_1.AuditLogModel.create({
                userId: adminUserId,
                action: 'user_update',
                resource: 'users',
                resourceId: id,
                metadata: {
                    updatedFields: Object.keys(data),
                },
                ipAddress,
                userAgent,
            });
            res.json({
                success: true,
                data: user,
                message: 'User updated successfully',
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async deleteUser(req, res) {
        try {
            const { id } = req.params;
            const adminUserId = req.user?.userId;
            if (!adminUserId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
                return;
            }
            const ipAddress = req.ip;
            const userAgent = req.get('User-Agent');
            const user = await UserModel_1.UserModel.findById(id);
            if (!user) {
                res.status(404).json({
                    success: false,
                    error: 'User not found',
                });
                return;
            }
            const success = await UserModel_1.UserModel.delete(id);
            if (!success) {
                res.status(400).json({
                    success: false,
                    error: 'Failed to delete user',
                });
                return;
            }
            await AuditLogModel_1.AuditLogModel.create({
                userId: adminUserId,
                action: 'user_delete',
                resource: 'users',
                resourceId: id,
                metadata: {
                    deletedUserEmail: user.email,
                    deletedUsername: user.username,
                },
                ipAddress,
                userAgent,
            });
            res.json({
                success: true,
                message: 'User deleted successfully',
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getUserPermissions(req, res) {
        try {
            const { id } = req.params;
            const permissions = await PermissionService_1.PermissionService.getUserPermissions(id);
            res.json({
                success: true,
                data: permissions,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getUserRoles(req, res) {
        try {
            const { id } = req.params;
            const roles = await PermissionService_1.PermissionService.getUserRoles(id);
            res.json({
                success: true,
                data: roles,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async addRoleToUser(req, res) {
        try {
            const { id } = req.params;
            const { roleId } = req.body;
            const adminUserId = req.user?.userId;
            if (!adminUserId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
                return;
            }
            const ipAddress = req.ip;
            const userAgent = req.get('User-Agent');
            await PermissionService_1.PermissionService.addUserRole(id, roleId);
            await AuditLogModel_1.AuditLogModel.create({
                userId: adminUserId,
                action: 'user_role_add',
                resource: 'users',
                resourceId: id,
                metadata: {
                    roleId,
                },
                ipAddress,
                userAgent,
            });
            res.json({
                success: true,
                message: 'Role added to user successfully',
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async removeRoleFromUser(req, res) {
        try {
            const { id } = req.params;
            const { roleId } = req.body;
            const adminUserId = req.user?.userId;
            if (!adminUserId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
                return;
            }
            const ipAddress = req.ip;
            const userAgent = req.get('User-Agent');
            await PermissionService_1.PermissionService.removeUserRole(id, roleId);
            await AuditLogModel_1.AuditLogModel.create({
                userId: adminUserId,
                action: 'user_role_remove',
                resource: 'users',
                resourceId: id,
                metadata: {
                    roleId,
                },
                ipAddress,
                userAgent,
            });
            res.json({
                success: true,
                message: 'Role removed from user successfully',
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async setUserRoles(req, res) {
        try {
            const { id } = req.params;
            const { roleIds } = req.body;
            const adminUserId = req.user?.userId;
            if (!adminUserId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
                return;
            }
            const ipAddress = req.ip;
            const userAgent = req.get('User-Agent');
            await PermissionService_1.PermissionService.setUserRoles(id, roleIds);
            await AuditLogModel_1.AuditLogModel.create({
                userId: adminUserId,
                action: 'user_roles_set',
                resource: 'users',
                resourceId: id,
                metadata: {
                    roleIds,
                },
                ipAddress,
                userAgent,
            });
            res.json({
                success: true,
                message: 'User roles updated successfully',
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async addPermissionToUser(req, res) {
        try {
            const { id } = req.params;
            const { permissionId } = req.body;
            const adminUserId = req.user?.userId;
            if (!adminUserId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
                return;
            }
            const ipAddress = req.ip;
            const userAgent = req.get('User-Agent');
            await PermissionService_1.PermissionService.addUserPermission(id, permissionId);
            await AuditLogModel_1.AuditLogModel.create({
                userId: adminUserId,
                action: 'user_permission_add',
                resource: 'users',
                resourceId: id,
                metadata: {
                    permissionId,
                },
                ipAddress,
                userAgent,
            });
            res.json({
                success: true,
                message: 'Permission added to user successfully',
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async removePermissionFromUser(req, res) {
        try {
            const { id } = req.params;
            const { permissionId } = req.body;
            const adminUserId = req.user?.userId;
            if (!adminUserId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
                return;
            }
            const ipAddress = req.ip;
            const userAgent = req.get('User-Agent');
            await PermissionService_1.PermissionService.removeUserPermission(id, permissionId);
            await AuditLogModel_1.AuditLogModel.create({
                userId: adminUserId,
                action: 'user_permission_remove',
                resource: 'users',
                resourceId: id,
                metadata: {
                    permissionId,
                },
                ipAddress,
                userAgent,
            });
            res.json({
                success: true,
                message: 'Permission removed from user successfully',
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async deactivateUser(req, res) {
        try {
            const { id } = req.params;
            const adminUserId = req.user?.userId;
            if (!adminUserId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
                return;
            }
            const ipAddress = req.ip;
            const userAgent = req.get('User-Agent');
            const user = await UserModel_1.UserModel.update(id, { isActive: false });
            if (!user) {
                res.status(404).json({
                    success: false,
                    error: 'User not found',
                });
                return;
            }
            await AuditLogModel_1.AuditLogModel.create({
                userId: adminUserId,
                action: 'user_deactivate',
                resource: 'users',
                resourceId: id,
                ipAddress,
                userAgent,
            });
            res.json({
                success: true,
                message: 'User deactivated successfully',
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async activateUser(req, res) {
        try {
            const { id } = req.params;
            const adminUserId = req.user?.userId;
            if (!adminUserId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
                return;
            }
            const ipAddress = req.ip;
            const userAgent = req.get('User-Agent');
            const user = await UserModel_1.UserModel.update(id, { isActive: true });
            if (!user) {
                res.status(404).json({
                    success: false,
                    error: 'User not found',
                });
                return;
            }
            await AuditLogModel_1.AuditLogModel.create({
                userId: adminUserId,
                action: 'user_activate',
                resource: 'users',
                resourceId: id,
                ipAddress,
                userAgent,
            });
            res.json({
                success: true,
                message: 'User activated successfully',
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getUserDirectory(req, res) {
        try {
            const { page = 1, limit = 20, search, department, specialization, isActive, sortBy = 'createdAt', sortOrder = 'desc', } = req.query;
            const result = await UserProfileService_1.UserProfileService.getUserDirectory({
                page: parseInt(page),
                limit: parseInt(limit),
                search: search,
                department: department,
                specialization: specialization,
                isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
                sortBy: sortBy,
                sortOrder: sortOrder,
            });
            res.json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getUserStats(req, res) {
        try {
            const [departmentStats, specializationStats] = await Promise.all([
                UserProfileService_1.UserProfileService.getDepartmentStats(),
                UserProfileService_1.UserProfileService.getSpecializationStats(),
            ]);
            res.json({
                success: true,
                data: {
                    departments: departmentStats,
                    specializations: specializationStats,
                },
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
exports.UserController = UserController;
//# sourceMappingURL=UserController.js.map