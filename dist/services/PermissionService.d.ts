import { AuthContext } from '../types';
export declare class PermissionService {
    static hasPermission(userId: string, permission: string): Promise<boolean>;
    static hasAnyPermission(userId: string, permissions: string[]): Promise<boolean>;
    static hasAllPermissions(userId: string, permissions: string[]): Promise<boolean>;
    static getUserPermissions(userId: string): Promise<string[]>;
    static getUserRoles(userId: string): Promise<string[]>;
    static hasRole(userId: string, roleName: string): Promise<boolean>;
    static hasAnyRole(userId: string, roleNames: string[]): Promise<boolean>;
    static getUserMaxRoleLevel(userId: string): Promise<number>;
    static hasRoleLevel(userId: string, minLevel: number): Promise<boolean>;
    static canManageUser(managerUserId: string, targetUserId: string): Promise<boolean>;
    static getAuthContext(userId: string): Promise<AuthContext | null>;
    static addUserPermission(userId: string, permissionId: string): Promise<void>;
    static removeUserPermission(userId: string, permissionId: string): Promise<void>;
    static addUserRole(userId: string, roleId: string): Promise<void>;
    static removeUserRole(userId: string, roleId: string): Promise<void>;
    static setUserRoles(userId: string, roleIds: string[]): Promise<void>;
    static setUserPermissions(userId: string, permissionIds: string[]): Promise<void>;
    static getUsersWithPermission(permission: string): Promise<string[]>;
    static getUsersWithRole(roleName: string): Promise<string[]>;
}
//# sourceMappingURL=PermissionService.d.ts.map