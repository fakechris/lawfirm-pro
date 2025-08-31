import natural from 'natural';
import { jieba } from 'nodejieba';

export interface SearchQueryAnalysis {
  originalQuery: string;
  processedQuery: string;
  tokens: string[];
  keywords: string[];
  entities: SearchEntity[];
  intent: SearchIntent;
  language: 'zh' | 'en' | 'mixed';
  complexity: number;
}

export interface SearchEntity {
  type: 'legal_term' | 'date' | 'amount' | 'person' | 'organization' | 'location' | 'case_reference';
  value: string;
  confidence: number;
  start: number;
  end: number;
}

export interface SearchIntent {
  type: 'informational' | 'navigational' | 'transactional' | 'commercial';
  confidence: number;
  category?: string;
}

export interface SearchSuggestion {
  text: string;
  type: 'query' | 'keyword' | 'entity' | 'category';
  score: number;
  frequency: number;
}

export interface SearchResultHighlight {
  field: string;
  text: string;
  highlights: { start: number; end: number; text: string }[];
}

export class SearchTextUtils {
  private legalTerms: Set<string>;
  private legalPatterns: Map<string, RegExp>;

  constructor() {
    this.legalTerms = new Set([
      // Chinese legal terms
      '合同', '协议', '诉讼', '起诉', '判决', '裁定', '证据', '当事人', '律师', '法庭', '法院',
      '法律', '法规', '条例', '司法解释', '案例', '判例', '原告', '被告', '第三人', '代理人',
      '管辖权', '时效', '执行', '上诉', '再审', '仲裁', '调解', '和解', '赔偿', '违约', '侵权',
      '犯罪', '刑罚', '有期徒刑', '罚金', '没收财产', '缓刑', '假释', '减刑', '保释',
      // English legal terms
      'contract', 'agreement', 'lawsuit', 'litigation', 'judgment', 'ruling', 'evidence', 'party',
      'lawyer', 'attorney', 'court', 'tribunal', 'law', 'regulation', 'case', 'precedent',
      'plaintiff', 'defendant', 'jurisdiction', 'statute', 'appeal', 'arbitration', 'mediation'
    ]);

    this.legalPatterns = new Map([
      ['chinese_date', /\d{4}年\d{1,2}月\d{1,2}日/g],
      ['chinese_amount', /[\d,]+\.?\d*\s*(元|万|千|百万|亿|人民币)/g],
      ['chinese_article', /第[一二三四五六七八九十百千万\d]+条/g],
      ['chinese_court', /.*人民法院/g],
      ['chinese_law', /.*法/g],
      ['case_number', /[A-Z]{2,4}\d{4,6}/g],
      ['phone_number', /1[3-9]\d{9}/g],
      ['email', /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g],
    ]);
  }

  analyzeSearchQuery(query: string): SearchQueryAnalysis {
    const originalQuery = query.trim();
    
    // Detect language
    const language = this.detectLanguage(originalQuery);
    
    // Tokenize based on language
    const tokens = this.tokenizeQuery(originalQuery, language);
    
    // Extract keywords
    const keywords = this.extractKeywords(tokens);
    
    // Extract entities
    const entities = this.extractEntities(originalQuery);
    
    // Determine search intent
    const intent = this.determineSearchIntent(originalQuery, keywords, entities);
    
    // Calculate complexity
    const complexity = this.calculateQueryComplexity(tokens, entities);

    return {
      originalQuery,
      processedQuery: this.normalizeQuery(originalQuery, language),
      tokens,
      keywords,
      entities,
      intent,
      language,
      complexity,
    };
  }

