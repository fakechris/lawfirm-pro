import { Request, Response } from 'express';
export declare class RoleController {
    static getAllRoles(req: Request, res: Response): Promise<void>;
    static getRoleById(req: Request, res: Response): Promise<void>;
    static getRoleByName(req: Request, res: Response): Promise<void>;
    static createRole(req: Request, res: Response): Promise<void>;
    static updateRole(req: Request, res: Response): Promise<void>;
    static deleteRole(req: Request, res: Response): Promise<void>;
    static getRolePermissions(req: Request, res: Response): Promise<void>;
    static addPermissionToRole(req: Request, res: Response): Promise<void>;
    static removePermissionFromRole(req: Request, res: Response): Promise<void>;
    static setRolePermissions(req: Request, res: Response): Promise<void>;
    static getRoleHierarchy(req: Request, res: Response): Promise<void>;
    static getRoleStats(req: Request, res: Response): Promise<void>;
    static initializeSystemRoles(req: Request, res: Response): Promise<void>;
}
export declare class PermissionController {
    static getAllPermissions(req: Request, res: Response): Promise<void>;
    static getPermissionById(req: Request, res: Response): Promise<void>;
    static getPermissionByName(req: Request, res: Response): Promise<void>;
    static getPermissionsByResource(req: Request, res: Response): Promise<void>;
    static createPermission(req: Request, res: Response): Promise<void>;
    static updatePermission(req: Request, res: Response): Promise<void>;
    static deletePermission(req: Request, res: Response): Promise<void>;
    static getAllResources(req: Request, res: Response): Promise<void>;
    static getAllActions(req: Request, res: Response): Promise<void>;
    static getPermissionStats(req: Request, res: Response): Promise<void>;
    static initializeSystemPermissions(req: Request, res: Response): Promise<void>;
    static validateRoleStructure(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=RolePermissionController.d.ts.map