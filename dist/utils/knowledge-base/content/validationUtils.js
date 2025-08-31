"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentValidationUtils = void 0;
class ContentValidationUtils {
    static validateContent(content) {
        const errors = [];
        if (!content.title || content.title.trim().length === 0) {
            errors.push('Title is required');
        }
        if (!content.content || content.content.trim().length === 0) {
            errors.push('Content is required');
        }
        if (!content.contentType || !this.isValidContentType(content.contentType)) {
            errors.push('Valid content type is required');
        }
        if (!content.category || content.category.trim().length === 0) {
            errors.push('Category is required');
        }
        if (!content.visibility || !this.isValidVisibility(content.visibility)) {
            errors.push('Valid visibility is required');
        }
        if (content.tags && !Array.isArray(content.tags)) {
            errors.push('Tags must be an array');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static isValidContentType(contentType) {
        const validTypes = ['article', 'guide', 'template', 'case_study', 'training', 'policy', 'procedure'];
        return validTypes.includes(contentType);
    }
    static isValidVisibility(visibility) {
        const validVisibilities = ['public', 'internal', 'restricted'];
        return validVisibilities.includes(visibility);
    }
    static validateVersion(version) {
        const errors = [];
        if (!version.title || version.title.trim().length === 0) {
            errors.push('Version title is required');
        }
        if (!version.content || version.content.trim().length === 0) {
            errors.push('Version content is required');
        }
        if (!version.createdById) {
            errors.push('Version creator is required');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static validateTemplate(template) {
        const errors = [];
        if (!template.name || template.name.trim().length === 0) {
            errors.push('Template name is required');
        }
        if (!template.templateContent || template.templateContent.trim().length === 0) {
            errors.push('Template content is required');
        }
        if (!template.category || template.category.trim().length === 0) {
            errors.push('Template category is required');
        }
        if (template.variableSchema && !Array.isArray(template.variableSchema)) {
            errors.push('Variable schema must be an array');
        }
        if (template.tags && !Array.isArray(template.tags)) {
            errors.push('Tags must be an array');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static validateVariableSchema(schema) {
        const errors = [];
        if (!Array.isArray(schema)) {
            errors.push('Variable schema must be an array');
            return { isValid: false, errors };
        }
        for (let i = 0; i < schema.length; i++) {
            const variable = schema[i];
            if (!variable.name || variable.name.trim().length === 0) {
                errors.push(`Variable ${i + 1}: Name is required`);
            }
            if (!variable.type || !this.isValidVariableType(variable.type)) {
                errors.push(`Variable ${i + 1}: Valid type is required`);
            }
            if (typeof variable.required !== 'boolean') {
                errors.push(`Variable ${i + 1}: Required must be a boolean`);
            }
            if (variable.validation) {
                const validationErrors = this.validateVariableValidation(variable.validation);
                errors.push(...validationErrors.map(err => `Variable ${i + 1}: ${err}`));
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static isValidVariableType(type) {
        const validTypes = ['string', 'number', 'date', 'boolean', 'select', 'array', 'object'];
        return validTypes.includes(type);
    }
    static validateVariableValidation(validation) {
        const errors = [];
        if (validation.pattern && typeof validation.pattern !== 'string') {
            errors.push('Pattern must be a string');
        }
        if (validation.min !== undefined && typeof validation.min !== 'number') {
            errors.push('Min must be a number');
        }
        if (validation.max !== undefined && typeof validation.max !== 'number') {
            errors.push('Max must be a number');
        }
        return errors;
    }
    static validateContentSize(content, maxSize = 1000000) {
        const size = new Blob([content]).size;
        const errors = [];
        if (size > maxSize) {
            errors.push(`Content size (${size} bytes) exceeds maximum allowed size (${maxSize} bytes)`);
        }
        return {
            isValid: errors.length === 0,
            size,
            errors
        };
    }
    static validateTags(tags) {
        const errors = [];
        if (!Array.isArray(tags)) {
            errors.push('Tags must be an array');
            return { isValid: false, errors };
        }
        for (let i = 0; i < tags.length; i++) {
            const tag = tags[i];
            if (typeof tag !== 'string' || tag.trim().length === 0) {
                errors.push(`Tag ${i + 1}: Must be a non-empty string`);
            }
            if (tag.length > 50) {
                errors.push(`Tag ${i + 1}: Must be 50 characters or less`);
            }
            if (!/^[a-zA-Z0-9_\-\s]+$/.test(tag)) {
                errors.push(`Tag ${i + 1}: Can only contain letters, numbers, spaces, hyphens, and underscores`);
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static validateSearchQuery(query) {
        const errors = [];
        if (!query || query.trim().length === 0) {
            errors.push('Search query is required');
        }
        if (query.length > 200) {
            errors.push('Search query must be 200 characters or less');
        }
        if (/[<>\"'&]/.test(query)) {
            errors.push('Search query contains invalid characters');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static validateCategory(category) {
        const errors = [];
        if (!category || category.trim().length === 0) {
            errors.push('Category is required');
        }
        if (category.length > 100) {
            errors.push('Category must be 100 characters or less');
        }
        if (!/^[a-zA-Z0-9_\-\s]+$/.test(category)) {
            errors.push('Category can only contain letters, numbers, spaces, hyphens, and underscores');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static validateWorkflowStage(stage) {
        const errors = [];
        if (!stage.name || stage.name.trim().length === 0) {
            errors.push('Stage name is required');
        }
        if (!stage.type || !['review', 'approval', 'publishing', 'archival'].includes(stage.type)) {
            errors.push('Valid stage type is required');
        }
        if (!stage.requiredRole || !Array.isArray(stage.requiredRole)) {
            errors.push('Required roles must be an array');
        }
        if (stage.dueDays !== undefined && (typeof stage.dueDays !== 'number' || stage.dueDays < 0)) {
            errors.push('Due days must be a positive number');
        }
        if (stage.autoApproveAfterDays !== undefined && (typeof stage.autoApproveAfterDays !== 'number' || stage.autoApproveAfterDays < 0)) {
            errors.push('Auto approve after days must be a positive number');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static validateTrainingModule(module) {
        const errors = [];
        if (!module.title || module.title.trim().length === 0) {
            errors.push('Module title is required');
        }
        if (!module.content || module.content.trim().length === 0) {
            errors.push('Module content is required');
        }
        if (!module.category || module.category.trim().length === 0) {
            errors.push('Module category is required');
        }
        if (!module.difficulty || !['beginner', 'intermediate', 'advanced'].includes(module.difficulty)) {
            errors.push('Valid difficulty level is required');
        }
        if (typeof module.duration !== 'number' || module.duration <= 0) {
            errors.push('Duration must be a positive number');
        }
        if (!Array.isArray(module.targetRoles)) {
            errors.push('Target roles must be an array');
        }
        if (!Array.isArray(module.learningObjectives)) {
            errors.push('Learning objectives must be an array');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static validateAssessment(assessment) {
        const errors = [];
        if (!assessment.title || assessment.title.trim().length === 0) {
            errors.push('Assessment title is required');
        }
        if (!assessment.type || !['quiz', 'assignment', 'practical'].includes(assessment.type)) {
            errors.push('Valid assessment type is required');
        }
        if (!Array.isArray(assessment.questions)) {
            errors.push('Questions must be an array');
        }
        if (typeof assessment.passingScore !== 'number' || assessment.passingScore < 0 || assessment.passingScore > 100) {
            errors.push('Passing score must be a number between 0 and 100');
        }
        if (typeof assessment.attemptsAllowed !== 'number' || assessment.attemptsAllowed < 1) {
            errors.push('Attempts allowed must be a positive number');
        }
        if (Array.isArray(assessment.questions)) {
            assessment.questions.forEach((question, index) => {
                if (!question.question || question.question.trim().length === 0) {
                    errors.push(`Question ${index + 1}: Question text is required`);
                }
                if (!question.type || !['multiple_choice', 'true_false', 'short_answer', 'essay'].includes(question.type)) {
                    errors.push(`Question ${index + 1}: Valid question type is required`);
                }
                if (typeof question.points !== 'number' || question.points <= 0) {
                    errors.push(`Question ${index + 1}: Points must be a positive number`);
                }
            });
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
}
exports.ContentValidationUtils = ContentValidationUtils;
//# sourceMappingURL=validationUtils.js.map