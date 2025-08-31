import { Router, Request, Response } from 'express';
import { TrainingModuleService } from '../../../services/knowledge-base/content';
import { authenticate } from '../../../middleware/auth';
import { validateRequest } from '../../../middleware/validation';
import { body, query, param } from 'express-validator';

const router = Router();

// Initialize service
const trainingService = new TrainingModuleService();

// Training Module CRUD Operations
router.post('/', 
  authenticate,
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('content').notEmpty().withMessage('Content is required'),
    body('category').notEmpty().withMessage('Category is required'),
    body('difficulty').isIn(['beginner', 'intermediate', 'advanced']).withMessage('Invalid difficulty level'),
    body('duration').isInt({ min: 1 }).withMessage('Duration must be a positive integer'),
    body('targetRoles').isArray().withMessage('Target roles must be an array'),
    body('learningObjectives').isArray().withMessage('Learning objectives must be an array')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const module = await trainingService.createModule({
        ...req.body,
        authorId: req.user!.id
      });
      
      res.status(201).json({
        success: true,
        data: module
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
  [param('id').isUUID().withMessage('Invalid module ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const module = await trainingService.getModuleById(req.params.id);
      
      if (!module) {
        return res.status(404).json({
          success: false,
          error: 'Training module not found'
        });
      }
      
      res.json({
        success: true,
        data: module
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
  [
    param('id').isUUID().withMessage('Invalid module ID'),
    body('title').optional().notEmpty().withMessage('Title cannot be empty'),
    body('content').optional().notEmpty().withMessage('Content cannot be empty'),
    body('category').optional().notEmpty().withMessage('Category cannot be empty'),
    body('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced']).withMessage('Invalid difficulty level'),
    body('duration').optional().isInt({ min: 1 }).withMessage('Duration must be a positive integer'),
    body('targetRoles').optional().isArray().withMessage('Target roles must be an array'),
    body('learningObjectives').optional().isArray().withMessage('Learning objectives must be an array')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const module = await trainingService.updateModule(req.params.id, req.body);
      
      res.json({
        success: true,
        data: module
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.delete('/:id', 
  authenticate,
  [param('id').isUUID().withMessage('Invalid module ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      await trainingService.deleteModule(req.params.id);
      
      res.json({
        success: true,
        message: 'Training module archived successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Module Query
router.get('/', 
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('category').optional().isString().withMessage('Category must be a string'),
    query('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced']).withMessage('Invalid difficulty level'),
    query('isRequired').optional().isBoolean().withMessage('Is required must be a boolean'),
    query('status').optional().isIn(['draft', 'active', 'inactive', 'archived']).withMessage('Invalid status')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const query = {
        category: req.query.category as string,
        difficulty: req.query.difficulty as string,
        isRequired: req.query.isRequired ? req.query.isRequired === 'true' : undefined,
        targetRoles: req.query.targetRoles ? (req.query.targetRoles as string).split(',') : undefined,
        status: req.query.status as string,
        search: req.query.search as string
      };

      const modules = await trainingService.queryModules(query);
      
      res.json({
        success: true,
        data: modules
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Training Materials Management
router.post('/:id/materials', 
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid module ID'),
    body('type').isIn(['document', 'video', 'image', 'link', 'quiz']).withMessage('Invalid material type'),
    body('title').notEmpty().withMessage('Title is required'),
    body('sortOrder').isInt({ min: 0 }).withMessage('Sort order must be a non-negative integer')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const material = await trainingService.addMaterial(req.params.id, req.body);
      
      res.status(201).json({
        success: true,
        data: material
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.put('/materials/:id', 
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid material ID')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const material = await trainingService.updateMaterial(req.params.id, req.body);
      
      res.json({
        success: true,
        data: material
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.delete('/materials/:id', 
  authenticate,
  [param('id').isUUID().withMessage('Invalid material ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      await trainingService.deleteMaterial(req.params.id);
      
      res.json({
        success: true,
        message: 'Material deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.put('/:id/materials/reorder', 
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid module ID'),
    body('materialIds').isArray().withMessage('Material IDs must be an array')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      await trainingService.reorderMaterials(req.params.id, req.body.materialIds);
      
      res.json({
        success: true,
        message: 'Materials reordered successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Assessment Management
router.post('/:id/assessments', 
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid module ID'),
    body('type').isIn(['quiz', 'assignment', 'practical']).withMessage('Invalid assessment type'),
    body('title').notEmpty().withMessage('Title is required'),
    body('questions').isArray().withMessage('Questions must be an array'),
    body('passingScore').isInt({ min: 0, max: 100 }).withMessage('Passing score must be between 0 and 100'),
    body('attemptsAllowed').isInt({ min: 1 }).withMessage('Attempts allowed must be a positive integer')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const assessment = await trainingService.addAssessment(req.params.id, req.body);
      
      res.status(201).json({
        success: true,
        data: assessment
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.put('/assessments/:id', 
  authenticate,
  [param('id').isUUID().withMessage('Invalid assessment ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const assessment = await trainingService.updateAssessment(req.params.id, req.body);
      
      res.json({
        success: true,
        data: assessment
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.delete('/assessments/:id', 
  authenticate,
  [param('id').isUUID().withMessage('Invalid assessment ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      await trainingService.deleteAssessment(req.params.id);
      
      res.json({
        success: true,
        message: 'Assessment deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// User Progress Management
router.post('/:id/start', 
  authenticate,
  [param('id').isUUID().withMessage('Invalid module ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const progress = await trainingService.startModule(req.user!.id, req.params.id);
      
      res.status(201).json({
        success: true,
        data: progress
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.put('/:id/progress', 
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid module ID'),
    body('progress').isInt({ min: 0, max: 100 }).withMessage('Progress must be between 0 and 100'),
    body('timeSpent').isInt({ min: 0 }).withMessage('Time spent must be a non-negative integer')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const progress = await trainingService.updateProgress(
        req.user!.id,
        req.params.id,
        req.body.progress,
        req.body.timeSpent
      );
      
      res.json({
        success: true,
        data: progress
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.post('/:id/complete-material', 
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid module ID'),
    body('materialIndex').isInt({ min: 0 }).withMessage('Material index must be a non-negative integer')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const progress = await trainingService.completeMaterial(
        req.user!.id,
        req.params.id,
        req.body.materialIndex
      );
      
      res.json({
        success: true,
        data: progress
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.post('/:id/assessments/:assessmentId/submit', 
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid module ID'),
    param('assessmentId').isUUID().withMessage('Invalid assessment ID'),
    body('answers').isObject().withMessage('Answers must be an object')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const result = await trainingService.submitAssessment(
        req.user!.id,
        req.params.id,
        req.params.assessmentId,
        req.body.answers
      );
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Progress Tracking
router.get('/my-progress', 
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const progress = await trainingService.getUserProgress(req.user!.id);
      
      res.json({
        success: true,
        data: progress
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.get('/:id/progress', 
  authenticate,
  [param('id').isUUID().withMessage('Invalid module ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const progress = await trainingService.getModuleProgress(req.params.id);
      
      res.json({
        success: true,
        data: progress
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Training Analytics
router.get('/analytics', 
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const analytics = await trainingService.getTrainingAnalytics();
      
      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Training Recommendations
router.get('/recommended', 
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const modules = await trainingService.getRecommendedModules(req.user!.id);
      
      res.json({
        success: true,
        data: modules
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Certificate Generation
router.post('/:id/certificate', 
  authenticate,
  [param('id').isUUID().withMessage('Invalid module ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const certificateId = await trainingService.generateCertificate(req.user!.id, req.params.id);
      
      res.json({
        success: true,
        data: {
          certificateId
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Training Paths
router.post('/paths', 
  authenticate,
  [
    body('name').notEmpty().withMessage('Path name is required'),
    body('moduleIds').isArray().withMessage('Module IDs must be an array')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const path = await trainingService.createTrainingPath(
        req.body.name,
        req.body.description,
        req.body.moduleIds,
        req.user!.id
      );
      
      res.status(201).json({
        success: true,
        data: path
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.get('/paths', 
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const paths = await trainingService.getTrainingPaths();
      
      res.json({
        success: true,
        data: paths
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