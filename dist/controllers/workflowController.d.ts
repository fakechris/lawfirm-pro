import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class WorkflowController {
    createWorkflow(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getWorkflow(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    updateWorkflow(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    deleteWorkflow(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    addWorkflowStep(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    updateWorkflowStep(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getDocumentWorkflows(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    private checkDocumentAccess;
    private checkAndUpdateWorkflowStatus;
}
export declare const workflowController: WorkflowController;
//# sourceMappingURL=workflowController.d.ts.map