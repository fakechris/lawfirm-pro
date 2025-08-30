"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolePermissionService = void 0;
const database_1 = require("../utils/database");
const RoleModel_1 = require("../models/RoleModel");
class RolePermissionService {
    static async createRole(data) {
        return RoleModel_1.RoleModel.create(data);
    }
    static async getAllRoles() {
        return RoleModel_1.RoleModel.findAll();
    }
    static async getRoleById(id) {
        return RoleModel_1.RoleModel.findById(id);
    }
    static async getRoleByName(name) {
        return RoleModel_1.RoleModel.findByName(name);
    }
    static async updateRole(id, data) {
        return RoleModel_1.RoleModel.update(id, data);
    }
    static async deleteRole(id) {
        return RoleModel_1.RoleModel.delete(id);
    }
    static async getSystemRoles() {
        return RoleModel_1.RoleModel.getSystemRoles();
    }
    static async initializeSystemRoles() {
        return RoleModel_1.RoleModel.createSystemRoles();
    }
    static async addPermissionToRole(roleId, permissionId) {
        return RoleModel_1.RoleModel.addPermission(roleId, permissionId);
    }
    static async removePermissionFromRole(roleId, permissionId) {
        return RoleModel_1.RoleModel.removePermission(roleId, permissionId);
    }
    static async getRolePermissions(roleId) {
        return RoleModel_1.RoleModel.getRolePermissions(roleId);
    }
    static async setRolePermissions(roleId, permissionIds) {
        await database_1.prisma.rolePermission.deleteMany({
            where: { roleId },
        });
        if (permissionIds.length > 0) {
            await database_1.prisma.rolePermission.createMany({
                data: permissionIds.map(permissionId => ({
                    roleId,
                    permissionId,
                })),
            });
        }
    }
    static async createPermission(data) {
        return RoleModel_1.PermissionModel.create(data);
    }
    static async getAllPermissions() {
        return RoleModel_1.PermissionModel.findAll();
    }
    static async getPermissionById(id) {
        return RoleModel_1.PermissionModel.findById(id);
    }
    static async getPermissionByName(name) {
        return RoleModel_1.PermissionModel.findByName(name);
    }
    static async updatePermission(id, data) {
        return RoleModel_1.PermissionModel.update(id, data);
    }
    static async deletePermission(id) {
        return RoleModel_1.PermissionModel.delete(id);
    }
    static async getPermissionsByResource(resource) {
        return RoleModel_1.PermissionModel.findByResource(resource);
    }
    static async getAllResources() {
        return RoleModel_1.PermissionModel.getResources();
    }
    static async getAllActions() {
        return RoleModel_1.PermissionModel.getActions();
    }
    static async initializeSystemPermissions() {
        return RoleModel_1.PermissionModel.createSystemPermissions();
    }
    static async getRoleHierarchy() {
        const roles = await RoleModel_1.RoleModel.findAll();
        return roles.sort((a, b) => b.level - a.level);
    }
    static async getRolesByLevel(minLevel, maxLevel) {
        const roles = await database_1.prisma.role.findMany({
            where: {
                level: {
                    gte: minLevel,
                    lte: maxLevel,
                },
            },
            orderBy: { level: 'desc' },
        });
        return roles;
    }
    static async canManageRole(managerRoleId, targetRoleId) {
        const [managerRole, targetRole] = await Promise.all([
            RoleModel_1.RoleModel.findById(managerRoleId),
            RoleModel_1.RoleModel.findById(targetRoleId),
        ]);
        if (!managerRole || !targetRole) {
            return false;
        }
        return managerRole.level > targetRole.level;
    }
    static async getRoleStats() {
        const roles = await database_1.prisma.role.findMany({
            include: {
                _count: {
                    select: {
                        users: true,
                    },
                },
            },
            orderBy: { level: 'desc' },
        });
        return roles.map(role => ({
            role,
            userCount: role._count.users,
        }));
    }
    static async getPermissionStats() {
        const permissions = await database_1.prisma.permission.findMany({
            include: {
                roles: {
                    include: {
                        role: {
                            include: {
                                users: true,
                            },
                        },
                    },
                },
                users: true,
            },
        });
        return permissions.map(permission => {
            const uniqueRoles = new Set(permission.roles.map(rp => rp.role));
            const uniqueUsers = new Set([
                ...permission.users.map(up => up.userId),
                ...permission.roles.flatMap(rp => rp.role.users.map(u => u.userId)),
            ]);
            return {
                permission,
                roleCount: uniqueRoles.size,
                userCount: uniqueUsers.size,
            };
        });
    }
    static async bulkCreateRoles(roles) {
        const createdRoles = await database_1.prisma.role.createMany({
            data: roles,
        });
        return database_1.prisma.role.findMany({
            where: {
                name: {
                    in: roles.map(r => r.name),
                },
            },
        });
    }
    static async bulkCreatePermissions(permissions) {
        const createdPermissions = await database_1.prisma.permission.createMany({
            data: permissions,
        });
        return database_1.prisma.permission.findMany({
            where: {
                name: {
                    in: permissions.map(p => p.name),
                },
            },
        });
    }
    static async cloneRolePermissions(sourceRoleId, targetRoleId) {
        const sourcePermissions = await RoleModel_1.RoleModel.getRolePermissions(sourceRoleId);
        await this.setRolePermissions(targetRoleId, sourcePermissions.map(p => p.id));
    }
    static async getEffectiveRolePermissions(roleId) {
        const role = await RoleModel_1.RoleModel.findById(roleId);
        if (!role)
            return [];
        const directPermissions = await RoleModel_1.RoleModel.getRolePermissions(roleId);
        const inheritedPermissions = [];
        if (role.level > 50) {
            const lowerRoles = await database_1.prisma.role.findMany({
                where: {
                    level: {
                        lt: role.level,
                    },
                },
                include: {
                    permissions: {
                        include: {
                            permission: true,
                        },
                    },
                },
            });
            lowerRoles.forEach(lowerRole => {
                lowerRole.permissions.forEach(rp => {
                    inheritedPermissions.push(rp.permission);
                });
            });
        }
        const allPermissions = [...directPermissions, ...inheritedPermissions];
        const uniquePermissions = allPermissions.filter((permission, index, self) => index === self.findIndex(p => p.id === permission.id));
        return uniquePermissions;
    }
    static async validateRoleStructure() {
        const errors = [];
        try {
            const roles = await database_1.prisma.role.findMany();
            const roleNames = roles.map(r => r.name);
            const duplicateNames = roleNames.filter((name, index) => roleNames.indexOf(name) !== index);
            if (duplicateNames.length > 0) {
                errors.push(`Duplicate role names found: ${duplicateNames.join(', ')}`);
            }
            const permissions = await database_1.prisma.permission.findMany();
            const permissionNames = permissions.map(p => p.name);
            const duplicatePermissionNames = permissionNames.filter((name, index) => permissionNames.indexOf(name) !== index);
            if (duplicatePermissionNames.length > 0) {
                errors.push(`Duplicate permission names found: ${duplicatePermissionNames.join(', ')}`);
            }
            const roleLevels = roles.map(r => r.level);
            const duplicateLevels = roleLevels.filter((level, index) => roleLevels.indexOf(level) !== index);
            if (duplicateLevels.length > 0) {
                errors.push(`Duplicate role levels found: ${duplicateLevels.join(', ')}`);
            }
            const systemRoles = roles.filter(r => r.isSystem);
            const requiredSystemRoles = ['super_admin', 'firm_admin', 'lead_attorney', 'participating_attorney', 'legal_assistant', 'administrative_staff'];
            for (const requiredRole of requiredSystemRoles) {
                if (!systemRoles.find(r => r.name === requiredRole)) {
                    errors.push(`Missing required system role: ${requiredRole}`);
                }
            }
            return {
                valid: errors.length === 0,
                errors,
            };
        }
        catch (error) {
            return {
                valid: false,
                errors: ['Validation failed: ' + error.message],
            };
        }
    }
}
exports.RolePermissionService = RolePermissionService;
//# sourceMappingURL=RolePermissionService.js.map