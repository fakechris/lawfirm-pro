"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.knowledgeRecommendationEngine = exports.KnowledgeRecommendationEngine = void 0;
const client_1 = require("@prisma/client");
const knowledgeSearchEngine_1 = require("../search/knowledgeSearchEngine");
const prisma = new client_1.PrismaClient();
class KnowledgeRecommendationEngine {
    constructor() {
        this.userProfiles = new Map();
        this.trendingContent = new Map();
        this.contentSimilarity = new Map();
        this.initializeTrendingContent();
        this.startPeriodicUpdates();
    }
    async getPersonalizedRecommendations(request) {
        try {
            const { userId, currentDocumentId, limit, context } = request;
            const userProfile = await this.getUserProfile(userId);
            const [contentBased, collaborative, trending, similarUsers] = await Promise.all([
                this.getContentBasedRecommendations(userProfile, currentDocumentId, limit),
                this.getCollaborativeRecommendations(userProfile, limit),
                this.getTrendingRecommendations(userProfile, limit),
                this.getSimilarUsersRecommendations(userProfile, limit),
            ]);
            const allRecommendations = [
                ...contentBased.map(r => ({ ...r, type: 'content_based' })),
                ...collaborative.map(r => ({ ...r, type: 'collaborative' })),
                ...trending.map(r => ({ ...r, type: 'trending' })),
                ...similarUsers.map(r => ({ ...r, type: 'similar_users' })),
            ];
            const scoredRecommendations = this.applyContextualScoring(allRecommendations, userProfile, context);
            const uniqueRecommendations = this.deduplicateRecommendations(scoredRecommendations, currentDocumentId);
            const finalRecommendations = uniqueRecommendations
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);
            await this.logRecommendationAnalytics(userId, finalRecommendations);
            return finalRecommendations;
        }
        catch (error) {
            console.error('Failed to get personalized recommendations:', error);
            return [];
        }
    }
    async getContentBasedRecommendations(userProfile, excludeDocumentId, limit = 10) {
        try {
            const recommendations = [];
            const preferredContentTypes = userProfile.preferences.contentTypes;
            const preferredCategories = userProfile.preferences.categories;
            const preferredTags = userProfile.preferences.tags;
            const userInterests = this.extractUserInterests(userProfile.searchHistory);
            const searchQuery = {
                query: userInterests.join(' '),
                filters: {
                    contentType: preferredContentTypes.length > 0 ? preferredContentTypes : undefined,
                    categories: preferredCategories.length > 0 ? preferredCategories : undefined,
                    tags: preferredTags.length > 0 ? preferredTags : undefined,
                },
                pagination: { page: 1, limit: limit * 2 },
            };
            const searchResults = await knowledgeSearchEngine_1.knowledgeSearchEngine.searchKnowledge(searchQuery);
            for (const document of searchResults.documents) {
                if (document.id === excludeDocumentId)
                    continue;
                const score = this.calculateContentBasedScore(document, userProfile);
                const reason = this.generateContentBasedReason(document, userProfile);
                recommendations.push({
                    document,
                    score,
                    reason,
                    type: 'content_based',
                });
            }
            return recommendations.sort((a, b) => b.score - a.score).slice(0, limit);
        }
        catch (error) {
            console.error('Failed to get content-based recommendations:', error);
            return [];
        }
    }
    async getCollaborativeRecommendations(userProfile, limit = 10) {
        try {
            const recommendations = [];
            const similarUsers = await this.findSimilarUsers(userProfile);
            const similarUserDocuments = new Set();
            for (const similarUser of similarUsers) {
                const viewHistory = await prisma.searchAnalytics.findMany({
                    where: { userId: similarUser.id },
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                });
                viewHistory.forEach(record => {
                    if (record.resultsCount > 0) {
                        similarUserDocuments.add(record.query);
                    }
                });
            }
            if (similarUserDocuments.size > 0) {
                const searchQuery = {
                    query: Array.from(similarUserDocuments).join(' '),
                    pagination: { page: 1, limit: limit * 2 },
                };
                const searchResults = await knowledgeSearchEngine_1.knowledgeSearchEngine.searchKnowledge(searchQuery);
                for (const document of searchResults.documents) {
                    const score = this.calculateCollaborativeScore(document, similarUsers);
                    const reason = `Popular among ${similarUsers.length} similar users`;
                    recommendations.push({
                        document,
                        score,
                        reason,
                        type: 'collaborative',
                    });
                }
            }
            return recommendations.sort((a, b) => b.score - a.score).slice(0, limit);
        }
        catch (error) {
            console.error('Failed to get collaborative recommendations:', error);
            return [];
        }
    }
    async getTrendingRecommendations(userProfile, limit = 10) {
        try {
            const recommendations = [];
            const recentAnalytics = await prisma.searchAnalytics.findMany({
                where: {
                    createdAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: 1000,
            });
            const trendingScores = new Map();
            recentAnalytics.forEach(record => {
                const query = record.query.toLowerCase();
                const currentScore = trendingScores.get(query) || 0;
                const recencyWeight = Math.exp(-(Date.now() - record.createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000));
                trendingScores.set(query, currentScore + (1 * recencyWeight));
            });
            const topTrending = Array.from(trendingScores.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, limit);
            for (const [query, score] of topTrending) {
                const searchResults = await knowledgeSearchEngine_1.knowledgeSearchEngine.searchKnowledge({
                    query,
                    pagination: { page: 1, limit: 2 },
                });
                for (const document of searchResults.documents) {
                    const personalizedScore = this.calculateTrendingScore(document, userProfile, score);
                    const reason = `Trending topic: ${query}`;
                    recommendations.push({
                        document,
                        score: personalizedScore,
                        reason,
                        type: 'trending',
                    });
                }
            }
            return recommendations.sort((a, b) => b.score - a.score).slice(0, limit);
        }
        catch (error) {
            console.error('Failed to get trending recommendations:', error);
            return [];
        }
    }
    async getSimilarUsersRecommendations(userProfile, limit = 10) {
        try {
            const recommendations = [];
            const similarUsers = await prisma.user.findMany({
                where: {
                    role: userProfile.role,
                    ...(userProfile.department && { department: userProfile.department }),
                    id: { not: userProfile.id },
                },
                take: 5,
            });
            const recentDocuments = await prisma.searchIndex.findMany({
                where: {
                    metadata: {
                        path: ['accessLevel'],
                        equals: 'PUBLIC',
                    },
                    lastAccessedAt: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    },
                },
                orderBy: { lastAccessedAt: 'desc' },
                take: limit * 3,
            });
            for (const document of recentDocuments) {
                const score = this.calculateSimilarUserScore(document, userProfile, similarUsers);
                const reason = `Recently viewed by users in your ${userProfile.role} role`;
                recommendations.push({
                    document: this.mapToSearchDocument(document),
                    score,
                    reason,
                    type: 'similar_users',
                });
            }
            return recommendations.sort((a, b) => b.score - a.score).slice(0, limit);
        }
        catch (error) {
            console.error('Failed to get similar users recommendations:', error);
            return [];
        }
    }
    async recordUserAction(userId, action) {
        try {
            const userProfile = await this.getUserProfile(userId);
            switch (action.type) {
                case 'search':
                    if (action.query) {
                        userProfile.searchHistory.push({
                            query: action.query,
                            timestamp: new Date(),
                            resultsCount: 0,
                            clickedResults: [],
                        });
                    }
                    break;
                case 'view':
                    if (action.documentId) {
                        userProfile.viewHistory.push({
                            documentId: action.documentId,
                            timestamp: new Date(),
                            duration: action.duration || 0,
                            completionRate: 1.0,
                        });
                        await prisma.searchIndex.update({
                            where: { id: action.documentId },
                            data: {
                                viewCount: { increment: 1 },
                                lastAccessedAt: new Date(),
                            },
                        });
                    }
                    break;
                case 'like':
                    if (action.documentId) {
                        await prisma.searchIndex.update({
                            where: { id: action.documentId },
                            data: {
                                metadata: {
                                    path: ['likeCount'],
                                    increment: 1,
                                },
                            },
                        });
                    }
                    break;
            }
            this.userProfiles.set(userId, userProfile);
            await this.updateUserPreferences(userId);
        }
        catch (error) {
            console.error('Failed to record user action:', error);
        }
    }
    async getUserProfile(userId) {
        const cachedProfile = this.userProfiles.get(userId);
        if (cachedProfile) {
            return cachedProfile;
        }
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new Error(`User not found: ${userId}`);
        }
        const searchHistory = await this.getUserSearchHistory(userId);
        const viewHistory = await this.getUserViewHistory(userId);
        const preferences = await this.getUserPreferences(userId);
        const profile = {
            id: userId,
            role: user.role,
            department: user.department,
            practiceAreas: [],
            searchHistory,
            viewHistory,
            preferences,
        };
        this.userProfiles.set(userId, profile);
        return profile;
    }
    async getUserSearchHistory(userId) {
        const analytics = await prisma.searchAnalytics.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        return analytics.map(record => ({
            query: record.query,
            timestamp: record.createdAt,
            resultsCount: record.resultsCount,
            clickedResults: [],
        }));
    }
    async getUserViewHistory(userId) {
        return [];
    }
    async getUserPreferences(userId) {
        return {
            contentTypes: [],
            categories: [],
            tags: [],
            language: 'zh-CN',
            updateFrequency: 'weekly',
        };
    }
    async updateUserPreferences(userId) {
        const userProfile = this.userProfiles.get(userId);
        if (!userProfile)
            return;
        const contentTypes = new Set();
        const categories = new Set();
        const tags = new Set();
        userProfile.searchHistory.forEach(search => {
        });
        userProfile.preferences = {
            contentTypes: Array.from(contentTypes),
            categories: Array.from(categories),
            tags: Array.from(tags),
            language: userProfile.preferences.language,
            updateFrequency: userProfile.preferences.updateFrequency,
        };
    }
    extractUserInterests(searchHistory) {
        const interests = new Set();
        searchHistory.forEach(search => {
            const keywords = search.query.toLowerCase().split(/\s+/);
            keywords.forEach(keyword => {
                if (keyword.length > 2) {
                    interests.add(keyword);
                }
            });
        });
        return Array.from(interests);
    }
    calculateContentBasedScore(document, userProfile) {
        let score = 0;
        if (userProfile.preferences.contentTypes.includes(document.contentType || '')) {
            score += 10;
        }
        const categoryMatch = document.categories.some(category => userProfile.preferences.categories.includes(category));
        if (categoryMatch) {
            score += 8;
        }
        const tagMatch = document.tags.some(tag => userProfile.preferences.tags.includes(tag));
        if (tagMatch) {
            score += 6;
        }
        const userInterests = this.extractUserInterests(userProfile.searchHistory);
        const content = `${document.title} ${document.content}`.toLowerCase();
        const interestMatches = userInterests.filter(interest => content.includes(interest));
        score += interestMatches.length * 3;
        const viewBoost = Math.log(document.metadata?.viewCount || 1) * 0.5;
        score += viewBoost;
        const daysSinceCreated = (Date.now() - document.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        const recencyBoost = Math.max(0, 30 - daysSinceCreated) * 0.1;
        score += recencyBoost;
        return score;
    }
    generateContentBasedReason(document, userProfile) {
        const reasons = [];
        if (userProfile.preferences.contentTypes.includes(document.contentType || '')) {
            reasons.push(`Matches your interest in ${document.contentType}`);
        }
        if (document.categories.some(cat => userProfile.preferences.categories.includes(cat))) {
            reasons.push(`Related to your preferred categories`);
        }
        if (document.tags.some(tag => userProfile.preferences.tags.includes(tag))) {
            reasons.push(`Contains your preferred tags`);
        }
        if (reasons.length === 0) {
            reasons.push('Based on your recent activity');
        }
        return reasons.join(', ');
    }
    async findSimilarUsers(userProfile) {
        const similarUsers = await prisma.user.findMany({
            where: {
                role: userProfile.role,
                id: { not: userProfile.id },
            },
            take: 10,
        });
        return similarUsers.map(user => ({
            id: user.id,
            role: user.role,
            department: user.department,
            practiceAreas: [],
            searchHistory: [],
            viewHistory: [],
            preferences: {
                contentTypes: [],
                categories: [],
                tags: [],
                language: 'zh-CN',
                updateFrequency: 'weekly',
            },
        }));
    }
    calculateCollaborativeScore(document, similarUsers) {
        let score = 5;
        score += similarUsers.length * 0.5;
        const viewBoost = Math.log(document.metadata?.viewCount || 1) * 0.3;
        score += viewBoost;
        return score;
    }
    calculateTrendingScore(document, userProfile, trendingScore) {
        let score = trendingScore * 2;
        const contentMatch = this.calculateContentBasedScore(document, userProfile);
        score += contentMatch * 0.3;
        return score;
    }
    calculateSimilarUserScore(document, userProfile, similarUsers) {
        let score = 3;
        if (userProfile.role === 'LAWYER' || userProfile.role === 'ATTORNEY') {
            score += 2;
        }
        if (userProfile.department) {
            score += 1;
        }
        const daysSinceAccessed = document.lastAccessedAt ?
            (Date.now() - document.lastAccessedAt.getTime()) / (1000 * 60 * 60 * 24) : 30;
        const recencyBoost = Math.max(0, 30 - daysSinceAccessed) * 0.2;
        score += recencyBoost;
        return score;
    }
    mapToSearchDocument(document) {
        return {
            id: document.id,
            entityId: document.entityId,
            entityType: document.entityType,
            title: document.title,
            content: document.content,
            tags: document.tags || [],
            categories: document.metadata?.categories || [],
            language: document.language,
            contentType: document.metadata?.contentType,
            accessLevel: document.accessLevel,
            authorId: document.metadata?.authorId,
            metadata: document.metadata || {},
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
        };
    }
    applyContextualScoring(recommendations, userProfile, context) {
        if (!context)
            return recommendations;
        return recommendations.map(rec => {
            let score = rec.score;
            if (context.timeOfDay) {
                const hour = new Date().getHours();
                if (hour >= 9 && hour <= 17) {
                    if (rec.document.contentType === 'LEGAL_GUIDE' || rec.document.contentType === 'BEST_PRACTICE') {
                        score += 2;
                    }
                }
            }
            if (context.currentCase) {
                const caseKeywords = context.currentCase.toLowerCase().split(/\s+/);
                const content = `${rec.document.title} ${rec.document.content}`.toLowerCase();
                const matches = caseKeywords.filter(keyword => content.includes(keyword));
                score += matches.length * 1.5;
            }
            if (context.currentTask) {
                const taskKeywords = context.currentTask.toLowerCase().split(/\s+/);
                const content = `${rec.document.title} ${rec.document.content}`.toLowerCase();
                const matches = taskKeywords.filter(keyword => content.includes(keyword));
                score += matches.length * 1.2;
            }
            return { ...rec, score };
        });
    }
    deduplicateRecommendations(recommendations, excludeDocumentId) {
        const seen = new Set();
        return recommendations.filter(rec => {
            if (rec.document.id === excludeDocumentId)
                return false;
            if (seen.has(rec.document.id))
                return false;
            seen.add(rec.document.id);
            return true;
        });
    }
    async logRecommendationAnalytics(userId, recommendations) {
        try {
            console.log(`Generated ${recommendations.length} recommendations for user ${userId}`);
        }
        catch (error) {
            console.error('Failed to log recommendation analytics:', error);
        }
    }
    initializeTrendingContent() {
        this.updateTrendingContent();
        setInterval(() => this.updateTrendingContent(), 60 * 60 * 1000);
    }
    async updateTrendingContent() {
        try {
            const recentAnalytics = await prisma.searchAnalytics.findMany({
                where: {
                    createdAt: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: 1000,
            });
            const trendingScores = new Map();
            recentAnalytics.forEach(record => {
                const query = record.query.toLowerCase();
                const currentScore = trendingScores.get(query) || 0;
                const recencyWeight = Math.exp(-(Date.now() - record.createdAt.getTime()) / (24 * 60 * 60 * 1000));
                trendingScores.set(query, currentScore + (1 * recencyWeight));
            });
            this.trendingContent.clear();
            Array.from(trendingScores.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 50)
                .forEach(([query, score]) => {
                this.trendingContent.set(query, { documentId: query, score, timestamp: new Date() });
            });
        }
        catch (error) {
            console.error('Failed to update trending content:', error);
        }
    }
    startPeriodicUpdates() {
        setInterval(() => {
            this.userProfiles.clear();
        }, 60 * 60 * 1000);
        setInterval(() => {
            this.updateContentSimilarity();
        }, 6 * 60 * 60 * 1000);
    }
    async updateContentSimilarity() {
        console.log('Updating content similarity matrix...');
    }
}
exports.KnowledgeRecommendationEngine = KnowledgeRecommendationEngine;
exports.knowledgeRecommendationEngine = new KnowledgeRecommendationEngine();
//# sourceMappingURL=recommendationEngine.js.map