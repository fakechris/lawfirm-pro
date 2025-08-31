import { ValidationRule, DataIntegrityReport } from '../../models/integration';
import { z } from 'zod';
export declare class DataValidationService {
    private logger;
    private validationRules;
    private schemas;
    constructor();
    validateData(data: any, rules: ValidationRule[]): Promise<ValidationResult>;
    validateSchema(data: any, schemaName: string): Promise<ValidationResult>;
    checkDataIntegrity(dataSource: any[], dataTarget: any[], checkType?: 'consistency' | 'completeness' | 'validity' | 'uniqueness'): Promise<DataIntegrityReport>;
    registerValidationRuleSet(name: string, rules: ValidationRule[]): Promise<void>;
    registerSchema(name: string, schema: z.ZodSchema): Promise<void>;
    getValidationRules(name: string): Promise<ValidationRule[]>;
    getAvailableRuleSets(): Promise<string[]>;
    getAvailableSchemas(): Promise<string[]>;
    private validateField;
    private validateRequired;
    private validateType;
    private validateLength;
    private validatePattern;
    private validateRange;
    private validateCustom;
    private validateEnum;
    private validateUnique;
    private validateReference;
    private validateFormat;
    private validateCrossFields;
    private validateBusinessRules;
    private checkConsistency;
    private checkCompleteness;
    private checkValidity;
    private checkUniqueness;
    private initializeDefaultRules;
    private getNestedValue;
    private isValidEmail;
    private isValidPhone;
    private isValidUrl;
    private isValidUuid;
    private calculateAge;
    private generateReportId;
    private generateIssueId;
    private generateValidationSummary;
    private groupErrorsByType;
}
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    summary: ValidationSummary;
    validatedAt: Date;
}
export interface ValidationError {
    field: string;
    message: string;
    rule: string;
    severity: 'error';
    recordIndex: number;
    value: any;
}
export interface ValidationWarning {
    field: string;
    message: string;
    rule: string;
    severity: 'warning';
    recordIndex: number;
    value: any;
}
export interface ValidationSummary {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    warnings: number;
}
//# sourceMappingURL=DataValidationService.d.ts.map