import { ocrService, OCRResult, OCRProcessingOptions } from '../../../src/utils/document-processing/ocrService';
import { storageService } from '../../../src/utils/storage';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';

// Mock dependencies
jest.mock('../../../src/utils/storage');
jest.mock('tesseract.js');
jest.mock('sharp');

describe('OCRService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize OCR worker successfully', async () => {
      const mockWorker = {
        loadLanguages: jest.fn(),
        initialize: jest.fn(),
        terminate: jest.fn(),
      };
      
      (createWorker as jest.Mock).mockResolvedValue(mockWorker);

      await ocrService.initialize();

      expect(createWorker).toHaveBeenCalledWith({
        logger: expect.any(Function),
      });
    });

    it('should throw error if initialization fails', async () => {
      (createWorker as jest.Mock).mockRejectedValue(new Error('OCR init failed'));

      await expect(ocrService.initialize())
        .rejects.toThrow('OCR initialization failed');
    });
  });

  describe('processDocument', () => {
    it('should process document with preprocessing', async () => {
      const mockBuffer = Buffer.from('image data');
      const mockWorker = {
        loadLanguages: jest.fn(),
        initialize: jest.fn(),
        recognize: jest.fn().mockResolvedValue({
          data: { text: 'Extracted text', confidence: 95 },
        }),
        terminate: jest.fn(),
      };

      (createWorker as jest.Mock).mockResolvedValue(mockWorker);
      (storageService.getFile as jest.Mock).mockResolvedValue(mockBuffer);
      (sharp as jest.Mock).mockReturnValue({
        grayscale: jest.fn().mockReturnThis(),
        normalize: jest.fn().mockReturnThis(),
        modulate: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockBuffer),
      });

      const result: OCRResult = await ocrService.processDocument('/test/image.png');

      expect(result.text).toBe('Extracted text');
      expect(result.confidence).toBe(95);
      expect(result.language).toBe('eng');
      expect(result.pages).toHaveLength(1);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should process document with custom preprocessing options', async () => {
      const mockBuffer = Buffer.from('image data');
      const mockWorker = {
        loadLanguages: jest.fn(),
        initialize: jest.fn(),
        recognize: jest.fn().mockResolvedValue({
          data: { text: 'Processed text', confidence: 90 },
        }),
        terminate: jest.fn(),
      };

      (createWorker as jest.Mock).mockResolvedValue(mockWorker);
      (storageService.getFile as jest.Mock).mockResolvedValue(mockBuffer);
      (sharp as jest.Mock).mockReturnValue({
        grayscale: jest.fn().mockReturnThis(),
        resize: jest.fn().mockReturnThis(),
        sharpen: jest.fn().mockReturnThis(),
        threshold: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockBuffer),
      });

      const options: OCRProcessingOptions = {
        languages: ['chi_sim'],
        preprocessing: {
          grayscale: true,
          resize: { width: 2000, height: 2000 },
          sharpen: true,
          threshold: true,
        },
      };

      const result: OCRResult = await ocrService.processDocument('/test/image.png', options);

      expect(result.text).toBe('Processed text');
      expect(result.language).toBe('chi_sim');
    });
  });

  describe('processBatch', () => {
    it('should process multiple documents in batch', async () => {
      const mockBuffer = Buffer.from('batch image data');
      const mockWorker = {
        loadLanguages: jest.fn(),
        initialize: jest.fn(),
        recognize: jest.fn().mockResolvedValue({
          data: { text: 'Batch text', confidence: 85 },
        }),
        terminate: jest.fn(),
      };

      (createWorker as jest.Mock).mockResolvedValue(mockWorker);
      (storageService.getFile as jest.Mock).mockResolvedValue(mockBuffer);
      (sharp as jest.Mock).mockReturnValue({
        grayscale: jest.fn().mockReturnThis(),
        normalize: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockBuffer),
      });

      const filePaths = ['/test/doc1.png', '/test/doc2.png', '/test/doc3.png'];
      
      const result = await ocrService.processBatch(filePaths);

      expect(result.results).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.processed).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should handle batch processing with errors', async () => {
      const mockBuffer = Buffer.from('batch image data');
      const mockWorker = {
        loadLanguages: jest.fn(),
        initialize: jest.fn(),
        recognize: jest.fn()
          .mockResolvedValueOnce({
            data: { text: 'Success', confidence: 90 },
          })
          .mockRejectedValueOnce(new Error('OCR failed')),
        terminate: jest.fn(),
      };

      (createWorker as jest.Mock).mockResolvedValue(mockWorker);
      (storageService.getFile as jest.Mock).mockResolvedValue(mockBuffer);
      (sharp as jest.Mock).mockReturnValue({
        grayscale: jest.fn().mockReturnThis(),
        normalize: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockBuffer),
      });

      const filePaths = ['/test/doc1.png', '/test/doc2.png'];
      
      const result = await ocrService.processBatch(filePaths);

      expect(result.results).toHaveLength(1);
      expect(result.total).toBe(2);
      expect(result.processed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should respect batch processing options', async () => {
      const mockBuffer = Buffer.from('batch image data');
      const mockWorker = {
        loadLanguages: jest.fn(),
        initialize: jest.fn(),
        recognize: jest.fn().mockResolvedValue({
          data: { text: 'Batch text', confidence: 85 },
        }),
        terminate: jest.fn(),
      };

      (createWorker as jest.Mock).mockResolvedValue(mockWorker);
      (storageService.getFile as jest.Mock).mockResolvedValue(mockBuffer);
      (sharp as jest.Mock).mockReturnValue({
        grayscale: jest.fn().mockReturnThis(),
        normalize: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockBuffer),
      });

      const filePaths = ['/test/doc1.png', '/test/doc2.png'];
      const options: OCRProcessingOptions = {
        batchProcessing: {
          maxConcurrent: 1,
          retryCount: 1,
          timeout: 30000,
        },
      };

      const progressCallback = jest.fn();
      options.batchProcessing!.progressCallback = progressCallback;

      await ocrService.processBatch(filePaths, options);

      expect(progressCallback).toHaveBeenCalledTimes(2);
    });
  });

  describe('preprocessImage', () => {
    it('should apply grayscale preprocessing', async () => {
      const mockBuffer = Buffer.from('image data');
      const processedBuffer = Buffer.from('processed image data');

      (sharp as jest.Mock).mockReturnValue({
        grayscale: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(processedBuffer),
      });

      const result = await (ocrService as any).preprocessImage(mockBuffer, {
        grayscale: true,
      });

      expect(result).toBe(processedBuffer);
      expect(sharp).toHaveBeenCalledWith(mockBuffer);
    });

    it('should apply resize preprocessing', async () => {
      const mockBuffer = Buffer.from('image data');
      const processedBuffer = Buffer.from('processed image data');

      (sharp as jest.Mock).mockReturnValue({
        resize: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(processedBuffer),
      });

      const result = await (ocrService as any).preprocessImage(mockBuffer, {
        resize: { width: 2000, height: 2000, fit: 'cover' },
      });

      expect(result).toBe(processedBuffer);
      expect(sharp).toHaveBeenCalledWith(mockBuffer);
    });

    it('should apply multiple preprocessing options', async () => {
      const mockBuffer = Buffer.from('image data');
      const processedBuffer = Buffer.from('processed image data');

      (sharp as jest.Mock).mockReturnValue({
        grayscale: jest.fn().mockReturnThis(),
        resize: jest.fn().mockReturnThis(),
        normalize: jest.fn().mockReturnThis(),
        sharpen: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(processedBuffer),
      });

      const result = await (ocrService as any).preprocessImage(mockBuffer, {
        grayscale: true,
        resize: { width: 2000, height: 2000 },
        normalize: true,
        sharpen: true,
      });

      expect(result).toBe(processedBuffer);
    });
  });

  describe('validateOCRQuality', () => {
    it('should validate high-quality OCR result', async () => {
      const result: OCRResult = {
        text: 'This is a good quality OCR result with sufficient text content.',
        confidence: 95,
        language: 'eng',
        pages: [{
          pageNumber: 1,
          text: 'This is a good quality OCR result with sufficient text content.',
          confidence: 95,
          blocks: [],
        }],
        processingTime: 1000,
      };

      const validation = await ocrService.validateOCRQuality(result);

      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
      expect(validation.suggestions).toHaveLength(0);
    });

    it('should identify low confidence issues', async () => {
      const result: OCRResult = {
        text: 'Low confidence text.',
        confidence: 45,
        language: 'eng',
        pages: [{
          pageNumber: 1,
          text: 'Low confidence text.',
          confidence: 45,
          blocks: [],
        }],
        processingTime: 1000,
      };

      const validation = await ocrService.validateOCRQuality(result);

      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Low confidence score');
      expect(validation.suggestions).toContain('Consider rescanning the document at higher DPI');
    });

    it('should identify insufficient text issues', async () => {
      const result: OCRResult = {
        text: 'Short',
        confidence: 95,
        language: 'eng',
        pages: [{
          pageNumber: 1,
          text: 'Short',
          confidence: 95,
          blocks: [],
        }],
        processingTime: 1000,
      };

      const validation = await ocrService.validateOCRQuality(result);

      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Very little text extracted');
      expect(validation.suggestions).toContain('Check if document is text-based or properly scanned');
    });

    it('should identify OCR error patterns', async () => {
      const result: OCRResult = {
        text: 'Text with  multiple  spaces and 0 instead of o',
        confidence: 85,
        language: 'eng',
        pages: [{
          pageNumber: 1,
          text: 'Text with  multiple  spaces and 0 instead of o',
          confidence: 85,
          blocks: [],
        }],
        processingTime: 1000,
      };

      const validation = await ocrService.validateOCRQuality(result);

      expect(validation.issues).toContain('Potential OCR error pattern 1');
      expect(validation.suggestions).toContain('Manual review recommended');
    });
  });

  describe('terminate', () => {
    it('should terminate all workers', async () => {
      const mockWorker = {
        terminate: jest.fn(),
      };

      (ocrService as any).worker = mockWorker;
      (ocrService as any).workers = [mockWorker, mockWorker];

      await ocrService.terminate();

      expect(mockWorker.terminate).toHaveBeenCalledTimes(3); // Main worker + 2 pool workers
      expect((ocrService as any).worker).toBeNull();
      expect((ocrService as any).workers).toHaveLength(0);
    });
  });
});