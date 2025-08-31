import { Router, Request, Response } from 'express';
import { TemplateManagementService } from '../../../services/knowledge-base/content';
import { authenticate } from '../../../middleware/auth';
import { validateRequest } from '../../../middleware/validation';
import { body, query, param } from 'express-validator';

const router = Router();

// Initialize service
const templateService = new TemplateManagementService();

// Template CRUD Operations
router.post('/', 
  authenticate,
  [
    body('name').notEmpty().withMessage('Template name is required'),
    body('templateContent').notEmpty().withMessage('Template content is required'),
    body('category').notEmpty().withMessage('Category is required'),
    body('contentType').isIn(['article', 'guide', 'template', 'case_study', 'training', 'policy', 'procedure']).withMessage('Invalid content type'),
    body('variableSchema').isArray().withMessage('Variable schema must be an array'),
    body('tags').isArray().withMessage('Tags must be an array')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const template = await templateService.createTemplate({
        ...req.body,
        createdBy: req.user!.id
      });
      
      res.status(201).json({
        success: true,
        data: template
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
  [param('id').isUUID().withMessage('Invalid template ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const template = await templateService.getTemplateById(req.params.id);
      
      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }
      
      res.json({
        success: true,
        data: template
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
    param('id').isUUID().withMessage('Invalid template ID'),
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('templateContent').optional().notEmpty().withMessage('Template content cannot be empty'),
    body('category').optional().notEmpty().withMessage('Category cannot be empty'),
    body('variableSchema').optional().isArray().withMessage('Variable schema must be an array'),
    body('tags').optional().isArray().withMessage('Tags must be an array')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const template = await templateService.updateTemplate(req.params.id, req.body);
      
      res.json({
        success: true,
        data: template
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
  [param('id').isUUID().withMessage('Invalid template ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      await templateService.deleteTemplate(req.params.id);
      
      res.json({
        success: true,
        message: 'Template deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Template Query
router.get('/', 
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('category').optional().isString().withMessage('Category must be a string'),
    query('contentType').optional().isIn(['article', 'guide', 'template', 'case_study', 'training', 'policy', 'procedure']).withMessage('Invalid content type'),
    query('isPublic').optional().isBoolean().withMessage('Is public must be a boolean')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const query = {
        category: req.query.category as string,
        contentType: req.query.contentType as string,
        isPublic: req.query.isPublic ? req.query.isPublic === 'true' : undefined,
        createdBy: req.query.createdBy as string,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        search: req.query.search as string
      };

      const templates = await templateService.queryTemplates(query);
      
      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Template Usage
router.post('/:id/use', 
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid template ID'),
    body('contentId').isUUID().withMessage('Invalid content ID'),
    body('variables').isObject().withMessage('Variables must be an object')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const usage = await templateService.useTemplate(
        req.params.id,
        req.body.contentId,
        req.body.variables,
        req.user!.id
      );
      
      res.status(201).json({
        success: true,
        data: usage
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.get('/:id/usages', 
  authenticate,
  [param('id').isUUID().withMessage('Invalid template ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const usages = await templateService.getTemplateUsages(req.params.id);
      
      res.json({
        success: true,
        data: usages
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Template Generation
router.post('/:id/generate', 
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid template ID'),
    body('variables').isObject().withMessage('Variables must be an object')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const generatedContent = await templateService.generateFromTemplate(
        req.params.id,
        req.body.variables
      );
      
      res.json({
        success: true,
        data: {
          content: generatedContent
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

// Template Categories
router.get('/categories', 
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const categories = await templateService.getTemplateCategories();
      
      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.get('/categories/:category/templates', 
  authenticate,
  [param('category').isString().withMessage('Category must be a string')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const templates = await templateService.getTemplatesByCategory(req.params.category);
      
      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Popular Templates
router.get('/popular', 
  authenticate,
  [
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const templates = await templateService.getPopularTemplates(limit);
      
      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Template Analytics
router.get('/:id/analytics', 
  authenticate,
  [param('id').isUUID().withMessage('Invalid template ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const analytics = await templateService.getTemplateAnalytics(req.params.id);
      
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

// Template Import/Export
router.get('/:id/export', 
  authenticate,
  [param('id').isUUID().withMessage('Invalid template ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const templateData = await templateService.exportTemplate(req.params.id);
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="template-${req.params.id}.json"`);
      
      res.send(templateData);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.post('/import', 
  authenticate,
  [
    body('templateData').isString().withMessage('Template data is required')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const template = await templateService.importTemplate(
        req.body.templateData,
        req.user!.id
      );
      
      res.status(201).json({
        success: true,
        data: template
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Template Versioning
router.post('/:id/versions', 
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid template ID'),
    body('changeLog').notEmpty().withMessage('Change log is required')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      await templateService.createTemplateVersion(
        req.params.id,
        req.body.changeLog
      );
      
      res.json({
        success: true,
        message: 'Template version created successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.get('/:id/versions', 
  authenticate,
  [param('id').isUUID().withMessage('Invalid template ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const versions = await templateService.getTemplateVersions(req.params.id);
      
      res.json({
        success: true,
        data: versions
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