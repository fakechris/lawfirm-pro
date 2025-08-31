import { CasePhase, CaseType, TaskStatus, TaskPriority, UserRole } from '@prisma/client';
import { StateMachine, CaseState, TransitionResult } from '../cases/StateMachine';

export interface TaskRule {
  id: string;
  name: string;
  description: string;
  conditions: TaskCondition[];
  actions: TaskAction[];
  priority: number;
  active: boolean;
}

export interface TaskCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'exists' | 'not_exists' | 'greater_than' | 'less_than';
  value: any;
}

export interface TaskAction {
  type: 'create_task' | 'update_task' | 'assign_task' | 'escalate_task' | 'notify';
  parameters: Record<string, any>;
}

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  caseType: CaseType;
  phase: CasePhase;
  titleTemplate: string;
  descriptionTemplate?: string;
  defaultPriority: TaskPriority;
  defaultAssigneeRole?: UserRole;
  dueDateOffset?: number; // days from phase start
  requiredFields?: string[];
  conditions?: TaskCondition[];
  autoCreate: boolean;
}

export interface WorkflowContext {
  caseId: string;
  caseType: CaseType;
  currentPhase: CasePhase;
  previousPhase?: CasePhase;
  metadata: Record<string, any>;
  userId: string;
  userRole: UserRole;
  timestamp: Date;
}

export interface WorkflowResult {
  success: boolean;
  createdTasks: CreatedTask[];
  updatedTasks: UpdatedTask[];
  notifications: Notification[];
  errors: string[];
}

export interface CreatedTask {
  id: string;
  title: string;
  description?: string;
  caseId: string;
  assignedTo: string;
  assignedBy: string;
  dueDate?: Date;
  priority: TaskPriority;
  status: TaskStatus;
  metadata?: Record<string, any>;
}

export interface UpdatedTask {
  id: string;
  changes: Record<string, any>;
  previousValues: Record<string, any>;
}

export interface Notification {
  id: string;
  type: 'email' | 'in_app' | 'sms';
  recipient: string;
  subject: string;
  message: string;
  metadata?: Record<string, any>;
}

export class WorkflowEngine {
  private stateMachine: StateMachine;
  private taskRules: Map<string, TaskRule>;
  private taskTemplates: Map<string, TaskTemplate>;
  private workflowHistory: Map<string, WorkflowContext[]>;

  constructor() {
    this.stateMachine = new StateMachine();
    this.taskRules = new Map();
    this.taskTemplates = new Map();
    this.workflowHistory = new Map();
    this.initializeTaskRules();
    this.initializeTaskTemplates();
  }

