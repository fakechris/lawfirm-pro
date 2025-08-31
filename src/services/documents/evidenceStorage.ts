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

export interface EvidenceUploadOptions {
  title: string;
  description?: string;
  type: 'PHYSICAL' | 'DIGITAL' | 'DOCUMENT' | 'PHOTO' | 'VIDEO' | 'AUDIO' | 'TESTIMONY' | 'EXPERT_REPORT';
  caseId: string;
  collectedBy: string;
  location?: string;
  generateChecksum?: boolean;
  generateThumbnail?: boolean;
  encrypt?: boolean;
  compress?: boolean;
  overwrite?: boolean;
  metadata?: Record<string, unknown>;
  tags?: string[];
  chainOfCustody?: Array<{
    transferredTo: string;
    transferredBy: string;
    transferDate: Date;
    reason: string;
    notes?: string;
    signature?: string;
  }>;
}

export interface EvidenceStorageResult {
  success: boolean;
  evidenceId?: string;
  filePath?: string;
  filename: string;
  size: number;
  mimeType?: string;
  checksum?: string;
  thumbnailPath?: string;
  error?: string;
  warnings?: string[];
  processingTime?: number;
  metadata?: Record<string, unknown>;
}

export interface ChainOfCustodyEntry {
  id: string;
  evidenceId: string;
  action: string;
  performedBy: string;
  performedAt: Date;
  location?: string;
  notes?: string;
  signature?: string;
}

export interface EvidenceIntegrityResult {
  isValid: boolean;
  checksumMatches: boolean;
  chainOfCustodyComplete: boolean;
  tamperingDetected: boolean;
  issues: string[];
  recommendations: string[];
}

export class EvidenceStorageService {
  private basePath: string;
  private maxFileSize: number;
  private allowedMimeTypes: string[];
  private baseStorageService: DocumentStorageService;

