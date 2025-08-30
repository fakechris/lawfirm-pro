import { Request, Response } from 'express';
export declare class AuthController {
    private authService;
    login(req: Request, res: Response): Promise<void>;
    register(req: Request, res: Response): Promise<void>;
    verify(req: Request, res: Response): Promise<void>;
    changePassword(req: Request, res: Response): Promise<void>;
    updateProfile(req: Request, res: Response): Promise<void>;
    logout(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=auth.d.ts.map