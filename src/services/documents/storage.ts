import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createHash, randomBytes } from 'crypto';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { createReadStream, createWriteStream } from 'fs';
import { config } from '../config';

const pipelineAsync = promisify(pipeline);

export interface FileUploadOptions {
  filename: string;
  mimeType: string;
  category: 'documents' | 'versions' | 'templates' | 'evidence' | 'thumbnails' | 'temp';
  subcategory?: 'original' | 'processed' | 'active' | 'archive' | 'uploads';
  generateChecksum?: boolean;
  generateThumbnail?: boolean;
  encrypt?: boolean;
  compress?: boolean;
  overwrite?: boolean;
  metadata?: Record<string, unknown>;
  userId?: string;
}

export interface FileValidationOptions {
  validateMimeType?: boolean;
  validateSize?: boolean;
  validateExtension?: boolean;
  virusScan?: boolean;
  checkDuplicates?: boolean;
}

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  mimeType?: {
    detected: string;
    expected?: string;
    matches: boolean;
  };
  extension?: {
    detected: string;
    allowed: boolean;
  };
  size?: {
    actual: number;
    maximum: number;
    withinLimit: boolean;
  };
  virusScan?: {
    isClean: boolean;
    threats?: string[];
  };
  duplicates?: {
    exists: boolean;
    existingFiles?: string[];
  };
}

export interface FileStorageResult {
  success: boolean;
  filePath: string;
  filename: string;
  size: number;
  mimeType: string;
  checksum?: string;
  thumbnailPath?: string;
  metadata?: Record<string, unknown>;
  error?: string;
  warnings?: string[];
  processingTime?: number;
}

export interface FileRetrievalOptions {
  decrypt?: boolean;
  decompress?: boolean;
  validateChecksum?: boolean;
  includeMetadata?: boolean;
}

export interface FileRetrievalResult {
  success: boolean;
  buffer?: Buffer;
  stream?: NodeJS.ReadableStream;
  filePath?: string;
  size?: number;
  mimeType?: string;
  checksum?: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface StorageUsageInfo {
  totalUsed: number;
  totalAvailable: number;
  usedPercentage: number;
  byCategory: Record<string, {
    used: number;
    fileCount: number;
    averageSize: number;
  }>;
  largestFiles: Array<{
    filePath: string;
    size: number;
    mimeType: string;
    lastModified: Date;
  }>;
}

export interface CleanupOptions {
  tempFilesOlderThan?: number; // hours
  versionsOlderThan?: number; // days
  duplicates?: boolean;
  corrupted?: boolean;
  dryRun?: boolean;
  includeThumbnails?: boolean;
}

export interface CleanupResult {
  success: boolean;
  deletedFiles: number;
  freedSpace: number;
  errors?: string[];
  details: {
    tempFiles: number;
    oldVersions: number;
    duplicates: number;
    corrupted: number;
    thumbnails: number;
  };
}

export class DocumentStorageService {
  private basePath: string;
  private maxFileSize: number;
  private allowedMimeTypes: string[];
  private allowedExtensions: string[];

