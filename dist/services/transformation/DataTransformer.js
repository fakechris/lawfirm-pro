"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataTransformerImplementation = void 0;
const logger_1 = require("../integration/logger");
class DataTransformerImplementation {
    constructor() {
        this.transformers = new Map();
        this.logger = new logger_1.IntegrationLoggerImplementation();
    }
    async transform(source, transformer) {
        try {
            this.logger.info(`Transforming data using ${transformer.name}`, {
                transformerId: transformer.id,
                sourceFormat: transformer.sourceFormat,
                targetFormat: transformer.targetFormat
            });
            let data = Array.isArray(source) ? source : [source];
            for (const rule of transformer.transformation.sort((a, b) => a.order - b.order)) {
                data = await this.applyTransformationRule(data, rule);
            }
            this.logger.info(`Data transformation completed`, {
                transformerId: transformer.id,
                recordsProcessed: data.length
            });
            return Array.isArray(source) ? data : data[0];
        }
        catch (error) {
            this.logger.error(`Data transformation failed`, {
                transformerId: transformer.id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async validateSchema(data, schema) {
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
        }
        catch (error) {
            this.logger.error(`Schema validation failed`, {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    async mapFields(source, fieldMapping) {
        try {
            this.logger.info(`Mapping fields`, {
                sourceFields: Object.keys(source),
                mappingCount: fieldMapping.length
            });
            const result = {};
            const sourceData = Array.isArray(source) ? source : [source];
            const results = [];
            for (const item of sourceData) {
                const mappedItem = {};
                for (const mapping of fieldMapping) {
                    const sourceValue = this.getNestedValue(item, mapping.sourceField);
                    if (sourceValue !== undefined) {
                        if (mapping.transformation) {
                            mappedItem[mapping.targetField] = await this.applyFieldTransformation(sourceValue, mapping.transformation);
                        }
                        else {
                            mappedItem[mapping.targetField] = sourceValue;
                        }
                    }
                    else if (mapping.required && mapping.defaultValue !== undefined) {
                        mappedItem[mapping.targetField] = mapping.defaultValue;
                    }
                    else if (mapping.required) {
                        throw new Error(`Required field '${mapping.sourceField}' not found in source data`);
                    }
                }
                results.push(mappedItem);
            }
            return Array.isArray(source) ? results : results[0];
        }
        catch (error) {
            this.logger.error(`Field mapping failed`, {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async normalizeData(data, rules) {
        try {
            this.logger.info(`Normalizing data`, {
                rulesCount: rules.length,
                dataFields: Object.keys(Array.isArray(data) ? data[0] || {} : data)
            });
            const dataToNormalize = Array.isArray(data) ? data : [data];
            const normalizedData = [];
            for (const item of dataToNormalize) {
                const normalizedItem = { ...item };
                for (const rule of rules) {
                    normalizedItem[rule.field] = await this.applyNormalizationRule(normalizedItem[rule.field], rule);
                }
                normalizedData.push(normalizedItem);
            }
            return Array.isArray(data) ? normalizedData : normalizedData[0];
        }
        catch (error) {
            this.logger.error(`Data normalization failed`, {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async createTransformation(config) {
        try {
            const id = this.generateTransformerId();
            const transformer = {
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
        }
        catch (error) {
            this.logger.error(`Failed to create transformation`, {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async updateTransformation(id, config) {
        try {
            const transformer = this.transformers.get(id);
            if (!transformer) {
                throw new Error(`Transformer with id ${id} not found`);
            }
            const updatedTransformer = {
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
        }
        catch (error) {
            this.logger.error(`Failed to update transformation`, {
                transformerId: id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async deleteTransformation(id) {
        try {
            if (!this.transformers.has(id)) {
                throw new Error(`Transformer with id ${id} not found`);
            }
            this.transformers.delete(id);
            this.logger.info(`Deleted transformation`, {
                transformerId: id
            });
        }
        catch (error) {
            this.logger.error(`Failed to delete transformation`, {
                transformerId: id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async applyTransformationRule(data, rule) {
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
        }
        catch (error) {
            this.logger.error(`Failed to apply transformation rule`, {
                ruleType: rule.type,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    applyFieldMapping(item, config) {
        const mapped = { ...item };
        if (config.mapping) {
            for (const [sourceField, targetField] of Object.entries(config.mapping)) {
                if (mapped[sourceField] !== undefined) {
                    mapped[targetField] = mapped[sourceField];
                    delete mapped[sourceField];
                }
            }
        }
        return mapped;
    }
    async applyFieldTransformation(item, rule) {
        const transformed = { ...item };
        for (const [field, config] of Object.entries(rule.config.fields || {})) {
            if (transformed[field] !== undefined) {
                transformed[field] = await this.transformValue(transformed[field], config);
            }
        }
        return transformed;
    }
    async transformValue(value, config) {
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
    applyFieldCalculation(item, rule) {
        const calculated = { ...item };
        for (const [targetField, config] of Object.entries(rule.config.calculations || {})) {
            try {
                calculated[targetField] = this.calculateValue(item, config);
            }
            catch (error) {
                this.logger.error(`Field calculation failed`, {
                    field: targetField,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                calculated[targetField] = null;
            }
        }
        return calculated;
    }
    calculateValue(item, config) {
        const { operation, fields, constant } = config;
        switch (operation) {
            case 'add':
                return fields.reduce((sum, field) => sum + (Number(item[field]) || 0), 0);
            case 'subtract':
                return fields.reduce((result, field, index) => index === 0 ? (Number(item[field]) || 0) : result - (Number(item[field]) || 0), 0);
            case 'multiply':
                return fields.reduce((product, field) => product * (Number(item[field]) || 1), 1);
            case 'divide':
                return fields.reduce((result, field, index) => index === 0 ? (Number(item[field]) || 1) : result / (Number(item[field]) || 1), 1);
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
                return fields.reduce((sum, field) => sum + (Number(item[field]) || 0), constant || 0);
            case 'max':
                return Math.max(...fields.map(field => Number(item[field]) || 0));
            case 'min':
                return Math.min(...fields.map(field => Number(item[field]) || 0));
            default:
                return null;
        }
    }
    validateField(item, config) {
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
        }
        catch (error) {
            return false;
        }
    }
    applyFieldFormatting(item, rule) {
        const formatted = { ...item };
        for (const [field, config] of Object.entries(rule.config.fields || {})) {
            if (formatted[field] !== undefined) {
                formatted[field] = this.formatValue(formatted[field], config);
            }
        }
        return formatted;
    }
    formatValue(value, config) {
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
    applyFieldFilter(item, rule) {
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
        }
        catch (error) {
            return false;
        }
    }
    async applyFieldAggregation(data, rule) {
        const { field, operation, groupBy } = rule.config;
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
                const aggregated = this.aggregateGroup(groupData, field, operation);
                result.push({
                    [groupBy]: groupKey,
                    [field]: aggregated
                });
            }
            return result;
        }
        else {
            const aggregated = this.aggregateGroup(data, field, operation);
            return [{ [field]: aggregated }];
        }
    }
    aggregateGroup(groupData, field, operation) {
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
    applyFieldSplit(data, rule) {
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
    applyFieldJoin(data, rule) {
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
        }
        else {
            const joined = data.map(item => String(item[field] || '')).join(separator);
            return [{ [field]: joined }];
        }
    }
    async applyNormalizationRule(value, rule) {
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
    async applyCustomTransformation(value, config) {
        return value;
    }
    applyCustomValidation(value, config) {
        return true;
    }
    async applyCustomNormalization(value, config) {
        return value;
    }
    async validateItemAgainstSchema(item, schema) {
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
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    formatDate(date, format) {
        const d = new Date(date);
        if (isNaN(d.getTime()))
            return String(date);
        return d.toISOString().split('T')[0];
    }
    formatNumber(value, decimals = 2) {
        const num = Number(value);
        return isNaN(num) ? String(value) : num.toFixed(decimals);
    }
    formatCurrency(value, currency = 'USD', decimals = 2) {
        const num = Number(value);
        return isNaN(num) ? String(value) : `${currency} ${num.toFixed(decimals)}`;
    }
    formatPercentage(value, decimals = 2) {
        const num = Number(value);
        return isNaN(num) ? String(value) : `${num.toFixed(decimals)}%`;
    }
    formatPhone(phone) {
        const cleaned = String(phone).replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }
        return phone;
    }
    formatEmail(email) {
        return String(email).toLowerCase().trim();
    }
    parseBoolean(value) {
        if (typeof value === 'boolean')
            return value;
        const str = String(value).toLowerCase();
        return str === 'true' || str === '1' || str === 'yes' || str === 'on';
    }
    hashValue(value, algorithm = 'sha256') {
        return `hashed_${algorithm}_${value}`;
    }
    encryptValue(value, key) {
        return `encrypted_${key}_${value}`;
    }
    decryptValue(value, key) {
        return String(value).replace(`encrypted_${key}_`, '');
    }
    sanitizeData(data) {
        if (typeof data !== 'object' || data === null)
            return data;
        const sanitized = { ...data };
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'api_key'];
        for (const [key, value] of Object.entries(sanitized)) {
            if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                sanitized[key] = '***REDACTED***';
            }
            else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeData(value);
            }
        }
        return sanitized;
    }
    generateTransformerId() {
        return `transformer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.DataTransformerImplementation = DataTransformerImplementation;
//# sourceMappingURL=DataTransformer.js.map