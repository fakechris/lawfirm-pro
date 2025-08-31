import { CaseType, CasePhase, TaskStatus, TaskPriority, UserRole } from '@prisma/client';

export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  category: 'task_assignment' | 'escalation' | 'deadline_management' | 'workload_balance' | 'compliance' | 'quality_control';
  priority: number;
  isActive: boolean;
  conditions: BusinessCondition[];
  actions: BusinessAction[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
  successCount: number;
  failureCount: number;
}

export interface BusinessCondition {
  id: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'exists' | 'not_exists' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'matches_pattern';
  value: any;
  logicalOperator?: 'AND' | 'OR';
  weight?: number; // for scoring
}

export interface BusinessAction {
  id: string;
  type: 'assign_task' | 'escalate_task' | 'change_priority' | 'set_deadline' | 'send_notification' | 'create_dependency' | 'update_status' | 'request_review' | 'reassign_task';
  parameters: Record<string, any>;
  failureStrategy: 'continue' | 'stop' | 'rollback';
  weight?: number; // for scoring
}

export interface RuleEvaluationContext {
  caseId?: string;
  taskId?: string;
  userId?: string;
  timestamp: Date;
  metadata: Record<string, any>;
  triggerEvent: {
    type: 'task_created' | 'task_updated' | 'phase_changed' | 'deadline_approaching' | 'user_action' | 'system_event';
    details: Record<string, any>;
  };
}

export interface RuleEvaluationResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  score: number; // 0-100
  confidence: number; // 0-1
  actionsExecuted: BusinessAction[];
  results: ActionResult[];
  errors: string[];
  warnings: string[];
  executionTime: number;
}

export interface ActionResult {
  actionId: string;
  actionType: string;
  success: boolean;
  result: any;
  error?: string;
  executionTime: number;
}

export interface TaskAssignmentCandidate {
  userId: string;
  userName: string;
  role: UserRole;
  score: number;
  factors: AssignmentFactor[];
  available: boolean;
  currentWorkload: number;
  expertise: string[];
}

export interface AssignmentFactor {
  name: string;
  value: number;
  weight: number;
  description: string;
}

export interface EscalationPath {
  level: number;
  fromRole: UserRole;
  toRole: UserRole;
  conditions: EscalationCondition[];
  notificationRules: NotificationRule[];
  approvalRequired: boolean;
}

export interface EscalationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than';
  value: any;
}

export interface NotificationRule {
  type: 'email' | 'in_app' | 'sms';
  recipients: string[]; // role-based or user-specific
  template: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  delay?: number; // minutes
}

export interface BusinessRuleStats {
  totalRules: number;
  activeRules: number;
  totalEvaluations: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  topPerformingRules: Array<{
    ruleId: string;
    ruleName: string;
    successRate: number;
    executionCount: number;
  }>;
  ruleCategories: Array<{
    category: string;
    ruleCount: number;
    executionCount: number;
  }>;
}

export class BusinessRuleEngine {
  private rules: Map<string, BusinessRule>;
  private escalationPaths: Map<string, EscalationPath[]>;
  private assignmentMatrix: Map<string, number[][]>; // role x expertise matrix
  private evaluationHistory: Array<{
    id: string;
    context: RuleEvaluationContext;
    results: RuleEvaluationResult[];
    timestamp: Date;
  }>;
  private performanceMetrics: Map<string, {
    evaluationCount: number;
    successCount: number;
    failureCount: number;
    averageExecutionTime: number;
    lastEvaluation: Date;
  }>;

  constructor() {
    this.rules = new Map();
    this.escalationPaths = new Map();
    this.assignmentMatrix = new Map();
    this.evaluationHistory = [];
    this.performanceMetrics = new Map();
    this.initializeDefaultRules();
    this.initializeEscalationPaths();
    this.initializeAssignmentMatrix();
  }

