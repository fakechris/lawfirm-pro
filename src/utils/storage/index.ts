import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config';

export interface StorageOptions {
  category: 'documents' | 'templates' | 'evidence' | 'temp';
  subcategory?: 'original' | 'versions' | 'processed' | 'active' | 'archive' | 'thumbnails' | 'uploads';
  filename?: string;
  mimeType?: string;
}

export class StorageService {
  private basePath: string;

  constructor() {
    this.basePath = config.storage.basePath;
  }

  async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  generateUniqueFilename(originalName: string): string {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    return `${timestamp}-${random}${ext}`;
  }

  getStoragePath(options: StorageOptions): string {
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

  async saveFile(
    fileBuffer: Buffer,
    originalName: string,
    options: StorageOptions
  ): Promise<{ filePath: string; filename: string; size: number }> {
    const filename = options.filename || this.generateUniqueFilename(originalName);
    const directory = this.getStoragePath(options);
    const filePath = path.join(directory, filename);

    await this.ensureDirectoryExists(directory);
    await fs.writeFile(filePath, fileBuffer);

    return {
      filePath,
      filename,
      size: fileBuffer.length
    };
  }

  async getFile(filePath: string): Promise<Buffer> {
    try {
      return await fs.readFile(filePath);
    } catch (error) {
      throw new Error(`File not found: ${filePath}`);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      throw new Error(`Failed to delete file: ${filePath}`);
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
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  async copyFile(sourcePath: string, destinationPath: string): Promise<void> {
    await this.ensureDirectoryExists(path.dirname(destinationPath));
    await fs.copyFile(sourcePath, destinationPath);
  }

  async moveFile(sourcePath: string, destinationPath: string): Promise<void> {
    await this.ensureDirectoryExists(path.dirname(destinationPath));
    await fs.rename(sourcePath, destinationPath);
  }

  calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  async cleanupTempFiles(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    const tempDir = path.join(this.basePath, config.storage.paths.temp.uploads);
    const now = Date.now();

    try {
      const files = await fs.readdir(tempDir);
      
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      // Temp directory might not exist yet
      console.warn('Failed to cleanup temp files:', error);
    }
  }

  validateMimeType(mimeType: string): boolean {
    return config.storage.allowedMimeTypes.includes(mimeType);
  }

  validateFileSize(size: number): boolean {
    return size <= config.storage.maxFileSize;
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
}

export const storageService = new StorageService();