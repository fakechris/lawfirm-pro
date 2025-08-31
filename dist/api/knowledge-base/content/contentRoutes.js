"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const content_1 = require("../../../services/knowledge-base/content");
const auth_1 = require("../../../middleware/auth");
const validation_1 = require("../../../middleware/validation");
const express_validator_1 = require("express-validator");
const router = (0, express_1.Router)();
const contentService = new content_1.ContentManagementService();
router.post('/', auth_1.authenticate, [
    (0, express_validator_1.body)('title').notEmpty().withMessage('Title is required'),
    (0, express_validator_1.body)('content').notEmpty().withMessage('Content is required'),
    (0, express_validator_1.body)('contentType').isIn(['article', 'guide', 'template', 'case_study', 'training', 'policy', 'procedure']).withMessage('Invalid content type'),
    (0, express_validator_1.body)('category').notEmpty().withMessage('Category is required'),
    (0, express_validator_1.body)('visibility').isIn(['public', 'internal', 'restricted']).withMessage('Invalid visibility'),
    (0, express_validator_1.body)('tags').isArray().withMessage('Tags must be an array')
], validation_1.validateRequest, async (req, res) => {
    try {
        const content = await contentService.createContent({
            ...req.body,
            authorId: req.user.id
        });
        res.status(201).json({
            success: true,
            data: content
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/:id', auth_1.authenticate, [(0, express_validator_1.param)('id').isUUID().withMessage('Invalid content ID')], validation_1.validateRequest, async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.put('/:id', auth_1.authenticate, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid content ID'),
    (0, express_validator_1.body)('title').optional().notEmpty().withMessage('Title cannot be empty'),
    (0, express_validator_1.body)('content').optional().notEmpty().withMessage('Content cannot be empty'),
    (0, express_validator_1.body)('category').optional().notEmpty().withMessage('Category cannot be empty'),
    (0, express_validator_1.body)('visibility').optional().isIn(['public', 'internal', 'restricted']).withMessage('Invalid visibility'),
    (0, express_validator_1.body)('tags').optional().isArray().withMessage('Tags must be an array')
], validation_1.validateRequest, async (req, res) => {
    try {
        const content = await contentService.updateContent(req.params.id, req.body, req.user.id);
        res.json({
            success: true,
            data: content
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.delete('/:id', auth_1.authenticate, [(0, express_validator_1.param)('id').isUUID().withMessage('Invalid content ID')], validation_1.validateRequest, async (req, res) => {
    try {
        await contentService.deleteContent(req.params.id);
        res.json({
            success: true,
            message: 'Content archived successfully'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/', auth_1.authenticate, [
    (0, express_validator_1.query)('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    (0, express_validator_1.query)('sortBy').optional().isIn(['createdAt', 'updatedAt', 'title', 'category']).withMessage('Invalid sort field'),
    (0, express_validator_1.query)('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Invalid sort order'),
    (0, express_validator_1.query)('contentType').optional().isIn(['article', 'guide', 'template', 'case_study', 'training', 'policy', 'procedure']).withMessage('Invalid content type'),
    (0, express_validator_1.query)('status').optional().isIn(['draft', 'review', 'published', 'archived']).withMessage('Invalid status'),
    (0, express_validator_1.query)('visibility').optional().isIn(['public', 'internal', 'restricted']).withMessage('Invalid visibility')
], validation_1.validateRequest, async (req, res) => {
    try {
        const query = {
            contentType: req.query.contentType,
            category: req.query.category,
            status: req.query.status,
            visibility: req.query.visibility,
            authorId: req.query.authorId,
            search: req.query.search,
            tags: req.query.tags ? req.query.tags.split(',') : undefined,
            fromDate: req.query.fromDate ? new Date(req.query.fromDate) : undefined,
            toDate: req.query.toDate ? new Date(req.query.toDate) : undefined
        };
        const pagination = {
            page: req.query.page ? parseInt(req.query.page) : 1,
            limit: req.query.limit ? parseInt(req.query.limit) : 10,
            sortBy: req.query.sortBy || 'createdAt',
            sortOrder: req.query.sortOrder || 'desc'
        };
        const result = await contentService.queryContent(query, pagination);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/search', auth_1.authenticate, [
    (0, express_validator_1.body)('query').notEmpty().withMessage('Search query is required')
], validation_1.validateRequest, async (req, res) => {
    try {
        const { query, filters = {} } = req.body;
        const results = await contentService.searchContent(query, filters);
        res.json({
            success: true,
            data: results
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/:id/versions', auth_1.authenticate, [(0, express_validator_1.param)('id').isUUID().withMessage('Invalid content ID')], validation_1.validateRequest, async (req, res) => {
    try {
        const versions = await contentService.getContentVersions(req.params.id);
        res.json({
            success: true,
            data: versions
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/:id/versions/:version', auth_1.authenticate, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid content ID'),
    (0, express_validator_1.param)('version').isInt({ min: 1 }).withMessage('Version must be a positive integer')
], validation_1.validateRequest, async (req, res) => {
    try {
        const version = await contentService.getContentVersion(req.params.id, parseInt(req.params.version));
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/:id/revert/:version', auth_1.authenticate, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid content ID'),
    (0, express_validator_1.param)('version').isInt({ min: 1 }).withMessage('Version must be a positive integer')
], validation_1.validateRequest, async (req, res) => {
    try {
        const content = await contentService.revertToVersion(req.params.id, parseInt(req.params.version), req.user.id);
        res.json({
            success: true,
            data: content
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/categories', auth_1.authenticate, [
    (0, express_validator_1.body)('name').notEmpty().withMessage('Category name is required')
], validation_1.validateRequest, async (req, res) => {
    try {
        const category = await contentService.createCategory(req.body.name, req.body.description, req.body.parentId);
        res.status(201).json({
            success: true,
            data: category
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/categories', auth_1.authenticate, async (req, res) => {
    try {
        const categories = await contentService.getCategories();
        res.json({
            success: true,
            data: categories
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.put('/categories/:id', auth_1.authenticate, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid category ID')
], validation_1.validateRequest, async (req, res) => {
    try {
        const category = await contentService.updateCategory(req.params.id, req.body);
        res.json({
            success: true,
            data: category
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/tags', auth_1.authenticate, [
    (0, express_validator_1.body)('name').notEmpty().withMessage('Tag name is required')
], validation_1.validateRequest, async (req, res) => {
    try {
        const tag = await contentService.createTag(req.body.name, req.body.description);
        res.status(201).json({
            success: true,
            data: tag
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/tags', auth_1.authenticate, async (req, res) => {
    try {
        const tags = await contentService.getTags();
        res.json({
            success: true,
            data: tags
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/:id/analytics', auth_1.authenticate, [(0, express_validator_1.param)('id').isUUID().withMessage('Invalid content ID')], validation_1.validateRequest, async (req, res) => {
    try {
        const analytics = await contentService.getContentAnalytics(req.params.id);
        res.json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/analytics/global', auth_1.authenticate, async (req, res) => {
    try {
        const analytics = await contentService.getGlobalAnalytics();
        res.json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=contentRoutes.js.map