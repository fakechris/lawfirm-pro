import { 
  DataTransformerService, 
  DataTransformer, 
  TransformationConfig, 
  FieldMapping, 
  NormalizationRule,
  ValidationRule 
} from '../../models/integration';
import { IntegrationLoggerImplementation } from '../integration/logger';

export class DataTransformerImplementation implements DataTransformerService {
  private logger: IntegrationLoggerImplementation;
  private transformers: Map<string, DataTransformer> = new Map();

  constructor() {
    this.logger = new IntegrationLoggerImplementation();
  }

  async transform(source: any, transformer: DataTransformer): Promise<any> {
    try {
      this.logger.info(`Transforming data using ${transformer.name}`, {
        transformerId: transformer.id,
        sourceFormat: transformer.sourceFormat,
        targetFormat: transformer.targetFormat
      });

      let data = Array.isArray(source) ? source : [source];
      
      // Apply transformation rules in order
      for (const rule of transformer.transformation.sort((a, b) => a.order - b.order)) {
        data = await this.applyTransformationRule(data, rule);
      }

      this.logger.info(`Data transformation completed`, {
        transformerId: transformer.id,
        recordsProcessed: data.length
      });

      return Array.isArray(source) ? data : data[0];
      
    } catch (error) {
      this.logger.error(`Data transformation failed`, {
        transformerId: transformer.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async validateSchema(data: any, schema: any): Promise<boolean> {
    try {
      this.logger.info(`Validating data against schema`, {
        schemaType: schema.type || 'unknown'
      });

      const dataToValidate = Array.isArray(data) ? data : [data];
      let isValid = true;

      for (const item of dataToValidate) {
        const itemValid = await this.validateItemAgainstSchema(item, schema);
        if (!itemValid) {
          isValid = false;
          this.logger.warn(`Schema validation failed for item`, {
            item: this.sanitizeData(item)
          });
        }
      }

      return isValid;
      
    } catch (error) {
      this.logger.error(`Schema validation failed`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async mapFields(source: any, fieldMapping: FieldMapping[]): Promise<any> {
    try {
      this.logger.info(`Mapping fields`, {
        sourceFields: Object.keys(source),
        mappingCount: fieldMapping.length
      });

      const result: any = {};
      const sourceData = Array.isArray(source) ? source : [source];
      const results: any[] = [];

      for (const item of sourceData) {
        const mappedItem: any = {};
        
        for (const mapping of fieldMapping) {
          const sourceValue = this.getNestedValue(item, mapping.sourceField);
          
          if (sourceValue !== undefined) {
            if (mapping.transformation) {
              mappedItem[mapping.targetField] = await this.applyFieldTransformation(
                sourceValue, 
                mapping.transformation
              );
            } else {
              mappedItem[mapping.targetField] = sourceValue;
            }
          } else if (mapping.required && mapping.defaultValue !== undefined) {
            mappedItem[mapping.targetField] = mapping.defaultValue;
          } else if (mapping.required) {
            throw new Error(`Required field '${mapping.sourceField}' not found in source data`);
          }
        }
        
        results.push(mappedItem);
      }

      return Array.isArray(source) ? results : results[0];
      
    } catch (error) {
      this.logger.error(`Field mapping failed`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async normalizeData(data: any, rules: NormalizationRule[]): Promise<any> {
    try {
      this.logger.info(`Normalizing data`, {
        rulesCount: rules.length,
        dataFields: Object.keys(Array.isArray(data) ? data[0] || {} : data)
      });

      const dataToNormalize = Array.isArray(data) ? data : [data];
      const normalizedData: any[] = [];

      for (const item of dataToNormalize) {
        const normalizedItem = { ...item };
        
        for (const rule of rules) {
          normalizedItem[rule.field] = await this.applyNormalizationRule(
            normalizedItem[rule.field], 
            rule
          );
        }
        
        normalizedData.push(normalizedItem);
      }

      return Array.isArray(data) ? normalizedData : normalizedData[0];
      
    } catch (error) {
      this.logger.error(`Data normalization failed`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async createTransformation(config: TransformationConfig): Promise<DataTransformer> {
    try {
      const id = this.generateTransformerId();
      const transformer: DataTransformer = {
        id,
        name: config.name || `Transformer ${id}`,
        sourceFormat: config.sourceFormat || 'unknown',
        targetFormat: config.targetFormat || 'unknown',
        transformation: config.transformation || [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.transformers.set(id, transformer);
      
      this.logger.info(`Created transformation`, {
        transformerId: id,
        name: transformer.name
      });

      return transformer;
      
    } catch (error) {
      this.logger.error(`Failed to create transformation`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async updateTransformation(id: string, config: TransformationConfig): Promise<DataTransformer> {
    try {
      const transformer = this.transformers.get(id);
      
      if (!transformer) {
        throw new Error(`Transformer with id ${id} not found`);
      }

      const updatedTransformer: DataTransformer = {
        ...transformer,
        name: config.name || transformer.name,
        sourceFormat: config.sourceFormat || transformer.sourceFormat,
        targetFormat: config.targetFormat || transformer.targetFormat,
        transformation: config.transformation || transformer.transformation,
        isActive: config.isActive !== undefined ? config.isActive : transformer.isActive,
        updatedAt: new Date()
      };

      this.transformers.set(id, updatedTransformer);
      
      this.logger.info(`Updated transformation`, {
        transformerId: id,
        name: updatedTransformer.name
      });

      return updatedTransformer;
      
    } catch (error) {
      this.logger.error(`Failed to update transformation`, {
        transformerId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async deleteTransformation(id: string): Promise<void> {
    try {
      if (!this.transformers.has(id)) {
        throw new Error(`Transformer with id ${id} not found`);
      }

      this.transformers.delete(id);
      
      this.logger.info(`Deleted transformation`, {
        transformerId: id
      });
      
    } catch (error) {
      this.logger.error(`Failed to delete transformation`, {
        transformerId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Private helper methods
  private async applyTransformationRule(data: any[], rule: any): Promise<any[]> {
    try {
      switch (rule.type) {
        case 'map':
          return data.map(item => this.applyFieldMapping(item, rule.config));
        case 'transform':
          return data.map(item => this.applyFieldTransformation(item, rule));
        case 'calculate':
          return data.map(item => this.applyFieldCalculation(item, rule));
        case 'validate':
          return data.filter(item => this.validateField(item, rule.config));
        case 'format':
          return data.map(item => this.applyFieldFormatting(item, rule));
        case 'filter':
          return data.filter(item => this.applyFieldFilter(item, rule));
        case 'aggregate':
          return await this.applyFieldAggregation(data, rule);
        case 'split':
          return this.applyFieldSplit(data, rule);
        case 'join':
          return this.applyFieldJoin(data, rule);
        default:
          this.logger.warn(`Unknown transformation rule type: ${rule.type}`);
          return data;
      }
    } catch (error) {
      this.logger.error(`Failed to apply transformation rule`, {
        ruleType: rule.type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private applyFieldMapping(item: any, config: any): any {
    const mapped = { ...item };
    
    if (config.mapping) {
      for (const [sourceField, targetField] of Object.entries(config.mapping)) {
        if (mapped[sourceField] !== undefined) {
          mapped[targetField as string] = mapped[sourceField];
          delete mapped[sourceField];
        }
      }
    }
    
    return mapped;
  }

  private async applyFieldTransformation(item: any, rule: any): Promise<any> {
    const transformed = { ...item };
    
    for (const [field, config] of Object.entries(rule.config.fields || {})) {
      if (transformed[field] !== undefined) {
        transformed[field] = await this.transformValue(transformed[field], config);
      }
    }
    
    return transformed;
  }

  private async transformValue(value: any, config: any): Promise<any> {
    if (value === null || value === undefined) {
      return value;
    }

    switch (config.type) {
      case 'uppercase':
        return String(value).toUpperCase();
      case 'lowercase':
        return String(value).toLowerCase();
      case 'trim':
        return String(value).trim();
      case 'date_format':
        return this.formatDate(value, config.format);
      case 'number_format':
        return this.formatNumber(value, config.format);
      case 'currency':
        return this.formatCurrency(value, config.currency);
      case 'percentage':
        return this.formatPercentage(value, config.decimals);
      case 'boolean':
        return this.parseBoolean(value);
      case 'json_parse':
        return JSON.parse(String(value));
      case 'json_stringify':
        return JSON.stringify(value);
      case 'base64_encode':
        return Buffer.from(String(value)).toString('base64');
      case 'base64_decode':
        return Buffer.from(String(value), 'base64').toString();
      case 'hash':
        return this.hashValue(value, config.algorithm);
      case 'encrypt':
        return this.encryptValue(value, config.key);
      case 'decrypt':
        return this.decryptValue(value, config.key);
      case 'custom':
        return await this.applyCustomTransformation(value, config);
      default:
        return value;
    }
  }

  private applyFieldCalculation(item: any, rule: any): any {
    const calculated = { ...item };
    
    for (const [targetField, config] of Object.entries(rule.config.calculations || {})) {
      try {
        calculated[targetField] = this.calculateValue(item, config);
      } catch (error) {
        this.logger.error(`Field calculation failed`, {
          field: targetField,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        calculated[targetField] = null;
      }
    }
    
    return calculated;
  }

  private calculateValue(item: any, config: any): any {
    const { operation, fields, constant } = config;
    
    switch (operation) {
      case 'add':
        return fields.reduce((sum: number, field: string) => sum + (Number(item[field]) || 0), 0);
      case 'subtract':
        return fields.reduce((result: number, field: string, index: number) => 
          index === 0 ? (Number(item[field]) || 0) : result - (Number(item[field]) || 0), 0);
      case 'multiply':
        return fields.reduce((product: number, field: string) => product * (Number(item[field]) || 1), 1);
      case 'divide':
        return fields.reduce((result: number, field: string, index: number) => 
          index === 0 ? (Number(item[field]) || 1) : result / (Number(item[field]) || 1), 1);
      case 'average':
        const values = fields.map(field => Number(item[field]) || 0);
        return values.reduce((sum, val) => sum + val, 0) / values.length;
      case 'count':
        return fields.filter(field => item[field] !== undefined && item[field] !== null).length;
      case 'concatenate':
        return fields.map(field => String(item[field] || '')).join(config.separator || '');
      case 'length':
        return String(item[fields[0]] || '').length;
      case 'sum':
        return fields.reduce((sum: number, field: string) => sum + (Number(item[field]) || 0), constant || 0);
      case 'max':
        return Math.max(...fields.map(field => Number(item[field]) || 0));
      case 'min':
        return Math.min(...fields.map(field => Number(item[field]) || 0));
      default:
        return null;
    }
  }

  private validateField(item: any, config: ValidationRule): boolean {
    try {
      const value = item[config.config.field];
      
      switch (config.type) {
        case 'required':
          return value !== undefined && value !== null && value !== '';
        case 'type':
          return typeof value === config.config.expectedType;
        case 'length':
          const str = String(value);
          return str.length >= config.config.minLength && str.length <= config.config.maxLength;
        case 'pattern':
          const pattern = new RegExp(config.config.pattern);
          return pattern.test(String(value));
        case 'range':
          const num = Number(value);
          return num >= config.config.min && num <= config.config.max;
        case 'custom':
          return this.applyCustomValidation(value, config.config);
        default:
          return true;
      }
    } catch (error) {
      return false;
    }
  }

  private applyFieldFormatting(item: any, rule: any): any {
    const formatted = { ...item };
    
    for (const [field, config] of Object.entries(rule.config.fields || {})) {
      if (formatted[field] !== undefined) {
        formatted[field] = this.formatValue(formatted[field], config);
      }
    }
    
    return formatted;
  }

  private formatValue(value: any, config: any): any {
    switch (config.format) {
      case 'date':
        return this.formatDate(value, config.pattern);
      case 'number':
        return this.formatNumber(value, config.decimals);
      case 'currency':
        return this.formatCurrency(value, config.currency, config.decimals);
      case 'percentage':
        return this.formatPercentage(value, config.decimals);
      case 'phone':
        return this.formatPhone(value);
      case 'email':
        return this.formatEmail(value);
      case 'uppercase':
        return String(value).toUpperCase();
      case 'lowercase':
        return String(value).toLowerCase();
      case 'trim':
        return String(value).trim();
      default:
        return value;
    }
  }

  private applyFieldFilter(item: any, rule: any): boolean {
    try {
      const { field, operator, value } = rule.config;
      const itemValue = item[field];
      
      switch (operator) {
        case 'equals':
          return itemValue === value;
        case 'not_equals':
          return itemValue !== value;
        case 'greater_than':
          return Number(itemValue) > Number(value);
        case 'less_than':
          return Number(itemValue) < Number(value);
        case 'greater_equal':
          return Number(itemValue) >= Number(value);
        case 'less_equal':
          return Number(itemValue) <= Number(value);
        case 'contains':
          return String(itemValue).includes(String(value));
        case 'not_contains':
          return !String(itemValue).includes(String(value));
        case 'starts_with':
          return String(itemValue).startsWith(String(value));
        case 'ends_with':
          return String(itemValue).endsWith(String(value));
        case 'in':
          return Array.isArray(value) && value.includes(itemValue);
        case 'not_in':
          return Array.isArray(value) && !value.includes(itemValue);
        case 'regex':
          return new RegExp(value).test(String(itemValue));
        default:
          return true;
      }
    } catch (error) {
      return false;
    }
  }

  private async applyFieldAggregation(data: any[], rule: any): Promise<any[]> {
    const { field, operation, groupBy } = rule.config;
    
    if (groupBy) {
      // Group by specified field
      const groups = new Map();
      
      for (const item of data) {
        const groupKey = item[groupBy];
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey).push(item);
      }
      
      const result = [];
      for (const [groupKey, groupData] of groups.entries()) {
        const aggregated = this.aggregateGroup(groupData, field, operation);
        result.push({
          [groupBy]: groupKey,
          [field]: aggregated
        });
      }
      
      return result;
    } else {
      // Aggregate all data
      const aggregated = this.aggregateGroup(data, field, operation);
      return [{ [field]: aggregated }];
    }
  }

  private aggregateGroup(groupData: any[], field: string, operation: string): any {
    const values = groupData.map(item => Number(item[field])).filter(v => !isNaN(v));
    
    switch (operation) {
      case 'sum':
        return values.reduce((sum, val) => sum + val, 0);
      case 'average':
        return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
      case 'count':
        return values.length;
      case 'min':
        return values.length > 0 ? Math.min(...values) : null;
      case 'max':
        return values.length > 0 ? Math.max(...values) : null;
      case 'first':
        return groupData[0]?.[field];
      case 'last':
        return groupData[groupData.length - 1]?.[field];
      default:
        return null;
    }
  }

  private applyFieldSplit(data: any[], rule: any): any[] {
    const { field, separator, targetField } = rule.config;
    const result = [];
    
    for (const item of data) {
      const value = String(item[field] || '');
      const parts = value.split(separator);
      
      for (const part of parts) {
        const newItem = { ...item };
        newItem[targetField] = part.trim();
        result.push(newItem);
      }
    }
    
    return result;
  }

  private applyFieldJoin(data: any[], rule: any): any[] {
    const { field, separator, groupBy } = rule.config;
    
    if (groupBy) {
      const groups = new Map();
      
      for (const item of data) {
        const groupKey = item[groupBy];
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey).push(item);
      }
      
      const result = [];
      for (const [groupKey, groupData] of groups.entries()) {
        const joined = groupData.map(item => String(item[field] || '')).join(separator);
        result.push({
          [groupBy]: groupKey,
          [field]: joined
        });
      }
      
      return result;
    } else {
      const joined = data.map(item => String(item[field] || '')).join(separator);
      return [{ [field]: joined }];
    }
  }

  private async applyNormalizationRule(value: any, rule: NormalizationRule): Promise<any> {
    if (value === null || value === undefined) {
      return value;
    }

    switch (rule.type) {
      case 'uppercase':
        return String(value).toUpperCase();
      case 'lowercase':
        return String(value).toLowerCase();
      case 'trim':
        return String(value).trim();
      case 'normalize_whitespace':
        return String(value).replace(/\s+/g, ' ').trim();
      case 'remove_special_chars':
        return String(value).replace(/[^\w\s]/g, '');
      case 'custom':
        return await this.applyCustomNormalization(value, rule.config);
      default:
        return value;
    }
  }

  private async applyCustomTransformation(value: any, config: any): Promise<any> {
    // Placeholder for custom transformation logic
    // In a real implementation, this would execute custom functions
    return value;
  }

  private applyCustomValidation(value: any, config: any): boolean {
    // Placeholder for custom validation logic
    // In a real implementation, this would execute custom validation functions
    return true;
  }

  private async applyCustomNormalization(value: any, config: any): Promise<any> {
    // Placeholder for custom normalization logic
    // In a real implementation, this would execute custom normalization functions
    return value;
  }

  private async validateItemAgainstSchema(item: any, schema: any): Promise<boolean> {
    // Simplified schema validation
    // In a real implementation, this would use a proper schema validator
    
    if (schema.required) {
      for (const field of schema.required) {
        if (item[field] === undefined || item[field] === null) {
          return false;
        }
      }
    }
    
    if (schema.properties) {
      for (const [field, fieldSchema] of Object.entries(schema.properties)) {
        if (item[field] !== undefined) {
          const fieldType = typeof item[field];
          const expectedType = fieldSchema.type;
          
          if (fieldType !== expectedType) {
            return false;
          }
        }
      }
    }
    
    return true;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private formatDate(date: any, format: string): string {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    
    // Simple date formatting - in production, use a proper date library
    return d.toISOString().split('T')[0]; // Default to YYYY-MM-DD
  }

  private formatNumber(value: any, decimals: number = 2): string {
    const num = Number(value);
    return isNaN(num) ? String(value) : num.toFixed(decimals);
  }

  private formatCurrency(value: any, currency: string = 'USD', decimals: number = 2): string {
    const num = Number(value);
    return isNaN(num) ? String(value) : `${currency} ${num.toFixed(decimals)}`;
  }

  private formatPercentage(value: any, decimals: number = 2): string {
    const num = Number(value);
    return isNaN(num) ? String(value) : `${num.toFixed(decimals)}%`;
  }

  private formatPhone(phone: string): string {
    // Simple phone formatting
    const cleaned = String(phone).replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  }

  private formatEmail(email: string): string {
    return String(email).toLowerCase().trim();
  }

  private parseBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    const str = String(value).toLowerCase();
    return str === 'true' || str === '1' || str === 'yes' || str === 'on';
  }

  private hashValue(value: any, algorithm: string = 'sha256'): string {
    // Simple hash placeholder
    return `hashed_${algorithm}_${value}`;
  }

  private encryptValue(value: any, key: string): string {
    // Simple encryption placeholder
    return `encrypted_${key}_${value}`;
  }

  private decryptValue(value: any, key: string): string {
    // Simple decryption placeholder
    return String(value).replace(`encrypted_${key}_`, '');
  }

  private sanitizeData(data: any): any {
    // Remove sensitive data for logging
    if (typeof data !== 'object' || data === null) return data;
    
    const sanitized = { ...data };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'api_key'];
    
    for (const [key, value] of Object.entries(sanitized)) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '***REDACTED***';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeData(value);
      }
    }
    
    return sanitized;
  }

  private generateTransformerId(): string {
    return `transformer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}