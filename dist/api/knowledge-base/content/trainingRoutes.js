"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const content_1 = require("../../../services/knowledge-base/content");
const auth_1 = require("../../../middleware/auth");
const validation_1 = require("../../../middleware/validation");
const express_validator_1 = require("express-validator");
const router = (0, express_1.Router)();
const trainingService = new content_1.TrainingModuleService();
router.post('/', auth_1.authenticate, [
    (0, express_validator_1.body)('title').notEmpty().withMessage('Title is required'),
    (0, express_validator_1.body)('content').notEmpty().withMessage('Content is required'),
    (0, express_validator_1.body)('category').notEmpty().withMessage('Category is required'),
    (0, express_validator_1.body)('difficulty').isIn(['beginner', 'intermediate', 'advanced']).withMessage('Invalid difficulty level'),
    (0, express_validator_1.body)('duration').isInt({ min: 1 }).withMessage('Duration must be a positive integer'),
    (0, express_validator_1.body)('targetRoles').isArray().withMessage('Target roles must be an array'),
    (0, express_validator_1.body)('learningObjectives').isArray().withMessage('Learning objectives must be an array')
], validation_1.validateRequest, async (req, res) => {
    try {
        const module = await trainingService.createModule({
            ...req.body,
            authorId: req.user.id
        });
        res.status(201).json({
            success: true,
            data: module
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/:id', auth_1.authenticate, [(0, express_validator_1.param)('id').isUUID().withMessage('Invalid module ID')], validation_1.validateRequest, async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.put('/:id', auth_1.authenticate, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid module ID'),
    (0, express_validator_1.body)('title').optional().notEmpty().withMessage('Title cannot be empty'),
    (0, express_validator_1.body)('content').optional().notEmpty().withMessage('Content cannot be empty'),
    (0, express_validator_1.body)('category').optional().notEmpty().withMessage('Category cannot be empty'),
    (0, express_validator_1.body)('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced']).withMessage('Invalid difficulty level'),
    (0, express_validator_1.body)('duration').optional().isInt({ min: 1 }).withMessage('Duration must be a positive integer'),
    (0, express_validator_1.body)('targetRoles').optional().isArray().withMessage('Target roles must be an array'),
    (0, express_validator_1.body)('learningObjectives').optional().isArray().withMessage('Learning objectives must be an array')
], validation_1.validateRequest, async (req, res) => {
    try {
        const module = await trainingService.updateModule(req.params.id, req.body);
        res.json({
            success: true,
            data: module
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.delete('/:id', auth_1.authenticate, [(0, express_validator_1.param)('id').isUUID().withMessage('Invalid module ID')], validation_1.validateRequest, async (req, res) => {
    try {
        await trainingService.deleteModule(req.params.id);
        res.json({
            success: true,
            message: 'Training module archived successfully'
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
    (0, express_validator_1.query)('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced']).withMessage('Invalid difficulty level'),
    (0, express_validator_1.query)('isRequired').optional().isBoolean().withMessage('Is required must be a boolean'),
    (0, express_validator_1.query)('status').optional().isIn(['draft', 'active', 'inactive', 'archived']).withMessage('Invalid status')
], validation_1.validateRequest, async (req, res) => {
    try {
        const query = {
            category: req.query.category,
            difficulty: req.query.difficulty,
            isRequired: req.query.isRequired ? req.query.isRequired === 'true' : undefined,
            targetRoles: req.query.targetRoles ? req.query.targetRoles.split(',') : undefined,
            status: req.query.status,
            search: req.query.search
        };
        const modules = await trainingService.queryModules(query);
        res.json({
            success: true,
            data: modules
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/:id/materials', auth_1.authenticate, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid module ID'),
    (0, express_validator_1.body)('type').isIn(['document', 'video', 'image', 'link', 'quiz']).withMessage('Invalid material type'),
    (0, express_validator_1.body)('title').notEmpty().withMessage('Title is required'),
    (0, express_validator_1.body)('sortOrder').isInt({ min: 0 }).withMessage('Sort order must be a non-negative integer')
], validation_1.validateRequest, async (req, res) => {
    try {
        const material = await trainingService.addMaterial(req.params.id, req.body);
        res.status(201).json({
            success: true,
            data: material
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.put('/materials/:id', auth_1.authenticate, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid material ID')
], validation_1.validateRequest, async (req, res) => {
    try {
        const material = await trainingService.updateMaterial(req.params.id, req.body);
        res.json({
            success: true,
            data: material
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.delete('/materials/:id', auth_1.authenticate, [(0, express_validator_1.param)('id').isUUID().withMessage('Invalid material ID')], validation_1.validateRequest, async (req, res) => {
    try {
        await trainingService.deleteMaterial(req.params.id);
        res.json({
            success: true,
            message: 'Material deleted successfully'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.put('/:id/materials/reorder', auth_1.authenticate, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid module ID'),
    (0, express_validator_1.body)('materialIds').isArray().withMessage('Material IDs must be an array')
], validation_1.validateRequest, async (req, res) => {
    try {
        await trainingService.reorderMaterials(req.params.id, req.body.materialIds);
        res.json({
            success: true,
            message: 'Materials reordered successfully'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/:id/assessments', auth_1.authenticate, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid module ID'),
    (0, express_validator_1.body)('type').isIn(['quiz', 'assignment', 'practical']).withMessage('Invalid assessment type'),
    (0, express_validator_1.body)('title').notEmpty().withMessage('Title is required'),
    (0, express_validator_1.body)('questions').isArray().withMessage('Questions must be an array'),
    (0, express_validator_1.body)('passingScore').isInt({ min: 0, max: 100 }).withMessage('Passing score must be between 0 and 100'),
    (0, express_validator_1.body)('attemptsAllowed').isInt({ min: 1 }).withMessage('Attempts allowed must be a positive integer')
], validation_1.validateRequest, async (req, res) => {
    try {
        const assessment = await trainingService.addAssessment(req.params.id, req.body);
        res.status(201).json({
            success: true,
            data: assessment
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.put('/assessments/:id', auth_1.authenticate, [(0, express_validator_1.param)('id').isUUID().withMessage('Invalid assessment ID')], validation_1.validateRequest, async (req, res) => {
    try {
        const assessment = await trainingService.updateAssessment(req.params.id, req.body);
        res.json({
            success: true,
            data: assessment
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.delete('/assessments/:id', auth_1.authenticate, [(0, express_validator_1.param)('id').isUUID().withMessage('Invalid assessment ID')], validation_1.validateRequest, async (req, res) => {
    try {
        await trainingService.deleteAssessment(req.params.id);
        res.json({
            success: true,
            message: 'Assessment deleted successfully'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/:id/start', auth_1.authenticate, [(0, express_validator_1.param)('id').isUUID().withMessage('Invalid module ID')], validation_1.validateRequest, async (req, res) => {
    try {
        const progress = await trainingService.startModule(req.user.id, req.params.id);
        res.status(201).json({
            success: true,
            data: progress
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.put('/:id/progress', auth_1.authenticate, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid module ID'),
    (0, express_validator_1.body)('progress').isInt({ min: 0, max: 100 }).withMessage('Progress must be between 0 and 100'),
    (0, express_validator_1.body)('timeSpent').isInt({ min: 0 }).withMessage('Time spent must be a non-negative integer')
], validation_1.validateRequest, async (req, res) => {
    try {
        const progress = await trainingService.updateProgress(req.user.id, req.params.id, req.body.progress, req.body.timeSpent);
        res.json({
            success: true,
            data: progress
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/:id/complete-material', auth_1.authenticate, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid module ID'),
    (0, express_validator_1.body)('materialIndex').isInt({ min: 0 }).withMessage('Material index must be a non-negative integer')
], validation_1.validateRequest, async (req, res) => {
    try {
        const progress = await trainingService.completeMaterial(req.user.id, req.params.id, req.body.materialIndex);
        res.json({
            success: true,
            data: progress
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/:id/assessments/:assessmentId/submit', auth_1.authenticate, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid module ID'),
    (0, express_validator_1.param)('assessmentId').isUUID().withMessage('Invalid assessment ID'),
    (0, express_validator_1.body)('answers').isObject().withMessage('Answers must be an object')
], validation_1.validateRequest, async (req, res) => {
    try {
        const result = await trainingService.submitAssessment(req.user.id, req.params.id, req.params.assessmentId, req.body.answers);
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
router.get('/my-progress', auth_1.authenticate, async (req, res) => {
    try {
        const progress = await trainingService.getUserProgress(req.user.id);
        res.json({
            success: true,
            data: progress
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/:id/progress', auth_1.authenticate, [(0, express_validator_1.param)('id').isUUID().withMessage('Invalid module ID')], validation_1.validateRequest, async (req, res) => {
    try {
        const progress = await trainingService.getModuleProgress(req.params.id);
        res.json({
            success: true,
            data: progress
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/analytics', auth_1.authenticate, async (req, res) => {
    try {
        const analytics = await trainingService.getTrainingAnalytics();
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
router.get('/recommended', auth_1.authenticate, async (req, res) => {
    try {
        const modules = await trainingService.getRecommendedModules(req.user.id);
        res.json({
            success: true,
            data: modules
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/:id/certificate', auth_1.authenticate, [(0, express_validator_1.param)('id').isUUID().withMessage('Invalid module ID')], validation_1.validateRequest, async (req, res) => {
    try {
        const certificateId = await trainingService.generateCertificate(req.user.id, req.params.id);
        res.json({
            success: true,
            data: {
                certificateId
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
router.post('/paths', auth_1.authenticate, [
    (0, express_validator_1.body)('name').notEmpty().withMessage('Path name is required'),
    (0, express_validator_1.body)('moduleIds').isArray().withMessage('Module IDs must be an array')
], validation_1.validateRequest, async (req, res) => {
    try {
        const path = await trainingService.createTrainingPath(req.body.name, req.body.description, req.body.moduleIds, req.user.id);
        res.status(201).json({
            success: true,
            data: path
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/paths', auth_1.authenticate, async (req, res) => {
    try {
        const paths = await trainingService.getTrainingPaths();
        res.json({
            success: true,
            data: paths
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
//# sourceMappingURL=trainingRoutes.js.map