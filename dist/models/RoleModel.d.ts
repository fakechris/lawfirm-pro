import { Role, Permission } from '../types';
export declare class RoleModel {
    static create(data: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<Role>;
    static findById(id: string): Promise<Role | null>;
    static findByName(name: string): Promise<Role | null>;
    static findAll(): Promise<Role[]>;
    static update(id: string, data: Partial<Omit<Role, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Role | null>;
    static delete(id: string): Promise<boolean>;
    static addPermission(roleId: string, permissionId: string): Promise<void>;
    static removePermission(roleId: string, permissionId: string): Promise<void>;
    static getRolePermissions(roleId: string): Promise<Permission[]>;
    static getSystemRoles(): Promise<Role[]>;
    static createSystemRoles(): Promise<void>;
}
export declare class PermissionModel {
    static create(data: Omit<Permission, 'id' | 'createdAt' | 'updatedAt'>): Promise<Permission>;
    static findById(id: string): Promise<Permission | null>;
    static findByName(name: string): Promise<Permission | null>;
    static findAll(): Promise<Permission[]>;
    static findByResource(resource: string): Promise<Permission[]>;
    static update(id: string, data: Partial<Omit<Permission, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Permission | null>;
    static delete(id: string): Promise<boolean>;
    static getResources(): Promise<string[]>;
    static getActions(): Promise<string[]>;
    static createSystemPermissions(): Promise<void>;
}
//# sourceMappingURL=RoleModel.d.ts.map