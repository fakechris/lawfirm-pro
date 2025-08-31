"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackRealTimeMetrics = exports.trackPerformanceMetrics = exports.trackApiErrors = exports.trackUserInteractions = exports.trackSearchResults = exports.trackSearchActivity = exports.trackArticleViews = exports.trackKnowledgeBaseRequests = exports.analyticsMiddleware = exports.AnalyticsMiddleware = void 0;
const engine_1 = require("../../services/knowledge-base/analytics/engine");
const service_1 = require("../../integrations/knowledge-base/service");
class AnalyticsMiddleware {
    constructor() {
        this.activeSessions = new Map();
        this.trackKnowledgeBaseRequests = (req, res, next) => {
            if (!req.path.startsWith('/api/knowledge-base') && !req.path.startsWith('/knowledge-base')) {
                return next();
            }
            const sessionId = this.getOrCreateSession(req);
            const startTime = Date.now();
            req.analyticsContext = {
                sessionId,
                startTime,
                userId: req.user?.id,
                path: req.path,
                method: req.method,
                userAgent: req.get('User-Agent'),
                ipAddress: req.ip,
            };
            this.trackRequestStart(req);
            const originalEnd = res.end;
            res.end = function (chunk, encoding) {
                const endTime = Date.now();
                const responseTime = endTime - startTime;
                AnalyticsMiddleware.getInstance().trackRequestEnd(req, res, responseTime);
                originalEnd.call(this, chunk, encoding);
            };
            next();
        };
        this.trackArticleViews = async (req, res, next) => {
            if (req.method === 'GET' && req.path.match(/\/api\/knowledge-base\/articles\/[^\/]+$/)) {
                const articleId = req.path.split('/').pop();
                if (articleId && req.analyticsContext) {
                    try {
                        await engine_1.knowledgeBaseAnalyticsEngine.recordArticleView({
                            articleId,
                            userId: req.analyticsContext.userId,
                            sessionId: req.analyticsContext.sessionId,
                            referrer: req.get('Referer'),
                        });
                        await service_1.knowledgeBaseIntegrationService.emitEvent({
                            type: 'article_viewed',
                            source: 'knowledge_base_api',
                            payload: {
                                articleId,
                                userId: req.analyticsContext.userId,
                                sessionId: req.analyticsContext.sessionId,
                                timestamp: new Date(),
                                metadata: {
                                    path: req.path,
                                    userAgent: req.analyticsContext.userAgent,
                                },
                            },
                        });
                    }
                    catch (error) {
                        console.error('Failed to track article view:', error);
                    }
                }
            }
            next();
        };
        this.trackSearchActivity = async (req, res, next) => {
            if (req.method === 'GET' && req.path.includes('/search')) {
                const startTime = Date.now();
                req.searchStartTime = startTime;
            }
            next();
        };
        this.trackSearchResults = async (req, res, next) => {
            if (req.method === 'GET' && req.path.includes('/search') && res.statusCode === 200) {
                const searchStartTime = req.searchStartTime;
                if (searchStartTime && req.analyticsContext) {
                    const responseTime = Date.now() - searchStartTime;
                    try {
                        const query = req.query.q || '';
                        const resultsCount = res.locals.searchResults?.length || 0;
                        await engine_1.knowledgeBaseAnalyticsEngine.recordSearchActivity({
                            query,
                            userId: req.analyticsContext.userId,
                            sessionId: req.analyticsContext.sessionId,
                            resultsCount,
                            clickedResults: [],
                            filters: req.query.filters ? JSON.parse(req.query.filters) : undefined,
                            responseTime,
                            success: true,
                        });
                        await service_1.knowledgeBaseIntegrationService.emitEvent({
                            type: 'search_performed',
                            source: 'knowledge_base_api',
                            payload: {
                                query,
                                resultsCount,
                                responseTime,
                                userId: req.analyticsContext.userId,
                                sessionId: req.analyticsContext.sessionId,
                                timestamp: new Date(),
                                metadata: {
                                    path: req.path,
                                    userAgent: req.analyticsContext.userAgent,
                                },
                            },
                        });
                    }
                    catch (error) {
                        console.error('Failed to track search activity:', error);
                    }
                }
            }
            next();
        };
        this.trackUserInteractions = async (req, res, next) => {
            if (req.method === 'POST' && req.path.match(/\/api\/knowledge-base\/articles\/[^\/]+\/(like|comment|share|bookmark)/)) {
                const articleId = req.path.split('/')[4];
                const interactionType = req.path.split('/')[5];
                if (articleId && interactionType && req.analyticsContext?.userId) {
                    try {
                        await engine_1.knowledgeBaseAnalyticsEngine.recordUserInteraction({
                            articleId,
                            userId: req.analyticsContext.userId,
                            interactionType: interactionType,
                            content: req.body.content,
                            metadata: req.body.metadata,
                        });
                        await service_1.knowledgeBaseIntegrationService.emitEvent({
                            type: 'user_interaction',
                            source: 'knowledge_base_api',
                            payload: {
                                articleId,
                                interactionType,
                                userId: req.analyticsContext.userId,
                                content: req.body.content,
                                timestamp: new Date(),
                                metadata: {
                                    path: req.path,
                                    userAgent: req.analyticsContext.userAgent,
                                },
                            },
                        });
                    }
                    catch (error) {
                        console.error('Failed to track user interaction:', error);
                    }
                }
            }
            next();
        };
        this.trackApiErrors = (err, req, res, next) => {
            if (req.analyticsContext) {
                const responseTime = Date.now() - req.analyticsContext.startTime;
                this.trackError(req, err, responseTime);
            }
            next(err);
        };
        this.trackPerformanceMetrics = (req, res, next) => {
            const startTime = Date.now();
            const startMemory = process.memoryUsage();
            res.on('finish', () => {
                const endTime = Date.now();
                const responseTime = endTime - startTime;
                const endMemory = process.memoryUsage();
                this.trackPerformance(req, res, {
                    responseTime,
                    memoryUsage: {
                        start: startMemory,
                        end: endMemory,
                        delta: {
                            rss: endMemory.rss - startMemory.rss,
                            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
                            heapTotal: endMemory.heapTotal - startMemory.heapTotal,
                        },
                    },
                });
            });
            next();
        };
        this.trackRealTimeMetrics = (req, res, next) => {
            if (req.path === '/api/knowledge-base/analytics/real-time') {
                this.updateRealTimeMetrics(req);
            }
            next();
        };
    }
    static getInstance() {
        if (!AnalyticsMiddleware.instance) {
            AnalyticsMiddleware.instance = new AnalyticsMiddleware();
        }
        return AnalyticsMiddleware.instance;
    }
    getOrCreateSession(req) {
        const userAgent = req.get('User-Agent');
        const ip = req.ip;
        let sessionId = req.headers['x-session-id'];
        if (!sessionId) {
            const sessionData = `${userAgent || ''}_${ip || ''}_${req.user?.id || 'anonymous'}`;
            sessionId = this.hashSessionData(sessionData);
        }
        this.activeSessions.set(sessionId, {
            lastActivity: new Date(),
            userId: req.user?.id,
        });
        return sessionId;
    }
    hashSessionData(data) {
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return `session_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
    }
    trackRequestStart(req) {
        if (req.analyticsContext) {
            console.log(`Request started: ${req.analyticsContext.method} ${req.analyticsContext.path}`);
        }
    }
    trackRequestEnd(req, res, responseTime) {
        if (req.analyticsContext) {
            const analyticsData = {
                sessionId: req.analyticsContext.sessionId,
                userId: req.analyticsContext.userId,
                path: req.analyticsContext.path,
                method: req.analyticsContext.method,
                responseTime,
                statusCode: res.statusCode,
                userAgent: req.analyticsContext.userAgent,
                ipAddress: req.analyticsContext.ipAddress,
                timestamp: new Date(),
            };
            this.storeRequestAnalytics(analyticsData);
            if (responseTime > 1000 || res.statusCode >= 400) {
                service_1.knowledgeBaseIntegrationService.emitEvent({
                    type: 'api_request',
                    source: 'knowledge_base_middleware',
                    payload: analyticsData,
                }).catch(error => {
                    console.error('Failed to emit API request event:', error);
                });
            }
        }
    }
    trackError(req, error, responseTime) {
        if (req.analyticsContext) {
            const errorData = {
                sessionId: req.analyticsContext.sessionId,
                userId: req.analyticsContext.userId,
                path: req.analyticsContext.path,
                method: req.analyticsContext.method,
                responseTime,
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                },
                statusCode: error.statusCode || 500,
                userAgent: req.analyticsContext.userAgent,
                ipAddress: req.analyticsContext.ipAddress,
                timestamp: new Date(),
            };
            this.storeErrorAnalytics(errorData);
            service_1.knowledgeBaseIntegrationService.emitEvent({
                type: 'api_error',
                source: 'knowledge_base_middleware',
                payload: errorData,
            }).catch(error => {
                console.error('Failed to emit API error event:', error);
            });
        }
    }
    trackPerformance(req, res, metrics) {
        if (req.analyticsContext) {
            const performanceData = {
                sessionId: req.analyticsContext.sessionId,
                userId: req.analyticsContext.userId,
                path: req.analyticsContext.path,
                method: req.analyticsContext.method,
                ...metrics,
                timestamp: new Date(),
            };
            this.storePerformanceAnalytics(performanceData);
            if (metrics.responseTime > 2000) {
                service_1.knowledgeBaseIntegrationService.emitEvent({
                    type: 'performance_issue',
                    source: 'knowledge_base_middleware',
                    payload: performanceData,
                }).catch(error => {
                    console.error('Failed to emit performance issue event:', error);
                });
            }
        }
    }
    updateRealTimeMetrics(req) {
        const now = new Date();
        const activeSessions = this.activeSessions.size;
        const memoryUsage = process.memoryUsage();
        console.log(`Real-time metrics update: ${activeSessions} active sessions, ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB memory used`);
    }
    storeRequestAnalytics(data) {
        console.log('Storing request analytics:', data);
    }
    storeErrorAnalytics(data) {
        console.log('Storing error analytics:', data);
    }
    storePerformanceAnalytics(data) {
        console.log('Storing performance analytics:', data);
    }
    startSessionCleanup() {
        setInterval(() => {
            const now = new Date();
            const cutoff = new Date(now.getTime() - 30 * 60 * 1000);
            for (const [sessionId, session] of this.activeSessions.entries()) {
                if (session.lastActivity < cutoff) {
                    this.activeSessions.delete(sessionId);
                }
            }
        }, 5 * 60 * 1000);
    }
    getAnalyticsContext(req) {
        return req.analyticsContext;
    }
    getActiveSessionsCount() {
        return this.activeSessions.size;
    }
    getSessionAnalytics() {
        const sessions = Array.from(this.activeSessions.entries());
        return {
            totalSessions: sessions.length,
            authenticatedSessions: sessions.filter(([, session]) => session.userId).length,
            anonymousSessions: sessions.filter(([, session]) => !session.userId).length,
            recentActivity: sessions.map(([id, session]) => ({
                sessionId: id,
                userId: session.userId,
                lastActivity: session.lastActivity,
            })),
        };
    }
}
exports.AnalyticsMiddleware = AnalyticsMiddleware;
exports.analyticsMiddleware = AnalyticsMiddleware.getInstance();
exports.trackKnowledgeBaseRequests = exports.analyticsMiddleware.trackKnowledgeBaseRequests;
exports.trackArticleViews = exports.analyticsMiddleware.trackArticleViews;
exports.trackSearchActivity = exports.analyticsMiddleware.trackSearchActivity;
exports.trackSearchResults = exports.analyticsMiddleware.trackSearchResults;
exports.trackUserInteractions = exports.analyticsMiddleware.trackUserInteractions;
exports.trackApiErrors = exports.analyticsMiddleware.trackApiErrors;
exports.trackPerformanceMetrics = exports.analyticsMiddleware.trackPerformanceMetrics;
exports.trackRealTimeMetrics = exports.analyticsMiddleware.trackRealTimeMetrics;
//# sourceMappingURL=tracker.js.map