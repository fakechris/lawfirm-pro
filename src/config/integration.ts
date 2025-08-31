export const integrationConfig = {
  // API Gateway Configuration
  gateway: {
    enabled: process.env.INTEGRATION_GATEWAY_ENABLED === 'true',
    port: parseInt(process.env.INTEGRATION_GATEWAY_PORT || '3001'),
    basePath: '/api/integration',
    timeout: parseInt(process.env.INTEGRATION_TIMEOUT || '30000'), // 30 seconds
    retries: parseInt(process.env.INTEGRATION_RETRIES || '3'),
    retryDelay: parseInt(process.env.INTEGRATION_RETRY_DELAY || '1000'),
  },

  // Rate Limiting
  rateLimit: {
    enabled: process.env.INTEGRATION_RATE_LIMIT_ENABLED === 'true',
    windowMs: parseInt(process.env.INTEGRATION_RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.INTEGRATION_RATE_LIMIT_MAX || '1000'),
    skipSuccessfulRequests: process.env.INTEGRATION_RATE_LIMIT_SKIP_SUCCESS === 'true',
    skipFailedRequests: process.env.INTEGRATION_RATE_LIMIT_SKIP_FAILED === 'true',
  },

  // Circuit Breaker Configuration
  circuitBreaker: {
    enabled: process.env.INTEGRATION_CIRCUIT_BREAKER_ENABLED === 'true',
    timeout: parseInt(process.env.INTEGRATION_CIRCUIT_TIMEOUT || '30000'),
    errorThresholdPercentage: parseInt(process.env.INTEGRATION_CIRCUIT_ERROR_THRESHOLD || '50'),
    resetTimeout: parseInt(process.env.INTEGRATION_CIRCUIT_RESET_TIMEOUT || '30000'),
  },

  // Authentication
  auth: {
    apiKeyHeader: process.env.INTEGRATION_API_KEY_HEADER || 'X-API-Key',
    webhookSecret: process.env.INTEGRATION_WEBHOOK_SECRET || 'your-webhook-secret-change-in-production',
    allowedOrigins: process.env.INTEGRATION_ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  },

  // Court Systems Integration
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

  // Payment Processors
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

  // Legal Research Services
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

  // Document Management
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

  // Communication Services
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

  // Caching Configuration
  cache: {
    enabled: process.env.INTEGRATION_CACHE_ENABLED === 'true',
    ttl: parseInt(process.env.INTEGRATION_CACHE_TTL || '3600'), // 1 hour
    maxSize: parseInt(process.env.INTEGRATION_CACHE_MAX_SIZE || '1000'),
    strategies: {
      courtData: process.env.INTEGRATION_CACHE_COURT_DATA === 'true',
      paymentData: process.env.INTEGRATION_CACHE_PAYMENT_DATA === 'false',
      researchData: process.env.INTEGRATION_CACHE_RESEARCH_DATA === 'true',
    },
  },

  // Logging and Monitoring
  logging: {
    enabled: process.env.INTEGRATION_LOGGING_ENABLED === 'true',
    level: process.env.INTEGRATION_LOG_LEVEL || 'info',
    sensitiveDataMasking: process.env.INTEGRATION_LOG_MASKING === 'true',
    fieldsToMask: process.env.INTEGRATION_LOG_MASK_FIELDS?.split(',') || ['password', 'token', 'secret', 'key'],
  },

  // Webhook Configuration
  webhooks: {
    enabled: process.env.INTEGRATION_WEBHOOKS_ENABLED === 'true',
    endpoint: process.env.INTEGRATION_WEBHOOK_ENDPOINT || '/api/integration/webhooks',
    secret: process.env.INTEGRATION_WEBHOOK_SECRET || 'your-webhook-secret',
    allowedEvents: process.env.INTEGRATION_WEBHOOK_EVENTS?.split(',') || ['payment.success', 'payment.failure', 'court.filing.update'],
  },

  // Data Transformation
  dataTransformation: {
    enabled: process.env.INTEGRATION_DATA_TRANSFORM_ENABLED === 'true',
    validationLevel: process.env.INTEGRATION_DATA_VALIDATION_LEVEL || 'strict',
    autoRetry: process.env.INTEGRATION_DATA_AUTO_RETRY === 'true',
    maxRetries: parseInt(process.env.INTEGRATION_DATA_MAX_RETRIES || '3'),
  },

  // Monitoring and Observability
  monitoring: {
    enabled: process.env.INTEGRATION_MONITORING_ENABLED === 'true',
    metrics: {
      enabled: process.env.INTEGRATION_METRICS_ENABLED === 'true',
      retentionDays: parseInt(process.env.INTEGRATION_METRICS_RETENTION_DAYS || '30'),
      maxMetrics: parseInt(process.env.INTEGRATION_MAX_METRICS || '100000'),
    },
    alerts: {
      enabled: process.env.INTEGRATION_ALERTS_ENABLED === 'true',
      defaultChannels: process.env.INTEGRATION_ALERT_CHANNELS?.split(',') || ['default-email', 'default-slack'],
      cooldownPeriod: parseInt(process.env.INTEGRATION_ALERT_COOLDOWN || '300'),
    },
    logging: {
      enabled: process.env.INTEGRATION_LOGGING_ENABLED === 'true',
      level: process.env.INTEGRATION_LOG_LEVEL || 'INFO',
      retentionDays: parseInt(process.env.INTEGRATION_LOGS_RETENTION_DAYS || '30'),
      maxLogs: parseInt(process.env.INTEGRATION_MAX_LOGS || '100000'),
    },
    dashboard: {
      enabled: process.env.INTEGRATION_DASHBOARD_ENABLED === 'true',
      refreshInterval: parseInt(process.env.INTEGRATION_DASHBOARD_REFRESH || '60'),
      maxDataPoints: parseInt(process.env.INTEGRATION_DASHBOARD_DATA_POINTS || '1000'),
    },
    config: {
      enabled: process.env.INTEGRATION_CONFIG_ENABLED === 'true',
      encryptionKey: process.env.INTEGRATION_CONFIG_ENCRYPTION_KEY || 'default-key-change-in-production',
      autoRotate: process.env.INTEGRATION_CONFIG_AUTO_ROTATE === 'true',
    },
    healthChecks: {
      enabled: process.env.INTEGRATION_HEALTH_CHECKS_ENABLED === 'true',
      interval: parseInt(process.env.INTEGRATION_HEALTH_CHECK_INTERVAL || '60'),
      timeout: parseInt(process.env.INTEGRATION_HEALTH_CHECK_TIMEOUT || '10000'),
    },
    performance: {
      enabled: process.env.INTEGRATION_PERFORMANCE_ENABLED === 'true',
      sampleRate: parseFloat(process.env.INTEGRATION_PERFORMANCE_SAMPLE_RATE || '1.0'),
      slowRequestThreshold: parseInt(process.env.INTEGRATION_SLOW_REQUEST_THRESHOLD || '5000'),
      errorRateThreshold: parseFloat(process.env.INTEGRATION_ERROR_RATE_THRESHOLD || '0.05'),
    },
    security: {
      enabled: process.env.INTEGRATION_SECURITY_ENABLED === 'true',
      auditEnabled: process.env.INTEGRATION_SECURITY_AUDIT_ENABLED === 'true',
      sensitiveDataMasking: process.env.INTEGRATION_SECURITY_MASKING_ENABLED === 'true',
      maxLoginAttempts: parseInt(process.env.INTEGRATION_MAX_LOGIN_ATTEMPTS || '5'),
      lockoutDuration: parseInt(process.env.INTEGRATION_LOCKOUT_DURATION || '900'),
    },
  },
};

export default integrationConfig;