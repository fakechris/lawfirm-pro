"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getComplianceConfig = exports.getReportingConfig = exports.getPaymentConfig = exports.getExpenseConfig = exports.getTimeTrackingConfig = exports.getBillingConfig = exports.getChinaConfig = exports.getFinancialConfig = exports.financialConfig = void 0;
exports.financialConfig = {
    china: {
        vatRate: 0.06,
        currency: 'CNY',
        timezone: 'Asia/Shanghai',
        locale: 'zh-CN',
        feeRegulations: {
            minimumHourlyRate: 200,
            maximumContingency: 0.3,
            requiresWrittenAgreement: true,
            disclosureRequirements: true,
        },
        supportedPaymentMethods: [
            'ALIPAY',
            'WECHAT_PAY',
            'BANK_TRANSFER',
            'CASH',
            'CREDIT_CARD'
        ],
        trustAccount: {
            enabled: true,
            requiresSegregation: true,
            interestHandling: 'client',
            reconciliationFrequency: 'monthly',
        },
        invoice: {
            requiresTaxNumber: true,
            requiresFapiao: true,
            electronicFapiao: true,
            retentionPeriod: 10,
        },
    },
    billing: {
        autoGenerateInvoiceNumbers: true,
        invoiceNumberPrefix: 'INV-',
        invoiceNumberPadding: 6,
        defaultPaymentTerms: 30,
        lateFeeRate: 0.02,
        allowPartialPayments: true,
        requireBillingNodeApproval: true,
    },
    timeTracking: {
        defaultBillable: true,
        minimumIncrement: 0.25,
        allowFutureEntries: false,
        requireDescription: true,
        autoRound: true,
        roundMethod: 'nearest',
    },
    expenses: {
        requireReceipt: true,
        requireApproval: true,
        autoCategorization: true,
        supportedReceiptTypes: ['image/jpeg', 'image/png', 'application/pdf'],
        maxReceiptSize: 10485760,
        receiptRetention: 7,
    },
    payment: {
        autoReconciliation: true,
        requireVerification: true,
        supportedGateways: {
            alipay: {
                enabled: true,
                appId: process.env.ALIPAY_APP_ID,
                privateKey: process.env.ALIPAY_PRIVATE_KEY,
                publicKey: process.env.ALIPAY_PUBLIC_KEY,
                sandbox: process.env.NODE_ENV === 'development',
                notifyUrl: process.env.ALIPAY_NOTIFY_URL || '/api/payments/alipay/notify',
                returnUrl: process.env.ALIPAY_RETURN_URL || '/api/payments/alipay/return',
                charset: 'UTF-8',
                signType: 'RSA2',
                version: '1.0',
            },
            wechat: {
                enabled: true,
                appId: process.env.WECHAT_APP_ID,
                mchId: process.env.WECHAT_MCH_ID,
                apiKey: process.env.WECHAT_API_KEY,
                sandbox: process.env.NODE_ENV === 'development',
                notifyUrl: process.env.WECHAT_NOTIFY_URL || '/api/payments/wechat/notify',
                tradeType: 'NATIVE',
                spbillCreateIp: '127.0.0.1',
                certPath: process.env.WECHAT_CERT_PATH,
                keyPath: process.env.WECHAT_KEY_PATH,
            },
            bank: {
                enabled: true,
                accountNumber: process.env.BANK_ACCOUNT_NUMBER,
                bankName: process.env.BANK_NAME,
                swiftCode: process.env.BANK_SWIFT_CODE,
                accountHolder: process.env.BANK_ACCOUNT_HOLDER,
                bankAddress: process.env.BANK_ADDRESS,
            },
        },
        processing: {
            retryAttempts: 3,
            retryDelay: 5000,
            timeout: 30000,
            maxAmount: 1000000,
            minAmount: 1,
            currency: 'CNY',
        },
        security: {
            require3DS: true,
            fraudDetection: true,
            ipWhitelist: [],
            ipBlacklist: [],
            rateLimiting: {
                enabled: true,
                maxRequests: 100,
                windowMs: 900000,
            },
        },
        webhooks: {
            enabled: true,
            secret: process.env.PAYMENT_WEBHOOK_SECRET,
            retryFailed: true,
            maxRetries: 5,
            timeout: 10000,
        },
    },
    reporting: {
        defaultCurrency: 'CNY',
        fiscalYearStart: '01-01',
        taxReporting: true,
        matterReporting: true,
        timeReporting: true,
        expenseReporting: true,
        trustAccountReporting: true,
    },
    compliance: {
        auditTrail: true,
        dataRetention: 10,
        encryptionRequired: true,
        backupRequired: true,
        disasterRecovery: true,
        accessLogging: true,
        changeLogging: true,
    },
    integrations: {
        accounting: {
            enabled: false,
            software: 'none',
        },
        documentManagement: {
            enabled: true,
            autoAttachReceipts: true,
            generateFapiao: true,
        },
        notification: {
            enabled: true,
            invoiceCreated: true,
            paymentReceived: true,
            paymentOverdue: true,
            trustAccountLow: true,
        },
    },
};
const getFinancialConfig = () => {
    return exports.financialConfig;
};
exports.getFinancialConfig = getFinancialConfig;
const getChinaConfig = () => {
    return exports.financialConfig.china;
};
exports.getChinaConfig = getChinaConfig;
const getBillingConfig = () => {
    return exports.financialConfig.billing;
};
exports.getBillingConfig = getBillingConfig;
const getTimeTrackingConfig = () => {
    return exports.financialConfig.timeTracking;
};
exports.getTimeTrackingConfig = getTimeTrackingConfig;
const getExpenseConfig = () => {
    return exports.financialConfig.expenses;
};
exports.getExpenseConfig = getExpenseConfig;
const getPaymentConfig = () => {
    return exports.financialConfig.payment;
};
exports.getPaymentConfig = getPaymentConfig;
const getReportingConfig = () => {
    return exports.financialConfig.reporting;
};
exports.getReportingConfig = getReportingConfig;
const getComplianceConfig = () => {
    return exports.financialConfig.compliance;
};
exports.getComplianceConfig = getComplianceConfig;
//# sourceMappingURL=financial.js.map