import { Request, Response } from 'express';
export declare class AuthController {
    static login(req: Request, res: Response): Promise<void>;
    static refreshToken(req: Request, res: Response): Promise<void>;
    static logout(req: Request, res: Response): Promise<void>;
    static logoutAll(req: Request, res: Response): Promise<void>;
    static changePassword(req: Request, res: Response): Promise<void>;
    static resetPassword(req: Request, res: Response): Promise<void>;
    static register(req: Request, res: Response): Promise<void>;
    static createUser(req: Request, res: Response): Promise<void>;
    static getCurrentUser(req: Request, res: Response): Promise<void>;
    static getUserSessions(req: Request, res: Response): Promise<void>;
    static revokeSession(req: Request, res: Response): Promise<void>;
    static verifyToken(req: Request, res: Response): Promise<void>;
    static initialize(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=AuthController.d.ts.map