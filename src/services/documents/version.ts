import { PrismaClient } from '@prisma/client';
import { documentStorageService } from './storage';
import { 
  DocumentVersionWithDetails,
  CreateDocumentVersionInput,
  UpdateDocumentVersionInput,
  VersionComparisonResult,
  VersionHistoryOptions,
  DocumentProcessingResult
} from '../../models/documents';

export interface VersionControlOptions {
  autoSave?: boolean;
  maxVersions?: number;
  compressionEnabled?: boolean;
  deltaEncoding?: boolean;
  changeTracking?: boolean;
  approvalRequired?: boolean;
}

export interface VersionCreateOptions {
  documentId: string;
  fileBuffer: Buffer;
  originalName: string;
  mimeType: string;
  changeDescription?: string;
  createdBy: string;
  isMajor?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface VersionUpdateOptions {
  versionId: string;
  changeDescription?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  updatedBy: string;
}

export interface VersionRestoreOptions {
  documentId: string;
  versionNumber: number;
  restoreAsNew?: boolean;
  changeDescription?: string;
  restoredBy: string;
}

export interface VersionComparisonOptions {
  showLineNumbers?: boolean;
  showContext?: number;
  ignoreWhitespace?: boolean;
  ignoreCase?: boolean;
  ignoreComments?: boolean;
}

export class DocumentVersionService {
  private prisma: PrismaClient;
  private options: VersionControlOptions;

  constructor(prisma: PrismaClient, options: VersionControlOptions = {}) {
    this.prisma = prisma;
    this.options = {
      autoSave: true,
      maxVersions: 50,
      compressionEnabled: true,
      deltaEncoding: false,
      changeTracking: true,
      approvalRequired: false,
      ...options
    };
  }

  async createVersion(options: VersionCreateOptions): Promise<DocumentProcessingResult> {
    const startTime = Date.now();
    const result: DocumentProcessingResult = {
      success: false,
      filePath: '',
      filename: '',
      size: 0,
      mimeType: options.mimeType,
      checksum: ''
    };

    try {
      // Get the current document
      const document = await this.prisma.document.findUnique({
        where: { id: options.documentId },
        include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } }
      });

      if (!document) {
        result.error = 'Document not found';
        return result;
      }

      // Calculate checksum
      const checksum = await documentStorageService.calculateFileHash(options.fileBuffer);
      
      // Check if this is a duplicate of the latest version
      const latestVersion = document.versions[0];
      if (latestVersion && latestVersion.checksum === checksum) {
        result.error = 'This version is identical to the latest version';
        return result;
      }

      // Determine version number
      const latestVersionNumber = latestVersion?.versionNumber || 0;
      const versionNumber = options.isMajor ? Math.floor(latestVersionNumber / 10) * 10 + 10 : latestVersionNumber + 1;

      // Save the version file
      const storageResult = await documentStorageService.uploadFile(
        options.fileBuffer,
        options.originalName,
        {
          filename: `v${versionNumber}_${options.originalName}`,
          mimeType: options.mimeType,
          category: 'documents',
          subcategory: 'versions',
          generateChecksum: true,
          metadata: {
            documentId: options.documentId,
            versionNumber,
            createdBy: options.createdBy,
            changeDescription: options.changeDescription,
            tags: options.tags,
            isMajor: options.isMajor || false
          }
        }
      );

      if (!storageResult.success) {
        result.error = storageResult.error || 'Failed to save version file';
        return result;
      }

      // Create version record
      const version = await this.prisma.documentVersion.create({
        data: {
          documentId: options.documentId,
          versionNumber,
          filePath: storageResult.filePath,
          fileSize: storageResult.size,
          checksum: storageResult.checksum || checksum,
          changeDescription: options.changeDescription || `Version ${versionNumber}`,
          createdBy: options.createdBy
        }
      });

      // Update document version info
      await this.prisma.document.update({
        where: { id: options.documentId },
        data: {
          version: versionNumber,
          isLatest: true,
          updatedAt: new Date()
        }
      });

      // Update previous version to not be latest
      if (latestVersion) {
        await this.prisma.documentVersion.update({
          where: { id: latestVersion.id },
          data: { isLatest: false }
        });
      }

      // Clean up old versions if we exceed the limit
      await this.cleanupOldVersions(options.documentId);

