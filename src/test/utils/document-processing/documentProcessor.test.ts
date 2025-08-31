import { documentProcessor, ProcessedDocument, ProcessingOptions } from '../../../src/utils/document-processing/documentProcessor';
import { storageService } from '../../../src/utils/storage';
import fs from 'fs/promises';
import path from 'path';

// Mock storage service
jest.mock('../../../src/utils/storage');

describe('DocumentProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processFile', () => {
    it('should process a text file successfully', async () => {
      const mockBuffer = Buffer.from('Sample text content for testing');
      const mockFilePath = '/test/sample.txt';
      
      (storageService.getFile as jest.Mock).mockResolvedValue(mockBuffer);

      const result: ProcessedDocument = await documentProcessor.processFile(mockFilePath);

      expect(result.content).toBe('Sample text content for testing');
      expect(result.text).toBe('Sample text content for testing');
      expect(result.metadata.filename).toBe('sample.txt');
      expect(result.metadata.mimeType).toBe('text/plain');
      expect(result.metadata.wordCount).toBe(6);
      expect(result.metadata.charCount).toBe(31);
      expect(result.language).toBe('eng');
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should process a PDF file', async () => {
      const mockPdfBuffer = Buffer.from('%PDF-1.4 mock pdf content');
      const mockFilePath = '/test/sample.pdf';
      
      (storageService.getFile as jest.Mock).mockResolvedValue(mockPdfBuffer);

      // Mock pdf-parse
      const pdfParse = require('pdf-parse');
      pdfParse.mockResolvedValue({
        text: 'Sample PDF content',
        info: {
          Title: 'Test PDF',
          Author: 'Test Author',
          Creator: 'Test Creator',
          CreationDate: '2023-01-01',
        },
        numpages: 1,
      });

      const result: ProcessedDocument = await documentProcessor.processFile(mockFilePath);

      expect(result.content).toBe('Sample PDF content');
      expect(result.metadata.title).toBe('Test PDF');
      expect(result.metadata.author).toBe('Test Author');
      expect(result.metadata.creator).toBe('Test Creator');
      expect(result.metadata.pageCount).toBe(1);
    });

    it('should handle file size validation', async () => {
      const largeBuffer = Buffer.alloc(200 * 1024 * 1024); // 200MB
      const mockFilePath = '/test/large.txt';
      
      (storageService.getFile as jest.Mock).mockResolvedValue(largeBuffer);

      const options: ProcessingOptions = {
        maxFileSize: 100 * 1024 * 1024, // 100MB
      };

      await expect(documentProcessor.processFile(mockFilePath, options))
        .rejects.toThrow('File size 209715200 exceeds maximum allowed size');
    });

    it('should handle unsupported file formats', async () => {
      const mockBuffer = Buffer.from('unsupported content');
      const mockFilePath = '/test/sample.xyz';
      
      (storageService.getFile as jest.Mock).mockResolvedValue(mockBuffer);

      await expect(documentProcessor.processFile(mockFilePath))
        .rejects.toThrow('Unsupported file format: application/octet-stream');
    });

    it('should handle processing errors gracefully', async () => {
      const mockFilePath = '/test/error.txt';
      
      (storageService.getFile as jest.Mock).mockRejectedValue(new Error('File not found'));

      await expect(documentProcessor.processFile(mockFilePath))
        .rejects.toThrow('Document processing failed: File not found');
    });
  });

  describe('isFormatSupported', () => {
    it('should return true for supported formats', () => {
      expect(documentProcessor.isFormatSupported('application/pdf')).toBe(true);
      expect(documentProcessor.isFormatSupported('text/plain')).toBe(true);
      expect(documentProcessor.isFormatSupported('image/jpeg')).toBe(true);
    });

    it('should return false for unsupported formats', () => {
      expect(documentProcessor.isFormatSupported('application/xyz')).toBe(false);
      expect(documentProcessor.isFormatSupported('unknown/type')).toBe(false);
    });
  });

  describe('getSupportedFormats', () => {
    it('should return array of supported formats', () => {
      const formats = documentProcessor.getSupportedFormats();
      
      expect(Array.isArray(formats)).toBe(true);
      expect(formats).toContain('application/pdf');
      expect(formats).toContain('text/plain');
      expect(formats).toContain('image/jpeg');
    });
  });

  describe('detectMimeType', () => {
    it('should detect MIME type from file extension', async () => {
      const pdfBuffer = Buffer.from('pdf content');
      const result = await (documentProcessor as any).detectMimeType(pdfBuffer, 'test.pdf');
      expect(result).toBe('application/pdf');
    });

    it('should return octet-stream for unknown extensions', async () => {
      const buffer = Buffer.from('unknown content');
      const result = await (documentProcessor as any).detectMimeType(buffer, 'test.xyz');
      expect(result).toBe('application/octet-stream');
    });
  });

  describe('language detection', () => {
    it('should detect Chinese language', async () => {
      const chineseText = '这是一个测试文档';
      const result = await (documentProcessor as any).detectLanguage(chineseText);
      expect(result).toBe('chi_sim');
    });

    it('should detect English language', async () => {
      const englishText = 'This is a test document';
      const result = await (documentProcessor as any).detectLanguage(englishText);
      expect(result).toBe('eng');
    });

    it('should default to English for mixed content', async () => {
      const mixedText = 'This is mixed with 中文 content';
      const result = await (documentProcessor as any).detectLanguage(mixedText);
      expect(result).toBe('eng');
    });
  });

  describe('word counting', () => {
    it('should count English words correctly', () => {
      const englishText = 'This is a test document with several words';
      const result = (documentProcessor as any).countWords(englishText);
      expect(result).toBe(8);
    });

    it('should count Chinese characters correctly', () => {
      const chineseText = '这是一个测试文档';
      const result = (documentProcessor as any).countWords(chineseText);
      expect(result).toBe(7);
    });

    it('should count mixed content correctly', () => {
      const mixedText = 'This is a test with 中文 characters';
      const result = (documentProcessor as any).countWords(mixedText);
      expect(result).toBe(9); // 5 English words + 4 Chinese characters
    });
  });
});