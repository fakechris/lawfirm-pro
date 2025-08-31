import { CaseType, CasePhase, TaskPriority, UserRole } from '@prisma/client';

export interface TaskTemplateVariable {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'select' | 'user' | 'case';
  description?: string;
  required: boolean;
  defaultValue?: any;
  options?: string[]; // For select type
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    custom?: (value: any) => boolean;
  };
}

export interface TaskTemplateValidation {
  field: string;
  type: 'required' | 'pattern' | 'min' | 'max' | 'custom';
  condition: any;
  message: string;
}

export interface TaskTemplateStep {
  id: string;
  name: string;
  description: string;
  order: number;
  required: boolean;
  assigneeRole?: UserRole;
  dueDateOffset?: number; // days from previous step completion
  dependencies?: string[]; // step IDs
  validationRules?: TaskTemplateValidation[];
  outputs?: string[]; // expected outputs/documents
}

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  caseType: CaseType;
  applicablePhases: CasePhase[];
  category: 'document_preparation' | 'client_communication' | 'court_filing' | 'research' | 'negotiation' | 'hearing_preparation' | 'administrative';
  
  // Template content
  titleTemplate: string;
  descriptionTemplate?: string;
  instructions?: string;
  
  // Task configuration
  defaultPriority: TaskPriority;
  defaultAssigneeRole?: UserRole;
  estimatedDuration?: number; // in hours
  dueDateOffset?: number; // days from phase start or trigger
  
  // Variables and validation
  variables: TaskTemplateVariable[];
  validationRules: TaskTemplateValidation[];
  
  // Multi-step workflow
  steps?: TaskTemplateStep[];
  
  // Automation rules
  autoCreate: boolean;
  autoAssign: boolean;
  triggers: TemplateTrigger[];
  
  // Dependencies and prerequisites
  prerequisites?: string[]; // other template IDs
  dependencies?: string[]; // other template IDs
  
  // Metadata
  tags: string[];
  isActive: boolean;
  isSystemTemplate: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
  usageCount: number;
}

export interface TemplateTrigger {
  type: 'phase_change' | 'task_completion' | 'date_based' | 'condition_based' | 'manual';
  condition: Record<string, any>;
  delay?: number; // in hours
}

export interface TemplateInstance {
  id: string;
  templateId: string;
  caseId: string;
  taskId: string;
  variables: Record<string, any>;
  currentStep?: string;
  status: 'active' | 'completed' | 'cancelled' | 'paused';
  progress: number; // 0-100
  startedAt: Date;
  completedAt?: Date;
  metadata: Record<string, any>;
}

export interface TemplateSearchCriteria {
  caseType?: CaseType;
  phase?: CasePhase;
  category?: string;
  tags?: string[];
  isActive?: boolean;
  searchQuery?: string;
  limit?: number;
  offset?: number;
}

export class TaskTemplateService {
  private templates: Map<string, TaskTemplate>;
  private instances: Map<string, TemplateInstance>;
  private templateUsage: Map<string, number>;

