"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowEngine = void 0;
const client_1 = require("@prisma/client");
const StateMachine_1 = require("../cases/StateMachine");
class WorkflowEngine {
    constructor() {
        this.stateMachine = new StateMachine_1.StateMachine();
        this.taskRules = new Map();
        this.taskTemplates = new Map();
        this.workflowHistory = new Map();
        this.initializeTaskRules();
        this.initializeTaskTemplates();
    }
    initializeTaskRules() {
        const rules = [
            {
                id: 'overdue_escalation',
                name: 'Overdue Task Escalation',
                description: 'Escalate overdue tasks to supervisors',
                conditions: [
                    { field: 'task.status', operator: 'equals', value: 'PENDING' },
                    { field: 'task.dueDate', operator: 'less_than', value: new Date() },
                    { field: 'task.escalationLevel', operator: 'less_than', value: 2 }
                ],
                actions: [
                    { type: 'escalate_task', parameters: { incrementLevel: 1 } },
                    { type: 'notify', parameters: { type: 'email', template: 'task_overdue' } }
                ],
                priority: 1,
                active: true
            },
            {
                id: 'high_priority_assignment',
                name: 'High Priority Task Assignment',
                description: 'Assign high priority tasks to available attorneys',
                conditions: [
                    { field: 'task.priority', operator: 'equals', value: 'HIGH' },
                    { field: 'task.assignedTo', operator: 'not_exists', value: null }
                ],
                actions: [
                    { type: 'assign_task', parameters: { strategy: 'workload_balance' } }
                ],
                priority: 2,
                active: true
            },
            {
                id: 'case_phase_transition',
                name: 'Case Phase Transition Tasks',
                description: 'Create tasks when case phase changes',
                conditions: [
                    { field: 'case.phaseChanged', operator: 'equals', value: true }
                ],
                actions: [
                    { type: 'create_task', parameters: { source: 'phase_transition' } }
                ],
                priority: 3,
                active: true
            },
            {
                id: 'task_dependency_completion',
                name: 'Task Dependency Completion',
                description: 'Activate dependent tasks when prerequisites are completed',
                conditions: [
                    { field: 'task.status', operator: 'equals', value: 'COMPLETED' },
                    { field: 'task.hasDependents', operator: 'equals', value: true }
                ],
                actions: [
                    { type: 'update_task', parameters: { action: 'activate_dependents' } }
                ],
                priority: 4,
                active: true
            }
        ];
        rules.forEach(rule => {
            this.taskRules.set(rule.id, rule);
        });
    }
    initializeTaskTemplates() {
        const templates = [
            {
                id: 'criminal_intake_risk_assessment',
                name: 'Criminal Intake Risk Assessment',
                description: 'Complete initial risk assessment for criminal case',
                caseType: client_1.CaseType.CRIMINAL_DEFENSE,
                phase: client_1.CasePhase.INTAKE_RISK_ASSESSMENT,
                titleTemplate: 'Complete Risk Assessment - {caseTitle}',
                descriptionTemplate: 'Conduct thorough risk assessment including bail analysis, evidence review, and potential defenses',
                defaultPriority: client_1.TaskPriority.HIGH,
                defaultAssigneeRole: client_1.UserRole.ATTORNEY,
                dueDateOffset: 3,
                requiredFields: ['clientStatement', 'policeReport', 'arrestRecords'],
                autoCreate: true
            },
            {
                id: 'criminal_bail_hearing',
                name: 'Bail Hearing Preparation',
                description: 'Prepare and conduct bail hearing',
                caseType: client_1.CaseType.CRIMINAL_DEFENSE,
                phase: client_1.CasePhase.PRE_PROCEEDING_PREPARATION,
                titleTemplate: 'Prepare Bail Hearing - {caseTitle}',
                descriptionTemplate: 'Prepare bail application, gather character references, and prepare arguments for bail hearing',
                defaultPriority: client_1.TaskPriority.URGENT,
                defaultAssigneeRole: client_1.UserRole.ATTORNEY,
                dueDateOffset: 1,
                requiredFields: ['clientFinancialInfo', 'characterReferences', 'bailApplication'],
                autoCreate: true
            },
            {
                id: 'divorce_mediations',
                name: 'Divorce Mediation',
                description: 'Conduct divorce mediation sessions',
                caseType: client_1.CaseType.DIVORCE_FAMILY,
                phase: client_1.CasePhase.PRE_PROCEEDING_PREPARATION,
                titleTemplate: 'Conduct Mediation - {caseTitle}',
                descriptionTemplate: 'Schedule and conduct mediation sessions to resolve divorce disputes amicably',
                defaultPriority: client_1.TaskPriority.MEDIUM,
                defaultAssigneeRole: client_1.UserRole.ATTORNEY,
                dueDateOffset: 14,
                requiredFields: ['mediationAgreement', 'financialDisclosures'],
                autoCreate: true
            },
            {
                id: 'divorce_custody_evaluation',
                name: 'Child Custody Evaluation',
                description: 'Complete child custody evaluation',
                caseType: client_1.CaseType.DIVORCE_FAMILY,
                phase: client_1.CasePhase.FORMAL_PROCEEDINGS,
                titleTemplate: 'Complete Custody Evaluation - {caseTitle}',
                descriptionTemplate: 'Coordinate with custody evaluator, provide necessary documentation, and prepare for custody hearing',
                defaultPriority: client_1.TaskPriority.HIGH,
                defaultAssigneeRole: client_1.UserRole.ATTORNEY,
                dueDateOffset: 21,
                requiredFields: ['custodyQuestionnaire', 'homeStudy', 'childInterviewNotes'],
                autoCreate: true
            },
            {
                id: 'medical_record_review',
                name: 'Medical Record Review',
                description: 'Review medical records for potential malpractice',
                caseType: client_1.CaseType.MEDICAL_MALPRACTICE,
                phase: client_1.CasePhase.INTAKE_RISK_ASSESSMENT,
                titleTemplate: 'Review Medical Records - {caseTitle}',
                descriptionTemplate: 'Thoroughly review medical records to identify potential standard of care violations',
                defaultPriority: client_1.TaskPriority.HIGH,
                defaultAssigneeRole: client_1.UserRole.ATTORNEY,
                dueDateOffset: 7,
                requiredFields: ['medicalRecords', 'expertConsultationReport'],
                autoCreate: true
            },
            {
                id: 'expert_witness_coordination',
                name: 'Expert Witness Coordination',
                description: 'Coordinate with medical expert witnesses',
                caseType: client_1.CaseType.MEDICAL_MALPRACTICE,
                phase: client_1.CasePhase.PRE_PROCEEDING_PREPARATION,
                titleTemplate: 'Coordinate Expert Witnesses - {caseTitle}',
                descriptionTemplate: 'Identify, retain, and prepare medical expert witnesses for case',
                defaultPriority: client_1.TaskPriority.MEDIUM,
                defaultAssigneeRole: client_1.UserRole.ATTORNEY,
                dueDateOffset: 10,
                requiredFields: ['expertRetainerAgreement', 'expertReport'],
                autoCreate: true
            }
        ];
        templates.forEach(template => {
            this.taskTemplates.set(template.id, template);
        });
    }
    async processPhaseTransition(caseId, fromPhase, toPhase, caseType, userRole, userId, metadata) {
        const context = {
            caseId,
            caseType,
            currentPhase: toPhase,
            previousPhase: fromPhase,
            metadata,
            userId,
            userRole,
            timestamp: new Date()
        };
        const currentState = {
            phase: fromPhase,
            status: 'ACTIVE',
            caseType,
            metadata
        };
        const transitionResult = this.stateMachine.canTransition(currentState, toPhase, userRole, metadata);
        if (!transitionResult.success) {
            return {
                success: false,
                createdTasks: [],
                updatedTasks: [],
                notifications: [],
                errors: transitionResult.errors || ['Phase transition validation failed']
            };
        }
        const result = {
            success: true,
            createdTasks: [],
            updatedTasks: [],
            notifications: [],
            errors: []
        };
        try {
            this.addToWorkflowHistory(caseId, context);
            await this.processTaskCreationRules(context, result);
            await this.processTaskUpdateRules(context, result);
            await this.generateNotifications(context, result);
            return result;
        }
        catch (error) {
            return {
                success: false,
                createdTasks: [],
                updatedTasks: [],
                notifications: [],
                errors: [error instanceof Error ? error.message : 'Unknown error occurred']
            };
        }
    }
    async evaluateTaskRules(context) {
        const result = {
            success: true,
            createdTasks: [],
            updatedTasks: [],
            notifications: [],
            errors: []
        };
        try {
            const activeRules = Array.from(this.taskRules.values())
                .filter(rule => rule.active)
                .sort((a, b) => a.priority - b.priority);
            for (const rule of activeRules) {
                if (this.evaluateRuleConditions(rule, context)) {
                    await this.executeRuleActions(rule, context, result);
                }
            }
            return result;
        }
        catch (error) {
            return {
                success: false,
                createdTasks: [],
                updatedTasks: [],
                notifications: [],
                errors: [error instanceof Error ? error.message : 'Unknown error occurred']
            };
        }
    }
    async processTaskCreationRules(context, result) {
        const matchingTemplates = Array.from(this.taskTemplates.values())
            .filter(template => template.caseType === context.caseType &&
            template.phase === context.currentPhase &&
            template.autoCreate);
        for (const template of matchingTemplates) {
            if (template.conditions && !this.evaluateConditions(template.conditions, context.metadata)) {
                continue;
            }
            const task = this.createTaskFromTemplate(template, context);
            result.createdTasks.push(task);
        }
    }
    async processTaskUpdateRules(context, result) {
        const updatedTasks = this.findTasksToUpdate(context);
        for (const taskUpdate of updatedTasks) {
            result.updatedTasks.push(taskUpdate);
        }
    }
    createTaskFromTemplate(template, context) {
        const dueDate = template.dueDateOffset
            ? new Date(context.timestamp.getTime() + template.dueDateOffset * 24 * 60 * 60 * 1000)
            : undefined;
        return {
            id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: this.interpolateTemplate(template.titleTemplate, context.metadata),
            description: template.descriptionTemplate
                ? this.interpolateTemplate(template.descriptionTemplate, context.metadata)
                : undefined,
            caseId: context.caseId,
            assignedTo: context.userId,
            assignedBy: context.userId,
            dueDate,
            priority: template.defaultPriority,
            status: client_1.TaskStatus.PENDING,
            metadata: {
                templateId: template.id,
                phase: context.currentPhase,
                autoGenerated: true
            }
        };
    }
    findTasksToUpdate(context) {
        return [];
    }
    evaluateRuleConditions(rule, context) {
        const contextData = {
            ...context.metadata,
            case: {
                id: context.caseId,
                type: context.caseType,
                phase: context.currentPhase,
                previousPhase: context.previousPhase
            },
            user: {
                id: context.userId,
                role: context.userRole
            },
            timestamp: context.timestamp
        };
        return this.evaluateConditions(rule.conditions, contextData);
    }
    evaluateConditions(conditions, data) {
        return conditions.every(condition => {
            const fieldValue = this.getNestedValue(data, condition.field);
            return this.evaluateCondition(condition, fieldValue);
        });
    }
    evaluateCondition(condition, fieldValue) {
        switch (condition.operator) {
            case 'equals':
                return fieldValue === condition.value;
            case 'not_equals':
                return fieldValue !== condition.value;
            case 'contains':
                return Array.isArray(fieldValue) && fieldValue.includes(condition.value);
            case 'exists':
                return fieldValue !== undefined && fieldValue !== null;
            case 'not_exists':
                return fieldValue === undefined || fieldValue === null;
            case 'greater_than':
                return fieldValue > condition.value;
            case 'less_than':
                return fieldValue < condition.value;
            default:
                return false;
        }
    }
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    async executeRuleActions(rule, context, result) {
        for (const action of rule.actions) {
            switch (action.type) {
                case 'create_task':
                    await this.handleCreateTaskAction(action, context, result);
                    break;
                case 'update_task':
                    await this.handleUpdateTaskAction(action, context, result);
                    break;
                case 'assign_task':
                    await this.handleAssignTaskAction(action, context, result);
                    break;
                case 'escalate_task':
                    await this.handleEscalateTaskAction(action, context, result);
                    break;
                case 'notify':
                    await this.handleNotifyAction(action, context, result);
                    break;
            }
        }
    }
    async handleCreateTaskAction(action, context, result) {
    }
    async handleUpdateTaskAction(action, context, result) {
    }
    async handleAssignTaskAction(action, context, result) {
    }
    async handleEscalateTaskAction(action, context, result) {
    }
    async handleNotifyAction(action, context, result) {
        const notification = {
            id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: action.parameters.type || 'in_app',
            recipient: context.userId,
            subject: action.parameters.subject || 'Task Notification',
            message: action.parameters.message || 'You have a new task notification',
            metadata: {
                caseId: context.caseId,
                ruleId: action.parameters.ruleId,
                timestamp: context.timestamp
            }
        };
        result.notifications.push(notification);
    }
    async generateNotifications(context, result) {
        if (result.createdTasks.length > 0) {
            const notification = {
                id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'in_app',
                recipient: context.userId,
                subject: `New Tasks Created for ${context.caseId}`,
                message: `${result.createdTasks.length} new tasks have been created for case phase ${context.currentPhase}`,
                metadata: {
                    caseId: context.caseId,
                    taskCount: result.createdTasks.length,
                    phase: context.currentPhase,
                    timestamp: context.timestamp
                }
            };
            result.notifications.push(notification);
        }
    }
    interpolateTemplate(template, data) {
        return template.replace(/\{([^}]+)\}/g, (match, key) => {
            const value = this.getNestedValue(data, key);
            return value !== undefined ? String(value) : match;
        });
    }
    addToWorkflowHistory(caseId, context) {
        if (!this.workflowHistory.has(caseId)) {
            this.workflowHistory.set(caseId, []);
        }
        this.workflowHistory.get(caseId).push(context);
    }
    getTaskTemplates(caseType, phase) {
        return Array.from(this.taskTemplates.values()).filter(template => {
            if (caseType && template.caseType !== caseType)
                return false;
            if (phase && template.phase !== phase)
                return false;
            return true;
        });
    }
    getTaskRules(activeOnly = true) {
        return Array.from(this.taskRules.values()).filter(rule => !activeOnly || rule.active);
    }
    getWorkflowHistory(caseId) {
        return this.workflowHistory.get(caseId) || [];
    }
    addTaskTemplate(template) {
        this.taskTemplates.set(template.id, template);
    }
    addTaskRule(rule) {
        this.taskRules.set(rule.id, rule);
    }
    updateTaskRule(ruleId, updates) {
        const rule = this.taskRules.get(ruleId);
        if (!rule)
            return false;
        Object.assign(rule, updates);
        return true;
    }
    removeTaskRule(ruleId) {
        return this.taskRules.delete(ruleId);
    }
    removeTaskTemplate(templateId) {
        return this.taskTemplates.delete(templateId);
    }
}
exports.WorkflowEngine = WorkflowEngine;
//# sourceMappingURL=WorkflowEngine.js.map