"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionModel = exports.RoleModel = void 0;
const database_1 = require("../utils/database");
class RoleModel {
    static async create(data) {
        const role = await database_1.prisma.role.create({
            data: {
                name: data.name,
                displayName: data.displayName,
                description: data.description,
                isSystem: data.isSystem,
                level: data.level,
            },
        });
        return role;
    }
    static async findById(id) {
        return database_1.prisma.role.findUnique({
            where: { id },
            include: {
                permissions: {
                    include: {
                        permission: true,
                    },
                },
                _count: {
                    select: {
                        users: true,
                    },
                },
            },
        });
    }
    static async findByName(name) {
        return database_1.prisma.role.findUnique({
            where: { name },
            include: {
                permissions: {
                    include: {
                        permission: true,
                    },
                },
                _count: {
                    select: {
                        users: true,
                    },
                },
            },
        });
    }
    static async findAll() {
        return database_1.prisma.role.findMany({
            orderBy: { level: 'asc' },
            include: {
                permissions: {
                    include: {
                        permission: true,
                    },
                },
                _count: {
                    select: {
                        users: true,
                    },
                },
            },
        });
    }
    static async update(id, data) {
        const role = await database_1.prisma.role.update({
            where: { id },
            data: {
                ...(data.displayName !== undefined && { displayName: data.displayName }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.level !== undefined && { level: data.level }),
            },
            include: {
                permissions: {
                    include: {
                        permission: true,
                    },
                },
                _count: {
                    select: {
                        users: true,
                    },
                },
            },
        });
        return role;
    }
    static async delete(id) {
        try {
            await database_1.prisma.role.delete({
                where: { id },
            });
            return true;
        }
        catch (error) {
            return false;
        }
    }
    static async addPermission(roleId, permissionId) {
        await database_1.prisma.rolePermission.create({
            data: {
                roleId,
                permissionId,
            },
        });
    }
    static async removePermission(roleId, permissionId) {
        await database_1.prisma.rolePermission.delete({
            where: {
                roleId_permissionId: {
                    roleId,
                    permissionId,
                },
            },
        });
    }
    static async getRolePermissions(roleId) {
        const rolePermissions = await database_1.prisma.rolePermission.findMany({
            where: { roleId },
            include: {
                permission: true,
            },
        });
        return rolePermissions.map(rp => rp.permission);
    }
    static async getSystemRoles() {
        return database_1.prisma.role.findMany({
            where: { isSystem: true },
            orderBy: { level: 'asc' },
        });
    }
    static async createSystemRoles() {
        const systemRoles = [
            {
                name: 'super_admin',
                displayName: '超级管理员',
                description: '系统超级管理员，拥有所有权限',
                level: 100,
            },
            {
                name: 'firm_admin',
                displayName: '律所管理员',
                description: '律所管理员，管理律所内部事务',
                level: 90,
            },
            {
                name: 'lead_attorney',
                displayName: '主办律师',
                description: '主办律师，负责案件管理和团队领导',
                level: 80,
            },
            {
                name: 'participating_attorney',
                displayName: '参与律师',
                description: '参与律师，协助主办律师处理案件',
                level: 70,
            },
            {
                name: 'legal_assistant',
                displayName: '律师助理',
                description: '律师助理，负责文书和研究工作',
                level: 60,
            },
            {
                name: 'administrative_staff',
                displayName: '行政人员',
                description: '行政人员，负责日常行政工作',
                level: 50,
            },
        ];
        for (const roleData of systemRoles) {
            await database_1.prisma.role.upsert({
                where: { name: roleData.name },
                update: {},
                create: {
                    ...roleData,
                    isSystem: true,
                },
            });
        }
    }
}
exports.RoleModel = RoleModel;
class PermissionModel {
    static async create(data) {
        const permission = await database_1.prisma.permission.create({
            data: {
                name: data.name,
                displayName: data.displayName,
                description: data.description,
                resource: data.resource,
                action: data.action,
                isSystem: data.isSystem,
            },
        });
        return permission;
    }
    static async findById(id) {
        return database_1.prisma.permission.findUnique({
            where: { id },
        });
    }
    static async findByName(name) {
        return database_1.prisma.permission.findUnique({
            where: { name },
        });
    }
    static async findAll() {
        return database_1.prisma.permission.findMany({
            orderBy: [
                { resource: 'asc' },
                { action: 'asc' },
            ],
        });
    }
    static async findByResource(resource) {
        return database_1.prisma.permission.findMany({
            where: { resource },
            orderBy: { action: 'asc' },
        });
    }
    static async update(id, data) {
        const permission = await database_1.prisma.permission.update({
            where: { id },
            data: {
                ...(data.displayName !== undefined && { displayName: data.displayName }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.resource !== undefined && { resource: data.resource }),
                ...(data.action !== undefined && { action: data.action }),
            },
        });
        return permission;
    }
    static async delete(id) {
        try {
            await database_1.prisma.permission.delete({
                where: { id },
            });
            return true;
        }
        catch (error) {
            return false;
        }
    }
    static async getResources() {
        const permissions = await database_1.prisma.permission.findMany({
            select: {
                resource: true,
            },
            distinct: ['resource'],
        });
        return permissions.map(p => p.resource);
    }
    static async getActions() {
        const permissions = await database_1.prisma.permission.findMany({
            select: {
                action: true,
            },
            distinct: ['action'],
        });
        return permissions.map(p => p.action);
    }
    static async createSystemPermissions() {
        const systemPermissions = [
            { name: 'users:create', displayName: '创建用户', resource: 'users', action: 'create' },
            { name: 'users:read', displayName: '查看用户', resource: 'users', action: 'read' },
            { name: 'users:update', displayName: '更新用户', resource: 'users', action: 'update' },
            { name: 'users:delete', displayName: '删除用户', resource: 'users', action: 'delete' },
            { name: 'roles:create', displayName: '创建角色', resource: 'roles', action: 'create' },
            { name: 'roles:read', displayName: '查看角色', resource: 'roles', action: 'read' },
            { name: 'roles:update', displayName: '更新角色', resource: 'roles', action: 'update' },
            { name: 'roles:delete', displayName: '删除角色', resource: 'roles', action: 'delete' },
            { name: 'permissions:create', displayName: '创建权限', resource: 'permissions', action: 'create' },
            { name: 'permissions:read', displayName: '查看权限', resource: 'permissions', action: 'read' },
            { name: 'permissions:update', displayName: '更新权限', resource: 'permissions', action: 'update' },
            { name: 'permissions:delete', displayName: '删除权限', resource: 'permissions', action: 'delete' },
            { name: 'cases:create', displayName: '创建案件', resource: 'cases', action: 'create' },
            { name: 'cases:read', displayName: '查看案件', resource: 'cases', action: 'read' },
            { name: 'cases:update', displayName: '更新案件', resource: 'cases', action: 'update' },
            { name: 'cases:delete', displayName: '删除案件', resource: 'cases', action: 'delete' },
            { name: 'documents:create', displayName: '创建文档', resource: 'documents', action: 'create' },
            { name: 'documents:read', displayName: '查看文档', resource: 'documents', action: 'read' },
            { name: 'documents:update', displayName: '更新文档', resource: 'documents', action: 'update' },
            { name: 'documents:delete', displayName: '删除文档', resource: 'documents', action: 'delete' },
            { name: 'billing:create', displayName: '创建账单', resource: 'billing', action: 'create' },
            { name: 'billing:read', displayName: '查看账单', resource: 'billing', action: 'read' },
            { name: 'billing:update', displayName: '更新账单', resource: 'billing', action: 'update' },
            { name: 'billing:delete', displayName: '删除账单', resource: 'billing', action: 'delete' },
            { name: 'system:configure', displayName: '系统配置', resource: 'system', action: 'configure' },
            { name: 'system:audit', displayName: '审计日志', resource: 'system', action: 'audit' },
            { name: 'system:backup', displayName: '系统备份', resource: 'system', action: 'backup' },
            { name: 'reports:read', displayName: '查看报表', resource: 'reports', action: 'read' },
            { name: 'reports:create', displayName: '创建报表', resource: 'reports', action: 'create' },
            { name: 'reports:export', displayName: '导出报表', resource: 'reports', action: 'export' },
        ];
        for (const permissionData of systemPermissions) {
            await database_1.prisma.permission.upsert({
                where: { name: permissionData.name },
                update: {},
                create: {
                    ...permissionData,
                    isSystem: true,
                },
            });
        }
    }
}
exports.PermissionModel = PermissionModel;
//# sourceMappingURL=RoleModel.js.map