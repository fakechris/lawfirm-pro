import { Router, Request, Response } from 'express';
import { WorkflowEngine } from '../../../services/knowledge-base/content';
import { authenticate } from '../../../middleware/auth';
import { validateRequest } from '../../../middleware/validation';
import { body, query, param } from 'express-validator';

const router = Router();

// Initialize service
const workflowEngine = new WorkflowEngine();

// Workflow Management
router.post('/', 
  authenticate,
  [
    body('name').notEmpty().withMessage('Workflow name is required'),
    body('contentType').isArray().withMessage('Content types must be an array'),
    body('stages').isArray().withMessage('Stages must be an array'),
    body('stages.*.name').notEmpty().withMessage('Stage name is required'),
    body('stages.*.type').isIn(['review', 'approval', 'publishing', 'archival']).withMessage('Invalid stage type'),
    body('stages.*.requiredRole').isArray().withMessage('Required roles must be an array')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const workflow = await workflowEngine.createWorkflow({
        ...req.body,
        createdBy: req.user!.id
      });
      
      res.status(201).json({
        success: true,
        data: workflow
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.get('/', 
  authenticate,
  [
    query('contentType').optional().isString().withMessage('Content type must be a string'),
    query('isDefault').optional().isBoolean().withMessage('Is default must be a boolean'),
    query('isActive').optional().isBoolean().withMessage('Is active must be a boolean')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const query = {
        contentType: req.query.contentType as string,
        isDefault: req.query.isDefault ? req.query.isDefault === 'true' : undefined,
        isActive: req.query.isActive ? req.query.isActive === 'true' : undefined
      };

      const workflows = await workflowEngine.getWorkflows(query);
      
      res.json({
        success: true,
        data: workflows
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.get('/:id', 
  authenticate,
  [param('id').isUUID().withMessage('Invalid workflow ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const workflow = await workflowEngine.getWorkflowById(req.params.id);
      
      if (!workflow) {
        return res.status(404).json({
          success: false,
          error: 'Workflow not found'
        });
      }
      
      res.json({
        success: true,
        data: workflow
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.put('/:id', 
  authenticate,
  [param('id').isUUID().withMessage('Invalid workflow ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const workflow = await workflowEngine.updateWorkflow(req.params.id, req.body);
      
      res.json({
        success: true,
        data: workflow
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Workflow Instance Management
router.post('/instances/start', 
  authenticate,
  [
    body('contentId').isUUID().withMessage('Invalid content ID'),
    body('workflowId').isUUID().withMessage('Invalid workflow ID')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const instance = await workflowEngine.startWorkflow(
        req.body.contentId,
        req.body.workflowId,
        req.user!.id
      );
      
      res.status(201).json({
        success: true,
        data: instance
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.get('/instances/:id', 
  authenticate,
  [param('id').isUUID().withMessage('Invalid instance ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const instance = await workflowEngine.getWorkflowInstance(req.params.id);
      
      if (!instance) {
        return res.status(404).json({
          success: false,
          error: 'Workflow instance not found'
        });
      }
      
      res.json({
        success: true,
        data: instance
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.get('/content/:contentId/instances', 
  authenticate,
  [param('contentId').isUUID().withMessage('Invalid content ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const instances = await workflowEngine.getWorkflowInstancesForContent(req.params.contentId);
      
      res.json({
        success: true,
        data: instances
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.post('/instances/:id/advance/:stageId', 
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid instance ID'),
    param('stageId').isUUID().withMessage('Invalid stage ID')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const instance = await workflowEngine.advanceWorkflowStage(
        req.params.id,
        req.params.stageId,
        req.user!.id,
        req.body.notes
      );
      
      res.json({
        success: true,
        data: instance
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.post('/instances/:id/reject/:stageId', 
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid instance ID'),
    param('stageId').isUUID().withMessage('Invalid stage ID'),
    body('reason').notEmpty().withMessage('Rejection reason is required')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const instance = await workflowEngine.rejectWorkflow(
        req.params.id,
        req.params.stageId,
        req.user!.id,
        req.body.reason
      );
      
      res.json({
        success: true,
        data: instance
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Workflow Templates
router.post('/templates', 
  authenticate,
  [
    body('name').notEmpty().withMessage('Template name is required'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('contentType').isIn(['article', 'guide', 'template', 'case_study', 'training', 'policy', 'procedure']).withMessage('Invalid content type')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const workflow = await workflowEngine.createWorkflowTemplate(
        req.body.name,
        req.body.description,
        req.body.contentType
      );
      
      res.status(201).json({
        success: true,
        data: workflow
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Due Date Management
router.get('/instances/due', 
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const instances = await workflowEngine.getDueWorkflowInstances();
      
      res.json({
        success: true,
        data: instances
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Auto-approval Processing (admin only)
router.post('/process-auto-approvals', 
  authenticate,
  async (req: Request, res: Response) => {
    try {
      await workflowEngine.processAutoApprovals();
      
      res.json({
        success: true,
        message: 'Auto-approvals processed successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;