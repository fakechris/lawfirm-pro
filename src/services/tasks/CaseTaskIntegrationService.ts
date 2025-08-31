import { CaseType, CasePhase, TaskStatus, TaskPriority, UserRole } from '@prisma/client';
import { WorkflowEngine, WorkflowContext, WorkflowResult } from './WorkflowEngine';
import { TaskAutomationService, TaskGenerationRequest } from './TaskAutomationService';
import { TaskTemplateService } from './TaskTemplateService';
import { TaskSchedulingService, ScheduleRequest } from './TaskSchedulingService';
import { BusinessRuleEngine, RuleEvaluationContext } from './BusinessRuleEngine';
import { StateMachine, CaseState } from '../cases/StateMachine';

export interface CaseTaskIntegration {
  caseId: string;
  caseType: CaseType;
  currentPhase: CasePhase;
  previousPhase?: CasePhase;
  userId: string;
  userRole: UserRole;
  metadata: Record<string, any>;
}

export interface PhaseTransitionResult {
  success: boolean;
  phaseTransitionValid: boolean;
  tasksCreated: number;
  tasksUpdated: number;
  notificationsSent: number;
  errors: string[];
  warnings: string[];
  workflowResults: WorkflowResult[];
}

export interface TaskWorkflowOrchestration {
  caseId: string;
  phase: CasePhase;
  activeTasks: number;
  completedTasks: number;
  overdueTasks: number;
  upcomingDeadlines: number;
  automationRulesTriggered: number;
  businessRulesEvaluated: number;
  workloadBalance: number;
}

export class CaseTaskIntegrationService {
  private workflowEngine: WorkflowEngine;
  private taskAutomationService: TaskAutomationService;
  private taskTemplateService: TaskTemplateService;
  private taskSchedulingService: TaskSchedulingService;
  private businessRuleEngine: BusinessRuleEngine;
  private caseStateMachine: StateMachine;

  constructor() {
    this.workflowEngine = new WorkflowEngine();
    this.taskTemplateService = new TaskTemplateService();
    this.taskSchedulingService = new TaskSchedulingService();
    this.businessRuleEngine = new BusinessRuleEngine();
    this.taskAutomationService = new TaskAutomationService(this.workflowEngine, this.taskTemplateService);
    this.caseStateMachine = new StateMachine();
  }

