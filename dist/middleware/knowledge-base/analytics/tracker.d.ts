import { Request, Response, NextFunction } from 'express';
export interface AnalyticsRequest extends Request {
    analyticsContext?: {
        sessionId: string;
        startTime: number;
        userId?: string;
        path: string;
        method: string;
        userAgent?: string;
        ipAddress?: string;
    };
}
export declare class AnalyticsMiddleware {
    private static instance;
    private activeSessions;
    static getInstance(): AnalyticsMiddleware;
    trackKnowledgeBaseRequests: (req: AnalyticsRequest, res: Response, next: NextFunction) => void;
    trackArticleViews: (req: AnalyticsRequest, res: Response, next: NextFunction) => Promise<void>;
    trackSearchActivity: (req: AnalyticsRequest, res: Response, next: NextFunction) => Promise<void>;
    trackSearchResults: (req: AnalyticsRequest, res: Response, next: NextFunction) => Promise<void>;
    trackUserInteractions: (req: AnalyticsRequest, res: Response, next: NextFunction) => Promise<void>;
    trackApiErrors: (err: any, req: AnalyticsRequest, res: Response, next: NextFunction) => void;
    trackPerformanceMetrics: (req: AnalyticsRequest, res: Response, next: NextFunction) => void;
    trackRealTimeMetrics: (req: AnalyticsRequest, res: Response, next: NextFunction) => void;
    private getOrCreateSession;
    private hashSessionData;
    private trackRequestStart;
    private trackRequestEnd;
    private trackError;
    private trackPerformance;
    private updateRealTimeMetrics;
    private storeRequestAnalytics;
    private storeErrorAnalytics;
    private storePerformanceAnalytics;
    private startSessionCleanup;
    getAnalyticsContext(req: Request): any;
    getActiveSessionsCount(): number;
    getSessionAnalytics(): any;
}
export declare const analyticsMiddleware: AnalyticsMiddleware;
export declare const trackKnowledgeBaseRequests: (req: AnalyticsRequest, res: Response, next: NextFunction) => void;
export declare const trackArticleViews: (req: AnalyticsRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const trackSearchActivity: (req: AnalyticsRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const trackSearchResults: (req: AnalyticsRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const trackUserInteractions: (req: AnalyticsRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const trackApiErrors: (err: any, req: AnalyticsRequest, res: Response, next: NextFunction) => void;
export declare const trackPerformanceMetrics: (req: AnalyticsRequest, res: Response, next: NextFunction) => void;
export declare const trackRealTimeMetrics: (req: AnalyticsRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=tracker.d.ts.map