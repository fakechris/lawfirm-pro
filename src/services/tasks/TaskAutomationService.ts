import { CaseType, CasePhase, TaskStatus, TaskPriority, UserRole } from '@prisma/client';
import { WorkflowEngine, WorkflowContext, WorkflowResult, CreatedTask, UpdatedTask, Notification } from './WorkflowEngine';
import { TaskTemplateService, TaskTemplate } from './TaskTemplateService';

export interface AutomationTrigger {
  id: string;
  name: string;
  type: 'case_phase_change' | 'task_status_change' | 'date_based' | 'condition_based' | 'external_event';
  condition: Record<string, any>;
  isActive: boolean;
  priority: number;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  triggers: AutomationTrigger[];
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
}

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'exists' | 'not_exists' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface AutomationAction {
  type: 'create_task' | 'update_task' | 'assign_task' | 'escalate_task' | 'send_notification' | 'create_reminder' | 'update_case_phase' | 'create_dependency';
  parameters: Record<string, any>;
  delay?: number; // in hours
  onFailure?: 'continue' | 'stop';
}

export interface AutomationContext {
  triggerEvent: AutomationTrigger;
  caseId?: string;
  taskId?: string;
  userId?: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface AutomationResult {
  success: boolean;
  actionsExecuted: AutomationAction[];
  createdTasks: CreatedTask[];
  updatedTasks: UpdatedTask[];
  notifications: Notification[];
  errors: string[];
  warnings: string[];
}

export interface TaskGenerationRequest {
  caseId: string;
  caseType: CaseType;
  currentPhase: CasePhase;
  previousPhase?: CasePhase;
  trigger: 'phase_change' | 'manual' | 'condition_met';
  metadata: Record<string, any>;
}

export interface TaskDependency {
  taskId: string;
  dependsOnTaskId: string;
  dependencyType: 'blocking' | 'sequential' | 'parallel' | 'suggested';
  autoCreate: boolean;
}

export class TaskAutomationService {
  private workflowEngine: WorkflowEngine;
  private taskTemplateService: TaskTemplateService;
  private automationRules: Map<string, AutomationRule>;
  private pendingAutomations: Map<string, { rule: AutomationRule; context: AutomationContext; scheduledTime: Date }>;
  private automationHistory: Array<{
    id: string;
    ruleId: string;
    ruleName: string;
    context: AutomationContext;
    result: AutomationResult;
    timestamp: Date;
  }>;

  constructor(workflowEngine: WorkflowEngine, taskTemplateService: TaskTemplateService) {
    this.workflowEngine = workflowEngine;
    this.taskTemplateService = taskTemplateService;
    this.automationRules = new Map();
    this.pendingAutomations = new Map();
    this.automationHistory = [];
    this.initializeDefaultAutomationRules();
  }

