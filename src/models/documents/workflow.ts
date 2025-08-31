import { 
  DocumentWorkflow, 
  DocumentWorkflowStep,
  Document,
  User
} from '@prisma/client';

// Core Workflow Types
export interface DocumentWorkflowWithDetails extends DocumentWorkflow {
  document?: Document;
  steps?: DocumentWorkflowStepWithDetails[];
  startedByUser?: User;
  currentStep?: DocumentWorkflowStepWithDetails;
  _count?: {
    steps: number;
    completedSteps: number;
  };
}

export interface DocumentWorkflowStepWithDetails extends DocumentWorkflowStep {
  workflow?: DocumentWorkflow;
  assignedToUser?: User;
  dependencies?: WorkflowStepDependency[];
  dependents?: WorkflowStepDependency[];
  actions?: WorkflowStepAction[];
}

export interface WorkflowStepDependency {
  id: string;
  stepId: string;
  dependsOnStepId: string;
  dependencyType: 'blocks' | 'related' | 'optional';
  createdAt: Date;
}

export interface WorkflowStepAction {
  id: string;
  stepId: string;
  action: string;
  performedBy: string;
  performedAt: Date;
  notes?: string;
  metadata?: Record<string, unknown>;
}

// Workflow Template Types
export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  steps: WorkflowTemplateStep[];
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
}

export interface WorkflowTemplateStep {
  id: string;
  name: string;
  description?: string;
  order: number;
  assignedToRole?: string;
  dueDateOffset?: number; // days from previous step
  isRequired: boolean;
  isParallel: boolean;
  conditions?: WorkflowCondition[];
  actions?: WorkflowAction[];
}

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than';
  value: unknown;
  logicalOperator?: 'and' | 'or';
}

export interface WorkflowAction {
  name: string;
  type: 'notification' | 'update_status' | 'create_task' | 'send_email' | 'custom';
  config: Record<string, unknown>;
  conditions?: WorkflowCondition[];
}

// Input Types for Creating Workflows
export interface CreateWorkflowInput {
  documentId: string;
  workflowType: string;
  status: string;
  startedBy: string;
  templateId?: string;
  steps?: CreateWorkflowStepInput[];
}

export interface CreateWorkflowStepInput {
  workflowId: string;
  stepNumber: number;
  name: string;
  description?: string;
  assignedTo?: string;
  assignedToRole?: string;
  dueDate?: Date;
  dueDateOffset?: number;
  isRequired: boolean;
  isParallel: boolean;
  conditions?: WorkflowCondition[];
  actions?: WorkflowAction[];
}

export interface UpdateWorkflowInput {
  status?: string;
  currentStep?: number;
  completedAt?: Date;
}