  private initializeTaskRules(): void {
    // Initialize rules for task automation and escalation
    const rules: TaskRule[] = [
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

  private initializeTaskTemplates(): void {
    // Initialize task templates for different case types and phases
    const templates: TaskTemplate[] = [
      // Criminal Defense Templates
      {
        id: 'criminal_intake_risk_assessment',
        name: 'Criminal Intake Risk Assessment',
        description: 'Complete initial risk assessment for criminal case',
        caseType: CaseType.CRIMINAL_DEFENSE,
        phase: CasePhase.INTAKE_RISK_ASSESSMENT,
        titleTemplate: 'Complete Risk Assessment - {caseTitle}',
        descriptionTemplate: 'Conduct thorough risk assessment including bail analysis, evidence review, and potential defenses',
        defaultPriority: TaskPriority.HIGH,
        defaultAssigneeRole: UserRole.ATTORNEY,
        dueDateOffset: 3,
        requiredFields: ['clientStatement', 'policeReport', 'arrestRecords'],
        autoCreate: true
      },
      {
        id: 'criminal_bail_hearing',
        name: 'Bail Hearing Preparation',
        description: 'Prepare and conduct bail hearing',
        caseType: CaseType.CRIMINAL_DEFENSE,
        phase: CasePhase.PRE_PROCEEDING_PREPARATION,
        titleTemplate: 'Prepare Bail Hearing - {caseTitle}',
        descriptionTemplate: 'Prepare bail application, gather character references, and prepare arguments for bail hearing',
        defaultPriority: TaskPriority.URGENT,
        defaultAssigneeRole: UserRole.ATTORNEY,
        dueDateOffset: 1,
        requiredFields: ['clientFinancialInfo', 'characterReferences', 'bailApplication'],
        autoCreate: true
      },
      // Divorce & Family Law Templates
      {
        id: 'divorce_mediations',
        name: 'Divorce Mediation',
        description: 'Conduct divorce mediation sessions',
        caseType: CaseType.DIVORCE_FAMILY,
        phase: CasePhase.PRE_PROCEEDING_PREPARATION,
        titleTemplate: 'Conduct Mediation - {caseTitle}',
        descriptionTemplate: 'Schedule and conduct mediation sessions to resolve divorce disputes amicably',
        defaultPriority: TaskPriority.MEDIUM,
        defaultAssigneeRole: UserRole.ATTORNEY,
        dueDateOffset: 14,
        requiredFields: ['mediationAgreement', 'financialDisclosures'],
        autoCreate: true
      },
      {
        id: 'divorce_custody_evaluation',
        name: 'Child Custody Evaluation',
        description: 'Complete child custody evaluation',
        caseType: CaseType.DIVORCE_FAMILY,
        phase: CasePhase.FORMAL_PROCEEDINGS,
        titleTemplate: 'Complete Custody Evaluation - {caseTitle}',
        descriptionTemplate: 'Coordinate with custody evaluator, provide necessary documentation, and prepare for custody hearing',
        defaultPriority: TaskPriority.HIGH,
        defaultAssigneeRole: UserRole.ATTORNEY,
        dueDateOffset: 21,
        requiredFields: ['custodyQuestionnaire', 'homeStudy', 'childInterviewNotes'],
        autoCreate: true
      },
      // Medical Malpractice Templates
      {
        id: 'medical_record_review',
        name: 'Medical Record Review',
        description: 'Review medical records for potential malpractice',
        caseType: CaseType.MEDICAL_MALPRACTICE,
        phase: CasePhase.INTAKE_RISK_ASSESSMENT,
        titleTemplate: 'Review Medical Records - {caseTitle}',
        descriptionTemplate: 'Thoroughly review medical records to identify potential standard of care violations',
        defaultPriority: TaskPriority.HIGH,
        defaultAssigneeRole: UserRole.ATTORNEY,
        dueDateOffset: 7,
        requiredFields: ['medicalRecords', 'expertConsultationReport'],
        autoCreate: true
      },
      {
        id: 'expert_witness_coordination',
        name: 'Expert Witness Coordination',
        description: 'Coordinate with medical expert witnesses',
        caseType: CaseType.MEDICAL_MALPRACTICE,
        phase: CasePhase.PRE_PROCEEDING_PREPARATION,
        titleTemplate: 'Coordinate Expert Witnesses - {caseTitle}',
        descriptionTemplate: 'Identify, retain, and prepare medical expert witnesses for case',
        defaultPriority: TaskPriority.MEDIUM,
        defaultAssigneeRole: UserRole.ATTORNEY,
        dueDateOffset: 10,
        requiredFields: ['expertRetainerAgreement', 'expertReport'],
        autoCreate: true
      }
    ];

    templates.forEach(template => {
      this.taskTemplates.set(template.id, template);
    });
  }

  public async processPhaseTransition(
    caseId: string,
    fromPhase: CasePhase,
    toPhase: CasePhase,
    caseType: CaseType,
    userRole: UserRole,
    userId: string,
    metadata: Record<string, any>
  ): Promise<WorkflowResult> {
    const context: WorkflowContext = {
      caseId,
      caseType,
      currentPhase: toPhase,
      previousPhase: fromPhase,
      metadata,
      userId,
      userRole,
      timestamp: new Date()
    };

    // Validate phase transition using state machine
    const currentState: CaseState = {
      phase: fromPhase,
      status: 'ACTIVE' as any,
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

    const result: WorkflowResult = {
      success: true,
      createdTasks: [],
      updatedTasks: [],
      notifications: [],
      errors: []
    };

    try {
      // Store workflow history
      this.addToWorkflowHistory(caseId, context);

      // Process task creation rules
      await this.processTaskCreationRules(context, result);

      // Process task update rules
      await this.processTaskUpdateRules(context, result);

      // Generate notifications
      await this.generateNotifications(context, result);

      return result;
    } catch (error) {
      return {
        success: false,
        createdTasks: [],
        updatedTasks: [],
        notifications: [],
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      };
    }
  }

  public async evaluateTaskRules(context: WorkflowContext): Promise<WorkflowResult> {
    const result: WorkflowResult = {
      success: true,
      createdTasks: [],
      updatedTasks: [],
      notifications: [],
      errors: []
    };

    try {
      // Get active rules sorted by priority
      const activeRules = Array.from(this.taskRules.values())
        .filter(rule => rule.active)
        .sort((a, b) => a.priority - b.priority);

      for (const rule of activeRules) {
        if (this.evaluateRuleConditions(rule, context)) {
          await this.executeRuleActions(rule, context, result);
        }
      }

      return result;
    } catch (error) {
      return {
        success: false,
        createdTasks: [],
        updatedTasks: [],
        notifications: [],
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      };
    }
  }

  private async processTaskCreationRules(context: WorkflowContext, result: WorkflowResult): Promise<void> {
    // Find templates that match the current case type and phase
    const matchingTemplates = Array.from(this.taskTemplates.values())
      .filter(template => 
        template.caseType === context.caseType && 
        template.phase === context.currentPhase &&
        template.autoCreate
      );

    for (const template of matchingTemplates) {
      // Check if template conditions are met
      if (template.conditions && !this.evaluateConditions(template.conditions, context.metadata)) {
        continue;
      }

      // Create task from template
      const task = this.createTaskFromTemplate(template, context);
      result.createdTasks.push(task);
    }
  }

  private async processTaskUpdateRules(context: WorkflowContext, result: WorkflowResult): Promise<void> {
    // Process existing task updates based on phase changes
    const updatedTasks = this.findTasksToUpdate(context);
    
    for (const taskUpdate of updatedTasks) {
      result.updatedTasks.push(taskUpdate);
    }
  }

  private createTaskFromTemplate(template: TaskTemplate, context: WorkflowContext): CreatedTask {
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
      assignedTo: context.userId, // Default to current user, will be reassigned by assignment logic
      assignedBy: context.userId,
      dueDate,
      priority: template.defaultPriority,
      status: TaskStatus.PENDING,
      metadata: {
        templateId: template.id,
        phase: context.currentPhase,
        autoGenerated: true
      }
    };
  }

  private findTasksToUpdate(context: WorkflowContext): UpdatedTask[] {
    // This would typically query the database for tasks that need updates
    // For now, return empty array - will be implemented with database integration
    return [];
  }

  private evaluateRuleConditions(rule: TaskRule, context: WorkflowContext): boolean {
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

  private evaluateConditions(conditions: TaskCondition[], data: Record<string, any>): boolean {
    return conditions.every(condition => {
      const fieldValue = this.getNestedValue(data, condition.field);
      return this.evaluateCondition(condition, fieldValue);
    });
  }

  private evaluateCondition(condition: TaskCondition, fieldValue: any): boolean {
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

  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private async executeRuleActions(rule: TaskRule, context: WorkflowContext, result: WorkflowResult): Promise<void> {
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

  private async handleCreateTaskAction(action: TaskAction, context: WorkflowContext, result: WorkflowResult): Promise<void> {
    // Implementation for creating tasks based on action parameters
    // This would typically create a task in the database
  }

  private async handleUpdateTaskAction(action: TaskAction, context: WorkflowContext, result: WorkflowResult): Promise<void> {
    // Implementation for updating tasks based on action parameters
  }

  private async handleAssignTaskAction(action: TaskAction, context: WorkflowContext, result: WorkflowResult): Promise<void> {
    // Implementation for assigning tasks based on action parameters
  }

  private async handleEscalateTaskAction(action: TaskAction, context: WorkflowContext, result: WorkflowResult): Promise<void> {
    // Implementation for escalating tasks based on action parameters
  }

  private async handleNotifyAction(action: TaskAction, context: WorkflowContext, result: WorkflowResult): Promise<void> {
    const notification: Notification = {
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

  private async generateNotifications(context: WorkflowContext, result: WorkflowResult): Promise<void> {
    // Generate notifications based on phase transition and task creation
    if (result.createdTasks.length > 0) {
      const notification: Notification = {
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

  private interpolateTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{([^}]+)\}/g, (match, key) => {
      const value = this.getNestedValue(data, key);
      return value !== undefined ? String(value) : match;
    });
  }

  private addToWorkflowHistory(caseId: string, context: WorkflowContext): void {
    if (!this.workflowHistory.has(caseId)) {
      this.workflowHistory.set(caseId, []);
    }
    this.workflowHistory.get(caseId)!.push(context);
  }

  public getTaskTemplates(caseType?: CaseType, phase?: CasePhase): TaskTemplate[] {
    return Array.from(this.taskTemplates.values()).filter(template => {
      if (caseType && template.caseType !== caseType) return false;
      if (phase && template.phase !== phase) return false;
      return true;
    });
  }

  public getTaskRules(activeOnly: boolean = true): TaskRule[] {
    return Array.from(this.taskRules.values()).filter(rule => !activeOnly || rule.active);
  }

  public getWorkflowHistory(caseId: string): WorkflowContext[] {
    return this.workflowHistory.get(caseId) || [];
  }

  public addTaskTemplate(template: TaskTemplate): void {
    this.taskTemplates.set(template.id, template);
  }

  public addTaskRule(rule: TaskRule): void {
    this.taskRules.set(rule.id, rule);
  }

  public updateTaskRule(ruleId: string, updates: Partial<TaskRule>): boolean {
    const rule = this.taskRules.get(ruleId);
    if (!rule) return false;

    Object.assign(rule, updates);
    return true;
  }

  public removeTaskRule(ruleId: string): boolean {
    return this.taskRules.delete(ruleId);
  }

  public removeTaskTemplate(templateId: string): boolean {
    return this.taskTemplates.delete(templateId);
  }
}