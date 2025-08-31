"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.integrationConfig = void 0;
exports.integrationConfig = {
    gateway: {
        enabled: process.env.INTEGRATION_GATEWAY_ENABLED === 'true',
        port: parseInt(process.env.INTEGRATION_GATEWAY_PORT || '3001'),
        basePath: '/api/integration',
        timeout: parseInt(process.env.INTEGRATION_TIMEOUT || '30000'),
        retries: parseInt(process.env.INTEGRATION_RETRIES || '3'),
        retryDelay: parseInt(process.env.INTEGRATION_RETRY_DELAY || '1000'),
    },
    rateLimit: {
        enabled: process.env.INTEGRATION_RATE_LIMIT_ENABLED === 'true',
        windowMs: parseInt(process.env.INTEGRATION_RATE_LIMIT_WINDOW_MS || '900000'),
        max: parseInt(process.env.INTEGRATION_RATE_LIMIT_MAX || '1000'),
        skipSuccessfulRequests: process.env.INTEGRATION_RATE_LIMIT_SKIP_SUCCESS === 'true',
        skipFailedRequests: process.env.INTEGRATION_RATE_LIMIT_SKIP_FAILED === 'true',
    },
    circuitBreaker: {
        enabled: process.env.INTEGRATION_CIRCUIT_BREAKER_ENABLED === 'true',
        timeout: parseInt(process.env.INTEGRATION_CIRCUIT_TIMEOUT || '30000'),
        errorThresholdPercentage: parseInt(process.env.INTEGRATION_CIRCUIT_ERROR_THRESHOLD || '50'),
        resetTimeout: parseInt(process.env.INTEGRATION_CIRCUIT_RESET_TIMEOUT || '30000'),
    },
    auth: {
        apiKeyHeader: process.env.INTEGRATION_API_KEY_HEADER || 'X-API-Key',
        webhookSecret: process.env.INTEGRATION_WEBHOOK_SECRET || 'your-webhook-secret-change-in-production',
        allowedOrigins: process.env.INTEGRATION_ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    },
    courtSystems: {
        pacer: {
            enabled: process.env.PACER_ENABLED === 'true',
            apiKey: process.env.PACER_API_KEY,
            clientId: process.env.PACER_CLIENT_ID,
            baseUrl: process.env.PACER_BASE_URL || 'https://pacer.uscourts.gov',
            timeout: parseInt(process.env.PACER_TIMEOUT || '30000'),
            rateLimit: {
                requestsPerMinute: parseInt(process.env.PACER_RATE_LIMIT || '30'),
                requestsPerHour: parseInt(process.env.PACER_HOURLY_LIMIT || '300'),
            },
        },
        stateCourts: {
            enabled: process.env.STATE_COURTS_ENABLED === 'true',
            baseUrl: process.env.STATE_COURTS_BASE_URL || 'https://api.statecourts.gov',
            timeout: parseInt(process.env.STATE_COURTS_TIMEOUT || '30000'),
            supportedStates: process.env.STATE_COURTS_SUPPORTED_STATES?.split(',') || ['CA', 'NY', 'TX', 'FL'],
        },
    },
    payment: {
        stripe: {
            enabled: process.env.STRIPE_ENABLED === 'true',
            apiKey: process.env.STRIPE_API_KEY,
            webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
            publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
            environment: process.env.STRIPE_ENVIRONMENT || 'test',
        },
        paypal: {
            enabled: process.env.PAYPAL_ENABLED === 'true',
            clientId: process.env.PAYPAL_CLIENT_ID,
            clientSecret: process.env.PAYPAL_CLIENT_SECRET,
            environment: process.env.PAYPAL_ENVIRONMENT || 'sandbox',
            baseUrl: process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com',
        },
    },
    legalResearch: {
        lexisNexis: {
            enabled: process.env.LEXIS_NEXIS_ENABLED === 'true',
            apiKey: process.env.LEXIS_NEXIS_API_KEY,
            baseUrl: process.env.LEXIS_NEXIS_BASE_URL || 'https://api.lexisnexis.com',
            timeout: parseInt(process.env.LEXIS_NEXIS_TIMEOUT || '30000'),
        },
        westlaw: {
            enabled: process.env.WESTLAW_ENABLED === 'true',
            apiKey: process.env.WESTLAW_API_KEY,
            baseUrl: process.env.WESTLAW_BASE_URL || 'https://api.westlaw.com',
            timeout: parseInt(process.env.WESTLAW_TIMEOUT || '30000'),
        },
    },
    documentManagement: {
        googleDrive: {
            enabled: process.env.GOOGLE_DRIVE_ENABLED === 'true',
            clientId: process.env.GOOGLE_DRIVE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
            redirectUri: process.env.GOOGLE_DRIVE_REDIRECT_URI,
            scopes: process.env.GOOGLE_DRIVE_SCOPES?.split(',') || ['https://www.googleapis.com/auth/drive.file'],
        },
        dropbox: {
            enabled: process.env.DROPBOX_ENABLED === 'true',
            apiKey: process.env.DROPBOX_API_KEY,
            appSecret: process.env.DROPBOX_APP_SECRET,
            redirectUri: process.env.DROPBOX_REDIRECT_URI,
        },
    },
    communication: {
        twilio: {
            enabled: process.env.TWILIO_ENABLED === 'true',
            accountSid: process.env.TWILIO_ACCOUNT_SID,
            authToken: process.env.TWILIO_AUTH_TOKEN,
            phoneNumber: process.env.TWILIO_PHONE_NUMBER,
        },
        sendGrid: {
            enabled: process.env.SENDGRID_ENABLED === 'true',
            apiKey: process.env.SENDGRID_API_KEY,
            fromEmail: process.env.SENDGRID_FROM_EMAIL,
            templates: {
                welcome: process.env.SENDGRID_TEMPLATE_WELCOME,
                notification: process.env.SENDGRID_TEMPLATE_NOTIFICATION,
                reminder: process.env.SENDGRID_TEMPLATE_REMINDER,
            },
        },
    },
    cache: {
        enabled: process.env.INTEGRATION_CACHE_ENABLED === 'true',
        ttl: parseInt(process.env.INTEGRATION_CACHE_TTL || '3600'),
        maxSize: parseInt(process.env.INTEGRATION_CACHE_MAX_SIZE || '1000'),
        strategies: {
            courtData: process.env.INTEGRATION_CACHE_COURT_DATA === 'true',
            paymentData: process.env.INTEGRATION_CACHE_PAYMENT_DATA === 'false',
            researchData: process.env.INTEGRATION_CACHE_RESEARCH_DATA === 'true',
        },
    },
    logging: {
        enabled: process.env.INTEGRATION_LOGGING_ENABLED === 'true',
        level: process.env.INTEGRATION_LOG_LEVEL || 'info',
        sensitiveDataMasking: process.env.INTEGRATION_LOG_MASKING === 'true',
        fieldsToMask: process.env.INTEGRATION_LOG_MASK_FIELDS?.split(',') || ['password', 'token', 'secret', 'key'],
    },
    webhooks: {
        enabled: process.env.INTEGRATION_WEBHOOKS_ENABLED === 'true',
        endpoint: process.env.INTEGRATION_WEBHOOK_ENDPOINT || '/api/integration/webhooks',
        secret: process.env.INTEGRATION_WEBHOOK_SECRET || 'your-webhook-secret',
        allowedEvents: process.env.INTEGRATION_WEBHOOK_EVENTS?.split(',') || ['payment.success', 'payment.failure', 'court.filing.update'],
    },
    dataTransformation: {
        enabled: process.env.INTEGRATION_DATA_TRANSFORM_ENABLED === 'true',
        validationLevel: process.env.INTEGRATION_DATA_VALIDATION_LEVEL || 'strict',
        autoRetry: process.env.INTEGRATION_DATA_AUTO_RETRY === 'true',
        maxRetries: parseInt(process.env.INTEGRATION_DATA_MAX_RETRIES || '3'),
    },
};
exports.default = exports.integrationConfig;
//# sourceMappingURL=integration.js.map