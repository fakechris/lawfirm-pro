import { templateEngine, TemplateData, TemplateProcessingOptions, TemplateVariable } from '../../../src/utils/document-processing/templateEngine';
import { storageService } from '../../../src/utils/storage';
import Handlebars from 'handlebars';

// Mock storage service
jest.mock('../../../src/utils/storage');

describe('TemplateEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset custom helpers
    (templateEngine as any).customHelpers = {};
    Handlebars.helpers = {};
    // Re-register default helpers
    (templateEngine as any).registerDefaultHelpers();
  });

  describe('processTemplate', () => {
    it('should process a simple template with basic variables', async () => {
      const templateContent = `
        {{!-- METADATA {"name": "Test Template", "version": "1.0.0"} --}}
        {{!-- VARIABLE name {"type": "string", "description": "Name field", "required": true} --}}
        Hello {{name}}!
      `;

      const mockBuffer = Buffer.from(templateContent);
      (storageService.getFile as jest.Mock).mockResolvedValue(mockBuffer);

      const data: TemplateData = { name: 'John Doe' };
      const options: TemplateProcessingOptions = {};

      const result = await templateEngine.processTemplate('/test/template.hbs', data, options);

      expect(result.content).toContain('Hello John Doe!');
      expect(result.metadata.name).toBe('Test Template');
      expect(result.metadata.version).toBe('1.0.0');
      expect(result.variables).toHaveLength(1);
      expect(result.variables[0].name).toBe('name');
      expect(result.errors).toHaveLength(0);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should process template with conditional blocks', async () => {
      const templateContent = `
        {{!-- METADATA {"name": "Conditional Template"} --}}
        {{#if isAdmin}}
          Admin Content
        {{else}}
          User Content
        {{/if}}
      `;

      const mockBuffer = Buffer.from(templateContent);
      (storageService.getFile as jest.Mock).mockResolvedValue(mockBuffer);

      // Test with admin user
      let result = await templateEngine.processTemplate('/test/template.hbs', { isAdmin: true });
      expect(result.content).toContain('Admin Content');

      // Test with regular user
      result = await templateEngine.processTemplate('/test/template.hbs', { isAdmin: false });
      expect(result.content).toContain('User Content');
    });

    it('should process template with loops', async () => {
      const templateContent = `
        {{!-- METADATA {"name": "Loop Template"} --}}
        {{#each items}}
          {{@index}}. {{this}}
        {{/each}}
      `;

      const mockBuffer = Buffer.from(templateContent);
      (storageService.getFile as jest.Mock).mockResolvedValue(mockBuffer);

      const data: TemplateData = {
        items: ['Item 1', 'Item 2', 'Item 3'],
      };

      const result = await templateEngine.processTemplate('/test/template.hbs', data);

      expect(result.content).toContain('0. Item 1');
      expect(result.content).toContain('1. Item 2');
      expect(result.content).toContain('2. Item 3');
    });

    it('should use custom helpers', async () => {
      const templateContent = `
        {{!-- METADATA {"name": "Custom Helper Template"} --}}
        {{formatDate currentDate "YYYY-MM-DD"}}
      `;

      const mockBuffer = Buffer.from(templateContent);
      (storageService.getFile as jest.Mock).mockResolvedValue(mockBuffer);

      const data: TemplateData = {
        currentDate: new Date('2023-12-25'),
      };

      const result = await templateEngine.processTemplate('/test/template.hbs', data);

      expect(result.content).toContain('2023-12-25');
    });

    it('should handle template processing errors in strict mode', async () => {
      const templateContent = `
        {{!-- METADATA {"name": "Error Template"} --}}
        {{undefinedVariable}}
      `;

      const mockBuffer = Buffer.from(templateContent);
      (storageService.getFile as jest.Mock).mockResolvedValue(mockBuffer);

      const data: TemplateData = {};
      const options: TemplateProcessingOptions = {
        strictMode: true,
      };

      await expect(templateEngine.processTemplate('/test/template.hbs', data, options))
        .rejects.toThrow('Template processing failed');
    });

    it('should handle template processing errors in non-strict mode', async () => {
      const templateContent = `
        {{!-- METADATA {"name": "Error Template"} --}}
        {{undefinedVariable}}
      `;

      const mockBuffer = Buffer.from(templateContent);
      (storageService.getFile as jest.Mock).mockResolvedValue(mockBuffer);

      const data: TemplateData = {};
      const options: TemplateProcessingOptions = {
        strictMode: false,
      };

      const result = await templateEngine.processTemplate('/test/template.hbs', data, options);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Template processing error');
    });
  });

  describe('validateTemplateData', () => {
    it('should validate required variables', () => {
      const variables: TemplateVariable[] = [
        {
          name: 'name',
          type: 'string',
          description: 'Name field',
          required: true,
        },
        {
          name: 'age',
          type: 'number',
          description: 'Age field',
          required: false,
        },
      ];

      const data: TemplateData = { name: 'John', age: 30 };
      const result = (templateEngine as any).validateTemplateData(data, variables);

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect missing required variables', () => {
      const variables: TemplateVariable[] = [
        {
          name: 'name',
          type: 'string',
          description: 'Name field',
          required: true,
        },
      ];

      const data: TemplateData = {};
      const result = (templateEngine as any).validateTemplateData(data, variables);

      expect(result.errors).toContain("Required variable 'name' is missing or empty");
    });

    it('should validate variable types', () => {
      const variables: TemplateVariable[] = [
        {
          name: 'age',
          type: 'number',
          description: 'Age field',
          required: true,
        },
      ];

      const data: TemplateData = { age: 'not a number' };
      const result = (templateEngine as any).validateTemplateData(data, variables);

      expect(result.errors).toContain("Variable 'age' should be of type number, got string");
    });

    it('should validate enum options', () => {
      const variables: TemplateVariable[] = [
        {
          name: 'status',
          type: 'string',
          description: 'Status field',
          required: true,
          options: ['active', 'inactive', 'pending'],
        },
      ];

      const data: TemplateData = { status: 'invalid' };
      const result = (templateEngine as any).validateTemplateData(data, variables);

      expect(result.errors).toContain("Variable 'status' must be one of: active, inactive, pending");
    });

    it('should warn about extra variables', () => {
      const variables: TemplateVariable[] = [
        {
          name: 'name',
          type: 'string',
          description: 'Name field',
          required: true,
        },
      ];

      const data: TemplateData = { name: 'John', extraVar: 'value' };
      const result = (templateEngine as any).validateTemplateData(data, variables);

      expect(result.warnings).toContain("Extra variable 'extraVar' provided but not defined in template");
    });

    it('should apply validation rules', () => {
      const variables: TemplateVariable[] = [
        {
          name: 'name',
          type: 'string',
          description: 'Name field',
          required: true,
          validation: [
            { type: 'min', value: 2, message: 'Name must be at least 2 characters' },
            { type: 'max', value: 50, message: 'Name must be at most 50 characters' },
          ],
        },
      ];

      const data: TemplateData = { name: 'A' };
      const result = (templateEngine as any).validateTemplateData(data, variables);

      expect(result.errors).toContain('Variable \'name\' validation failed: Name must be at least 2 characters');
    });
  });

  describe('parseTemplateMetadata', () => {
    it('should parse metadata from template comments', () => {
      const templateContent = `
        {{!-- METADATA {"name": "Test Template", "version": "1.0.0", "author": "Test Author"} --}}
        {{!-- VARIABLE name {"type": "string", "description": "Name field", "required": true} --}}
        Template content
      `;

      const result = (templateEngine as any).parseTemplateMetadata(templateContent);

      expect(result.metadata.name).toBe('Test Template');
      expect(result.metadata.version).toBe('1.0.0');
      expect(result.metadata.author).toBe('Test Author');
      expect(result.variables).toHaveLength(1);
      expect(result.variables[0].name).toBe('name');
    });

    it('should handle templates without metadata', () => {
      const templateContent = 'Template content without metadata';

      const result = (templateEngine as any).parseTemplateMetadata(templateContent);

      expect(result.metadata.name).toBe('Unknown Template');
      expect(result.metadata.version).toBe('1.0.0');
      expect(result.variables).toHaveLength(0);
    });
  });

  describe('registerCustomHelper', () => {
    it('should register and use custom helper', async () => {
      const templateContent = '{{customHelper "test"}}';
      const mockBuffer = Buffer.from(templateContent);
      (storageService.getFile as jest.Mock).mockResolvedValue(mockBuffer);

      // Register custom helper
      const customHelper = jest.fn().mockReturnValue('Custom Result');
      templateEngine.registerCustomHelper('customHelper', customHelper);

      const result = await templateEngine.processTemplate('/test/template.hbs', {});

      expect(result.content).toBe('Custom Result');
      expect(customHelper).toHaveBeenCalledWith('test');
    });
  });

  describe('createTemplate', () => {
    it('should create a new template with metadata', async () => {
      const content = 'Hello {{name}}!';
      const variables: TemplateVariable[] = [
        {
          name: 'name',
          type: 'string',
          description: 'Name field',
          required: true,
        },
      ];

      const mockFilePath = '/templates/test.hbs';
      (storageService.saveFile as jest.Mock).mockResolvedValue({
        filePath: mockFilePath,
        filename: 'test.hbs',
        size: 100,
      });

      const result = await templateEngine.createTemplate('Test Template', content, variables);

      expect(result).toBe(mockFilePath);
      expect(storageService.saveFile).toHaveBeenCalledWith(
        expect.any(Buffer),
        'test.hbs',
        {
          category: 'templates',
          subcategory: 'active',
        }
      );

      // Check that the saved content includes metadata and variable definitions
      const savedContent = (storageService.saveFile as jest.Mock).mock.calls[0][0].toString();
      expect(savedContent).toContain('{{!-- METADATA');
      expect(savedContent).toContain('{{!-- VARIABLE name');
      expect(savedContent).toContain('Hello {{name}}!');
    });
  });

  describe('validateTemplateSyntax', () => {
    it('should validate correct template syntax', async () => {
      const templateContent = 'Hello {{name}}!';
      const result = await templateEngine.validateTemplateSyntax(templateContent);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect syntax errors', async () => {
      const templateContent = 'Hello {{name}!'; // Missing closing brace
      const result = await templateEngine.validateTemplateSyntax(templateContent);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Template syntax error');
    });
  });
});