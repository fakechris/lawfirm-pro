import { 
  Conflict, 
  ConflictResolver, 
  ResolutionResult, 
  ResolutionStrategy, 
  DataTarget 
} from '../../models/integration';
import { IntegrationLoggerImplementation } from '../integration/logger';

export class ConflictResolverImplementation implements ConflictResolver {
  private logger: IntegrationLoggerImplementation;

  constructor() {
    this.logger = new IntegrationLoggerImplementation();
  }

  async detectConflicts(sourceData: any[], targetData: any[]): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    
    try {
      this.logger.info(`Detecting conflicts between source and target data`, {
        sourceRecords: sourceData.length,
        targetRecords: targetData.length
      });

      // Create maps for efficient comparison
      const sourceMap = this.createDataMap(sourceData);
      const targetMap = this.createDataMap(targetData);

      // Check for conflicts in common records
      for (const [key, sourceRecord] of sourceMap.entries()) {
        const targetRecord = targetMap.get(key);
        
        if (targetRecord) {
          const recordConflicts = await this.compareRecordsForConflicts(
            sourceRecord, 
            targetRecord, 
            key
          );
          conflicts.push(...recordConflicts);
        } else {
          // Record exists in source but not in target
          conflicts.push(this.createMissingRecordConflict(key, sourceRecord, 'source'));
        }
      }

      // Check for records that exist only in target
      for (const [key, targetRecord] of targetMap.entries()) {
        if (!sourceMap.has(key)) {
          conflicts.push(this.createMissingRecordConflict(key, targetRecord, 'target'));
        }
      }

      // Check for constraint violations
      const constraintConflicts = await this.detectConstraintViolations(
        sourceData, 
        targetData
      );
      conflicts.push(...constraintConflicts);

      // Check for duplicates
      const duplicateConflicts = await this.detectDuplicates(
        [...sourceData, ...targetData]
      );
      conflicts.push(...duplicateConflicts);

      this.logger.info(`Conflict detection completed`, {
        totalConflicts: conflicts.length,
        byType: this.groupConflictsByType(conflicts),
        bySeverity: this.groupConflictsBySeverity(conflicts)
      });

      return conflicts;
      
    } catch (error) {
      this.logger.error(`Conflict detection failed`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async resolveConflict(conflict: Conflict, strategy: ResolutionStrategy): Promise<ResolutionResult> {
    try {
      this.logger.info(`Resolving conflict using ${strategy} strategy`, {
        conflictId: conflict.id,
        field: conflict.field,
        recordId: conflict.recordId
      });

      let resolvedValue: any;
      let notes: string;

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
          resolvedValue = conflict.sourceValue; // Default to source for manual
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

      const result: ResolutionResult = {
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
      
    } catch (error) {
      this.logger.error(`Failed to resolve conflict`, {
        conflictId: conflict.id,
        strategy,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async applyResolution(resolution: ResolutionResult, target: DataTarget): Promise<void> {
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
      
    } catch (error) {
      this.logger.error(`Failed to apply resolution`, {
        strategy: resolution.strategy,
        targetType: target.type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Private helper methods
  private createDataMap(data: any[]): Map<string, any> {
    const map = new Map<string, any>();
    
    for (const record of data) {
      const key = record.id || this.generateRecordKey(record);
      map.set(key, record);
    }
    
    return map;
  }

  private generateRecordKey(record: any): string {
    // Generate a unique key for records without explicit ID
    const keys = Object.keys(record).sort();
    const values = keys.map(key => record[key]);
    return values.join('|');
  }

  private async compareRecordsForConflicts(
    sourceRecord: any, 
    targetRecord: any, 
    recordKey: string
  ): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    
    // Get all unique fields from both records
    const allFields = new Set([
      ...Object.keys(sourceRecord),
      ...Object.keys(targetRecord)
    ]);

    for (const field of allFields) {
      const sourceValue = sourceRecord[field];
      const targetValue = targetRecord[field];
      
      if (!this.valuesAreEqual(sourceValue, targetValue)) {
        const conflict = this.createDataMismatchConflict(
          recordKey, 
          field, 
          sourceValue, 
          targetValue
        );
        conflicts.push(conflict);
      }
    }

    return conflicts;
  }

  private valuesAreEqual(value1: any, value2: any): boolean {
    // Handle different types of comparison
    if (value1 === value2) return true;
    if (value1 == null && value2 == null) return true;
    if (value1 == null || value2 == null) return false;
    
    // Compare objects by their stringified form
    if (typeof value1 === 'object' && typeof value2 === 'object') {
      return JSON.stringify(value1) === JSON.stringify(value2);
    }
    
    // Compare dates
    if (value1 instanceof Date && value2 instanceof Date) {
      return value1.getTime() === value2.getTime();
    }
    
    // String comparison for other types
    return String(value1) === String(value2);
  }

  private createDataMismatchConflict(
    recordKey: string, 
    field: string, 
    sourceValue: any, 
    targetValue: any
  ): Conflict {
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

  private createMissingRecordConflict(
    recordKey: string, 
    record: any, 
    source: 'source' | 'target'
  ): Conflict {
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

  private determineConflictSeverity(field: string, sourceValue: any, targetValue: any): 'low' | 'medium' | 'high' | 'critical' {
    const criticalFields = ['id', 'email', 'ssn', 'phone', 'account_number'];
    const highFields = ['name', 'address', 'amount', 'status', 'date'];
    const mediumFields = ['description', 'notes', 'metadata', 'tags'];
    
    const fieldLower = field.toLowerCase();
    
    if (criticalFields.some(cf => fieldLower.includes(cf))) {
      return 'critical';
    } else if (highFields.some(hf => fieldLower.includes(hf))) {
      return 'high';
    } else if (mediumFields.some(mf => fieldLower.includes(mf))) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private async detectConstraintViolations(
    sourceData: any[], 
    targetData: any[]
  ): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    
    try {
      // Check for unique constraint violations
      const uniqueConflicts = await this.checkUniqueConstraints(
        [...sourceData, ...targetData]
      );
      conflicts.push(...uniqueConflicts);
      
      // Check for foreign key constraint violations
      const fkConflicts = await this.checkForeignKeyConstraints(
        sourceData, 
        targetData
      );
      conflicts.push(...fkConflicts);
      
      // Check for data type constraint violations
      const typeConflicts = await this.checkDataTypeConstraints(
        [...sourceData, ...targetData]
      );
      conflicts.push(...typeConflicts);
      
    } catch (error) {
      this.logger.error(`Constraint violation detection failed`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    return conflicts;
  }

  private async checkUniqueConstraints(data: any[]): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    const seenKeys = new Set<string>();
    
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
      } else {
        seenKeys.add(key);
      }
    }
    
    return conflicts;
  }

  private async checkForeignKeyConstraints(
    sourceData: any[], 
    targetData: any[]
  ): Promise<Conflict[]> {
    // Simplified foreign key constraint checking
    // In a real implementation, this would check database schema constraints
    const conflicts: Conflict[] = [];
    
    // Example: Check if referenced records exist
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

  private async checkDataTypeConstraints(data: any[]): Promise<Conflict[]> {
    // Simplified data type constraint checking
    const conflicts: Conflict[] = [];
    
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

  private async detectDuplicates(data: any[]): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    const seenKeys = new Map<string, any[]>();
    
    for (const record of data) {
      const key = this.generateRecordKey(record);
      
      if (seenKeys.has(key)) {
        const duplicates = seenKeys.get(key)!;
        duplicates.push(record);
        
        // Create conflict for the original duplicate
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
        
        // Create conflict for current record
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
      } else {
        seenKeys.set(key, [record]);
      }
    }
    
    return conflicts;
  }

  private getNewestValue(sourceValue: any, targetValue: any): any {
    // Try to determine which value is newer based on timestamps
    const sourceDate = this.extractDate(sourceValue);
    const targetDate = this.extractDate(targetValue);
    
    if (sourceDate && targetDate) {
      return sourceDate > targetDate ? sourceValue : targetValue;
    }
    
    // Default to source if we can't determine
    return sourceValue;
  }

  private getOldestValue(sourceValue: any, targetValue: any): any {
    // Try to determine which value is older based on timestamps
    const sourceDate = this.extractDate(sourceValue);
    const targetDate = this.extractDate(targetValue);
    
    if (sourceDate && targetDate) {
      return sourceDate < targetDate ? sourceValue : targetValue;
    }
    
    // Default to target if we can't determine
    return targetValue;
  }

  private extractDate(value: any): Date | null {
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

  private mergeValues(sourceValue: any, targetValue: any): any {
    // Smart merging logic
    if (sourceValue == null) return targetValue;
    if (targetValue == null) return sourceValue;
    
    if (typeof sourceValue === 'object' && typeof targetValue === 'object') {
      // Merge objects recursively
      const merged = { ...targetValue };
      
      for (const [key, value] of Object.entries(sourceValue)) {
        if (key in targetValue) {
          merged[key] = this.mergeValues(value, targetValue[key]);
        } else {
          merged[key] = value;
        }
      }
      
      return merged;
    }
    
    if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
      // Merge arrays, removing duplicates
      const merged = [...targetValue, ...sourceValue];
      return [...new Set(merged)];
    }
    
    // For primitive types, prefer source value
    return sourceValue;
  }

  private async applyCustomResolution(conflict: Conflict): Promise<any> {
    // Custom resolution logic can be implemented here
    // This is a placeholder for more complex business logic
    
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

  private resolveDataMismatch(conflict: Conflict): any {
    // Custom logic for resolving data mismatches
    const field = conflict.field.toLowerCase();
    
    if (field.includes('name')) {
      // For names, combine both values if they're different
      if (conflict.sourceValue && conflict.targetValue) {
        return `${conflict.sourceValue} (${conflict.targetValue})`;
      }
    }
    
    if (field.includes('address')) {
      // For addresses, prefer the more complete one
      const sourceLength = JSON.stringify(conflict.sourceValue).length;
      const targetLength = JSON.stringify(conflict.targetValue).length;
      return sourceLength > targetLength ? conflict.sourceValue : conflict.targetValue;
    }
    
    // Default to source value
    return conflict.sourceValue;
  }

  private resolveMissingRecord(conflict: Conflict): any {
    // For missing records, use the existing value
    return conflict.sourceValue || conflict.targetValue;
  }

  private resolveDuplicateRecord(conflict: Conflict): any {
    // For duplicate records, merge the data
    return this.mergeValues(conflict.sourceValue, conflict.targetValue);
  }

  private resolveConstraintViolation(conflict: Conflict): any {
    // For constraint violations, try to fix the issue
    if (conflict.field === 'email' && conflict.sourceValue) {
      return this.normalizeEmail(conflict.sourceValue);
    }
    
    if (conflict.field === 'phone' && conflict.sourceValue) {
      return this.normalizePhone(conflict.sourceValue);
    }
    
    return conflict.sourceValue;
  }

  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  private normalizePhone(phone: string): string {
    // Remove all non-digit characters
    return phone.replace(/\D/g, '');
  }

  private async applyDatabaseResolution(resolution: ResolutionResult, target: DataTarget): Promise<void> {
    // Implementation for applying resolution to database
    this.logger.info(`Applying database resolution`, {
      strategy: resolution.strategy
    });
    
    // In a real implementation, this would update the database
    // For now, it's a placeholder
  }

  private async applyAPIResolution(resolution: ResolutionResult, target: DataTarget): Promise<void> {
    // Implementation for applying resolution to API
    this.logger.info(`Applying API resolution`, {
      strategy: resolution.strategy
    });
    
    // In a real implementation, this would make API calls
    // For now, it's a placeholder
  }

  private async applyFileResolution(resolution: ResolutionResult, target: DataTarget): Promise<void> {
    // Implementation for applying resolution to file
    this.logger.info(`Applying file resolution`, {
      strategy: resolution.strategy
    });
    
    // In a real implementation, this would update files
    // For now, it's a placeholder
  }

  private async applyExternalServiceResolution(resolution: ResolutionResult, target: DataTarget): Promise<void> {
    // Implementation for applying resolution to external service
    this.logger.info(`Applying external service resolution`, {
      strategy: resolution.strategy
    });
    
    // In a real implementation, this would call external services
    // For now, it's a placeholder
  }

  private groupConflictsByType(conflicts: Conflict[]): Record<string, number> {
    return conflicts.reduce((groups, conflict) => {
      groups[conflict.type] = (groups[conflict.type] || 0) + 1;
      return groups;
    }, {} as Record<string, number>);
  }

  private groupConflictsBySeverity(conflicts: Conflict[]): Record<string, number> {
    return conflicts.reduce((groups, conflict) => {
      groups[conflict.severity] = (groups[conflict.severity] || 0) + 1;
      return groups;
    }, {} as Record<string, number>);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidPhone(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }

  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}