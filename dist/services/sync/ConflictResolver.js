"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConflictResolverImplementation = void 0;
const logger_1 = require("../integration/logger");
class ConflictResolverImplementation {
    constructor() {
        this.logger = new logger_1.IntegrationLoggerImplementation();
    }
    async detectConflicts(sourceData, targetData) {
        const conflicts = [];
        try {
            this.logger.info(`Detecting conflicts between source and target data`, {
                sourceRecords: sourceData.length,
                targetRecords: targetData.length
            });
            const sourceMap = this.createDataMap(sourceData);
            const targetMap = this.createDataMap(targetData);
            for (const [key, sourceRecord] of sourceMap.entries()) {
                const targetRecord = targetMap.get(key);
                if (targetRecord) {
                    const recordConflicts = await this.compareRecordsForConflicts(sourceRecord, targetRecord, key);
                    conflicts.push(...recordConflicts);
                }
                else {
                    conflicts.push(this.createMissingRecordConflict(key, sourceRecord, 'source'));
                }
            }
            for (const [key, targetRecord] of targetMap.entries()) {
                if (!sourceMap.has(key)) {
                    conflicts.push(this.createMissingRecordConflict(key, targetRecord, 'target'));
                }
            }
            const constraintConflicts = await this.detectConstraintViolations(sourceData, targetData);
            conflicts.push(...constraintConflicts);
            const duplicateConflicts = await this.detectDuplicates([...sourceData, ...targetData]);
            conflicts.push(...duplicateConflicts);
            this.logger.info(`Conflict detection completed`, {
                totalConflicts: conflicts.length,
                byType: this.groupConflictsByType(conflicts),
                bySeverity: this.groupConflictsBySeverity(conflicts)
            });
            return conflicts;
        }
        catch (error) {
            this.logger.error(`Conflict detection failed`, {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async resolveConflict(conflict, strategy) {
        try {
            this.logger.info(`Resolving conflict using ${strategy} strategy`, {
                conflictId: conflict.id,
                field: conflict.field,
                recordId: conflict.recordId
            });
            let resolvedValue;
            let notes;
            switch (strategy) {
                case 'source_wins':
                    resolvedValue = conflict.sourceValue;
                    notes = 'Resolved using source wins strategy';
                    break;
                case 'target_wins':
                    resolvedValue = conflict.targetValue;
                    notes = 'Resolved using target wins strategy';
                    break;
                case 'newest_wins':
                    resolvedValue = this.getNewestValue(conflict.sourceValue, conflict.targetValue);
                    notes = 'Resolved using newest wins strategy';
                    break;
                case 'oldest_wins':
                    resolvedValue = this.getOldestValue(conflict.sourceValue, conflict.targetValue);
                    notes = 'Resolved using oldest wins strategy';
                    break;
                case 'merge':
                    resolvedValue = this.mergeValues(conflict.sourceValue, conflict.targetValue);
                    notes = 'Resolved using merge strategy';
                    break;
                case 'manual':
                    resolvedValue = conflict.sourceValue;
                    notes = 'Marked for manual resolution';
                    break;
                case 'custom':
                    resolvedValue = await this.applyCustomResolution(conflict);
                    notes = 'Resolved using custom logic';
                    break;
                default:
                    resolvedValue = conflict.sourceValue;
                    notes = 'Resolved using default strategy';
            }
            const result = {
                strategy,
                resolvedValue,
                resolvedAt: new Date(),
                resolvedBy: 'automatic',
                notes
            };
            this.logger.info(`Conflict resolved successfully`, {
                conflictId: conflict.id,
                strategy,
                resolved: !!resolvedValue
            });
            return result;
        }
        catch (error) {
            this.logger.error(`Failed to resolve conflict`, {
                conflictId: conflict.id,
                strategy,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async applyResolution(resolution, target) {
        try {
            this.logger.info(`Applying resolution to target`, {
                strategy: resolution.strategy,
                targetType: target.type
            });
            switch (target.type) {
                case 'database':
                    await this.applyDatabaseResolution(resolution, target);
                    break;
                case 'api':
                    await this.applyAPIResolution(resolution, target);
                    break;
                case 'file':
                    await this.applyFileResolution(resolution, target);
                    break;
                case 'external_service':
                    await this.applyExternalServiceResolution(resolution, target);
                    break;
                default:
                    throw new Error(`Unsupported target type: ${target.type}`);
            }
            this.logger.info(`Resolution applied successfully`, {
                strategy: resolution.strategy,
                targetType: target.type
            });
        }
        catch (error) {
            this.logger.error(`Failed to apply resolution`, {
                strategy: resolution.strategy,
                targetType: target.type,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    createDataMap(data) {
        const map = new Map();
        for (const record of data) {
            const key = record.id || this.generateRecordKey(record);
            map.set(key, record);
        }
        return map;
    }
    generateRecordKey(record) {
        const keys = Object.keys(record).sort();
        const values = keys.map(key => record[key]);
        return values.join('|');
    }
    async compareRecordsForConflicts(sourceRecord, targetRecord, recordKey) {
        const conflicts = [];
        const allFields = new Set([
            ...Object.keys(sourceRecord),
            ...Object.keys(targetRecord)
        ]);
        for (const field of allFields) {
            const sourceValue = sourceRecord[field];
            const targetValue = targetRecord[field];
            if (!this.valuesAreEqual(sourceValue, targetValue)) {
                const conflict = this.createDataMismatchConflict(recordKey, field, sourceValue, targetValue);
                conflicts.push(conflict);
            }
        }
        return conflicts;
    }
    valuesAreEqual(value1, value2) {
        if (value1 === value2)
            return true;
        if (value1 == null && value2 == null)
            return true;
        if (value1 == null || value2 == null)
            return false;
        if (typeof value1 === 'object' && typeof value2 === 'object') {
            return JSON.stringify(value1) === JSON.stringify(value2);
        }
        if (value1 instanceof Date && value2 instanceof Date) {
            return value1.getTime() === value2.getTime();
        }
        return String(value1) === String(value2);
    }
    createDataMismatchConflict(recordKey, field, sourceValue, targetValue) {
        return {
            id: this.generateConflictId(),
            recordId: recordKey,
            field,
            sourceValue,
            targetValue,
            type: 'data_mismatch',
            severity: this.determineConflictSeverity(field, sourceValue, targetValue),
            detectedAt: new Date()
        };
    }
    createMissingRecordConflict(recordKey, record, source) {
        return {
            id: this.generateConflictId(),
            recordId: recordKey,
            field: 'record',
            sourceValue: source === 'source' ? record : null,
            targetValue: source === 'target' ? record : null,
            type: 'missing_record',
            severity: 'medium',
            detectedAt: new Date()
        };
    }
    determineConflictSeverity(field, sourceValue, targetValue) {
        const criticalFields = ['id', 'email', 'ssn', 'phone', 'account_number'];
        const highFields = ['name', 'address', 'amount', 'status', 'date'];
        const mediumFields = ['description', 'notes', 'metadata', 'tags'];
        const fieldLower = field.toLowerCase();
        if (criticalFields.some(cf => fieldLower.includes(cf))) {
            return 'critical';
        }
        else if (highFields.some(hf => fieldLower.includes(hf))) {
            return 'high';
        }
        else if (mediumFields.some(mf => fieldLower.includes(mf))) {
            return 'medium';
        }
        else {
            return 'low';
        }
    }
    async detectConstraintViolations(sourceData, targetData) {
        const conflicts = [];
        try {
            const uniqueConflicts = await this.checkUniqueConstraints([...sourceData, ...targetData]);
            conflicts.push(...uniqueConflicts);
            const fkConflicts = await this.checkForeignKeyConstraints(sourceData, targetData);
            conflicts.push(...fkConflicts);
            const typeConflicts = await this.checkDataTypeConstraints([...sourceData, ...targetData]);
            conflicts.push(...typeConflicts);
        }
        catch (error) {
            this.logger.error(`Constraint violation detection failed`, {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
        return conflicts;
    }
    async checkUniqueConstraints(data) {
        const conflicts = [];
        const seenKeys = new Set();
        for (const record of data) {
            const key = this.generateRecordKey(record);
            if (seenKeys.has(key)) {
                conflicts.push({
                    id: this.generateConflictId(),
                    recordId: record.id || key,
                    field: 'unique_constraint',
                    sourceValue: record,
                    targetValue: null,
                    type: 'constraint_violation',
                    severity: 'high',
                    detectedAt: new Date()
                });
            }
            else {
                seenKeys.add(key);
            }
        }
        return conflicts;
    }
    async checkForeignKeyConstraints(sourceData, targetData) {
        const conflicts = [];
        const allIds = new Set([
            ...sourceData.map(r => r.id),
            ...targetData.map(r => r.id)
        ]);
        for (const record of [...sourceData, ...targetData]) {
            if (record.parent_id && !allIds.has(record.parent_id)) {
                conflicts.push({
                    id: this.generateConflictId(),
                    recordId: record.id,
                    field: 'parent_id',
                    sourceValue: record.parent_id,
                    targetValue: null,
                    type: 'constraint_violation',
                    severity: 'high',
                    detectedAt: new Date()
                });
            }
        }
        return conflicts;
    }
    async checkDataTypeConstraints(data) {
        const conflicts = [];
        for (const record of data) {
            for (const [field, value] of Object.entries(record)) {
                if (field.includes('email') && value && !this.isValidEmail(value)) {
                    conflicts.push({
                        id: this.generateConflictId(),
                        recordId: record.id,
                        field,
                        sourceValue: value,
                        targetValue: null,
                        type: 'constraint_violation',
                        severity: 'medium',
                        detectedAt: new Date()
                    });
                }
                if (field.includes('phone') && value && !this.isValidPhone(value)) {
                    conflicts.push({
                        id: this.generateConflictId(),
                        recordId: record.id,
                        field,
                        sourceValue: value,
                        targetValue: null,
                        type: 'constraint_violation',
                        severity: 'medium',
                        detectedAt: new Date()
                    });
                }
            }
        }
        return conflicts;
    }
    async detectDuplicates(data) {
        const conflicts = [];
        const seenKeys = new Map();
        for (const record of data) {
            const key = this.generateRecordKey(record);
            if (seenKeys.has(key)) {
                const duplicates = seenKeys.get(key);
                duplicates.push(record);
                if (duplicates.length === 2) {
                    conflicts.push({
                        id: this.generateConflictId(),
                        recordId: duplicates[0].id || key,
                        field: 'duplicate_record',
                        sourceValue: duplicates[0],
                        targetValue: duplicates[1],
                        type: 'duplicate_record',
                        severity: 'medium',
                        detectedAt: new Date()
                    });
                }
                conflicts.push({
                    id: this.generateConflictId(),
                    recordId: record.id || key,
                    field: 'duplicate_record',
                    sourceValue: record,
                    targetValue: duplicates[0],
                    type: 'duplicate_record',
                    severity: 'medium',
                    detectedAt: new Date()
                });
            }
            else {
                seenKeys.set(key, [record]);
            }
        }
        return conflicts;
    }
    getNewestValue(sourceValue, targetValue) {
        const sourceDate = this.extractDate(sourceValue);
        const targetDate = this.extractDate(targetValue);
        if (sourceDate && targetDate) {
            return sourceDate > targetDate ? sourceValue : targetValue;
        }
        return sourceValue;
    }
    getOldestValue(sourceValue, targetValue) {
        const sourceDate = this.extractDate(sourceValue);
        const targetDate = this.extractDate(targetValue);
        if (sourceDate && targetDate) {
            return sourceDate < targetDate ? sourceValue : targetValue;
        }
        return targetValue;
    }
    extractDate(value) {
        if (value instanceof Date) {
            return value;
        }
        if (typeof value === 'string') {
            const parsed = new Date(value);
            return isNaN(parsed.getTime()) ? null : parsed;
        }
        if (typeof value === 'object' && value.timestamp) {
            return new Date(value.timestamp);
        }
        return null;
    }
    mergeValues(sourceValue, targetValue) {
        if (sourceValue == null)
            return targetValue;
        if (targetValue == null)
            return sourceValue;
        if (typeof sourceValue === 'object' && typeof targetValue === 'object') {
            const merged = { ...targetValue };
            for (const [key, value] of Object.entries(sourceValue)) {
                if (key in targetValue) {
                    merged[key] = this.mergeValues(value, targetValue[key]);
                }
                else {
                    merged[key] = value;
                }
            }
            return merged;
        }
        if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
            const merged = [...targetValue, ...sourceValue];
            return [...new Set(merged)];
        }
        return sourceValue;
    }
    async applyCustomResolution(conflict) {
        switch (conflict.type) {
            case 'data_mismatch':
                return this.resolveDataMismatch(conflict);
            case 'missing_record':
                return this.resolveMissingRecord(conflict);
            case 'duplicate_record':
                return this.resolveDuplicateRecord(conflict);
            case 'constraint_violation':
                return this.resolveConstraintViolation(conflict);
            default:
                return conflict.sourceValue;
        }
    }
    resolveDataMismatch(conflict) {
        const field = conflict.field.toLowerCase();
        if (field.includes('name')) {
            if (conflict.sourceValue && conflict.targetValue) {
                return `${conflict.sourceValue} (${conflict.targetValue})`;
            }
        }
        if (field.includes('address')) {
            const sourceLength = JSON.stringify(conflict.sourceValue).length;
            const targetLength = JSON.stringify(conflict.targetValue).length;
            return sourceLength > targetLength ? conflict.sourceValue : conflict.targetValue;
        }
        return conflict.sourceValue;
    }
    resolveMissingRecord(conflict) {
        return conflict.sourceValue || conflict.targetValue;
    }
    resolveDuplicateRecord(conflict) {
        return this.mergeValues(conflict.sourceValue, conflict.targetValue);
    }
    resolveConstraintViolation(conflict) {
        if (conflict.field === 'email' && conflict.sourceValue) {
            return this.normalizeEmail(conflict.sourceValue);
        }
        if (conflict.field === 'phone' && conflict.sourceValue) {
            return this.normalizePhone(conflict.sourceValue);
        }
        return conflict.sourceValue;
    }
    normalizeEmail(email) {
        return email.toLowerCase().trim();
    }
    normalizePhone(phone) {
        return phone.replace(/\D/g, '');
    }
    async applyDatabaseResolution(resolution, target) {
        this.logger.info(`Applying database resolution`, {
            strategy: resolution.strategy
        });
    }
    async applyAPIResolution(resolution, target) {
        this.logger.info(`Applying API resolution`, {
            strategy: resolution.strategy
        });
    }
    async applyFileResolution(resolution, target) {
        this.logger.info(`Applying file resolution`, {
            strategy: resolution.strategy
        });
    }
    async applyExternalServiceResolution(resolution, target) {
        this.logger.info(`Applying external service resolution`, {
            strategy: resolution.strategy
        });
    }
    groupConflictsByType(conflicts) {
        return conflicts.reduce((groups, conflict) => {
            groups[conflict.type] = (groups[conflict.type] || 0) + 1;
            return groups;
        }, {});
    }
    groupConflictsBySeverity(conflicts) {
        return conflicts.reduce((groups, conflict) => {
            groups[conflict.severity] = (groups[conflict.severity] || 0) + 1;
            return groups;
        }, {});
    }
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    isValidPhone(phone) {
        const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
        return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
    }
    generateConflictId() {
        return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.ConflictResolverImplementation = ConflictResolverImplementation;
//# sourceMappingURL=ConflictResolver.js.map