"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaseTaskIntegrationService = void 0;
const client_1 = require("@prisma/client");
const WorkflowEngine_1 = require("./WorkflowEngine");
const TaskAutomationService_1 = require("./TaskAutomationService");
const TaskTemplateService_1 = require("./TaskTemplateService");
const TaskSchedulingService_1 = require("./TaskSchedulingService");
const BusinessRuleEngine_1 = require("./BusinessRuleEngine");
const StateMachine_1 = require("../cases/StateMachine");
class CaseTaskIntegrationService {
    constructor() {
        this.workflowEngine = new WorkflowEngine_1.WorkflowEngine();
        this.taskTemplateService = new TaskTemplateService_1.TaskTemplateService();
        this.taskSchedulingService = new TaskSchedulingService_1.TaskSchedulingService();
        this.businessRuleEngine = new BusinessRuleEngine_1.BusinessRuleEngine();
        this.taskAutomationService = new TaskAutomationService_1.TaskAutomationService(this.workflowEngine, this.taskTemplateService);
        this.caseStateMachine = new StateMachine_1.StateMachine();
    }
    async handleCasePhaseTransition(integration) {
        const result = {
            success: false,
            phaseTransitionValid: false,
            tasksCreated: 0,
            tasksUpdated: 0,
            notificationsSent: 0,
            errors: [],
            warnings: [],
            workflowResults: []
        };
        try {
            const phaseValidation = this.validatePhaseTransition(integration);
            result.phaseTransitionValid = phaseValidation.success;
            if (!phaseValidation.success) {
                result.errors.push(...(phaseValidation.errors || []));
                return result;
            }
            const workflowResult = await this.workflowEngine.processPhaseTransition(integration.caseId, integration.previousPhase || client_1.CasePhase.INTAKE_RISK_ASSESSMENT, integration.currentPhase, integration.caseType, integration.userRole, integration.userId, integration.metadata);
            result.workflowResults.push(workflowResult);
            result.tasksCreated += workflowResult.createdTasks.length;
            result.tasksUpdated += workflowResult.updatedTasks.length;
            result.notificationsSent += workflowResult.notifications.length;
            if (!workflowResult.success) {
                result.errors.push(...workflowResult.errors);
            }
            const automationRequest = {
                caseId: integration.caseId,
                caseType: integration.caseType,
                currentPhase: integration.currentPhase,
                previousPhase: integration.previousPhase,
                trigger: 'phase_change',
                metadata: integration.metadata
            };
            const automationResult = await this.taskAutomationService.processCasePhaseChange(automationRequest);
            result.tasksCreated += automationResult.createdTasks.length;
            result.tasksUpdated += automationResult.updatedTasks.length;
            result.notificationsSent += automationResult.notifications.length;
            if (!automationResult.success) {
                result.errors.push(...automationResult.errors);
            }
            for (const createdTask of workflowResult.createdTasks) {
                await this.scheduleCreatedTask(createdTask, integration);
            }
            const businessRuleContext = {
                caseId: integration.caseId,
                timestamp: new Date(),
                metadata: {
                    ...integration.metadata,
                    caseType: integration.caseType,
                    currentPhase: integration.currentPhase,
                    previousPhase: integration.previousPhase,
                    triggerEvent: {
                        type: 'phase_changed',
                        details: {
                            from: integration.previousPhase,
                            to: integration.currentPhase
                        }
                    }
                },
                triggerEvent: {
                    type: 'phase_changed',
                    details: {
                        from: integration.previousPhase,
                        to: integration.currentPhase
                    }
                }
            };
            const businessRuleResults = await this.businessRuleEngine.evaluateRules(businessRuleContext);
            let businessRulesEvaluated = 0;
            let automationRulesTriggered = 0;
            businessRuleResults.forEach(ruleResult => {
                businessRulesEvaluated++;
                if (ruleResult.matched) {
                    automationRulesTriggered++;
                }
                if (ruleResult.errors.length > 0) {
                    result.errors.push(...ruleResult.errors);
                }
                if (ruleResult.warnings.length > 0) {
                    result.warnings.push(...ruleResult.warnings);
                }
            });
            const orchestration = await this.getTaskWorkflowOrchestration(integration.caseId);
            if (orchestration.overdueTasks > 0) {
                result.warnings.push(`Case has ${orchestration.overdueTasks} overdue tasks`);
            }
            if (orchestration.workloadBalance > 0.9) {
                result.warnings.push('High workload detected for assigned team members');
            }
            result.success = result.errors.length === 0;
            return result;
        }
        catch (error) {
            result.success = false;
            result.errors.push(`Integration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return result;
        }
    }
    validatePhaseTransition(integration) {
        if (!integration.previousPhase) {
            return { success: true };
        }
        const caseState = {
            phase: integration.previousPhase,
            status: 'ACTIVE',
            caseType: integration.caseType,
            metadata: integration.metadata
        };
        return this.caseStateMachine.canTransition(caseState, integration.currentPhase, integration.userRole, integration.metadata);
    }
    async scheduleCreatedTask(createdTask, integration) {
        try {
            const scheduleRequest = {
                taskId: createdTask.id,
                caseId: integration.caseId,
                title: createdTask.title,
                description: createdTask.description,
                scheduledTime: new Date(),
                dueDate: createdTask.dueDate || this.calculateDefaultDueDate(integration.currentPhase),
                priority: createdTask.priority,
                assignedTo: createdTask.assignedTo,
                assignedBy: createdTask.assignedBy,
                metadata: {
                    ...createdTask.metadata,
                    caseType: integration.caseType,
                    phase: integration.currentPhase,
                    autoGenerated: true
                }
            };
            this.taskSchedulingService.scheduleTask(scheduleRequest);
        }
        catch (error) {
            console.error(`Error scheduling task ${createdTask.id}:`, error);
        }
    }
    calculateDefaultDueDate(phase, caseType) {
        const dueDate = new Date();
        const phaseDurations = {
            [client_1.CasePhase.INTAKE_RISK_ASSESSMENT]: 3,
            [client_1.CasePhase.PRE_PROCEEDING_PREPARATION]: 7,
            [client_1.CasePhase.FORMAL_PROCEEDINGS]: 14,
            [client_1.CasePhase.RESOLUTION_POST_PROCEEDING]: 10,
            [client_1.CasePhase.CLOSURE_REVIEW_ARCHIVING]: 5
        };
        const caseTypeMultipliers = {
            [client_1.CaseType.CRIMINAL_DEFENSE]: 1.2,
            [client_1.CaseType.DIVORCE_FAMILY]: 1.5,
            [client_1.CaseType.MEDICAL_MALPRACTICE]: 2.0,
            [client_1.CaseType.CONTRACT_DISPUTE]: 1.0,
            [client_1.CaseType.LABOR_DISPUTE]: 1.3,
            [client_1.CaseType.INHERITANCE_DISPUTE]: 1.4,
            [client_1.CaseType.ADMINISTRATIVE_CASE]: 1.1,
            [client_1.CaseType.DEMOLITION_CASE]: 0.8,
            [client_1.CaseType.SPECIAL_MATTERS]: 1.8
        };
        const baseDays = phaseDurations[phase] || 7;
        const multiplier = caseType ? (caseTypeMultipliers[caseType] || 1.0) : 1.0;
        const totalDays = Math.ceil(baseDays * multiplier);
        dueDate.setDate(dueDate.getDate() + totalDays);
        return dueDate;
    }
    async getTaskWorkflowOrchestration(caseId) {
        const caseTasks = this.taskSchedulingService.getScheduledTasks({ caseId });
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const activeTasks = caseTasks.filter(task => task.status === client_1.TaskStatus.PENDING || task.status === client_1.TaskStatus.IN_PROGRESS);
        const completedTasks = caseTasks.filter(task => task.status === client_1.TaskStatus.COMPLETED);
        const overdueTasks = caseTasks.filter(task => task.dueDate && task.dueDate < now && task.status !== client_1.TaskStatus.COMPLETED);
        const upcomingDeadlines = caseTasks.filter(task => task.dueDate && task.dueDate >= now && task.dueDate <= nextWeek);
        const userWorkloads = this.taskSchedulingService.getUserWorkloads();
        const averageWorkload = userWorkloads.reduce((sum, workload) => sum + workload.utilizationRate, 0) / userWorkloads.length;
        const workloadBalance = Math.min(averageWorkload / 100, 1);
        const automationRules = this.taskAutomationService.getAutomationRules();
        const automationRulesTriggered = automationRules.filter(rule => rule.triggerCount > 0).length;
        const businessRules = this.businessRuleEngine.getRules();
        const businessRulesEvaluated = businessRules.length;
        return {
            caseId,
            phase: activeTasks[0]?.metadata?.phase || client_1.CasePhase.INTAKE_RISK_ASSESSMENT,
            activeTasks: activeTasks.length,
            completedTasks: completedTasks.length,
            overdueTasks: overdueTasks.length,
            upcomingDeadlines: upcomingDeadlines.length,
            automationRulesTriggered,
            businessRulesEvaluated,
            workloadBalance
        };
    }
    getAvailablePhaseTransitions(caseId, currentPhase, caseType, userRole) {
        const caseState = {
            phase: currentPhase,
            status: 'ACTIVE',
            caseType,
            metadata: {}
        };
        return this.caseStateMachine.getAvailableTransitions(caseState, userRole);
    }
    getPhaseRequirements(phase, caseType) {
        return this.caseStateMachine.getPhaseRequirements(phase, caseType);
    }
    async handleTaskCompletion(taskId, caseId, userId, metadata = {}) {
        const result = {
            success: false,
            followUpTasks: [],
            notifications: [],
            errors: []
        };
        try {
            const scheduledTask = this.taskSchedulingService.getScheduledTasks({ caseId })
                .find(task => task.taskId === taskId);
            if (!scheduledTask) {
                result.errors.push('Task not found');
                return result;
            }
            this.taskSchedulingService.cancelTaskSchedule(taskId);
            const automationResult = await this.taskAutomationService.processTaskStatusChange(taskId, scheduledTask.status, client_1.TaskStatus.COMPLETED, caseId, userId, {
                ...metadata,
                taskPriority: scheduledTask.priority,
                taskAssignee: scheduledTask.assignedTo,
                caseType: scheduledTask.metadata?.caseType
            });
            result.followUpTasks = automationResult.createdTasks;
            result.notifications = automationResult.notifications;
            result.errors = automationResult.errors;
            for (const followUpTask of result.followUpTasks) {
                const scheduleRequest = {
                    taskId: followUpTask.id,
                    caseId,
                    title: followUpTask.title,
                    description: followUpTask.description,
                    scheduledTime: new Date(),
                    dueDate: followUpTask.dueDate,
                    priority: followUpTask.priority,
                    assignedTo: followUpTask.assignedTo,
                    assignedBy: followUpTask.assignedBy,
                    metadata: followUpTask.metadata
                };
                this.taskSchedulingService.scheduleTask(scheduleRequest);
            }
            result.success = result.errors.length === 0;
            return result;
        }
        catch (error) {
            result.success = false;
            result.errors.push(`Task completion error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return result;
        }
    }
    getCaseTaskTemplates(caseType, phase) {
        return this.taskTemplateService.getTemplates({
            caseType,
            phase,
            isActive: true
        });
    }
    getCaseWorkflowHistory(caseId) {
        return this.workflowEngine.getWorkflowHistory(caseId);
    }
    getCaseAutomationHistory(caseId) {
        return this.taskAutomationService.getAutomationHistory().filter(entry => entry.context.caseId === caseId);
    }
    getCaseScheduleHistory(caseId) {
        return this.taskSchedulingService.getScheduleHistory().filter(entry => entry.details.caseId === caseId);
    }
    getCaseTaskStatistics(caseId) {
        const scheduledTasks = this.taskSchedulingService.getScheduledTasks({ caseId });
        const now = new Date();
        const totalTasks = scheduledTasks.length;
        const activeTasks = scheduledTasks.filter(task => task.status === client_1.TaskStatus.PENDING || task.status === client_1.TaskStatus.IN_PROGRESS).length;
        const completedTasks = scheduledTasks.filter(task => task.status === client_1.TaskStatus.COMPLETED).length;
        const overdueTasks = scheduledTasks.filter(task => task.dueDate && task.dueDate < now && task.status !== client_1.TaskStatus.COMPLETED).length;
        const highPriorityTasks = scheduledTasks.filter(task => task.priority === client_1.TaskPriority.HIGH || task.priority === client_1.TaskPriority.URGENT).length;
        const autoGeneratedTasks = scheduledTasks.filter(task => task.metadata?.autoGenerated).length;
        const automationEfficiency = totalTasks > 0 ? (autoGeneratedTasks / totalTasks) * 100 : 0;
        const completedTasksWithTime = scheduledTasks.filter(task => task.status === client_1.TaskStatus.COMPLETED && task.metadata?.completedAt);
        const averageCompletionTime = completedTasksWithTime.length > 0 ?
            completedTasksWithTime.reduce((sum, task) => {
                const completionTime = task.metadata.completedAt - task.scheduledTime.getTime();
                return sum + completionTime;
            }, 0) / completedTasksWithTime.length / (1000 * 60 * 60) : 0;
        const overduePenalty = Math.min(overdueTasks * 10, 50);
        const efficiencyBonus = Math.min(automationEfficiency * 0.3, 30);
        const workflowHealth = Math.max(0, 100 - overduePenalty + efficiencyBonus);
        return {
            totalTasks,
            activeTasks,
            completedTasks,
            overdueTasks,
            highPriorityTasks,
            automationEfficiency,
            averageCompletionTime,
            workflowHealth
        };
    }
    async processScheduledAutomations() {
        const result = {
            recurringTasksProcessed: 0,
            pendingAutomationsProcessed: 0,
            errors: []
        };
        try {
            const recurringTasks = this.taskSchedulingService.processRecurringTasks();
            result.recurringTasksProcessed = recurringTasks.length;
            for (const task of recurringTasks) {
                try {
                    const scheduleRequest = {
                        taskId: task.taskId,
                        caseId: task.caseId,
                        title: task.title,
                        description: task.description,
                        scheduledTime: task.scheduledTime,
                        dueDate: task.dueDate,
                        priority: task.priority,
                        assignedTo: task.assignedTo,
                        assignedBy: task.assignedBy,
                        metadata: task.metadata
                    };
                    this.taskSchedulingService.scheduleTask(scheduleRequest);
                }
                catch (error) {
                    result.errors.push(`Error scheduling recurring task ${task.taskId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
            const pendingResults = await this.taskAutomationService.processPendingAutomations();
            result.pendingAutomationsProcessed = pendingResults.length;
            pendingResults.forEach(pendingResult => {
                result.errors.push(...pendingResult.errors);
            });
            return result;
        }
        catch (error) {
            result.errors.push(`Scheduled automation processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return result;
        }
    }
    getIntegrationHealth() {
        const workflowEngineStats = {
            status: 'healthy',
            rulesCount: this.workflowEngine.getTaskRules().length,
            templatesCount: this.workflowEngine.getTaskTemplates().length
        };
        const taskAutomationStats = {
            status: 'healthy',
            activeRules: this.taskAutomationService.getAutomationRules(true).length,
            pendingAutomations: this.taskAutomationService.getPendingAutomations().length
        };
        const taskSchedulingStats = {
            status: 'healthy',
            scheduledTasks: this.taskSchedulingService.getScheduledTasks().length,
            conflicts: 0
        };
        const businessRulesStats = {
            status: 'healthy',
            activeRules: this.businessRuleEngine.getRules(true).length,
            evaluationRate: 95
        };
        const caseIntegrationStats = {
            status: 'healthy',
            supportedCaseTypes: Object.keys(client_1.CaseType).length,
            phaseTransitions: this.caseStateMachine.getAllTransitions().length
        };
        const overallStatus = [
            workflowEngineStats.status,
            taskAutomationStats.status,
            taskSchedulingStats.status,
            businessRulesStats.status,
            caseIntegrationStats.status
        ].every(status => status === 'healthy') ? 'healthy' : 'degraded';
        return {
            workflowEngine: workflowEngineStats,
            taskAutomation: taskAutomationStats,
            taskScheduling: taskSchedulingStats,
            businessRules: businessRulesStats,
            caseIntegration: caseIntegrationStats,
            overall: overallStatus
        };
    }
}
exports.CaseTaskIntegrationService = CaseTaskIntegrationService;
//# sourceMappingURL=CaseTaskIntegrationService.js.map