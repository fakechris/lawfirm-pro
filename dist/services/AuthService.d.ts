import { LoginRequest, LoginResponse, RefreshTokenRequest, ChangePasswordRequest, CreateUserRequest } from '../types';
export declare class AuthService {
    static login(data: LoginRequest, ipAddress?: string, userAgent?: string): Promise<LoginResponse>;
    static refreshToken(data: RefreshTokenRequest, ipAddress?: string, userAgent?: string): Promise<LoginResponse>;
    static logout(refreshToken: string, ipAddress?: string, userAgent?: string): Promise<void>;
    static logoutAll(userId: string, ipAddress?: string, userAgent?: string): Promise<number>;
    static changePassword(userId: string, data: ChangePasswordRequest, ipAddress?: string, userAgent?: string): Promise<void>;
    static resetPassword(userId: string, newPassword: string, adminUserId: string, ipAddress?: string, userAgent?: string): Promise<void>;
    static register(data: CreateUserRequest, ipAddress?: string, userAgent?: string): Promise<LoginResponse>;
    static createUser(data: CreateUserRequest, adminUserId: string, ipAddress?: string, userAgent?: string): Promise<void>;
    static verifyAccessToken(accessToken: string): Promise<any>;
    static getUserSessions(userId: string): Promise<any[]>;
    static revokeSession(sessionId: string, userId: string): Promise<boolean>;
    static initialize(): Promise<void>;
    private static assignDefaultPermissions;
}
//# sourceMappingURL=AuthService.d.ts.map