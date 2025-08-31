"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskAutomationService = void 0;
const client_1 = require("@prisma/client");
class TaskAutomationService {
    constructor(workflowEngine, taskTemplateService) {
        this.workflowEngine = workflowEngine;
        this.taskTemplateService = taskTemplateService;
        this.automationRules = new Map();
        this.pendingAutomations = new Map();
        this.automationHistory = [];
        this.initializeDefaultAutomationRules();
    }
    initializeDefaultAutomationRules() {
        this.addAutomationRule({
            id: 'phase_change_task_creation',
            name: 'Phase Change Task Creation',
            description: 'Automatically create tasks when case phase changes',
            triggers: [
                {
                    id: 'phase_change_trigger',
                    name: 'Case Phase Change',
                    type: 'case_phase_change',
                    condition: { anyPhaseChange: true },
                    isActive: true,
                    priority: 1
                }
            ],
            conditions: [],
            actions: [
                {
                    type: 'create_task',
                    parameters: { source: 'phase_change', useTemplates: true },
                    onFailure: 'continue'
                }
            ],
            isActive: true,
            priority: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            triggerCount: 0
        });
        this.addAutomationRule({
            id: 'overdue_task_escalation',
            name: 'Overdue Task Escalation',
            description: 'Escalate overdue tasks to supervisors',
            triggers: [
                {
                    id: 'overdue_trigger',
                    name: 'Task Overdue',
                    type: 'date_based',
                    condition: { eventType: 'task_overdue' },
                    isActive: true,
                    priority: 2
                }
            ],
            conditions: [
                {
                    field: 'task.status',
                    operator: 'equals',
                    value: 'PENDING'
                },
                {
                    field: 'task.dueDate',
                    operator: 'less_than',
                    value: new Date()
                },
                {
                    field: 'task.escalationLevel',
                    operator: 'less_than',
                    value: 3
                }
            ],
            actions: [
                {
                    type: 'escalate_task',
                    parameters: { incrementLevel: 1, notifySupervisor: true },
                    onFailure: 'continue'
                },
                {
                    type: 'send_notification',
                    parameters: {
                        type: 'email',
                        template: 'task_overdue_escalation',
                        recipients: ['supervisor', 'assignee']
                    }
                }
            ],
            isActive: true,
            priority: 2,
            createdAt: new Date(),
            updatedAt: new Date(),
            triggerCount: 0
        });
        this.addAutomationRule({
            id: 'high_priority_assignment',
            name: 'High Priority Task Assignment',
            description: 'Automatically assign high priority tasks to available attorneys',
            triggers: [
                {
                    id: 'high_priority_trigger',
                    name: 'High Priority Task Created',
                    type: 'task_status_change',
                    condition: { priority: 'HIGH', status: 'PENDING' },
                    isActive: true,
                    priority: 3
                }
            ],
            conditions: [
                {
                    field: 'task.priority',
                    operator: 'equals',
                    value: 'HIGH'
                },
                {
                    field: 'task.assignedTo',
                    operator: 'not_exists',
                    value: null
                }
            ],
            actions: [
                {
                    type: 'assign_task',
                    parameters: { strategy: 'workload_balance', role: client_1.UserRole.ATTORNEY },
                    onFailure: 'continue'
                }
            ],
            isActive: true,
            priority: 3,
            createdAt: new Date(),
            updatedAt: new Date(),
            triggerCount: 0
        });
        this.addAutomationRule({
            id: 'task_completion_followup',
            name: 'Task Completion Follow-up',
            description: 'Create follow-up tasks when important tasks are completed',
            triggers: [
                {
                    id: 'task_completion_trigger',
                    name: 'Task Completed',
                    type: 'task_status_change',
                    condition: { status: 'COMPLETED' },
                    isActive: true,
                    priority: 4
                }
            ],
            conditions: [
                {
                    field: 'task.status',
                    operator: 'equals',
                    value: 'COMPLETED'
                },
                {
                    field: 'task.priority',
                    operator: 'in',
                    value: ['HIGH', 'URGENT']
                }
            ],
            actions: [
                {
                    type: 'create_task',
                    parameters: {
                        template: 'follow_up_review',
                        delay: 24,
                        assignToCreator: true
                    }
                },
                {
                    type: 'send_notification',
                    parameters: {
                        type: 'in_app',
                        template: 'task_completed_review',
                        recipients: ['creator', 'supervisor']
                    }
                }
            ],
            isActive: true,
            priority: 4,
            createdAt: new Date(),
            updatedAt: new Date(),
            triggerCount: 0
        });
        this.addAutomationRule({
            id: 'case_deadline_reminder',
            name: 'Case Deadline Reminder',
            description: 'Send reminders for upcoming case deadlines',
            triggers: [
                {
                    id: 'deadline_reminder_trigger',
                    name: 'Upcoming Deadline',
                    type: 'date_based',
                    condition: { eventType: 'deadline_approaching', daysBefore: 7 },
                    isActive: true,
                    priority: 5
                }
            ],
            conditions: [
                {
                    field: 'case.hasDeadline',
                    operator: 'equals',
                    value: true
                },
                {
                    field: 'case.deadline',
                    operator: 'less_than',
                    value: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                }
            ],
            actions: [
                {
                    type: 'send_notification',
                    parameters: {
                        type: 'email',
                        template: 'case_deadline_reminder',
                        recipients: ['attorney', 'client']
                    }
                },
                {
                    type: 'create_task',
                    parameters: {
                        template: 'deadline_preparation',
                        priority: 'HIGH',
                        assignToCaseAttorney: true
                    }
                }
            ],
            isActive: true,
            priority: 5,
            createdAt: new Date(),
            updatedAt: new Date(),
            triggerCount: 0
        });
        this.addAutomationRule({
            id: 'document_filing_deadline',
            name: 'Document Filing Deadline',
            description: 'Ensure documents are filed before deadlines',
            triggers: [
                {
                    id: 'filing_deadline_trigger',
                    name: 'Filing Deadline Approaching',
                    type: 'date_based',
                    condition: { eventType: 'filing_deadline', daysBefore: 3 },
                    isActive: true,
                    priority: 6
                }
            ],
            conditions: [
                {
                    field: 'case.hasPendingFilings',
                    operator: 'equals',
                    value: true
                }
            ],
            actions: [
                {
                    type: 'create_task',
                    parameters: {
                        template: 'complete_filing',
                        priority: 'URGENT',
                        assignToCaseAttorney: true
                    }
                },
                {
                    type: 'send_notification',
                    parameters: {
                        type: 'email',
                        template: 'filing_deadline_urgent',
                        recipients: ['attorney', 'paralegal']
                    }
                }
            ],
            isActive: true,
            priority: 6,
            createdAt: new Date(),
            updatedAt: new Date(),
            triggerCount: 0
        });
    }
    async processCasePhaseChange(request) {
        const context = {
            triggerEvent: {
                id: 'phase_change',
                name: 'Case Phase Change',
                type: 'case_phase_change',
                condition: { phase: request.currentPhase },
                isActive: true,
                priority: 1
            },
            caseId: request.caseId,
            timestamp: new Date(),
            metadata: {
                ...request.metadata,
                caseType: request.caseType,
                currentPhase: request.currentPhase,
                previousPhase: request.previousPhase,
                trigger: request.trigger
            }
        };
        return await this.processAutomation(context);
    }
    async processTaskStatusChange(taskId, oldStatus, newStatus, caseId, userId, metadata) {
        const context = {
            triggerEvent: {
                id: 'task_status_change',
                name: 'Task Status Change',
                type: 'task_status_change',
                condition: { oldStatus, newStatus },
                isActive: true,
                priority: 2
            },
            caseId,
            taskId,
            userId,
            timestamp: new Date(),
            metadata: {
                ...metadata,
                taskId,
                oldStatus,
                newStatus
            }
        };
        return await this.processAutomation(context);
    }
    async processDateBasedTrigger(eventType, metadata) {
        const results = [];
        const triggers = Array.from(this.automationRules.values())
            .filter(rule => rule.isActive)
            .flatMap(rule => rule.triggers)
            .filter(trigger => trigger.type === 'date_based' && trigger.condition.eventType === eventType);
        for (const trigger of triggers) {
            const context = {
                triggerEvent: trigger,
                timestamp: new Date(),
                metadata
            };
            const result = await this.processAutomation(context);
            results.push(result);
        }
        return results;
    }
    async processAutomation(context) {
        const result = {
            success: true,
            actionsExecuted: [],
            createdTasks: [],
            updatedTasks: [],
            notifications: [],
            errors: [],
            warnings: []
        };
        try {
            const matchingRules = this.findMatchingAutomationRules(context);
            matchingRules.sort((a, b) => a.priority - b.priority);
            for (const rule of matchingRules) {
                try {
                    const ruleResult = await this.executeAutomationRule(rule, context);
                    result.actionsExecuted.push(...ruleResult.actionsExecuted);
                    result.createdTasks.push(...ruleResult.createdTasks);
                    result.updatedTasks.push(...ruleResult.updatedTasks);
                    result.notifications.push(...ruleResult.notifications);
                    result.errors.push(...ruleResult.errors);
                    result.warnings.push(...ruleResult.warnings);
                    rule.lastTriggered = new Date();
                    rule.triggerCount++;
                    rule.updatedAt = new Date();
                    this.automationHistory.push({
                        id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        ruleId: rule.id,
                        ruleName: rule.name,
                        context,
                        result: ruleResult,
                        timestamp: new Date()
                    });
                }
                catch (error) {
                    result.errors.push(`Error executing rule ${rule.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
            return result;
        }
        catch (error) {
            result.success = false;
            result.errors.push(`Automation processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return result;
        }
    }
    findMatchingAutomationRules(context) {
        return Array.from(this.automationRules.values()).filter(rule => {
            if (!rule.isActive)
                return false;
            const triggerMatches = rule.triggers.some(trigger => this.doesTriggerMatch(trigger, context));
            if (!triggerMatches)
                return false;
            return this.evaluateConditions(rule.conditions, context);
        });
    }
    doesTriggerMatch(trigger, context) {
        if (trigger.type !== context.triggerEvent.type)
            return false;
        const triggerCondition = trigger.condition;
        const contextCondition = context.triggerEvent.condition;
        switch (trigger.type) {
            case 'case_phase_change':
                return triggerCondition.anyPhaseChange ||
                    triggerCondition.phase === contextCondition.phase;
            case 'task_status_change':
                return (!triggerCondition.status || triggerCondition.status === contextCondition.status) &&
                    (!triggerCondition.priority || triggerCondition.priority === contextCondition.priority);
            case 'date_based':
                return triggerCondition.eventType === contextCondition.eventType;
            default:
                return true;
        }
    }
    evaluateConditions(conditions, context) {
        if (conditions.length === 0)
            return true;
        let result = true;
        let currentLogicalOperator = 'AND';
        for (const condition of conditions) {
            const conditionResult = this.evaluateCondition(condition, context);
            if (condition.logicalOperator) {
                if (currentLogicalOperator === 'AND') {
                    result = result && conditionResult;
                }
                else {
                    result = result || conditionResult;
                }
                currentLogicalOperator = condition.logicalOperator;
            }
            else {
                result = conditionResult;
            }
        }
        return result;
    }
    evaluateCondition(condition, context) {
        const fieldValue = this.getNestedValue(context.metadata, condition.field);
        const conditionValue = condition.value;
        switch (condition.operator) {
            case 'equals':
                return fieldValue === conditionValue;
            case 'not_equals':
                return fieldValue !== conditionValue;
            case 'contains':
                return Array.isArray(fieldValue) && fieldValue.includes(conditionValue);
            case 'exists':
                return fieldValue !== undefined && fieldValue !== null;
            case 'not_exists':
                return fieldValue === undefined || fieldValue === null;
            case 'greater_than':
                return fieldValue > conditionValue;
            case 'less_than':
                return fieldValue < conditionValue;
            case 'in':
                return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
            case 'not_in':
                return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue);
            default:
                return false;
        }
    }
    async executeAutomationRule(rule, context) {
        const result = {
            success: true,
            actionsExecuted: [],
            createdTasks: [],
            updatedTasks: [],
            notifications: [],
            errors: [],
            warnings: []
        };
        for (const action of rule.actions) {
            try {
                if (action.delay && action.delay > 0) {
                    this.scheduleDelayedAction(rule, action, context);
                    result.warnings.push(`Action ${action.type} scheduled for ${action.delay} hours later`);
                    continue;
                }
                const actionResult = await this.executeAutomationAction(action, context);
                result.actionsExecuted.push(action);
                result.createdTasks.push(...actionResult.createdTasks);
                result.updatedTasks.push(...actionResult.updatedTasks);
                result.notifications.push(...actionResult.notifications);
                result.errors.push(...actionResult.errors);
                result.warnings.push(...actionResult.warnings);
            }
            catch (error) {
                const errorMessage = `Error executing action ${action.type}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                result.errors.push(errorMessage);
                if (action.onFailure === 'stop') {
                    result.success = false;
                    break;
                }
            }
        }
        return result;
    }
    async executeAutomationAction(action, context) {
        const result = {
            success: true,
            actionsExecuted: [],
            createdTasks: [],
            updatedTasks: [],
            notifications: [],
            errors: [],
            warnings: []
        };
        switch (action.type) {
            case 'create_task':
                return await this.handleCreateTaskAction(action, context);
            case 'update_task':
                return await this.handleUpdateTaskAction(action, context);
            case 'assign_task':
                return await this.handleAssignTaskAction(action, context);
            case 'escalate_task':
                return await this.handleEscalateTaskAction(action, context);
            case 'send_notification':
                return await this.handleSendNotificationAction(action, context);
            case 'create_reminder':
                return await this.handleCreateReminderAction(action, context);
            case 'update_case_phase':
                return await this.handleUpdateCasePhaseAction(action, context);
            case 'create_dependency':
                return await this.handleCreateDependencyAction(action, context);
            default:
                result.errors.push(`Unknown action type: ${action.type}`);
                return result;
        }
    }
    async handleCreateTaskAction(action, context) {
        const result = {
            success: true,
            actionsExecuted: [],
            createdTasks: [],
            updatedTasks: [],
            notifications: [],
            errors: [],
            warnings: []
        };
        if (!context.caseId) {
            result.errors.push('Case ID is required for task creation');
            return result;
        }
        try {
            const templates = this.taskTemplateService.getAutoCreateTemplates(context.metadata.caseType, context.metadata.currentPhase);
            for (const template of templates) {
                const taskData = this.taskTemplateService.generateTaskFromTemplate(template.id, context.caseId, context.metadata);
                if (taskData) {
                    const createdTask = {
                        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        title: taskData.title,
                        description: taskData.description,
                        caseId: context.caseId,
                        assignedTo: context.userId || 'system',
                        assignedBy: 'system',
                        dueDate: taskData.dueDate,
                        priority: taskData.priority,
                        status: client_1.TaskStatus.PENDING,
                        metadata: {
                            templateId: template.id,
                            autoGenerated: true,
                            automationRule: context.triggerEvent.id
                        }
                    };
                    result.createdTasks.push(createdTask);
                }
            }
            return result;
        }
        catch (error) {
            result.errors.push(`Task creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return result;
        }
    }
    async handleUpdateTaskAction(action, context) {
        return {
            success: true,
            actionsExecuted: [],
            createdTasks: [],
            updatedTasks: [],
            notifications: [],
            errors: [],
            warnings: []
        };
    }
    async handleAssignTaskAction(action, context) {
        return {
            success: true,
            actionsExecuted: [],
            createdTasks: [],
            updatedTasks: [],
            notifications: [],
            errors: [],
            warnings: []
        };
    }
    async handleEscalateTaskAction(action, context) {
        return {
            success: true,
            actionsExecuted: [],
            createdTasks: [],
            updatedTasks: [],
            notifications: [],
            errors: [],
            warnings: []
        };
    }
    async handleSendNotificationAction(action, context) {
        const result = {
            success: true,
            actionsExecuted: [],
            createdTasks: [],
            updatedTasks: [],
            notifications: [],
            errors: [],
            warnings: []
        };
        try {
            const notification = {
                id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: action.parameters.type || 'in_app',
                recipient: action.parameters.recipient || context.userId || 'system',
                subject: action.parameters.subject || 'Automation Notification',
                message: action.parameters.message || 'You have a new notification',
                metadata: {
                    ...action.parameters.metadata,
                    automationRule: context.triggerEvent.id,
                    timestamp: context.timestamp
                }
            };
            result.notifications.push(notification);
            return result;
        }
        catch (error) {
            result.errors.push(`Notification creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return result;
        }
    }
    async handleCreateReminderAction(action, context) {
        return {
            success: true,
            actionsExecuted: [],
            createdTasks: [],
            updatedTasks: [],
            notifications: [],
            errors: [],
            warnings: []
        };
    }
    async handleUpdateCasePhaseAction(action, context) {
        return {
            success: true,
            actionsExecuted: [],
            createdTasks: [],
            updatedTasks: [],
            notifications: [],
            errors: [],
            warnings: []
        };
    }
    async handleCreateDependencyAction(action, context) {
        return {
            success: true,
            actionsExecuted: [],
            createdTasks: [],
            updatedTasks: [],
            notifications: [],
            errors: [],
            warnings: []
        };
    }
    scheduleDelayedAction(rule, action, context) {
        const scheduledTime = new Date(context.timestamp.getTime() + (action.delay || 0) * 60 * 60 * 1000);
        const automationId = `delayed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.pendingAutomations.set(automationId, {
            rule,
            context,
            scheduledTime
        });
    }
    async processPendingAutomations() {
        const now = new Date();
        const results = [];
        const processedIds = [];
        for (const [id, pending] of this.pendingAutomations.entries()) {
            if (pending.scheduledTime <= now) {
                try {
                    const result = await this.executeAutomationRule(pending.rule, pending.context);
                    results.push(result);
                    processedIds.push(id);
                }
                catch (error) {
                    console.error(`Error processing pending automation ${id}:`, error);
                }
            }
        }
        processedIds.forEach(id => this.pendingAutomations.delete(id));
        return results;
    }
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    addAutomationRule(rule) {
        this.automationRules.set(rule.id, rule);
    }
    getAutomationRule(id) {
        return this.automationRules.get(id);
    }
    getAutomationRules(activeOnly = true) {
        return Array.from(this.automationRules.values())
            .filter(rule => !activeOnly || rule.isActive)
            .sort((a, b) => a.priority - b.priority);
    }
    updateAutomationRule(id, updates) {
        const rule = this.automationRules.get(id);
        if (!rule)
            return false;
        Object.assign(rule, updates, { updatedAt: new Date() });
        return true;
    }
    deleteAutomationRule(id) {
        return this.automationRules.delete(id);
    }
    activateAutomationRule(id) {
        const rule = this.automationRules.get(id);
        if (!rule)
            return false;
        rule.isActive = true;
        rule.updatedAt = new Date();
        return true;
    }
    deactivateAutomationRule(id) {
        const rule = this.automationRules.get(id);
        if (!rule)
            return false;
        rule.isActive = false;
        rule.updatedAt = new Date();
        return true;
    }
    getAutomationHistory(limit) {
        let history = [...this.automationHistory];
        history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        if (limit) {
            history = history.slice(0, limit);
        }
        return history;
    }
    getPendingAutomations() {
        return Array.from(this.pendingAutomations.entries()).map(([id, pending]) => ({
            id,
            rule: pending.rule,
            context: pending.context,
            scheduledTime: pending.scheduledTime
        })).sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());
    }
    getAutomationStats() {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        return {
            totalRules: this.automationRules.size,
            activeRules: Array.from(this.automationRules.values()).filter(rule => rule.isActive).length,
            totalTriggers: Array.from(this.automationRules.values()).reduce((sum, rule) => sum + rule.triggerCount, 0),
            pendingAutomations: this.pendingAutomations.size,
            recentHistory: this.automationHistory.filter(entry => entry.timestamp > yesterday).length
        };
    }
}
exports.TaskAutomationService = TaskAutomationService;
//# sourceMappingURL=TaskAutomationService.js.map