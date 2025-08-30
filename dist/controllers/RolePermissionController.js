"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionController = exports.RoleController = void 0;
const RolePermissionService_1 = require("../services/RolePermissionService");
const AuditLogModel_1 = require("../models/AuditLogModel");
class RoleController {
    static async getAllRoles(req, res) {
        try {
            const roles = await RolePermissionService_1.RolePermissionService.getAllRoles();
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
    static async getRoleById(req, res) {
        try {
            const { id } = req.params;
            const role = await RolePermissionService_1.RolePermissionService.getRoleById(id);
            if (!role) {
                res.status(404).json({
                    success: false,
                    error: 'Role not found',
                });
                return;
            }
            res.json({
                success: true,
                data: role,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getRoleByName(req, res) {
        try {
            const { name } = req.params;
            const role = await RolePermissionService_1.RolePermissionService.getRoleByName(name);
            if (!role) {
                res.status(404).json({
                    success: false,
                    error: 'Role not found',
                });
                return;
            }
            res.json({
                success: true,
                data: role,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async createRole(req, res) {
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
            const role = await RolePermissionService_1.RolePermissionService.createRole(data);
            await AuditLogModel_1.AuditLogModel.create({
                userId: adminUserId,
                action: 'role_create',
                resource: 'roles',
                resourceId: role.id,
                metadata: {
                    roleName: role.name,
                    roleLevel: role.level,
                },
                ipAddress,
                userAgent,
            });
            res.status(201).json({
                success: true,
                data: role,
                message: 'Role created successfully',
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async updateRole(req, res) {
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
            const role = await RolePermissionService_1.RolePermissionService.updateRole(id, data);
            if (!role) {
                res.status(404).json({
                    success: false,
                    error: 'Role not found',
                });
                return;
            }
            await AuditLogModel_1.AuditLogModel.create({
                userId: adminUserId,
                action: 'role_update',
                resource: 'roles',
                resourceId: id,
                metadata: {
                    updatedFields: Object.keys(data),
                },
                ipAddress,
                userAgent,
            });
            res.json({
                success: true,
                data: role,
                message: 'Role updated successfully',
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async deleteRole(req, res) {
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
            const role = await RolePermissionService_1.RolePermissionService.getRoleById(id);
            if (!role) {
                res.status(404).json({
                    success: false,
                    error: 'Role not found',
                });
                return;
            }
            if (role.isSystem) {
                res.status(400).json({
                    success: false,
                    error: 'Cannot delete system roles',
                });
                return;
            }
            const success = await RolePermissionService_1.RolePermissionService.deleteRole(id);
            if (!success) {
                res.status(400).json({
                    success: false,
                    error: 'Failed to delete role',
                });
                return;
            }
            await AuditLogModel_1.AuditLogModel.create({
                userId: adminUserId,
                action: 'role_delete',
                resource: 'roles',
                resourceId: id,
                metadata: {
                    roleName: role.name,
                    roleLevel: role.level,
                },
                ipAddress,
                userAgent,
            });
            res.json({
                success: true,
                message: 'Role deleted successfully',
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getRolePermissions(req, res) {
        try {
            const { id } = req.params;
            const permissions = await RolePermissionService_1.RolePermissionService.getRolePermissions(id);
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
    static async addPermissionToRole(req, res) {
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
            await RolePermissionService_1.RolePermissionService.addPermissionToRole(id, permissionId);
            await AuditLogModel_1.AuditLogModel.create({
                userId: adminUserId,
                action: 'role_permission_add',
                resource: 'roles',
                resourceId: id,
                metadata: {
                    permissionId,
                },
                ipAddress,
                userAgent,
            });
            res.json({
                success: true,
                message: 'Permission added to role successfully',
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async removePermissionFromRole(req, res) {
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
            await RolePermissionService_1.RolePermissionService.removePermissionFromRole(id, permissionId);
            await AuditLogModel_1.AuditLogModel.create({
                userId: adminUserId,
                action: 'role_permission_remove',
                resource: 'roles',
                resourceId: id,
                metadata: {
                    permissionId,
                },
                ipAddress,
                userAgent,
            });
            res.json({
                success: true,
                message: 'Permission removed from role successfully',
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async setRolePermissions(req, res) {
        try {
            const { id } = req.params;
            const { permissionIds } = req.body;
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
            await RolePermissionService_1.RolePermissionService.setRolePermissions(id, permissionIds);
            await AuditLogModel_1.AuditLogModel.create({
                userId: adminUserId,
                action: 'role_permissions_set',
                resource: 'roles',
                resourceId: id,
                metadata: {
                    permissionIds,
                },
                ipAddress,
                userAgent,
            });
            res.json({
                success: true,
                message: 'Role permissions updated successfully',
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getRoleHierarchy(req, res) {
        try {
            const roles = await RolePermissionService_1.RolePermissionService.getRoleHierarchy();
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
    static async getRoleStats(req, res) {
        try {
            const stats = await RolePermissionService_1.RolePermissionService.getRoleStats();
            res.json({
                success: true,
                data: stats,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async initializeSystemRoles(req, res) {
        try {
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
            await RolePermissionService_1.RolePermissionService.initializeSystemRoles();
            await AuditLogModel_1.AuditLogModel.create({
                userId: adminUserId,
                action: 'system_roles_initialize',
                resource: 'roles',
                metadata: {
                    method: 'admin_initiated',
                },
                ipAddress,
                userAgent,
            });
            res.json({
                success: true,
                message: 'System roles initialized successfully',
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
exports.RoleController = RoleController;
class PermissionController {
    static async getAllPermissions(req, res) {
        try {
            const permissions = await RolePermissionService_1.RolePermissionService.getAllPermissions();
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
    static async getPermissionById(req, res) {
        try {
            const { id } = req.params;
            const permission = await RolePermissionService_1.RolePermissionService.getPermissionById(id);
            if (!permission) {
                res.status(404).json({
                    success: false,
                    error: 'Permission not found',
                });
                return;
            }
            res.json({
                success: true,
                data: permission,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getPermissionByName(req, res) {
        try {
            const { name } = req.params;
            const permission = await RolePermissionService_1.RolePermissionService.getPermissionByName(name);
            if (!permission) {
                res.status(404).json({
                    success: false,
                    error: 'Permission not found',
                });
                return;
            }
            res.json({
                success: true,
                data: permission,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getPermissionsByResource(req, res) {
        try {
            const { resource } = req.params;
            const permissions = await RolePermissionService_1.RolePermissionService.getPermissionsByResource(resource);
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
    static async createPermission(req, res) {
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
            const permission = await RolePermissionService_1.RolePermissionService.createPermission(data);
            await AuditLogModel_1.AuditLogModel.create({
                userId: adminUserId,
                action: 'permission_create',
                resource: 'permissions',
                resourceId: permission.id,
                metadata: {
                    permissionName: permission.name,
                    resource: permission.resource,
                    action: permission.action,
                },
                ipAddress,
                userAgent,
            });
            res.status(201).json({
                success: true,
                data: permission,
                message: 'Permission created successfully',
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async updatePermission(req, res) {
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
            const permission = await RolePermissionService_1.RolePermissionService.updatePermission(id, data);
            if (!permission) {
                res.status(404).json({
                    success: false,
                    error: 'Permission not found',
                });
                return;
            }
            await AuditLogModel_1.AuditLogModel.create({
                userId: adminUserId,
                action: 'permission_update',
                resource: 'permissions',
                resourceId: id,
                metadata: {
                    updatedFields: Object.keys(data),
                },
                ipAddress,
                userAgent,
            });
            res.json({
                success: true,
                data: permission,
                message: 'Permission updated successfully',
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async deletePermission(req, res) {
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
            const permission = await RolePermissionService_1.RolePermissionService.getPermissionById(id);
            if (!permission) {
                res.status(404).json({
                    success: false,
                    error: 'Permission not found',
                });
                return;
            }
            if (permission.isSystem) {
                res.status(400).json({
                    success: false,
                    error: 'Cannot delete system permissions',
                });
                return;
            }
            const success = await RolePermissionService_1.RolePermissionService.deletePermission(id);
            if (!success) {
                res.status(400).json({
                    success: false,
                    error: 'Failed to delete permission',
                });
                return;
            }
            await AuditLogModel_1.AuditLogModel.create({
                userId: adminUserId,
                action: 'permission_delete',
                resource: 'permissions',
                resourceId: id,
                metadata: {
                    permissionName: permission.name,
                    resource: permission.resource,
                    action: permission.action,
                },
                ipAddress,
                userAgent,
            });
            res.json({
                success: true,
                message: 'Permission deleted successfully',
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getAllResources(req, res) {
        try {
            const resources = await RolePermissionService_1.RolePermissionService.getAllResources();
            res.json({
                success: true,
                data: resources,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getAllActions(req, res) {
        try {
            const actions = await RolePermissionService_1.RolePermissionService.getAllActions();
            res.json({
                success: true,
                data: actions,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getPermissionStats(req, res) {
        try {
            const stats = await RolePermissionService_1.RolePermissionService.getPermissionStats();
            res.json({
                success: true,
                data: stats,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async initializeSystemPermissions(req, res) {
        try {
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
            await RolePermissionService_1.RolePermissionService.initializeSystemPermissions();
            await AuditLogModel_1.AuditLogModel.create({
                userId: adminUserId,
                action: 'system_permissions_initialize',
                resource: 'permissions',
                metadata: {
                    method: 'admin_initiated',
                },
                ipAddress,
                userAgent,
            });
            res.json({
                success: true,
                message: 'System permissions initialized successfully',
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async validateRoleStructure(req, res) {
        try {
            const validation = await RolePermissionService_1.RolePermissionService.validateRoleStructure();
            res.json({
                success: true,
                data: validation,
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
exports.PermissionController = PermissionController;
//# sourceMappingURL=RolePermissionController.js.map