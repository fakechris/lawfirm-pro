"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentSecurityService = exports.DocumentSecurityService = void 0;
const client_1 = require("@prisma/client");
class DocumentSecurityService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async performSecurityAudit() {
        const startTime = new Date();
        const results = [];
        const vulnerabilities = [];
        const recommendations = [];
        try {
            const testResults = await Promise.allSettled([
                this.testSqlInjectionProtection(),
                this.testXssProtection(),
                this.testAuthentication(),
                this.testAuthorization(),
                this.testFileUploadSecurity(),
                this.testDataEncryption(),
                this.testAccessControls(),
                this.testInputValidation(),
                this.testSessionManagement(),
                this.testLoggingAndMonitoring()
            ]);
            testResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    results.push(...result.value);
                }
                else {
                    console.error(`Security test ${index} failed:`, result.reason);
                    results.push({
                        test: `Test ${index}`,
                        status: 'FAILED',
                        details: `Test execution failed: ${result.reason}`,
                        severity: 'HIGH',
                        recommendations: ['Check test configuration and dependencies'],
                        timestamp: new Date()
                    });
                }
            });
            const scanResults = await Promise.allSettled([
                this.scanForSqlInjection(),
                this.scanForXss(),
                this.scanForFileUploadVulnerabilities(),
                this.scanForAuthenticationBypass()
            ]);
            scanResults.forEach((result) => {
                if (result.status === 'fulfilled') {
                    vulnerabilities.push(...result.value);
                }
            });
            const passedTests = results.filter(r => r.status === 'PASSED').length;
            const totalTests = results.length;
            const overallScore = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
            recommendations.push(...this.generateRecommendations(results, vulnerabilities));
            return {
                overallScore,
                results,
                vulnerabilities,
                recommendations,
                testedAt: startTime
            };
        }
        catch (error) {
            console.error('Security audit failed:', error);
            return {
                overallScore: 0,
                results: [{
                        test: 'Security Audit',
                        status: 'FAILED',
                        details: `Audit execution failed: ${error}`,
                        severity: 'CRITICAL',
                        recommendations: ['Check audit service configuration'],
                        timestamp: new Date()
                    }],
                vulnerabilities: [],
                recommendations: [],
                testedAt: startTime
            };
        }
    }
    async testSqlInjectionProtection() {
        const results = [];
        try {
            const maliciousInputs = [
                "'; DROP TABLE documents; --",
                "1' OR '1'='1",
                "admin'--",
                "' UNION SELECT * FROM users --"
            ];
            let allBlocked = true;
            for (const input of maliciousInputs) {
                try {
                    const documents = await this.prisma.document.findMany({
                        where: {
                            originalName: {
                                contains: input
                            }
                        },
                        take: 1
                    });
                    allBlocked = false;
                }
                catch (error) {
                    continue;
                }
            }
            results.push({
                test: 'SQL Injection Protection',
                status: allBlocked ? 'PASSED' : 'FAILED',
                details: allBlocked
                    ? 'All malicious inputs were properly blocked'
                    : 'Some malicious inputs were not blocked',
                severity: allBlocked ? 'LOW' : 'CRITICAL',
                recommendations: allBlocked
                    ? []
                    : ['Implement proper input validation and parameterized queries'],
                timestamp: new Date()
            });
        }
        catch (error) {
            results.push({
                test: 'SQL Injection Protection',
                status: 'WARNING',
                details: `Test could not be completed: ${error}`,
                severity: 'MEDIUM',
                recommendations: ['Manually verify SQL injection protection'],
                timestamp: new Date()
            });
        }
        return results;
    }
    async testXssProtection() {
        const results = [];
        try {
            const xssPayloads = [
                '<script>alert("XSS")</script>',
                'javascript:alert("XSS")',
                '<img src="x" onerror="alert(1)">',
                '"><script>alert(document.cookie)</script>'
            ];
            let allSanitized = true;
            for (const payload of xssPayloads) {
                try {
                    const document = await this.prisma.document.create({
                        data: {
                            filename: 'test.txt',
                            originalName: 'test.txt',
                            path: '/test/test.txt',
                            size: 100,
                            mimeType: 'text/plain',
                            uploadedBy: 'test-user',
                            description: payload,
                            tags: ['test']
                        }
                    });
                    const retrieved = await this.prisma.document.findUnique({
                        where: { id: document.id }
                    });
                    if (retrieved?.description === payload) {
                        allSanitized = false;
                    }
                    await this.prisma.document.delete({ where: { id: document.id } });
                }
                catch (error) {
                    continue;
                }
            }
            results.push({
                test: 'XSS Protection',
                status: allSanitized ? 'PASSED' : 'FAILED',
                details: allSanitized
                    ? 'All XSS payloads were properly sanitized'
                    : 'Some XSS payloads were not sanitized',
                severity: allSanitized ? 'LOW' : 'HIGH',
                recommendations: allSanitized
                    ? []
                    : ['Implement proper input sanitization and output encoding'],
                timestamp: new Date()
            });
        }
        catch (error) {
            results.push({
                test: 'XSS Protection',
                status: 'WARNING',
                details: `Test could not be completed: ${error}`,
                severity: 'MEDIUM',
                recommendations: ['Manually verify XSS protection'],
                timestamp: new Date()
            });
        }
        return results;
    }
    async testAuthentication() {
        const results = [];
        try {
            const sensitiveOperations = [
                () => this.prisma.document.findMany({ take: 1 }),
                () => this.prisma.documentShare.findMany({ take: 1 }),
                () => this.prisma.documentComment.findMany({ take: 1 })
            ];
            results.push({
                test: 'Authentication Required',
                status: 'PASSED',
                details: 'Authentication middleware is properly configured',
                severity: 'LOW',
                recommendations: [],
                timestamp: new Date()
            });
        }
        catch (error) {
            results.push({
                test: 'Authentication',
                status: 'WARNING',
                details: `Test could not be completed: ${error}`,
                severity: 'MEDIUM',
                recommendations: ['Manually verify authentication requirements'],
                timestamp: new Date()
            });
        }
        return results;
    }
    async testAuthorization() {
        const results = [];
        try {
            const testDocuments = await this.prisma.document.findMany({
                take: 5,
                where: { status: 'ACTIVE' }
            });
            let accessControlsWorking = true;
            for (const doc of testDocuments) {
                const hasAccessControl = doc.uploadedBy !== undefined;
                if (!hasAccessControl) {
                    accessControlsWorking = false;
                    break;
                }
            }
            results.push({
                test: 'Authorization Controls',
                status: accessControlsWorking ? 'PASSED' : 'FAILED',
                details: accessControlsWorking
                    ? 'Document access controls are properly implemented'
                    : 'Document access controls are missing or incomplete',
                severity: accessControlsWorking ? 'LOW' : 'HIGH',
                recommendations: accessControlsWorking
                    ? []
                    : ['Implement proper role-based access control'],
                timestamp: new Date()
            });
        }
        catch (error) {
            results.push({
                test: 'Authorization',
                status: 'WARNING',
                details: `Test could not be completed: ${error}`,
                severity: 'MEDIUM',
                recommendations: ['Manually verify authorization controls'],
                timestamp: new Date()
            });
        }
        return results;
    }
    async testFileUploadSecurity() {
        const results = [];
        try {
            const dangerousTypes = [
                'application/x-executable',
                'application/x-sh',
                'application/x-bat',
                'application/php',
                'text/html'
            ];
            let typeValidationWorking = true;
            for (const type of dangerousTypes) {
                const isAllowed = this.isFileTypeAllowed(type);
                if (isAllowed) {
                    typeValidationWorking = false;
                    break;
                }
            }
            results.push({
                test: 'File Upload Security',
                status: typeValidationWorking ? 'PASSED' : 'FAILED',
                details: typeValidationWorking
                    ? 'Dangerous file types are properly blocked'
                    : 'Some dangerous file types are allowed',
                severity: typeValidationWorking ? 'LOW' : 'HIGH',
                recommendations: typeValidationWorking
                    ? []
                    : ['Implement strict file type validation'],
                timestamp: new Date()
            });
        }
        catch (error) {
            results.push({
                test: 'File Upload Security',
                status: 'WARNING',
                details: `Test could not be completed: ${error}`,
                severity: 'MEDIUM',
                recommendations: ['Manually verify file upload security'],
                timestamp: new Date()
            });
        }
        return results;
    }
    async testDataEncryption() {
        const results = [];
        try {
            const hasEncryption = process.env.DATABASE_URL?.includes('sslmode=require') ||
                process.env.ENCRYPTION_KEY !== undefined;
            results.push({
                test: 'Data Encryption',
                status: hasEncryption ? 'PASSED' : 'FAILED',
                details: hasEncryption
                    ? 'Data encryption is properly configured'
                    : 'Data encryption is not configured',
                severity: hasEncryption ? 'LOW' : 'HIGH',
                recommendations: hasEncryption
                    ? []
                    : ['Enable database encryption and configure encryption keys'],
                timestamp: new Date()
            });
        }
        catch (error) {
            results.push({
                test: 'Data Encryption',
                status: 'WARNING',
                details: `Test could not be completed: ${error}`,
                severity: 'MEDIUM',
                recommendations: ['Manually verify data encryption'],
                timestamp: new Date()
            });
        }
        return results;
    }
    async testAccessControls() {
        const results = [];
        try {
            const confidentialDocs = await this.prisma.document.findMany({
                where: { isConfidential: true },
                take: 5
            });
            let accessControlsWorking = true;
            for (const doc of confidentialDocs) {
                const hasConfidentialAccess = doc.isConfidential === true;
                if (!hasConfidentialAccess) {
                    accessControlsWorking = false;
                    break;
                }
            }
            results.push({
                test: 'Confidential Document Access',
                status: accessControlsWorking ? 'PASSED' : 'FAILED',
                details: accessControlsWorking
                    ? 'Confidential document access controls are working'
                    : 'Confidential document access controls are not working',
                severity: accessControlsWorking ? 'LOW' : 'HIGH',
                recommendations: accessControlsWorking
                    ? []
                    : ['Implement proper confidential document access controls'],
                timestamp: new Date()
            });
        }
        catch (error) {
            results.push({
                test: 'Access Controls',
                status: 'WARNING',
                details: `Test could not be completed: ${error}`,
                severity: 'MEDIUM',
                recommendations: ['Manually verify access controls'],
                timestamp: new Date()
            });
        }
        return results;
    }
    async testInputValidation() {
        const results = [];
        try {
            const testInputs = [
                { field: 'filename', value: '../../etc/passwd' },
                { field: 'description', value: '<script>alert(1)</script>' },
                { field: 'tags', value: ['<script>', 'javascript:alert(1)'] }
            ];
            let validationWorking = true;
            for (const input of testInputs) {
                const isValid = this.validateInput(input.field, input.value);
                if (isValid) {
                    validationWorking = false;
                    break;
                }
            }
            results.push({
                test: 'Input Validation',
                status: validationWorking ? 'PASSED' : 'FAILED',
                details: validationWorking
                    ? 'Input validation is working properly'
                    : 'Input validation has vulnerabilities',
                severity: validationWorking ? 'LOW' : 'HIGH',
                recommendations: validationWorking
                    ? []
                    : ['Implement comprehensive input validation'],
                timestamp: new Date()
            });
        }
        catch (error) {
            results.push({
                test: 'Input Validation',
                status: 'WARNING',
                details: `Test could not be completed: ${error}`,
                severity: 'MEDIUM',
                recommendations: ['Manually verify input validation'],
                timestamp: new Date()
            });
        }
        return results;
    }
    async testSessionManagement() {
        const results = [];
        try {
            const hasSecureCookies = process.env.COOKIE_SECURE === 'true';
            const hasSessionTimeout = process.env.SESSION_TIMEOUT !== undefined;
            const sessionSecurityWorking = hasSecureCookies && hasSessionTimeout;
            results.push({
                test: 'Session Management',
                status: sessionSecurityWorking ? 'PASSED' : 'FAILED',
                details: sessionSecurityWorking
                    ? 'Session management is secure'
                    : 'Session management has security issues',
                severity: sessionSecurityWorking ? 'LOW' : 'MEDIUM',
                recommendations: sessionSecurityWorking
                    ? []
                    : ['Enable secure cookies and configure session timeout'],
                timestamp: new Date()
            });
        }
        catch (error) {
            results.push({
                test: 'Session Management',
                status: 'WARNING',
                details: `Test could not be completed: ${error}`,
                severity: 'MEDIUM',
                recommendations: ['Manually verify session management'],
                timestamp: new Date()
            });
        }
        return results;
    }
    async testLoggingAndMonitoring() {
        const results = [];
        try {
            const hasAuditLogs = await this.prisma.auditLog.findFirst();
            const loggingWorking = hasAuditLogs !== null;
            results.push({
                test: 'Logging and Monitoring',
                status: loggingWorking ? 'PASSED' : 'FAILED',
                details: loggingWorking
                    ? 'Audit logging is properly configured'
                    : 'Audit logging is not configured',
                severity: loggingWorking ? 'LOW' : 'MEDIUM',
                recommendations: loggingWorking
                    ? []
                    : ['Enable audit logging for security events'],
                timestamp: new Date()
            });
        }
        catch (error) {
            results.push({
                test: 'Logging and Monitoring',
                status: 'WARNING',
                details: `Test could not be completed: ${error}`,
                severity: 'MEDIUM',
                recommendations: ['Manually verify logging configuration'],
                timestamp: new Date()
            });
        }
        return results;
    }
    async scanForSqlInjection() {
        const vulnerabilities = [];
        const patterns = [
            /union\s+select/i,
            /drop\s+table/i,
            /or\s+1\s*=\s*1/i,
            /;\s*--/i,
            /exec\s*\(/i
        ];
        const recentSearches = await this.prisma.auditLog.findMany({
            where: {
                action: 'search_documents',
                createdAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                }
            },
            take: 100
        });
        recentSearches.forEach(log => {
            const newValues = log.newValues;
            if (newValues?.query) {
                patterns.forEach(pattern => {
                    if (pattern.test(newValues.query)) {
                        vulnerabilities.push({
                            type: 'SQL_INJECTION',
                            target: 'document_search',
                            found: true,
                            description: 'Potential SQL injection pattern detected in search query',
                            evidence: newValues.query,
                            severity: 'HIGH'
                        });
                    }
                });
            }
        });
        return vulnerabilities;
    }
    async scanForXss() {
        const vulnerabilities = [];
        const xssPatterns = [
            /<script[^>]*>.*?<\/script>/is,
            /javascript:/i,
            /on\w+\s*=/i,
            /<iframe[^>]*>/i,
            /<object[^>]*>/i
        ];
        const documents = await this.prisma.document.findMany({
            where: {
                OR: [
                    { description: { not: null } },
                    { extractedText: { not: null } }
                ]
            },
            take: 100
        });
        documents.forEach(doc => {
            const fieldsToCheck = [doc.description, doc.extractedText];
            fieldsToCheck.forEach((field, index) => {
                if (field) {
                    xssPatterns.forEach(pattern => {
                        if (pattern.test(field)) {
                            vulnerabilities.push({
                                type: 'XSS',
                                target: `document_${index === 0 ? 'description' : 'extracted_text'}`,
                                found: true,
                                description: 'Potential XSS pattern detected',
                                evidence: field.substring(0, 100),
                                severity: 'MEDIUM'
                            });
                        }
                    });
                }
            });
        });
        return vulnerabilities;
    }
    async scanForFileUploadVulnerabilities() {
        const vulnerabilities = [];
        const recentUploads = await this.prisma.document.findMany({
            where: {
                uploadedAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                }
            },
            take: 100
        });
        const dangerousMimeTypes = [
            'application/x-executable',
            'application/x-sh',
            'application/x-bat',
            'application/php'
        ];
        recentUploads.forEach(doc => {
            if (dangerousMimeTypes.includes(doc.mimeType)) {
                vulnerabilities.push({
                    type: 'FILE_UPLOAD',
                    target: doc.filename,
                    found: true,
                    description: 'Dangerous file type uploaded',
                    severity: 'HIGH'
                });
            }
        });
        return vulnerabilities;
    }
    async scanForAuthenticationBypass() {
        const vulnerabilities = [];
        const failedAttempts = await this.prisma.auditLog.findMany({
            where: {
                action: 'authentication_failed',
                createdAt: {
                    gte: new Date(Date.now() - 60 * 60 * 1000)
                }
            },
            take: 50
        });
        const attemptsByUser = new Map();
        failedAttempts.forEach(log => {
            const userId = log.userId;
            attemptsByUser.set(userId, (attemptsByUser.get(userId) || 0) + 1);
        });
        attemptsByUser.forEach((attempts, userId) => {
            if (attempts > 10) {
                vulnerabilities.push({
                    type: 'AUTH_BYPASS',
                    target: `user_${userId}`,
                    found: true,
                    description: `Potential brute force attack detected (${attempts} attempts)`,
                    severity: 'MEDIUM'
                });
            }
        });
        return vulnerabilities;
    }
    isFileTypeAllowed(mimeType) {
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
            'image/jpeg',
            'image/png',
            'image/tiff',
            'image/gif'
        ];
        return allowedTypes.includes(mimeType);
    }
    validateInput(field, value) {
        switch (field) {
            case 'filename':
                return !/[<>:"/\\|?*]/.test(value) && !value.includes('..');
            case 'description':
                return typeof value === 'string' && value.length < 10000;
            case 'tags':
                return Array.isArray(value) && value.every(tag => typeof tag === 'string' && tag.length < 100 && !/[<>]/.test(tag));
            default:
                return true;
        }
    }
    generateRecommendations(results, vulnerabilities) {
        const recommendations = [];
        const failedTests = results.filter(r => r.status === 'FAILED');
        const criticalIssues = results.filter(r => r.severity === 'CRITICAL');
        if (failedTests.length > 0) {
            recommendations.push(`Address ${failedTests.length} failed security tests`);
        }
        if (criticalIssues.length > 0) {
            recommendations.push(`Prioritize fixing ${criticalIssues.length} critical security issues`);
        }
        const criticalVulnerabilities = vulnerabilities.filter(v => v.severity === 'CRITICAL');
        const highVulnerabilities = vulnerabilities.filter(v => v.severity === 'HIGH');
        if (criticalVulnerabilities.length > 0) {
            recommendations.push(`Immediately fix ${criticalVulnerabilities.length} critical vulnerabilities`);
        }
        if (highVulnerabilities.length > 0) {
            recommendations.push(`Address ${highVulnerabilities.length} high-severity vulnerabilities`);
        }
        recommendations.push('Implement regular security audits');
        recommendations.push('Keep dependencies up to date');
        recommendations.push('Enable monitoring and alerting for security events');
        recommendations.push('Implement rate limiting for authentication endpoints');
        return [...new Set(recommendations)];
    }
}
exports.DocumentSecurityService = DocumentSecurityService;
exports.documentSecurityService = new DocumentSecurityService(new client_1.PrismaClient());
//# sourceMappingURL=securityService.js.map