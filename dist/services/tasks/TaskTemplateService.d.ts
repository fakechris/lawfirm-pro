import { CaseType, CasePhase, TaskPriority, UserRole } from '@prisma/client';
export interface TaskTemplateVariable {
    name: string;
    type: 'string' | 'number' | 'date' | 'boolean' | 'select' | 'user' | 'case';
    description?: string;
    required: boolean;
    defaultValue?: any;
    options?: string[];
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
    dueDateOffset?: number;
    dependencies?: string[];
    validationRules?: TaskTemplateValidation[];
    outputs?: string[];
}
export interface TaskTemplate {
    id: string;
    name: string;
    description: string;
    version: string;
    caseType: CaseType;
    applicablePhases: CasePhase[];
    category: 'document_preparation' | 'client_communication' | 'court_filing' | 'research' | 'negotiation' | 'hearing_preparation' | 'administrative';
    titleTemplate: string;
    descriptionTemplate?: string;
    instructions?: string;
    defaultPriority: TaskPriority;
    defaultAssigneeRole?: UserRole;
    estimatedDuration?: number;
    dueDateOffset?: number;
    variables: TaskTemplateVariable[];
    validationRules: TaskTemplateValidation[];
    steps?: TaskTemplateStep[];
    autoCreate: boolean;
    autoAssign: boolean;
    triggers: TemplateTrigger[];
    prerequisites?: string[];
    dependencies?: string[];
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
    delay?: number;
}
export interface TemplateInstance {
    id: string;
    templateId: string;
    caseId: string;
    taskId: string;
    variables: Record<string, any>;
    currentStep?: string;
    status: 'active' | 'completed' | 'cancelled' | 'paused';
    progress: number;
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
export declare class TaskTemplateService {
    private templates;
    private instances;
    private templateUsage;
    constructor();
    private initializeDefaultTemplates;
    addTemplate(template: TaskTemplate): void;
    getTemplate(id: string): TaskTemplate | undefined;
    getTemplates(criteria?: TemplateSearchCriteria): TaskTemplate[];
    createTemplateInstance(templateId: string, caseId: string, taskId: string, variables: Record<string, any>): TemplateInstance | null;
    getTemplateInstance(instanceId: string): TemplateInstance | undefined;
    getCaseTemplateInstances(caseId: string): TemplateInstance[];
    updateTemplateInstance(instanceId: string, updates: Partial<TemplateInstance>): boolean;
    completeTemplateInstance(instanceId: string): boolean;
    validateTemplateVariables(template: TaskTemplate, variables: Record<string, any>): string[];
    private getNestedValue;
    generateTaskFromTemplate(templateId: string, caseId: string, variables: Record<string, any>): {
        title: string;
        description?: string;
        priority: TaskPriority;
        estimatedDuration?: number;
        dueDate?: Date;
        assigneeRole?: UserRole;
        steps?: TaskTemplateStep[];
    } | null;
    private interpolateTemplate;
    getTemplateCategories(): string[];
    getTemplateTags(): string[];
    getTemplateUsageStats(): Array<{
        templateId: string;
        templateName: string;
        usageCount: number;
        lastUsed?: Date;
    }>;
    updateTemplate(templateId: string, updates: Partial<TaskTemplate>): boolean;
    deleteTemplate(templateId: string): boolean;
    activateTemplate(templateId: string): boolean;
    deactivateTemplate(templateId: string): boolean;
    duplicateTemplate(templateId: string, newId?: string): TaskTemplate | null;
    getTemplatesByCaseType(caseType: CaseType): TaskTemplate[];
    getTemplatesByPhase(phase: CasePhase): TaskTemplate[];
    getAutoCreateTemplates(caseType: CaseType, phase: CasePhase): TaskTemplate[];
    validateTemplate(template: TaskTemplate): string[];
}
//# sourceMappingURL=TaskTemplateService.d.ts.map