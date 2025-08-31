import { Request, Response, NextFunction } from 'express';
interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: string;
        firstName?: string;
        lastName?: string;
    };
}
export declare class DocumentController {
    private prisma;
    private repository;
    constructor();
    uploadDocument(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getDocument(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    downloadDocument(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    updateDocument(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    deleteDocument(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    listDocuments(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    createVersion(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getVersions(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    searchDocuments(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getSearchSuggestions(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getDocumentStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getUserDocuments(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    reprocessDocument(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    static handleError(error: any, req: Request, res: Response, next: NextFunction): void;
}
export declare const documentController: DocumentController;
export {};
//# sourceMappingURL=documentController.d.ts.map