"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskTemplateService = void 0;
const client_1 = require("@prisma/client");
class TaskTemplateService {
    constructor() {
        this.templates = new Map();
        this.instances = new Map();
        this.templateUsage = new Map();
        this.initializeDefaultTemplates();
    }
    initializeDefaultTemplates() {
        this.addTemplate({
            id: 'criminal_intake_assessment',
            name: 'Criminal Case Intake Assessment',
            description: 'Comprehensive intake assessment for criminal defense cases',
            version: '1.0.0',
            caseType: client_1.CaseType.CRIMINAL_DEFENSE,
            applicablePhases: [client_1.CasePhase.INTAKE_RISK_ASSESSMENT],
            category: 'research',
            titleTemplate: 'Complete Intake Assessment - {caseTitle}',
            descriptionTemplate: 'Conduct thorough intake assessment for criminal case {caseTitle}',
            instructions: 'Review police reports, interview client, assess evidence, determine defense strategy',
            defaultPriority: client_1.TaskPriority.HIGH,
            defaultAssigneeRole: client_1.UserRole.ATTORNEY,
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
                    condition: { phase: client_1.CasePhase.INTAKE_RISK_ASSESSMENT }
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
        this.addTemplate({
            id: 'bail_hearing_preparation',
            name: 'Bail Hearing Preparation',
            description: 'Complete preparation for bail hearing including motions and arguments',
            version: '1.0.0',
            caseType: client_1.CaseType.CRIMINAL_DEFENSE,
            applicablePhases: [client_1.CasePhase.PRE_PROCEEDING_PREPARATION],
            category: 'hearing_preparation',
            titleTemplate: 'Prepare Bail Hearing - {clientName}',
            descriptionTemplate: 'Prepare and file bail application for {clientName}',
            instructions: 'Prepare bail application, gather character references, draft legal arguments',
            defaultPriority: client_1.TaskPriority.URGENT,
            defaultAssigneeRole: client_1.UserRole.ATTORNEY,
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
                    condition: { phase: client_1.CasePhase.PRE_PROCEEDING_PREPARATION }
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
        this.addTemplate({
            id: 'divorce_filing',
            name: 'Divorce Petition Filing',
            description: 'Prepare and file divorce petition with all required documentation',
            version: '1.0.0',
            caseType: client_1.CaseType.DIVORCE_FAMILY,
            applicablePhases: [client_1.CasePhase.PRE_PROCEEDING_PREPARATION],
            category: 'court_filing',
            titleTemplate: 'File Divorce Petition - {clientName}',
            descriptionTemplate: 'Prepare and file divorce petition for {clientName}',
            instructions: 'Draft petition, prepare financial disclosures, file with court',
            defaultPriority: client_1.TaskPriority.MEDIUM,
            defaultAssigneeRole: client_1.UserRole.ATTORNEY,
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
                    condition: (value, data) => {
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
                    condition: { phase: client_1.CasePhase.PRE_PROCEEDING_PREPARATION }
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
        this.addTemplate({
            id: 'medical_record_review',
            name: 'Medical Record Review and Analysis',
            description: 'Comprehensive review of medical records to identify potential malpractice',
            version: '1.0.0',
            caseType: client_1.CaseType.MEDICAL_MALPRACTICE,
            applicablePhases: [client_1.CasePhase.INTAKE_RISK_ASSESSMENT],
            category: 'research',
            titleTemplate: 'Review Medical Records - {caseTitle}',
            descriptionTemplate: 'Analyze medical records for {patientName} to identify standard of care violations',
            instructions: 'Review all medical records, identify deviations from standard of care, consult with medical experts',
            defaultPriority: client_1.TaskPriority.HIGH,
            defaultAssigneeRole: client_1.UserRole.ATTORNEY,
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
                    condition: { phase: client_1.CasePhase.INTAKE_RISK_ASSESSMENT }
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
        this.addTemplate({
            id: 'contract_analysis',
            name: 'Contract Analysis and Breach Assessment',
            description: 'Analyze contract and assess potential breach claims',
            version: '1.0.0',
            caseType: client_1.CaseType.CONTRACT_DISPUTE,
            applicablePhases: [client_1.CasePhase.INTAKE_RISK_ASSESSMENT],
            category: 'research',
            titleTemplate: 'Analyze Contract - {caseTitle}',
            descriptionTemplate: 'Review contract and assess breach claims for {clientName}',
            instructions: 'Analyze contract terms, identify potential breaches, assess damages',
            defaultPriority: client_1.TaskPriority.MEDIUM,
            defaultAssigneeRole: client_1.UserRole.ATTORNEY,
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
                    condition: { phase: client_1.CasePhase.INTAKE_RISK_ASSESSMENT }
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
    addTemplate(template) {
        this.templates.set(template.id, template);
        this.templateUsage.set(template.id, 0);
    }
    getTemplate(id) {
        return this.templates.get(id);
    }
    getTemplates(criteria = {}) {
        let templates = Array.from(this.templates.values());
        if (criteria.caseType) {
            templates = templates.filter(t => t.caseType === criteria.caseType);
        }
        if (criteria.phase) {
            templates = templates.filter(t => t.applicablePhases.includes(criteria.phase));
        }
        if (criteria.category) {
            templates = templates.filter(t => t.category === criteria.category);
        }
        if (criteria.tags && criteria.tags.length > 0) {
            templates = templates.filter(t => criteria.tags.some(tag => t.tags.includes(tag)));
        }
        if (criteria.isActive !== undefined) {
            templates = templates.filter(t => t.isActive === criteria.isActive);
        }
        if (criteria.searchQuery) {
            const query = criteria.searchQuery.toLowerCase();
            templates = templates.filter(t => t.name.toLowerCase().includes(query) ||
                t.description.toLowerCase().includes(query) ||
                t.tags.some(tag => tag.toLowerCase().includes(query)));
        }
        templates.sort((a, b) => b.usageCount - a.usageCount);
        if (criteria.offset !== undefined || criteria.limit !== undefined) {
            const start = criteria.offset || 0;
            const end = criteria.limit ? start + criteria.limit : undefined;
            templates = templates.slice(start, end);
        }
        return templates;
    }
    createTemplateInstance(templateId, caseId, taskId, variables) {
        const template = this.templates.get(templateId);
        if (!template) {
            return null;
        }
        const validationErrors = this.validateTemplateVariables(template, variables);
        if (validationErrors.length > 0) {
            throw new Error(`Template validation failed: ${validationErrors.join(', ')}`);
        }
        const instance = {
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
        const currentUsage = this.templateUsage.get(templateId) || 0;
        this.templateUsage.set(templateId, currentUsage + 1);
        template.lastUsed = new Date();
        template.usageCount++;
        return instance;
    }
    getTemplateInstance(instanceId) {
        return this.instances.get(instanceId);
    }
    getCaseTemplateInstances(caseId) {
        return Array.from(this.instances.values()).filter(instance => instance.caseId === caseId);
    }
    updateTemplateInstance(instanceId, updates) {
        const instance = this.instances.get(instanceId);
        if (!instance) {
            return false;
        }
        Object.assign(instance, updates);
        return true;
    }
    completeTemplateInstance(instanceId) {
        const instance = this.instances.get(instanceId);
        if (!instance || instance.status === 'completed') {
            return false;
        }
        instance.status = 'completed';
        instance.progress = 100;
        instance.completedAt = new Date();
        return true;
    }
    validateTemplateVariables(template, variables) {
        const errors = [];
        template.variables.forEach(variable => {
            if (variable.required && !(variable.name in variables)) {
                errors.push(`${variable.name} is required`);
            }
        });
        template.variables.forEach(variable => {
            const value = variables[variable.name];
            if (value === undefined)
                return;
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
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    generateTaskFromTemplate(templateId, caseId, variables) {
        const template = this.templates.get(templateId);
        if (!template) {
            return null;
        }
        const title = this.interpolateTemplate(template.titleTemplate, variables);
        const description = template.descriptionTemplate
            ? this.interpolateTemplate(template.descriptionTemplate, variables)
            : undefined;
        let dueDate;
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
    interpolateTemplate(template, variables) {
        return template.replace(/\{([^}]+)\}/g, (match, key) => {
            const value = this.getNestedValue(variables, key);
            return value !== undefined ? String(value) : match;
        });
    }
    getTemplateCategories() {
        const categories = new Set();
        this.templates.forEach(template => {
            categories.add(template.category);
        });
        return Array.from(categories).sort();
    }
    getTemplateTags() {
        const tags = new Set();
        this.templates.forEach(template => {
            template.tags.forEach(tag => tags.add(tag));
        });
        return Array.from(tags).sort();
    }
    getTemplateUsageStats() {
        return Array.from(this.templates.values()).map(template => ({
            templateId: template.id,
            templateName: template.name,
            usageCount: template.usageCount,
            lastUsed: template.lastUsed
        })).sort((a, b) => b.usageCount - a.usageCount);
    }
    updateTemplate(templateId, updates) {
        const template = this.templates.get(templateId);
        if (!template) {
            return false;
        }
        Object.assign(template, updates, { updatedAt: new Date() });
        return true;
    }
    deleteTemplate(templateId) {
        return this.templates.delete(templateId);
    }
    activateTemplate(templateId) {
        const template = this.templates.get(templateId);
        if (!template) {
            return false;
        }
        template.isActive = true;
        template.updatedAt = new Date();
        return true;
    }
    deactivateTemplate(templateId) {
        const template = this.templates.get(templateId);
        if (!template) {
            return false;
        }
        template.isActive = false;
        template.updatedAt = new Date();
        return true;
    }
    duplicateTemplate(templateId, newId) {
        const template = this.templates.get(templateId);
        if (!template) {
            return null;
        }
        const duplicate = {
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
    getTemplatesByCaseType(caseType) {
        return this.getTemplates({ caseType, isActive: true });
    }
    getTemplatesByPhase(phase) {
        return this.getTemplates({ phase, isActive: true });
    }
    getAutoCreateTemplates(caseType, phase) {
        return this.getTemplates({ caseType, phase, isActive: true })
            .filter(template => template.autoCreate);
    }
    validateTemplate(template) {
        const errors = [];
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
        const variableNames = new Set();
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
        if (template.steps) {
            const stepIds = new Set();
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
exports.TaskTemplateService = TaskTemplateService;
//# sourceMappingURL=TaskTemplateService.js.map