      result.success = true;
      result.filePath = storageResult.filePath;
      result.filename = storageResult.filename;
      result.size = storageResult.size;
      result.checksum = checksum;
      result.processingTime = Date.now() - startTime;

      return result;

    } catch (error) {
      result.error = `Failed to create version: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return result;
    }
  }

  async getVersion(documentId: string, versionNumber: number): Promise<DocumentVersionWithDetails | null> {
    try {
      const version = await this.prisma.documentVersion.findUnique({
        where: {
          documentId_versionNumber: {
            documentId,
            versionNumber
          }
        },
        include: {
          document: true,
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      return version as DocumentVersionWithDetails;
    } catch (error) {
      console.error('Failed to get version:', error);
      return null;
    }
  }

  async getVersions(documentId: string, options?: VersionHistoryOptions): Promise<DocumentVersionWithDetails[]> {
    try {
      const where: any = { documentId };
      let orderBy: any = { versionNumber: 'desc' };
      let take: number | undefined;

      if (options?.maxVersions) {
        take = options.maxVersions;
      }

      const versions = await this.prisma.documentVersion.findMany({
        where,
        include: {
          document: true,
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy,
        take
      });

      return versions as DocumentVersionWithDetails[];
    } catch (error) {
      console.error('Failed to get versions:', error);
      return [];
    }
  }

  async getLatestVersion(documentId: string): Promise<DocumentVersionWithDetails | null> {
    try {
      const version = await this.prisma.documentVersion.findFirst({
        where: { documentId, isLatest: true },
        include: {
          document: true,
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: { versionNumber: 'desc' }
      });

      return version as DocumentVersionWithDetails;
    } catch (error) {
      console.error('Failed to get latest version:', error);
      return null;
    }
  }

  async restoreVersion(options: VersionRestoreOptions): Promise<DocumentProcessingResult> {
    const result: DocumentProcessingResult = {
      success: false,
      filePath: '',
      filename: '',
      size: 0,
      mimeType: '',
      checksum: ''
    };

    try {
      // Get the version to restore
      const versionToRestore = await this.getVersion(options.documentId, options.versionNumber);
      if (!versionToRestore) {
        result.error = 'Version not found';
        return result;
      }

      // Download the version file
      const downloadResult = await documentStorageService.downloadFile(versionToRestore.filePath);
      if (!downloadResult.success || !downloadResult.buffer) {
        result.error = 'Failed to download version file';
        return result;
      }

      if (options.restoreAsNew) {
        // Create a new version from the restored content
        const newVersionResult = await this.createVersion({
          documentId: options.documentId,
          fileBuffer: downloadResult.buffer,
          originalName: versionToRestore.document.originalName,
          mimeType: versionToRestore.document.mimeType,
          changeDescription: options.changeDescription || `Restored from version ${options.versionNumber}`,
          createdBy: options.restoredBy,
          isMajor: false,
          metadata: {
            restoredFrom: options.versionNumber,
            restoredAt: new Date().toISOString(),
            restoredBy: options.restoredBy
          }
        });

        return newVersionResult;
      } else {
        // Replace the current document with the restored version
        const document = await this.prisma.document.findUnique({
          where: { id: options.documentId }
        });

        if (!document) {
          result.error = 'Document not found';
          return result;
        }

        // Update the document file
        const storageResult = await documentStorageService.uploadFile(
          downloadResult.buffer,
          document.originalName,
          {
            filename: document.filename,
            mimeType: document.mimeType,
            category: 'documents',
            subcategory: 'original',
            overwrite: true,
            metadata: {
              restoredFrom: options.versionNumber,
              restoredAt: new Date().toISOString(),
              restoredBy: options.restoredBy
            }
          }
        );

        if (!storageResult.success) {
          result.error = storageResult.error || 'Failed to restore document file';
          return result;
        }

        // Update document record
        await this.prisma.document.update({
          where: { id: options.documentId },
          data: {
            path: storageResult.filePath,
            size: storageResult.size,
            checksum: storageResult.checksum,
            updatedAt: new Date(),
            metadata: {
              ...document.metadata as any,
              restoredFrom: options.versionNumber,
              restoredAt: new Date().toISOString(),
              restoredBy: options.restoredBy
            }
          }
        });

        result.success = true;
        result.filePath = storageResult.filePath;
        result.filename = storageResult.filename;
        result.size = storageResult.size;
        result.mimeType = document.mimeType;
        result.checksum = storageResult.checksum;

        return result;
      }

    } catch (error) {
      result.error = `Failed to restore version: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return result;
    }
  }

  async compareVersions(
    documentId: string,
    version1Number: number,
    version2Number: number,
    options: VersionComparisonOptions = {}
  ): Promise<VersionComparisonResult> {
    try {
      const version1 = await this.getVersion(documentId, version1Number);
      const version2 = await this.getVersion(documentId, version2Number);

      if (!version1 || !version2) {
        throw new Error('One or both versions not found');
      }

      // Download both version files
      const download1 = await documentStorageService.downloadFile(version1.filePath);
      const download2 = await documentStorageService.downloadFile(version2.filePath);

      if (!download1.success || !download1.buffer || !download2.success || !download2.buffer) {
        throw new Error('Failed to download version files for comparison');
      }

      // Perform comparison based on file type
      let comparison: VersionComparisonResult;

      if (version1.document.mimeType === 'text/plain' || 
          version1.document.mimeType.includes('text/')) {
        comparison = await this.compareTextFiles(
          download1.buffer,
          download2.buffer,
          options
        );
      } else {
        comparison = await this.compareBinaryFiles(
          version1,
          version2,
          download1.buffer,
          download2.buffer
        );
      }

      return comparison;

    } catch (error) {
      throw new Error(`Comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async compareTextFiles(
    buffer1: Buffer,
    buffer2: Buffer,
    options: VersionComparisonOptions
  ): Promise<VersionComparisonResult> {
    const text1 = buffer1.toString('utf-8');
    const text2 = buffer2.toString('utf-8');

    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');

    const added: string[] = [];
    const removed: string[] = [];
    const modified: string[] = [];

    // Simple line-by-line comparison
    const maxLines = Math.max(lines1.length, lines2.length);
    
    for (let i = 0; i < maxLines; i++) {
      const line1 = lines1[i] || '';
      const line2 = lines2[i] || '';

      if (!line1 && line2) {
        added.push(`+${line2}`);
      } else if (line1 && !line2) {
        removed.push(`-${line1}`);
      } else if (line1 !== line2) {
        modified.push(`Line ${i + 1}: "${line1}" → "${line2}"`);
      }
    }

    const similarity = this.calculateSimilarity(text1, text2);

    return {
      version1: {} as any, // Would be populated with actual version data
      version2: {} as any, // Would be populated with actual version data
      differences: { added, removed, modified },
      summary: this.generateComparisonSummary(added.length, removed.length, modified.length),
      similarity
    };
  }

  private async compareBinaryFiles(
    version1: DocumentVersionWithDetails,
    version2: DocumentVersionWithDetails,
    buffer1: Buffer,
    buffer2: Buffer
  ): Promise<VersionComparisonResult> {
    const checksum1 = await documentStorageService.calculateFileHash(buffer1);
    const checksum2 = await documentStorageService.calculateFileHash(buffer2);

    const differences: {
      added: string[];
      removed: string[];
      modified: string[];
    } = {
      added: [],
      removed: [],
      modified: []
    };

    if (checksum1 !== checksum2) {
      differences.modified.push('File content differs');
    }

    if (version1.fileSize !== version2.fileSize) {
      differences.modified.push(`File size changed: ${version1.fileSize} → ${version2.fileSize} bytes`);
    }

    const similarity = checksum1 === checksum2 ? 1.0 : 0.0;

    return {
      version1,
      version2,
      differences,
      summary: this.generateComparisonSummary(0, 0, differences.modified.length),
      similarity
    };
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // Simple similarity calculation based on common substrings
    const longer = text1.length > text2.length ? text1 : text2;
    const shorter = text1.length > text2.length ? text2 : text1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.calculateEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private calculateEditDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private generateComparisonSummary(added: number, removed: number, modified: number): string {
    const total = added + removed + modified;
    if (total === 0) return 'No differences found';
    
    const parts = [];
    if (added > 0) parts.push(`${added} line${added > 1 ? 's' : ''} added`);
    if (removed > 0) parts.push(`${removed} line${removed > 1 ? 's' : ''} removed`);
    if (modified > 0) parts.push(`${modified} line${modified > 1 ? 's' : ''} modified`);
    
    return `${total} change${total > 1 ? 's' : ''}: ${parts.join(', ')}`;
  }

  async getVersionHistory(documentId: string, options?: VersionHistoryOptions): Promise<{
    versions: DocumentVersionWithDetails[];
    statistics: {
      totalVersions: number;
      totalSize: number;
      averageSize: number;
      firstVersion: Date;
      lastVersion: Date;
      contributors: Array<{
        userId: string;
        name: string;
        versionCount: number;
      }>;
    };
  }> {
    try {
      const versions = await this.getVersions(documentId, options);
      
      if (versions.length === 0) {
        return {
          versions: [],
          statistics: {
            totalVersions: 0,
            totalSize: 0,
            averageSize: 0,
            firstVersion: new Date(),
            lastVersion: new Date(),
            contributors: []
          }
        };
      }

      const totalSize = versions.reduce((sum, v) => sum + v.fileSize, 0);
      const averageSize = totalSize / versions.length;
      const firstVersion = versions[versions.length - 1].createdAt;
      const lastVersion = versions[0].createdAt;

      // Calculate contributor statistics
      const contributorMap = new Map<string, { name: string; count: number }>();
      versions.forEach(version => {
        const key = version.createdBy;
        const name = `${version.createdByUser?.firstName || ''} ${version.createdByUser?.lastName || ''}`.trim();
        
        if (contributorMap.has(key)) {
          const existing = contributorMap.get(key)!;
          existing.count++;
        } else {
          contributorMap.set(key, { name, count: 1 });
        }
      });

      const contributors = Array.from(contributorMap.entries()).map(([userId, data]) => ({
        userId,
        name: data.name,
        versionCount: data.count
      }));

      return {
        versions,
        statistics: {
          totalVersions: versions.length,
          totalSize,
          averageSize,
          firstVersion,
          lastVersion,
          contributors
        }
      };

    } catch (error) {
      console.error('Failed to get version history:', error);
      throw new Error(`Failed to get version history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async cleanupOldVersions(documentId: string): Promise<void> {
    if (!this.options.maxVersions) return;

    try {
      const versions = await this.prisma.documentVersion.findMany({
        where: { documentId },
        orderBy: { versionNumber: 'desc' },
        select: { id: true, versionNumber: true, filePath: true }
      });

      if (versions.length > this.options.maxVersions) {
        const versionsToDelete = versions.slice(this.options.maxVersions);
        
        for (const version of versionsToDelete) {
          // Delete the file
          await documentStorageService.deleteFile(version.filePath);
          
          // Delete the version record
          await this.prisma.documentVersion.delete({
            where: { id: version.id }
          });
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old versions:', error);
    }
  }

  async deleteVersion(documentId: string, versionNumber: number): Promise<boolean> {
    try {
      const version = await this.prisma.documentVersion.findUnique({
        where: {
          documentId_versionNumber: {
            documentId,
            versionNumber
          }
        }
      });

      if (!version) {
        return false;
      }

      // Don't allow deleting the latest version
      if (version.isLatest) {
        throw new Error('Cannot delete the latest version');
      }

      // Delete the file
      await documentStorageService.deleteFile(version.filePath);

      // Delete the version record
      await this.prisma.documentVersion.delete({
        where: { id: version.id }
      });

      return true;
    } catch (error) {
      console.error('Failed to delete version:', error);
      return false;
    }
  }

  async getVersionStats(documentId: string): Promise<{
    totalVersions: number;
    totalSize: number;
    latestVersion: number;
    lastModified: Date;
    contributors: number;
  }> {
    try {
      const versions = await this.prisma.documentVersion.findMany({
        where: { documentId },
        select: {
          versionNumber: true,
          fileSize: true,
          createdAt: true,
          createdBy: true
        }
      });

      if (versions.length === 0) {
        return {
          totalVersions: 0,
          totalSize: 0,
          latestVersion: 0,
          lastModified: new Date(),
          contributors: 0
        };
      }

      const totalSize = versions.reduce((sum, v) => sum + v.fileSize, 0);
      const latestVersion = Math.max(...versions.map(v => v.versionNumber));
      const lastModified = new Date(Math.max(...versions.map(v => v.createdAt.getTime())));
      const contributors = new Set(versions.map(v => v.createdBy)).size;

      return {
        totalVersions: versions.length,
        totalSize,
        latestVersion,
        lastModified,
        contributors
      };

    } catch (error) {
      console.error('Failed to get version stats:', error);
      throw new Error(`Failed to get version stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const documentVersionService = new DocumentVersionService(new PrismaClient());