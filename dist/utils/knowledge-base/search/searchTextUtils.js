"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchTextUtils = exports.SearchTextUtils = void 0;
const natural_1 = __importDefault(require("natural"));
const nodejieba_1 = require("nodejieba");
class SearchTextUtils {
    constructor() {
        this.legalTerms = new Set([
            '合同', '协议', '诉讼', '起诉', '判决', '裁定', '证据', '当事人', '律师', '法庭', '法院',
            '法律', '法规', '条例', '司法解释', '案例', '判例', '原告', '被告', '第三人', '代理人',
            '管辖权', '时效', '执行', '上诉', '再审', '仲裁', '调解', '和解', '赔偿', '违约', '侵权',
            '犯罪', '刑罚', '有期徒刑', '罚金', '没收财产', '缓刑', '假释', '减刑', '保释',
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
    analyzeSearchQuery(query) {
        const originalQuery = query.trim();
        const language = this.detectLanguage(originalQuery);
        const tokens = this.tokenizeQuery(originalQuery, language);
        const keywords = this.extractKeywords(tokens);
        const entities = this.extractEntities(originalQuery);
        const intent = this.determineSearchIntent(originalQuery, keywords, entities);
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
    generateSuggestions(query, history = [], popularTerms = []) {
        const suggestions = [];
        const normalizedQuery = query.toLowerCase().trim();
        if (normalizedQuery.length < 2)
            return suggestions;
        const queryCompletions = this.getQueryCompletions(normalizedQuery, history, popularTerms);
        suggestions.push(...queryCompletions);
        const keywordSuggestions = this.getKeywordSuggestions(normalizedQuery, popularTerms);
        suggestions.push(...keywordSuggestions);
        const entitySuggestions = this.getEntitySuggestions(normalizedQuery);
        suggestions.push(...entitySuggestions);
        const uniqueSuggestions = this.deduplicateSuggestions(suggestions);
        return uniqueSuggestions.sort((a, b) => b.score - a.score).slice(0, 10);
    }
    highlightSearchResults(text, query, maxFragments = 3, fragmentLength = 150) {
        const highlights = [];
        const processedQuery = this.normalizeQuery(query, this.detectLanguage(query));
        const queryTerms = processedQuery.split(/\s+/).filter(term => term.length > 1);
        if (queryTerms.length === 0)
            return highlights;
        const matches = [];
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
        if (matches.length === 0)
            return highlights;
        matches.sort((a, b) => a.start - b.start);
        const groupedMatches = this.groupOverlappingMatches(matches);
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
    calculateRelevanceScore(document, query, queryAnalysis) {
        let score = 0;
        const normalizedQuery = queryAnalysis.processedQuery.toLowerCase();
        const queryTerms = normalizedQuery.split(/\s+/);
        const titleLower = document.title.toLowerCase();
        queryTerms.forEach(term => {
            if (titleLower.includes(term)) {
                score += 15;
            }
        });
        const contentLower = document.content.toLowerCase();
        queryTerms.forEach(term => {
            if (contentLower.includes(term)) {
                score += 5;
            }
        });
        document.tags.forEach(tag => {
            if (queryTerms.some(term => tag.toLowerCase().includes(term))) {
                score += 8;
            }
        });
        queryAnalysis.entities.forEach(entity => {
            if (entity.type === 'legal_term') {
                score += 10;
            }
        });
        if (contentLower.includes(normalizedQuery)) {
            score += 20;
        }
        if (document.metadata) {
            Object.values(document.metadata).forEach(value => {
                if (typeof value === 'string' && queryTerms.some(term => value.toLowerCase().includes(term))) {
                    score += 3;
                }
            });
        }
        score += queryAnalysis.complexity * 2;
        return score;
    }
    detectLanguage(text) {
        const chineseChars = text.match(/[\u4e00-\u9fff]/g) || [];
        const englishWords = text.match(/[a-zA-Z]+/g) || [];
        const totalChars = text.length;
        const chineseRatio = chineseChars.length / totalChars;
        const englishRatio = englishWords.join('').length / totalChars;
        if (chineseRatio > 0.3)
            return 'zh';
        if (englishRatio > 0.5)
            return 'en';
        return 'mixed';
    }
    tokenizeQuery(query, language) {
        let tokens = [];
        switch (language) {
            case 'zh':
                tokens = nodejieba_1.jieba.cut(query, true);
                break;
            case 'en':
                tokens = natural_1.default.WordTokenizer.prototype.tokenize(query) || [];
                break;
            case 'mixed':
                const chineseTokens = nodejieba_1.jieba.cut(query, true);
                const englishTokens = natural_1.default.WordTokenizer.prototype.tokenize(query) || [];
                tokens = [...chineseTokens, ...englishTokens];
                break;
        }
        return tokens
            .map(token => token.toLowerCase().trim())
            .filter(token => token.length > 1);
    }
    extractKeywords(tokens) {
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '个', '上', '也'
        ]);
        return tokens
            .filter(token => !stopWords.has(token))
            .filter(token => token.length > 1);
    }
    extractEntities(text) {
        const entities = [];
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
    mapPatternToEntityType(patternType) {
        const mapping = {
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
    determineSearchIntent(query, keywords, entities) {
        const queryLower = query.toLowerCase();
        const informationalKeywords = ['如何', '怎么', '什么是', '定义', '解释', '说明', 'how', 'what', 'define', 'explain'];
        if (informationalKeywords.some(keyword => queryLower.includes(keyword))) {
            return {
                type: 'informational',
                confidence: 0.8,
                category: 'legal_information',
            };
        }
        const navigationalKeywords = ['查找', '搜索', '找到', 'find', 'search', 'locate'];
        if (navigationalKeywords.some(keyword => queryLower.includes(keyword))) {
            return {
                type: 'navigational',
                confidence: 0.7,
            };
        }
        if (entities.some(e => e.type === 'legal_term' || e.type === 'case_reference')) {
            return {
                type: 'informational',
                confidence: 0.9,
                category: 'legal_research',
            };
        }
        return {
            type: 'informational',
            confidence: 0.6,
        };
    }
    calculateQueryComplexity(tokens, entities) {
        let complexity = 0;
        complexity += Math.min(tokens.length * 0.5, 3);
        complexity += entities.length * 0.8;
        const legalTerms = entities.filter(e => e.type === 'legal_term').length;
        complexity += legalTerms * 1.2;
        return Math.min(complexity, 10);
    }
    normalizeQuery(query, language) {
        let normalized = query.toLowerCase();
        normalized = normalized.replace(/[^\w\s\u4e00-\u9fff]/g, ' ');
        normalized = normalized.replace(/\s+/g, ' ').trim();
        return normalized;
    }
    getQueryCompletions(query, history, popularTerms) {
        const suggestions = [];
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
    getKeywordSuggestions(query, popularTerms) {
        const suggestions = [];
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
    getEntitySuggestions(query) {
        const suggestions = [];
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
    deduplicateSuggestions(suggestions) {
        const seen = new Set();
        return suggestions.filter(suggestion => {
            const key = suggestion.text.toLowerCase();
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }
    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    groupOverlappingMatches(matches) {
        if (matches.length === 0)
            return [];
        const grouped = [];
        let current = { ...matches[0] };
        for (let i = 1; i < matches.length; i++) {
            const match = matches[i];
            if (match.start <= current.end) {
                current.end = Math.max(current.end, match.end);
            }
            else {
                grouped.push({ start: current.start, end: current.end });
                current = { ...match };
            }
        }
        grouped.push({ start: current.start, end: current.end });
        return grouped;
    }
    generateFragments(text, matches, fragmentLength, maxFragments) {
        const fragments = [];
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
exports.SearchTextUtils = SearchTextUtils;
exports.searchTextUtils = new SearchTextUtils();
//# sourceMappingURL=searchTextUtils.js.map