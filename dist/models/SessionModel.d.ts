import { Session } from '../types';
export declare class SessionModel {
    static create(userId: string): Promise<Session>;
    static findByRefreshToken(refreshToken: string): Promise<Session | null>;
    static findById(id: string): Promise<Session | null>;
    static findByUserId(userId: string): Promise<Session[]>;
    static delete(id: string): Promise<boolean>;
    static deleteByRefreshToken(refreshToken: string): Promise<boolean>;
    static deleteByUserId(userId: string): Promise<number>;
    static refresh(sessionId: string): Promise<Session | null>;
    static cleanup(): Promise<number>;
    static validateSession(refreshToken: string): Promise<Session | null>;
    static getUserActiveSessions(userId: string): Promise<Session[]>;
    static revokeAllUserSessions(userId: string): Promise<number>;
}
//# sourceMappingURL=SessionModel.d.ts.map