  /**
   * Main integration point for case phase transitions
   * Orchestrates the entire workflow when a case changes phase
   */
  public async handleCasePhaseTransition(integration: CaseTaskIntegration): Promise<PhaseTransitionResult> {
    const result: PhaseTransitionResult = {
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
      // Step 1: Validate phase transition using Case Management state machine
      const phaseValidation = this.validatePhaseTransition(integration);
      result.phaseTransitionValid = phaseValidation.success;

      if (!phaseValidation.success) {
        result.errors.push(...(phaseValidation.errors || []));
        return result;
      }

      // Step 2: Process workflow engine phase transition
      const workflowResult = await this.workflowEngine.processPhaseTransition(
        integration.caseId,
        integration.previousPhase || CasePhase.INTAKE_RISK_ASSESSMENT,
        integration.currentPhase,
        integration.caseType,
        integration.userRole,
        integration.userId,
        integration.metadata
      );

      result.workflowResults.push(workflowResult);
      result.tasksCreated += workflowResult.createdTasks.length;
      result.tasksUpdated += workflowResult.updatedTasks.length;
      result.notificationsSent += workflowResult.notifications.length;

      if (!workflowResult.success) {
        result.errors.push(...workflowResult.errors);
      }

      // Step 3: Trigger task automation for phase change
      const automationRequest: TaskGenerationRequest = {
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

      // Step 4: Schedule created tasks
      for (const createdTask of workflowResult.createdTasks) {
        await this.scheduleCreatedTask(createdTask, integration);
      }

      // Step 5: Evaluate business rules for the new phase
      const businessRuleContext: RuleEvaluationContext = {
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

      // Step 6: Update orchestration metrics
      const orchestration = await this.getTaskWorkflowOrchestration(integration.caseId);
      
      // Add orchestration insights to warnings if needed
      if (orchestration.overdueTasks > 0) {
        result.warnings.push(`Case has ${orchestration.overdueTasks} overdue tasks`);
      }
      
      if (orchestration.workloadBalance > 0.9) {
        result.warnings.push('High workload detected for assigned team members');
      }

      result.success = result.errors.length === 0;
      return result;

    } catch (error) {
      result.success = false;
      result.errors.push(`Integration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Validate phase transition using Case Management state machine
   */
  private validatePhaseTransition(integration: CaseTaskIntegration): { success: boolean; errors?: string[] } {
    if (!integration.previousPhase) {
      return { success: true }; // First phase transition is always valid
    }

    const caseState: CaseState = {
      phase: integration.previousPhase,
      status: 'ACTIVE' as any,
      caseType: integration.caseType,
      metadata: integration.metadata
    };

    return this.caseStateMachine.canTransition(
      caseState,
      integration.currentPhase,
      integration.userRole,
      integration.metadata
    );
  }

  /**
   * Schedule a newly created task
   */
  private async scheduleCreatedTask(createdTask: any, integration: CaseTaskIntegration): Promise<void> {
    try {
      const scheduleRequest: ScheduleRequest = {
        taskId: createdTask.id,
        caseId: integration.caseId,
        title: createdTask.title,
        description: createdTask.description,
        scheduledTime: new Date(), // Default to now
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
    } catch (error) {
      console.error(`Error scheduling task ${createdTask.id}:`, error);
    }
  }

  /**
   * Calculate default due date based on case phase and type
   */
  private calculateDefaultDueDate(phase: CasePhase, caseType?: CaseType): Date {
    const dueDate = new Date();
    
    // Phase-based default durations (in days)
    const phaseDurations: Record<CasePhase, number> = {
      [CasePhase.INTAKE_RISK_ASSESSMENT]: 3,
      [CasePhase.PRE_PROCEEDING_PREPARATION]: 7,
      [CasePhase.FORMAL_PROCEEDINGS]: 14,
      [CasePhase.RESOLUTION_POST_PROCEEDING]: 10,
      [CasePhase.CLOSURE_REVIEW_ARCHIVING]: 5
    };

    // Case type multipliers
    const caseTypeMultipliers: Record<CaseType, number> = {
      [CaseType.CRIMINAL_DEFENSE]: 1.2,
      [CaseType.DIVORCE_FAMILY]: 1.5,
      [CaseType.MEDICAL_MALPRACTICE]: 2.0,
      [CaseType.CONTRACT_DISPUTE]: 1.0,
      [CaseType.LABOR_DISPUTE]: 1.3,
      [CaseType.INHERITANCE_DISPUTE]: 1.4,
      [CaseType.ADMINISTRATIVE_CASE]: 1.1,
      [CaseType.DEMOLITION_CASE]: 0.8,
      [CaseType.SPECIAL_MATTERS]: 1.8
    };

    const baseDays = phaseDurations[phase] || 7;
    const multiplier = caseType ? (caseTypeMultipliers[caseType] || 1.0) : 1.0;
    const totalDays = Math.ceil(baseDays * multiplier);

    dueDate.setDate(dueDate.getDate() + totalDays);
    return dueDate;
  }

  /**
   * Get comprehensive task workflow orchestration data for a case
   */
  public async getTaskWorkflowOrchestration(caseId: string): Promise<TaskWorkflowOrchestration> {
    // Get all tasks for the case
    const caseTasks = this.taskSchedulingService.getScheduledTasks({ caseId });
    
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const activeTasks = caseTasks.filter(task => 
      task.status === TaskStatus.PENDING || task.status === TaskStatus.IN_PROGRESS
    );
    
    const completedTasks = caseTasks.filter(task => 
      task.status === TaskStatus.COMPLETED
    );
    
    const overdueTasks = caseTasks.filter(task => 
      task.dueDate && task.dueDate < now && task.status !== TaskStatus.COMPLETED
    );
    
    const upcomingDeadlines = caseTasks.filter(task => 
      task.dueDate && task.dueDate >= now && task.dueDate <= nextWeek
    );

    // Calculate workload balance (simplified calculation)
    const userWorkloads = this.taskSchedulingService.getUserWorkloads();
    const averageWorkload = userWorkloads.reduce((sum, workload) => sum + workload.utilizationRate, 0) / userWorkloads.length;
    const workloadBalance = Math.min(averageWorkload / 100, 1); // Normalize to 0-1

    // Count triggered automation rules (simplified)
    const automationRules = this.taskAutomationService.getAutomationRules();
    const automationRulesTriggered = automationRules.filter(rule => rule.triggerCount > 0).length;

    // Count evaluated business rules (simplified)
    const businessRules = this.businessRuleEngine.getRules();
    const businessRulesEvaluated = businessRules.length;

    return {
      caseId,
      phase: activeTasks[0]?.metadata?.phase || CasePhase.INTAKE_RISK_ASSESSMENT,
      activeTasks: activeTasks.length,
      completedTasks: completedTasks.length,
      overdueTasks: overdueTasks.length,
      upcomingDeadlines: upcomingDeadlines.length,
      automationRulesTriggered,
      businessRulesEvaluated,
      workloadBalance
    };
  }

  /**
   * Get available transitions for a case based on current state and user role
   */
  public getAvailablePhaseTransitions(caseId: string, currentPhase: CasePhase, caseType: CaseType, userRole: UserRole): CasePhase[] {
    const caseState: CaseState = {
      phase: currentPhase,
      status: 'ACTIVE' as any,
      caseType,
      metadata: {}
    };

    return this.caseStateMachine.getAvailableTransitions(caseState, userRole);
  }

  /**
   * Get phase requirements for a specific case type and phase
   */
  public getPhaseRequirements(phase: CasePhase, caseType: CaseType): string[] {
    return this.caseStateMachine.getPhaseRequirements(phase, caseType);
  }

  /**
   * Process task completion and trigger follow-up actions
   */
  public async handleTaskCompletion(taskId: string, caseId: string, userId: string, metadata: Record<string, any> = {}): Promise<{
    success: boolean;
    followUpTasks: any[];
    notifications: any[];
    errors: string[];
  }> {
    const result = {
      success: false,
      followUpTasks: [],
      notifications: [],
      errors: []
    };

    try {
      // Get task details
      const scheduledTask = this.taskSchedulingService.getScheduledTasks({ caseId })
        .find(task => task.taskId === taskId);

      if (!scheduledTask) {
        result.errors.push('Task not found');
        return result;
      }

      // Update task status
      this.taskSchedulingService.cancelTaskSchedule(taskId);

      // Trigger task completion automation
      const automationResult = await this.taskAutomationService.processTaskStatusChange(
        taskId,
        scheduledTask.status,
        TaskStatus.COMPLETED,
        caseId,
        userId,
        {
          ...metadata,
          taskPriority: scheduledTask.priority,
          taskAssignee: scheduledTask.assignedTo,
          caseType: scheduledTask.metadata?.caseType
        }
      );

      result.followUpTasks = automationResult.createdTasks;
      result.notifications = automationResult.notifications;
      result.errors = automationResult.errors;

      // Schedule follow-up tasks
      for (const followUpTask of result.followUpTasks) {
        const scheduleRequest: ScheduleRequest = {
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

    } catch (error) {
      result.success = false;
      result.errors.push(`Task completion error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Get case-specific task templates
   */
  public getCaseTaskTemplates(caseType: CaseType, phase?: CasePhase): any[] {
    return this.taskTemplateService.getTemplates({
      caseType,
      phase,
      isActive: true
    });
  }

  /**
   * Get workflow history for a case
   */
  public getCaseWorkflowHistory(caseId: string): any[] {
    return this.workflowEngine.getWorkflowHistory(caseId);
  }

  /**
   * Get automation history for a case
   */
  public getCaseAutomationHistory(caseId: string): any[] {
    return this.taskAutomationService.getAutomationHistory().filter(entry => 
      entry.context.caseId === caseId
    );
  }

  /**
   * Get schedule history for a case
   */
  public getCaseScheduleHistory(caseId: string): any[] {
    return this.taskSchedulingService.getScheduleHistory().filter(entry => 
      entry.details.caseId === caseId
    );
  }

  /**
   * Get comprehensive case task statistics
   */
  public getCaseTaskStatistics(caseId: string): {
    totalTasks: number;
    activeTasks: number;
    completedTasks: number;
    overdueTasks: number;
    highPriorityTasks: number;
    automationEfficiency: number;
    averageCompletionTime: number;
    workflowHealth: number;
  } {
    const scheduledTasks = this.taskSchedulingService.getScheduledTasks({ caseId });
    const now = new Date();

    const totalTasks = scheduledTasks.length;
    const activeTasks = scheduledTasks.filter(task => 
      task.status === TaskStatus.PENDING || task.status === TaskStatus.IN_PROGRESS
    ).length;
    const completedTasks = scheduledTasks.filter(task => 
      task.status === TaskStatus.COMPLETED
    ).length;
    const overdueTasks = scheduledTasks.filter(task => 
      task.dueDate && task.dueDate < now && task.status !== TaskStatus.COMPLETED
    ).length;
    const highPriorityTasks = scheduledTasks.filter(task => 
      task.priority === TaskPriority.HIGH || task.priority === TaskPriority.URGENT
    ).length;

    // Calculate automation efficiency (simplified)
    const autoGeneratedTasks = scheduledTasks.filter(task => 
      task.metadata?.autoGenerated
    ).length;
    const automationEfficiency = totalTasks > 0 ? (autoGeneratedTasks / totalTasks) * 100 : 0;

    // Calculate average completion time (simplified)
    const completedTasksWithTime = scheduledTasks.filter(task => 
      task.status === TaskStatus.COMPLETED && task.metadata?.completedAt
    );
    const averageCompletionTime = completedTasksWithTime.length > 0 ? 
      completedTasksWithTime.reduce((sum, task) => {
        const completionTime = task.metadata.completedAt - task.scheduledTime.getTime();
        return sum + completionTime;
      }, 0) / completedTasksWithTime.length / (1000 * 60 * 60) : 0; // Convert to hours

    // Calculate workflow health score (0-100)
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

  /**
   * Process recurring tasks and scheduled automations
   */
  public async processScheduledAutomations(): Promise<{
    recurringTasksProcessed: number;
    pendingAutomationsProcessed: number;
    errors: string[];
  }> {
    const result = {
      recurringTasksProcessed: 0,
      pendingAutomationsProcessed: 0,
      errors: []
    };

    try {
      // Process recurring tasks
      const recurringTasks = this.taskSchedulingService.processRecurringTasks();
      result.recurringTasksProcessed = recurringTasks.length;

      // Schedule the recurring tasks
      for (const task of recurringTasks) {
        try {
          const scheduleRequest: ScheduleRequest = {
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
        } catch (error) {
          result.errors.push(`Error scheduling recurring task ${task.taskId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Process pending automations
      const pendingResults = await this.taskAutomationService.processPendingAutomations();
      result.pendingAutomationsProcessed = pendingResults.length;

      // Collect errors from pending automations
      pendingResults.forEach(pendingResult => {
        result.errors.push(...pendingResult.errors);
      });

      return result;

    } catch (error) {
      result.errors.push(`Scheduled automation processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Get system-wide integration health status
   */
  public getIntegrationHealth(): {
    workflowEngine: { status: string; rulesCount: number; templatesCount: number };
    taskAutomation: { status: string; activeRules: number; pendingAutomations: number };
    taskScheduling: { status: string; scheduledTasks: number; conflicts: number };
    businessRules: { status: string; activeRules: number; evaluationRate: number };
    caseIntegration: { status: string; supportedCaseTypes: number; phaseTransitions: number };
    overall: string;
  } {
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
      conflicts: 0 // Would need to implement conflict detection
    };

    const businessRulesStats = {
      status: 'healthy',
      activeRules: this.businessRuleEngine.getRules(true).length,
      evaluationRate: 95 // Mock value
    };

    const caseIntegrationStats = {
      status: 'healthy',
      supportedCaseTypes: Object.keys(CaseType).length,
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