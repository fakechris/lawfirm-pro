import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class TemplateController {
    createTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getTemplates(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    updateTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    deleteTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    generateFromTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    private generateDocumentFromTemplate;
    downloadTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}
export declare const templateController: TemplateController;
//# sourceMappingURL=templateController.d.ts.map