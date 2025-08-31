import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createHash, randomBytes } from 'crypto';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { createReadStream, createWriteStream } from 'fs';
import { config } from '../config';
import { DocumentStorageService } from '../services/documents/storage';

const pipelineAsync = promisify(pipeline);

export interface VersionedFileUploadOptions {
  filename: string;
  mimeType: string;
  category: 'documents' | 'versions' | 'templates' | 'evidence' | 'thumbnails' | 'temp';
  subcategory?: 'original' | 'processed' | 'active' | 'archive' | 'uploads';
  versionNumber?: number;
  changeDescription?: string;
  generateChecksum?: boolean;
  generateThumbnail?: boolean;
  encrypt?: boolean;
  compress?: boolean;
  overwrite?: boolean;
  metadata?: Record<string, unknown>;
  userId?: string;
}

export interface VersionedFileStorageResult {
  success: boolean;
  filePath: string;
  filename: string;
  size: number;
  mimeType: string;
  versionNumber: number;
  checksum?: string;
  thumbnailPath?: string;
  metadata?: Record<string, unknown>;
  error?: string;
  warnings?: string[];
  processingTime?: number;
}

export interface VersionComparisonResult {
  hasChanges: boolean;
  changes: {
    added: string[];
    removed: string[];
    modified: string[];
  };
  similarity: number;
}

export class VersionControlStorageService {
  private basePath: string;
  private maxFileSize: number;
  private allowedMimeTypes: string[];
  private maxVersions: number;
  private baseStorageService: DocumentStorageService;

