"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = void 0;
const database_1 = require("../utils/database");
const auth_1 = require("../utils/auth");
class UserModel {
    static async create(data) {
        const hashedPassword = await (0, auth_1.hashPassword)(data.password);
        const user = await database_1.prisma.user.create({
            data: {
                email: data.email,
                username: data.username,
                password: hashedPassword,
                firstName: data.firstName,
                lastName: data.lastName,
                phone: data.phone,
                roles: data.roleIds ? {
                    create: data.roleIds.map(roleId => ({
                        roleId,
                    })),
                } : undefined,
            },
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
                profile: true,
            },
        });
        return (0, auth_1.sanitizeUser)(user);
    }
    static async findById(id) {
        const user = await database_1.prisma.user.findUnique({
            where: { id },
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
                profile: true,
            },
        });
        return user ? (0, auth_1.sanitizeUser)(user) : null;
    }
    static async findByEmail(email) {
        const user = await database_1.prisma.user.findUnique({
            where: { email },
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
                profile: true,
            },
        });
        return user ? (0, auth_1.sanitizeUser)(user) : null;
    }
    static async findByUsername(username) {
        const user = await database_1.prisma.user.findUnique({
            where: { username },
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
                profile: true,
            },
        });
        return user ? (0, auth_1.sanitizeUser)(user) : null;
    }
    static async update(id, data) {
        const user = await database_1.prisma.user.update({
            where: { id },
            data: {
                ...(data.email && { email: data.email }),
                ...(data.username && { username: data.username }),
                ...(data.firstName && { firstName: data.firstName }),
                ...(data.lastName && { lastName: data.lastName }),
                ...(data.phone !== undefined && { phone: data.phone }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
            },
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
                profile: true,
            },
        });
        return (0, auth_1.sanitizeUser)(user);
    }
    static async delete(id) {
        try {
            await database_1.prisma.user.delete({
                where: { id },
            });
            return true;
        }
        catch (error) {
            return false;
        }
    }
    static async findAll(page = 1, limit = 10, filters) {
        const skip = (page - 1) * limit;
        const where = {};
        if (filters?.isActive !== undefined) {
            where.isActive = filters.isActive;
        }
        if (filters?.department) {
            where.profile = {
                department: filters.department,
            };
        }
        if (filters?.search) {
            where.OR = [
                { email: { contains: filters.search, mode: 'insensitive' } },
                { username: { contains: filters.search, mode: 'insensitive' } },
                { firstName: { contains: filters.search, mode: 'insensitive' } },
                { lastName: { contains: filters.search, mode: 'insensitive' } },
            ];
        }
        const [users, total] = await Promise.all([
            database_1.prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
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
                    profile: true,
                },
            }),
            database_1.prisma.user.count({ where }),
        ]);
        return {
            users: users.map(auth_1.sanitizeUser),
            total,
        };
    }
    static async updateLastLogin(id) {
        await database_1.prisma.user.update({
            where: { id },
            data: { lastLoginAt: new Date() },
        });
    }
    static async changePassword(id, newPassword) {
        const hashedPassword = await (0, auth_1.hashPassword)(newPassword);
        await database_1.prisma.user.update({
            where: { id },
            data: { password: hashedPassword },
        });
    }
    static async getUserPermissions(userId) {
        const user = await database_1.prisma.user.findUnique({
            where: { id },
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
    static async addRole(userId, roleId) {
        await database_1.prisma.userRole.create({
            data: {
                userId,
                roleId,
            },
        });
    }
    static async removeRole(userId, roleId) {
        await database_1.prisma.userRole.delete({
            where: {
                userId_roleId: {
                    userId,
                    roleId,
                },
            },
        });
    }
    static async addPermission(userId, permissionId) {
        await database_1.prisma.userPermission.create({
            data: {
                userId,
                permissionId,
            },
        });
    }
    static async removePermission(userId, permissionId) {
        await database_1.prisma.userPermission.delete({
            where: {
                userId_permissionId: {
                    userId,
                    permissionId,
                },
            },
        });
    }
}
exports.UserModel = UserModel;
//# sourceMappingURL=UserModel.js.map