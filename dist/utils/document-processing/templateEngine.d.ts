export interface TemplateVariable {
    name: string;
    type: 'string' | 'number' | 'date' | 'boolean' | 'array' | 'object';
    description: string;
    required: boolean;
    defaultValue?: any;
    validation?: ValidationRule[];
    options?: string[];
}
export interface ValidationRule {
    type: 'min' | 'max' | 'pattern' | 'required' | 'enum';
    value: any;
    message: string;
}
export interface TemplateData {
    [key: string]: any;
}
export interface TemplateProcessingOptions {
    validateVariables?: boolean;
    strictMode?: boolean;
    includeMetadata?: boolean;
    outputFormat?: 'html' | 'pdf' | 'docx' | 'txt';
    customHelpers?: Record<string, Function>;
}
export interface TemplateProcessingResult {
    content: string;
    metadata: TemplateMetadata;
    variables: TemplateVariable[];
    errors: string[];
    warnings: string[];
    processingTime: number;
}
export interface TemplateMetadata {
    name: string;
    description?: string;
    version: string;
    author?: string;
    createdAt: Date;
    updatedAt: Date;
    usageCount: number;
    category?: string;
    tags?: string[];
}
export interface ConditionalBlock {
    condition: string;
    content: string;
    elseContent?: string;
}
export declare class TemplateEngine {
    private customHelpers;
    private templates;
    constructor();
    private registerDefaultHelpers;
    registerCustomHelper(name: string, helper: Function): void;
    loadTemplate(templatePath: string): Promise<{
        template: any;
        metadata: TemplateMetadata;
        variables: TemplateVariable[];
    }>;
    private parseTemplateMetadata;
    processTemplate(templatePath: string, data: TemplateData, options?: TemplateProcessingOptions): Promise<TemplateProcessingResult>;
    private validateTemplateData;
    private validateType;
    private validateRule;
    private convertOutputFormat;
    createTemplate(name: string, content: string, variables: TemplateVariable[], metadata?: Partial<TemplateMetadata>): Promise<string>;
    updateTemplate(templatePath: string, content: string, variables?: TemplateVariable[], metadata?: Partial<TemplateMetadata>): Promise<void>;
    validateTemplateSyntax(templateString: string): Promise<{
        isValid: boolean;
        errors: string[];
        warnings: string[];
    }>;
}
export declare const templateEngine: TemplateEngine;
//# sourceMappingURL=templateEngine.d.ts.map