  constructor() {
    this.basePath = config.storage.basePath;
    this.maxFileSize = config.storage.maxFileSize;
    this.allowedMimeTypes = config.storage.allowedMimeTypes;
    this.maxVersions = 50; // Maximum versions to keep per document
    this.baseStorageService = new DocumentStorageService();
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private generateVersionFilename(originalName: string, versionNumber: number): string {
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    const timestamp = Date.now();
    const random = randomBytes(4).toString('hex');
    
    return `${name}_v${versionNumber}_${timestamp}_${random}${ext}`;
  }

  private getStoragePath(options: VersionedFileUploadOptions): string {
    const { category, subcategory = 'original' } = options;
    const categoryPaths = config.storage.paths[category];
    
    if (!categoryPaths) {
      throw new Error(`Invalid storage category: ${category}`);
    }

    const subcategoryPath = categoryPaths[subcategory as keyof typeof categoryPaths];
    if (!subcategoryPath) {
      throw new Error(`Invalid subcategory: ${subcategory} for category: ${category}`);
    }

    return path.join(this.basePath, subcategoryPath);
  }

  private async calculateFileHash(buffer: Buffer, algorithm: string = 'sha256'): Promise<string> {
    return createHash(algorithm).update(buffer).digest('hex');
  }

  private async getFileChecksum(filePath: string): Promise<string> {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    
    for await (const chunk of stream) {
      hash.update(chunk);
    }
    
    return hash.digest('hex');
  }

  private async compareFiles(filePath1: string, filePath2: string): Promise<VersionComparisonResult> {
    try {
      const [buffer1, buffer2] = await Promise.all([
        fs.readFile(filePath1),
        fs.readFile(filePath2)
      ]);

      const checksum1 = await this.calculateFileHash(buffer1);
      const checksum2 = await this.calculateFileHash(buffer2);

      if (checksum1 === checksum2) {
        return {
          hasChanges: false,
          changes: { added: [], removed: [], modified: [] },
          similarity: 1.0
        };
      }

      // Simple text comparison for text files
      if (filePath1.endsWith('.txt') && filePath2.endsWith('.txt')) {
        const text1 = buffer1.toString('utf-8');
        const text2 = buffer2.toString('utf-8');
        
        const lines1 = text1.split('\n');
        const lines2 = text2.split('\n');
        
        const added: string[] = [];
        const removed: string[] = [];
        const modified: string[] = [];

        lines2.forEach((line, index) => {
          if (!lines1.includes(line)) {
            added.push(line);
          }
        });

        lines1.forEach((line, index) => {
          if (!lines2.includes(line)) {
            removed.push(line);
          }
        });

        const similarity = this.calculateSimilarity(lines1, lines2);

        return {
          hasChanges: true,
          changes: { added, removed, modified },
          similarity
        };
      }

      // For binary files, use simple size comparison
      const sizeDiff = Math.abs(buffer1.length - buffer2.length);
      const similarity = 1 - (sizeDiff / Math.max(buffer1.length, buffer2.length));

      return {
        hasChanges: true,
        changes: { 
          added: [`Size difference: ${sizeDiff} bytes`], 
          removed: [], 
          modified: [] 
        },
        similarity
      };

    } catch (error) {
      console.error('Error comparing files:', error);
      return {
        hasChanges: true,
        changes: { added: [], removed: [], modified: ['Comparison failed'] },
        similarity: 0
      };
    }
  }

  private calculateSimilarity(lines1: string[], lines2: string[]): number {
    const intersection = lines1.filter(line => lines2.includes(line));
    const union = [...new Set([...lines1, ...lines2])];
    
    return union.length > 0 ? intersection.length / union.length : 0;
  }

  private async createDeltaPatch(originalPath: string, modifiedPath: string): Promise<Buffer> {
    // This is a simplified implementation
    // In a real implementation, you would use a proper diff algorithm
    try {
      const [originalBuffer, modifiedBuffer] = await Promise.all([
        fs.readFile(originalPath),
        fs.readFile(modifiedPath)
      ]);

      // For now, just return the modified file as the "patch"
      // In a real implementation, you would create a proper binary diff
      return modifiedBuffer;
    } catch (error) {
      console.error('Error creating delta patch:', error);
      throw error;
    }
  }

  private async applyDeltaPatch(originalPath: string, patchPath: string): Promise<Buffer> {
    // This is a simplified implementation
    // In a real implementation, you would apply the delta patch
    try {
      return await fs.readFile(patchPath);
    } catch (error) {
      console.error('Error applying delta patch:', error);
      throw error;
    }
  }

  async uploadVersion(
    fileBuffer: Buffer,
    originalName: string,
    options: VersionedFileUploadOptions
  ): Promise<VersionedFileStorageResult> {
    const startTime = Date.now();
    const result: VersionedFileStorageResult = {
      success: false,
      filePath: '',
      filename: '',
      size: fileBuffer.length,
      mimeType: options.mimeType,
      versionNumber: options.versionNumber || 1,
      warnings: []
    };

    try {
      // Validate file using base storage service
      const validation = await this.baseStorageService.validateFile(
        fileBuffer, 
        originalName, 
        options.mimeType, 
        {
          validateMimeType: true,
          validateSize: true,
          validateExtension: true,
          checkDuplicates: false // Don't check duplicates for versions
        }
      );

      if (!validation.isValid) {
        result.error = `Validation failed: ${validation.errors.join(', ')}`;
        return result;
      }

      // Generate version filename
      const versionNumber = options.versionNumber || 1;
      const filename = options.overwrite 
        ? originalName 
        : this.generateVersionFilename(originalName, versionNumber);

      // Get storage path
      const directory = this.getStoragePath(options);
      await this.ensureDirectoryExists(directory);

      const filePath = path.join(directory, filename);

      // Check if file exists
      if (!options.overwrite && await this.baseStorageService.fileExists(filePath)) {
        result.error = 'File already exists';
        return result;
      }

      // Calculate checksum if requested
      let checksum: string | undefined;
      if (options.generateChecksum) {
        checksum = await this.calculateFileHash(fileBuffer);
        result.checksum = checksum;
      }

      // Save file
      await fs.writeFile(filePath, fileBuffer);

      // Prepare metadata
      const metadata: Record<string, unknown> = {
        ...options.metadata,
        originalName,
        uploadedAt: new Date().toISOString(),
        versionNumber,
        changeDescription: options.changeDescription || `Version ${versionNumber}`,
        validation: {
          mimeType: validation.mimeType,
          size: validation.size,
          extension: validation.extension
        }
      };

      if (options.userId) {
        metadata.uploadedBy = options.userId;
      }

      result.success = true;
      result.filePath = filePath;
      result.filename = filename;
      result.versionNumber = versionNumber;
      result.metadata = metadata;
      result.processingTime = Date.now() - startTime;

      return result;

    } catch (error) {
      result.error = `Version upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return result;
    }
  }

  async createVersionFromPrevious(
    previousVersionPath: string,
    newFileBuffer: Buffer,
    originalName: string,
    options: VersionedFileUploadOptions
  ): Promise<VersionedFileStorageResult> {
    try {
      // Compare with previous version
      const comparison = await this.compareFiles(previousVersionPath, 'temp_compare');
      
      // Write temp file for comparison
      await fs.writeFile('temp_compare', newFileBuffer);
      const comparisonResult = await this.compareFiles(previousVersionPath, 'temp_compare');
      
      // Clean up temp file
      try {
        await fs.unlink('temp_compare');
      } catch {}

      // If no significant changes, maybe skip creating new version
      if (comparisonResult.similarity > 0.99) {
        const result: VersionedFileStorageResult = {
          success: true,
          filePath: previousVersionPath,
          filename: originalName,
          size: newFileBuffer.length,
          mimeType: options.mimeType,
          versionNumber: options.versionNumber || 1,
          warnings: ['File is very similar to previous version (>99% similarity)']
        };
        return result;
      }

      // Create new version
      const versionNumber = (options.versionNumber || 0) + 1;
      return await this.uploadVersion(newFileBuffer, originalName, {
        ...options,
        versionNumber,
        changeDescription: options.changeDescription || `Changes detected (${Math.round((1 - comparisonResult.similarity) * 100)}% different)`
      });

    } catch (error) {
      const result: VersionedFileStorageResult = {
        success: false,
        filePath: '',
        filename: originalName,
        size: newFileBuffer.length,
        mimeType: options.mimeType,
        versionNumber: options.versionNumber || 1,
        error: `Version creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
      return result;
    }
  }

  async listVersions(documentId: string): Promise<Array<{
    versionNumber: number;
    filePath: string;
    size: number;
    checksum: string;
    createdAt: Date;
    changeDescription?: string;
  }>> {
    try {
      const versions: Array<{
        versionNumber: number;
        filePath: string;
        size: number;
        checksum: string;
        createdAt: Date;
        changeDescription?: string;
      }> = [];

      // Scan versions directory
      const versionsDir = path.join(this.basePath, config.storage.paths.versions);
      
      if (await this.baseStorageService.fileExists(versionsDir)) {
        const files = await fs.readdir(versionsDir);
        
        for (const file of files) {
          if (file.includes(documentId) && file.includes('_v')) {
            const filePath = path.join(versionsDir, file);
            const stats = await fs.stat(filePath);
            
            // Extract version number from filename
            const versionMatch = file.match(/_v(\d+)_/);
            const versionNumber = versionMatch ? parseInt(versionMatch[1]) : 1;
            
            versions.push({
              versionNumber,
              filePath,
              size: stats.size,
              checksum: await this.getFileChecksum(filePath),
              createdAt: stats.mtime,
              changeDescription: `Version ${versionNumber}`
            });
          }
        }
      }

      // Sort by version number (descending)
      return versions.sort((a, b) => b.versionNumber - a.versionNumber);

    } catch (error) {
      console.error('Error listing versions:', error);
      return [];
    }
  }

  async getVersion(documentId: string, versionNumber: number): Promise<VersionedFileStorageResult> {
    try {
      const versions = await this.listVersions(documentId);
      const version = versions.find(v => v.versionNumber === versionNumber);
      
      if (!version) {
        return {
          success: false,
          filePath: '',
          filename: '',
          size: 0,
          mimeType: '',
          versionNumber,
          error: 'Version not found'
        };
      }

      const result = await this.baseStorageService.downloadFile(version.filePath);
      
      return {
        success: result.success,
        filePath: version.filePath,
        filename: path.basename(version.filePath),
        size: version.size,
        mimeType: 'application/octet-stream', // Would need to detect from file
        versionNumber,
        checksum: version.checksum,
        error: result.error
      };

    } catch (error) {
      return {
        success: false,
        filePath: '',
        filename: '',
        size: 0,
        mimeType: '',
        versionNumber,
        error: `Get version failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async getLatestVersion(documentId: string): Promise<VersionedFileStorageResult> {
    try {
      const versions = await this.listVersions(documentId);
      
      if (versions.length === 0) {
        return {
          success: false,
          filePath: '',
          filename: '',
          size: 0,
          mimeType: '',
          versionNumber: 1,
          error: 'No versions found'
        };
      }

      const latestVersion = versions[0];
      const result = await this.baseStorageService.downloadFile(latestVersion.filePath);
      
      return {
        success: result.success,
        filePath: latestVersion.filePath,
        filename: path.basename(latestVersion.filePath),
        size: latestVersion.size,
        mimeType: 'application/octet-stream',
        versionNumber: latestVersion.versionNumber,
        checksum: latestVersion.checksum,
        error: result.error
      };

    } catch (error) {
      return {
        success: false,
        filePath: '',
        filename: '',
        size: 0,
        mimeType: '',
        versionNumber: 1,
        error: `Get latest version failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async compareVersions(
    documentId: string, 
    version1: number, 
    version2: number
  ): Promise<VersionComparisonResult> {
    try {
      const [v1Result, v2Result] = await Promise.all([
        this.getVersion(documentId, version1),
        this.getVersion(documentId, version2)
      ]);

      if (!v1Result.success || !v2Result.success) {
        throw new Error('Could not retrieve one or both versions');
      }

      if (!v1Result.filePath || !v2Result.filePath) {
        throw new Error('Version file paths not available');
      }

      return await this.compareFiles(v1Result.filePath, v2Result.filePath);

    } catch (error) {
      console.error('Error comparing versions:', error);
      return {
        hasChanges: false,
        changes: { added: [], removed: [], modified: [] },
        similarity: 0
      };
    }
  }

  async deleteVersion(documentId: string, versionNumber: number): Promise<boolean> {
    try {
      const versions = await this.listVersions(documentId);
      const version = versions.find(v => v.versionNumber === versionNumber);
      
      if (!version) {
        return false;
      }

      // Don't allow deleting the latest version if there are other versions
      if (versionNumber === versions[0].versionNumber && versions.length > 1) {
        return false;
      }

      await fs.unlink(version.filePath);
      return true;

    } catch (error) {
      console.error('Error deleting version:', error);
      return false;
    }
  }

  async cleanupOldVersions(documentId: string, keepCount: number = 10): Promise<{
    success: boolean;
    deletedVersions: number;
    freedSpace: number;
  }> {
    try {
      const versions = await this.listVersions(documentId);
      
      if (versions.length <= keepCount) {
        return {
          success: true,
          deletedVersions: 0,
          freedSpace: 0
        };
      }

      const versionsToDelete = versions.slice(keepCount);
      let deletedVersions = 0;
      let freedSpace = 0;

      for (const version of versionsToDelete) {
        try {
          const stats = await fs.stat(version.filePath);
          await fs.unlink(version.filePath);
          deletedVersions++;
          freedSpace += stats.size;
        } catch (error) {
          console.error(`Error deleting version ${version.versionNumber}:`, error);
        }
      }

      return {
        success: true,
        deletedVersions,
        freedSpace
      };

    } catch (error) {
      console.error('Error cleaning up old versions:', error);
      return {
        success: false,
        deletedVersions: 0,
        freedSpace: 0
      };
    }
  }

  async createVersionSummary(documentId: string): Promise<{
    totalVersions: number;
    totalSize: number;
    latestVersion: number;
    oldestVersion: number;
    averageSize: number;
    growthTrend: 'increasing' | 'decreasing' | 'stable';
  }> {
    try {
      const versions = await this.listVersions(documentId);
      
      if (versions.length === 0) {
        return {
          totalVersions: 0,
          totalSize: 0,
          latestVersion: 0,
          oldestVersion: 0,
          averageSize: 0,
          growthTrend: 'stable'
        };
      }

      const totalSize = versions.reduce((sum, v) => sum + v.size, 0);
      const averageSize = totalSize / versions.length;
      
      // Calculate growth trend
      const recentVersions = versions.slice(0, Math.min(3, versions.length));
      const olderVersions = versions.slice(Math.min(3, versions.length));
      
      const recentAvgSize = recentVersions.reduce((sum, v) => sum + v.size, 0) / recentVersions.length;
      const olderAvgSize = olderVersions.length > 0 
        ? olderVersions.reduce((sum, v) => sum + v.size, 0) / olderVersions.length 
        : recentAvgSize;

      let growthTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (recentAvgSize > olderAvgSize * 1.1) {
        growthTrend = 'increasing';
      } else if (recentAvgSize < olderAvgSize * 0.9) {
        growthTrend = 'decreasing';
      }

      return {
        totalVersions: versions.length,
        totalSize,
        latestVersion: versions[0].versionNumber,
        oldestVersion: versions[versions.length - 1].versionNumber,
        averageSize,
        growthTrend
      };

    } catch (error) {
      console.error('Error creating version summary:', error);
      return {
        totalVersions: 0,
        totalSize: 0,
        latestVersion: 0,
        oldestVersion: 0,
        averageSize: 0,
        growthTrend: 'stable'
      };
    }
  }

  async rollbackToVersion(documentId: string, targetVersion: number): Promise<VersionedFileStorageResult> {
    try {
      const versions = await this.listVersions(documentId);
      const targetVersionData = versions.find(v => v.versionNumber === targetVersion);
      
      if (!targetVersionData) {
        return {
          success: false,
          filePath: '',
          filename: '',
          size: 0,
          mimeType: '',
          versionNumber: targetVersion,
          error: 'Target version not found'
        };
      }

      // Get the target version file
      const targetResult = await this.getVersion(documentId, targetVersion);
      
      if (!targetResult.success || !targetResult.buffer) {
        return {
          success: false,
          filePath: '',
          filename: '',
          size: 0,
          mimeType: '',
          versionNumber: targetVersion,
          error: 'Could not retrieve target version'
        };
      }

      // Create a new version as the rollback
      const rollbackVersion = Math.max(...versions.map(v => v.versionNumber)) + 1;
      
      return await this.uploadVersion(targetResult.buffer, targetVersionData.filePath, {
        filename: targetVersionData.filePath,
        mimeType: 'application/octet-stream',
        category: 'versions',
        versionNumber: rollbackVersion,
        changeDescription: `Rollback to version ${targetVersion}`,
        generateChecksum: true
      });

    } catch (error) {
      return {
        success: false,
        filePath: '',
        filename: '',
        size: 0,
        mimeType: '',
        versionNumber: targetVersion,
        error: `Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

export const versionControlStorageService = new VersionControlStorageService();