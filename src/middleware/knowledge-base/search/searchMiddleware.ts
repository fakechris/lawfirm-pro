import { Request, Response, NextFunction } from 'express';
import { searchTextUtils, SearchQueryAnalysis } from '../../utils/knowledge-base/search/searchTextUtils';
import { knowledgeSearchEngine } from '../../services/knowledge-base/search/knowledgeSearchEngine';

export interface SearchRequest extends Request {
  searchAnalysis?: SearchQueryAnalysis;
  searchStartTime?: number;
}

// Middleware to analyze search queries
export async function searchQueryAnalyzer(req: SearchRequest, res: Response, next: NextFunction) {
  if (req.path.includes('/search') && req.method === 'POST') {
    try {
      const { query } = req.body;
      if (query && typeof query === 'string') {
        req.searchAnalysis = searchTextUtils.analyzeSearchQuery(query);
        req.searchStartTime = Date.now();
      }
    } catch (error) {
      console.error('Search query analysis failed:', error);
    }
  }
  next();
}

// Middleware to log search performance
export async function searchPerformanceLogger(req: SearchRequest, res: Response, next: NextFunction) {
  const originalSend = res.send;
  res.send = function(data) {
    if (req.searchStartTime && req.path.includes('/search')) {
      const processingTime = Date.now() - req.searchStartTime;
      console.log(`Search query "${req.body?.query}" processed in ${processingTime}ms`);
      
      // You can add more detailed logging here
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

// Middleware to validate search parameters
export function validateSearchParams(req: Request, res: Response, next: NextFunction) {
  if (req.path.includes('/search') && req.method === 'POST') {
    const { query, pagination, filters } = req.body;

    // Validate query
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

    // Validate pagination
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

    // Validate filters
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

// Middleware to add search headers
export function addSearchHeaders(req: Request, res: Response, next: NextFunction) {
  if (req.path.includes('/search')) {
    res.setHeader('X-Search-Engine', 'LawFirmPro-KnowledgeBase');
    res.setHeader('X-Search-Version', '1.0');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
}

// Middleware to rate limit search requests
const searchRequests = new Map<string, { count: number; resetTime: number }>();

export function searchRateLimit(maxRequests: number = 30, windowMs: number = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.path.includes('/search')) {
      return next();
    }

    const userId = req.user?.id || req.ip;
    const now = Date.now();
    const userRequests = searchRequests.get(userId);

    if (!userRequests || now > userRequests.resetTime) {
      // Reset window
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

// Middleware to cache search results
const searchCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

export function searchCacheMiddleware(ttl: number = 300000) { // 5 minutes default
  return async (req: SearchRequest, res: Response, next: NextFunction) => {
    if (req.method !== 'POST' || !req.path.includes('/search')) {
      return next();
    }

    // Create cache key from request body
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

    // Override res.json to cache the response
    const originalJson = res.json;
    res.json = function(data) {
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

// Middleware to clean up expired cache entries
export function searchCacheCleanup() {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of searchCache.entries()) {
      if (now - value.timestamp > value.ttl) {
        searchCache.delete(key);
      }
    }
  }, 60000); // Clean up every minute
}

// Middleware to add search context
export function addSearchContext(req: SearchRequest, res: Response, next: NextFunction) {
  if (req.path.includes('/search') && req.user) {
    // Add user context for personalization
    req.body = req.body || {};
    req.body.userId = req.user.id;
    
    // Add user role context
    req.body.userRole = req.user.role;
    
    // Add user department/context if available
    if (req.user.department) {
      req.body.userDepartment = req.user.department;
    }
  }
  
  next();
}

// Middleware to handle search errors gracefully
export function searchErrorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (req.path.includes('/search')) {
    console.error('Search error:', err);
    
    // Return a safe error response
    return res.status(500).json({
      success: false,
      error: 'Search service temporarily unavailable',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Please try again later',
    });
  }
  
  next(err);
}

// Middleware to validate indexing parameters
export function validateIndexingParams(req: Request, res: Response, next: NextFunction) {
  if (req.path.includes('/index') && req.method === 'POST') {
    const { options } = req.body;
    
    if (options) {
      // Validate indexing options
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

// Middleware to check search permissions
export function checkSearchPermissions(req: Request, res: Response, next: NextFunction) {
  if (req.path.includes('/search')) {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        error: 'Authentication required for search',
      });
    }
    
    // Check if user has permission to search
    // This can be extended based on user roles and permissions
    const allowedRoles = ['ADMIN', 'LAWYER', 'PARALEGAL', 'ASSISTANT', 'ATTORNEY'];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions for search',
      });
    }
  }
  
  next();
}

// Export all middleware as a combined middleware
export const searchMiddleware = [
  searchQueryAnalyzer,
  validateSearchParams,
  checkSearchPermissions,
  addSearchContext,
  searchRateLimit(),
  searchCacheMiddleware(),
  addSearchHeaders,
  searchPerformanceLogger,
];