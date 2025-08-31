import { Request, Response, NextFunction } from 'express';
export declare class ContentMiddleware {
    static validateContent(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>>;
    static validateTemplate(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>>;
    static validateTrainingModule(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>>;
    static validateAssessment(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>>;
    static validateWorkflowStage(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>>;
    static validateSearchQuery(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>>;
    static checkContentAccess: (requiredPermission: string) => (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
    static checkContentVisibility: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
    static trackContentVersion: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    static trackContentInteraction: (action: string) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
    static rateLimitContentOperations: (maxOperations: number, windowMs: number) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
    static sanitizeContent(req: Request, res: Response, next: NextFunction): void;
    private static checkUserPermission;
    private static getContentById;
    private static checkUserContentAccess;
    private static trackVersionChange;
    private static trackInteraction;
}
//# sourceMappingURL=contentMiddleware.d.ts.map