  generateSuggestions(
    query: string,
    history: string[] = [],
    popularTerms: string[] = []
  ): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];
    const normalizedQuery = query.toLowerCase().trim();

    if (normalizedQuery.length < 2) return suggestions;

    // Query completion suggestions
    const queryCompletions = this.getQueryCompletions(normalizedQuery, history, popularTerms);
    suggestions.push(...queryCompletions);

    // Keyword suggestions
    const keywordSuggestions = this.getKeywordSuggestions(normalizedQuery, popularTerms);
    suggestions.push(...keywordSuggestions);

    // Entity-based suggestions
    const entitySuggestions = this.getEntitySuggestions(normalizedQuery);
    suggestions.push(...entitySuggestions);

    // Remove duplicates and sort by score
    const uniqueSuggestions = this.deduplicateSuggestions(suggestions);
    return uniqueSuggestions.sort((a, b) => b.score - a.score).slice(0, 10);
  }

  highlightSearchResults(
    text: string,
    query: string,
    maxFragments: number = 3,
    fragmentLength: number = 150
  ): SearchResultHighlight[] {
    const highlights: SearchResultHighlight[] = [];
    const processedQuery = this.normalizeQuery(query, this.detectLanguage(query));
    const queryTerms = processedQuery.split(/\s+/).filter(term => term.length > 1);

    if (queryTerms.length === 0) return highlights;

    // Find all matches
    const matches: { start: number; end: number; term: string }[] = [];
    
    queryTerms.forEach(term => {
      const regex = new RegExp(this.escapeRegExp(term), 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          term: match[0],
        });
      }
    });

    if (matches.length === 0) return highlights;

    // Sort matches by position
    matches.sort((a, b) => a.start - b.start);

    // Group overlapping matches
    const groupedMatches = this.groupOverlappingMatches(matches);

    // Generate fragments around matches
    const fragments = this.generateFragments(text, groupedMatches, fragmentLength, maxFragments);

    fragments.forEach(fragment => {
      const fragmentHighlights = fragment.matches.map(match => ({
        start: match.start - fragment.start,
        end: match.end - fragment.start,
        text: text.substring(match.start, match.end),
      }));

      highlights.push({
        field: 'content',
        text: fragment.text,
        highlights: fragmentHighlights,
      });
    });

    return highlights;
  }

  calculateRelevanceScore(
    document: { title: string; content: string; tags: string[]; metadata?: any },
    query: string,
    queryAnalysis: SearchQueryAnalysis
  ): number {
    let score = 0;
    const normalizedQuery = queryAnalysis.processedQuery.toLowerCase();
    const queryTerms = normalizedQuery.split(/\s+/);

    // Title matches (highest weight)
    const titleLower = document.title.toLowerCase();
    queryTerms.forEach(term => {
      if (titleLower.includes(term)) {
        score += 15;
      }
    });

    // Content matches
    const contentLower = document.content.toLowerCase();
    queryTerms.forEach(term => {
      if (contentLower.includes(term)) {
        score += 5;
      }
    });

    // Tag matches
    document.tags.forEach(tag => {
      if (queryTerms.some(term => tag.toLowerCase().includes(term))) {
        score += 8;
      }
    });

    // Legal term matches (boost for legal context)
    queryAnalysis.entities.forEach(entity => {
      if (entity.type === 'legal_term') {
        score += 10;
      }
    });

    // Exact phrase matches
    if (contentLower.includes(normalizedQuery)) {
      score += 20;
    }

    // Metadata matches
    if (document.metadata) {
      Object.values(document.metadata).forEach(value => {
        if (typeof value === 'string' && queryTerms.some(term => value.toLowerCase().includes(term))) {
          score += 3;
        }
      });
    }

    // Query complexity bonus
    score += queryAnalysis.complexity * 2;

    return score;
  }

  private detectLanguage(text: string): 'zh' | 'en' | 'mixed' {
    const chineseChars = text.match(/[\u4e00-\u9fff]/g) || [];
    const englishWords = text.match(/[a-zA-Z]+/g) || [];
    const totalChars = text.length;

    const chineseRatio = chineseChars.length / totalChars;
    const englishRatio = englishWords.join('').length / totalChars;

    if (chineseRatio > 0.3) return 'zh';
    if (englishRatio > 0.5) return 'en';
    return 'mixed';
  }

  private tokenizeQuery(query: string, language: 'zh' | 'en' | 'mixed'): string[] {
    let tokens: string[] = [];

    switch (language) {
      case 'zh':
        tokens = jieba.cut(query, true);
        break;
      case 'en':
        tokens = natural.WordTokenizer.prototype.tokenize(query) || [];
        break;
      case 'mixed':
        // Handle mixed Chinese-English text
        const chineseTokens = jieba.cut(query, true);
        const englishTokens = natural.WordTokenizer.prototype.tokenize(query) || [];
        tokens = [...chineseTokens, ...englishTokens];
        break;
    }

    return tokens
      .map(token => token.toLowerCase().trim())
      .filter(token => token.length > 1);
  }

  private extractKeywords(tokens: string[]): string[] {
    // Remove stop words
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '个', '上', '也'
    ]);

    return tokens
      .filter(token => !stopWords.has(token))
      .filter(token => token.length > 1);
  }

  private extractEntities(text: string): SearchEntity[] {
    const entities: SearchEntity[] = [];

    // Extract legal terms
    this.legalTerms.forEach(term => {
      const regex = new RegExp(this.escapeRegExp(term), 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        entities.push({
          type: 'legal_term',
          value: match[0],
          confidence: 0.9,
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    });

    // Extract pattern-based entities
    this.legalPatterns.forEach((pattern, type) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const entityType = this.mapPatternToEntityType(type);
        entities.push({
          type: entityType,
          value: match[0],
          confidence: 0.8,
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    });

    return entities;
  }

  private mapPatternToEntityType(patternType: string): SearchEntity['type'] {
    const mapping: Record<string, SearchEntity['type']> = {
      'chinese_date': 'date',
      'chinese_amount': 'amount',
      'chinese_article': 'case_reference',
      'chinese_court': 'organization',
      'chinese_law': 'legal_term',
      'case_number': 'case_reference',
      'phone_number': 'person',
      'email': 'person',
    };

    return mapping[patternType] || 'legal_term';
  }

  private determineSearchIntent(
    query: string,
    keywords: string[],
    entities: SearchEntity[]
  ): SearchIntent {
    const queryLower = query.toLowerCase();
    
    // Informational intent (seeking information)
    const informationalKeywords = ['如何', '怎么', '什么是', '定义', '解释', '说明', 'how', 'what', 'define', 'explain'];
    if (informationalKeywords.some(keyword => queryLower.includes(keyword))) {
      return {
        type: 'informational',
        confidence: 0.8,
        category: 'legal_information',
      };
    }

    // Navigational intent (looking for specific content)
    const navigationalKeywords = ['查找', '搜索', '找到', 'find', 'search', 'locate'];
    if (navigationalKeywords.some(keyword => queryLower.includes(keyword))) {
      return {
        type: 'navigational',
        confidence: 0.7,
      };
    }

    // Legal document specific intent
    if (entities.some(e => e.type === 'legal_term' || e.type === 'case_reference')) {
      return {
        type: 'informational',
        confidence: 0.9,
        category: 'legal_research',
      };
    }

    // Default to informational
    return {
      type: 'informational',
      confidence: 0.6,
    };
  }

  private calculateQueryComplexity(tokens: string[], entities: SearchEntity[]): number {
    let complexity = 0;

    // Base complexity from token count
    complexity += Math.min(tokens.length * 0.5, 3);

    // Entity complexity
    complexity += entities.length * 0.8;

    // Legal term complexity
    const legalTerms = entities.filter(e => e.type === 'legal_term').length;
    complexity += legalTerms * 1.2;

    return Math.min(complexity, 10);
  }

  private normalizeQuery(query: string, language: 'zh' | 'en' | 'mixed'): string {
    let normalized = query.toLowerCase();

    // Remove special characters but keep Chinese characters
    normalized = normalized.replace(/[^\w\s\u4e00-\u9fff]/g, ' ');

    // Normalize whitespace
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }

  private getQueryCompletions(
    query: string,
    history: string[],
    popularTerms: string[]
  ): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];

    // History-based completions
    history.forEach(historicalQuery => {
      if (historicalQuery.toLowerCase().startsWith(query)) {
        suggestions.push({
          text: historicalQuery,
          type: 'query',
          score: 8,
          frequency: 1,
        });
      }
    });

    // Popular term completions
    popularTerms.forEach(term => {
      if (term.toLowerCase().startsWith(query)) {
        suggestions.push({
          text: term,
          type: 'keyword',
          score: 6,
          frequency: 1,
        });
      }
    });

    return suggestions;
  }

  private getKeywordSuggestions(query: string, popularTerms: string[]): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];

    popularTerms.forEach(term => {
      if (term.toLowerCase().includes(query) && !term.toLowerCase().startsWith(query)) {
        suggestions.push({
          text: term,
          type: 'keyword',
          score: 4,
          frequency: 1,
        });
      }
    });

    return suggestions;
  }

  private getEntitySuggestions(query: string): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];

    this.legalTerms.forEach(term => {
      if (term.toLowerCase().includes(query)) {
        suggestions.push({
          text: term,
          type: 'entity',
          score: 7,
          frequency: 1,
        });
      }
    });

    return suggestions;
  }

  private deduplicateSuggestions(suggestions: SearchSuggestion[]): SearchSuggestion[] {
    const seen = new Set<string>();
    return suggestions.filter(suggestion => {
      const key = suggestion.text.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private groupOverlappingMatches(matches: { start: number; end: number; term: string }[]): { start: number; end: number }[] {
    if (matches.length === 0) return [];

    const grouped = [];
    let current = { ...matches[0] };

    for (let i = 1; i < matches.length; i++) {
      const match = matches[i];
      if (match.start <= current.end) {
        current.end = Math.max(current.end, match.end);
      } else {
        grouped.push({ start: current.start, end: current.end });
        current = { ...match };
      }
    }

    grouped.push({ start: current.start, end: current.end });
    return grouped;
  }

  private generateFragments(
    text: string,
    matches: { start: number; end: number }[],
    fragmentLength: number,
    maxFragments: number
  ): { text: string; start: number; matches: { start: number; end: number }[] }[] {
    const fragments: { text: string; start: number; matches: { start: number; end: number }[] }[] = [];

    for (let i = 0; i < Math.min(matches.length, maxFragments); i++) {
      const match = matches[i];
      const start = Math.max(0, match.start - fragmentLength / 2);
      const end = Math.min(text.length, match.end + fragmentLength / 2);
      
      const fragmentText = text.substring(start, end);
      const fragmentMatches = matches.filter(m => m.start >= start && m.end <= end);

      fragments.push({
        text: fragmentText,
        start,
        matches: fragmentMatches,
      });
    }

    return fragments;
  }
}

export const searchTextUtils = new SearchTextUtils();