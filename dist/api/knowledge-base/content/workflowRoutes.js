"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const content_1 = require("../../../services/knowledge-base/content");
const auth_1 = require("../../../middleware/auth");
const validation_1 = require("../../../middleware/validation");
const express_validator_1 = require("express-validator");
const router = (0, express_1.Router)();
const workflowEngine = new content_1.WorkflowEngine();
router.post('/', auth_1.authenticate, [
    (0, express_validator_1.body)('name').notEmpty().withMessage('Workflow name is required'),
    (0, express_validator_1.body)('contentType').isArray().withMessage('Content types must be an array'),
    (0, express_validator_1.body)('stages').isArray().withMessage('Stages must be an array'),
    (0, express_validator_1.body)('stages.*.name').notEmpty().withMessage('Stage name is required'),
    (0, express_validator_1.body)('stages.*.type').isIn(['review', 'approval', 'publishing', 'archival']).withMessage('Invalid stage type'),
    (0, express_validator_1.body)('stages.*.requiredRole').isArray().withMessage('Required roles must be an array')
], validation_1.validateRequest, async (req, res) => {
    try {
        const workflow = await workflowEngine.createWorkflow({
            ...req.body,
            createdBy: req.user.id
        });
        res.status(201).json({
            success: true,
            data: workflow
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
    (0, express_validator_1.query)('contentType').optional().isString().withMessage('Content type must be a string'),
    (0, express_validator_1.query)('isDefault').optional().isBoolean().withMessage('Is default must be a boolean'),
    (0, express_validator_1.query)('isActive').optional().isBoolean().withMessage('Is active must be a boolean')
], validation_1.validateRequest, async (req, res) => {
    try {
        const query = {
            contentType: req.query.contentType,
            isDefault: req.query.isDefault ? req.query.isDefault === 'true' : undefined,
            isActive: req.query.isActive ? req.query.isActive === 'true' : undefined
        };
        const workflows = await workflowEngine.getWorkflows(query);
        res.json({
            success: true,
            data: workflows
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/:id', auth_1.authenticate, [(0, express_validator_1.param)('id').isUUID().withMessage('Invalid workflow ID')], validation_1.validateRequest, async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.put('/:id', auth_1.authenticate, [(0, express_validator_1.param)('id').isUUID().withMessage('Invalid workflow ID')], validation_1.validateRequest, async (req, res) => {
    try {
        const workflow = await workflowEngine.updateWorkflow(req.params.id, req.body);
        res.json({
            success: true,
            data: workflow
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/instances/start', auth_1.authenticate, [
    (0, express_validator_1.body)('contentId').isUUID().withMessage('Invalid content ID'),
    (0, express_validator_1.body)('workflowId').isUUID().withMessage('Invalid workflow ID')
], validation_1.validateRequest, async (req, res) => {
    try {
        const instance = await workflowEngine.startWorkflow(req.body.contentId, req.body.workflowId, req.user.id);
        res.status(201).json({
            success: true,
            data: instance
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/instances/:id', auth_1.authenticate, [(0, express_validator_1.param)('id').isUUID().withMessage('Invalid instance ID')], validation_1.validateRequest, async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/content/:contentId/instances', auth_1.authenticate, [(0, express_validator_1.param)('contentId').isUUID().withMessage('Invalid content ID')], validation_1.validateRequest, async (req, res) => {
    try {
        const instances = await workflowEngine.getWorkflowInstancesForContent(req.params.contentId);
        res.json({
            success: true,
            data: instances
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/instances/:id/advance/:stageId', auth_1.authenticate, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid instance ID'),
    (0, express_validator_1.param)('stageId').isUUID().withMessage('Invalid stage ID')
], validation_1.validateRequest, async (req, res) => {
    try {
        const instance = await workflowEngine.advanceWorkflowStage(req.params.id, req.params.stageId, req.user.id, req.body.notes);
        res.json({
            success: true,
            data: instance
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/instances/:id/reject/:stageId', auth_1.authenticate, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid instance ID'),
    (0, express_validator_1.param)('stageId').isUUID().withMessage('Invalid stage ID'),
    (0, express_validator_1.body)('reason').notEmpty().withMessage('Rejection reason is required')
], validation_1.validateRequest, async (req, res) => {
    try {
        const instance = await workflowEngine.rejectWorkflow(req.params.id, req.params.stageId, req.user.id, req.body.reason);
        res.json({
            success: true,
            data: instance
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/templates', auth_1.authenticate, [
    (0, express_validator_1.body)('name').notEmpty().withMessage('Template name is required'),
    (0, express_validator_1.body)('description').optional().isString().withMessage('Description must be a string'),
    (0, express_validator_1.body)('contentType').isIn(['article', 'guide', 'template', 'case_study', 'training', 'policy', 'procedure']).withMessage('Invalid content type')
], validation_1.validateRequest, async (req, res) => {
    try {
        const workflow = await workflowEngine.createWorkflowTemplate(req.body.name, req.body.description, req.body.contentType);
        res.status(201).json({
            success: true,
            data: workflow
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/instances/due', auth_1.authenticate, async (req, res) => {
    try {
        const instances = await workflowEngine.getDueWorkflowInstances();
        res.json({
            success: true,
            data: instances
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/process-auto-approvals', auth_1.authenticate, async (req, res) => {
    try {
        await workflowEngine.processAutoApprovals();
        res.json({
            success: true,
            message: 'Auto-approvals processed successfully'
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
//# sourceMappingURL=workflowRoutes.js.map