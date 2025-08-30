export const financialConfig = {
  // Chinese Legal Compliance Settings
  china: {
    vatRate: 0.06, // 6% VAT for legal services in China
    currency: 'CNY',
    timezone: 'Asia/Shanghai',
    locale: 'zh-CN',
    
    // Legal fee regulations
    feeRegulations: {
      minimumHourlyRate: 200, // Minimum hourly rate in CNY
      maximumContingency: 0.3, // Maximum 30% for contingency fees
      requiresWrittenAgreement: true, // Fee agreements must be in writing
      disclosureRequirements: true, // Must disclose fee structure to clients
    },
    
    // Payment methods supported in China
    supportedPaymentMethods: [
      'ALIPAY',
      'WECHAT_PAY',
      'BANK_TRANSFER',
      'CASH',
      'CREDIT_CARD'
    ],
    
    // Trust account requirements
    trustAccount: {
      enabled: true,
      requiresSegregation: true, // Client funds must be segregated
      interestHandling: 'client', // Interest belongs to client
      reconciliationFrequency: 'monthly', // Monthly reconciliation required
    },
    
    // Invoice requirements
    invoice: {
      requiresTaxNumber: true, // Need client tax ID (税号)
      requiresFapiao: true, // Official fapiao required
      electronicFapiao: true, // Electronic fapiao supported
      retentionPeriod: 10, // 10 years retention required
    },
  },
  
  // Billing Settings
  billing: {
    autoGenerateInvoiceNumbers: true,
    invoiceNumberPrefix: 'INV-',
    invoiceNumberPadding: 6,
    defaultPaymentTerms: 30, // 30 days default payment terms
    lateFeeRate: 0.02, // 2% monthly late fee
    allowPartialPayments: true,
    requireBillingNodeApproval: true,
  },
  
  // Time Tracking Settings
  timeTracking: {
    defaultBillable: true,
    minimumIncrement: 0.25, // 15-minute increments
    allowFutureEntries: false,
    requireDescription: true,
    autoRound: true,
    roundMethod: 'nearest', // 'up', 'down', 'nearest'
  },
  
  // Expense Settings
  expenses: {
    requireReceipt: true,
    requireApproval: true,
    autoCategorization: true,
    supportedReceiptTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    maxReceiptSize: 10485760, // 10MB
    receiptRetention: 7, // 7 years retention required
  },
  
  // Payment Processing Settings
  payment: {
    autoReconciliation: true,
    requireVerification: true,
    supportedGateways: {
      alipay: {
        enabled: true,
        appId: process.env.ALIPAY_APP_ID,
        privateKey: process.env.ALIPAY_PRIVATE_KEY,
        publicKey: process.env.ALIPAY_PUBLIC_KEY,
      },
      wechat: {
        enabled: true,
        appId: process.env.WECHAT_APP_ID,
        mchId: process.env.WECHAT_MCH_ID,
        apiKey: process.env.WECHAT_API_KEY,
      },
      bank: {
        enabled: true,
        accountNumber: process.env.BANK_ACCOUNT_NUMBER,
        bankName: process.env.BANK_NAME,
        swiftCode: process.env.BANK_SWIFT_CODE,
      },
    },
  },
  
  // Reporting Settings
  reporting: {
    defaultCurrency: 'CNY',
    fiscalYearStart: '01-01', // January 1st
    taxReporting: true,
    matterReporting: true,
    timeReporting: true,
    expenseReporting: true,
    trustAccountReporting: true,
  },
  
  // Compliance Settings
  compliance: {
    auditTrail: true,
    dataRetention: 10, // 10 years
    encryptionRequired: true,
    backupRequired: true,
    disasterRecovery: true,
    accessLogging: true,
    changeLogging: true,
  },
  
  // Integration Settings
  integrations: {
    accounting: {
      enabled: false, // Would integrate with Chinese accounting software
      software: 'none', // Options: 'none', 'kingdee', 'yonyou', 'ufida'
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

export const getFinancialConfig = () => {
  return financialConfig;
};

export const getChinaConfig = () => {
  return financialConfig.china;
};

export const getBillingConfig = () => {
  return financialConfig.billing;
};

export const getTimeTrackingConfig = () => {
  return financialConfig.timeTracking;
};

export const getExpenseConfig = () => {
  return financialConfig.expenses;
};

export const getPaymentConfig = () => {
  return financialConfig.payment;
};

export const getReportingConfig = () => {
  return financialConfig.reporting;
};

export const getComplianceConfig = () => {
  return financialConfig.compliance;
};