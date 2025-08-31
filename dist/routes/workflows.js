"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const workflowController_1 = require("../controllers/workflowController");
const router = (0, express_1.Router)();
router.get('/:id', auth_1.authenticate, workflowController_1.workflowController.getWorkflow.bind(workflowController_1.workflowController));
router.put('/:id', auth_1.authenticate, workflowController_1.workflowController.updateWorkflow.bind(workflowController_1.workflowController));
router.delete('/:id', auth_1.authenticate, workflowController_1.workflowController.deleteWorkflow.bind(workflowController_1.workflowController));
router.post('/:id/steps', auth_1.authenticate, workflowController_1.workflowController.addWorkflowStep.bind(workflowController_1.workflowController));
router.put('/:id/steps/:stepId', auth_1.authenticate, workflowController_1.workflowController.updateWorkflowStep.bind(workflowController_1.workflowController));
router.get('/document/:documentId', auth_1.authenticate, workflowController_1.workflowController.getDocumentWorkflows.bind(workflowController_1.workflowController));
exports.default = router;
//# sourceMappingURL=workflows.js.map