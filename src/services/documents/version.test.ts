import { DocumentVersionService } from '../../../src/services/documents/version';
import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

describe('DocumentVersionService', () => {
  let versionService: DocumentVersionService;
  let prisma: PrismaClient;
  let testDir: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    versionService = new DocumentVersionService(prisma);
    
    // Create test directory
    testDir = path.join(__dirname, '../../test-versions');
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

  describe('Version Creation', () => {
    it('should create first version successfully', async () => {
      const testContent = 'Initial document content';
      const testBuffer = Buffer.from(testContent);
      const documentId = 'test-document-id';

      const result = await versionService.createVersion({
        documentId,
        fileBuffer: testBuffer,
        filename: 'document-v1.txt',
        mimeType: 'text/plain',
        uploadedBy: 'test-user-id',
        changeDescription: 'Initial version'
      });

      expect(result.success).toBe(true);
      expect(result.versionId).toBeDefined();
      expect(result.versionNumber).toBe(1);
      expect(result.filename).toBe('document-v1.txt');
      expect(result.checksum).toBeDefined();
      expect(result.changeDescription).toBe('Initial version');
      expect(result.uploadedBy).toBe('test-user-id');
    });

    it('should create subsequent versions with incrementing numbers', async () => {
      const documentId = 'test-document-id';
      const uploadedBy = 'test-user-id';

      // Create version 1
      const v1Content = 'Version 1 content';
      const v1Result = await versionService.createVersion({
        documentId,
        fileBuffer: Buffer.from(v1Content),
        filename: 'document-v1.txt',
        mimeType: 'text/plain',
        uploadedBy,
        changeDescription: 'First version'
      });

      expect(v1Result.success).toBe(true);
      expect(v1Result.versionNumber).toBe(1);

      // Create version 2
      const v2Content = 'Version 2 content with updates';
      const v2Result = await versionService.createVersion({
        documentId,
        fileBuffer: Buffer.from(v2Content),
        filename: 'document-v2.txt',
        mimeType: 'text/plain',
        uploadedBy,
        changeDescription: 'Updated content and formatting'
      });

      expect(v2Result.success).toBe(true);
      expect(v2Result.versionNumber).toBe(2);

      // Create version 3
      const v3Content = 'Version 3 content with more updates';
      const v3Result = await versionService.createVersion({
        documentId,
        fileBuffer: Buffer.from(v3Content),
        filename: 'document-v3.txt',
        mimeType: 'text/plain',
        uploadedBy,
        changeDescription: 'Additional updates and improvements'
      });

      expect(v3Result.success).toBe(true);
      expect(v3Result.versionNumber).toBe(3);
    });

    it('should validate required fields', async () => {
      const result = await versionService.createVersion({
        documentId: '',
        fileBuffer: Buffer.from('test'),
        filename: 'test.txt',
        mimeType: 'text/plain',
        uploadedBy: '',
        changeDescription: 'Test version'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Document ID is required');
    });

    it('should handle empty file buffer', async () => {
      const result = await versionService.createVersion({
        documentId: 'test-document-id',
        fileBuffer: Buffer.alloc(0),
        filename: 'empty.txt',
        mimeType: 'text/plain',
        uploadedBy: 'test-user-id',
        changeDescription: 'Empty file test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('File buffer cannot be empty');
    });
  });

  describe('Version Retrieval', () => {
    it('should retrieve specific version', async () => {
      const documentId = 'test-document-id';
      const testContent = 'Test content for retrieval';
      const testBuffer = Buffer.from(testContent);

      // Create a version
      const createResult = await versionService.createVersion({
        documentId,
        fileBuffer: testBuffer,
        filename: 'retrieval-test.txt',
        mimeType: 'text/plain',
        uploadedBy: 'test-user-id',
        changeDescription: 'Test version for retrieval'
      });

      expect(createResult.success).toBe(true);

      // Retrieve the version
      const retrieveResult = await versionService.getVersion(documentId, createResult.versionNumber!);

      expect(retrieveResult.success).toBe(true);
      expect(retrieveResult.version).toBeDefined();
      expect(retrieveResult.version!.versionNumber).toBe(createResult.versionNumber);
      expect(retrieveResult.version!.filename).toBe('retrieval-test.txt');
      expect(retrieveResult.version!.changeDescription).toBe('Test version for retrieval');
      expect(retrieveResult.version!.uploadedBy).toBe('test-user-id');
    });

    it('should retrieve all versions for a document', async () => {
      const documentId = 'test-document-id';
      const uploadedBy = 'test-user-id';

      // Create multiple versions
      await versionService.createVersion({
        documentId,
        fileBuffer: Buffer.from('Version 1'),
        filename: 'doc-v1.txt',
        mimeType: 'text/plain',
        uploadedBy,
        changeDescription: 'First version'
      });

      await versionService.createVersion({
        documentId,
        fileBuffer: Buffer.from('Version 2'),
        filename: 'doc-v2.txt',
        mimeType: 'text/plain',
        uploadedBy,
        changeDescription: 'Second version'
      });

      await versionService.createVersion({
        documentId,
        fileBuffer: Buffer.from('Version 3'),
        filename: 'doc-v3.txt',
        mimeType: 'text/plain',
        uploadedBy,
        changeDescription: 'Third version'
      });

      // Retrieve all versions
      const allVersionsResult = await versionService.getAllVersions(documentId);

      expect(allVersionsResult.success).toBe(true);
      expect(allVersionsResult.versions).toHaveLength(3);
      expect(allVersionsResult.versions![0].versionNumber).toBe(3); // Should be ordered by version number desc
      expect(allVersionsResult.versions![1].versionNumber).toBe(2);
      expect(allVersionsResult.versions![2].versionNumber).toBe(1);
    });

    it('should handle non-existent version retrieval', async () => {
      const result = await versionService.getVersion('non-existent-doc', 999);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Version not found');
    });
  });

  describe('Version Comparison', () => {
    it('should compare two versions successfully', async () => {
      const documentId = 'test-document-id';
      const uploadedBy = 'test-user-id';

      // Create version 1
      const v1Content = 'This is the original content with some text.';
      const v1Result = await versionService.createVersion({
        documentId,
        fileBuffer: Buffer.from(v1Content),
        filename: 'compare-v1.txt',
        mimeType: 'text/plain',
        uploadedBy,
        changeDescription: 'Original version'
      });

      // Create version 2
      const v2Content = 'This is the updated content with modified text and new additions.';
      const v2Result = await versionService.createVersion({
        documentId,
        fileBuffer: Buffer.from(v2Content),
        filename: 'compare-v2.txt',
        mimeType: 'text/plain',
        uploadedBy,
        changeDescription: 'Updated version'
      });

      // Compare versions
      const comparisonResult = await versionService.compareVersions(
        documentId,
        v1Result.versionNumber!,
        v2Result.versionNumber!
      );

      expect(comparisonResult.success).toBe(true);
      expect(comparisonResult.comparison).toBeDefined();
      expect(comparisonResult.comparison!.fromVersion).toBe(v1Result.versionNumber);
      expect(comparisonResult.comparison!.toVersion).toBe(v2Result.versionNumber);
      expect(Array.isArray(comparisonResult.comparison!.differences)).toBe(true);
      expect(comparisonResult.comparison!.similarityScore).toBeGreaterThan(0);
      expect(comparisonResult.comparison!.similarityScore).toBeLessThanOrEqual(1);
    });

    it('should handle comparison with non-existent versions', async () => {
      const result = await versionService.compareVersions('test-doc', 1, 999);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Version not found');
    });
  });

  describe('Version Restoration', () => {
    it('should restore previous version successfully', async () => {
      const documentId = 'test-document-id';
      const uploadedBy = 'test-user-id';

      // Create version 1
      const v1Content = 'Original content that will be restored';
      const v1Result = await versionService.createVersion({
        documentId,
        fileBuffer: Buffer.from(v1Content),
        filename: 'restore-v1.txt',
        mimeType: 'text/plain',
        uploadedBy,
        changeDescription: 'Original version'
      });

      // Create version 2
      const v2Content = 'Modified content that will be replaced';
      await versionService.createVersion({
        documentId,
        fileBuffer: Buffer.from(v2Content),
        filename: 'restore-v2.txt',
        mimeType: 'text/plain',
        uploadedBy,
        changeDescription: 'Modified version'
      });

      // Restore version 1
      const restoreResult = await versionService.restoreVersion(
        documentId,
        v1Result.versionNumber!,
        'test-user-id',
        'Restored original version'
      );

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.newVersionNumber).toBe(3); // Should create version 3
      expect(restoreResult.restoredFromVersion).toBe(v1Result.versionNumber);

      // Verify the restored version
      const restoredVersion = await versionService.getVersion(documentId, 3);
      expect(restoredVersion.success).toBe(true);
      expect(restoredVersion.version!.changeDescription).toBe('Restored original version');
    });

    it('should prevent restoring to current version', async () => {
      const documentId = 'test-document-id';
      const uploadedBy = 'test-user-id';

      // Create version 1
      const v1Result = await versionService.createVersion({
        documentId,
        fileBuffer: Buffer.from('Content'),
        filename: 'restore-test.txt',
        mimeType: 'text/plain',
        uploadedBy,
        changeDescription: 'Version 1'
      });

      // Try to restore version 1 (current version)
      const result = await versionService.restoreVersion(
        documentId,
        v1Result.versionNumber!,
        'test-user-id',
        'Attempt to restore current version'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot restore to current version');
    });
  });

  describe('Version Deletion', () => {
    it('should delete specific version', async () => {
      const documentId = 'test-document-id';
      const uploadedBy = 'test-user-id';

      // Create multiple versions
      await versionService.createVersion({
        documentId,
        fileBuffer: Buffer.from('Version 1'),
        filename: 'delete-v1.txt',
        mimeType: 'text/plain',
        uploadedBy,
        changeDescription: 'Version 1'
      });

      const v2Result = await versionService.createVersion({
        documentId,
        fileBuffer: Buffer.from('Version 2'),
        filename: 'delete-v2.txt',
        mimeType: 'text/plain',
        uploadedBy,
        changeDescription: 'Version 2'
      });

      await versionService.createVersion({
        documentId,
        fileBuffer: Buffer.from('Version 3'),
        filename: 'delete-v3.txt',
        mimeType: 'text/plain',
        uploadedBy,
        changeDescription: 'Version 3'
      });

      // Delete version 2
      const deleteResult = await versionService.deleteVersion(
        documentId,
        v2Result.versionNumber!
      );

      expect(deleteResult.success).toBe(true);

      // Verify version 2 is deleted
      const remainingVersions = await versionService.getAllVersions(documentId);
      expect(remainingVersions.success).toBe(true);
      expect(remainingVersions.versions).toHaveLength(2);
      expect(remainingVersions.versions![0].versionNumber).toBe(3);
      expect(remainingVersions.versions![1].versionNumber).toBe(1);
    });

    it('should prevent deleting the only version', async () => {
      const documentId = 'test-document-id';
      const uploadedBy = 'test-user-id';

      // Create single version
      const v1Result = await versionService.createVersion({
        documentId,
        fileBuffer: Buffer.from('Only version'),
        filename: 'single-version.txt',
        mimeType: 'text/plain',
        uploadedBy,
        changeDescription: 'Only version'
      });

      // Try to delete the only version
      const result = await versionService.deleteVersion(
        documentId,
        v1Result.versionNumber!
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot delete the only version');
    });

    it('should handle deleting non-existent version', async () => {
      const result = await versionService.deleteVersion('test-doc', 999);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Version not found');
    });
  });

  describe('Version Statistics', () => {
    it('should get version statistics', async () => {
      const documentId = 'test-document-id';
      const uploadedBy = 'test-user-id';

      // Create multiple versions
      await versionService.createVersion({
        documentId,
        fileBuffer: Buffer.from('Version 1'),
        filename: 'stats-v1.txt',
        mimeType: 'text/plain',
        uploadedBy,
        changeDescription: 'Version 1'
      });

      await versionService.createVersion({
        documentId,
        fileBuffer: Buffer.from('Version 2'),
        filename: 'stats-v2.txt',
        mimeType: 'text/plain',
        uploadedBy,
        changeDescription: 'Version 2'
      });

      const stats = await versionService.getVersionStats(documentId);

      expect(stats).toBeDefined();
      expect(stats.totalVersions).toBe(2);
      expect(stats.currentVersion).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.firstVersionCreatedAt).toBeInstanceOf(Date);
      expect(stats.lastVersionCreatedAt).toBeInstanceOf(Date);
      expect(stats.byUser).toHaveProperty('test-user-id');
      expect(stats.byUser['test-user-id']).toBe(2);
    });

    it('should handle stats for non-existent document', async () => {
      const stats = await versionService.getVersionStats('non-existent-doc');

      expect(stats).toBeDefined();
      expect(stats.totalVersions).toBe(0);
      expect(stats.currentVersion).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });
});