  private initializeDefaultAutomationRules(): void {
    // Case Phase Change Rules
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

    // Task Escalation Rules
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

    // High Priority Task Assignment
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
          parameters: { strategy: 'workload_balance', role: UserRole.ATTORNEY },
          onFailure: 'continue'
        }
      ],
      isActive: true,
      priority: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      triggerCount: 0
    });

    // Task Completion Follow-up
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
            delay: 24, // 24 hours later
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

    // Case Deadline Reminders
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
          value: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
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

    // Document Filing Deadline
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

  public async processCasePhaseChange(request: TaskGenerationRequest): Promise<AutomationResult> {
    const context: AutomationContext = {
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

  public async processTaskStatusChange(
    taskId: string,
    oldStatus: TaskStatus,
    newStatus: TaskStatus,
    caseId: string,
    userId: string,
    metadata: Record<string, any>
  ): Promise<AutomationResult> {
    const context: AutomationContext = {
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

  public async processDateBasedTrigger(eventType: string, metadata: Record<string, any>): Promise<AutomationResult[]> {
    const results: AutomationResult[] = [];
    const triggers = Array.from(this.automationRules.values())
      .filter(rule => rule.isActive)
      .flatMap(rule => rule.triggers)
      .filter(trigger => trigger.type === 'date_based' && trigger.condition.eventType === eventType);

    for (const trigger of triggers) {
      const context: AutomationContext = {
        triggerEvent: trigger,
        timestamp: new Date(),
        metadata
      };

      const result = await this.processAutomation(context);
      results.push(result);
    }

    return results;
  }

  private async processAutomation(context: AutomationContext): Promise<AutomationResult> {
    const result: AutomationResult = {
      success: true,
      actionsExecuted: [],
      createdTasks: [],
      updatedTasks: [],
      notifications: [],
      errors: [],
      warnings: []
    };

    try {
      // Find matching automation rules
      const matchingRules = this.findMatchingAutomationRules(context);
      
      // Sort by priority
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

          // Update rule statistics
          rule.lastTriggered = new Date();
          rule.triggerCount++;
          rule.updatedAt = new Date();

          // Log to history
          this.automationHistory.push({
            id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ruleId: rule.id,
            ruleName: rule.name,
            context,
            result: ruleResult,
            timestamp: new Date()
          });

        } catch (error) {
          result.errors.push(`Error executing rule ${rule.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push(`Automation processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  private findMatchingAutomationRules(context: AutomationContext): AutomationRule[] {
    return Array.from(this.automationRules.values()).filter(rule => {
      if (!rule.isActive) return false;

      // Check if any trigger matches
      const triggerMatches = rule.triggers.some(trigger => this.doesTriggerMatch(trigger, context));
      if (!triggerMatches) return false;

      // Check conditions
      return this.evaluateConditions(rule.conditions, context);
    });
  }

  private doesTriggerMatch(trigger: AutomationTrigger, context: AutomationContext): boolean {
    if (trigger.type !== context.triggerEvent.type) return false;

    const triggerCondition = trigger.condition;
    const contextCondition = context.triggerEvent.condition;

    // Simple matching logic - can be enhanced based on specific needs
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

  private evaluateConditions(conditions: AutomationCondition[], context: AutomationContext): boolean {
    if (conditions.length === 0) return true;

    let result = true;
    let currentLogicalOperator = 'AND';

    for (const condition of conditions) {
      const conditionResult = this.evaluateCondition(condition, context);
      
      if (condition.logicalOperator) {
        if (currentLogicalOperator === 'AND') {
          result = result && conditionResult;
        } else {
          result = result || conditionResult;
        }
        currentLogicalOperator = condition.logicalOperator;
      } else {
        result = conditionResult;
      }
    }

    return result;
  }

  private evaluateCondition(condition: AutomationCondition, context: AutomationContext): boolean {
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

  private async executeAutomationRule(rule: AutomationRule, context: AutomationContext): Promise<AutomationResult> {
    const result: AutomationResult = {
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
        // Handle delayed actions
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

      } catch (error) {
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

  private async executeAutomationAction(action: AutomationAction, context: AutomationContext): Promise<AutomationResult> {
    const result: AutomationResult = {
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

  private async handleCreateTaskAction(action: AutomationAction, context: AutomationContext): Promise<AutomationResult> {
    const result: AutomationResult = {
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
      // Get task templates for the case type and phase
      const templates = this.taskTemplateService.getAutoCreateTemplates(
        context.metadata.caseType,
        context.metadata.currentPhase
      );

      for (const template of templates) {
        const taskData = this.taskTemplateService.generateTaskFromTemplate(
          template.id,
          context.caseId,
          context.metadata
        );

        if (taskData) {
          const createdTask: CreatedTask = {
            id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: taskData.title,
            description: taskData.description,
            caseId: context.caseId,
            assignedTo: context.userId || 'system',
            assignedBy: 'system',
            dueDate: taskData.dueDate,
            priority: taskData.priority,
            status: TaskStatus.PENDING,
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
    } catch (error) {
      result.errors.push(`Task creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  private async handleUpdateTaskAction(action: AutomationAction, context: AutomationContext): Promise<AutomationResult> {
    // Implementation for updating tasks
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

  private async handleAssignTaskAction(action: AutomationAction, context: AutomationContext): Promise<AutomationResult> {
    // Implementation for assigning tasks
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

  private async handleEscalateTaskAction(action: AutomationAction, context: AutomationContext): Promise<AutomationResult> {
    // Implementation for escalating tasks
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

  private async handleSendNotificationAction(action: AutomationAction, context: AutomationContext): Promise<AutomationResult> {
    const result: AutomationResult = {
      success: true,
      actionsExecuted: [],
      createdTasks: [],
      updatedTasks: [],
      notifications: [],
      errors: [],
      warnings: []
    };

    try {
      const notification: Notification = {
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
    } catch (error) {
      result.errors.push(`Notification creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  private async handleCreateReminderAction(action: AutomationAction, context: AutomationContext): Promise<AutomationResult> {
    // Implementation for creating reminders
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

  private async handleUpdateCasePhaseAction(action: AutomationAction, context: AutomationContext): Promise<AutomationResult> {
    // Implementation for updating case phase
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

  private async handleCreateDependencyAction(action: AutomationAction, context: AutomationContext): Promise<AutomationResult> {
    // Implementation for creating dependencies
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

  private scheduleDelayedAction(rule: AutomationRule, action: AutomationAction, context: AutomationContext): void {
    const scheduledTime = new Date(context.timestamp.getTime() + (action.delay || 0) * 60 * 60 * 1000);
    const automationId = `delayed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.pendingAutomations.set(automationId, {
      rule,
      context,
      scheduledTime
    });
  }

  public async processPendingAutomations(): Promise<AutomationResult[]> {
    const now = new Date();
    const results: AutomationResult[] = [];
    const processedIds: string[] = [];

    for (const [id, pending] of this.pendingAutomations.entries()) {
      if (pending.scheduledTime <= now) {
        try {
          const result = await this.executeAutomationRule(pending.rule, pending.context);
          results.push(result);
          processedIds.push(id);
        } catch (error) {
          console.error(`Error processing pending automation ${id}:`, error);
        }
      }
    }

    // Clean up processed automations
    processedIds.forEach(id => this.pendingAutomations.delete(id));

    return results;
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  public addAutomationRule(rule: AutomationRule): void {
    this.automationRules.set(rule.id, rule);
  }

  public getAutomationRule(id: string): AutomationRule | undefined {
    return this.automationRules.get(id);
  }

  public getAutomationRules(activeOnly: boolean = true): AutomationRule[] {
    return Array.from(this.automationRules.values())
      .filter(rule => !activeOnly || rule.isActive)
      .sort((a, b) => a.priority - b.priority);
  }

  public updateAutomationRule(id: string, updates: Partial<AutomationRule>): boolean {
    const rule = this.automationRules.get(id);
    if (!rule) return false;

    Object.assign(rule, updates, { updatedAt: new Date() });
    return true;
  }

  public deleteAutomationRule(id: string): boolean {
    return this.automationRules.delete(id);
  }

  public activateAutomationRule(id: string): boolean {
    const rule = this.automationRules.get(id);
    if (!rule) return false;

    rule.isActive = true;
    rule.updatedAt = new Date();
    return true;
  }

  public deactivateAutomationRule(id: string): boolean {
    const rule = this.automationRules.get(id);
    if (!rule) return false;

    rule.isActive = false;
    rule.updatedAt = new Date();
    return true;
  }

  public getAutomationHistory(limit?: number): Array<{
    id: string;
    ruleId: string;
    ruleName: string;
    context: AutomationContext;
    result: AutomationResult;
    timestamp: Date;
  }> {
    let history = [...this.automationHistory];
    history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    if (limit) {
      history = history.slice(0, limit);
    }
    
    return history;
  }

  public getPendingAutomations(): Array<{
    id: string;
    rule: AutomationRule;
    context: AutomationContext;
    scheduledTime: Date;
  }> {
    return Array.from(this.pendingAutomations.entries()).map(([id, pending]) => ({
      id,
      rule: pending.rule,
      context: pending.context,
      scheduledTime: pending.scheduledTime
    })).sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());
  }

  public getAutomationStats(): {
    totalRules: number;
    activeRules: number;
    totalTriggers: number;
    pendingAutomations: number;
    recentHistory: number; // last 24 hours
  } {
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