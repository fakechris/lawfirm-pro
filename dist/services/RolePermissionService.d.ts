import { Role, Permission } from '../types';
export declare class RolePermissionService {
    static createRole(data: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<Role>;
    static getAllRoles(): Promise<Role[]>;
    static getRoleById(id: string): Promise<Role | null>;
    static getRoleByName(name: string): Promise<Role | null>;
    static updateRole(id: string, data: Partial<Omit<Role, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Role | null>;
    static deleteRole(id: string): Promise<boolean>;
    static getSystemRoles(): Promise<Role[]>;
    static initializeSystemRoles(): Promise<void>;
    static addPermissionToRole(roleId: string, permissionId: string): Promise<void>;
    static removePermissionFromRole(roleId: string, permissionId: string): Promise<void>;
    static getRolePermissions(roleId: string): Promise<Permission[]>;
    static setRolePermissions(roleId: string, permissionIds: string[]): Promise<void>;
    static createPermission(data: Omit<Permission, 'id' | 'createdAt' | 'updatedAt'>): Promise<Permission>;
    static getAllPermissions(): Promise<Permission[]>;
    static getPermissionById(id: string): Promise<Permission | null>;
    static getPermissionByName(name: string): Promise<Permission | null>;
    static updatePermission(id: string, data: Partial<Omit<Permission, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Permission | null>;
    static deletePermission(id: string): Promise<boolean>;
    static getPermissionsByResource(resource: string): Promise<Permission[]>;
    static getAllResources(): Promise<string[]>;
    static getAllActions(): Promise<string[]>;
    static initializeSystemPermissions(): Promise<void>;
    static getRoleHierarchy(): Promise<Role[]>;
    static getRolesByLevel(minLevel: number, maxLevel: number): Promise<Role[]>;
    static canManageRole(managerRoleId: string, targetRoleId: string): Promise<boolean>;
    static getRoleStats(): Promise<{
        role: Role;
        userCount: number;
    }[]>;
    static getPermissionStats(): Promise<{
        permission: Permission;
        roleCount: number;
        userCount: number;
    }[]>;
    static bulkCreateRoles(roles: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Role[]>;
    static bulkCreatePermissions(permissions: Omit<Permission, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Permission[]>;
    static cloneRolePermissions(sourceRoleId: string, targetRoleId: string): Promise<void>;
    static getEffectiveRolePermissions(roleId: string): Promise<Permission[]>;
    static validateRoleStructure(): Promise<{
        valid: boolean;
        errors: string[];
    }>;
}
//# sourceMappingURL=RolePermissionService.d.ts.map