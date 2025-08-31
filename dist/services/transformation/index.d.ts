export { DataTransformerImplementation } from './DataTransformer';
export interface TransformationService {
    createTransformer(config: TransformerConfig): Promise<DataTransformer>;
    updateTransformer(id: string, config: Partial<TransformerConfig>): Promise<DataTransformer>;
    deleteTransformer(id: string): Promise<void>;
    getTransformers(): Promise<DataTransformer[]>;
    getTransformer(id: string): Promise<DataTransformer | null>;
    transformData(data: any, transformerId: string): Promise<any>;
    validateTransformation(config: TransformerConfig): Promise<ValidationResult>;
    previewTransformation(data: any, config: TransformerConfig): Promise<any>;
}
export interface TransformerConfig {
    name: string;
    description?: string;
    sourceFormat: string;
    targetFormat: string;
    transformation: TransformationRule[];
    isActive?: boolean;
    metadata?: Record<string, any>;
}
export interface TransformationRule {
    id: string;
    type: 'map' | 'transform' | 'calculate' | 'validate' | 'format' | 'filter' | 'aggregate' | 'split' | 'join';
    name: string;
    description?: string;
    config: RuleConfig;
    order: number;
    enabled: boolean;
}
export interface RuleConfig {
    mapping?: Record<string, string>;
    fields?: Record<string, FieldTransformConfig>;
    calculations?: Record<string, CalculationConfig>;
    validation?: ValidationConfig;
    format?: FormatConfig;
    filter?: FilterConfig;
    aggregation?: AggregateConfig;
    split?: SplitConfig;
    join?: JoinConfig;
}
export interface FieldTransformConfig {
    type: 'uppercase' | 'lowercase' | 'trim' | 'date_format' | 'number_format' | 'currency' | 'percentage' | 'boolean' | 'json_parse' | 'json_stringify' | 'base64_encode' | 'base64_decode' | 'hash' | 'encrypt' | 'decrypt' | 'custom';
    format?: string;
    currency?: string;
    decimals?: number;
    algorithm?: string;
    key?: string;
    function?: string;
    parameters?: Record<string, any>;
}
export interface CalculationConfig {
    operation: 'add' | 'subtract' | 'multiply' | 'divide' | 'average' | 'count' | 'concatenate' | 'length' | 'sum' | 'max' | 'min';
    fields: string[];
    constant?: number;
    separator?: string;
}
export interface ValidationConfig {
    field: string;
    type: 'required' | 'type' | 'length' | 'pattern' | 'range' | 'custom';
    expectedType?: string;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
    custom?: Record<string, any>;
}
export interface FormatConfig {
    format: 'date' | 'number' | 'currency' | 'percentage' | 'phone' | 'email' | 'uppercase' | 'lowercase' | 'trim';
    pattern?: string;
    decimals?: number;
    currency?: string;
}
export interface FilterConfig {
    field: string;
    operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'greater_equal' | 'less_equal' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'in' | 'not_in' | 'regex';
    value: any;
}
export interface AggregateConfig {
    field: string;
    operation: 'sum' | 'average' | 'count' | 'min' | 'max' | 'first' | 'last';
    groupBy?: string;
}
export interface SplitConfig {
    field: string;
    separator: string;
    targetField: string;
}
export interface JoinConfig {
    field: string;
    separator: string;
    groupBy?: string;
}
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}
export interface ValidationError {
    field: string;
    message: string;
    rule: string;
    severity: 'error';
}
export interface ValidationWarning {
    field: string;
    message: string;
    rule: string;
    severity: 'warning';
}
import type { DataTransformer } from '../../models/integration';
//# sourceMappingURL=index.d.ts.map