import { Request, Response } from 'express';
export declare class DocumentController {
    private documentService;
    uploadDocument(req: Request, res: Response): Promise<void>;
    getCaseDocuments(req: Request, res: Response): Promise<void>;
    getDocumentById(req: Request, res: Response): Promise<void>;
    downloadDocument(req: Request, res: Response): Promise<void>;
    updateDocument(req: Request, res: Response): Promise<void>;
    deleteDocument(req: Request, res: Response): Promise<void>;
    grantDocumentAccess(req: Request, res: Response): Promise<void>;
    revokeDocumentAccess(req: Request, res: Response): Promise<void>;
    getDocumentAccess(req: Request, res: Response): Promise<void>;
    searchDocuments(req: Request, res: Response): Promise<void>;
    getDocumentStats(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=document.d.ts.map