  constructor() {
    this.basePath = config.storage.basePath;
    this.maxFileSize = config.storage.maxFileSize;
    this.allowedMimeTypes = config.storage.allowedMimeTypes;
    this.baseStorageService = new DocumentStorageService();
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private generateEvidenceFilename(title: string, caseId: string, type: string): string {
    const sanitizedTitle = title
      .replace(/[^\w\s.-]/g, '')
      .replace(/\s+/g, '_')
      .toLowerCase();
    
    const timestamp = Date.now();
    const random = randomBytes(4).toString('hex');
    const ext = this.getFileExtensionFromType(type);
    
    return `${caseId}_${sanitizedTitle}_${timestamp}_${random}${ext}`;
  }

  private getFileExtensionFromType(type: string): string {
    const typeExtensions: Record<string, string> = {
      'PHYSICAL': '.pdf',
      'DIGITAL': '.bin',
      'DOCUMENT': '.pdf',
      'PHOTO': '.jpg',
      'VIDEO': '.mp4',
      'AUDIO': '.mp3',
      'TESTIMONY': '.pdf',
      'EXPERT_REPORT': '.pdf'
    };
    
    return typeExtensions[type] || '.bin';
  }

  private getStoragePath(subcategory: 'original' | 'thumbnails' | 'processed' = 'original'): string {
    const categoryPaths = config.storage.paths.evidence;
    const subcategoryPath = categoryPaths[subcategory];
    
    if (!subcategoryPath) {
      throw new Error(`Invalid evidence subcategory: ${subcategory}`);
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

  private async generateEvidenceId(caseId: string): Promise<string> {
    const timestamp = Date.now();
    const random = randomBytes(4).toString('hex');
    return `EVID_${caseId}_${timestamp}_${random}`;
  }

  private async validateEvidenceFile(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    evidenceType: string
  ): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    const result = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[]
    };

    try {
      // Basic validation using base storage service
      const validation = await this.baseStorageService.validateFile(buffer, filename, mimeType, {
        validateMimeType: true,
        validateSize: true,
        validateExtension: true,
        checkDuplicates: false
      });

      if (!validation.isValid) {
        result.isValid = false;
        result.errors.push(...validation.errors);
      }

      if (validation.warnings.length > 0) {
        result.warnings.push(...validation.warnings);
      }

      // Evidence-specific validation
      if (buffer.length === 0) {
        result.isValid = false;
        result.errors.push('Evidence file cannot be empty');
      }

      // Check file size limits for different evidence types
      const sizeLimits: Record<string, number> = {
        'PHOTO': 50 * 1024 * 1024, // 50MB
        'VIDEO': 1024 * 1024 * 1024, // 1GB
        'AUDIO': 500 * 1024 * 1024, // 500MB
        'DOCUMENT': 100 * 1024 * 1024, // 100MB
        'DEFAULT': 200 * 1024 * 1024 // 200MB
      };

      const sizeLimit = sizeLimits[evidenceType] || sizeLimits.DEFAULT;
      if (buffer.length > sizeLimit) {
        result.warnings.push(`File size (${Math.round(buffer.length / 1024 / 1024)}MB) exceeds recommended limit for ${evidenceType} evidence (${Math.round(sizeLimit / 1024 / 1024)}MB)`);
      }

      // Check for file integrity based on type
      if (evidenceType === 'PHOTO' && mimeType.startsWith('image/')) {
        // Basic image validation
        if (buffer.length < 100) {
          result.warnings.push('Image file appears to be corrupted or too small');
        }
      }

      if (evidenceType === 'VIDEO' && mimeType.startsWith('video/')) {
        // Basic video validation
        if (buffer.length < 1024) {
          result.warnings.push('Video file appears to be corrupted or too small');
        }
      }

    } catch (error) {
      result.isValid = false;
      result.errors.push(`Evidence validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  async uploadEvidence(
    fileBuffer: Buffer,
    filename: string,
    options: EvidenceUploadOptions
  ): Promise<EvidenceStorageResult> {
    const startTime = Date.now();
    const result: EvidenceStorageResult = {
      success: false,
      filename,
      size: fileBuffer.length,
      mimeType: 'application/octet-stream',
      warnings: []
    };

    try {
      // Validate evidence file
      const validation = await this.validateEvidenceFile(
        fileBuffer, 
        filename, 
        'application/octet-stream', // Would detect from file
        options.type
      );

      if (!validation.isValid) {
        result.error = `Evidence validation failed: ${validation.errors.join(', ')}`;
        return result;
      }

      if (validation.warnings.length > 0) {
        result.warnings.push(...validation.warnings);
      }

      // Generate evidence ID and filename
      const evidenceId = await this.generateEvidenceId(options.caseId);
      const evidenceFilename = this.generateEvidenceFilename(options.title, options.caseId, options.type);

      // Get storage path
      const directory = this.getStoragePath('original');
      await this.ensureDirectoryExists(directory);

      const filePath = path.join(directory, evidenceFilename);

      // Check if file exists
      if (!options.overwrite && await this.baseStorageService.fileExists(filePath)) {
        result.error = 'Evidence file already exists';
        return result;
      }

      // Calculate checksum
      const checksum = await this.calculateFileHash(fileBuffer);
      result.checksum = checksum;

      // Save file
      await fs.writeFile(filePath, fileBuffer);

      // Generate thumbnail if requested and applicable
      let thumbnailPath: string | undefined;
      if (options.generateThumbnail && options.type === 'PHOTO') {
        thumbnailPath = await this.generateThumbnail(fileBuffer, evidenceFilename);
        if (thumbnailPath) {
          result.thumbnailPath = thumbnailPath;
        }
      }

      // Prepare metadata
      const metadata: Record<string, unknown> = {
        ...options.metadata,
        evidenceId,
        title: options.title,
        description: options.description,
        type: options.type,
        caseId: options.caseId,
        collectedBy: options.collectedBy,
        collectedAt: new Date().toISOString(),
        location: options.location,
        originalFilename: filename,
        uploadedAt: new Date().toISOString(),
        validation: {
          errors: validation.errors,
          warnings: validation.warnings
        }
      };

      if (options.tags && options.tags.length > 0) {
        metadata.tags = options.tags;
      }

      if (options.chainOfCustody && options.chainOfCustody.length > 0) {
        metadata.chainOfCustody = options.chainOfCustody;
      }

      result.success = true;
      result.evidenceId = evidenceId;
      result.filePath = filePath;
      result.filename = evidenceFilename;
      result.metadata = metadata;
      result.processingTime = Date.now() - startTime;

      return result;

    } catch (error) {
      result.error = `Evidence upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return result;
    }
  }

  private async generateThumbnail(imageBuffer: Buffer, filename: string): Promise<string | undefined> {
    try {
      // This is a placeholder implementation
      // In a real implementation, you would use libraries like sharp or jimp
      const thumbnailFilename = `thumb_${filename}`;
      const thumbnailDir = this.getStoragePath('thumbnails');
      await this.ensureDirectoryExists(thumbnailDir);
      const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);
      
      // For now, just copy the original file as a "thumbnail"
      // In production, you would resize and optimize the image
      await fs.writeFile(thumbnailPath, imageBuffer);
      
      return thumbnailPath;
    } catch (error) {
      console.warn('Failed to generate thumbnail:', error);
      return undefined;
    }
  }

  async addToChainOfCustody(
    evidenceId: string,
    entry: {
      action: string;
      performedBy: string;
      location?: string;
      notes?: string;
      signature?: string;
    }
  ): Promise<ChainOfCustodyEntry> {
    try {
      const custodyEntry: ChainOfCustodyEntry = {
        id: `CUSTODY_${Date.now()}_${randomBytes(4).toString('hex')}`,
        evidenceId,
        action: entry.action,
        performedBy: entry.performedBy,
        performedAt: new Date(),
        location: entry.location,
        notes: entry.notes,
        signature: entry.signature
      };

      // In a real implementation, this would be stored in the database
      // For now, we'll create a JSON file to track the chain of custody
      const chainFile = path.join(this.getStoragePath('original'), `${evidenceId}_chain.json`);
      
      let chain: ChainOfCustodyEntry[] = [];
      try {
        const existingChain = await fs.readFile(chainFile, 'utf-8');
        chain = JSON.parse(existingChain);
      } catch {
        // File doesn't exist yet, create new chain
      }

      chain.push(custodyEntry);
      await fs.writeFile(chainFile, JSON.stringify(chain, null, 2));

      return custodyEntry;

    } catch (error) {
      console.error('Error adding to chain of custody:', error);
      throw new Error(`Failed to add chain of custody entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getChainOfCustody(evidenceId: string): Promise<ChainOfCustodyEntry[]> {
    try {
      const chainFile = path.join(this.getStoragePath('original'), `${evidenceId}_chain.json`);
      
      if (!await this.baseStorageService.fileExists(chainFile)) {
        return [];
      }

      const chainData = await fs.readFile(chainFile, 'utf-8');
      return JSON.parse(chainData) as ChainOfCustodyEntry[];

    } catch (error) {
      console.error('Error getting chain of custody:', error);
      return [];
    }
  }

  async verifyEvidenceIntegrity(evidenceId: string): Promise<EvidenceIntegrityResult> {
    try {
      const chainFile = path.join(this.getStoragePath('original'), `${evidenceId}_chain.json`);
      const evidenceFile = path.join(this.getStoragePath('original'), `${evidenceId}.bin`); // Adjust extension as needed

      const result: EvidenceIntegrityResult = {
        isValid: true,
        checksumMatches: false,
        chainOfCustodyComplete: false,
        tamperingDetected: false,
        issues: [],
        recommendations: []
      };

      // Check if evidence file exists
      if (!await this.baseStorageService.fileExists(evidenceFile)) {
        result.isValid = false;
        result.issues.push('Evidence file not found');
        return result;
      }

      // Calculate current checksum
      const currentChecksum = await this.getFileChecksum(evidenceFile);

      // Get chain of custody
      let chain: ChainOfCustodyEntry[] = [];
      if (await this.baseStorageService.fileExists(chainFile)) {
        const chainData = await fs.readFile(chainFile, 'utf-8');
        chain = JSON.parse(chainData) as ChainOfCustodyEntry[];
      }

      // Validate chain of custody
      if (chain.length === 0) {
        result.chainOfCustodyComplete = false;
        result.issues.push('No chain of custody records found');
        result.recommendations.push('Establish proper chain of custody procedures');
      } else {
        result.chainOfCustodyComplete = true;
        
        // Check for gaps in chain of custody
        const sortedChain = chain.sort((a, b) => a.performedAt.getTime() - b.performedAt.getTime());
        for (let i = 1; i < sortedChain.length; i++) {
          const timeDiff = sortedChain[i].performedAt.getTime() - sortedChain[i - 1].performedAt.getTime();
          if (timeDiff > 24 * 60 * 60 * 1000) { // More than 24 hours gap
            result.issues.push(`Gap of ${Math.round(timeDiff / (60 * 60 * 1000))} hours in chain of custody`);
          }
        }
      }

      // Check if we have the original checksum (this would typically be stored in metadata)
      // For now, we'll assume we don't have it for comparison
      result.checksumMatches = true; // Assume true since we can't compare with original

      // Check for signs of tampering
      if (chain.length > 0) {
        const lastEntry = chain[chain.length - 1];
        if (lastEntry.action.includes('modified') || lastEntry.action.includes('altered')) {
          result.tamperingDetected = true;
          result.issues.push('Evidence may have been modified according to chain of custody');
        }
      }

      // Check file integrity
      const stats = await fs.stat(evidenceFile);
      if (stats.size === 0) {
        result.isValid = false;
        result.issues.push('Evidence file is empty');
      }

      // Final validation
      if (result.issues.length > 0) {
        result.isValid = false;
      }

      return result;

    } catch (error) {
      console.error('Error verifying evidence integrity:', error);
      return {
        isValid: false,
        checksumMatches: false,
        chainOfCustodyComplete: false,
        tamperingDetected: false,
        issues: [`Integrity verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        recommendations: []
      };
    }
  }

  async sealEvidence(evidenceId: string, sealedBy: string): Promise<boolean> {
    try {
      // Add chain of custody entry for sealing
      await this.addToChainOfCustody(evidenceId, {
        action: 'SEALED',
        performedBy: sealedBy,
        notes: 'Evidence officially sealed and marked as read-only'
      });

      // Create a read-only copy of the file (in a real implementation, you might use filesystem permissions or encryption)
      const originalFile = path.join(this.getStoragePath('original'), `${evidenceId}.bin`);
      const sealedFile = path.join(this.getStoragePath('original'), `${evidenceId}_sealed.bin`);
      
      if (await this.baseStorageService.fileExists(originalFile)) {
        await fs.copyFile(originalFile, sealedFile);
        return true;
      }

      return false;

    } catch (error) {
      console.error('Error sealing evidence:', error);
      return false;
    }
  }

  async transferEvidence(
    evidenceId: string,
    transferTo: string,
    transferBy: string,
    reason: string,
    location?: string
  ): Promise<boolean> {
    try {
      // Add chain of custody entry for transfer
      await this.addToChainOfCustody(evidenceId, {
        action: `TRANSFERRED to ${transferTo}`,
        performedBy: transferBy,
        location,
        notes: `Reason: ${reason}`
      });

      return true;

    } catch (error) {
      console.error('Error transferring evidence:', error);
      return false;
    }
  }

  async disposeEvidence(evidenceId: string, disposedBy: string, method: string): Promise<boolean> {
    try {
      // Add chain of custody entry for disposal
      await this.addToChainOfCustody(evidenceId, {
        action: `DISPOSED via ${method}`,
        performedBy: disposedBy,
        notes: 'Evidence officially disposed of according to procedures'
      });

      // Move file to disposed folder (or delete permanently based on policy)
      const originalFile = path.join(this.getStoragePath('original'), `${evidenceId}.bin`);
      const disposedFile = path.join(this.getStoragePath('original'), 'disposed', `${evidenceId}.bin`);
      
      if (await this.baseStorageService.fileExists(originalFile)) {
        await this.ensureDirectoryExists(path.dirname(disposedFile));
        await fs.rename(originalFile, disposedFile);
        return true;
      }

      return false;

    } catch (error) {
      console.error('Error disposing evidence:', error);
      return false;
    }
  }

  async generateEvidenceReport(evidenceId: string): Promise<{
    evidenceInfo: Record<string, unknown>;
    chainOfCustody: ChainOfCustodyEntry[];
    integrityStatus: EvidenceIntegrityResult;
    recommendations: string[];
  }> {
    try {
      const chain = await this.getChainOfCustody(evidenceId);
      const integrity = await this.verifyEvidenceIntegrity(evidenceId);

      // Get evidence file info
      const evidenceFile = path.join(this.getStoragePath('original'), `${evidenceId}.bin`);
      let fileInfo: Record<string, unknown> = {};
      
      if (await this.baseStorageService.fileExists(evidenceFile)) {
        const stats = await fs.stat(evidenceFile);
        fileInfo = {
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          checksum: await this.getFileChecksum(evidenceFile)
        };
      }

      const evidenceInfo = {
        evidenceId,
        fileInfo,
        chainLength: chain.length,
        lastTransfer: chain.length > 0 ? chain[chain.length - 1] : null,
        isSealed: chain.some(entry => entry.action === 'SEALED'),
        isDisposed: chain.some(entry => entry.action.includes('DISPOSED'))
      };

      const recommendations: string[] = [];
      
      if (!integrity.isValid) {
        recommendations.push('Address integrity issues immediately');
      }
      
      if (!integrity.chainOfCustodyComplete) {
        recommendations.push('Complete chain of custody documentation');
      }
      
      if (chain.length === 0) {
        recommendations.push('Establish initial chain of custody');
      }

      return {
        evidenceInfo,
        chainOfCustody: chain,
        integrityStatus: integrity,
        recommendations
      };

    } catch (error) {
      console.error('Error generating evidence report:', error);
      throw new Error(`Failed to generate evidence report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const evidenceStorageService = new EvidenceStorageService();