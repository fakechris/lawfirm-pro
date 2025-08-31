"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const content_1 = require("../../../services/knowledge-base/content");
const auth_1 = require("../../../middleware/auth");
const validation_1 = require("../../../middleware/validation");
const express_validator_1 = require("express-validator");
const router = (0, express_1.Router)();
const templateService = new content_1.TemplateManagementService();
router.post('/', auth_1.authenticate, [
    (0, express_validator_1.body)('name').notEmpty().withMessage('Template name is required'),
    (0, express_validator_1.body)('templateContent').notEmpty().withMessage('Template content is required'),
    (0, express_validator_1.body)('category').notEmpty().withMessage('Category is required'),
    (0, express_validator_1.body)('contentType').isIn(['article', 'guide', 'template', 'case_study', 'training', 'policy', 'procedure']).withMessage('Invalid content type'),
    (0, express_validator_1.body)('variableSchema').isArray().withMessage('Variable schema must be an array'),
    (0, express_validator_1.body)('tags').isArray().withMessage('Tags must be an array')
], validation_1.validateRequest, async (req, res) => {
    try {
        const template = await templateService.createTemplate({
            ...req.body,
            createdBy: req.user.id
        });
        res.status(201).json({
            success: true,
            data: template
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/:id', auth_1.authenticate, [(0, express_validator_1.param)('id').isUUID().withMessage('Invalid template ID')], validation_1.validateRequest, async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.put('/:id', auth_1.authenticate, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid template ID'),
    (0, express_validator_1.body)('name').optional().notEmpty().withMessage('Name cannot be empty'),
    (0, express_validator_1.body)('templateContent').optional().notEmpty().withMessage('Template content cannot be empty'),
    (0, express_validator_1.body)('category').optional().notEmpty().withMessage('Category cannot be empty'),
    (0, express_validator_1.body)('variableSchema').optional().isArray().withMessage('Variable schema must be an array'),
    (0, express_validator_1.body)('tags').optional().isArray().withMessage('Tags must be an array')
], validation_1.validateRequest, async (req, res) => {
    try {
        const template = await templateService.updateTemplate(req.params.id, req.body);
        res.json({
            success: true,
            data: template
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.delete('/:id', auth_1.authenticate, [(0, express_validator_1.param)('id').isUUID().withMessage('Invalid template ID')], validation_1.validateRequest, async (req, res) => {
    try {
        await templateService.deleteTemplate(req.params.id);
        res.json({
            success: true,
            message: 'Template deleted successfully'
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
    (0, express_validator_1.query)('category').optional().isString().withMessage('Category must be a string'),
    (0, express_validator_1.query)('contentType').optional().isIn(['article', 'guide', 'template', 'case_study', 'training', 'policy', 'procedure']).withMessage('Invalid content type'),
    (0, express_validator_1.query)('isPublic').optional().isBoolean().withMessage('Is public must be a boolean')
], validation_1.validateRequest, async (req, res) => {
    try {
        const query = {
            category: req.query.category,
            contentType: req.query.contentType,
            isPublic: req.query.isPublic ? req.query.isPublic === 'true' : undefined,
            createdBy: req.query.createdBy,
            tags: req.query.tags ? req.query.tags.split(',') : undefined,
            search: req.query.search
        };
        const templates = await templateService.queryTemplates(query);
        res.json({
            success: true,
            data: templates
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/:id/use', auth_1.authenticate, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid template ID'),
    (0, express_validator_1.body)('contentId').isUUID().withMessage('Invalid content ID'),
    (0, express_validator_1.body)('variables').isObject().withMessage('Variables must be an object')
], validation_1.validateRequest, async (req, res) => {
    try {
        const usage = await templateService.useTemplate(req.params.id, req.body.contentId, req.body.variables, req.user.id);
        res.status(201).json({
            success: true,
            data: usage
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/:id/usages', auth_1.authenticate, [(0, express_validator_1.param)('id').isUUID().withMessage('Invalid template ID')], validation_1.validateRequest, async (req, res) => {
    try {
        const usages = await templateService.getTemplateUsages(req.params.id);
        res.json({
            success: true,
            data: usages
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/:id/generate', auth_1.authenticate, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid template ID'),
    (0, express_validator_1.body)('variables').isObject().withMessage('Variables must be an object')
], validation_1.validateRequest, async (req, res) => {
    try {
        const generatedContent = await templateService.generateFromTemplate(req.params.id, req.body.variables);
        res.json({
            success: true,
            data: {
                content: generatedContent
            }
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
        const categories = await templateService.getTemplateCategories();
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
router.get('/categories/:category/templates', auth_1.authenticate, [(0, express_validator_1.param)('category').isString().withMessage('Category must be a string')], validation_1.validateRequest, async (req, res) => {
    try {
        const templates = await templateService.getTemplatesByCategory(req.params.category);
        res.json({
            success: true,
            data: templates
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/popular', auth_1.authenticate, [
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], validation_1.validateRequest, async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;
        const templates = await templateService.getPopularTemplates(limit);
        res.json({
            success: true,
            data: templates
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/:id/analytics', auth_1.authenticate, [(0, express_validator_1.param)('id').isUUID().withMessage('Invalid template ID')], validation_1.validateRequest, async (req, res) => {
    try {
        const analytics = await templateService.getTemplateAnalytics(req.params.id);
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
router.get('/:id/export', auth_1.authenticate, [(0, express_validator_1.param)('id').isUUID().withMessage('Invalid template ID')], validation_1.validateRequest, async (req, res) => {
    try {
        const templateData = await templateService.exportTemplate(req.params.id);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="template-${req.params.id}.json"`);
        res.send(templateData);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/import', auth_1.authenticate, [
    (0, express_validator_1.body)('templateData').isString().withMessage('Template data is required')
], validation_1.validateRequest, async (req, res) => {
    try {
        const template = await templateService.importTemplate(req.body.templateData, req.user.id);
        res.status(201).json({
            success: true,
            data: template
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/:id/versions', auth_1.authenticate, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid template ID'),
    (0, express_validator_1.body)('changeLog').notEmpty().withMessage('Change log is required')
], validation_1.validateRequest, async (req, res) => {
    try {
        await templateService.createTemplateVersion(req.params.id, req.body.changeLog);
        res.json({
            success: true,
            message: 'Template version created successfully'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/:id/versions', auth_1.authenticate, [(0, express_validator_1.param)('id').isUUID().withMessage('Invalid template ID')], validation_1.validateRequest, async (req, res) => {
    try {
        const versions = await templateService.getTemplateVersions(req.params.id);
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
exports.default = router;
//# sourceMappingURL=templateRoutes.js.map