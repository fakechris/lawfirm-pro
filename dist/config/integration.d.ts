export declare const integrationConfig: {
    gateway: {
        enabled: boolean;
        port: number;
        basePath: string;
        timeout: number;
        retries: number;
        retryDelay: number;
    };
    rateLimit: {
        enabled: boolean;
        windowMs: number;
        max: number;
        skipSuccessfulRequests: boolean;
        skipFailedRequests: boolean;
    };
    circuitBreaker: {
        enabled: boolean;
        timeout: number;
        errorThresholdPercentage: number;
        resetTimeout: number;
    };
    auth: {
        apiKeyHeader: string;
        webhookSecret: string;
        allowedOrigins: string[];
    };
    courtSystems: {
        pacer: {
            enabled: boolean;
            apiKey: string | undefined;
            clientId: string | undefined;
            baseUrl: string;
            timeout: number;
            rateLimit: {
                requestsPerMinute: number;
                requestsPerHour: number;
            };
        };
        stateCourts: {
            enabled: boolean;
            baseUrl: string;
            timeout: number;
            supportedStates: string[];
        };
    };
    payment: {
        stripe: {
            enabled: boolean;
            apiKey: string | undefined;
            webhookSecret: string | undefined;
            publishableKey: string | undefined;
            environment: string;
        };
        paypal: {
            enabled: boolean;
            clientId: string | undefined;
            clientSecret: string | undefined;
            environment: string;
            baseUrl: string;
        };
    };
    legalResearch: {
        lexisNexis: {
            enabled: boolean;
            apiKey: string | undefined;
            baseUrl: string;
            timeout: number;
        };
        westlaw: {
            enabled: boolean;
            apiKey: string | undefined;
            baseUrl: string;
            timeout: number;
        };
    };
    documentManagement: {
        googleDrive: {
            enabled: boolean;
            clientId: string | undefined;
            clientSecret: string | undefined;
            redirectUri: string | undefined;
            scopes: string[];
        };
        dropbox: {
            enabled: boolean;
            apiKey: string | undefined;
            appSecret: string | undefined;
            redirectUri: string | undefined;
        };
    };
    communication: {
        twilio: {
            enabled: boolean;
            accountSid: string | undefined;
            authToken: string | undefined;
            phoneNumber: string | undefined;
        };
        sendGrid: {
            enabled: boolean;
            apiKey: string | undefined;
            fromEmail: string | undefined;
            templates: {
                welcome: string | undefined;
                notification: string | undefined;
                reminder: string | undefined;
            };
        };
    };
    cache: {
        enabled: boolean;
        ttl: number;
        maxSize: number;
        strategies: {
            courtData: boolean;
            paymentData: boolean;
            researchData: boolean;
        };
    };
    logging: {
        enabled: boolean;
        level: string;
        sensitiveDataMasking: boolean;
        fieldsToMask: string[];
    };
    webhooks: {
        enabled: boolean;
        endpoint: string;
        secret: string;
        allowedEvents: string[];
    };
    dataTransformation: {
        enabled: boolean;
        validationLevel: string;
        autoRetry: boolean;
        maxRetries: number;
    };
};
export default integrationConfig;
//# sourceMappingURL=integration.d.ts.map