  constructor() {
    this.templates = new Map();
    this.instances = new Map();
    this.templateUsage = new Map();
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates(): void {
    // Criminal Defense Templates
    this.addTemplate({
      id: 'criminal_intake_assessment',
      name: 'Criminal Case Intake Assessment',
      description: 'Comprehensive intake assessment for criminal defense cases',
      version: '1.0.0',
      caseType: CaseType.CRIMINAL_DEFENSE,
      applicablePhases: [CasePhase.INTAKE_RISK_ASSESSMENT],
      category: 'research',
      titleTemplate: 'Complete Intake Assessment - {caseTitle}',
      descriptionTemplate: 'Conduct thorough intake assessment for criminal case {caseTitle}',
      instructions: 'Review police reports, interview client, assess evidence, determine defense strategy',
      defaultPriority: TaskPriority.HIGH,
      defaultAssigneeRole: UserRole.ATTORNEY,
      estimatedDuration: 8,
      dueDateOffset: 3,
      variables: [
        {
          name: 'clientStatement',
          type: 'string',
          description: 'Client\'s statement about the incident',
          required: true,
          validation: { min: 100, max: 5000 }
        },
        {
          name: 'arrestDate',
          type: 'date',
          description: 'Date of arrest',
          required: true
        },
        {
          name: 'charges',
          type: 'string',
          description: 'List of charges',
          required: true
        },
        {
          name: 'bailAmount',
          type: 'number',
          description: 'Bail amount set by court',
          required: false,
          validation: { min: 0 }
        },
        {
          name: 'evidenceStrength',
          type: 'select',
          description: 'Assessment of evidence strength',
          required: true,
          options: ['Strong', 'Moderate', 'Weak', 'Insufficient']
        }
      ],
      validationRules: [
        {
          field: 'clientStatement',
          type: 'required',
          condition: true,
          message: 'Client statement is required'
        },
        {
          field: 'arrestDate',
          type: 'required',
          condition: true,
          message: 'Arrest date is required'
        }
      ],
      autoCreate: true,
      autoAssign: true,
      triggers: [
        {
          type: 'phase_change',
          condition: { phase: CasePhase.INTAKE_RISK_ASSESSMENT }
        }
      ],
      tags: ['criminal', 'intake', 'assessment'],
      isActive: true,
      isSystemTemplate: true,
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0
    });

    // Bail Hearing Template
    this.addTemplate({
      id: 'bail_hearing_preparation',
      name: 'Bail Hearing Preparation',
      description: 'Complete preparation for bail hearing including motions and arguments',
      version: '1.0.0',
      caseType: CaseType.CRIMINAL_DEFENSE,
      applicablePhases: [CasePhase.PRE_PROCEEDING_PREPARATION],
      category: 'hearing_preparation',
      titleTemplate: 'Prepare Bail Hearing - {clientName}',
      descriptionTemplate: 'Prepare and file bail application for {clientName}',
      instructions: 'Prepare bail application, gather character references, draft legal arguments',
      defaultPriority: TaskPriority.URGENT,
      defaultAssigneeRole: UserRole.ATTORNEY,
      estimatedDuration: 6,
      dueDateOffset: 1,
      variables: [
        {
          name: 'clientName',
          type: 'string',
          description: 'Client full name',
          required: true
        },
        {
          name: 'hearingDate',
          type: 'date',
          description: 'Scheduled bail hearing date',
          required: true
        },
        {
          name: 'bailAmountRequested',
          type: 'number',
          description: 'Requested bail amount',
          required: true,
          validation: { min: 0 }
        },
        {
          name: 'characterReferences',
          type: 'string',
          description: 'Character reference letters',
          required: false
        }
      ],
      steps: [
        {
          id: 'gather_documents',
          name: 'Gather Required Documents',
          description: 'Collect all necessary documents for bail application',
          order: 1,
          required: true,
          dueDateOffset: 0,
          outputs: ['policeReport', 'clientAffidavit', 'characterReferences']
        },
        {
          id: 'prepare_application',
          name: 'Prepare Bail Application',
          description: 'Draft and review bail application',
          order: 2,
          required: true,
          dependencies: ['gather_documents'],
          outputs: ['bailApplication']
        },
        {
          id: 'file_application',
          name: 'File Bail Application',
          description: 'File bail application with court and serve prosecution',
          order: 3,
          required: true,
          dependencies: ['prepare_application'],
          outputs: ['filedApplication', 'proofOfService']
        }
      ],
      autoCreate: true,
      autoAssign: true,
      triggers: [
        {
          type: 'phase_change',
          condition: { phase: CasePhase.PRE_PROCEEDING_PREPARATION }
        }
      ],
      prerequisites: ['criminal_intake_assessment'],
      tags: ['criminal', 'bail', 'hearing', 'urgent'],
      isActive: true,
      isSystemTemplate: true,
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0
    });

    // Divorce Templates
    this.addTemplate({
      id: 'divorce_filing',
      name: 'Divorce Petition Filing',
      description: 'Prepare and file divorce petition with all required documentation',
      version: '1.0.0',
      caseType: CaseType.DIVORCE_FAMILY,
      applicablePhases: [CasePhase.PRE_PROCEEDING_PREPARATION],
      category: 'court_filing',
      titleTemplate: 'File Divorce Petition - {clientName}',
      descriptionTemplate: 'Prepare and file divorce petition for {clientName}',
      instructions: 'Draft petition, prepare financial disclosures, file with court',
      defaultPriority: TaskPriority.MEDIUM,
      defaultAssigneeRole: UserRole.ATTORNEY,
      estimatedDuration: 10,
      dueDateOffset: 7,
      variables: [
        {
          name: 'clientName',
          type: 'string',
          description: 'Client full name',
          required: true
        },
        {
          name: 'spouseName',
          type: 'string',
          description: 'Spouse full name',
          required: true
        },
        {
          name: 'marriageDate',
          type: 'date',
          description: 'Date of marriage',
          required: true
        },
        {
          name: 'separationDate',
          type: 'date',
          description: 'Date of separation',
          required: true
        },
        {
          name: 'hasChildren',
          type: 'boolean',
          description: 'Whether couple has children',
          required: true
        },
        {
          name: 'childCustodyArrangement',
          type: 'select',
          description: 'Proposed custody arrangement',
          required: false,
          options: ['Sole custody to client', 'Sole custody to spouse', 'Joint custody', 'To be determined']
        }
      ],
      validationRules: [
        {
          field: 'hasChildren',
          type: 'custom',
          condition: (value: boolean, data: any) => {
            if (value && !data.childCustodyArrangement) {
              return false;
            }
            return true;
          },
          message: 'Child custody arrangement is required when children are involved'
        }
      ],
      autoCreate: true,
      autoAssign: true,
      triggers: [
        {
          type: 'phase_change',
          condition: { phase: CasePhase.PRE_PROCEEDING_PREPARATION }
        }
      ],
      tags: ['divorce', 'family', 'filing', 'petition'],
      isActive: true,
      isSystemTemplate: true,
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0
    });

    // Medical Malpractice Templates
    this.addTemplate({
      id: 'medical_record_review',
      name: 'Medical Record Review and Analysis',
      description: 'Comprehensive review of medical records to identify potential malpractice',
      version: '1.0.0',
      caseType: CaseType.MEDICAL_MALPRACTICE,
      applicablePhases: [CasePhase.INTAKE_RISK_ASSESSMENT],
      category: 'research',
      titleTemplate: 'Review Medical Records - {caseTitle}',
      descriptionTemplate: 'Analyze medical records for {patientName} to identify standard of care violations',
      instructions: 'Review all medical records, identify deviations from standard of care, consult with medical experts',
      defaultPriority: TaskPriority.HIGH,
      defaultAssigneeRole: UserRole.ATTORNEY,
      estimatedDuration: 15,
      dueDateOffset: 10,
      variables: [
        {
          name: 'patientName',
          type: 'string',
          description: 'Patient name',
          required: true
        },
        {
          name: 'medicalFacility',
          type: 'string',
          description: 'Medical facility where treatment occurred',
          required: true
        },
        {
          name: 'treatmentDates',
          type: 'string',
          description: 'Range of treatment dates',
          required: true
        },
        {
          name: 'allegedMalpractice',
          type: 'string',
          description: 'Description of alleged malpractice',
          required: true
        },
        {
          name: 'expertConsultationRequired',
          type: 'boolean',
          description: 'Whether expert consultation is required',
          required: true,
          defaultValue: true
        }
      ],
      steps: [
        {
          id: 'collect_records',
          name: 'Collect Medical Records',
          description: 'Obtain all relevant medical records from healthcare providers',
          order: 1,
          required: true,
          dueDateOffset: 3,
          outputs: ['medicalRecords']
        },
        {
          id: 'review_records',
          name: 'Review Medical Records',
          description: 'Thoroughly review medical records for potential issues',
          order: 2,
          required: true,
          dependencies: ['collect_records'],
          outputs: ['recordReviewNotes']
        },
        {
          id: 'consult_expert',
          name: 'Consult Medical Expert',
          description: 'Consult with medical expert to identify standard of care violations',
          order: 3,
          required: true,
          dependencies: ['review_records'],
          outputs: ['expertReport']
        }
      ],
      autoCreate: true,
      autoAssign: true,
      triggers: [
        {
          type: 'phase_change',
          condition: { phase: CasePhase.INTAKE_RISK_ASSESSMENT }
        }
      ],
      tags: ['medical', 'malpractice', 'records', 'expert'],
      isActive: true,
      isSystemTemplate: true,
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0
    });

    // Contract Dispute Templates
    this.addTemplate({
      id: 'contract_analysis',
      name: 'Contract Analysis and Breach Assessment',
      description: 'Analyze contract and assess potential breach claims',
      version: '1.0.0',
      caseType: CaseType.CONTRACT_DISPUTE,
      applicablePhases: [CasePhase.INTAKE_RISK_ASSESSMENT],
      category: 'research',
      titleTemplate: 'Analyze Contract - {caseTitle}',
      descriptionTemplate: 'Review contract and assess breach claims for {clientName}',
      instructions: 'Analyze contract terms, identify potential breaches, assess damages',
      defaultPriority: TaskPriority.MEDIUM,
      defaultAssigneeRole: UserRole.ATTORNEY,
      estimatedDuration: 8,
      dueDateOffset: 5,
      variables: [
        {
          name: 'contractType',
          type: 'select',
          description: 'Type of contract',
          required: true,
          options: ['Employment', 'Service', 'Sales', 'Lease', 'Partnership', 'Other']
        },
        {
          name: 'contractDate',
          type: 'date',
          description: 'Date contract was signed',
          required: true
        },
        {
          name: 'breachDescription',
          type: 'string',
          description: 'Description of alleged breach',
          required: true
        },
        {
          name: 'damagesSought',
          type: 'number',
          description: 'Amount of damages sought',
          required: false,
          validation: { min: 0 }
        }
      ],
      autoCreate: true,
      autoAssign: true,
      triggers: [
        {
          type: 'phase_change',
          condition: { phase: CasePhase.INTAKE_RISK_ASSESSMENT }
        }
      ],
      tags: ['contract', 'breach', 'analysis', 'dispute'],
      isActive: true,
      isSystemTemplate: true,
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0
    });
  }

  public addTemplate(template: TaskTemplate): void {
    this.templates.set(template.id, template);
    this.templateUsage.set(template.id, 0);
  }

  public getTemplate(id: string): TaskTemplate | undefined {
    return this.templates.get(id);
  }

  public getTemplates(criteria: TemplateSearchCriteria = {}): TaskTemplate[] {
    let templates = Array.from(this.templates.values());

    // Apply filters
    if (criteria.caseType) {
      templates = templates.filter(t => t.caseType === criteria.caseType);
    }
    if (criteria.phase) {
      templates = templates.filter(t => t.applicablePhases.includes(criteria.phase!));
    }
    if (criteria.category) {
      templates = templates.filter(t => t.category === criteria.category);
    }
    if (criteria.tags && criteria.tags.length > 0) {
      templates = templates.filter(t => 
        criteria.tags!.some(tag => t.tags.includes(tag))
      );
    }
    if (criteria.isActive !== undefined) {
      templates = templates.filter(t => t.isActive === criteria.isActive);
    }
    if (criteria.searchQuery) {
      const query = criteria.searchQuery.toLowerCase();
      templates = templates.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Sort by usage count (most used first)
    templates.sort((a, b) => b.usageCount - a.usageCount);

    // Apply pagination
    if (criteria.offset !== undefined || criteria.limit !== undefined) {
      const start = criteria.offset || 0;
      const end = criteria.limit ? start + criteria.limit : undefined;
      templates = templates.slice(start, end);
    }

    return templates;
  }

  public createTemplateInstance(
    templateId: string,
    caseId: string,
    taskId: string,
    variables: Record<string, any>
  ): TemplateInstance | null {
    const template = this.templates.get(templateId);
    if (!template) {
      return null;
    }

    // Validate variables
    const validationErrors = this.validateTemplateVariables(template, variables);
    if (validationErrors.length > 0) {
      throw new Error(`Template validation failed: ${validationErrors.join(', ')}`);
    }

    const instance: TemplateInstance = {
      id: `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      templateId,
      caseId,
      taskId,
      variables,
      status: 'active',
      progress: 0,
      startedAt: new Date(),
      metadata: {}
    };

    this.instances.set(instance.id, instance);
    
    // Update usage count
    const currentUsage = this.templateUsage.get(templateId) || 0;
    this.templateUsage.set(templateId, currentUsage + 1);

    // Update template last used date
    template.lastUsed = new Date();
    template.usageCount++;

    return instance;
  }

  public getTemplateInstance(instanceId: string): TemplateInstance | undefined {
    return this.instances.get(instanceId);
  }

  public getCaseTemplateInstances(caseId: string): TemplateInstance[] {
    return Array.from(this.instances.values()).filter(instance => instance.caseId === caseId);
  }

  public updateTemplateInstance(
    instanceId: string,
    updates: Partial<TemplateInstance>
  ): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return false;
    }

    Object.assign(instance, updates);
    return true;
  }

  public completeTemplateInstance(instanceId: string): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance || instance.status === 'completed') {
      return false;
    }

    instance.status = 'completed';
    instance.progress = 100;
    instance.completedAt = new Date();

    return true;
  }

  public validateTemplateVariables(template: TaskTemplate, variables: Record<string, any>): string[] {
    const errors: string[] = [];

    // Check required variables
    template.variables.forEach(variable => {
      if (variable.required && !(variable.name in variables)) {
        errors.push(`${variable.name} is required`);
      }
    });

    // Validate individual variables
    template.variables.forEach(variable => {
      const value = variables[variable.name];
      if (value === undefined) return;

      if (variable.validation) {
        const validation = variable.validation;
        
        if (validation.min !== undefined && typeof value === 'number' && value < validation.min) {
          errors.push(`${variable.name} must be at least ${validation.min}`);
        }
        
        if (validation.max !== undefined && typeof value === 'number' && value > validation.max) {
          errors.push(`${variable.name} must be at most ${validation.max}`);
        }
        
        if (validation.pattern && typeof value === 'string') {
          const regex = new RegExp(validation.pattern);
          if (!regex.test(value)) {
            errors.push(`${variable.name} format is invalid`);
          }
        }
        
        if (validation.custom && !validation.custom(value)) {
          errors.push(`${variable.name} failed custom validation`);
        }
      }
    });

    // Run template-level validation rules
    template.validationRules.forEach(rule => {
      const value = this.getNestedValue(variables, rule.field);
      let isValid = true;

      switch (rule.type) {
        case 'required':
          isValid = value !== undefined && value !== null && value !== '';
          break;
        case 'pattern':
          isValid = new RegExp(rule.condition).test(String(value));
          break;
        case 'min':
          isValid = value >= rule.condition;
          break;
        case 'max':
          isValid = value <= rule.condition;
          break;
        case 'custom':
          isValid = rule.condition(value, variables);
          break;
      }

      if (!isValid) {
        errors.push(rule.message);
      }
    });

    return errors;
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  public generateTaskFromTemplate(
    templateId: string,
    caseId: string,
    variables: Record<string, any>
  ): {
    title: string;
    description?: string;
    priority: TaskPriority;
    estimatedDuration?: number;
    dueDate?: Date;
    assigneeRole?: UserRole;
    steps?: TaskTemplateStep[];
  } | null {
    const template = this.templates.get(templateId);
    if (!template) {
      return null;
    }

    // Interpolate templates
    const title = this.interpolateTemplate(template.titleTemplate, variables);
    const description = template.descriptionTemplate 
      ? this.interpolateTemplate(template.descriptionTemplate, variables)
      : undefined;

    // Calculate due date
    let dueDate: Date | undefined;
    if (template.dueDateOffset) {
      dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + template.dueDateOffset);
    }

    return {
      title,
      description,
      priority: template.defaultPriority,
      estimatedDuration: template.estimatedDuration,
      dueDate,
      assigneeRole: template.defaultAssigneeRole,
      steps: template.steps
    };
  }

  private interpolateTemplate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{([^}]+)\}/g, (match, key) => {
      const value = this.getNestedValue(variables, key);
      return value !== undefined ? String(value) : match;
    });
  }

  public getTemplateCategories(): string[] {
    const categories = new Set<string>();
    this.templates.forEach(template => {
      categories.add(template.category);
    });
    return Array.from(categories).sort();
  }

  public getTemplateTags(): string[] {
    const tags = new Set<string>();
    this.templates.forEach(template => {
      template.tags.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }

  public getTemplateUsageStats(): Array<{
    templateId: string;
    templateName: string;
    usageCount: number;
    lastUsed?: Date;
  }> {
    return Array.from(this.templates.values()).map(template => ({
      templateId: template.id,
      templateName: template.name,
      usageCount: template.usageCount,
      lastUsed: template.lastUsed
    })).sort((a, b) => b.usageCount - a.usageCount);
  }

  public updateTemplate(templateId: string, updates: Partial<TaskTemplate>): boolean {
    const template = this.templates.get(templateId);
    if (!template) {
      return false;
    }

    Object.assign(template, updates, { updatedAt: new Date() });
    return true;
  }

  public deleteTemplate(templateId: string): boolean {
    return this.templates.delete(templateId);
  }

  public activateTemplate(templateId: string): boolean {
    const template = this.templates.get(templateId);
    if (!template) {
      return false;
    }

    template.isActive = true;
    template.updatedAt = new Date();
    return true;
  }

  public deactivateTemplate(templateId: string): boolean {
    const template = this.templates.get(templateId);
    if (!template) {
      return false;
    }

    template.isActive = false;
    template.updatedAt = new Date();
    return true;
  }

  public duplicateTemplate(templateId: string, newId?: string): TaskTemplate | null {
    const template = this.templates.get(templateId);
    if (!template) {
      return null;
    }

    const duplicate: TaskTemplate = {
      ...template,
      id: newId || `${template.id}_copy_${Date.now()}`,
      name: `${template.name} (Copy)`,
      usageCount: 0,
      lastUsed: undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.addTemplate(duplicate);
    return duplicate;
  }

  public getTemplatesByCaseType(caseType: CaseType): TaskTemplate[] {
    return this.getTemplates({ caseType, isActive: true });
  }

  public getTemplatesByPhase(phase: CasePhase): TaskTemplate[] {
    return this.getTemplates({ phase, isActive: true });
  }

  public getAutoCreateTemplates(caseType: CaseType, phase: CasePhase): TaskTemplate[] {
    return this.getTemplates({ caseType, phase, isActive: true })
      .filter(template => template.autoCreate);
  }

  public validateTemplate(template: TaskTemplate): string[] {
    const errors: string[] = [];

    // Basic validation
    if (!template.name || template.name.trim() === '') {
      errors.push('Template name is required');
    }

    if (!template.titleTemplate || template.titleTemplate.trim() === '') {
      errors.push('Title template is required');
    }

    if (!template.caseType) {
      errors.push('Case type is required');
    }

    if (!template.applicablePhases || template.applicablePhases.length === 0) {
      errors.push('At least one applicable phase is required');
    }

    // Validate variables
    const variableNames = new Set<string>();
    template.variables.forEach(variable => {
      if (variableNames.has(variable.name)) {
        errors.push(`Duplicate variable name: ${variable.name}`);
      }
      variableNames.add(variable.name);

      if (!variable.name || variable.name.trim() === '') {
        errors.push('Variable name is required');
      }

      if (variable.type === 'select' && (!variable.options || variable.options.length === 0)) {
        errors.push(`Options are required for select variable: ${variable.name}`);
      }
    });

    // Validate steps
    if (template.steps) {
      const stepIds = new Set<string>();
      template.steps.forEach(step => {
        if (stepIds.has(step.id)) {
          errors.push(`Duplicate step ID: ${step.id}`);
        }
        stepIds.add(step.id);

        if (step.dependencies) {
          step.dependencies.forEach(depId => {
            if (!stepIds.has(depId)) {
              errors.push(`Step ${step.id} depends on non-existent step: ${depId}`);
            }
          });
        }
      });
    }

    return errors;
  }
}