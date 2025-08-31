import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { workflowController } from '../controllers/workflowController';

const router = Router();

// Get specific workflow
router.get('/:id', 
  authenticate,
  workflowController.getWorkflow.bind(workflowController)
);

// Update workflow
router.put('/:id', 
  authenticate,
  workflowController.updateWorkflow.bind(workflowController)
);

// Delete workflow
router.delete('/:id', 
  authenticate,
  workflowController.deleteWorkflow.bind(workflowController)
);

// Add step to workflow
router.post('/:id/steps', 
  authenticate,
  workflowController.addWorkflowStep.bind(workflowController)
);

// Update workflow step
router.put('/:id/steps/:stepId', 
  authenticate,
  workflowController.updateWorkflowStep.bind(workflowController)
);

// Get all workflows for a document (alternative route)
router.get('/document/:documentId', 
  authenticate,
  workflowController.getDocumentWorkflows.bind(workflowController)
);

export default router;