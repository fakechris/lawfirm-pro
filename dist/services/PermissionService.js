"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionService = void 0;
const database_1 = require("../utils/database");
class PermissionService {
    static async hasPermission(userId, permission) {
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
            include: {
                roles: {
                    include: {
                        role: {
                            include: {
                                permissions: {
                                    include: {
                                        permission: true,
                                    },
                                },
                            },
                        },
                    },
                },
                permissions: {
                    include: {
                        permission: true,
                    },
                },
            },
        });
        if (!user || !user.isActive) {
            return false;
        }
        const userPermissions = user.permissions.map(up => up.permission.name);
        if (userPermissions.includes(permission)) {
            return true;
        }
        const rolePermissions = user.roles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.name));
        return rolePermissions.includes(permission);
    }
    static async hasAnyPermission(userId, permissions) {
        for (const permission of permissions) {
            if (await this.hasPermission(userId, permission)) {
                return true;
            }
        }
        return false;
    }
    static async hasAllPermissions(userId, permissions) {
        for (const permission of permissions) {
            if (!(await this.hasPermission(userId, permission))) {
                return false;
            }
        }
        return true;
    }
    static async getUserPermissions(userId) {
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
            include: {
                roles: {
                    include: {
                        role: {
                            include: {
                                permissions: {
                                    include: {
                                        permission: true,
                                    },
                                },
                            },
                        },
                    },
                },
                permissions: {
                    include: {
                        permission: true,
                    },
                },
            },
        });
        if (!user)
            return [];
        const rolePermissions = user.roles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.name));
        const userPermissions = user.permissions.map(up => up.permission.name);
        return [...new Set([...rolePermissions, ...userPermissions])];
    }
    static async getUserRoles(userId) {
        const userRoles = await database_1.prisma.userRole.findMany({
            where: { userId },
            include: {
                role: true,
            },
        });
        return userRoles.map(ur => ur.role.name);
    }
    static async hasRole(userId, roleName) {
        const userRole = await database_1.prisma.userRole.findFirst({
            where: {
                userId,
                role: {
                    name: roleName,
                },
            },
        });
        return !!userRole;
    }
    static async hasAnyRole(userId, roleNames) {
        const userRoles = await database_1.prisma.userRole.findMany({
            where: {
                userId,
                role: {
                    name: {
                        in: roleNames,
                    },
                },
            },
        });
        return userRoles.length > 0;
    }
    static async getUserMaxRoleLevel(userId) {
        const userRoles = await database_1.prisma.userRole.findMany({
            where: { userId },
            include: {
                role: true,
            },
        });
        if (userRoles.length === 0) {
            return 0;
        }
        return Math.max(...userRoles.map(ur => ur.role.level));
    }
    static async hasRoleLevel(userId, minLevel) {
        const maxLevel = await this.getUserMaxRoleLevel(userId);
        return maxLevel >= minLevel;
    }
    static async canManageUser(managerUserId, targetUserId) {
        const managerLevel = await this.getUserMaxRoleLevel(managerUserId);
        const targetLevel = await this.getUserMaxRoleLevel(targetUserId);
        return managerLevel > targetLevel;
    }
    static async getAuthContext(userId) {
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
            include: {
                roles: {
                    include: {
                        role: true,
                    },
                },
            },
        });
        if (!user || !user.isActive) {
            return null;
        }
        const [permissions, roles] = await Promise.all([
            this.getUserPermissions(userId),
            this.getUserRoles(userId),
        ]);
        return {
            userId: user.id,
            username: user.username,
            email: user.email,
            roles,
            permissions,
        };
    }
    static async addUserPermission(userId, permissionId) {
        await database_1.prisma.userPermission.create({
            data: {
                userId,
                permissionId,
            },
        });
    }
    static async removeUserPermission(userId, permissionId) {
        await database_1.prisma.userPermission.delete({
            where: {
                userId_permissionId: {
                    userId,
                    permissionId,
                },
            },
        });
    }
    static async addUserRole(userId, roleId) {
        await database_1.prisma.userRole.create({
            data: {
                userId,
                roleId,
            },
        });
    }
    static async removeUserRole(userId, roleId) {
        await database_1.prisma.userRole.delete({
            where: {
                userId_roleId: {
                    userId,
                    roleId,
                },
            },
        });
    }
    static async setUserRoles(userId, roleIds) {
        await database_1.prisma.userRole.deleteMany({
            where: { userId },
        });
        if (roleIds.length > 0) {
            await database_1.prisma.userRole.createMany({
                data: roleIds.map(roleId => ({
                    userId,
                    roleId,
                })),
            });
        }
    }
    static async setUserPermissions(userId, permissionIds) {
        await database_1.prisma.userPermission.deleteMany({
            where: { userId },
        });
        if (permissionIds.length > 0) {
            await database_1.prisma.userPermission.createMany({
                data: permissionIds.map(permissionId => ({
                    userId,
                    permissionId,
                })),
            });
        }
    }
    static async getUsersWithPermission(permission) {
        const permissionRecord = await database_1.prisma.permission.findUnique({
            where: { name: permission },
        });
        if (!permissionRecord) {
            return [];
        }
        const directUsers = await database_1.prisma.userPermission.findMany({
            where: { permissionId: permissionRecord.id },
            select: { userId: true },
        });
        const roleUsers = await database_1.prisma.rolePermission.findMany({
            where: { permissionId: permissionRecord.id },
            include: {
                role: {
                    include: {
                        users: {
                            select: { userId: true },
                        },
                    },
                },
            },
        });
        const roleUserIds = roleUsers.flatMap(rp => rp.role.users.map(ru => ru.userId));
        return [...new Set([...directUsers.map(du => du.userId), ...roleUserIds])];
    }
    static async getUsersWithRole(roleName) {
        const role = await database_1.prisma.role.findUnique({
            where: { name: roleName },
        });
        if (!role) {
            return [];
        }
        const userRoles = await database_1.prisma.userRole.findMany({
            where: { roleId: role.id },
            select: { userId: true },
        });
        return userRoles.map(ur => ur.userId);
    }
}
exports.PermissionService = PermissionService;
//# sourceMappingURL=PermissionService.js.map