"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataValidationService = void 0;
const logger_1 = require("../integration/logger");
class DataValidationService {
    constructor() {
        this.validationRules = new Map();
        this.schemas = new Map();
        this.logger = new logger_1.IntegrationLoggerImplementation();
        this.initializeDefaultRules();
    }
    async validateData(data, rules) {
        try {
            this.logger.info(`Validating data with ${rules.length} rules`, {
                dataType: Array.isArray(data) ? 'array' : 'object',
                recordCount: Array.isArray(data) ? data.length : 1
            });
            const dataToValidate = Array.isArray(data) ? data : [data];
            const errors = [];
            const warnings = [];
            let isValid = true;
            for (let i = 0; i < dataToValidate.length; i++) {
                const item = dataToValidate[i];
                const itemErrors = [];
                const itemWarnings = [];
                for (const rule of rules) {
                    const result = await this.validateField(item, rule, i);
                    if (!result.isValid) {
                        itemErrors.push(result.error);
                        isValid = false;
                    }
                    else if (result.warning) {
                        itemWarnings.push(result.warning);
                    }
                }
                const crossFieldResults = await this.validateCrossFields(item, rules, i);
                itemErrors.push(...crossFieldResults.errors);
                itemWarnings.push(...crossFieldResults.warnings);
                if (crossFieldResults.errors.length > 0) {
                    isValid = false;
                }
                errors.push(...itemErrors);
                warnings.push(...itemWarnings);
            }
            const businessRuleResults = await this.validateBusinessRules(dataToValidate);
            errors.push(...businessRuleResults.errors);
            warnings.push(...businessRuleResults.warnings);
            if (businessRuleResults.errors.length > 0) {
                isValid = false;
            }
            this.logger.info(`Data validation completed`, {
                isValid,
                errorsCount: errors.length,
                warningsCount: warnings.length,
                errorTypes: this.groupErrorsByType(errors)
            });
            return {
                isValid,
                errors,
                warnings,
                summary: this.generateValidationSummary(errors, warnings),
                validatedAt: new Date()
            };
        }
        catch (error) {
            this.logger.error(`Data validation failed`, {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async validateSchema(data, schemaName) {
        try {
            const schema = this.schemas.get(schemaName);
            if (!schema) {
                throw new Error(`Schema '${schemaName}' not found`);
            }
            this.logger.info(`Validating data against schema`, {
                schemaName,
                dataType: Array.isArray(data) ? 'array' : 'object'
            });
            const result = schema.safeParse(data);
            if (result.success) {
                return {
                    isValid: true,
                    errors: [],
                    warnings: [],
                    summary: {
                        totalChecks: 1,
                        passedChecks: 1,
                        failedChecks: 0,
                        warnings: 0
                    },
                    validatedAt: new Date()
                };
            }
            else {
                const errors = result.error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message,
                    rule: 'schema_validation',
                    severity: 'error',
                    recordIndex: 0,
                    value: err.path.reduce((obj, key) => obj?.[key], data)
                }));
                this.logger.warn(`Schema validation failed`, {
                    schemaName,
                    errorsCount: errors.length
                });
                return {
                    isValid: false,
                    errors,
                    warnings: [],
                    summary: {
                        totalChecks: 1,
                        passedChecks: 0,
                        failedChecks: 1,
                        warnings: 0
                    },
                    validatedAt: new Date()
                };
            }
        }
        catch (error) {
            this.logger.error(`Schema validation failed`, {
                schemaName,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async checkDataIntegrity(dataSource, dataTarget, checkType = 'consistency') {
        try {
            this.logger.info(`Starting data integrity check`, {
                checkType,
                sourceRecords: dataSource.length,
                targetRecords: dataTarget.length
            });
            const startTime = Date.now();
            const issues = [];
            let status = 'passed';
            switch (checkType) {
                case 'consistency':
                    const consistencyIssues = await this.checkConsistency(dataSource, dataTarget);
                    issues.push(...consistencyIssues);
                    break;
                case 'completeness':
                    const completenessIssues = await this.checkCompleteness(dataSource, dataTarget);
                    issues.push(...completenessIssues);
                    break;
                case 'validity':
                    const validityIssues = await this.checkValidity([...dataSource, ...dataTarget]);
                    issues.push(...validityIssues);
                    break;
                case 'uniqueness':
                    const uniquenessIssues = await this.checkUniqueness([...dataSource, ...dataTarget]);
                    issues.push(...uniquenessIssues);
                    break;
            }
            const criticalIssues = issues.filter(issue => issue.severity === 'critical');
            const highIssues = issues.filter(issue => issue.severity === 'high');
            if (criticalIssues.length > 0) {
                status = 'failed';
            }
            else if (highIssues.length > 0 || issues.length > 0) {
                status = 'warning';
            }
            const duration = Date.now() - startTime;
            const report = {
                id: this.generateReportId(),
                dataSourceId: 'source',
                dataTargetId: 'target',
                checkType,
                status,
                issues,
                checkedAt: new Date(),
                duration
            };
            this.logger.info(`Data integrity check completed`, {
                checkType,
                status,
                issuesCount: issues.length,
                duration,
                criticalIssues: criticalIssues.length
            });
            return report;
        }
        catch (error) {
            this.logger.error(`Data integrity check failed`, {
                checkType,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async registerValidationRuleSet(name, rules) {
        try {
            this.validationRules.set(name, rules);
            this.logger.info(`Validation rule set registered`, {
                name,
                rulesCount: rules.length
            });
        }
        catch (error) {
            this.logger.error(`Failed to register validation rule set`, {
                name,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async registerSchema(name, schema) {
        try {
            this.schemas.set(name, schema);
            this.logger.info(`Schema registered`, {
                name
            });
        }
        catch (error) {
            this.logger.error(`Failed to register schema`, {
                name,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async getValidationRules(name) {
        return this.validationRules.get(name) || [];
    }
    async getAvailableRuleSets() {
        return Array.from(this.validationRules.keys());
    }
    async getAvailableSchemas() {
        return Array.from(this.schemas.keys());
    }
    async validateField(item, rule, recordIndex) {
        try {
            const value = this.getNestedValue(item, rule.config.field);
            switch (rule.type) {
                case 'required':
                    return this.validateRequired(value, rule, recordIndex);
                case 'type':
                    return this.validateType(value, rule, recordIndex);
                case 'length':
                    return this.validateLength(value, rule, recordIndex);
                case 'pattern':
                    return this.validatePattern(value, rule, recordIndex);
                case 'range':
                    return this.validateRange(value, rule, recordIndex);
                case 'custom':
                    return this.validateCustom(item, rule, recordIndex);
                case 'enum':
                    return this.validateEnum(value, rule, recordIndex);
                case 'unique':
                    return this.validateUnique(item, rule, recordIndex);
                case 'reference':
                    return this.validateReference(item, rule, recordIndex);
                case 'format':
                    return this.validateFormat(value, rule, recordIndex);
                default:
                    return { isValid: true };
            }
        }
        catch (error) {
            return {
                isValid: false,
                error: {
                    field: rule.config.field,
                    message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    rule: rule.type,
                    severity: 'error',
                    recordIndex,
                    value: this.getNestedValue(item, rule.config.field)
                }
            };
        }
    }
    validateRequired(value, rule, recordIndex) {
        const isValid = value !== undefined && value !== null && value !== '';
        if (!isValid) {
            return {
                isValid: false,
                error: {
                    field: rule.config.field,
                    message: rule.config.message || `Field '${rule.config.field}' is required`,
                    rule: rule.type,
                    severity: 'error',
                    recordIndex,
                    value
                }
            };
        }
        return { isValid: true };
    }
    validateType(value, rule, recordIndex) {
        if (value === null || value === undefined) {
            return { isValid: true };
        }
        const expectedType = rule.config.expectedType;
        let isValid = false;
        switch (expectedType) {
            case 'string':
                isValid = typeof value === 'string';
                break;
            case 'number':
                isValid = typeof value === 'number' && !isNaN(value);
                break;
            case 'boolean':
                isValid = typeof value === 'boolean';
                break;
            case 'object':
                isValid = typeof value === 'object' && !Array.isArray(value);
                break;
            case 'array':
                isValid = Array.isArray(value);
                break;
            case 'date':
                isValid = value instanceof Date || !isNaN(Date.parse(value));
                break;
            case 'email':
                isValid = this.isValidEmail(value);
                break;
            case 'phone':
                isValid = this.isValidPhone(value);
                break;
            case 'url':
                isValid = this.isValidUrl(value);
                break;
        }
        if (!isValid) {
            return {
                isValid: false,
                error: {
                    field: rule.config.field,
                    message: rule.config.message || `Field '${rule.config.field}' must be of type ${expectedType}`,
                    rule: rule.type,
                    severity: 'error',
                    recordIndex,
                    value
                }
            };
        }
        return { isValid: true };
    }
    validateLength(value, rule, recordIndex) {
        if (value === null || value === undefined) {
            return { isValid: true };
        }
        const str = String(value);
        const minLength = rule.config.minLength || 0;
        const maxLength = rule.config.maxLength || Infinity;
        const isValid = str.length >= minLength && str.length <= maxLength;
        if (!isValid) {
            return {
                isValid: false,
                error: {
                    field: rule.config.field,
                    message: rule.config.message || `Field '${rule.config.field}' must be between ${minLength} and ${maxLength} characters`,
                    rule: rule.type,
                    severity: 'error',
                    recordIndex,
                    value
                }
            };
        }
        return { isValid: true };
    }
    validatePattern(value, rule, recordIndex) {
        if (value === null || value === undefined) {
            return { isValid: true };
        }
        const pattern = new RegExp(rule.config.pattern);
        const isValid = pattern.test(String(value));
        if (!isValid) {
            return {
                isValid: false,
                error: {
                    field: rule.config.field,
                    message: rule.config.message || `Field '${rule.config.field}' does not match required pattern`,
                    rule: rule.type,
                    severity: 'error',
                    recordIndex,
                    value
                }
            };
        }
        return { isValid: true };
    }
    validateRange(value, rule, recordIndex) {
        if (value === null || value === undefined) {
            return { isValid: true };
        }
        const num = Number(value);
        const min = rule.config.min || -Infinity;
        const max = rule.config.max || Infinity;
        const isValid = num >= min && num <= max;
        if (!isValid) {
            return {
                isValid: false,
                error: {
                    field: rule.config.field,
                    message: rule.config.message || `Field '${rule.config.field}' must be between ${min} and ${max}`,
                    rule: rule.type,
                    severity: 'error',
                    recordIndex,
                    value
                }
            };
        }
        return { isValid: true };
    }
    validateCustom(item, rule, recordIndex) {
        try {
            const customFunction = new Function('item', 'value', `return ${rule.config.function}`);
            const isValid = customFunction(item, this.getNestedValue(item, rule.config.field));
            if (!isValid) {
                return {
                    isValid: false,
                    error: {
                        field: rule.config.field,
                        message: rule.config.message || `Custom validation failed for field '${rule.config.field}'`,
                        rule: rule.type,
                        severity: 'error',
                        recordIndex,
                        value: this.getNestedValue(item, rule.config.field)
                    }
                };
            }
            return { isValid: true };
        }
        catch (error) {
            return {
                isValid: false,
                error: {
                    field: rule.config.field,
                    message: `Custom validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    rule: rule.type,
                    severity: 'error',
                    recordIndex,
                    value: this.getNestedValue(item, rule.config.field)
                }
            };
        }
    }
    validateEnum(value, rule, recordIndex) {
        if (value === null || value === undefined) {
            return { isValid: true };
        }
        const allowedValues = rule.config.values || [];
        const isValid = allowedValues.includes(value);
        if (!isValid) {
            return {
                isValid: false,
                error: {
                    field: rule.config.field,
                    message: rule.config.message || `Field '${rule.config.field}' must be one of: ${allowedValues.join(', ')}`,
                    rule: rule.type,
                    severity: 'error',
                    recordIndex,
                    value
                }
            };
        }
        return { isValid: true };
    }
    validateUnique(item, rule, recordIndex) {
        return { isValid: true };
    }
    validateReference(item, rule, recordIndex) {
        return { isValid: true };
    }
    validateFormat(value, rule, recordIndex) {
        if (value === null || value === undefined) {
            return { isValid: true };
        }
        const format = rule.config.format;
        let isValid = true;
        switch (format) {
            case 'email':
                isValid = this.isValidEmail(value);
                break;
            case 'phone':
                isValid = this.isValidPhone(value);
                break;
            case 'url':
                isValid = this.isValidUrl(value);
                break;
            case 'date':
                isValid = !isNaN(Date.parse(value));
                break;
            case 'datetime':
                isValid = !isNaN(Date.parse(value));
                break;
            case 'uuid':
                isValid = this.isValidUuid(value);
                break;
            default:
                isValid = true;
        }
        if (!isValid) {
            return {
                isValid: false,
                error: {
                    field: rule.config.field,
                    message: rule.config.message || `Field '${rule.config.field}' is not in valid ${format} format`,
                    rule: rule.type,
                    severity: 'error',
                    recordIndex,
                    value
                }
            };
        }
        return { isValid: true };
    }
    async validateCrossFields(item, rules, recordIndex) {
        const errors = [];
        const warnings = [];
        if (item.start_date && item.end_date) {
            const startDate = new Date(item.start_date);
            const endDate = new Date(item.end_date);
            if (startDate > endDate) {
                errors.push({
                    field: 'start_date',
                    message: 'Start date must be before end date',
                    rule: 'cross_field_validation',
                    severity: 'error',
                    recordIndex,
                    value: item.start_date
                });
            }
        }
        if (item.password && item.password_confirmation) {
            if (item.password !== item.password_confirmation) {
                errors.push({
                    field: 'password_confirmation',
                    message: 'Password confirmation does not match password',
                    rule: 'cross_field_validation',
                    severity: 'error',
                    recordIndex,
                    value: item.password_confirmation
                });
            }
        }
        return { errors, warnings };
    }
    async validateBusinessRules(data) {
        const errors = [];
        const warnings = [];
        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            if (item.amount && item.amount <= 0) {
                errors.push({
                    field: 'amount',
                    message: 'Amount must be greater than 0',
                    rule: 'business_rule',
                    severity: 'error',
                    recordIndex: i,
                    value: item.amount
                });
            }
            if (item.date_of_birth) {
                const age = this.calculateAge(new Date(item.date_of_birth));
                if (age < 18) {
                    warnings.push({
                        field: 'date_of_birth',
                        message: 'Age is less than 18 years',
                        rule: 'business_rule',
                        severity: 'warning',
                        recordIndex: i,
                        value: item.date_of_birth
                    });
                }
            }
        }
        return { errors, warnings };
    }
    async checkConsistency(source, target) {
        const issues = [];
        const sourceMap = new Map(source.map(item => [item.id, item]));
        const targetMap = new Map(target.map(item => [item.id, item]));
        for (const [id, sourceItem] of sourceMap) {
            const targetItem = targetMap.get(id);
            if (targetItem) {
                for (const [field, sourceValue] of Object.entries(sourceItem)) {
                    const targetValue = targetItem[field];
                    if (JSON.stringify(sourceValue) !== JSON.stringify(targetValue)) {
                        issues.push({
                            id: this.generateIssueId(),
                            type: 'invalid_data',
                            severity: 'medium',
                            field,
                            recordId: id,
                            message: `Data mismatch for field '${field}' between source and target`,
                            suggestedFix: 'Use conflict resolution to determine correct value'
                        });
                    }
                }
            }
        }
        return issues;
    }
    async checkCompleteness(source, target) {
        const issues = [];
        const sourceIds = new Set(source.map(item => item.id));
        const targetIds = new Set(target.map(item => item.id));
        for (const id of sourceIds) {
            if (!targetIds.has(id)) {
                issues.push({
                    id: this.generateIssueId(),
                    type: 'missing_data',
                    severity: 'high',
                    recordId: id,
                    message: `Record ${id} exists in source but not in target`,
                    suggestedFix: 'Sync missing records from source to target'
                });
            }
        }
        for (const id of targetIds) {
            if (!sourceIds.has(id)) {
                issues.push({
                    id: this.generateIssueId(),
                    type: 'missing_data',
                    severity: 'medium',
                    recordId: id,
                    message: `Record ${id} exists in target but not in source`,
                    suggestedFix: 'Review if record should be in source or removed from target'
                });
            }
        }
        return issues;
    }
    async checkValidity(data) {
        const issues = [];
        for (const item of data) {
            if (item.email && !this.isValidEmail(item.email)) {
                issues.push({
                    id: this.generateIssueId(),
                    type: 'invalid_data',
                    severity: 'medium',
                    field: 'email',
                    recordId: item.id,
                    message: 'Invalid email format',
                    suggestedFix: 'Correct email format or remove invalid email'
                });
            }
            if (item.phone && !this.isValidPhone(item.phone)) {
                issues.push({
                    id: this.generateIssueId(),
                    type: 'invalid_data',
                    severity: 'medium',
                    field: 'phone',
                    recordId: item.id,
                    message: 'Invalid phone number format',
                    suggestedFix: 'Correct phone number format or remove invalid phone'
                });
            }
        }
        return issues;
    }
    async checkUniqueness(data) {
        const issues = [];
        const seenIds = new Set();
        for (const item of data) {
            if (seenIds.has(item.id)) {
                issues.push({
                    id: this.generateIssueId(),
                    type: 'duplicate_data',
                    severity: 'high',
                    recordId: item.id,
                    message: `Duplicate record ID found: ${item.id}`,
                    suggestedFix: 'Remove duplicate record or assign unique ID'
                });
            }
            else {
                seenIds.add(item.id);
            }
        }
        return issues;
    }
    initializeDefaultRules() {
        const emailRules = [
            {
                type: 'required',
                config: { field: 'email', message: 'Email is required' }
            },
            {
                type: 'format',
                config: { field: 'email', format: 'email', message: 'Invalid email format' }
            }
        ];
        const phoneRules = [
            {
                type: 'format',
                config: { field: 'phone', format: 'phone', message: 'Invalid phone number format' }
            }
        ];
        this.validationRules.set('email', emailRules);
        this.validationRules.set('phone', phoneRules);
    }
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    isValidPhone(phone) {
        const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
        return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
    }
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        }
        catch {
            return false;
        }
    }
    isValidUuid(uuid) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }
    calculateAge(birthDate) {
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    }
    generateReportId() {
        return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateIssueId() {
        return `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateValidationSummary(errors, warnings) {
        return {
            totalChecks: errors.length + warnings.length,
            passedChecks: warnings.length,
            failedChecks: errors.length,
            warnings: warnings.length
        };
    }
    groupErrorsByType(errors) {
        return errors.reduce((groups, error) => {
            groups[error.rule] = (groups[error.rule] || 0) + 1;
            return groups;
        }, {});
    }
}
exports.DataValidationService = DataValidationService;
//# sourceMappingURL=DataValidationService.js.map