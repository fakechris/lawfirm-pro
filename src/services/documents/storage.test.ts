import { DocumentStorageService } from '../../../src/services/documents/storage';
import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

describe('DocumentStorageService', () => {
  let storageService: DocumentStorageService;
  let prisma: PrismaClient;
  let testDir: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    storageService = new DocumentStorageService(prisma);
    
    // Create test directory
    testDir = path.join(__dirname, '../../test-uploads');
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test files before each test
    try {
      const files = await fs.readdir(testDir);
      await Promise.all(files.map(file => fs.unlink(path.join(testDir, file))));
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('File Upload', () => {
    it('should upload a valid file successfully', async () => {
      const testContent = 'Test document content';
      const testBuffer = Buffer.from(testContent);
      const originalName = 'test-document.txt';
      const uploadedBy = 'test-user-id';

      const result = await storageService.uploadFile(
        testBuffer,
        originalName,
        {
          uploadedBy,
          caseId: 'test-case-id',
          isConfidential: false,
          category: 'LEGAL_BRIEF'
        }
      );

      expect(result.success).toBe(true);
      expect(result.filename).toBeDefined();
      expect(result.originalName).toBe(originalName);
      expect(result.size).toBe(testBuffer.length);
      expect(result.mimeType).toBe('text/plain');
      expect(result.checksum).toBeDefined();
      expect(result.path).toBeDefined();
      expect(result.uploadedBy).toBe(uploadedBy);
    });

    it('should handle file with custom MIME type', async () => {
      const testContent = 'PDF content simulation';
      const testBuffer = Buffer.from(testContent);
      const originalName = 'test-document.pdf';

      const result = await storageService.uploadFile(
        testBuffer,
        originalName,
        {
          uploadedBy: 'test-user-id',
          mimeType: 'application/pdf',
          category: 'CONTRACT'
        }
      );

      expect(result.success).toBe(true);
      expect(result.mimeType).toBe('application/pdf');
    });

    it('should validate file size limits', async () => {
      // Create a buffer that exceeds the size limit
      const largeBuffer = Buffer.alloc(101 * 1024 * 1024); // 101MB
      const originalName = 'large-file.txt';

      const result = await storageService.uploadFile(
        largeBuffer,
        originalName,
        {
          uploadedBy: 'test-user-id',
          category: 'LEGAL_BRIEF'
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('File size exceeds maximum limit');
    });

    it('should reject unsupported file types', async () => {
      const testContent = 'Malicious content';
      const testBuffer = Buffer.from(testContent);
      const originalName = 'malicious.exe';

      const result = await storageService.uploadFile(
        testBuffer,
        originalName,
        {
          uploadedBy: 'test-user-id',
          mimeType: 'application/x-executable',
          category: 'LEGAL_BRIEF'
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported MIME type');
    });

    it('should generate unique filenames for duplicate uploads', async () => {
      const testContent = 'Same content';
      const testBuffer = Buffer.from(testContent);
      const originalName = 'duplicate.txt';

      // Upload first file
      const firstResult = await storageService.uploadFile(
        testBuffer,
        originalName,
        {
          uploadedBy: 'test-user-id',
          category: 'LEGAL_BRIEF'
        }
      );

      expect(firstResult.success).toBe(true);

      // Upload second file with same name
      const secondResult = await storageService.uploadFile(
        testBuffer,
        originalName,
        {
          uploadedBy: 'test-user-id',
          category: 'LEGAL_BRIEF'
        }
      );

      expect(secondResult.success).toBe(true);
      expect(secondResult.filename).not.toBe(firstResult.filename);
    });
  });

  describe('File Download', () => {
    it('should download existing file successfully', async () => {
      const testContent = 'Download test content';
      const testBuffer = Buffer.from(testContent);
      const originalName = 'download-test.txt';

      // Upload file first
      const uploadResult = await storageService.uploadFile(
        testBuffer,
        originalName,
        {
          uploadedBy: 'test-user-id',
          category: 'LEGAL_BRIEF'
        }
      );

      expect(uploadResult.success).toBe(true);

      // Download the file
      const downloadResult = await storageService.downloadFile(uploadResult.filename!);

      expect(downloadResult.success).toBe(true);
      expect(downloadResult.buffer).toBeDefined();
      expect(downloadResult.buffer!.equals(testBuffer)).toBe(true);
      expect(downloadResult.mimeType).toBe('text/plain');
      expect(downloadResult.originalName).toBe(originalName);
    });

    it('should handle non-existent file download', async () => {
      const result = await storageService.downloadFile('non-existent-file.txt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('should handle corrupted file download', async () => {
      // Create a file in the storage directory but don't register it in database
      const corruptedFilename = 'corrupted-file.txt';
      const corruptedPath = path.join(testDir, corruptedFilename);
      await fs.writeFile(corruptedPath, 'corrupted content');

      const result = await storageService.downloadFile(corruptedFilename);

      expect(result.success).toBe(false);
      expect(result.error).toContain('File metadata not found');
    });
  });

  describe('File Validation', () => {
    it('should validate file checksum', async () => {
      const testContent = 'Checksum validation test';
      const testBuffer = Buffer.from(testContent);
      const originalName = 'checksum-test.txt';

      const result = await storageService.uploadFile(
        testBuffer,
        originalName,
        {
          uploadedBy: 'test-user-id',
          category: 'LEGAL_BRIEF'
        }
      );

      expect(result.success).toBe(true);
      expect(result.checksum).toBeDefined();

      // Verify checksum is correct SHA-256 hash
      const crypto = require('crypto');
      const expectedChecksum = crypto.createHash('sha256').update(testBuffer).digest('hex');
      expect(result.checksum).toBe(expectedChecksum);
    });

    it('should detect file tampering', async () => {
      const testContent = 'Original content';
      const testBuffer = Buffer.from(testContent);
      const originalName = 'tamper-test.txt';

      const uploadResult = await storageService.uploadFile(
        testBuffer,
        originalName,
        {
          uploadedBy: 'test-user-id',
          category: 'LEGAL_BRIEF'
        }
      );

      expect(uploadResult.success).toBe(true);

      // Tamper with the file
      const filePath = path.join(testDir, uploadResult.filename!);
      await fs.writeFile(filePath, 'Tampered content');

      // Try to download - should detect tampering
      const downloadResult = await storageService.downloadFile(uploadResult.filename!);

      expect(downloadResult.success).toBe(false);
      expect(downloadResult.error).toContain('File integrity check failed');
    });
  });

  describe('File Cleanup', () => {
    it('should cleanup orphaned files', async () => {
      // Create some orphaned files in the storage directory
      const orphanedFiles = ['orphaned1.txt', 'orphaned2.txt'];
      await Promise.all(
        orphanedFiles.map(filename => 
          fs.writeFile(path.join(testDir, filename), 'orphaned content')
        )
      );

      // Upload a valid file
      const testContent = 'Valid file content';
      const testBuffer = Buffer.from(testContent);
      const uploadResult = await storageService.uploadFile(
        testBuffer,
        'valid-file.txt',
        {
          uploadedBy: 'test-user-id',
          category: 'LEGAL_BRIEF'
        }
      );

      expect(uploadResult.success).toBe(true);

      // Run cleanup
      await storageService.cleanupOrphanedFiles();

      // Verify orphaned files are removed but valid file remains
      const remainingFiles = await fs.readdir(testDir);
      expect(remainingFiles).toContain(uploadResult.filename!);
      expect(remainingFiles).not.toContain('orphaned1.txt');
      expect(remainingFiles).not.toContain('orphaned2.txt');
    });

    it('should handle cleanup errors gracefully', async () => {
      // Mock file system error
      jest.spyOn(fs, 'readdir').mockRejectedValueOnce(new Error('File system error'));

      await expect(storageService.cleanupOrphanedFiles()).resolves.not.toThrow();
    });
  });

  describe('File Information', () => {
    it('should get file information', async () => {
      const testContent = 'File info test content';
      const testBuffer = Buffer.from(testContent);
      const originalName = 'info-test.txt';

      const uploadResult = await storageService.uploadFile(
        testBuffer,
        originalName,
        {
          uploadedBy: 'test-user-id',
          category: 'LEGAL_BRIEF',
          description: 'Test file for info retrieval'
        }
      );

      expect(uploadResult.success).toBe(true);

      const fileInfo = await storageService.getFileInfo(uploadResult.filename!);

      expect(fileInfo).toBeDefined();
      expect(fileInfo!.filename).toBe(uploadResult.filename);
      expect(fileInfo!.originalName).toBe(originalName);
      expect(fileInfo!.size).toBe(testBuffer.length);
      expect(fileInfo!.mimeType).toBe('text/plain');
      expect(fileInfo!.uploadedBy).toBe('test-user-id');
      expect(fileInfo!.category).toBe('LEGAL_BRIEF');
      expect(fileInfo!.description).toBe('Test file for info retrieval');
    });

    it('should return null for non-existent file', async () => {
      const fileInfo = await storageService.getFileInfo('non-existent-file.txt');

      expect(fileInfo).toBeNull();
    });
  });

  describe('Storage Statistics', () => {
    it('should get storage statistics', async () => {
      // Upload several test files
      const testFiles = [
        { content: 'File 1 content', name: 'stats1.txt', size: 14 },
        { content: 'File 2 content', name: 'stats2.txt', size: 14 },
        { content: 'File 3 content', name: 'stats3.txt', size: 14 }
      ];

      for (const file of testFiles) {
        await storageService.uploadFile(
          Buffer.from(file.content),
          file.name,
          {
            uploadedBy: 'test-user-id',
            category: 'LEGAL_BRIEF'
          }
        );
      }

      const stats = await storageService.getStorageStats();

      expect(stats.totalFiles).toBeGreaterThanOrEqual(3);
      expect(stats.totalSize).toBeGreaterThanOrEqual(42); // 3 * 14 bytes
      expect(stats.byCategory).toHaveProperty('LEGAL_BRIEF');
      expect(stats.byCategory['LEGAL_BRIEF']).toBeGreaterThanOrEqual(3);
      expect(stats.byMimeType).toHaveProperty('text/plain');
      expect(stats.byMimeType['text/plain']).toBeGreaterThanOrEqual(3);
    });
  });
});