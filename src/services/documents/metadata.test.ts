import { DocumentMetadataService } from '../../../src/services/documents/metadata';
import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

describe('DocumentMetadataService', () => {
  let metadataService: DocumentMetadataService;
  let prisma: PrismaClient;
  let testDir: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    metadataService = new DocumentMetadataService(prisma);
    
    // Create test directory
    testDir = path.join(__dirname, '../../test-metadata');
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

  describe('Metadata Extraction', () => {
    it('should extract metadata from text document', async () => {
      const testContent = `Sample Legal Document

This is a test legal document containing various types of information.

Contact Information:
- Email: test@example.com
- Phone: +1-555-0123
- Address: 123 Legal St, Suite 100, New York, NY 10001

Document Details:
- Case Number: CV-2024-001234
- Client ID: CLI-001
- Attorney: John Smith, Esq.
- Court: Supreme Court of New York

The contract was signed on January 15, 2024, and involves parties ABC Corp and XYZ Inc.
The total amount is $50,000.00 with payment terms net 30.

This document is confidential and contains attorney-client privileged information.`;

      const testBuffer = Buffer.from(testContent);
      const filePath = path.join(testDir, 'test-document.txt');

      await fs.writeFile(filePath, testBuffer);

      const result = await metadataService.extractMetadata(
        'test-document-id',
        filePath,
        'text/plain',
        {
          enableOCR: false,
          extractEntities: true,
          extractKeywords: true,
          categorizeDocument: true
        }
      );

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.contentLength).toBe(testContent.length);
      expect(result.metadata!.wordCount).toBeGreaterThan(0);
      expect(result.metadata!.extractedText).toBe(testContent);
      
      // Check extracted entities
      expect(result.metadata!.entities).toBeDefined();
      expect(Array.isArray(result.metadata!.entities!.emails)).toBe(true);
      expect(Array.isArray(result.metadata!.entities!.phoneNumbers)).toBe(true);
      expect(Array.isArray(result.metadata!.entities!.addresses)).toBe(true);
      expect(Array.isArray(result.metadata!.entities!.dates)).toBe(true);
      expect(Array.isArray(result.metadata!.entities!.amounts)).toBe(true);
      
      // Check keywords
      expect(result.metadata!.keywords).toBeDefined();
      expect(Array.isArray(result.metadata!.keywords)).toBe(true);
      expect(result.metadata!.keywords!.length).toBeGreaterThan(0);
      
      // Check categorization
      expect(result.metadata!.category).toBeDefined();
      expect(result.metadata!.confidence).toBeGreaterThan(0);
      expect(result.metadata!.confidence).toBeLessThanOrEqual(1);
    });

    it('should extract metadata from PDF document', async () => {
      // Create a mock PDF content (in real implementation, this would be actual PDF)
      const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
  /Font <<
    /F1 <<
      /Type /Font
      /Subtype /Type1
      /BaseFont /Helvetica
    >>
  >>
>>
>>
endobj

4 0 obj
<<
/Length 200
>>
stream
BT
/F1 12 Tf
100 700 Td
(Legal Contract Document) Tj
0 -20 Td
(This is a sample legal contract.) Tj
0 -20 Td
(Parties: ABC Corp and XYZ Inc.) Tj
0 -20 Td
(Date: January 15, 2024) Tj
0 -20 Td
(Amount: $50,000.00) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000344 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
584
%%EOF`;

      const pdfBuffer = Buffer.from(pdfContent);
      const filePath = path.join(testDir, 'test-document.pdf');

      await fs.writeFile(filePath, pdfBuffer);

      const result = await metadataService.extractMetadata(
        'test-document-id',
        filePath,
        'application/pdf',
        {
          enableOCR: true,
          extractEntities: true,
          extractKeywords: true,
          categorizeDocument: true
        }
      );

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.mimeType).toBe('application/pdf');
      expect(result.metadata!.extractedText).toBeDefined();
      expect(result.metadata!.ocrApplied).toBe(true);
    });

    it('should handle OCR processing for image files', async () => {
      // Create a mock image file with text content
      const imageContent = 'Mock image content with text for OCR processing';
      const imageBuffer = Buffer.from(imageContent);
      const filePath = path.join(testDir, 'test-document.png');

      await fs.writeFile(filePath, imageBuffer);

      const result = await metadataService.extractMetadata(
        'test-document-id',
        filePath,
        'image/png',
        {
          enableOCR: true,
          extractEntities: true,
          extractKeywords: true,
          categorizeDocument: true,
          ocrLanguage: 'eng'
        }
      );

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.mimeType).toBe('image/png');
      expect(result.metadata!.ocrApplied).toBe(true);
      expect(result.metadata!.ocrLanguage).toBe('eng');
      expect(result.metadata!.ocrConfidence).toBeGreaterThan(0);
    });

    it('should handle unsupported file types', async () => {
      const testContent = 'Unsupported content';
      const testBuffer = Buffer.from(testContent);
      const filePath = path.join(testDir, 'test-document.xyz');

      await fs.writeFile(filePath, testBuffer);

      const result = await metadataService.extractMetadata(
        'test-document-id',
        filePath,
        'application/x-unsupported',
        {
          enableOCR: false,
          extractEntities: true,
          extractKeywords: true,
          categorizeDocument: true
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported file type');
    });

    it('should handle file read errors', async () => {
      const result = await metadataService.extractMetadata(
        'test-document-id',
        '/non-existent/file.txt',
        'text/plain',
        {
          enableOCR: false,
          extractEntities: true,
          extractKeywords: true,
          categorizeDocument: true
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });
  });

  describe('Entity Extraction', () => {
    it('should extract email addresses', async () => {
      const text = `Contact us at info@company.com or support@test.org.
      For urgent matters, email emergency@company.net or contact john.doe+test@company.co.uk.`;

      const entities = await metadataService.extractEntities(text);

      expect(entities.emails).toEqual([
        'info@company.com',
        'support@test.org',
        'emergency@company.net',
        'john.doe+test@company.co.uk'
      ]);
    });

    it('should extract phone numbers', async () => {
      const text = `Call us at +1-555-0123 or (555) 456-7890.
      International: +44-20-7946-0958 or +86 10 1234 5678.
      Local: 555-123-4567 or 123.456.7890`;

      const entities = await metadataService.extractEntities(text);

      expect(entities.phoneNumbers.length).toBeGreaterThan(0);
      expect(entities.phoneNumbers).toContain('+1-555-0123');
      expect(entities.phoneNumbers).toContain('(555) 456-7890');
    });

    it('should extract dates', async () => {
      const text = `The contract was signed on January 15, 2024.
      Next hearing is scheduled for 03/15/2024.
      Deadline: 2024-12-31.
      Meeting on 15th March 2024 at 2:00 PM.`;

      const entities = await metadataService.extractEntities(text);

      expect(entities.dates.length).toBeGreaterThan(0);
      expect(entities.dates).toContain('January 15, 2024');
      expect(entities.dates).toContain('03/15/2024');
      expect(entities.dates).toContain('2024-12-31');
    });

    it('should extract monetary amounts', async () => {
      const text = `The total amount is $50,000.00.
      Additional fees: €1,500.00 and ¥200,000.
      Settlement: $1.5M plus $250,000 in legal fees.`;

      const entities = await metadataService.extractEntities(text);

      expect(entities.amounts.length).toBeGreaterThan(0);
      expect(entities.amounts).toContain('$50,000.00');
      expect(entities.amounts).toContain('€1,500.00');
      expect(entities.amounts).toContain('¥200,000');
    });

    it('should extract addresses', async () => {
      const text = `Office located at 123 Legal St, Suite 100, New York, NY 10001.
      Mailing address: 456 Court Ave, Boston, MA 02108.
      Client address: 789 Justice Blvd, Los Angeles, CA 90001.`;

      const entities = await metadataService.extractEntities(text);

      expect(entities.addresses.length).toBeGreaterThan(0);
      expect(entities.addresses).toContain('123 Legal St, Suite 100, New York, NY 10001');
    });
  });

  describe('Keyword Extraction', () => {
    it('should extract relevant keywords from legal document', async () => {
      const text = `This legal contract between ABC Corporation and XYZ Inc. 
      governs the terms of service provision. The agreement includes 
      confidentiality clauses, payment terms, and dispute resolution 
      mechanisms. All parties must comply with applicable laws and 
      regulations.`;

      const keywords = await metadataService.extractKeywords(text);

      expect(Array.isArray(keywords)).toBe(true);
      expect(keywords.length).toBeGreaterThan(0);
      
      // Check for relevant legal keywords
      const legalKeywords = ['contract', 'agreement', 'confidentiality', 'payment', 'dispute', 'resolution'];
      const hasLegalKeywords = keywords.some(keyword => 
        legalKeywords.some(legal => keyword.toLowerCase().includes(legal))
      );
      expect(hasLegalKeywords).toBe(true);
    });

    it('should filter out stop words', async () => {
      const text = `The contract is a legal document that defines terms and conditions 
      between parties involved in the agreement. This is for the purpose of 
      establishing rights and obligations under the law.`;

      const keywords = await metadataService.extractKeywords(text);

      expect(Array.isArray(keywords)).toBe(true);
      
      // Should not contain common stop words
      const stopWords = ['the', 'is', 'a', 'and', 'of', 'for', 'this', 'that'];
      const hasStopWords = keywords.some(keyword => 
        stopWords.includes(keyword.toLowerCase())
      );
      expect(hasStopWords).toBe(false);
    });
  });

  describe('Document Categorization', () => {
    it('should categorize contract document', async () => {
      const text = `This Employment Agreement is made between ABC Corp and John Doe.
      The employee shall be compensated at a rate of $100,000 per year.
      The term of employment shall commence on January 1, 2024.
      Both parties agree to the terms and conditions outlined herein.`;

      const categorization = await metadataService.categorizeDocument(text);

      expect(categorization.category).toBe('CONTRACT');
      expect(categorization.confidence).toBeGreaterThan(0.7);
      expect(categorization.subCategory).toBeDefined();
    });

    it('should categorize legal brief document', async () => {
      const text = `MEMORANDUM OF LAW
      To: Honorable Judge Smith
      From: Law Firm LLP
      Date: January 15, 2024
      Re: Case No. CV-2024-001234

      This memorandum addresses the legal issues surrounding the defendant's 
      motion to dismiss. The plaintiff asserts claims for breach of contract 
      and negligence. We argue that the complaint fails to state a claim 
      upon which relief can be granted.`;

      const categorization = await metadataService.categorizeDocument(text);

      expect(['LEGAL_BRIEF', 'COURT_FILING']).toContain(categorization.category);
      expect(categorization.confidence).toBeGreaterThan(0.6);
    });

    it('should categorize correspondence document', async () => {
      const text = `Dear Client,

      Thank you for your email regarding your recent case. I wanted to 
      provide you with an update on the proceedings. The court has scheduled 
      a hearing for March 15, 2024, at 10:00 AM.

      Please let me know if you have any questions.

      Best regards,
      Attorney Smith`;

      const categorization = await metadataService.categorizeDocument(text);

      expect(categorization.category).toBe('CORRESPONDENCE');
      expect(categorization.confidence).toBeGreaterThan(0.5);
    });

    it('should handle document with low confidence', async () => {
      const text = `This is a generic document that doesn't clearly fit into 
      any specific category. It contains some text but no clear indicators 
      of document type or purpose.`;

      const categorization = await metadataService.categorizeDocument(text);

      expect(categorization.category).toBe('OTHER');
      expect(categorization.confidence).toBeLessThan(0.5);
    });
  });

  describe('Metadata Update', () => {
    it('should update document metadata', async () => {
      const documentId = 'test-document-id';

      // Create initial metadata
      const initialMetadata = {
        title: 'Test Document',
        description: 'Initial description',
        author: 'Test Author',
        category: 'OTHER' as const,
        tags: ['test', 'initial'],
        language: 'en',
        pageCount: 1,
        wordCount: 100,
        characterCount: 500
      };

      const createResult = await metadataService.createMetadata(documentId, initialMetadata);
      expect(createResult.success).toBe(true);

      // Update metadata
      const updates = {
        title: 'Updated Test Document',
        description: 'Updated description',
        category: 'CONTRACT' as const,
        tags: ['test', 'updated', 'contract'],
        wordCount: 150,
        characterCount: 750
      };

      const updateResult = await metadataService.updateMetadata(documentId, updates);

      expect(updateResult.success).toBe(true);
      expect(updateResult.metadata).toBeDefined();
      expect(updateResult.metadata!.title).toBe('Updated Test Document');
      expect(updateResult.metadata!.description).toBe('Updated description');
      expect(updateResult.metadata!.category).toBe('CONTRACT');
      expect(updateResult.metadata!.tags).toEqual(['test', 'updated', 'contract']);
      expect(updateResult.metadata!.wordCount).toBe(150);
      expect(updateResult.metadata!.characterCount).toBe(750);
      // Unchanged fields should remain
      expect(updateResult.metadata!.author).toBe('Test Author');
      expect(updateResult.metadata!.language).toBe('en');
    });

    it('should handle metadata update for non-existent document', async () => {
      const result = await metadataService.updateMetadata('non-existent-doc', {
        title: 'Updated Title'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Document not found');
    });
  });

  describe('Metadata Retrieval', () => {
    it('should retrieve document metadata', async () => {
      const documentId = 'test-document-id';

      // Create metadata
      const metadata = {
        title: 'Retrieval Test Document',
        description: 'Document for metadata retrieval test',
        author: 'Test Author',
        category: 'LEGAL_BRIEF' as const,
        tags: ['test', 'retrieval'],
        language: 'en',
        pageCount: 5,
        wordCount: 1000,
        characterCount: 5000
      };

      const createResult = await metadataService.createMetadata(documentId, metadata);
      expect(createResult.success).toBe(true);

      // Retrieve metadata
      const retrieveResult = await metadataService.getMetadata(documentId);

      expect(retrieveResult.success).toBe(true);
      expect(retrieveResult.metadata).toBeDefined();
      expect(retrieveResult.metadata!.title).toBe('Retrieval Test Document');
      expect(retrieveResult.metadata!.description).toBe('Document for metadata retrieval test');
      expect(retrieveResult.metadata!.author).toBe('Test Author');
      expect(retrieveResult.metadata!.category).toBe('LEGAL_BRIEF');
      expect(retrieveResult.metadata!.tags).toEqual(['test', 'retrieval']);
      expect(retrieveResult.metadata!.language).toBe('en');
      expect(retrieveResult.metadata!.pageCount).toBe(5);
      expect(retrieveResult.metadata!.wordCount).toBe(1000);
      expect(retrieveResult.metadata!.characterCount).toBe(5000);
    });

    it('should handle metadata retrieval for non-existent document', async () => {
      const result = await metadataService.getMetadata('non-existent-doc');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Document not found');
    });
  });

  describe('Metadata Search', () => {
    it('should search documents by metadata', async () => {
      // Create multiple documents with different metadata
      const documents = [
        {
          id: 'doc1',
          metadata: {
            title: 'Contract Agreement',
            description: 'Employment contract between parties',
            category: 'CONTRACT' as const,
            tags: ['contract', 'employment']
          }
        },
        {
          id: 'doc2',
          metadata: {
            title: 'Legal Brief',
            description: 'Memorandum of law for court case',
            category: 'LEGAL_BRIEF' as const,
            tags: ['brief', 'court', 'memorandum']
          }
        },
        {
          id: 'doc3',
          metadata: {
            title: 'Client Correspondence',
            description: 'Email communication with client',
            category: 'CORRESPONDENCE' as const,
            tags: ['email', 'client', 'communication']
          }
        }
      ];

      for (const doc of documents) {
        await metadataService.createMetadata(doc.id, doc.metadata);
      }

      // Search by category
      const categoryResult = await metadataService.searchByMetadata({
        category: 'CONTRACT'
      });

      expect(categoryResult.success).toBe(true);
      expect(categoryResult.documents).toHaveLength(1);
      expect(categoryResult.documents![0].id).toBe('doc1');

      // Search by tags
      const tagResult = await metadataService.searchByMetadata({
        tags: ['court']
      });

      expect(tagResult.success).toBe(true);
      expect(tagResult.documents).toHaveLength(1);
      expect(tagResult.documents![0].id).toBe('doc2');

      // Search by title
      const titleResult = await metadataService.searchByMetadata({
        title: 'Client Correspondence'
      });

      expect(titleResult.success).toBe(true);
      expect(titleResult.documents).toHaveLength(1);
      expect(titleResult.documents![0].id).toBe('doc3');

      // Search with multiple criteria
      const multiResult = await metadataService.searchByMetadata({
        category: 'LEGAL_BRIEF',
        tags: ['memorandum']
      });

      expect(multiResult.success).toBe(true);
      expect(multiResult.documents).toHaveLength(1);
      expect(multiResult.documents![0].id).toBe('doc2');
    });
  });
});