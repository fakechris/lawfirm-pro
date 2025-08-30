import { Request, Response } from 'express';
export declare class UserController {
    static getAllUsers(req: Request, res: Response): Promise<void>;
    static getUserById(req: Request, res: Response): Promise<void>;
    static createUser(req: Request, res: Response): Promise<void>;
    static updateUser(req: Request, res: Response): Promise<void>;
    static deleteUser(req: Request, res: Response): Promise<void>;
    static getUserPermissions(req: Request, res: Response): Promise<void>;
    static getUserRoles(req: Request, res: Response): Promise<void>;
    static addRoleToUser(req: Request, res: Response): Promise<void>;
    static removeRoleFromUser(req: Request, res: Response): Promise<void>;
    static setUserRoles(req: Request, res: Response): Promise<void>;
    static addPermissionToUser(req: Request, res: Response): Promise<void>;
    static removePermissionFromUser(req: Request, res: Response): Promise<void>;
    static deactivateUser(req: Request, res: Response): Promise<void>;
    static activateUser(req: Request, res: Response): Promise<void>;
    static getUserDirectory(req: Request, res: Response): Promise<void>;
    static getUserStats(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=UserController.d.ts.map