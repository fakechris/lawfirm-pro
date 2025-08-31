export { DataValidationService } from './DataValidationService';
export interface ValidationService {
    validateData(data: any, ruleSetName: string): Promise<ValidationResult>;
    validateSchema(data: any, schemaName: string): Promise<ValidationResult>;
    checkDataIntegrity(source: any[], target: any[], checkType: IntegrityCheckType): Promise<DataIntegrityReport>;
    registerRuleSet(name: string, rules: ValidationRule[]): Promise<void>;
    registerSchema(name: string, schema: any): Promise<void>;
    getValidationReport(ruleSetName: string, data: any): Promise<ValidationReport>;
    scheduleValidation(schedule: ValidationSchedule): Promise<string>;
    getValidationResults(validationId: string): Promise<ValidationResult[]>;
}
export interface ValidationSchedule {
    name: string;
    ruleSetName: string;
    dataSource: string;
    schedule: string;
    isActive: boolean;
    notifications: NotificationConfig[];
    retryPolicy: RetryPolicy;
}
export interface NotificationConfig {
    type: 'email' | 'webhook' | 'slack' | 'teams';
    recipients: string[];
    conditions: NotificationCondition[];
    template?: string;
}
export interface NotificationCondition {
    type: 'error_threshold' | 'warning_threshold' | 'specific_error' | 'always';
    value?: number;
    field?: string;
    rule?: string;
}
export interface RetryPolicy {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
}
export interface ValidationReport {
    id: string;
    ruleSetName: string;
    dataSource: string;
    executedAt: Date;
    duration: number;
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    warnings: number;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    summary: ValidationSummary;
    recommendations: ValidationRecommendation[];
}
export interface ValidationRecommendation {
    type: 'fix_data' | 'update_rules' | 'investigate' | 'ignore';
    priority: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    affectedRecords: number;
    suggestedAction: string;
}
export type IntegrityCheckType = 'consistency' | 'completeness' | 'validity' | 'uniqueness' | 'all';
import type { ValidationRule, DataIntegrityReport } from '../../models/integration';
import type { ValidationResult, ValidationError, ValidationWarning, ValidationSummary } from './DataValidationService';
//# sourceMappingURL=index.d.ts.map