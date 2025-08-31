"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchMiddleware = void 0;
exports.searchQueryAnalyzer = searchQueryAnalyzer;
exports.searchPerformanceLogger = searchPerformanceLogger;
exports.validateSearchParams = validateSearchParams;
exports.addSearchHeaders = addSearchHeaders;
exports.searchRateLimit = searchRateLimit;
exports.searchCacheMiddleware = searchCacheMiddleware;
exports.searchCacheCleanup = searchCacheCleanup;
exports.addSearchContext = addSearchContext;
exports.searchErrorHandler = searchErrorHandler;
exports.validateIndexingParams = validateIndexingParams;
exports.checkSearchPermissions = checkSearchPermissions;
const searchTextUtils_1 = require("../../utils/knowledge-base/search/searchTextUtils");
async function searchQueryAnalyzer(req, res, next) {
    if (req.path.includes('/search') && req.method === 'POST') {
        try {
            const { query } = req.body;
            if (query && typeof query === 'string') {
                req.searchAnalysis = searchTextUtils_1.searchTextUtils.analyzeSearchQuery(query);
                req.searchStartTime = Date.now();
            }
        }
        catch (error) {
            console.error('Search query analysis failed:', error);
        }
    }
    next();
}
async function searchPerformanceLogger(req, res, next) {
    const originalSend = res.send;
    res.send = function (data) {
        if (req.searchStartTime && req.path.includes('/search')) {
            const processingTime = Date.now() - req.searchStartTime;
            console.log(`Search query "${req.body?.query}" processed in ${processingTime}ms`);
            if (req.searchAnalysis) {
                console.log(`Query analysis:`, {
                    language: req.searchAnalysis.language,
                    complexity: req.searchAnalysis.complexity,
                    entityCount: req.searchAnalysis.entities.length,
                    intent: req.searchAnalysis.intent,
                });
            }
        }
        return originalSend.call(this, data);
    };
    next();
}
function validateSearchParams(req, res, next) {
    if (req.path.includes('/search') && req.method === 'POST') {
        const { query, pagination, filters } = req.body;
        if (!query || typeof query !== 'string') {
            return res.status(400).json({
                error: 'Query is required and must be a string',
            });
        }
        if (query.trim().length === 0) {
            return res.status(400).json({
                error: 'Query cannot be empty',
            });
        }
        if (query.length > 500) {
            return res.status(400).json({
                error: 'Query is too long (max 500 characters)',
            });
        }
        if (pagination) {
            const { page, limit } = pagination;
            if (page && (typeof page !== 'number' || page < 1)) {
                return res.status(400).json({
                    error: 'Page must be a positive number',
                });
            }
            if (limit && (typeof limit !== 'number' || limit < 1 || limit > 100)) {
                return res.status(400).json({
                    error: 'Limit must be a number between 1 and 100',
                });
            }
        }
        if (filters) {
            const { dateRange } = filters;
            if (dateRange) {
                const { start, end } = dateRange;
                if (start && end && new Date(start) > new Date(end)) {
                    return res.status(400).json({
                        error: 'Date range start must be before end',
                    });
                }
            }
        }
    }
    next();
}
function addSearchHeaders(req, res, next) {
    if (req.path.includes('/search')) {
        res.setHeader('X-Search-Engine', 'LawFirmPro-KnowledgeBase');
        res.setHeader('X-Search-Version', '1.0');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
}
const searchRequests = new Map();
function searchRateLimit(maxRequests = 30, windowMs = 60000) {
    return (req, res, next) => {
        if (!req.path.includes('/search')) {
            return next();
        }
        const userId = req.user?.id || req.ip;
        const now = Date.now();
        const userRequests = searchRequests.get(userId);
        if (!userRequests || now > userRequests.resetTime) {
            searchRequests.set(userId, {
                count: 1,
                resetTime: now + windowMs,
            });
            return next();
        }
        if (userRequests.count >= maxRequests) {
            return res.status(429).json({
                error: 'Too many search requests',
                message: `Please wait ${Math.ceil((userRequests.resetTime - now) / 1000)} seconds before trying again`,
            });
        }
        userRequests.count++;
        return next();
    };
}
const searchCache = new Map();
function searchCacheMiddleware(ttl = 300000) {
    return async (req, res, next) => {
        if (req.method !== 'POST' || !req.path.includes('/search')) {
            return next();
        }
        const cacheKey = JSON.stringify(req.body);
        const cached = searchCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < ttl) {
            console.log('Cache hit for search query');
            return res.json({
                success: true,
                data: cached.data,
                cached: true,
            });
        }
        const originalJson = res.json;
        res.json = function (data) {
            if (data.success) {
                searchCache.set(cacheKey, {
                    data: data.data,
                    timestamp: Date.now(),
                    ttl,
                });
                console.log('Cached search result');
            }
            return originalJson.call(this, data);
        };
        next();
    };
}
function searchCacheCleanup() {
    setInterval(() => {
        const now = Date.now();
        for (const [key, value] of searchCache.entries()) {
            if (now - value.timestamp > value.ttl) {
                searchCache.delete(key);
            }
        }
    }, 60000);
}
function addSearchContext(req, res, next) {
    if (req.path.includes('/search') && req.user) {
        req.body = req.body || {};
        req.body.userId = req.user.id;
        req.body.userRole = req.user.role;
        if (req.user.department) {
            req.body.userDepartment = req.user.department;
        }
    }
    next();
}
function searchErrorHandler(err, req, res, next) {
    if (req.path.includes('/search')) {
        console.error('Search error:', err);
        return res.status(500).json({
            success: false,
            error: 'Search service temporarily unavailable',
            message: process.env.NODE_ENV === 'development' ? err.message : 'Please try again later',
        });
    }
    next(err);
}
function validateIndexingParams(req, res, next) {
    if (req.path.includes('/index') && req.method === 'POST') {
        const { options } = req.body;
        if (options) {
            const validOptions = [
                'extractKeywords',
                'generateSummary',
                'categorizeContent',
                'analyzeReadability',
                'extractLegalEntities',
                'generateEmbeddings'
            ];
            for (const option in options) {
                if (!validOptions.includes(option)) {
                    return res.status(400).json({
                        error: `Invalid indexing option: ${option}`,
                    });
                }
                if (typeof options[option] !== 'boolean') {
                    return res.status(400).json({
                        error: `Option ${option} must be a boolean`,
                    });
                }
            }
        }
    }
    next();
}
function checkSearchPermissions(req, res, next) {
    if (req.path.includes('/search')) {
        const user = req.user;
        if (!user) {
            return res.status(401).json({
                error: 'Authentication required for search',
            });
        }
        const allowedRoles = ['ADMIN', 'LAWYER', 'PARALEGAL', 'ASSISTANT', 'ATTORNEY'];
        if (!allowedRoles.includes(user.role)) {
            return res.status(403).json({
                error: 'Insufficient permissions for search',
            });
        }
    }
    next();
}
exports.searchMiddleware = [
    searchQueryAnalyzer,
    validateSearchParams,
    checkSearchPermissions,
    addSearchContext,
    searchRateLimit(),
    searchCacheMiddleware(),
    addSearchHeaders,
    searchPerformanceLogger,
];
//# sourceMappingURL=searchMiddleware.js.map