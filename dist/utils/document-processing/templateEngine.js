"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.templateEngine = exports.TemplateEngine = void 0;
const path_1 = __importDefault(require("path"));
const handlebars_1 = __importDefault(require("handlebars"));
const storage_1 = require("../storage");
const uuid_1 = require("uuid");
class TemplateEngine {
    constructor() {
        this.customHelpers = {};
        this.templates = new Map();
        this.registerDefaultHelpers();
    }
    registerDefaultHelpers() {
        handlebars_1.default.registerHelper('formatDate', (date, format = 'YYYY-MM-DD') => {
            if (!date)
                return '';
            const d = new Date(date);
            if (isNaN(d.getTime()))
                return '';
            return format
                .replace('YYYY', d.getFullYear().toString())
                .replace('MM', (d.getMonth() + 1).toString().padStart(2, '0'))
                .replace('DD', d.getDate().toString().padStart(2, '0'))
                .replace('HH', d.getHours().toString().padStart(2, '0'))
                .replace('mm', d.getMinutes().toString().padStart(2, '0'))
                .replace('ss', d.getSeconds().toString().padStart(2, '0'));
        });
        handlebars_1.default.registerHelper('formatCurrency', (amount, currency = 'CNY') => {
            if (typeof amount !== 'number')
                return amount;
            return new Intl.NumberFormat('zh-CN', {
                style: 'currency',
                currency: currency,
            }).format(amount);
        });
        handlebars_1.default.registerHelper('formatNumber', (number, decimals = 2) => {
            if (typeof number !== 'number')
                return number;
            return number.toFixed(decimals);
        });
        handlebars_1.default.registerHelper('uppercase', (str) => {
            return str ? str.toUpperCase() : '';
        });
        handlebars_1.default.registerHelper('lowercase', (str) => {
            return str ? str.toLowerCase() : '';
        });
        handlebars_1.default.registerHelper('default', (value, defaultValue) => {
            return value !== undefined && value !== null && value !== '' ? value : defaultValue;
        });
        handlebars_1.default.registerHelper('eq', (a, b) => a === b);
        handlebars_1.default.registerHelper('ne', (a, b) => a !== b);
        handlebars_1.default.registerHelper('gt', (a, b) => a > b);
        handlebars_1.default.registerHelper('lt', (a, b) => a < b);
        handlebars_1.default.registerHelper('gte', (a, b) => a >= b);
        handlebars_1.default.registerHelper('lte', (a, b) => a <= b);
        handlebars_1.default.registerHelper('length', (array) => array ? array.length : 0);
        handlebars_1.default.registerHelper('join', (array, separator = ', ') => {
            return array ? array.join(separator) : '';
        });
        handlebars_1.default.registerHelper('json', (obj, indent = 2) => {
            return JSON.stringify(obj, null, indent);
        });
        handlebars_1.default.registerHelper('chineseNumber', (num) => {
            const chineseNumbers = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
            const chineseUnits = ['', '十', '百', '千', '万'];
            if (num === 0)
                return chineseNumbers[0];
            if (num < 10)
                return chineseNumbers[num];
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
        handlebars_1.default.registerHelper('formatCaseNumber', (caseNumber) => {
            if (!caseNumber)
                return '';
            return caseNumber.replace(/(\d{4})/, '($1)');
        });
        handlebars_1.default.registerHelper('formatCourtName', (courtName) => {
            if (!courtName)
                return '';
            return courtName.replace(/法院$/, '人民法院');
        });
    }
    registerCustomHelper(name, helper) {
        this.customHelpers[name] = helper;
        handlebars_1.default.registerHelper(name, helper);
    }
    async loadTemplate(templatePath) {
        try {
            const templateContent = await storage_1.storageService.getFile(templatePath);
            const templateString = templateContent.toString('utf8');
            const { metadata, variables } = this.parseTemplateMetadata(templateString);
            const template = handlebars_1.default.compile(templateString);
            return {
                template,
                metadata,
                variables,
            };
        }
        catch (error) {
            console.error(`Failed to load template ${templatePath}:`, error);
            throw new Error(`Template loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    parseTemplateMetadata(templateString) {
        const metadata = {
            name: 'Unknown Template',
            version: '1.0.0',
            createdAt: new Date(),
            updatedAt: new Date(),
            usageCount: 0,
        };
        const variables = [];
        const metadataMatch = templateString.match(/{{!--\s*METADATA\s*([\s\S]*?)\s*--}}/);
        if (metadataMatch) {
            try {
                const metadataJson = JSON.parse(metadataMatch[1]);
                Object.assign(metadata, metadataJson);
            }
            catch (error) {
                console.warn('Failed to parse template metadata:', error);
            }
        }
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
                }
                catch (error) {
                    console.warn(`Failed to parse variable definition: ${match}`, error);
                }
            }
        }
        return { metadata, variables };
    }
    async processTemplate(templatePath, data, options = {}) {
        const startTime = Date.now();
        const defaultOptions = {
            validateVariables: true,
            strictMode: true,
            includeMetadata: true,
            outputFormat: 'html',
        };
        const finalOptions = { ...defaultOptions, ...options };
        const errors = [];
        const warnings = [];
        try {
            const { template, metadata, variables } = await this.loadTemplate(templatePath);
            if (finalOptions.validateVariables) {
                const validation = this.validateTemplateData(data, variables);
                errors.push(...validation.errors);
                warnings.push(...validation.warnings);
            }
            if (finalOptions.customHelpers) {
                for (const [name, helper] of Object.entries(finalOptions.customHelpers)) {
                    this.registerCustomHelper(name, helper);
                }
            }
            let content;
            try {
                content = template(data);
            }
            catch (error) {
                if (finalOptions.strictMode) {
                    throw new Error(`Template processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
                else {
                    content = `Template processing error: ${error instanceof Error ? error.message : 'Unknown error'}`;
                    errors.push(`Template processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
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
        }
        catch (error) {
            console.error(`Template processing failed for ${templatePath}:`, error);
            throw new Error(`Template processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    validateTemplateData(data, variables) {
        const errors = [];
        const warnings = [];
        for (const variable of variables) {
            const value = data[variable.name];
            if (variable.required && (value === undefined || value === null || value === '')) {
                errors.push(`Required variable '${variable.name}' is missing or empty`);
                continue;
            }
            if (value === undefined || value === null) {
                continue;
            }
            if (!this.validateType(value, variable.type)) {
                errors.push(`Variable '${variable.name}' should be of type ${variable.type}, got ${typeof value}`);
            }
            if (variable.validation) {
                for (const rule of variable.validation) {
                    const validationResult = this.validateRule(value, rule);
                    if (!validationResult.isValid) {
                        errors.push(`Variable '${variable.name}' validation failed: ${validationResult.message}`);
                    }
                }
            }
            if (variable.options && !variable.options.includes(value)) {
                errors.push(`Variable '${variable.name}' must be one of: ${variable.options.join(', ')}`);
            }
        }
        const variableNames = new Set(variables.map(v => v.name));
        for (const key in data) {
            if (!variableNames.has(key)) {
                warnings.push(`Extra variable '${key}' provided but not defined in template`);
            }
        }
        return { errors, warnings };
    }
    validateType(value, type) {
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
    validateRule(value, rule) {
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
    async convertOutputFormat(content, format) {
        switch (format) {
            case 'txt':
                return content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
            case 'pdf':
                try {
                    const { PDFDocument } = await Promise.resolve().then(() => __importStar(require('pdf-lib')));
                    const pdfDoc = await PDFDocument.create();
                    const page = pdfDoc.addPage();
                    const text = content.replace(/<[^>]*>/g, '');
                    const { width, height } = page.getSize();
                    page.drawText(text.substring(0, 1000), {
                        x: 50,
                        y: height - 50,
                        size: 12,
                    });
                    const pdfBytes = await pdfDoc.save();
                    return pdfBytes.toString('base64');
                }
                catch (error) {
                    console.warn('PDF conversion failed, returning HTML:', error);
                    return content;
                }
            case 'docx':
                return content;
            default:
                return content;
        }
    }
    async createTemplate(name, content, variables, metadata = {}) {
        const templateId = (0, uuid_1.v4)();
        const templateMetadata = {
            name,
            version: '1.0.0',
            createdAt: new Date(),
            updatedAt: new Date(),
            usageCount: 0,
            ...metadata,
        };
        const metadataComment = `{{!-- METADATA ${JSON.stringify(templateMetadata)} --}}`;
        const variableComments = variables.map(v => `{{!-- VARIABLE ${v.name} ${JSON.stringify({
            type: v.type,
            description: v.description,
            required: v.required,
            defaultValue: v.defaultValue,
            validation: v.validation,
            options: v.options,
        })} --}}`).join('\n');
        const finalContent = `${metadataComment}\n${variableComments}\n${content}`;
        const { filePath } = await storage_1.storageService.saveFile(Buffer.from(finalContent, 'utf8'), `${name}.hbs`, {
            category: 'templates',
            subcategory: 'active',
        });
        return filePath;
    }
    async updateTemplate(templatePath, content, variables, metadata) {
        const { template: existingTemplate, metadata: existingMetadata, variables: existingVariables } = await this.loadTemplate(templatePath);
        const updatedMetadata = {
            ...existingMetadata,
            ...metadata,
            updatedAt: new Date(),
        };
        const updatedVariables = variables || existingVariables;
        const metadataComment = `{{!-- METADATA ${JSON.stringify(updatedMetadata)} --}}`;
        const variableComments = updatedVariables.map(v => `{{!-- VARIABLE ${v.name} ${JSON.stringify({
            type: v.type,
            description: v.description,
            required: v.required,
            defaultValue: v.defaultValue,
            validation: v.validation,
            options: v.options,
        })} --}}`).join('\n');
        const finalContent = `${metadataComment}\n${variableComments}\n${content}`;
        await storage_1.storageService.saveFile(Buffer.from(finalContent, 'utf8'), path_1.default.basename(templatePath), {
            category: 'templates',
            subcategory: 'active',
        });
    }
    async validateTemplateSyntax(templateString) {
        const errors = [];
        const warnings = [];
        try {
            const template = handlebars_1.default.compile(templateString);
            template({});
            return { isValid: true, errors, warnings };
        }
        catch (error) {
            return {
                isValid: false,
                errors: [`Template syntax error: ${error instanceof Error ? error.message : 'Unknown error'}`],
                warnings,
            };
        }
    }
}
exports.TemplateEngine = TemplateEngine;
exports.templateEngine = new TemplateEngine();
//# sourceMappingURL=templateEngine.js.map