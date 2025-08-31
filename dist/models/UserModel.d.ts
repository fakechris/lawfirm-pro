import { User, CreateUserRequest, UpdateUserRequest } from '../types';
export declare class UserModel {
    static create(data: CreateUserRequest & {
        roleIds?: string[];
    }): Promise<User>;
    static findById(id: string): Promise<User | null>;
    static findByEmail(email: string): Promise<User | null>;
    static findByUsername(username: string): Promise<User | null>;
    static update(id: string, data: UpdateUserRequest): Promise<User | null>;
    static delete(id: string): Promise<boolean>;
    static findAll(page?: number, limit?: number, filters?: {
        isActive?: boolean;
        department?: string;
        search?: string;
    }): Promise<{
        users: User[];
        total: number;
    }>;
    static updateLastLogin(id: string): Promise<void>;
    static changePassword(id: string, newPassword: string): Promise<void>;
    static getUserPermissions(userId: string): Promise<string[]>;
    static getUserRoles(userId: string): Promise<string[]>;
    static addRole(userId: string, roleId: string): Promise<void>;
    static removeRole(userId: string, roleId: string): Promise<void>;
    static addPermission(userId: string, permissionId: string): Promise<void>;
    static removePermission(userId: string, permissionId: string): Promise<void>;
}
//# sourceMappingURL=UserModel.d.ts.map