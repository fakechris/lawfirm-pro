import { Database } from '../utils/database';
import { LoginRequest, RegisterRequest, AuthResponse, UserResponse } from '../types';
export declare class AuthService {
    private db;
    constructor(db: Database);
    login(loginRequest: LoginRequest): Promise<AuthResponse>;
    register(registerRequest: RegisterRequest): Promise<AuthResponse>;
    verifyToken(token: string): Promise<UserResponse>;
    changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>;
    updateProfile(userId: string, updates: Partial<{
        firstName: string;
        lastName: string;
        phone: string;
        address: string;
        company: string;
    }>): Promise<UserResponse>;
}
//# sourceMappingURL=auth.d.ts.map