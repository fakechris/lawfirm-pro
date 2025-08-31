import { SearchTextUtils, SearchQueryAnalysis, SearchSuggestion } from '../../../../src/utils/knowledge-base/search/searchTextUtils';

describe('SearchTextUtils', () => {
  let textUtils: SearchTextUtils;

  beforeAll(() => {
    textUtils = new SearchTextUtils();
  });

  describe('analyzeSearchQuery', () => {
    it('should analyze Chinese queries correctly', () => {
      const query = '合同法基础知识';
      const analysis = textUtils.analyzeSearchQuery(query);

      expect(analysis).toBeTruthy();
      expect(analysis.originalQuery).toBe(query);
      expect(analysis.language).toBe('zh');
      expect(analysis.tokens).toContain('合同');
      expect(analysis.tokens).toContain('法');
      expect(analysis.keywords).toContain('合同');
      expect(analysis.entities.length).toBeGreaterThan(0);
    });

    it('should analyze English queries correctly', () => {
      const query = 'contract law basics';
      const analysis = textUtils.analyzeSearchQuery(query);

      expect(analysis).toBeTruthy();
      expect(analysis.originalQuery).toBe(query);
      expect(analysis.language).toBe('en');
      expect(analysis.tokens).toContain('contract');
      expect(analysis.tokens).toContain('law');
      expect(analysis.keywords).toContain('contract');
    });

    it('should analyze mixed Chinese-English queries', () => {
      const query = '合同 contract law';
      const analysis = textUtils.analyzeSearchQuery(query);

      expect(analysis).toBeTruthy();
      expect(analysis.language).toBe('mixed');
      expect(analysis.tokens).toContain('合同');
      expect(analysis.tokens).toContain('contract');
    });

    it('should extract legal entities from queries', () => {
      const query = '劳动合同法第十二条';
      const analysis = textUtils.analyzeSearchQuery(query);

      expect(analysis.entities).toBeTruthy();
      expect(analysis.entities.length).toBeGreaterThan(0);
      
      const legalTerms = analysis.entities.filter(e => e.type === 'legal_term');
      expect(legalTerms.length).toBeGreaterThan(0);
    });

    it('should detect search intent correctly', () => {
      const informationalQuery = '什么是合同法';
      const analysis = textUtils.analyzeSearchQuery(informationalQuery);

      expect(analysis.intent).toBeTruthy();
      expect(analysis.intent.type).toBe('informational');
    });

    it('should calculate query complexity', () => {
      const simpleQuery = '合同';
      const complexQuery = '劳动合同法中的第十二条关于用人单位义务的规定';

      const simpleAnalysis = textUtils.analyzeSearchQuery(simpleQuery);
      const complexAnalysis = textUtils.analyzeSearchQuery(complexQuery);

      expect(complexAnalysis.complexity).toBeGreaterThan(simpleAnalysis.complexity);
    });

    it('should normalize queries correctly', () => {
      const query = '  合同  法  基础  知识  ';
      const analysis = textUtils.analyzeSearchQuery(query);

      expect(analysis.processedQuery).toBe('合同 法 基础 知识');
    });
  });

  describe('generateSuggestions', () => {
    it('should generate query completion suggestions', () => {
      const query = '合';
      const history = ['合同法', '劳动合同', '合同条款'];
      const popularTerms = ['合同', '劳动法', '法律条款'];
      const suggestions = textUtils.generateSuggestions(query, history, popularTerms);

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].text).toContain('合');
    });

    it('should generate keyword suggestions', () => {
      const query = '合同';
      const popularTerms = ['合同法', '劳动合同', '合同条款'];
      const suggestions = textUtils.generateSuggestions(query, [], popularTerms);

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.some(s => s.type === 'keyword')).toBe(true);
    });

    it('should generate entity suggestions', () => {
      const query = '合同';
      const suggestions = textUtils.generateSuggestions(query, [], []);

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.some(s => s.type === 'entity')).toBe(true);
    });

    it('should deduplicate suggestions', () => {
      const query = '合同';
      const history = ['合同法'];
      const popularTerms = ['合同法'];
      const suggestions = textUtils.generateSuggestions(query, history, popularTerms);

      const uniqueTexts = new Set(suggestions.map(s => s.text));
      expect(uniqueTexts.size).toBe(suggestions.length);
    });

    it('should sort suggestions by score', () => {
      const query = '合';
      const suggestions = textUtils.generateSuggestions(query, [], []);

      expect(suggestions.length > 0).toBe(true);
      for (let i = 1; i < suggestions.length; i++) {
        expect(suggestions[i - 1].score).toBeGreaterThanOrEqual(suggestions[i].score);
      }
    });
  });

  describe('highlightSearchResults', () => {
    const text = '合同法是调整合同关系的法律规范。劳动合同是特殊的合同类型。合同应当遵循公平原则。';

    it('should highlight search terms in content', () => {
      const query = '合同';
      const highlights = textUtils.highlightSearchResults(text, query);

      expect(Array.isArray(highlights)).toBe(true);
      expect(highlights.length).toBeGreaterThan(0);
      expect(highlights[0].highlights.length).toBeGreaterThan(0);
    });

    it('should limit number of fragments', () => {
      const query = '合同';
      const highlights = textUtils.highlightSearchResults(text, query, 2, 100);

      expect(highlights.length).toBeLessThanOrEqual(2);
    });

    it('should handle empty query', () => {
      const highlights = textUtils.highlightSearchResults(text, '');

      expect(highlights).toEqual([]);
    });

    it('should handle query not found in text', () => {
      const highlights = textUtils.highlightSearchResults(text, 'xyz');

      expect(highlights).toEqual([]);
    });

    it('should generate fragments of correct length', () => {
      const query = '合同';
      const fragmentLength = 50;
      const highlights = textUtils.highlightSearchResults(text, query, 3, fragmentLength);

      highlights.forEach(highlight => {
        expect(highlight.text.length).toBeLessThanOrEqual(fragmentLength + 50); // Allow some buffer
      });
    });
  });

  describe('calculateRelevanceScore', () => {
    const document = {
      title: '合同法基础知识',
      content: '合同是当事人之间设立、变更、终止民事关系的协议。',
      tags: ['合同', '法律'],
      metadata: {
        keywords: ['合同', '协议', '当事人'],
        contentType: 'LEGAL_GUIDE',
      },
    };

    const queryAnalysis: SearchQueryAnalysis = {
      originalQuery: '合同法',
      processedQuery: '合同 法',
      tokens: ['合同', '法'],
      keywords: ['合同', '法'],
      entities: [{ type: 'legal_term', value: '合同', confidence: 0.9, start: 0, end: 2 }],
      intent: { type: 'informational', confidence: 0.8 },
      language: 'zh',
      complexity: 3,
    };

    it('should calculate relevance score correctly', () => {
      const score = textUtils.calculateRelevanceScore(document, '合同法', queryAnalysis);

      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThan(0);
    });

    it('should give higher score for title matches', () => {
      const titleMatchScore = textUtils.calculateRelevanceScore(document, '合同法', queryAnalysis);
      const noTitleMatchScore = textUtils.calculateRelevanceScore(
        { ...document, title: '法律基础知识' },
        '合同法',
        queryAnalysis
      );

      expect(titleMatchScore).toBeGreaterThan(noTitleMatchScore);
    });

    it('should give higher score for legal term matches', () => {
      const legalTermScore = textUtils.calculateRelevanceScore(document, '合同法', queryAnalysis);
      const noLegalTermScore = textUtils.calculateRelevanceScore(
        document,
        '合同法',
        { ...queryAnalysis, entities: [] }
      );

      expect(legalTermScore).toBeGreaterThan(noLegalTermScore);
    });

    it('should give higher score for exact phrase matches', () => {
      const exactMatchScore = textUtils.calculateRelevanceScore(document, '合同法', queryAnalysis);
      const partialMatchScore = textUtils.calculateRelevanceScore(document, '合同', queryAnalysis);

      expect(exactMatchScore).toBeGreaterThan(partialMatchScore);
    });
  });

  describe('utility methods', () => {
    it('should detect Chinese language correctly', () => {
      const chineseText = '这是一个中文文本';
      const englishText = 'This is an English text';
      const mixedText = 'This is mixed 中文 text';

      expect(textUtils['detectLanguage'](chineseText)).toBe('zh');
      expect(textUtils['detectLanguage'](englishText)).toBe('en');
      expect(textUtils['detectLanguage'](mixedText)).toBe('mixed');
    });

    it('should extract keywords correctly', () => {
      const tokens = ['合同', '法', '的', '是', '基础', '知识'];
      const keywords = textUtils['extractKeywords'](tokens);

      expect(keywords).toContain('合同');
      expect(keywords).toContain('法');
      expect(keywords).toContain('基础');
      expect(keywords).toContain('知识');
      expect(keywords).not.toContain('的');
      expect(keywords).not.toContain('是');
    });

    it('should extract legal entities correctly', () => {
      const text = '根据合同法第十二条，当事人应当遵循诚实信用原则。';
      const entities = textUtils['extractLegalEntities'](text);

      expect(entities).toBeTruthy();
      expect(entities.length).toBeGreaterThan(0);
      expect(entities.some(e => e.type === 'legal_term')).toBe(true);
      expect(entities.some(e => e.type === 'case_reference')).toBe(true);
    });

    it('should generate Chinese summary correctly', () => {
      const content = '合同法是调整合同关系的法律规范。劳动合同是特殊的合同类型。合同应当遵循公平原则。当事人应当遵循诚实信用原则。';
      const summary = textUtils['generateChineseSummary'](content, 50);

      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);
      expect(summary.length).toBeLessThanOrEqual(50 + 1); // +1 for possible period
    });

    it('should analyze readability correctly', () => {
      const simpleContent = '合同是协议。';
      const complexContent = '根据中华人民共和国合同法的相关规定，当事人之间在平等自愿基础上订立的合同，应当符合法律规定的生效要件。';
      
      const simpleScore = textUtils['analyzeReadability'](simpleContent);
      const complexScore = textUtils['analyzeReadability'](complexContent);

      expect(typeof simpleScore).toBe('number');
      expect(typeof complexScore).toBe('number');
      expect(simpleScore).toBeGreaterThan(complexScore);
    });
  });

  describe('edge cases', () => {
    it('should handle empty strings gracefully', () => {
      const analysis = textUtils.analyzeSearchQuery('');
      
      expect(analysis).toBeTruthy();
      expect(analysis.originalQuery).toBe('');
      expect(analysis.processedQuery).toBe('');
    });

    it('should handle special characters correctly', () => {
      const query = '合同法!@#$%^&*()';
      const analysis = textUtils.analyzeSearchQuery(query);

      expect(analysis).toBeTruthy();
      expect(analysis.processedQuery).not.toContain('!');
      expect(analysis.processedQuery).not.toContain('@');
    });

    it('should handle very long queries', () => {
      const longQuery = '合同'.repeat(100);
      const analysis = textUtils.analyzeSearchQuery(longQuery);

      expect(analysis).toBeTruthy();
      expect(analysis.originalQuery).toBe(longQuery);
    });

    it('should handle queries with only stop words', () => {
      const query = '的 是 在';
      const analysis = textUtils.analyzeSearchQuery(query);

      expect(analysis).toBeTruthy();
      expect(analysis.keywords).toEqual([]);
    });
  });
});