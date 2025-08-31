import { Router, Request, Response } from 'express';
import { ContentManagementService } from '../../../services/knowledge-base/content';
import { authenticate } from '../../../middleware/auth';
import { validateRequest } from '../../../middleware/validation';
import { body, query, param } from 'express-validator';

const router = Router();

// Initialize service
const contentService = new ContentManagementService();

// Content CRUD Operations
router.post('/', 
  authenticate,
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('content').notEmpty().withMessage('Content is required'),
    body('contentType').isIn(['article', 'guide', 'template', 'case_study', 'training', 'policy', 'procedure']).withMessage('Invalid content type'),
    body('category').notEmpty().withMessage('Category is required'),
    body('visibility').isIn(['public', 'internal', 'restricted']).withMessage('Invalid visibility'),
    body('tags').isArray().withMessage('Tags must be an array')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const content = await contentService.createContent({
        ...req.body,
        authorId: req.user!.id
      });
      
      res.status(201).json({
        success: true,
        data: content
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
  [param('id').isUUID().withMessage('Invalid content ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const content = await contentService.getContentById(req.params.id);
      
      if (!content) {
        return res.status(404).json({
          success: false,
          error: 'Content not found'
        });
      }
      
      res.json({
        success: true,
        data: content
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
    param('id').isUUID().withMessage('Invalid content ID'),
    body('title').optional().notEmpty().withMessage('Title cannot be empty'),
    body('content').optional().notEmpty().withMessage('Content cannot be empty'),
    body('category').optional().notEmpty().withMessage('Category cannot be empty'),
    body('visibility').optional().isIn(['public', 'internal', 'restricted']).withMessage('Invalid visibility'),
    body('tags').optional().isArray().withMessage('Tags must be an array')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const content = await contentService.updateContent(
        req.params.id,
        req.body,
        req.user!.id
      );
      
      res.json({
        success: true,
        data: content
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
  [param('id').isUUID().withMessage('Invalid content ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      await contentService.deleteContent(req.params.id);
      
      res.json({
        success: true,
        message: 'Content archived successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Content Query and Search
router.get('/', 
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('sortBy').optional().isIn(['createdAt', 'updatedAt', 'title', 'category']).withMessage('Invalid sort field'),
    query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Invalid sort order'),
    query('contentType').optional().isIn(['article', 'guide', 'template', 'case_study', 'training', 'policy', 'procedure']).withMessage('Invalid content type'),
    query('status').optional().isIn(['draft', 'review', 'published', 'archived']).withMessage('Invalid status'),
    query('visibility').optional().isIn(['public', 'internal', 'restricted']).withMessage('Invalid visibility')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const query = {
        contentType: req.query.contentType as string,
        category: req.query.category as string,
        status: req.query.status as string,
        visibility: req.query.visibility as string,
        authorId: req.query.authorId as string,
        search: req.query.search as string,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined
      };

      const pagination = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
        sortBy: req.query.sortBy as string || 'createdAt',
        sortOrder: req.query.sortOrder as string || 'desc'
      };

      const result = await contentService.queryContent(query, pagination);
      
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

router.post('/search', 
  authenticate,
  [
    body('query').notEmpty().withMessage('Search query is required')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { query, filters = {} } = req.body;
      
      const results = await contentService.searchContent(query, filters);
      
      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Content Version Management
router.get('/:id/versions', 
  authenticate,
  [param('id').isUUID().withMessage('Invalid content ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const versions = await contentService.getContentVersions(req.params.id);
      
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

router.get('/:id/versions/:version', 
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid content ID'),
    param('version').isInt({ min: 1 }).withMessage('Version must be a positive integer')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const version = await contentService.getContentVersion(
        req.params.id,
        parseInt(req.params.version)
      );
      
      if (!version) {
        return res.status(404).json({
          success: false,
          error: 'Version not found'
        });
      }
      
      res.json({
        success: true,
        data: version
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.post('/:id/revert/:version', 
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid content ID'),
    param('version').isInt({ min: 1 }).withMessage('Version must be a positive integer')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const content = await contentService.revertToVersion(
        req.params.id,
        parseInt(req.params.version),
        req.user!.id
      );
      
      res.json({
        success: true,
        data: content
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Category Management
router.post('/categories', 
  authenticate,
  [
    body('name').notEmpty().withMessage('Category name is required')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const category = await contentService.createCategory(
        req.body.name,
        req.body.description,
        req.body.parentId
      );
      
      res.status(201).json({
        success: true,
        data: category
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.get('/categories', 
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const categories = await contentService.getCategories();
      
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

router.put('/categories/:id', 
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid category ID')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const category = await contentService.updateCategory(req.params.id, req.body);
      
      res.json({
        success: true,
        data: category
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Tag Management
router.post('/tags', 
  authenticate,
  [
    body('name').notEmpty().withMessage('Tag name is required')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const tag = await contentService.createTag(
        req.body.name,
        req.body.description
      );
      
      res.status(201).json({
        success: true,
        data: tag
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.get('/tags', 
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const tags = await contentService.getTags();
      
      res.json({
        success: true,
        data: tags
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Analytics
router.get('/:id/analytics', 
  authenticate,
  [param('id').isUUID().withMessage('Invalid content ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const analytics = await contentService.getContentAnalytics(req.params.id);
      
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

router.get('/analytics/global', 
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const analytics = await contentService.getGlobalAnalytics();
      
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

export default router;