  private initializeDefaultRules(): void {
    // Task Assignment Rules
    this.addRule({
      id: 'expertise_based_assignment',
      name: 'Expertise-Based Task Assignment',
      description: 'Assign tasks to users with relevant expertise',
      category: 'task_assignment',
      priority: 1,
      isActive: true,
      conditions: [
        {
          id: 'has_expertise',
          field: 'task.requiredExpertise',
          operator: 'exists',
          value: null,
          weight: 0.8
        },
        {
          id: 'not_assigned',
          field: 'task.assignedTo',
          operator: 'not_exists',
          value: null,
          weight: 0.5
        }
      ],
      actions: [
        {
          id: 'assign_to_expert',
          type: 'assign_task',
          parameters: {
            strategy: 'expertise_based',
            considerWorkload: true,
            minExpertiseScore: 0.7
          },
          failureStrategy: 'continue'
        }
      ],
      metadata: {
        tags: ['assignment', 'expertise', 'automation']
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      triggerCount: 0,
      successCount: 0,
      failureCount: 0
    });

    // Workload Balancing Rules
    this.addRule({
      id: 'workload_balance_assignment',
      name: 'Workload-Based Assignment',
      description: 'Assign tasks to users with lowest current workload',
      category: 'task_assignment',
      priority: 2,
      isActive: true,
      conditions: [
        {
          id: 'unassigned_task',
          field: 'task.assignedTo',
          operator: 'not_exists',
          value: null,
          weight: 0.7
        },
        {
          id: 'normal_priority',
          field: 'task.priority',
          operator: 'in',
          value: ['LOW', 'MEDIUM'],
          weight: 0.3
        }
      ],
      actions: [
        {
          id: 'assign_to_least_busy',
          type: 'assign_task',
          parameters: {
            strategy: 'workload_balance',
            maxWorkloadThreshold: 0.8,
            considerAvailability: true
          },
          failureStrategy: 'continue'
        }
      ],
      metadata: {
        tags: ['assignment', 'workload', 'balance']
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      triggerCount: 0,
      successCount: 0,
      failureCount: 0
    });

    // High Priority Assignment Rules
    this.addRule({
      id: 'high_priority_assignment',
      name: 'High Priority Task Assignment',
      description: 'Immediately assign high priority tasks to available senior staff',
      category: 'task_assignment',
      priority: 3,
      isActive: true,
      conditions: [
        {
          id: 'high_priority',
          field: 'task.priority',
          operator: 'in',
          value: ['HIGH', 'URGENT'],
          weight: 0.9
        },
        {
          id: 'unassigned',
          field: 'task.assignedTo',
          operator: 'not_exists',
          value: null,
          weight: 0.8
        }
      ],
      actions: [
        {
          id: 'assign_to_senior',
          type: 'assign_task',
          parameters: {
            strategy: 'priority_based',
            requiredRole: UserRole.ATTORNEY,
            considerAvailability: true,
            notifyImmediately: true
          },
          failureStrategy: 'stop'
        },
        {
          id: 'notify_supervisor',
          type: 'send_notification',
          parameters: {
            type: 'email',
            recipients: ['supervisor'],
            template: 'high_priority_task_assigned',
            urgency: 'high'
          },
          failureStrategy: 'continue'
        }
      ],
      metadata: {
        tags: ['assignment', 'high_priority', 'urgent']
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      triggerCount: 0,
      successCount: 0,
      failureCount: 0
    });

    // Task Escalation Rules
    this.addRule({
      id: 'overdue_task_escalation',
      name: 'Overdue Task Escalation',
      description: 'Escalate overdue tasks to supervisors',
      category: 'escalation',
      priority: 4,
      isActive: true,
      conditions: [
        {
          id: 'task_overdue',
          field: 'task.dueDate',
          operator: 'less_than',
          value: new Date(),
          weight: 0.9
        },
        {
          id: 'not_completed',
          field: 'task.status',
          operator: 'not_equals',
          value: 'COMPLETED',
          weight: 0.8
        },
        {
          id: 'low_escalation_level',
          field: 'task.escalationLevel',
          operator: 'less_than',
          value: 3,
          weight: 0.6
        }
      ],
      actions: [
        {
          id: 'escalate_task',
          type: 'escalate_task',
          parameters: {
            incrementLevel: 1,
            notifySupervisor: true,
            addDeadlineExtension: 24 // hours
          },
          failureStrategy: 'continue'
        },
        {
          id: 'notify_assignee',
          type: 'send_notification',
          parameters: {
            type: 'in_app',
            recipients: ['assignee'],
            template: 'task_escalated',
            urgency: 'high'
          },
          failureStrategy: 'continue'
        }
      ],
      metadata: {
        tags: ['escalation', 'overdue', 'deadline']
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      triggerCount: 0,
      successCount: 0,
      failureCount: 0
    });

    // Deadline Management Rules
    this.addRule({
      id: 'deadline_adjustment',
      name: 'Intelligent Deadline Adjustment',
      description: 'Automatically adjust deadlines based on complexity and dependencies',
      category: 'deadline_management',
      priority: 5,
      isActive: true,
      conditions: [
        {
          id: 'has_dependencies',
          field: 'task.dependencies',
          operator: 'exists',
          value: null,
          weight: 0.7
        },
        {
          id: 'complex_task',
          field: 'task.estimatedDuration',
          operator: 'greater_than',
          value: 8, // hours
          weight: 0.6
        }
      ],
      actions: [
        {
          id: 'adjust_deadline',
          type: 'set_deadline',
          parameters: {
            strategy: 'complexity_based',
            bufferPercentage: 0.2, // 20% buffer
            considerDependencies: true,
            minExtension: 24 // hours
          },
          failureStrategy: 'continue'
        }
      ],
      metadata: {
        tags: ['deadline', 'planning', 'complexity']
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      triggerCount: 0,
      successCount: 0,
      failureCount: 0
    });

    // Compliance Rules
    this.addRule({
      id: 'compliance_review_required',
      name: 'Compliance Review Requirement',
      description: 'Require compliance review for certain case types',
      category: 'compliance',
      priority: 6,
      isActive: true,
      conditions: [
        {
          id: 'regulated_case_type',
          field: 'case.type',
          operator: 'in',
          value: ['CRIMINAL_DEFENSE', 'MEDICAL_MALPRACTICE'],
          weight: 0.9
        },
        {
          id: 'critical_task',
          field: 'task.category',
          operator: 'in',
          value: ['court_filing', 'evidence_handling'],
          weight: 0.8
        }
      ],
      actions: [
        {
          id: 'request_compliance_review',
          type: 'request_review',
          parameters: {
            reviewType: 'compliance',
            requiredRole: UserRole.ADMIN,
            deadlineOffset: 48, // hours
            autoApproveIfNoResponse: false
          },
          failureStrategy: 'stop'
        },
        {
          id: 'notify_compliance_officer',
          type: 'send_notification',
          parameters: {
            type: 'email',
            recipients: ['compliance_officer'],
            template: 'compliance_review_required',
            urgency: 'high'
          },
          failureStrategy: 'continue'
        }
      ],
      metadata: {
        tags: ['compliance', 'review', 'regulatory']
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      triggerCount: 0,
      successCount: 0,
      failureCount: 0
    });

    // Quality Control Rules
    this.addRule({
      id: 'quality_check_before_completion',
      name: 'Quality Check Before Task Completion',
      description: 'Ensure quality checks are performed before marking tasks complete',
      category: 'quality_control',
      priority: 7,
      isActive: true,
      conditions: [
        {
          id: 'high_value_task',
          field: 'task.value',
          operator: 'greater_than',
          value: 10000, // monetary value threshold
          weight: 0.8
        },
        {
          id: 'completion_attempted',
          field: 'event.type',
          operator: 'equals',
          value: 'task_completion_attempted',
          weight: 0.9
        }
      ],
      actions: [
        {
          id: 'require_quality_review',
          type: 'request_review',
          parameters: {
            reviewType: 'quality',
            requiredRole: UserRole.ATTORNEY,
            deadlineOffset: 24,
            checkList: ['document_accuracy', 'client_communication', 'deadline_compliance']
          },
          failureStrategy: 'stop'
        }
      ],
      metadata: {
        tags: ['quality', 'review', 'validation']
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      triggerCount: 0,
      successCount: 0,
      failureCount: 0
    });

    // Task Dependency Rules
    this.addRule({
      id: 'dependency_auto_activation',
      name: 'Dependency-Based Task Activation',
      description: 'Automatically activate tasks when dependencies are completed',
      category: 'task_assignment',
      priority: 8,
      isActive: true,
      conditions: [
        {
          id: 'has_completed_dependencies',
          field: 'task.completedDependencies',
          operator: 'greater_than',
          value: 0,
          weight: 0.8
        },
        {
          id: 'waiting_for_dependencies',
          field: 'task.status',
          operator: 'equals',
          value: 'WAITING_DEPENDENCIES',
          weight: 0.9
        }
      ],
      actions: [
        {
          id: 'activate_task',
          type: 'update_status',
          parameters: {
            newStatus: 'PENDING',
            notifyAssignee: true,
            autoSchedule: true
          },
          failureStrategy: 'continue'
        }
      ],
      metadata: {
        tags: ['dependencies', 'automation', 'workflow']
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      triggerCount: 0,
      successCount: 0,
      failureCount: 0
    });
  }

  private initializeEscalationPaths(): void {
    // Define escalation paths for different roles and scenarios
    const paths: Record<string, EscalationPath[]> = {
      [UserRole.ASSISTANT]: [
        {
          level: 1,
          fromRole: UserRole.ASSISTANT,
          toRole: UserRole.ATTORNEY,
          conditions: [
            { field: 'escalationLevel', operator: 'equals', value: 1 }
          ],
          notificationRules: [
            { type: 'email', recipients: ['attorney'], template: 'task_escalated_to_attorney', urgency: 'medium' }
          ],
          approvalRequired: false
        },
        {
          level: 2,
          fromRole: UserRole.ASSISTANT,
          toRole: UserRole.ADMIN,
          conditions: [
            { field: 'escalationLevel', operator: 'equals', value: 2 }
          ],
          notificationRules: [
            { type: 'email', recipients: ['admin'], template: 'task_escalated_to_admin', urgency: 'high' }
          ],
          approvalRequired: true
        }
      ],
      [UserRole.ATTORNEY]: [
        {
          level: 1,
          fromRole: UserRole.ATTORNEY,
          toRole: UserRole.ADMIN,
          conditions: [
            { field: 'escalationLevel', operator: 'equals', value: 1 }
          ],
          notificationRules: [
            { type: 'email', recipients: ['admin'], template: 'attorney_task_escalated', urgency: 'high' }
          ],
          approvalRequired: false
        }
      ]
    };

    Object.entries(paths).forEach(([role, rolePaths]) => {
      this.escalationPaths.set(role, rolePaths);
    });
  }

  private initializeAssignmentMatrix(): void {
    // Initialize expertise matrix for different roles and case types
    const expertiseMatrix: Record<string, number[]> = {
      [UserRole.ATTORNEY]: [
        0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1 // CRIMINAL_DEFENSE through SPECIAL_MATTERS
      ],
      [UserRole.ASSISTANT]: [
        0.4, 0.3, 0.5, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2
      ],
      [UserRole.ADMIN]: [
        0.3, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.4
      ]
    };

    Object.entries(expertiseMatrix).forEach(([role, scores]) => {
      this.assignmentMatrix.set(role, scores);
    });
  }

  public async evaluateRules(context: RuleEvaluationContext): Promise<RuleEvaluationResult[]> {
    const results: RuleEvaluationResult[] = [];
    const startTime = Date.now();

    try {
      // Get active rules sorted by priority
      const activeRules = Array.from(this.rules.values())
        .filter(rule => rule.isActive)
        .sort((a, b) => a.priority - b.priority);

      for (const rule of activeRules) {
        const result = await this.evaluateRule(rule, context);
        results.push(result);

        // Update performance metrics
        this.updatePerformanceMetrics(rule.id, result);
      }

      // Store evaluation history
      this.evaluationHistory.push({
        id: `evaluation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        context,
        results,
        timestamp: new Date()
      });

      return results;
    } catch (error) {
      console.error('Error evaluating business rules:', error);
      return results;
    }
  }

  private async evaluateRule(rule: BusinessRule, context: RuleEvaluationContext): Promise<RuleEvaluationResult> {
    const startTime = Date.now();
    const result: RuleEvaluationResult = {
      ruleId: rule.id,
      ruleName: rule.name,
      matched: false,
      score: 0,
      confidence: 0,
      actionsExecuted: [],
      results: [],
      errors: [],
      warnings: [],
      executionTime: 0
    };

    try {
      // Evaluate conditions
      const conditionResult = this.evaluateConditions(rule.conditions, context);
      result.matched = conditionResult.matched;
      result.score = conditionResult.score;
      result.confidence = conditionResult.confidence;

      if (result.matched) {
        // Execute actions
        for (const action of rule.actions) {
          const actionResult = await this.executeAction(action, context);
          result.actionsExecuted.push(action);
          result.results.push(actionResult);

          if (!actionResult.success && action.failureStrategy === 'stop') {
            result.errors.push(`Action ${action.type} failed and rule execution stopped`);
            break;
          }
        }

        // Update rule statistics
        rule.lastTriggered = new Date();
        rule.triggerCount++;
        rule.successCount++;
        rule.updatedAt = new Date();
      }

      result.executionTime = Date.now() - startTime;
      return result;
    } catch (error) {
      result.errors.push(`Rule evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.executionTime = Date.now() - startTime;
      rule.failureCount++;
      rule.updatedAt = new Date();
      return result;
    }
  }

  private evaluateConditions(conditions: BusinessCondition[], context: RuleEvaluationContext): {
    matched: boolean;
    score: number;
    confidence: number;
  } {
    if (conditions.length === 0) {
      return { matched: true, score: 100, confidence: 1 };
    }

    let totalScore = 0;
    let totalWeight = 0;
    let matchedConditions = 0;
    let currentLogicalOperator = 'AND';

    for (const condition of conditions) {
      const conditionResult = this.evaluateCondition(condition, context);
      
      if (conditionResult.matched) {
        matchedConditions++;
        totalScore += conditionResult.score * (condition.weight || 1);
      }

      totalWeight += condition.weight || 1;

      // Handle logical operators
      if (condition.logicalOperator) {
        if (currentLogicalOperator === 'OR' && conditionResult.matched) {
          // OR condition matched, we can stop here
          break;
        }
        currentLogicalOperator = condition.logicalOperator;
      }
    }

    const score = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;
    const confidence = conditions.length > 0 ? matchedConditions / conditions.length : 1;
    const matched = currentLogicalOperator === 'OR' ? matchedConditions > 0 : matchedConditions === conditions.length;

    return { matched, score, confidence };
  }

  private evaluateCondition(condition: BusinessCondition, context: RuleEvaluationContext): {
    matched: boolean;
    score: number;
  } {
    const fieldValue = this.getNestedValue(context.metadata, condition.field);
    const conditionValue = condition.value;
    let matched = false;

    switch (condition.operator) {
      case 'equals':
        matched = fieldValue === conditionValue;
        break;
      case 'not_equals':
        matched = fieldValue !== conditionValue;
        break;
      case 'contains':
        matched = Array.isArray(fieldValue) && fieldValue.includes(conditionValue);
        break;
      case 'exists':
        matched = fieldValue !== undefined && fieldValue !== null;
        break;
      case 'not_exists':
        matched = fieldValue === undefined || fieldValue === null;
        break;
      case 'greater_than':
        matched = fieldValue > conditionValue;
        break;
      case 'less_than':
        matched = fieldValue < conditionValue;
        break;
      case 'in':
        matched = Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
        break;
      case 'not_in':
        matched = Array.isArray(conditionValue) && !conditionValue.includes(fieldValue);
        break;
      case 'matches_pattern':
        matched = new RegExp(conditionValue).test(String(fieldValue));
        break;
      default:
        matched = false;
    }

    const score = matched ? 100 : 0;
    return { matched, score };
  }

  private async executeAction(action: BusinessAction, context: RuleEvaluationContext): Promise<ActionResult> {
    const startTime = Date.now();
    
    try {
      let result: any;

      switch (action.type) {
        case 'assign_task':
          result = await this.handleAssignTaskAction(action, context);
          break;
        case 'escalate_task':
          result = await this.handleEscalateTaskAction(action, context);
          break;
        case 'change_priority':
          result = await this.handleChangePriorityAction(action, context);
          break;
        case 'set_deadline':
          result = await this.handleSetDeadlineAction(action, context);
          break;
        case 'send_notification':
          result = await this.handleSendNotificationAction(action, context);
          break;
        case 'create_dependency':
          result = await this.handleCreateDependencyAction(action, context);
          break;
        case 'update_status':
          result = await this.handleUpdateStatusAction(action, context);
          break;
        case 'request_review':
          result = await this.handleRequestReviewAction(action, context);
          break;
        case 'reassign_task':
          result = await this.handleReassignTaskAction(action, context);
          break;
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      return {
        actionId: action.id,
        actionType: action.type,
        success: true,
        result,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        actionId: action.id,
        actionType: action.type,
        success: false,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  private async handleAssignTaskAction(action: BusinessAction, context: RuleEvaluationContext): Promise<any> {
    const candidates = this.findAssignmentCandidates(context.metadata);
    const strategy = action.parameters.strategy;

    let selectedCandidate: TaskAssignmentCandidate | null = null;

    switch (strategy) {
      case 'expertise_based':
        selectedCandidate = this.selectByExpertise(candidates, context.metadata);
        break;
      case 'workload_balance':
        selectedCandidate = this.selectByWorkload(candidates, action.parameters);
        break;
      case 'priority_based':
        selectedCandidate = this.selectByPriority(candidates, context.metadata);
        break;
      default:
        selectedCandidate = candidates[0] || null;
    }

    return {
      assignedTo: selectedCandidate?.userId,
      assignmentStrategy: strategy,
      candidatesConsidered: candidates.length,
      selectedScore: selectedCandidate?.score || 0
    };
  }

  private async handleEscalateTaskAction(action: BusinessAction, context: RuleEvaluationContext): Promise<any> {
    const currentRole = context.metadata.task?.assignedTo?.role;
    const escalationLevel = context.metadata.task?.escalationLevel || 0;

    if (!currentRole) {
      throw new Error('Cannot escalate task without current assignee role');
    }

    const escalationPath = this.escalationPaths.get(currentRole);
    if (!escalationPath) {
      throw new Error(`No escalation path defined for role: ${currentRole}`);
    }

    const nextLevel = escalationPath.find(path => path.level === escalationLevel + 1);
    if (!nextLevel) {
      throw new Error(`No next escalation level found for level ${escalationLevel}`);
    }

    return {
      escalatedTo: nextLevel.toRole,
      escalationLevel: escalationLevel + 1,
      approvalRequired: nextLevel.approvalRequired,
      notifications: nextLevel.notificationRules
    };
  }

  private async handleChangePriorityAction(action: BusinessAction, context: RuleEvaluationContext): Promise<any> {
    const newPriority = action.parameters.priority;
    const reason = action.parameters.reason;

    return {
      newPriority,
      reason,
      changedBy: context.userId,
      timestamp: new Date()
    };
  }

  private async handleSetDeadlineAction(action: BusinessAction, context: RuleEvaluationContext): Promise<any> {
    const strategy = action.parameters.strategy;
    const currentDeadline = context.metadata.task?.dueDate;

    let newDeadline: Date;

    switch (strategy) {
      case 'complexity_based':
        newDeadline = this.calculateComplexityBasedDeadline(context.metadata, action.parameters);
        break;
      case 'dependency_based':
        newDeadline = this.calculateDependencyBasedDeadline(context.metadata, action.parameters);
        break;
      default:
        newDeadline = new Date(currentDeadline || Date.now());
    }

    return {
      newDeadline,
      oldDeadline: currentDeadline,
      strategy,
      reason: action.parameters.reason
    };
  }

  private async handleSendNotificationAction(action: BusinessAction, context: RuleEvaluationContext): Promise<any> {
    return {
      type: action.parameters.type,
      recipients: action.parameters.recipients,
      template: action.parameters.template,
      urgency: action.parameters.urgency,
      sent: true,
      timestamp: new Date()
    };
  }

  private async handleCreateDependencyAction(action: BusinessAction, context: RuleEvaluationContext): Promise<any> {
    return {
      dependencyType: action.parameters.dependencyType,
      created: true,
      timestamp: new Date()
    };
  }

  private async handleUpdateStatusAction(action: BusinessAction, context: RuleEvaluationContext): Promise<any> {
    return {
      newStatus: action.parameters.newStatus,
      updatedBy: context.userId,
      timestamp: new Date()
    };
  }

  private async handleRequestReviewAction(action: BusinessAction, context: RuleEvaluationContext): Promise<any> {
    return {
      reviewType: action.parameters.reviewType,
      requestedFrom: action.parameters.requiredRole,
      deadline: new Date(Date.now() + (action.parameters.deadlineOffset || 24) * 60 * 60 * 1000),
      autoApprove: action.parameters.autoApproveIfNoResponse,
      checklist: action.parameters.checkList || []
    };
  }

  private async handleReassignTaskAction(action: BusinessAction, context: RuleEvaluationContext): Promise<any> {
    const candidates = this.findAssignmentCandidates(context.metadata);
    const selectedCandidate = candidates[0]; // Simple selection for now

    return {
      reassignedTo: selectedCandidate?.userId,
      reassignedBy: context.userId,
      reason: action.parameters.reason,
      timestamp: new Date()
    };
  }

  private findAssignmentCandidates(metadata: Record<string, any>): TaskAssignmentCandidate[] {
    // This would typically query the user service to get available users
    // For now, return mock candidates
    return [
      {
        userId: 'user1',
        userName: 'John Doe',
        role: UserRole.ATTORNEY,
        score: 0.85,
        factors: [
          { name: 'expertise', value: 0.9, weight: 0.6, description: 'High expertise match' },
          { name: 'workload', value: 0.7, weight: 0.3, description: 'Moderate workload' },
          { name: 'availability', value: 0.9, weight: 0.1, description: 'High availability' }
        ],
        available: true,
        currentWorkload: 0.6,
        expertise: ['criminal_defense', 'contract_dispute']
      },
      {
        userId: 'user2',
        userName: 'Jane Smith',
        role: UserRole.ATTORNEY,
        score: 0.75,
        factors: [
          { name: 'expertise', value: 0.8, weight: 0.6, description: 'Good expertise match' },
          { name: 'workload', value: 0.6, weight: 0.3, description: 'Good workload balance' },
          { name: 'availability', value: 0.8, weight: 0.1, description: 'Good availability' }
        ],
        available: true,
        currentWorkload: 0.4,
        expertise: ['medical_malpractice', 'family_law']
      }
    ];
  }

  private selectByExpertise(candidates: TaskAssignmentCandidate[], metadata: Record<string, any>): TaskAssignmentCandidate | null {
    const requiredExpertise = metadata.task?.requiredExpertise || [];
    return candidates
      .filter(candidate => 
        requiredExpertise.every(exp => candidate.expertise.includes(exp))
      )
      .sort((a, b) => b.score - a.score)[0] || null;
  }

  private selectByWorkload(candidates: TaskAssignmentCandidate[], parameters: Record<string, any>): TaskAssignmentCandidate | null {
    const maxThreshold = parameters.maxWorkloadThreshold || 0.8;
    return candidates
      .filter(candidate => candidate.currentWorkload <= maxThreshold)
      .sort((a, b) => a.currentWorkload - b.currentWorkload)[0] || null;
  }

  private selectByPriority(candidates: TaskAssignmentCandidate[], metadata: Record<string, any>): TaskAssignmentCandidate | null {
    const requiredRole = parameters.requiredRole;
    return candidates
      .filter(candidate => !requiredRole || candidate.role === requiredRole)
      .sort((a, b) => b.score - a.score)[0] || null;
  }

  private calculateComplexityBasedDeadline(metadata: Record<string, any>, parameters: Record<string, any>): Date {
    const estimatedDuration = metadata.task?.estimatedDuration || 4; // hours
    const bufferPercentage = parameters.bufferPercentage || 0.2;
    const minExtension = parameters.minExtension || 24; // hours
    
    const baseTime = new Date();
    const totalHours = estimatedDuration * (1 + bufferPercentage);
    const extension = Math.max(totalHours, minExtension);
    
    return new Date(baseTime.getTime() + extension * 60 * 60 * 1000);
  }

  private calculateDependencyBasedDeadline(metadata: Record<string, any>, parameters: Record<string, any>): Date {
    // Simple implementation - in real system would analyze dependency graph
    const dependencies = metadata.task?.dependencies || [];
    const maxDependencyDeadline = Math.max(...dependencies.map((dep: any) => 
      new Date(dep.dueDate).getTime()
    ), Date.now());
    
    return new Date(maxDependencyDeadline + 24 * 60 * 60 * 1000); // Add 24 hours buffer
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private updatePerformanceMetrics(ruleId: string, result: RuleEvaluationResult): void {
    let metrics = this.performanceMetrics.get(ruleId);
    
    if (!metrics) {
      metrics = {
        evaluationCount: 0,
        successCount: 0,
        failureCount: 0,
        averageExecutionTime: 0,
        lastEvaluation: new Date()
      };
      this.performanceMetrics.set(ruleId, metrics);
    }

    metrics.evaluationCount++;
    metrics.lastEvaluation = new Date();
    
    if (result.matched && result.errors.length === 0) {
      metrics.successCount++;
    } else if (result.errors.length > 0) {
      metrics.failureCount++;
    }

    // Update average execution time
    const totalExecutions = metrics.successCount + metrics.failureCount;
    metrics.averageExecutionTime = 
      (metrics.averageExecutionTime * (totalExecutions - 1) + result.executionTime) / totalExecutions;
  }

  // Public API methods
  public addRule(rule: BusinessRule): void {
    this.rules.set(rule.id, rule);
  }

  public getRule(id: string): BusinessRule | undefined {
    return this.rules.get(id);
  }

  public getRules(category?: string, activeOnly: boolean = true): BusinessRule[] {
    let rules = Array.from(this.rules.values());
    
    if (category) {
      rules = rules.filter(rule => rule.category === category);
    }
    
    if (activeOnly) {
      rules = rules.filter(rule => rule.isActive);
    }
    
    return rules.sort((a, b) => a.priority - b.priority);
  }

  public updateRule(id: string, updates: Partial<BusinessRule>): boolean {
    const rule = this.rules.get(id);
    if (!rule) return false;

    Object.assign(rule, updates, { updatedAt: new Date() });
    return true;
  }

  public deleteRule(id: string): boolean {
    return this.rules.delete(id);
  }

  public activateRule(id: string): boolean {
    const rule = this.rules.get(id);
    if (!rule) return false;

    rule.isActive = true;
    rule.updatedAt = new Date();
    return true;
  }

  public deactivateRule(id: string): boolean {
    const rule = this.rules.get(id);
    if (!rule) return false;

    rule.isActive = false;
    rule.updatedAt = new Date();
    return true;
  }

  public getStats(): BusinessRuleStats {
    const totalRules = this.rules.size;
    const activeRules = Array.from(this.rules.values()).filter(rule => rule.isActive).length;
    
    let totalEvaluations = 0;
    let successfulExecutions = 0;
    let failedExecutions = 0;
    let totalExecutionTime = 0;

    this.performanceMetrics.forEach(metrics => {
      totalEvaluations += metrics.evaluationCount;
      successfulExecutions += metrics.successCount;
      failedExecutions += metrics.failureCount;
      totalExecutionTime += metrics.averageExecutionTime * metrics.evaluationCount;
    });

    const averageExecutionTime = totalEvaluations > 0 ? totalExecutionTime / totalEvaluations : 0;

    // Top performing rules
    const topPerformingRules = Array.from(this.rules.values())
      .map(rule => ({
        ruleId: rule.id,
        ruleName: rule.name,
        successRate: rule.triggerCount > 0 ? (rule.successCount / rule.triggerCount) * 100 : 0,
        executionCount: rule.triggerCount
      }))
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);

    // Rule categories
    const categoryStats = new Map<string, { ruleCount: number; executionCount: number }>();
    this.rules.forEach(rule => {
      const stats = categoryStats.get(rule.category) || { ruleCount: 0, executionCount: 0 };
      stats.ruleCount++;
      stats.executionCount += rule.triggerCount;
      categoryStats.set(rule.category, stats);
    });

    const ruleCategories = Array.from(categoryStats.entries()).map(([category, stats]) => ({
      category,
      ruleCount: stats.ruleCount,
      executionCount: stats.executionCount
    }));

    return {
      totalRules,
      activeRules,
      totalEvaluations,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime,
      topPerformingRules,
      ruleCategories
    };
  }

  public getEvaluationHistory(limit?: number): Array<{
    id: string;
    context: RuleEvaluationContext;
    results: RuleEvaluationResult[];
    timestamp: Date;
  }> {
    let history = [...this.evaluationHistory];
    history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    if (limit) {
      history = history.slice(0, limit);
    }
    
    return history;
  }

  public getEscalationPaths(role?: UserRole): EscalationPath[] {
    if (role) {
      return this.escalationPaths.get(role) || [];
    }
    
    return Array.from(this.escalationPaths.values()).flat();
  }

  public addEscalationPath(role: UserRole, path: EscalationPath): void {
    const paths = this.escalationPaths.get(role) || [];
    paths.push(path);
    this.escalationPaths.set(role, paths);
  }

  public testRule(ruleId: string, context: RuleEvaluationContext): Promise<RuleEvaluationResult> {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }
    
    return this.evaluateRule(rule, context);
  }
}