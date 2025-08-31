import { Request, Response, NextFunction } from 'express';
import { IntegrationRequest } from '../../services/integration/types';
export interface IntegrationRequestExtended extends Request {
    integrationRequest?: IntegrationRequest;
}
export declare class IntegrationMiddleware {
    private gateway;
    constructor();
    handleIntegration: (service: string) => (req: IntegrationRequestExtended, res: Response, next: NextFunction) => Promise<void>;
    validateApiKey: (req: IntegrationRequestExtended, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
    validateServiceAccess: (service: string) => (req: IntegrationRequestExtended, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
    logRequest: (req: IntegrationRequestExtended, res: Response, next: NextFunction) => void;
    private generateRequestId;
    private sanitizeHeaders;
}
export declare const integrationMiddleware: IntegrationMiddleware;
//# sourceMappingURL=gateway.d.ts.map