export interface UpdateWorkflowStepInput {
  status?: string;
  assignedTo?: string;
  dueDate?: Date;
  action?: string;
  notes?: string;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface CreateWorkflowTemplateInput {
  name: string;
  description?: string;
  category: string;
  steps: WorkflowTemplateStep[];
  isPublic?: boolean;
  createdBy: string;
}

// Query and Filter Types
export interface DocumentWorkflowQuery {
  documentId?: string;
  status?: string;
  workflowType?: string;
  startedBy?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface WorkflowStepQuery {
  workflowId?: string;
  status?: string;
  assignedTo?: string;
  dueBefore?: Date;
  dueAfter?: Date;
  isOverdue?: boolean;
}

// Pagination Types
export interface WorkflowPaginationParams {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'status' | 'currentStep';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedWorkflowResult {
  data: DocumentWorkflowWithDetails[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Workflow Execution Types
export interface WorkflowExecutionOptions {
  autoAssign?: boolean;
  sendNotifications?: boolean;
  createTasks?: boolean;
  validatePermissions?: boolean;
  dryRun?: boolean;
}

export interface WorkflowExecutionResult {
  success: boolean;
  workflowId?: string;
  startedSteps: string[];
  errors: string[];
  warnings: string[];
  nextSteps?: WorkflowStepRecommendation[];
}

export interface WorkflowStepRecommendation {
  stepId: string;
  stepName: string;
  recommendedAction: string;
  priority: 'low' | 'medium' | 'high';
  reason: string;
  dueDate?: Date;
}

// Workflow Automation Types
export interface WorkflowAutomationRule {
  id: string;
  name: string;
  description?: string;
  trigger: WorkflowTrigger;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowTrigger {
  type: 'document_status' | 'workflow_step' | 'time_based' | 'external_event';
  config: Record<string, unknown>;
}

export interface WorkflowAutomationResult {
  success: boolean;
  ruleId: string;
  executedActions: string[];
  errors: string[];
  warnings: string[];
}

// Workflow Statistics Types
export interface WorkflowStatistics {
  totalWorkflows: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  averageCompletionTime: number; // in hours
  completionRate: number; // percentage
  overdueWorkflows: number;
  activeUsers: Array<{
    userId: string;
    name: string;
    assignedSteps: number;
    completedSteps: number;
  }>;
  efficiency: {
    averageStepsPerWorkflow: number;
    averageTimePerStep: number;
    bottlenecks: Array<{
      stepName: string;
      averageDelay: number;
      occurrences: number;
    }>;
  };
}

export interface WorkflowStepMetrics {
  totalSteps: number;
  completedSteps: number;
  overdueSteps: number;
  averageCompletionTime: number; // in hours
  byStatus: Record<string, number>;
  byAssignee: Record<string, {
    assigned: number;
    completed: number;
    averageTime: number;
  }>;
}

// Workflow Reporting Types
export interface WorkflowReport {
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalWorkflows: number;
    completedWorkflows: number;
    averageCompletionTime: number;
    completionRate: number;
  };
  byType: Array<{
    type: string;
    count: number;
    completionRate: number;
    averageTime: number;
  }>;
  byStatus: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  efficiency: {
    overall: number;
    byType: Record<string, number>;
    recommendations: string[];
  };
  trends: Array<{
    date: string;
    created: number;
    completed: number;
    averageTime: number;
  }>;
}

// Workflow History Types
export interface WorkflowHistoryEntry {
  id: string;
  workflowId: string;
  action: string;
  performedBy: string;
  performedAt: Date;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowHistoryFilter {
  workflowId?: string;
  action?: string;
  performedBy?: string;
  fromDate?: Date;
  toDate?: Date;
}

// Workflow Validation Types
export interface WorkflowValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  checks: Array<{
    name: string;
    passed: boolean;
    message?: string;
    severity: 'error' | 'warning' | 'info';
  }>;
  recommendations: string[];
}

// Workflow Permission Types
export interface WorkflowPermission {
  userId: string;
  workflowId?: string;
  permissions: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
    assign: boolean;
    execute: boolean;
  };
  roles?: string[];
  expiresAt?: Date;
}

export interface WorkflowAccessCheck {
  userId: string;
  workflowId: string;
  action: string;
  context?: Record<string, unknown>;
}

// Workflow Notification Types
export interface WorkflowNotification {
  id: string;
  workflowId: string;
  stepId?: string;
  type: 'assignment' | 'due_soon' | 'overdue' | 'completed' | 'rejected' | 'custom';
  recipient: string;
  subject: string;
  message: string;
  sentAt?: Date;
  readAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface WorkflowNotificationConfig {
  events: string[];
  recipients: string[];
  template: string;
  channels: ('email' | 'in_app' | 'sms' | 'webhook')[];
  conditions?: WorkflowCondition[];
}

// Workflow Integration Types
export interface WorkflowWebhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  headers?: Record<string, string>;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
}

export interface WorkflowWebhookPayload {
  event: string;
  workflow: DocumentWorkflowWithDetails;
  step?: DocumentWorkflowStepWithDetails;
  user?: User;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// Error Types
export interface WorkflowError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
  userId?: string;
  workflowId?: string;
  stepId?: string;
}

// Event Types
export interface WorkflowEvent {
  type: 'created' | 'started' | 'step_completed' | 'step_rejected' | 'completed' | 'cancelled' | 'resumed';
  workflowId: string;
  stepId?: string;
  userId: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}