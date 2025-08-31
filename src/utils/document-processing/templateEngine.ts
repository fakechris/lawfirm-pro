import fs from 'fs/promises';
import path from 'path';
import Handlebars from 'handlebars';
import { storageService } from '../storage';
import { documentProcessor } from './documentProcessor';
import { v4 as uuidv4 } from 'uuid';

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

export class TemplateEngine {
  private customHelpers: Record<string, Function> = {};
  private templates: Map<string, any> = new Map();

  constructor() {
    this.registerDefaultHelpers();
  }

  private registerDefaultHelpers(): void {
    // Date formatting helper
    Handlebars.registerHelper('formatDate', (date: Date, format: string = 'YYYY-MM-DD') => {
      if (!date) return '';
      const d = new Date(date);
      if (isNaN(d.getTime())) return '';
      
      return format
        .replace('YYYY', d.getFullYear().toString())
        .replace('MM', (d.getMonth() + 1).toString().padStart(2, '0'))
        .replace('DD', d.getDate().toString().padStart(2, '0'))
        .replace('HH', d.getHours().toString().padStart(2, '0'))
        .replace('mm', d.getMinutes().toString().padStart(2, '0'))
        .replace('ss', d.getSeconds().toString().padStart(2, '0'));
    });

    // Currency formatting helper
    Handlebars.registerHelper('formatCurrency', (amount: number, currency: string = 'CNY') => {
      if (typeof amount !== 'number') return amount;
      return new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: currency,
      }).format(amount);
    });

    // Number formatting helper
    Handlebars.registerHelper('formatNumber', (number: number, decimals: number = 2) => {
      if (typeof number !== 'number') return number;
      return number.toFixed(decimals);
    });

    // Uppercase helper
    Handlebars.registerHelper('uppercase', (str: string) => {
      return str ? str.toUpperCase() : '';
    });

    // Lowercase helper
    Handlebars.registerHelper('lowercase', (str: string) => {
      return str ? str.toLowerCase() : '';
    });

    // Default value helper
    Handlebars.registerHelper('default', (value: any, defaultValue: any) => {
      return value !== undefined && value !== null && value !== '' ? value : defaultValue;
    });

    // Conditional helpers
    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    Handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
    Handlebars.registerHelper('gt', (a: number, b: number) => a > b);
    Handlebars.registerHelper('lt', (a: number, b: number) => a < b);
    Handlebars.registerHelper('gte', (a: number, b: number) => a >= b);
    Handlebars.registerHelper('lte', (a: number, b: number) => a <= b);

    // Array helpers
    Handlebars.registerHelper('length', (array: any[]) => array ? array.length : 0);
    Handlebars.registerHelper('join', (array: any[], separator: string = ', ') => {
      return array ? array.join(separator) : '';
    });

    // JSON helper
    Handlebars.registerHelper('json', (obj: any, indent: number = 2) => {
      return JSON.stringify(obj, null, indent);
    });

    // Chinese legal document specific helpers
    Handlebars.registerHelper('chineseNumber', (num: number) => {
      const chineseNumbers = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
      const chineseUnits = ['', '十', '百', '千', '万'];
      
      if (num === 0) return chineseNumbers[0];
      if (num < 10) return chineseNumbers[num];
      
      let result = '';
      const numStr = num.toString();
      
      for (let i = 0; i < numStr.length; i++) {
        const digit = parseInt(numStr[i]);
        const unit = chineseUnits[numStr.length - 1 - i];
        
        if (digit !== 0) {
          result += chineseNumbers[digit] + unit;
        }
      }
      
      return result;
    });

    // Legal document helpers
    Handlebars.registerHelper('formatCaseNumber', (caseNumber: string) => {
      if (!caseNumber) return '';
      // Format case number according to Chinese legal standards
      return caseNumber.replace(/(\d{4})/, '($1)');
    });

    Handlebars.registerHelper('formatCourtName', (courtName: string) => {
      if (!courtName) return '';
      // Standardize court name format
      return courtName.replace(/法院$/, '人民法院');
    });
  }

  registerCustomHelper(name: string, helper: Function): void {
    this.customHelpers[name] = helper;
    Handlebars.registerHelper(name, helper);
  }

  async loadTemplate(templatePath: string): Promise<{
    template: any;
    metadata: TemplateMetadata;
    variables: TemplateVariable[];
  }> {
    try {
      const templateContent = await storageService.getFile(templatePath);
      const templateString = templateContent.toString('utf8');
      
      // Parse template metadata and variables
      const { metadata, variables } = this.parseTemplateMetadata(templateString);
      
      // Compile template
      const template = Handlebars.compile(templateString);
      
      return {
        template,
        metadata,
        variables,
      };
    } catch (error) {
      console.error(`Failed to load template ${templatePath}:`, error);
      throw new Error(`Template loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseTemplateMetadata(templateString: string): {
    metadata: TemplateMetadata;
    variables: TemplateVariable[];
  } {
    const metadata: TemplateMetadata = {
      name: 'Unknown Template',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
    };

    const variables: TemplateVariable[] = [];

    // Parse metadata comments
    const metadataMatch = templateString.match(/{{!--\s*METADATA\s*([\s\S]*?)\s*--}}/);
    if (metadataMatch) {
      try {
        const metadataJson = JSON.parse(metadataMatch[1]);
        Object.assign(metadata, metadataJson);
      } catch (error) {
        console.warn('Failed to parse template metadata:', error);
      }
    }

    // Parse variable definitions
    const variableMatches = templateString.match(/{{!--\s*VARIABLE\s+(\w+)\s*([\s\S]*?)\s*--}}/g);
    if (variableMatches) {
      for (const match of variableMatches) {
        try {
          const variableMatch = match.match(/{{!--\s*VARIABLE\s+(\w+)\s*([\s\S]*?)\s*--}}/);
          if (variableMatch) {
            const [, name, config] = variableMatch;
            const configJson = JSON.parse(config);
            variables.push({
              name,
              ...configJson,
            });
          }
        } catch (error) {
          console.warn(`Failed to parse variable definition: ${match}`, error);
        }
      }
    }

    return { metadata, variables };
  }

  async processTemplate(
    templatePath: string,
    data: TemplateData,
    options: TemplateProcessingOptions = {}
  ): Promise<TemplateProcessingResult> {
    const startTime = Date.now();
    const defaultOptions: TemplateProcessingOptions = {
      validateVariables: true,
      strictMode: true,
      includeMetadata: true,
      outputFormat: 'html',
    };

    const finalOptions = { ...defaultOptions, ...options };
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Load template
      const { template, metadata, variables } = await this.loadTemplate(templatePath);

      // Validate data if required
      if (finalOptions.validateVariables) {
        const validation = this.validateTemplateData(data, variables);
        errors.push(...validation.errors);
        warnings.push(...validation.warnings);
      }

      // Register custom helpers
      if (finalOptions.customHelpers) {
        for (const [name, helper] of Object.entries(finalOptions.customHelpers)) {
          this.registerCustomHelper(name, helper);
        }
      }

      // Process template
      let content: string;
      try {
        content = template(data);
      } catch (error) {
        if (finalOptions.strictMode) {
          throw new Error(`Template processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } else {
          content = `Template processing error: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(`Template processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Convert to requested format
      if (finalOptions.outputFormat !== 'html') {
        content = await this.convertOutputFormat(content, finalOptions.outputFormat);
      }

      const processingTime = Date.now() - startTime;

      return {
        content,
        metadata,
        variables,
        errors,
        warnings,
        processingTime,
      };
    } catch (error) {
      console.error(`Template processing failed for ${templatePath}:`, error);
      throw new Error(`Template processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private validateTemplateData(data: TemplateData, variables: TemplateVariable[]): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const variable of variables) {
      const value = data[variable.name];

      // Check required variables
      if (variable.required && (value === undefined || value === null || value === '')) {
        errors.push(`Required variable '${variable.name}' is missing or empty`);
        continue;
      }

      // Skip validation if variable is not provided and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      if (!this.validateType(value, variable.type)) {
        errors.push(`Variable '${variable.name}' should be of type ${variable.type}, got ${typeof value}`);
      }

      // Validation rules
      if (variable.validation) {
        for (const rule of variable.validation) {
          const validationResult = this.validateRule(value, rule);
          if (!validationResult.isValid) {
            errors.push(`Variable '${variable.name}' validation failed: ${validationResult.message}`);
          }
        }
      }

      // Enum validation
      if (variable.options && !variable.options.includes(value)) {
        errors.push(`Variable '${variable.name}' must be one of: ${variable.options.join(', ')}`);
      }
    }

    // Check for extra variables
    const variableNames = new Set(variables.map(v => v.name));
    for (const key in data) {
      if (!variableNames.has(key)) {
        warnings.push(`Extra variable '${key}' provided but not defined in template`);
      }
    }

    return { errors, warnings };
  }

  private validateType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'date':
        return value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }

  private validateRule(value: any, rule: ValidationRule): {
    isValid: boolean;
    message: string;
  } {
    switch (rule.type) {
      case 'min':
        if (typeof value === 'number' && value < rule.value) {
          return { isValid: false, message: rule.message || `Value must be at least ${rule.value}` };
        }
        if (typeof value === 'string' && value.length < rule.value) {
          return { isValid: false, message: rule.message || `Length must be at least ${rule.value}` };
        }
        break;
      case 'max':
        if (typeof value === 'number' && value > rule.value) {
          return { isValid: false, message: rule.message || `Value must be at most ${rule.value}` };
        }
        if (typeof value === 'string' && value.length > rule.value) {
          return { isValid: false, message: rule.message || `Length must be at most ${rule.value}` };
        }
        break;
      case 'pattern':
        if (typeof value === 'string' && !new RegExp(rule.value).test(value)) {
          return { isValid: false, message: rule.message || `Value does not match required pattern` };
        }
        break;
      case 'required':
        if (value === undefined || value === null || value === '') {
          return { isValid: false, message: rule.message || `Value is required` };
        }
        break;
      case 'enum':
        if (!rule.value.includes(value)) {
          return { isValid: false, message: rule.message || `Value must be one of: ${rule.value.join(', ')}` };
        }
        break;
    }
    return { isValid: true, message: '' };
  }

  private async convertOutputFormat(content: string, format: string): Promise<string> {
    switch (format) {
      case 'txt':
        // Simple HTML to text conversion
        return content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      
      case 'pdf':
        // Convert to PDF (simplified implementation)
        try {
          const { PDFDocument } = await import('pdf-lib');
          const pdfDoc = await PDFDocument.create();
          const page = pdfDoc.addPage();
          
          // Add text to PDF
          const text = content.replace(/<[^>]*>/g, '');
          const { width, height } = page.getSize();
          page.drawText(text.substring(0, 1000), {
            x: 50,
            y: height - 50,
            size: 12,
          });
          
          const pdfBytes = await pdfDoc.save();
          return pdfBytes.toString('base64');
        } catch (error) {
          console.warn('PDF conversion failed, returning HTML:', error);
          return content;
        }
      
      case 'docx':
        // Convert to DOCX (simplified implementation)
        // In a real implementation, you would use a library like docx
        return content;
      
      default:
        return content;
    }
  }

  async createTemplate(
    name: string,
    content: string,
    variables: TemplateVariable[],
    metadata: Partial<TemplateMetadata> = {}
  ): Promise<string> {
    const templateId = uuidv4();
    const templateMetadata: TemplateMetadata = {
      name,
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      ...metadata,
    };

    // Add metadata and variable definitions to template content
    const metadataComment = `{{!-- METADATA ${JSON.stringify(templateMetadata)} --}}`;
    const variableComments = variables.map(v => 
      `{{!-- VARIABLE ${v.name} ${JSON.stringify({
        type: v.type,
        description: v.description,
        required: v.required,
        defaultValue: v.defaultValue,
        validation: v.validation,
        options: v.options,
      })} --}}`
    ).join('\n');

    const finalContent = `${metadataComment}\n${variableComments}\n${content}`;

    // Save template
    const { filePath } = await storageService.saveFile(
      Buffer.from(finalContent, 'utf8'),
      `${name}.hbs`,
      {
        category: 'templates',
        subcategory: 'active',
      }
    );

    return filePath;
  }

  async updateTemplate(
    templatePath: string,
    content: string,
    variables?: TemplateVariable[],
    metadata?: Partial<TemplateMetadata>
  ): Promise<void> {
    const { template: existingTemplate, metadata: existingMetadata, variables: existingVariables } = 
      await this.loadTemplate(templatePath);

    const updatedMetadata = {
      ...existingMetadata,
      ...metadata,
      updatedAt: new Date(),
    };

    const updatedVariables = variables || existingVariables;

    // Recreate template with updates
    const metadataComment = `{{!-- METADATA ${JSON.stringify(updatedMetadata)} --}}`;
    const variableComments = updatedVariables.map(v => 
      `{{!-- VARIABLE ${v.name} ${JSON.stringify({
        type: v.type,
        description: v.description,
        required: v.required,
        defaultValue: v.defaultValue,
        validation: v.validation,
        options: v.options,
      })} --}}`
    ).join('\n');

    const finalContent = `${metadataComment}\n${variableComments}\n${content}`;

    await storageService.saveFile(
      Buffer.from(finalContent, 'utf8'),
      path.basename(templatePath),
      {
        category: 'templates',
        subcategory: 'active',
      }
    );
  }

  async validateTemplateSyntax(templateString: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Try to compile the template
      const template = Handlebars.compile(templateString);
      
      // Test with empty data
      template({});
      
      return { isValid: true, errors, warnings };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Template syntax error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings,
      };
    }
  }
}

export const templateEngine = new TemplateEngine();