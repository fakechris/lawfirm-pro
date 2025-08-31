import { WorkflowEngine, TaskRule, TaskAction, TaskTemplate, WorkflowContext, WorkflowResult } from '../services/tasks/WorkflowEngine';
import { CaseType, CasePhase, TaskStatus, TaskPriority, UserRole } from '@prisma/client';

describe('WorkflowEngine', () => {
  let workflowEngine: WorkflowEngine;

  beforeEach(() => {
    workflowEngine = new WorkflowEngine();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default task rules', () => {
      const rules = workflowEngine.getTaskRules();
      expect(rules.length).toBeGreaterThan(0);
      
      const escalationRule = rules.find(rule => rule.id === 'overdue_escalation');
      expect(escalationRule).toBeDefined();
      expect(escalationRule?.name).toBe('Overdue Task Escalation');
    });

    it('should initialize with default task templates', () => {
      const templates = workflowEngine.getTaskTemplates();
      expect(templates.length).toBeGreaterThan(0);
      
      const criminalTemplate = templates.find(template => template.id === 'criminal_intake_risk_assessment');
      expect(criminalTemplate).toBeDefined();
      expect(criminalTemplate?.caseType).toBe(CaseType.CRIMINAL_DEFENSE);
    });
  });

  describe('Phase Transition Processing', () => {
    it('should successfully process valid phase transition', async () => {
      const caseId = 'test-case-1';
      const fromPhase = CasePhase.INTAKE_RISK_ASSESSMENT;
      const toPhase = CasePhase.PRE_PROCEEDING_PREPARATION;
      const caseType = CaseType.CRIMINAL_DEFENSE;
      const userRole = UserRole.ATTORNEY;
      const userId = 'user-1';
      const metadata = {
        riskAssessmentCompleted: true,
        clientInformation: 'test',
        caseDescription: 'test',
        initialEvidence: 'test'
      };

      const result = await workflowEngine.processPhaseTransition(
        caseId,
        fromPhase,
        toPhase,
        caseType,
        userRole,
        userId,
        metadata
      );

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.createdTasks).toHaveLength(1);
      expect(result.createdTasks[0].caseId).toBe(caseId);
    });

    it('should reject invalid phase transition', async () => {
      const caseId = 'test-case-1';
      const fromPhase = CasePhase.INTAKE_RISK_ASSESSMENT;
      const toPhase = CasePhase.FORMAL_PROCEEDINGS; // Invalid transition
      const caseType = CaseType.CRIMINAL_DEFENSE;
      const userRole = UserRole.ATTORNEY;
      const userId = 'user-1';
      const metadata = {
        riskAssessmentCompleted: false
      };

      const result = await workflowEngine.processPhaseTransition(
        caseId,
        fromPhase,
        toPhase,
        caseType,
        userRole,
        userId,
        metadata
      );

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.createdTasks).toHaveLength(0);
    });

    it('should reject unauthorized phase transition', async () => {
      const caseId = 'test-case-1';
      const fromPhase = CasePhase.INTAKE_RISK_ASSESSMENT;
      const toPhase = CasePhase.PRE_PROCEEDING_PREPARATION;
      const caseType = CaseType.CRIMINAL_DEFENSE;
      const userRole = UserRole.ASSISTANT; // Not authorized
      const userId = 'user-1';
      const metadata = {
        riskAssessmentCompleted: true,
        clientInformation: 'test',
        caseDescription: 'test',
        initialEvidence: 'test'
      };

      const result = await workflowEngine.processPhaseTransition(
        caseId,
        fromPhase,
        toPhase,
        caseType,
        userRole,
        userId,
        metadata
      );

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Insufficient permissions');
    });

    it('should create tasks for different case types', async () => {
      const caseTypes = [
        CaseType.CRIMINAL_DEFENSE,
        CaseType.DIVORCE_FAMILY,
        CaseType.MEDICAL_MALPRACTICE
      ];

      for (const caseType of caseTypes) {
        const result = await workflowEngine.processPhaseTransition(
          `case-${caseType}`,
          CasePhase.INTAKE_RISK_ASSESSMENT,
          CasePhase.PRE_PROCEEDING_PREPARATION,
          caseType,
          UserRole.ATTORNEY,
          'user-1',
          { riskAssessmentCompleted: true }
        );

        expect(result.success).toBe(true);
        expect(result.createdTasks.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Task Rule Evaluation', () => {
    it('should evaluate overdue task escalation rule', async () => {
      const context: WorkflowContext = {
        caseId: 'test-case-1',
        caseType: CaseType.CRIMINAL_DEFENSE,
        currentPhase: CasePhase.PRE_PROCEEDING_PREPARATION,
        metadata: {
          task: {
            status: 'PENDING',
            dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
            escalationLevel: 1
          }
        },
        userId: 'user-1',
        userRole: UserRole.ATTORNEY,
        timestamp: new Date()
      };

      const result = await workflowEngine.evaluateTaskRules(context);

      expect(result.success).toBe(true);
      expect(result.notifications.length).toBeGreaterThan(0);
    });

    it('should evaluate high priority assignment rule', async () => {
      const context: WorkflowContext = {
        caseId: 'test-case-1',
        caseType: CaseType.CRIMINAL_DEFENSE,
        currentPhase: CasePhase.PRE_PROCEEDING_PREPARATION,
        metadata: {
          task: {
            priority: 'HIGH',
            assignedTo: null
          }
        },
        userId: 'user-1',
        userRole: UserRole.ATTORNEY,
        timestamp: new Date()
      };

      const result = await workflowEngine.evaluateTaskRules(context);

      expect(result.success).toBe(true);
    });

    it('should not match rules when conditions are not met', async () => {
      const context: WorkflowContext = {
        caseId: 'test-case-1',
        caseType: CaseType.CRIMINAL_DEFENSE,
        currentPhase: CasePhase.PRE_PROCEEDING_PREPARATION,
        metadata: {
          task: {
            status: 'COMPLETED',
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
            escalationLevel: 0
          }
        },
        userId: 'user-1',
        userRole: UserRole.ATTORNEY,
        timestamp: new Date()
      };

      const result = await workflowEngine.evaluateTaskRules(context);

      expect(result.success).toBe(true);
      expect(result.createdTasks).toHaveLength(0);
      expect(result.updatedTasks).toHaveLength(0);
      expect(result.notifications).toHaveLength(0);
    });
  });

  describe('Task Template Management', () => {
    it('should add custom task template', () => {
      const customTemplate: TaskTemplate = {
        id: 'custom_template',
        name: 'Custom Template',
        description: 'A custom task template',
        caseType: CaseType.SPECIAL_MATTERS,
        phase: CasePhase.INTAKE_RISK_ASSESSMENT,
        titleTemplate: 'Custom Task - {caseTitle}',
        defaultPriority: TaskPriority.MEDIUM,
        autoCreate: true,
        applicablePhases: [CasePhase.INTAKE_RISK_ASSESSMENT],
        category: 'research',
        variables: [],
        validationRules: [],
        triggers: [],
        tags: ['custom'],
        isActive: true,
        isSystemTemplate: false,
        createdBy: 'test-user',
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0
      };

      workflowEngine.addTaskTemplate(customTemplate);

      const templates = workflowEngine.getTaskTemplates();
      const addedTemplate = templates.find(t => t.id === 'custom_template');
      expect(addedTemplate).toBeDefined();
      expect(addedTemplate?.name).toBe('Custom Template');
    });

    it('should get templates filtered by case type', () => {
      const criminalTemplates = workflowEngine.getTaskTemplates(CaseType.CRIMINAL_DEFENSE);
      expect(criminalTemplates.length).toBeGreaterThan(0);
      
      criminalTemplates.forEach(template => {
        expect(template.caseType).toBe(CaseType.CRIMINAL_DEFENSE);
      });
    });

    it('should get templates filtered by phase', () => {
      const intakeTemplates = workflowEngine.getTaskTemplates(undefined, CasePhase.INTAKE_RISK_ASSESSMENT);
      expect(intakeTemplates.length).toBeGreaterThan(0);
      
      intakeTemplates.forEach(template => {
        expect(template.phase).toBe(CasePhase.INTAKE_RISK_ASSESSMENT);
      });
    });

    it('should remove task template', () => {
      const templateId = 'criminal_intake_risk_assessment';
      const initialCount = workflowEngine.getTaskTemplates().length;
      
      const removed = workflowEngine.removeTaskTemplate(templateId);
      expect(removed).toBe(true);
      
      const finalCount = workflowEngine.getTaskTemplates().length;
      expect(finalCount).toBe(initialCount - 1);
      
      const template = workflowEngine.getTaskTemplates().find(t => t.id === templateId);
      expect(template).toBeUndefined();
    });
  });

  describe('Task Rule Management', () => {
    it('should add custom task rule', () => {
      const customRule: TaskRule = {
        id: 'custom_rule',
        name: 'Custom Rule',
        description: 'A custom task rule',
        conditions: [
          {
            field: 'task.priority',
            operator: 'equals',
            value: 'URGENT'
          }
        ],
        actions: [
          {
            type: 'notify',
            parameters: { type: 'email', template: 'urgent_task' }
          }
        ],
        priority: 10,
        active: true
      };

      workflowEngine.addTaskRule(customRule);

      const rules = workflowEngine.getTaskRules();
      const addedRule = rules.find(r => r.id === 'custom_rule');
      expect(addedRule).toBeDefined();
      expect(addedRule?.name).toBe('Custom Rule');
    });

    it('should update task rule', () => {
      const ruleId = 'overdue_escalation';
      const updates = { active: false };
      
      const updated = workflowEngine.updateTaskRule(ruleId, updates);
      expect(updated).toBe(true);
      
      const rule = workflowEngine.getTaskRules().find(r => r.id === ruleId);
      expect(rule?.active).toBe(false);
    });

    it('should remove task rule', () => {
      const ruleId = 'overdue_escalation';
      const initialCount = workflowEngine.getTaskRules().length;
      
      const removed = workflowEngine.removeTaskRule(ruleId);
      expect(removed).toBe(true);
      
      const finalCount = workflowEngine.getTaskRules().length;
      expect(finalCount).toBe(initialCount - 1);
    });

    it('should get only active rules', () => {
      workflowEngine.updateTaskRule('overdue_escalation', { active: false });
      
      const activeRules = workflowEngine.getTaskRules(true);
      const inactiveRule = activeRules.find(r => r.id === 'overdue_escalation');
      expect(inactiveRule).toBeUndefined();
      
      const allRules = workflowEngine.getTaskRules(false);
      const foundRule = allRules.find(r => r.id === 'overdue_escalation');
      expect(foundRule).toBeDefined();
    });
  });

  describe('Workflow History', () => {
    it('should track workflow history', async () => {
      const caseId = 'test-case-history';
      
      await workflowEngine.processPhaseTransition(
        caseId,
        CasePhase.INTAKE_RISK_ASSESSMENT,
        CasePhase.PRE_PROCEEDING_PREPARATION,
        CaseType.CRIMINAL_DEFENSE,
        UserRole.ATTORNEY,
        'user-1',
        { riskAssessmentCompleted: true }
      );

      const history = workflowEngine.getWorkflowHistory(caseId);
      expect(history.length).toBe(1);
      expect(history[0].caseId).toBe(caseId);
      expect(history[0].currentPhase).toBe(CasePhase.PRE_PROCEEDING_PREPARATION);
    });

    it('should return empty history for non-existent case', () => {
      const history = workflowEngine.getWorkflowHistory('non-existent-case');
      expect(history).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully during phase transition', async () => {
      // Simulate an error by providing invalid metadata
      const result = await workflowEngine.processPhaseTransition(
        'test-case-error',
        CasePhase.INTAKE_RISK_ASSESSMENT,
        CasePhase.PRE_PROCEEDING_PREPARATION,
        CaseType.CRIMINAL_DEFENSE,
        UserRole.ATTORNEY,
        'user-1',
        {} // Missing required metadata
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle errors during rule evaluation', async () => {
      const context: WorkflowContext = {
        caseId: 'test-case-1',
        caseType: CaseType.CRIMINAL_DEFENSE,
        currentPhase: CasePhase.PRE_PROCEEDING_PREPARATION,
        metadata: {
          task: {
            // Missing required fields that might cause errors
          }
        },
        userId: 'user-1',
        userRole: UserRole.ATTORNEY,
        timestamp: new Date()
      };

      const result = await workflowEngine.evaluateTaskRules(context);
      
      // Should not throw, but handle errors gracefully
      expect(result.success).toBeDefined();
    });
  });

  describe('Task Creation from Templates', () => {
    it('should create task from template with variable interpolation', () => {
      const template = workflowEngine.getTaskTemplates()[0];
      if (!template) return;

      const variables = {
        caseTitle: 'Test Case',
        clientName: 'John Doe'
      };

      const taskData = workflowEngine['createTaskFromTemplate'](template, {
        caseId: 'test-case-1',
        caseType: template.caseType,
        currentPhase: template.phase,
        metadata: variables,
        userId: 'user-1',
        userRole: UserRole.ATTORNEY,
        timestamp: new Date()
      });

      expect(taskData).toBeDefined();
      expect(taskData.title).toContain('Test Case');
      expect(taskData.caseId).toBe('test-case-1');
      expect(taskData.priority).toBe(template.defaultPriority);
    });

    it('should handle missing variables gracefully', () => {
      const template = workflowEngine.getTaskTemplates()[0];
      if (!template) return;

      const variables = {}; // Missing variables

      const taskData = workflowEngine['createTaskFromTemplate'](template, {
        caseId: 'test-case-1',
        caseType: template.caseType,
        currentPhase: template.phase,
        metadata: variables,
        userId: 'user-1',
        userRole: UserRole.ATTORNEY,
        timestamp: new Date()
      });

      expect(taskData).toBeDefined();
      // Should not throw, but handle missing variables gracefully
    });
  });

  describe('Condition Evaluation', () => {
    it('should evaluate equals condition correctly', () => {
      const condition = {
        field: 'task.status',
        operator: 'equals' as const,
        value: 'PENDING'
      };

      const data = { task: { status: 'PENDING' } };
      const result = workflowEngine['evaluateCondition'](condition, data);
      expect(result).toBe(true);

      const data2 = { task: { status: 'COMPLETED' } };
      const result2 = workflowEngine['evaluateCondition'](condition, data2);
      expect(result2).toBe(false);
    });

    it('should evaluate exists condition correctly', () => {
      const condition = {
        field: 'task.assignedTo',
        operator: 'exists' as const,
        value: null
      };

      const data = { task: { assignedTo: 'user-1' } };
      const result = workflowEngine['evaluateCondition'](condition, data);
      expect(result).toBe(true);

      const data2 = { task: {} };
      const result2 = workflowEngine['evaluateCondition'](condition, data2);
      expect(result2).toBe(false);
    });

    it('should evaluate greater_than condition correctly', () => {
      const condition = {
        field: 'task.dueDate',
        operator: 'greater_than' as const,
        value: new Date()
      };

      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const data = { task: { dueDate: futureDate } };
      const result = workflowEngine['evaluateCondition'](condition, data);
      expect(result).toBe(true);

      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const data2 = { task: { dueDate: pastDate } };
      const result2 = workflowEngine['evaluateCondition'](condition, data2);
      expect(result2).toBe(false);
    });
  });

  describe('Integration with Case Management', () => {
    it('should integrate with case phase transitions', async () => {
      // Test that workflow engine properly handles case management phase transitions
      const phases = [
        CasePhase.INTAKE_RISK_ASSESSMENT,
        CasePhase.PRE_PROCEEDING_PREPARATION,
        CasePhase.FORMAL_PROCEEDINGS,
        CasePhase.RESOLUTION_POST_PROCEEDING,
        CasePhase.CLOSURE_REVIEW_ARCHIVING
      ];

      let currentPhase = phases[0];
      const caseId = 'integration-test-case';

      for (let i = 1; i < phases.length; i++) {
        const nextPhase = phases[i];
        
        const result = await workflowEngine.processPhaseTransition(
          caseId,
          currentPhase,
          nextPhase,
          CaseType.CRIMINAL_DEFENSE,
          UserRole.ATTORNEY,
          'user-1',
          { riskAssessmentCompleted: true }
        );

        expect(result.success).toBe(true);
        currentPhase = nextPhase;
      }
    });

    it('should respect case type specific workflows', async () => {
      const caseTypes = Object.values(CaseType);
      
      for (const caseType of caseTypes) {
        const result = await workflowEngine.processPhaseTransition(
          `case-${caseType}`,
          CasePhase.INTAKE_RISK_ASSESSMENT,
          CasePhase.PRE_PROCEEDING_PREPARATION,
          caseType,
          UserRole.ATTORNEY,
          'user-1',
          { riskAssessmentCompleted: true }
        );

        expect(result.success).toBe(true);
        // Different case types may create different numbers of tasks
        expect(Array.isArray(result.createdTasks)).toBe(true);
      }
    });
  });
});