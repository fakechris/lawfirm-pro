import { KnowledgeBaseContent, KnowledgeBaseContentVersion, ContentTemplate } from '../../models/knowledge-base';
export declare class ContentValidationUtils {
    static validateContent(content: Partial<KnowledgeBaseContent>): {
        isValid: boolean;
        errors: string[];
    };
    static isValidContentType(contentType: string): boolean;
    static isValidVisibility(visibility: string): boolean;
    static validateVersion(version: Partial<KnowledgeBaseContentVersion>): {
        isValid: boolean;
        errors: string[];
    };
    static validateTemplate(template: Partial<ContentTemplate>): {
        isValid: boolean;
        errors: string[];
    };
    static validateVariableSchema(schema: any[]): {
        isValid: boolean;
        errors: string[];
    };
    static isValidVariableType(type: string): boolean;
    static validateVariableValidation(validation: any): string[];
    static validateContentSize(content: string, maxSize?: number): {
        isValid: boolean;
        size: number;
        errors: string[];
    };
    static validateTags(tags: string[]): {
        isValid: boolean;
        errors: string[];
    };
    static validateSearchQuery(query: string): {
        isValid: boolean;
        errors: string[];
    };
    static validateCategory(category: string): {
        isValid: boolean;
        errors: string[];
    };
    static validateWorkflowStage(stage: any): {
        isValid: boolean;
        errors: string[];
    };
    static validateTrainingModule(module: any): {
        isValid: boolean;
        errors: string[];
    };
    static validateAssessment(assessment: any): {
        isValid: boolean;
        errors: string[];
    };
}
//# sourceMappingURL=validationUtils.d.ts.map