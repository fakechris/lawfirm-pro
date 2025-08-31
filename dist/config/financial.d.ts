export declare const financialConfig: {
    china: {
        vatRate: number;
        currency: string;
        timezone: string;
        locale: string;
        feeRegulations: {
            minimumHourlyRate: number;
            maximumContingency: number;
            requiresWrittenAgreement: boolean;
            disclosureRequirements: boolean;
        };
        supportedPaymentMethods: string[];
        trustAccount: {
            enabled: boolean;
            requiresSegregation: boolean;
            interestHandling: string;
            reconciliationFrequency: string;
        };
        invoice: {
            requiresTaxNumber: boolean;
            requiresFapiao: boolean;
            electronicFapiao: boolean;
            retentionPeriod: number;
        };
    };
    billing: {
        autoGenerateInvoiceNumbers: boolean;
        invoiceNumberPrefix: string;
        invoiceNumberPadding: number;
        defaultPaymentTerms: number;
        lateFeeRate: number;
        allowPartialPayments: boolean;
        requireBillingNodeApproval: boolean;
    };
    timeTracking: {
        defaultBillable: boolean;
        minimumIncrement: number;
        allowFutureEntries: boolean;
        requireDescription: boolean;
        autoRound: boolean;
        roundMethod: string;
    };
    expenses: {
        requireReceipt: boolean;
        requireApproval: boolean;
        autoCategorization: boolean;
        supportedReceiptTypes: string[];
        maxReceiptSize: number;
        receiptRetention: number;
    };
    payment: {
        autoReconciliation: boolean;
        requireVerification: boolean;
        supportedGateways: {
            alipay: {
                enabled: boolean;
                appId: string | undefined;
                privateKey: string | undefined;
                publicKey: string | undefined;
                sandbox: boolean;
                notifyUrl: string;
                returnUrl: string;
                charset: string;
                signType: string;
                version: string;
            };
            wechat: {
                enabled: boolean;
                appId: string | undefined;
                mchId: string | undefined;
                apiKey: string | undefined;
                sandbox: boolean;
                notifyUrl: string;
                tradeType: string;
                spbillCreateIp: string;
                certPath: string | undefined;
                keyPath: string | undefined;
            };
            bank: {
                enabled: boolean;
                accountNumber: string | undefined;
                bankName: string | undefined;
                swiftCode: string | undefined;
                accountHolder: string | undefined;
                bankAddress: string | undefined;
            };
        };
        processing: {
            retryAttempts: number;
            retryDelay: number;
            timeout: number;
            maxAmount: number;
            minAmount: number;
            currency: string;
        };
        security: {
            require3DS: boolean;
            fraudDetection: boolean;
            ipWhitelist: never[];
            ipBlacklist: never[];
            rateLimiting: {
                enabled: boolean;
                maxRequests: number;
                windowMs: number;
            };
        };
        webhooks: {
            enabled: boolean;
            secret: string | undefined;
            retryFailed: boolean;
            maxRetries: number;
            timeout: number;
        };
    };
    reporting: {
        defaultCurrency: string;
        fiscalYearStart: string;
        taxReporting: boolean;
        matterReporting: boolean;
        timeReporting: boolean;
        expenseReporting: boolean;
        trustAccountReporting: boolean;
    };
    compliance: {
        auditTrail: boolean;
        dataRetention: number;
        encryptionRequired: boolean;
        backupRequired: boolean;
        disasterRecovery: boolean;
        accessLogging: boolean;
        changeLogging: boolean;
    };
    integrations: {
        accounting: {
            enabled: boolean;
            software: string;
        };
        documentManagement: {
            enabled: boolean;
            autoAttachReceipts: boolean;
            generateFapiao: boolean;
        };
        notification: {
            enabled: boolean;
            invoiceCreated: boolean;
            paymentReceived: boolean;
            paymentOverdue: boolean;
            trustAccountLow: boolean;
        };
    };
};
export declare const getFinancialConfig: () => {
    china: {
        vatRate: number;
        currency: string;
        timezone: string;
        locale: string;
        feeRegulations: {
            minimumHourlyRate: number;
            maximumContingency: number;
            requiresWrittenAgreement: boolean;
            disclosureRequirements: boolean;
        };
        supportedPaymentMethods: string[];
        trustAccount: {
            enabled: boolean;
            requiresSegregation: boolean;
            interestHandling: string;
            reconciliationFrequency: string;
        };
        invoice: {
            requiresTaxNumber: boolean;
            requiresFapiao: boolean;
            electronicFapiao: boolean;
            retentionPeriod: number;
        };
    };
    billing: {
        autoGenerateInvoiceNumbers: boolean;
        invoiceNumberPrefix: string;
        invoiceNumberPadding: number;
        defaultPaymentTerms: number;
        lateFeeRate: number;
        allowPartialPayments: boolean;
        requireBillingNodeApproval: boolean;
    };
    timeTracking: {
        defaultBillable: boolean;
        minimumIncrement: number;
        allowFutureEntries: boolean;
        requireDescription: boolean;
        autoRound: boolean;
        roundMethod: string;
    };
    expenses: {
        requireReceipt: boolean;
        requireApproval: boolean;
        autoCategorization: boolean;
        supportedReceiptTypes: string[];
        maxReceiptSize: number;
        receiptRetention: number;
    };
    payment: {
        autoReconciliation: boolean;
        requireVerification: boolean;
        supportedGateways: {
            alipay: {
                enabled: boolean;
                appId: string | undefined;
                privateKey: string | undefined;
                publicKey: string | undefined;
                sandbox: boolean;
                notifyUrl: string;
                returnUrl: string;
                charset: string;
                signType: string;
                version: string;
            };
            wechat: {
                enabled: boolean;
                appId: string | undefined;
                mchId: string | undefined;
                apiKey: string | undefined;
                sandbox: boolean;
                notifyUrl: string;
                tradeType: string;
                spbillCreateIp: string;
                certPath: string | undefined;
                keyPath: string | undefined;
            };
            bank: {
                enabled: boolean;
                accountNumber: string | undefined;
                bankName: string | undefined;
                swiftCode: string | undefined;
                accountHolder: string | undefined;
                bankAddress: string | undefined;
            };
        };
        processing: {
            retryAttempts: number;
            retryDelay: number;
            timeout: number;
            maxAmount: number;
            minAmount: number;
            currency: string;
        };
        security: {
            require3DS: boolean;
            fraudDetection: boolean;
            ipWhitelist: never[];
            ipBlacklist: never[];
            rateLimiting: {
                enabled: boolean;
                maxRequests: number;
                windowMs: number;
            };
        };
        webhooks: {
            enabled: boolean;
            secret: string | undefined;
            retryFailed: boolean;
            maxRetries: number;
            timeout: number;
        };
    };
    reporting: {
        defaultCurrency: string;
        fiscalYearStart: string;
        taxReporting: boolean;
        matterReporting: boolean;
        timeReporting: boolean;
        expenseReporting: boolean;
        trustAccountReporting: boolean;
    };
    compliance: {
        auditTrail: boolean;
        dataRetention: number;
        encryptionRequired: boolean;
        backupRequired: boolean;
        disasterRecovery: boolean;
        accessLogging: boolean;
        changeLogging: boolean;
    };
    integrations: {
        accounting: {
            enabled: boolean;
            software: string;
        };
        documentManagement: {
            enabled: boolean;
            autoAttachReceipts: boolean;
            generateFapiao: boolean;
        };
        notification: {
            enabled: boolean;
            invoiceCreated: boolean;
            paymentReceived: boolean;
            paymentOverdue: boolean;
            trustAccountLow: boolean;
        };
    };
};
export declare const getChinaConfig: () => {
    vatRate: number;
    currency: string;
    timezone: string;
    locale: string;
    feeRegulations: {
        minimumHourlyRate: number;
        maximumContingency: number;
        requiresWrittenAgreement: boolean;
        disclosureRequirements: boolean;
    };
    supportedPaymentMethods: string[];
    trustAccount: {
        enabled: boolean;
        requiresSegregation: boolean;
        interestHandling: string;
        reconciliationFrequency: string;
    };
    invoice: {
        requiresTaxNumber: boolean;
        requiresFapiao: boolean;
        electronicFapiao: boolean;
        retentionPeriod: number;
    };
};
export declare const getBillingConfig: () => {
    autoGenerateInvoiceNumbers: boolean;
    invoiceNumberPrefix: string;
    invoiceNumberPadding: number;
    defaultPaymentTerms: number;
    lateFeeRate: number;
    allowPartialPayments: boolean;
    requireBillingNodeApproval: boolean;
};
export declare const getTimeTrackingConfig: () => {
    defaultBillable: boolean;
    minimumIncrement: number;
    allowFutureEntries: boolean;
    requireDescription: boolean;
    autoRound: boolean;
    roundMethod: string;
};
export declare const getExpenseConfig: () => {
    requireReceipt: boolean;
    requireApproval: boolean;
    autoCategorization: boolean;
    supportedReceiptTypes: string[];
    maxReceiptSize: number;
    receiptRetention: number;
};
export declare const getPaymentConfig: () => {
    autoReconciliation: boolean;
    requireVerification: boolean;
    supportedGateways: {
        alipay: {
            enabled: boolean;
            appId: string | undefined;
            privateKey: string | undefined;
            publicKey: string | undefined;
            sandbox: boolean;
            notifyUrl: string;
            returnUrl: string;
            charset: string;
            signType: string;
            version: string;
        };
        wechat: {
            enabled: boolean;
            appId: string | undefined;
            mchId: string | undefined;
            apiKey: string | undefined;
            sandbox: boolean;
            notifyUrl: string;
            tradeType: string;
            spbillCreateIp: string;
            certPath: string | undefined;
            keyPath: string | undefined;
        };
        bank: {
            enabled: boolean;
            accountNumber: string | undefined;
            bankName: string | undefined;
            swiftCode: string | undefined;
            accountHolder: string | undefined;
            bankAddress: string | undefined;
        };
    };
    processing: {
        retryAttempts: number;
        retryDelay: number;
        timeout: number;
        maxAmount: number;
        minAmount: number;
        currency: string;
    };
    security: {
        require3DS: boolean;
        fraudDetection: boolean;
        ipWhitelist: never[];
        ipBlacklist: never[];
        rateLimiting: {
            enabled: boolean;
            maxRequests: number;
            windowMs: number;
        };
    };
    webhooks: {
        enabled: boolean;
        secret: string | undefined;
        retryFailed: boolean;
        maxRetries: number;
        timeout: number;
    };
};
export declare const getReportingConfig: () => {
    defaultCurrency: string;
    fiscalYearStart: string;
    taxReporting: boolean;
    matterReporting: boolean;
    timeReporting: boolean;
    expenseReporting: boolean;
    trustAccountReporting: boolean;
};
export declare const getComplianceConfig: () => {
    auditTrail: boolean;
    dataRetention: number;
    encryptionRequired: boolean;
    backupRequired: boolean;
    disasterRecovery: boolean;
    accessLogging: boolean;
    changeLogging: boolean;
};
//# sourceMappingURL=financial.d.ts.map