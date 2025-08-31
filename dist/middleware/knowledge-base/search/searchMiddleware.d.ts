import { Request, Response, NextFunction } from 'express';
import { SearchQueryAnalysis } from '../../utils/knowledge-base/search/searchTextUtils';
export interface SearchRequest extends Request {
    searchAnalysis?: SearchQueryAnalysis;
    searchStartTime?: number;
}
export declare function searchQueryAnalyzer(req: SearchRequest, res: Response, next: NextFunction): Promise<void>;
export declare function searchPerformanceLogger(req: SearchRequest, res: Response, next: NextFunction): Promise<void>;
export declare function validateSearchParams(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>>;
export declare function addSearchHeaders(req: Request, res: Response, next: NextFunction): void;
export declare function searchRateLimit(maxRequests?: number, windowMs?: number): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare function searchCacheMiddleware(ttl?: number): (req: SearchRequest, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export declare function searchCacheCleanup(): void;
export declare function addSearchContext(req: SearchRequest, res: Response, next: NextFunction): void;
export declare function searchErrorHandler(err: Error, req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>>;
export declare function validateIndexingParams(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>>;
export declare function checkSearchPermissions(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>>;
export declare const searchMiddleware: (((req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>) | ((req: SearchRequest, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>))[];
//# sourceMappingURL=searchMiddleware.d.ts.map