  constructor() {
    this.basePath = config.storage.basePath;
    this.maxFileSize = config.storage.maxFileSize;
    this.allowedMimeTypes = config.storage.allowedMimeTypes;
    this.allowedExtensions = [
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.txt', '.jpg', '.jpeg', '.png', '.tiff', '.mp3', '.wav', '.mp4', '.avi',
      '.zip', '.csv', '.rtf', '.odt', '.ods', '.odp'
    ];
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private generateUniqueFilename(originalName: string): string {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const random = randomBytes(4).toString('hex');
    return `${timestamp}-${random}${ext}`;
  }

  private generateSecureFilename(originalName: string): string {
    const sanitized = originalName
      .replace(/[^\w\s.-]/g, '')
      .replace(/\s+/g, '_')
      .toLowerCase();
    
    const ext = path.extname(sanitized);
    const name = path.basename(sanitized, ext);
    const timestamp = Date.now();
    const random = randomBytes(4).toString('hex');
    
    return `${name}_${timestamp}_${random}${ext}`;
  }

  private getStoragePath(options: FileUploadOptions): string {
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

  private async detectMimeType(buffer: Buffer, filename: string): Promise<string> {
    const ext = path.extname(filename).toLowerCase();
    
    // Basic MIME type detection based on file extension
    const mimeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.tiff': 'image/tiff',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.zip': 'application/zip'
    };

    return mimeMap[ext] || 'application/octet-stream';
  }

  private async validateFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    options: FileValidationOptions = {}
  ): Promise<FileValidationResult> {
    const result: FileValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // Validate MIME type
      if (options.validateMimeType !== false) {
        const detectedMime = await this.detectMimeType(buffer, originalName);
        const isAllowed = this.allowedMimeTypes.includes(detectedMime);
        
        result.mimeType = {
          detected: detectedMime,
          expected: mimeType,
          matches: detectedMime === mimeType
        };

        if (!isAllowed) {
          result.isValid = false;
          result.errors.push(`File type not allowed: ${detectedMime}`);
        }

        if (detectedMime !== mimeType) {
          result.warnings.push(`MIME type mismatch: declared ${mimeType}, detected ${detectedMime}`);
        }
      }

      // Validate file size
      if (options.validateSize !== false) {
        const maxSize = this.maxFileSize;
        result.size = {
          actual: buffer.length,
          maximum: maxSize,
          withinLimit: buffer.length <= maxSize
        };

        if (buffer.length > maxSize) {
          result.isValid = false;
          result.errors.push(`File size exceeds maximum limit of ${maxSize} bytes`);
        }
      }

      // Validate file extension
      if (options.validateExtension !== false) {
        const ext = path.extname(originalName).toLowerCase();
        const isAllowed = this.allowedExtensions.includes(ext);
        
        result.extension = {
          detected: ext,
          allowed: isAllowed
        };

        if (!isAllowed) {
          result.isValid = false;
          result.errors.push(`File extension not allowed: ${ext}`);
        }
      }

      // Check for duplicates
      if (options.checkDuplicates) {
        const checksum = await this.calculateFileHash(buffer);
        const existingFiles = await this.findFilesByChecksum(checksum);
        
        result.duplicates = {
          exists: existingFiles.length > 0,
          existingFiles: existingFiles.slice(0, 5) // Limit to 5 results
        };

        if (existingFiles.length > 0) {
          result.warnings.push(`Duplicate file detected. ${existingFiles.length} existing files with same checksum.`);
        }
      }

      // Basic file integrity check
      try {
        if (buffer.length === 0) {
          result.isValid = false;
          result.errors.push('File is empty');
        }

        // Check for common corrupted file signatures
        if (originalName.toLowerCase().endsWith('.pdf')) {
          if (!buffer.toString('ascii', 0, 10).includes('%PDF')) {
            result.warnings.push('File may be corrupted: Invalid PDF signature');
          }
        }
      } catch (error) {
        result.warnings.push('Could not perform file integrity check');
      }

    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  private async findFilesByChecksum(checksum: string): Promise<string[]> {
    // This would typically query a database to find files with the same checksum
    // For now, we'll return an empty array
    return [];
  }

  private async generateThumbnail(imageBuffer: Buffer, mimeType: string): Promise<Buffer | null> {
    // This is a placeholder implementation
    // In a real implementation, you would use libraries like sharp or jimp
    try {
      if (mimeType.startsWith('image/')) {
        // Generate thumbnail logic would go here
        // For now, return a scaled down version or null
        return null;
      }
      return null;
    } catch (error) {
      console.warn('Failed to generate thumbnail:', error);
      return null;
    }
  }

  async uploadFile(
    fileBuffer: Buffer,
    originalName: string,
    options: FileUploadOptions
  ): Promise<FileStorageResult> {
    const startTime = Date.now();
    const result: FileStorageResult = {
      success: false,
      filePath: '',
      filename: '',
      size: fileBuffer.length,
      mimeType: options.mimeType,
      warnings: []
    };

    try {
      // Validate file
      const validation = await this.validateFile(fileBuffer, originalName, options.mimeType, {
        validateMimeType: true,
        validateSize: true,
        validateExtension: true,
        checkDuplicates: true
      });

      if (!validation.isValid) {
        result.error = `Validation failed: ${validation.errors.join(', ')}`;
        return result;
      }

      if (validation.warnings.length > 0) {
        result.warnings.push(...validation.warnings);
      }

      // Generate filename
      const filename = options.overwrite 
        ? originalName 
        : this.generateSecureFilename(originalName);

      // Get storage path
      const directory = this.getStoragePath(options);
      await this.ensureDirectoryExists(directory);

      const filePath = path.join(directory, filename);

      // Check if file exists
      if (!options.overwrite && await this.fileExists(filePath)) {
        result.error = 'File already exists';
        return result;
      }

      // Calculate checksum if requested
      let checksum: string | undefined;
      if (options.generateChecksum) {
        checksum = await this.calculateFileHash(fileBuffer);
        result.checksum = checksum;
      }

      // Generate thumbnail if requested
      let thumbnailPath: string | undefined;
      if (options.generateThumbnail) {
        const thumbnailBuffer = await this.generateThumbnail(fileBuffer, options.mimeType);
        if (thumbnailBuffer) {
          const thumbnailFilename = `thumb_${filename}`;
          const thumbnailDir = path.join(this.basePath, config.storage.paths.evidence.thumbnails);
          await this.ensureDirectoryExists(thumbnailDir);
          const thumbnailFilePath = path.join(thumbnailDir, thumbnailFilename);
          await fs.writeFile(thumbnailFilePath, thumbnailBuffer);
          thumbnailPath = thumbnailFilePath;
          result.thumbnailPath = thumbnailPath;
        }
      }

      // Save file
      await fs.writeFile(filePath, fileBuffer);

      // Prepare metadata
      const metadata: Record<string, unknown> = {
        ...options.metadata,
        originalName,
        uploadedAt: new Date().toISOString(),
        validation: {
          mimeType: validation.mimeType,
          size: validation.size,
          extension: validation.extension,
          duplicates: validation.duplicates
        }
      };

      if (options.userId) {
        metadata.uploadedBy = options.userId;
      }

      result.success = true;
      result.filePath = filePath;
      result.filename = filename;
      result.metadata = metadata;
      result.processingTime = Date.now() - startTime;

      return result;

    } catch (error) {
      result.error = `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return result;
    }
  }

  async downloadFile(
    filePath: string,
    options: FileRetrievalOptions = {}
  ): Promise<FileRetrievalResult> {
    const result: FileRetrievalResult = {
      success: false,
      filePath
    };

    try {
      // Check if file exists
      if (!await this.fileExists(filePath)) {
        result.error = 'File not found';
        return result;
      }

      // Get file stats
      const stats = await fs.stat(filePath);
      result.size = stats.size;

      // Read file
      const buffer = await fs.readFile(filePath);
      result.buffer = buffer;

      // Validate checksum if requested
      if (options.validateChecksum) {
        const checksum = await this.getFileChecksum(filePath);
        result.checksum = checksum;
      }

      result.success = true;
      return result;

    } catch (error) {
      result.error = `Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return result;
    }
  }

  async getFileStream(
    filePath: string,
    options: FileRetrievalOptions = {}
  ): Promise<FileRetrievalResult> {
    const result: FileRetrievalResult = {
      success: false,
      filePath
    };

    try {
      // Check if file exists
      if (!await this.fileExists(filePath)) {
        result.error = 'File not found';
        return result;
      }

      // Get file stats
      const stats = await fs.stat(filePath);
      result.size = stats.size;

      // Create read stream
      const stream = createReadStream(filePath);
      result.stream = stream;
      result.success = true;

      return result;

    } catch (error) {
      result.error = `Stream creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return result;
    }
  }

  async deleteFile(filePath: string, deleteThumbnails: boolean = false): Promise<boolean> {
    try {
      if (await this.fileExists(filePath)) {
        await fs.unlink(filePath);
      }

      // Delete associated thumbnails
      if (deleteThumbnails) {
        const filename = path.basename(filePath);
        const thumbnailFilename = `thumb_${filename}`;
        const thumbnailDir = path.join(this.basePath, config.storage.paths.evidence.thumbnails);
        const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);
        
        if (await this.fileExists(thumbnailPath)) {
          await fs.unlink(thumbnailPath);
        }
      }

      return true;
    } catch (error) {
      console.error(`Failed to delete file ${filePath}:`, error);
      return false;
    }
  }

  async moveFile(sourcePath: string, destinationPath: string): Promise<boolean> {
    try {
      await this.ensureDirectoryExists(path.dirname(destinationPath));
      await fs.rename(sourcePath, destinationPath);
      return true;
    } catch (error) {
      console.error(`Failed to move file from ${sourcePath} to ${destinationPath}:`, error);
      return false;
    }
  }

  async copyFile(sourcePath: string, destinationPath: string): Promise<boolean> {
    try {
      await this.ensureDirectoryExists(path.dirname(destinationPath));
      await fs.copyFile(sourcePath, destinationPath);
      return true;
    } catch (error) {
      console.error(`Failed to copy file from ${sourcePath} to ${destinationPath}:`, error);
      return false;
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch {
      throw new Error(`Cannot get file size: ${filePath}`);
    }
  }

  async getStorageUsage(): Promise<StorageUsageInfo> {
    const usage: StorageUsageInfo = {
      totalUsed: 0,
      totalAvailable: 0,
      usedPercentage: 0,
      byCategory: {},
      largestFiles: []
    };

    try {
      // Calculate usage by category
      for (const [category, paths] of Object.entries(config.storage.paths)) {
        let categoryUsed = 0;
        let fileCount = 0;
        const categoryFiles: Array<{ path: string; size: number; mime: string; modified: Date }> = [];

        for (const subcategory of Object.values(paths)) {
          const dirPath = path.join(this.basePath, subcategory);
          
          try {
            await this.scanDirectory(dirPath, (filePath, stats) => {
              categoryUsed += stats.size;
              fileCount++;
              categoryFiles.push({
                path: filePath,
                size: stats.size,
                mime: 'unknown', // Would need to detect from file
                modified: stats.mtime
              });
            });
          } catch (error) {
            // Directory might not exist
            continue;
          }
        }

        usage.byCategory[category] = {
          used: categoryUsed,
          fileCount,
          averageSize: fileCount > 0 ? categoryUsed / fileCount : 0
        };

        usage.totalUsed += categoryUsed;
      }

      // Get largest files
      const allFiles: Array<{ path: string; size: number; mime: string; modified: Date }> = [];
      for (const categoryFiles of Object.values(usage.byCategory)) {
        if (categoryFiles.fileCount > 0) {
          // Note: This is a simplified version - in practice, you'd collect actual file paths
        }
      }

      // Sort by size and take top 10
      usage.largestFiles = allFiles
        .sort((a, b) => b.size - a.size)
        .slice(0, 10);

      // Calculate percentage (assuming 1TB available for now)
      usage.totalAvailable = 1024 * 1024 * 1024 * 1024; // 1TB
      usage.usedPercentage = (usage.totalUsed / usage.totalAvailable) * 100;

    } catch (error) {
      console.error('Failed to calculate storage usage:', error);
    }

    return usage;
  }

  private async scanDirectory(
    dirPath: string,
    callback: (filePath: string, stats: any) => void
  ): Promise<void> {
    try {
      const files = await fs.readdir(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isDirectory()) {
          await this.scanDirectory(filePath, callback);
        } else {
          callback(filePath, stats);
        }
      }
    } catch (error) {
      // Directory might not exist or be inaccessible
      console.warn(`Failed to scan directory ${dirPath}:`, error);
    }
  }

  async cleanup(options: CleanupOptions = {}): Promise<CleanupResult> {
    const result: CleanupResult = {
      success: true,
      deletedFiles: 0,
      freedSpace: 0,
      details: {
        tempFiles: 0,
        oldVersions: 0,
        duplicates: 0,
        corrupted: 0,
        thumbnails: 0
      }
    };

    try {
      const now = Date.now();
      const maxAge = options.tempFilesOlderThan || 24; // hours

      // Clean up temp files
      const tempDir = path.join(this.basePath, config.storage.paths.temp.uploads);
      if (await this.fileExists(tempDir)) {
        await this.scanDirectory(tempDir, async (filePath, stats) => {
          const ageInHours = (now - stats.mtime.getTime()) / (1000 * 60 * 60);
          
          if (ageInHours > maxAge) {
            if (!options.dryRun) {
              await fs.unlink(filePath);
            }
            result.deletedFiles++;
            result.freedSpace += stats.size;
            result.details.tempFiles++;
          }
        });
      }

      // Clean up old versions (if version retention is configured)
      if (options.versionsOlderThan) {
        // Implementation would depend on your version retention policy
      }

      // Clean up thumbnails of non-existent files
      if (options.includeThumbnails) {
        const thumbnailDir = path.join(this.basePath, config.storage.paths.evidence.thumbnails);
        if (await this.fileExists(thumbnailDir)) {
          // Check each thumbnail and remove if original file doesn't exist
        }
      }

    } catch (error) {
      result.success = false;
      result.errors = [`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`];
    }

    return result;
  }

  async createDirectoryStructure(): Promise<void> {
    const paths = Object.values(config.storage.paths);
    
    for (const category of paths) {
      for (const subcategory of Object.values(category)) {
        const dirPath = path.join(this.basePath, subcategory);
        await this.ensureDirectoryExists(dirPath);
      }
    }
  }

  async validateStorageHealth(): Promise<{
    healthy: boolean;
    issues: string[];
    usage: StorageUsageInfo;
  }> {
    const issues: string[] = [];
    
    try {
      // Check if base path exists and is writable
      try {
        await fs.access(this.basePath, fs.constants.W_OK);
      } catch {
        issues.push(`Storage base path is not accessible: ${this.basePath}`);
      }

      // Check directory structure
      for (const [category, paths] of Object.entries(config.storage.paths)) {
        for (const subcategory of Object.values(paths)) {
          const dirPath = path.join(this.basePath, subcategory);
          try {
            await fs.access(dirPath, fs.constants.W_OK);
          } catch {
            issues.push(`Directory is not accessible: ${dirPath}`);
          }
        }
      }

      // Check disk space
      const usage = await this.getStorageUsage();
      if (usage.usedPercentage > 90) {
        issues.push(`Storage usage is critical: ${usage.usedPercentage.toFixed(1)}%`);
      } else if (usage.usedPercentage > 75) {
        issues.push(`Storage usage is high: ${usage.usedPercentage.toFixed(1)}%`);
      }

      return {
        healthy: issues.length === 0,
        issues,
        usage
      };

    } catch (error) {
      return {
        healthy: false,
        issues: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        usage: await this.getStorageUsage()
      };
    }
  }
}

export const documentStorageService = new DocumentStorageService();