import { TaskAutomationService, AutomationRule, AutomationTrigger, AutomationAction, AutomationContext, TaskGenerationRequest } from '../services/tasks/TaskAutomationService';
import { WorkflowEngine } from '../services/tasks/WorkflowEngine';
import { TaskTemplateService } from '../services/tasks/TaskTemplateService';
import { CaseType, CasePhase, TaskStatus, TaskPriority, UserRole } from '@prisma/client';

// Mock dependencies
jest.mock('../services/tasks/WorkflowEngine');
jest.mock('../services/tasks/TaskTemplateService');

describe('TaskAutomationService', () => {
  let automationService: TaskAutomationService;
  let mockWorkflowEngine: jest.Mocked<WorkflowEngine>;
  let mockTaskTemplateService: jest.Mocked<TaskTemplateService>;

  beforeEach(() => {
    // Reset mocks
    mockWorkflowEngine = new WorkflowEngine() as jest.Mocked<WorkflowEngine>;
    mockTaskTemplateService = new TaskTemplateService() as jest.Mocked<TaskTemplateService>;

    // Create service instance
    automationService = new TaskAutomationService(mockWorkflowEngine, mockTaskTemplateService);
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default automation rules', () => {
      const rules = automationService.getAutomationRules();
      expect(rules.length).toBeGreaterThan(0);
      
      const phaseChangeRule = rules.find(rule => rule.id === 'phase_change_task_creation');
      expect(phaseChangeRule).toBeDefined();
      expect(phaseChangeRule?.name).toBe('Phase Change Task Creation');
    });

    it('should have rules for different automation scenarios', () => {
      const rules = automationService.getAutomationRules();
      
      expect(rules.some(rule => rule.id.includes('overdue'))).toBe(true);
      expect(rules.some(rule => rule.id.includes('assignment'))).toBe(true);
      expect(rules.some(rule => rule.id.includes('escalation'))).toBe(true);
      expect(rules.some(rule => rule.id.includes('deadline'))).toBe(true);
    });
  });

  describe('Case Phase Change Processing', () => {
    it('should process case phase change successfully', async () => {
      const request: TaskGenerationRequest = {
        caseId: 'test-case-1',
        caseType: CaseType.CRIMINAL_DEFENSE,
        currentPhase: CasePhase.PRE_PROCEEDING_PREPARATION,
        previousPhase: CasePhase.INTAKE_RISK_ASSESSMENT,
        trigger: 'phase_change',
        metadata: {
          riskAssessmentCompleted: true,
          clientInformation: 'test',
          caseDescription: 'test'
        }
      };

      // Mock template service to return templates
      mockTaskTemplateService.getAutoCreateTemplates.mockReturnValue([
        {
          id: 'test-template',
          name: 'Test Template',
          caseType: CaseType.CRIMINAL_DEFENSE,
          phase: CasePhase.PRE_PROCEEDING_PREPARATION,
          titleTemplate: 'Test Task - {caseTitle}',
          defaultPriority: TaskPriority.MEDIUM,
          autoCreate: true,
          variables: [],
          validationRules: [],
          triggers: [],
          tags: [],
          isActive: true,
          isSystemTemplate: true,
          createdBy: 'system',
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 0
        } as any
      ]);

      mockTaskTemplateService.generateTaskFromTemplate.mockReturnValue({
        title: 'Test Task - test-case-1',
        priority: TaskPriority.MEDIUM,
        estimatedDuration: 2
      });

      const result = await automationService.processCasePhaseChange(request);

      expect(result.success).toBe(true);
      expect(result.actionsExecuted.length).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle errors during phase change processing', async () => {
      const request: TaskGenerationRequest = {
        caseId: 'test-case-1',
        caseType: CaseType.CRIMINAL_DEFENSE,
        currentPhase: CasePhase.PRE_PROCEEDING_PREPARATION,
        trigger: 'phase_change',
        metadata: {}
      };

      // Mock template service to throw an error
      mockTaskTemplateService.getAutoCreateTemplates.mockImplementation(() => {
        throw new Error('Template service error');
      });

      const result = await automationService.processCasePhaseChange(request);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should create tasks for different case types', async () => {
      const caseTypes = [CaseType.CRIMINAL_DEFENSE, CaseType.DIVORCE_FAMILY, CaseType.MEDICAL_MALPRACTICE];

      for (const caseType of caseTypes) {
        const request: TaskGenerationRequest = {
          caseId: `case-${caseType}`,
          caseType,
          currentPhase: CasePhase.PRE_PROCEEDING_PREPARATION,
          trigger: 'phase_change',
          metadata: {}
        };

        mockTaskTemplateService.getAutoCreateTemplates.mockReturnValue([]);
        mockTaskTemplateService.generateTaskFromTemplate.mockReturnValue(null);

        const result = await automationService.processCasePhaseChange(request);

        expect(result.success).toBe(true);
        expect(Array.isArray(result.createdTasks)).toBe(true);
      }
    });
  });

  describe('Task Status Change Processing', () => {
    it('should process task status change successfully', async () => {
      const taskId = 'test-task-1';
      const oldStatus = TaskStatus.PENDING;
      const newStatus = TaskStatus.COMPLETED;
      const caseId = 'test-case-1';
      const userId = 'user-1';
      const metadata = {
        taskPriority: TaskPriority.HIGH,
        taskAssignee: 'user-1'
      };

      const result = await automationService.processTaskStatusChange(
        taskId,
        oldStatus,
        newStatus,
        caseId,
        userId,
        metadata
      );

      expect(result.success).toBe(true);
      expect(Array.isArray(result.actionsExecuted)).toBe(true);
      expect(Array.isArray(result.notifications)).toBe(true);
    });

    it('should handle task completion with follow-up actions', async () => {
      const taskId = 'test-task-1';
      const oldStatus = TaskStatus.IN_PROGRESS;
      const newStatus = TaskStatus.COMPLETED;
      const caseId = 'test-case-1';
      const userId = 'user-1';
      const metadata = {
        taskPriority: TaskPriority.HIGH,
        taskAssignee: 'user-1'
      };

      const result = await automationService.processTaskStatusChange(
        taskId,
        oldStatus,
        newStatus,
        caseId,
        userId,
        metadata
      );

      expect(result.success).toBe(true);
      // High priority task completion should trigger follow-up actions
      expect(result.actionsExecuted.length).toBeGreaterThan(0);
    });

    it('should handle errors during status change processing', async () => {
      const taskId = 'test-task-1';
      const oldStatus = TaskStatus.PENDING;
      const newStatus = TaskStatus.COMPLETED;
      const caseId = 'test-case-1';
      const userId = 'user-1';
      const metadata = {};

      // Simulate an error by breaking the automation service
      jest.spyOn(automationService, 'processAutomation' as any).mockRejectedValue(new Error('Processing error'));

      const result = await automationService.processTaskStatusChange(
        taskId,
        oldStatus,
        newStatus,
        caseId,
        userId,
        metadata
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Date-Based Trigger Processing', () => {
    it('should process date-based triggers successfully', async () => {
      const eventType = 'deadline_approaching';
      const metadata = {
        caseId: 'test-case-1',
        daysRemaining: 3,
        caseType: CaseType.CRIMINAL_DEFENSE
      };

      const results = await automationService.processDateBasedTrigger(eventType, metadata);

      expect(Array.isArray(results)).toBe(true);
      results.forEach(result => {
        expect(result.success).toBeDefined();
        expect(Array.isArray(result.actionsExecuted)).toBe(true);
      });
    });

    it('should handle different date-based event types', async () => {
      const eventTypes = ['deadline_approaching', 'filing_deadline', 'reminder_due'];

      for (const eventType of eventTypes) {
        const metadata = { caseId: 'test-case-1' };
        const results = await automationService.processDateBasedTrigger(eventType, metadata);

        expect(Array.isArray(results)).toBe(true);
      }
    });

    it('should return empty results for unknown event types', async () => {
      const eventType = 'unknown_event';
      const metadata = { caseId: 'test-case-1' };

      const results = await automationService.processDateBasedTrigger(eventType, metadata);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe('Automation Rule Matching', () => {
    it('should find matching automation rules for context', () => {
      const context: AutomationContext = {
        triggerEvent: {
          id: 'phase_change',
          name: 'Phase Change',
          type: 'case_phase_change',
          condition: { phase: CasePhase.PRE_PROCEEDING_PREPARATION },
          isActive: true,
          priority: 1
        },
        caseId: 'test-case-1',
        timestamp: new Date(),
        metadata: {
          caseType: CaseType.CRIMINAL_DEFENSE,
          currentPhase: CasePhase.PRE_PROCEEDING_PREPARATION
        }
      };

      const matchingRules = (automationService as any).findMatchingAutomationRules(context);

      expect(Array.isArray(matchingRules)).toBe(true);
      expect(matchingRules.length).toBeGreaterThan(0);
      
      // Should find phase change related rules
      expect(matchingRules.some(rule => rule.id.includes('phase_change'))).toBe(true);
    });

    it('should respect rule priority when matching', () => {
      const context: AutomationContext = {
        triggerEvent: {
          id: 'test_trigger',
          name: 'Test Trigger',
          type: 'task_status_change',
          condition: { status: 'COMPLETED' },
          isActive: true,
          priority: 1
        },
        caseId: 'test-case-1',
        timestamp: new Date(),
        metadata: {}
      };

      const matchingRules = (automationService as any).findMatchingAutomationRules(context);

      // Rules should be sorted by priority
      for (let i = 1; i < matchingRules.length; i++) {
        expect(matchingRules[i - 1].priority).toBeLessThanOrEqual(matchingRules[i].priority);
      }
    });

    it('should not match inactive rules', () => {
      const context: AutomationContext = {
        triggerEvent: {
          id: 'test_trigger',
          name: 'Test Trigger',
          type: 'case_phase_change',
          condition: { phase: CasePhase.PRE_PROCEEDING_PREPARATION },
          isActive: true,
          priority: 1
        },
        caseId: 'test-case-1',
        timestamp: new Date(),
        metadata: {}
      };

      // Deactivate a rule
      automationService.deactivateAutomationRule('phase_change_task_creation');

      const matchingRules = (automationService as any).findMatchingAutomationRules(context);

      expect(matchingRules.some(rule => rule.id === 'phase_change_task_creation')).toBe(false);
    });
  });

  describe('Condition Evaluation', () => {
    it('should evaluate equals condition correctly', () => {
      const conditions = [
        {
          field: 'task.status',
          operator: 'equals' as const,
          value: 'COMPLETED'
        }
      ];

      const context: AutomationContext = {
        triggerEvent: {
          id: 'test_trigger',
          name: 'Test Trigger',
          type: 'task_status_change',
          condition: { status: 'COMPLETED' },
          isActive: true,
          priority: 1
        },
        caseId: 'test-case-1',
        timestamp: new Date(),
        metadata: {
          task: { status: 'COMPLETED' }
        }
      };

      const result = (automationService as any).evaluateConditions(conditions, context);
      expect(result).toBe(true);
    });

    it('should evaluate contains condition correctly', () => {
      const conditions = [
        {
          field: 'task.tags',
          operator: 'contains' as const,
          value: 'urgent'
        }
      ];

      const context: AutomationContext = {
        triggerEvent: {
          id: 'test_trigger',
          name: 'Test Trigger',
          type: 'task_status_change',
          condition: { status: 'COMPLETED' },
          isActive: true,
          priority: 1
        },
        caseId: 'test-case-1',
        timestamp: new Date(),
        metadata: {
          task: { tags: ['urgent', 'important'] }
        }
      };

      const result = (automationService as any).evaluateConditions(conditions, context);
      expect(result).toBe(true);
    });

    it('should evaluate complex conditions with logical operators', () => {
      const conditions = [
        {
          field: 'task.status',
          operator: 'equals' as const,
          value: 'COMPLETED'
        },
        {
          field: 'task.priority',
          operator: 'in' as const,
          value: ['HIGH', 'URGENT'],
          logicalOperator: 'AND' as const
        }
      ];

      const context: AutomationContext = {
        triggerEvent: {
          id: 'test_trigger',
          name: 'Test Trigger',
          type: 'task_status_change',
          condition: { status: 'COMPLETED' },
          isActive: true,
          priority: 1
        },
        caseId: 'test-case-1',
        timestamp: new Date(),
        metadata: {
          task: { status: 'COMPLETED', priority: 'HIGH' }
        }
      };

      const result = (automationService as any).evaluateConditions(conditions, context);
      expect(result).toBe(true);
    });
  });

  describe('Action Execution', () => {
    it('should execute create task action successfully', async () => {
      const action: AutomationAction = {
        type: 'create_task',
        parameters: { source: 'phase_change', useTemplates: true },
        onFailure: 'continue'
      };

      const context: AutomationContext = {
        triggerEvent: {
          id: 'test_trigger',
          name: 'Test Trigger',
          type: 'case_phase_change',
          condition: { phase: CasePhase.PRE_PROCEEDING_PREPARATION },
          isActive: true,
          priority: 1
        },
        caseId: 'test-case-1',
        timestamp: new Date(),
        metadata: {
          caseType: CaseType.CRIMINAL_DEFENSE,
          currentPhase: CasePhase.PRE_PROCEEDING_PREPARATION
        }
      };

      mockTaskTemplateService.getAutoCreateTemplates.mockReturnValue([
        {
          id: 'test-template',
          name: 'Test Template',
          caseType: CaseType.CRIMINAL_DEFENSE,
          phase: CasePhase.PRE_PROCEEDING_PREPARATION,
          titleTemplate: 'Test Task',
          defaultPriority: TaskPriority.MEDIUM,
          autoCreate: true,
          variables: [],
          validationRules: [],
          triggers: [],
          tags: [],
          isActive: true,
          isSystemTemplate: true,
          createdBy: 'system',
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 0
        } as any
      ]);

      mockTaskTemplateService.generateTaskFromTemplate.mockReturnValue({
        title: 'Test Task',
        priority: TaskPriority.MEDIUM,
        estimatedDuration: 2
      });

      const result = await (automationService as any).executeAutomationAction(action, context);

      expect(result.success).toBe(true);
      expect(result.createdTasks.length).toBeGreaterThan(0);
    });

    it('should execute send notification action successfully', async () => {
      const action: AutomationAction = {
        type: 'send_notification',
        parameters: {
          type: 'email',
          template: 'test_template',
          recipients: ['test@example.com']
        },
        onFailure: 'continue'
      };

      const context: AutomationContext = {
        triggerEvent: {
          id: 'test_trigger',
          name: 'Test Trigger',
          type: 'case_phase_change',
          condition: { phase: CasePhase.PRE_PROCEEDING_PREPARATION },
          isActive: true,
          priority: 1
        },
        caseId: 'test-case-1',
        timestamp: new Date(),
        metadata: {}
      };

      const result = await (automationService as any).executeAutomationAction(action, context);

      expect(result.success).toBe(true);
      expect(result.notifications.length).toBe(1);
      expect(result.notifications[0].type).toBe('email');
      expect(result.notifications[0].recipient).toBe('test@example.com');
    });

    it('should handle action execution errors gracefully', async () => {
      const action: AutomationAction = {
        type: 'create_task',
        parameters: { source: 'phase_change' },
        onFailure: 'continue'
      };

      const context: AutomationContext = {
        triggerEvent: {
          id: 'test_trigger',
          name: 'Test Trigger',
          type: 'case_phase_change',
          condition: { phase: CasePhase.PRE_PROCEEDING_PREPARATION },
          isActive: true,
          priority: 1
        },
        caseId: 'test-case-1',
        timestamp: new Date(),
        metadata: {}
      };

      // Mock template service to throw an error
      mockTaskTemplateService.getAutoCreateTemplates.mockImplementation(() => {
        throw new Error('Template error');
      });

      const result = await (automationService as any).executeAutomationAction(action, context);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Delayed Action Scheduling', () => {
    it('should schedule delayed actions correctly', () => {
      const action: AutomationAction = {
        type: 'send_notification',
        parameters: { type: 'email' },
        delay: 24, // 24 hours
        onFailure: 'continue'
      };

      const rule: AutomationRule = {
        id: 'test_rule',
        name: 'Test Rule',
        description: 'Test rule',
        triggers: [],
        conditions: [],
        actions: [action],
        isActive: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        triggerCount: 0
      };

      const context: AutomationContext = {
        triggerEvent: {
          id: 'test_trigger',
          name: 'Test Trigger',
          type: 'case_phase_change',
          condition: { phase: CasePhase.PRE_PROCEEDING_PREPARATION },
          isActive: true,
          priority: 1
        },
        caseId: 'test-case-1',
        timestamp: new Date(),
        metadata: {}
      };

      (automationService as any).scheduleDelayedAction(rule, action, context);

      const pendingAutomations = automationService.getPendingAutomations();
      expect(pendingAutomations.length).toBe(1);
      expect(pendingAutomations[0].rule.id).toBe('test_rule');
    });

    it('should process pending automations when due', async () => {
      // Schedule an automation for the past
      const action: AutomationAction = {
        type: 'send_notification',
        parameters: { type: 'email' },
        delay: -1, // Already due
        onFailure: 'continue'
      };

      const rule: AutomationRule = {
        id: 'test_rule',
        name: 'Test Rule',
        description: 'Test rule',
        triggers: [],
        conditions: [],
        actions: [action],
        isActive: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        triggerCount: 0
      };

      const context: AutomationContext = {
        triggerEvent: {
          id: 'test_trigger',
          name: 'Test Trigger',
          type: 'case_phase_change',
          condition: { phase: CasePhase.PRE_PROCEEDING_PREPARATION },
          isActive: true,
          priority: 1
        },
        caseId: 'test-case-1',
        timestamp: new Date(),
        metadata: {}
      };

      (automationService as any).scheduleDelayedAction(rule, action, context);

      const results = await automationService.processPendingAutomations();
      expect(Array.isArray(results)).toBe(true);

      // Should have processed the pending automation
      const pendingAutomations = automationService.getPendingAutomations();
      expect(pendingAutomations.length).toBe(0);
    });
  });

  describe('Automation Rule Management', () => {
    it('should add custom automation rule', () => {
      const customRule: AutomationRule = {
        id: 'custom_rule',
        name: 'Custom Rule',
        description: 'A custom automation rule',
        triggers: [
          {
            id: 'custom_trigger',
            name: 'Custom Trigger',
            type: 'manual',
            condition: { custom: true },
            isActive: true,
            priority: 1
          }
        ],
        conditions: [],
        actions: [
          {
            type: 'send_notification',
            parameters: { type: 'email' },
            onFailure: 'continue'
          }
        ],
        isActive: true,
        priority: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
        triggerCount: 0
      };

      automationService.addAutomationRule(customRule);

      const rules = automationService.getAutomationRules();
      const addedRule = rules.find(r => r.id === 'custom_rule');
      expect(addedRule).toBeDefined();
      expect(addedRule?.name).toBe('Custom Rule');
    });

    it('should update automation rule', () => {
      const ruleId = 'overdue_task_escalation';
      const updates = { isActive: false, priority: 999 };

      const updated = automationService.updateAutomationRule(ruleId, updates);
      expect(updated).toBe(true);

      const rule = automationService.getAutomationRule(ruleId);
      expect(rule?.isActive).toBe(false);
      expect(rule?.priority).toBe(999);
    });

    it('should delete automation rule', () => {
      const ruleId = 'overdue_task_escalation';
      const initialCount = automationService.getAutomationRules().length;

      const deleted = automationService.deleteAutomationRule(ruleId);
      expect(deleted).toBe(true);

      const finalCount = automationService.getAutomationRules().length;
      expect(finalCount).toBe(initialCount - 1);

      const rule = automationService.getAutomationRule(ruleId);
      expect(rule).toBeUndefined();
    });

    it('should activate and deactivate rules', () => {
      const ruleId = 'overdue_task_escalation';

      // Deactivate
      const deactivated = automationService.deactivateAutomationRule(ruleId);
      expect(deactivated).toBe(true);

      let rule = automationService.getAutomationRule(ruleId);
      expect(rule?.isActive).toBe(false);

      // Activate
      const activated = automationService.activateAutomationRule(ruleId);
      expect(activated).toBe(true);

      rule = automationService.getAutomationRule(ruleId);
      expect(rule?.isActive).toBe(true);
    });
  });

  describe('Statistics and History', () => {
    it('should provide automation statistics', () => {
      const stats = automationService.getAutomationStats();

      expect(stats.totalRules).toBeGreaterThan(0);
      expect(stats.activeRules).toBeGreaterThan(0);
      expect(stats.totalTriggers).toBeGreaterThanOrEqual(0);
      expect(stats.pendingAutomations).toBeGreaterThanOrEqual(0);
      expect(stats.recentHistory).toBeGreaterThanOrEqual(0);
    });

    it('should track automation history', async () => {
      const context: AutomationContext = {
        triggerEvent: {
          id: 'test_trigger',
          name: 'Test Trigger',
          type: 'case_phase_change',
          condition: { phase: CasePhase.PRE_PROCEEDING_PREPARATION },
          isActive: true,
          priority: 1
        },
        caseId: 'test-case-1',
        timestamp: new Date(),
        metadata: {}
      };

      // Process some automation to generate history
      await (automationService as any).processAutomation(context);

      const history = automationService.getAutomationHistory();
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
    });

    it('should limit history results', async () => {
      const context: AutomationContext = {
        triggerEvent: {
          id: 'test_trigger',
          name: 'Test Trigger',
          type: 'case_phase_change',
          condition: { phase: CasePhase.PRE_PROCEEDING_PREPARATION },
          isActive: true,
          priority: 1
        },
        caseId: 'test-case-1',
        timestamp: new Date(),
        metadata: {}
      };

      // Generate some history
      for (let i = 0; i < 5; i++) {
        await (automationService as any).processAutomation(context);
      }

      const limitedHistory = automationService.getAutomationHistory(2);
      expect(limitedHistory.length).toBe(2);

      const fullHistory = automationService.getAutomationHistory();
      expect(fullHistory.length).toBeGreaterThan(limitedHistory.length);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing case ID gracefully', async () => {
      const request: TaskGenerationRequest = {
        caseId: '',
        caseType: CaseType.CRIMINAL_DEFENSE,
        currentPhase: CasePhase.PRE_PROCEEDING_PREPARATION,
        trigger: 'phase_change',
        metadata: {}
      };

      const result = await automationService.processCasePhaseChange(request);

      expect(result.success).toBe(true);
      // Should not throw, but handle empty case ID gracefully
    });

    it('should handle invalid automation contexts', async () => {
      const invalidContext: AutomationContext = {
        triggerEvent: {
          id: '',
          name: '',
          type: 'unknown_type' as any,
          condition: {},
          isActive: true,
          priority: 1
        },
        timestamp: new Date(),
        metadata: {}
      };

      const result = await (automationService as any).processAutomation(invalidContext);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should handle action failures with different strategies', async () => {
      const context: AutomationContext = {
        triggerEvent: {
          id: 'test_trigger',
          name: 'Test Trigger',
          type: 'case_phase_change',
          condition: { phase: CasePhase.PRE_PROCEEDING_PREPARATION },
          isActive: true,
          priority: 1
        },
        caseId: 'test-case-1',
        timestamp: new Date(),
        metadata: {}
      };

      // Create a rule with stop on failure
      const stopRule: AutomationRule = {
        id: 'stop_rule',
        name: 'Stop on Failure Rule',
        description: 'Rule that stops on failure',
        triggers: [
          {
            id: 'stop_trigger',
            name: 'Stop Trigger',
            type: 'case_phase_change',
            condition: { phase: CasePhase.PRE_PROCEEDING_PREPARATION },
            isActive: true,
            priority: 1
          }
        ],
        conditions: [],
        actions: [
          {
            type: 'create_task',
            parameters: {},
            onFailure: 'stop'
          },
          {
            type: 'send_notification',
            parameters: {},
            onFailure: 'continue'
          }
        ],
        isActive: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        triggerCount: 0
      };

      // Mock the first action to fail
      jest.spyOn(automationService as any, 'executeAutomationAction')
        .mockImplementationOnce(() => Promise.resolve({
          success: false,
          actionsExecuted: [],
          createdTasks: [],
          updatedTasks: [],
          notifications: [],
          errors: ['First action failed'],
          warnings: []
        }));

      const result = await (automationService as any).executeAutomationRule(stopRule, context);

      expect(result.success).toBe(false);
      expect(result.actionsExecuted.length).toBe(1); // Should stop after first action
    });
  });

  describe('Integration with Workflow Engine', () => {
    it('should integrate with workflow engine for case phase changes', async () => {
      const request: TaskGenerationRequest = {
        caseId: 'integration-test-case',
        caseType: CaseType.CRIMINAL_DEFENSE,
        currentPhase: CasePhase.PRE_PROCEEDING_PREPARATION,
        previousPhase: CasePhase.INTAKE_RISK_ASSESSMENT,
        trigger: 'phase_change',
        metadata: {
          riskAssessmentCompleted: true
        }
      };

      // Mock the workflow engine integration
      mockWorkflowEngine.processPhaseTransition.mockResolvedValue({
        success: true,
        createdTasks: [],
        updatedTasks: [],
        notifications: [],
        errors: []
      });

      const result = await automationService.processCasePhaseChange(request);

      expect(result.success).toBe(true);
      // The automation service should coordinate with the workflow engine
      expect(mockWorkflowEngine.processPhaseTransition).toHaveBeenCalled();
    });
  });
});