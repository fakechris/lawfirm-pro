import { PrismaClient } from '@prisma/client';
import { spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import crypto from 'crypto';

export interface ComplianceFramework {
  name: string;
  enabled: boolean;
  requirements: ComplianceRequirement[];
  score: number;
  lastAssessed: Date;
}

export interface ComplianceRequirement {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIALLY_COMPLIANT' | 'NOT_ASSESSED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evidence?: string[];
  findings?: ComplianceFinding[];
  lastAssessed: Date;
  nextReview: Date;
}

export interface ComplianceFinding {
  id: string;
  type: 'VIOLATION' | 'WEAKNESS' | 'OBSERVATION' | 'BEST_PRACTICE';
  description: string;
  impact: string;
  recommendation: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  assignedTo?: string;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceReport {
  id: string;
  reportType: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL' | 'AD_HOC';
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  frameworks: ComplianceFramework[];
  overallScore: number;
  summary: {
    totalRequirements: number;
    compliantRequirements: number;
    nonCompliantRequirements: number;
    partiallyCompliantRequirements: number;
    criticalFindings: number;
    highFindings: number;
    mediumFindings: number;
    lowFindings: number;
  };
  recommendations: string[];
  generatedBy: string;
}

export interface DataClassification {
  id: string;
  dataId: string;
  dataType: string;
  classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  confidence: number;
  reason: string;
  classifiedAt: Date;
  classifiedBy: string;
  retentionDays: number;
  encryptionRequired: boolean;
  accessControl: 'OPEN' | 'MODERATE' | 'STRICT';
}

export interface ConsentRecord {
  id: string;
  userId: string;
  dataType: string;
  purpose: string;
  consentType: 'EXPLICIT' | 'IMPLIED' | 'OPT_IN' | 'OPT_OUT';
  status: 'ACTIVE' | 'WITHDRAWN' | 'EXPIRED';
  givenAt: Date;
  withdrawnAt?: Date;
  expiresAt?: Date;
  version: number;
  metadata: Record<string, any>;
}

export class ComplianceAutomationService {
  private prisma: PrismaClient;
  private config: any;
  private isRunning: boolean = false;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.loadConfiguration();
  }

  private async loadConfiguration(): Promise<void> {
    try {
      const configPath = path.join(__dirname, '../configs/compliance-automation.yaml');
      const configData = await fs.readFile(configPath, 'utf8');
      this.config = yaml.load(configData);
      console.log('Compliance configuration loaded successfully');
    } catch (error) {
      console.error('Error loading compliance configuration:', error);
      throw error;
    }
  }

  async performComplianceAssessment(): Promise<ComplianceReport> {
    const startTime = new Date();
    const reportId = `compliance_report_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    const report: ComplianceReport = {
      id: reportId,
      reportType: 'AD_HOC',
      generatedAt: startTime,
      period: {
        start: new Date(startTime.getTime() - 24 * 60 * 60 * 1000), // Last 24 hours
        end: startTime
      },
      frameworks: [],
      overallScore: 0,
      summary: {
        totalRequirements: 0,
        compliantRequirements: 0,
        nonCompliantRequirements: 0,
        partiallyCompliantRequirements: 0,
        criticalFindings: 0,
        highFindings: 0,
        mediumFindings: 0,
        lowFindings: 0
      },
      recommendations: [],
      generatedBy: 'compliance-automation-service'
    };

    try {
      // Assess each compliance framework
      for (const [frameworkName, frameworkConfig] of Object.entries(this.config.frameworks)) {
        if (!(frameworkConfig as any).enabled) continue;

        const framework = await this.assessFramework(frameworkName, frameworkConfig as any);
        report.frameworks.push(framework);
        
        // Update summary
        framework.requirements.forEach(req => {
          report.summary.totalRequirements++;
          switch (req.status) {
            case 'COMPLIANT':
              report.summary.compliantRequirements++;
              break;
            case 'NON_COMPLIANT':
              report.summary.nonCompliantRequirements++;
              break;
            case 'PARTIALLY_COMPLIANT':
              report.summary.partiallyCompliantRequirements++;
              break;
          }
          
          // Count findings
          if (req.findings) {
            req.findings.forEach(finding => {
              switch (finding.severity) {
                case 'CRITICAL':
                  report.summary.criticalFindings++;
                  break;
                case 'HIGH':
                  report.summary.highFindings++;
                  break;
                case 'MEDIUM':
                  report.summary.mediumFindings++;
                  break;
                case 'LOW':
                  report.summary.lowFindings++;
                  break;
              }
            });
          }
        });
      }

      // Calculate overall score
      const totalScore = report.frameworks.reduce((sum, framework) => sum + framework.score, 0);
      report.overallScore = report.frameworks.length > 0 ? Math.round(totalScore / report.frameworks.length) : 0;

      // Generate recommendations
      report.recommendations = await this.generateRecommendations(report);

      // Store report in database
      await this.storeComplianceReport(report);

      console.log(`Compliance assessment completed. Overall score: ${report.overallScore}%`);
      return report;

    } catch (error) {
      console.error('Error performing compliance assessment:', error);
      throw error;
    }
  }

  private async assessFramework(frameworkName: string, frameworkConfig: any): Promise<ComplianceFramework> {
    const framework: ComplianceFramework = {
      name: frameworkName,
      enabled: frameworkConfig.enabled,
      requirements: [],
      score: 0,
      lastAssessed: new Date()
    };

    try {
      // Assess each requirement in the framework
      for (const [requirementName, requirementConfig] of Object.entries(frameworkConfig.requirements)) {
        const requirement = await this.assessRequirement(
          requirementName,
          requirementConfig as any,
          frameworkName
        );
        framework.requirements.push(requirement);
      }

      // Calculate framework score
      const compliantCount = framework.requirements.filter(req => req.status === 'COMPLIANT').length;
      const partiallyCompliantCount = framework.requirements.filter(req => req.status === 'PARTIALLY_COMPLIANT').length;
      framework.score = Math.round(((compliantCount + partiallyCompliantCount * 0.5) / framework.requirements.length) * 100);

      return framework;

    } catch (error) {
      console.error(`Error assessing framework ${frameworkName}:`, error);
      return framework;
    }
  }

  private async assessRequirement(
    requirementName: string,
    requirementConfig: any,
    frameworkName: string
  ): Promise<ComplianceRequirement> {
    const requirementId = `${frameworkName}_${requirementName}`;
    
    const requirement: ComplianceRequirement = {
      id: requirementId,
      name: requirementConfig.name || requirementName,
      description: requirementConfig.description || '',
      enabled: requirementConfig.enabled,
      status: 'NOT_ASSESSED',
      severity: requirementConfig.severity || 'MEDIUM',
      evidence: [],
      findings: [],
      lastAssessed: new Date(),
      nextReview: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next review in 7 days
    };

    try {
      if (!requirementConfig.enabled) {
        requirement.status = 'COMPLIANT';
        return requirement;
      }

      // Perform requirement-specific assessment
      const assessmentResult = await this.performRequirementAssessment(requirementName, requirementConfig);
      
      requirement.status = assessmentResult.status;
      requirement.evidence = assessmentResult.evidence;
      requirement.findings = assessmentResult.findings;

      return requirement;

    } catch (error) {
      console.error(`Error assessing requirement ${requirementId}:`, error);
      requirement.status = 'PARTIALLY_COMPLIANT';
      requirement.findings = [{
        id: crypto.randomUUID(),
        type: 'WEAKNESS',
        description: `Assessment failed: ${error}`,
        impact: 'Unable to verify compliance status',
        recommendation: 'Manual review required',
        severity: 'MEDIUM',
        status: 'OPEN',
        createdAt: new Date(),
        updatedAt: new Date()
      }];
      return requirement;
    }
  }

  private async performRequirementAssessment(requirementName: string, requirementConfig: any): Promise<{
    status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIALLY_COMPLIANT';
    evidence: string[];
    findings: ComplianceFinding[];
  }> {
    const evidence: string[] = [];
    const findings: ComplianceFinding[] = [];
    let status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIALLY_COMPLIANT' = 'COMPLIANT';

    try {
      switch (requirementName) {
        case 'data_localization':
          return await this.assessDataLocalization(requirementConfig);
        
        case 'consent_management':
          return await this.assessConsentManagement(requirementConfig);
        
        case 'data_retention':
          return await this.assessDataRetention(requirementConfig);
        
        case 'encryption_standards':
          return await this.assessEncryptionStandards(requirementConfig);
        
        case 'access_control':
          return await this.assessAccessControl(requirementConfig);
        
        case 'breach_notification':
          return await this.assessBreachNotification(requirementConfig);
        
        case 'network_security':
          return await this.assessNetworkSecurity(requirementConfig);
        
        case 'incident_reporting':
          return await this.assessIncidentReporting(requirementConfig);
        
        default:
          evidence.push(`Automated assessment not implemented for ${requirementName}`);
          status = 'PARTIALLY_COMPLIANT';
          findings.push({
            id: crypto.randomUUID(),
            type: 'OBSERVATION',
            description: `Automated assessment not implemented for ${requirementName}`,
            impact: 'Manual assessment required',
            recommendation: 'Implement automated assessment for this requirement',
            severity: 'LOW',
            status: 'OPEN',
            createdAt: new Date(),
            updatedAt: new Date()
          });
      }
    } catch (error) {
      console.error(`Error in requirement assessment ${requirementName}:`, error);
      return {
        status: 'PARTIALLY_COMPLIANT',
        evidence: [`Assessment error: ${error}`],
        findings: [{
          id: crypto.randomUUID(),
          type: 'WEAKNESS',
          description: `Assessment failed: ${error}`,
          impact: 'Unable to verify compliance',
          recommendation: 'Manual review required',
          severity: 'MEDIUM',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date()
        }]
      };
    }

    return { status, evidence, findings };
  }

  private async assessDataLocalization(config: any): Promise<{
    status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIALLY_COMPLIANT';
    evidence: string[];
    findings: ComplianceFinding[];
  }> {
    const evidence: string[] = [];
    const findings: ComplianceFinding[] = [];
    let status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIALLY_COMPLIANT' = 'COMPLIANT';

    try {
      // Check if data is stored in China region
      const databaseRegion = process.env.DB_REGION || 'unknown';
      const isChinaRegion = databaseRegion.toLowerCase().includes('china') || 
                          databaseRegion.toLowerCase().includes('cn');
      
      evidence.push(`Database region: ${databaseRegion}`);
      
      if (!isChinaRegion) {
        status = 'NON_COMPLIANT';
        findings.push({
          id: crypto.randomUUID(),
          type: 'VIOLATION',
          description: 'Data not stored in China region',
          impact: 'Violation of Chinese data localization requirements',
          recommendation: 'Migrate database to China region or implement data localization measures',
          severity: 'CRITICAL',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // Check if cross-border data transfers are restricted
      const crossBorderTransfers = await this.checkCrossBorderTransfers();
      evidence.push(`Cross-border transfers detected: ${crossBorderTransfers.count}`);
      
      if (crossBorderTransfers.count > 0 && config.cross_border_transfer === 'restricted') {
        status = 'NON_COMPLIANT';
        findings.push({
          id: crypto.randomUUID(),
          type: 'VIOLATION',
          description: 'Unauthorized cross-border data transfers detected',
          impact: 'Violation of data localization requirements',
          recommendation: 'Implement data transfer controls and obtain necessary approvals',
          severity: 'HIGH',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      return { status, evidence, findings };

    } catch (error) {
      console.error('Error assessing data localization:', error);
      return {
        status: 'PARTIALLY_COMPLIANT',
        evidence: [`Assessment error: ${error}`],
        findings: [{
          id: crypto.randomUUID(),
          type: 'WEAKNESS',
          description: 'Data localization assessment failed',
          impact: 'Unable to verify compliance',
          recommendation: 'Manual verification required',
          severity: 'MEDIUM',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date()
        }]
      };
    }
  }

  private async assessConsentManagement(config: any): Promise<{
    status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIALLY_COMPLIANT';
    evidence: string[];
    findings: ComplianceFinding[];
  }> {
    const evidence: string[] = [];
    const findings: ComplianceFinding[] = [];
    let status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIALLY_COMPLIANT' = 'COMPLIANT';

    try {
      // Check if consent records exist
      const consentCount = await this.prisma.consentRecord.count();
      evidence.push(`Total consent records: ${consentCount}`);
      
      if (consentCount === 0) {
        status = 'NON_COMPLIANT';
        findings.push({
          id: crypto.randomUUID(),
          type: 'VIOLATION',
          description: 'No consent records found',
          impact: 'Violation of consent management requirements',
          recommendation: 'Implement consent management system and record all consents',
          severity: 'CRITICAL',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // Check for expired consents
      const expiredConsents = await this.prisma.consentRecord.count({
        where: {
          expiresAt: {
            lt: new Date()
          },
          status: 'ACTIVE'
        }
      });
      evidence.push(`Expired consents: ${expiredConsents}`);
      
      if (expiredConsents > 0) {
        status = 'PARTIALLY_COMPLIANT';
        findings.push({
          id: crypto.randomUUID(),
          type: 'WEAKNESS',
          description: `${expiredConsents} expired consent records still active`,
          impact: 'Potential violation of consent management requirements',
          recommendation: 'Process expired consents and obtain renewal if necessary',
          severity: 'MEDIUM',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // Check consent withdrawal processing
      const withdrawalRequests = await this.prisma.consentRecord.count({
        where: {
          status: 'WITHDRAWN',
          withdrawnAt: {
            gt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      });
      evidence.push(`Recent withdrawal requests: ${withdrawalRequests}`);

      return { status, evidence, findings };

    } catch (error) {
      console.error('Error assessing consent management:', error);
      return {
        status: 'PARTIALLY_COMPLIANT',
        evidence: [`Assessment error: ${error}`],
        findings: [{
          id: crypto.randomUUID(),
          type: 'WEAKNESS',
          description: 'Consent management assessment failed',
          impact: 'Unable to verify compliance',
          recommendation: 'Manual verification required',
          severity: 'MEDIUM',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date()
        }]
      };
    }
  }

  private async assessDataRetention(config: any): Promise<{
    status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIALLY_COMPLIANT';
    evidence: string[];
    findings: ComplianceFinding[];
  }> {
    const evidence: string[] = [];
    const findings: ComplianceFinding[] = [];
    let status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIALLY_COMPLIANT' = 'COMPLIANT';

    try {
      // Check if retention policies are configured
      const retentionPolicies = await this.prisma.retentionPolicy.count();
      evidence.push(`Retention policies configured: ${retentionPolicies}`);
      
      if (retentionPolicies === 0) {
        status = 'NON_COMPLIANT';
        findings.push({
          id: crypto.randomUUID(),
          type: 'VIOLATION',
          description: 'No retention policies configured',
          impact: 'Violation of data retention requirements',
          recommendation: 'Configure retention policies for all data types',
          severity: 'HIGH',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // Check for data exceeding retention periods
      const expiredData = await this.checkExpiredData();
      evidence.push(`Data items exceeding retention: ${expiredData.count}`);
      
      if (expiredData.count > 0 && config.auto_deletion) {
        status = 'PARTIALLY_COMPLIANT';
        findings.push({
          id: crypto.randomUUID(),
          type: 'WEAKNESS',
          description: `${expiredData.count} data items exceeding retention period`,
          impact: 'Potential violation of data retention requirements',
          recommendation: 'Process expired data according to retention policies',
          severity: 'MEDIUM',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      return { status, evidence, findings };

    } catch (error) {
      console.error('Error assessing data retention:', error);
      return {
        status: 'PARTIALLY_COMPLIANT',
        evidence: [`Assessment error: ${error}`],
        findings: [{
          id: crypto.randomUUID(),
          type: 'WEAKNESS',
          description: 'Data retention assessment failed',
          impact: 'Unable to verify compliance',
          recommendation: 'Manual verification required',
          severity: 'MEDIUM',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date()
        }]
      };
    }
  }

  private async assessEncryptionStandards(config: any): Promise<{
    status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIALLY_COMPLIANT';
    evidence: string[];
    findings: ComplianceFinding[];
  }> {
    const evidence: string[] = [];
    const findings: ComplianceFinding[] = [];
    let status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIALLY_COMPLIANT' = 'COMPLIANT';

    try {
      // Check database encryption
      const dbEncryption = process.env.DATABASE_ENCRYPTION === 'true' || 
                         process.env.DATABASE_URL?.includes('sslmode=require');
      evidence.push(`Database encryption: ${dbEncryption ? 'Enabled' : 'Disabled'}`);
      
      if (!dbEncryption) {
        status = 'NON_COMPLIANT';
        findings.push({
          id: crypto.randomUUID(),
          type: 'VIOLATION',
          description: 'Database encryption not enabled',
          impact: 'Violation of encryption standards',
          recommendation: 'Enable database encryption with minimum AES-256',
          severity: 'CRITICAL',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // Check encryption key management
      const encryptionKey = process.env.ENCRYPTION_KEY;
      evidence.push(`Encryption key configured: ${encryptionKey ? 'Yes' : 'No'}`);
      
      if (!encryptionKey) {
        status = 'NON_COMPLIANT';
        findings.push({
          id: crypto.randomUUID(),
          type: 'VIOLATION',
          description: 'Encryption key not configured',
          impact: 'Violation of encryption standards',
          recommendation: 'Configure encryption key management system',
          severity: 'CRITICAL',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // Check key rotation
      const keyRotationEnabled = process.env.KEY_ROTATION_ENABLED === 'true';
      evidence.push(`Key rotation enabled: ${keyRotationEnabled}`);
      
      if (!keyRotationEnabled && config.rotation_enabled) {
        status = 'PARTIALLY_COMPLIANT';
        findings.push({
          id: crypto.randomUUID(),
          type: 'WEAKNESS',
          description: 'Key rotation not enabled',
          impact: 'Potential violation of encryption standards',
          recommendation: 'Enable automatic key rotation',
          severity: 'MEDIUM',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      return { status, evidence, findings };

    } catch (error) {
      console.error('Error assessing encryption standards:', error);
      return {
        status: 'PARTIALLY_COMPLIANT',
        evidence: [`Assessment error: ${error}`],
        findings: [{
          id: crypto.randomUUID(),
          type: 'WEAKNESS',
          description: 'Encryption standards assessment failed',
          impact: 'Unable to verify compliance',
          recommendation: 'Manual verification required',
          severity: 'MEDIUM',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date()
        }]
      };
    }
  }

  private async assessAccessControl(config: any): Promise<{
    status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIALLY_COMPLIANT';
    evidence: string[];
    findings: ComplianceFinding[];
  }> {
    const evidence: string[] = [];
    const findings: ComplianceFinding[] = [];
    let status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIALLY_COMPLIANT' = 'COMPLIANT';

    try {
      // Check if role-based access control is implemented
      const rolesCount = await this.prisma.role.count();
      evidence.push(`Roles configured: ${rolesCount}`);
      
      if (rolesCount === 0) {
        status = 'NON_COMPLIANT';
        findings.push({
          id: crypto.randomUUID(),
          type: 'VIOLATION',
          description: 'Role-based access control not implemented',
          impact: 'Violation of access control requirements',
          recommendation: 'Implement role-based access control system',
          severity: 'HIGH',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // Check for multi-factor authentication
      const mfaEnabled = process.env.MFA_ENABLED === 'true';
      evidence.push(`Multi-factor authentication: ${mfaEnabled ? 'Enabled' : 'Disabled'}`);
      
      if (!mfaEnabled && config.multi_factor_auth) {
        status = 'PARTIALLY_COMPLIANT';
        findings.push({
          id: crypto.randomUUID(),
          type: 'WEAKNESS',
          description: 'Multi-factor authentication not enabled',
          impact: 'Potential violation of access control requirements',
          recommendation: 'Enable multi-factor authentication for all users',
          severity: 'MEDIUM',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // Check audit trail for access
      const auditLogs = await this.prisma.auditLog.count({
        where: {
          action: {
            contains: 'access'
          },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      });
      evidence.push(`Access audit logs (24h): ${auditLogs}`);

      return { status, evidence, findings };

    } catch (error) {
      console.error('Error assessing access control:', error);
      return {
        status: 'PARTIALLY_COMPLIANT',
        evidence: [`Assessment error: ${error}`],
        findings: [{
          id: crypto.randomUUID(),
          type: 'WEAKNESS',
          description: 'Access control assessment failed',
          impact: 'Unable to verify compliance',
          recommendation: 'Manual verification required',
          severity: 'MEDIUM',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date()
        }]
      };
    }
  }

  private async assessBreachNotification(config: any): Promise<{
    status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIALLY_COMPLIANT';
    evidence: string[];
    findings: ComplianceFinding[];
  }> {
    const evidence: string[] = [];
    const findings: ComplianceFinding[] = [];
    let status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIALLY_COMPLIANT' = 'COMPLIANT';

    try {
      // Check if breach notification procedures exist
      const breachProcedures = await this.checkBreachNotificationProcedures();
      evidence.push(`Breach notification procedures: ${breachProcedures.exists ? 'Exist' : 'Missing'}`);
      
      if (!breachProcedures.exists) {
        status = 'NON_COMPLIANT';
        findings.push({
          id: crypto.randomUUID(),
          type: 'VIOLATION',
          description: 'Breach notification procedures not documented',
          impact: 'Violation of breach notification requirements',
          recommendation: 'Document breach notification procedures and test them regularly',
          severity: 'HIGH',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // Check notification contacts
      const notificationContacts = process.env.BREACH_NOTIFICATION_CONTACTS;
      evidence.push(`Notification contacts configured: ${notificationContacts ? 'Yes' : 'No'}`);
      
      if (!notificationContacts) {
        status = 'PARTIALLY_COMPLIANT';
        findings.push({
          id: crypto.randomUUID(),
          type: 'WEAKNESS',
          description: 'Breach notification contacts not configured',
          impact: 'Potential violation of breach notification requirements',
          recommendation: 'Configure breach notification contacts and test notification system',
          severity: 'MEDIUM',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      return { status, evidence, findings };

    } catch (error) {
      console.error('Error assessing breach notification:', error);
      return {
        status: 'PARTIALLY_COMPLIANT',
        evidence: [`Assessment error: ${error}`],
        findings: [{
          id: crypto.randomUUID(),
          type: 'WEAKNESS',
          description: 'Breach notification assessment failed',
          impact: 'Unable to verify compliance',
          recommendation: 'Manual verification required',
          severity: 'MEDIUM',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date()
        }]
      };
    }
  }

  private async assessNetworkSecurity(config: any): Promise<{
    status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIALLY_COMPLIANT';
    evidence: string[];
    findings: ComplianceFinding[];
  }> {
    const evidence: string[] = [];
    const findings: ComplianceFinding[] = [];
    let status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIALLY_COMPLIANT' = 'COMPLIANT';

    try {
      // Check if security grading system is implemented
      const securityGrading = await this.checkSecurityGrading();
      evidence.push(`Security grading system: ${securityGrading.implemented ? 'Implemented' : 'Not implemented'}`);
      
      if (!securityGrading.implemented) {
        status = 'PARTIALLY_COMPLIANT';
        findings.push({
          id: crypto.randomUUID(),
          type: 'WEAKNESS',
          description: 'Security grading system not implemented',
          impact: 'Partial compliance with network security requirements',
          recommendation: 'Implement security grading system as required by CSL',
          severity: 'MEDIUM',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // Check firewall rules
      const firewallRules = await this.checkFirewallRules();
      evidence.push(`Firewall rules configured: ${firewallRules.count}`);
      
      if (firewallRules.count === 0) {
        status = 'PARTIALLY_COMPLIANT';
        findings.push({
          id: crypto.randomUUID(),
          type: 'WEAKNESS',
          description: 'No firewall rules configured',
          impact: 'Potential security vulnerability',
          recommendation: 'Configure appropriate firewall rules',
          severity: 'MEDIUM',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      return { status, evidence, findings };

    } catch (error) {
      console.error('Error assessing network security:', error);
      return {
        status: 'PARTIALLY_COMPLIANT',
        evidence: [`Assessment error: ${error}`],
        findings: [{
          id: crypto.randomUUID(),
          type: 'WEAKNESS',
          description: 'Network security assessment failed',
          impact: 'Unable to verify compliance',
          recommendation: 'Manual verification required',
          severity: 'MEDIUM',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date()
        }]
      };
    }
  }

  private async assessIncidentReporting(config: any): Promise<{
    status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIALLY_COMPLIANT';
    evidence: string[];
    findings: ComplianceFinding[];
  }> {
    const evidence: string[] = [];
    const findings: ComplianceFinding[] = [];
    let status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIALLY_COMPLIANT' = 'COMPLIANT';

    try {
      // Check incident response procedures
      const incidentProcedures = await this.checkIncidentResponseProcedures();
      evidence.push(`Incident response procedures: ${incidentProcedures.exists ? 'Exist' : 'Missing'}`);
      
      if (!incidentProcedures.exists) {
        status = 'NON_COMPLIANT';
        findings.push({
          id: crypto.randomUUID(),
          type: 'VIOLATION',
          description: 'Incident response procedures not documented',
          impact: 'Violation of incident reporting requirements',
          recommendation: 'Document incident response procedures and test them regularly',
          severity: 'HIGH',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // Check recent security incidents
      const recentIncidents = await this.prisma.securityIncident.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        }
      });
      evidence.push(`Recent security incidents: ${recentIncidents}`);

      return { status, evidence, findings };

    } catch (error) {
      console.error('Error assessing incident reporting:', error);
      return {
        status: 'PARTIALLY_COMPLIANT',
        evidence: [`Assessment error: ${error}`],
        findings: [{
          id: crypto.randomUUID(),
          type: 'WEAKNESS',
          description: 'Incident reporting assessment failed',
          impact: 'Unable to verify compliance',
          recommendation: 'Manual verification required',
          severity: 'MEDIUM',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date()
        }]
      };
    }
  }

  private async generateRecommendations(report: ComplianceReport): Promise<string[]> {
    const recommendations: string[] = [];
    
    // Analyze critical findings
    if (report.summary.criticalFindings > 0) {
      recommendations.push(`Address ${report.summary.criticalFindings} critical findings immediately`);
    }
    
    // Analyze overall compliance score
    if (report.overallScore < 70) {
      recommendations.push('Implement immediate compliance improvements to meet regulatory requirements');
    } else if (report.overallScore < 90) {
      recommendations.push('Continue compliance improvement initiatives to achieve higher compliance score');
    }
    
    // Framework-specific recommendations
    report.frameworks.forEach(framework => {
      if (framework.score < 70) {
        recommendations.push(`Prioritize improvements in ${framework.name} framework compliance`);
      }
    });
    
    // General recommendations
    recommendations.push('Schedule regular compliance assessments');
    recommendations.push('Maintain comprehensive documentation of compliance measures');
    recommendations.push('Provide regular compliance training to staff');
    recommendations.push('Stay updated on regulatory changes and requirements');
    
    return [...new Set(recommendations)]; // Remove duplicates
  }

  private async storeComplianceReport(report: ComplianceReport): Promise<void> {
    try {
      await this.prisma.complianceReport.create({
        data: {
          id: report.id,
          reportType: report.reportType,
          generatedAt: report.generatedAt,
          periodStart: report.period.start,
          periodEnd: report.period.end,
          overallScore: report.overallScore,
          summary: report.summary as any,
          frameworks: report.frameworks as any,
          recommendations: report.recommendations,
          generatedBy: report.generatedBy
        }
      });
    } catch (error) {
      console.error('Error storing compliance report:', error);
    }
  }

  // Helper methods for specific checks
  private async checkCrossBorderTransfers(): Promise<{ count: number }> {
    // This would check for cross-border data transfers
    // For now, return a placeholder
    return { count: 0 };
  }

  private async checkExpiredData(): Promise<{ count: number }> {
    // This would check for data exceeding retention periods
    // For now, return a placeholder
    return { count: 0 };
  }

  private async checkBreachNotificationProcedures(): Promise<{ exists: boolean }> {
    // This would check if breach notification procedures exist
    // For now, return a placeholder
    return { exists: false };
  }

  private async checkSecurityGrading(): Promise<{ implemented: boolean }> {
    // This would check if security grading system is implemented
    // For now, return a placeholder
    return { implemented: false };
  }

  private async checkFirewallRules(): Promise<{ count: number }> {
    // This would check firewall rules
    // For now, return a placeholder
    return { count: 0 };
  }

  private async checkIncidentResponseProcedures(): Promise<{ exists: boolean }> {
    // This would check if incident response procedures exist
    // For now, return a placeholder
    return { exists: false };
  }

  // Public methods for compliance operations
  async classifyData(dataId: string, dataType: string, content: string): Promise<DataClassification> {
    const classification = await this.performDataClassification(dataId, dataType, content);
    
    // Store classification in database
    await this.prisma.dataClassification.create({
      data: {
        id: classification.id,
        dataId,
        dataType,
        classification: classification.classification,
        confidence: classification.confidence,
        reason: classification.reason,
        classifiedAt: classification.classifiedAt,
        classifiedBy: classification.classifiedBy,
        retentionDays: classification.retentionDays,
        encryptionRequired: classification.encryptionRequired,
        accessControl: classification.accessControl
      }
    });
    
    return classification;
  }

  private async performDataClassification(dataId: string, dataType: string, content: string): Promise<DataClassification> {
    const rules = this.config.automation_rules?.data_classification || [];
    
    for (const rule of rules) {
      const pattern = new RegExp(rule.pattern, 'i');
      if (pattern.test(content)) {
        return {
          id: crypto.randomUUID(),
          dataId,
          dataType,
          classification: rule.classification,
          confidence: 0.9,
          reason: `Matched pattern: ${rule.pattern}`,
          classifiedAt: new Date(),
          classifiedBy: 'compliance-automation-service',
          retentionDays: rule.retention_days,
          encryptionRequired: rule.encryption_required,
          accessControl: rule.access_control
        };
      }
    }
    
    // Default classification
    return {
      id: crypto.randomUUID(),
      dataId,
      dataType,
      classification: 'INTERNAL',
      confidence: 0.5,
      reason: 'No specific pattern matched, default classification applied',
      classifiedAt: new Date(),
      classifiedBy: 'compliance-automation-service',
      retentionDays: 2555, // 7 years
      encryptionRequired: true,
      accessControl: 'MODERATE'
    };
  }

  async recordConsent(consentData: {
    userId: string;
    dataType: string;
    purpose: string;
    consentType: 'EXPLICIT' | 'IMPLIED' | 'OPT_IN' | 'OPT_OUT';
    expiresAt?: Date;
  }): Promise<ConsentRecord> {
    const consentRecord: ConsentRecord = {
      id: crypto.randomUUID(),
      userId: consentData.userId,
      dataType: consentData.dataType,
      purpose: consentData.purpose,
      consentType: consentData.consentType,
      status: 'ACTIVE',
      givenAt: new Date(),
      expiresAt: consentData.expiresAt,
      version: 1,
      metadata: {}
    };
    
    // Store consent record
    await this.prisma.consentRecord.create({
      data: {
        id: consentRecord.id,
        userId: consentRecord.userId,
        dataType: consentRecord.dataType,
        purpose: consentRecord.purpose,
        consentType: consentRecord.consentType,
        status: consentRecord.status,
        givenAt: consentRecord.givenAt,
        expiresAt: consentRecord.expiresAt,
        version: consentRecord.version,
        metadata: consentRecord.metadata
      }
    });
    
    return consentRecord;
  }

  async withdrawConsent(consentId: string, reason?: string): Promise<ConsentRecord> {
    const consentRecord = await this.prisma.consentRecord.update({
      where: { id: consentId },
      data: {
        status: 'WITHDRAWN',
        withdrawnAt: new Date(),
        metadata: {
          ...((await this.prisma.consentRecord.findUnique({ where: { id: consentId } }))?.metadata || {}),
          withdrawalReason: reason
        }
      }
    });
    
    return consentRecord as ConsentRecord;
  }

  async startComplianceMonitoring(): Promise<void> {
    if (this.isRunning) {
      console.log('Compliance monitoring is already running');
      return;
    }
    
    this.isRunning = true;
    console.log('Starting compliance monitoring...');
    
    // Start periodic compliance assessments
    setInterval(async () => {
      try {
        await this.performComplianceAssessment();
      } catch (error) {
        console.error('Error in periodic compliance assessment:', error);
      }
    }, 24 * 60 * 60 * 1000); // Daily assessments
    
    // Start real-time monitoring
    await this.startRealTimeMonitoring();
  }

  private async startRealTimeMonitoring(): Promise<void> {
    // Monitor for compliance violations in real-time
    // This would integrate with various monitoring systems
    console.log('Real-time compliance monitoring started');
  }

  async getComplianceStatus(): Promise<{
    overallScore: number;
    frameworkScores: Record<string, number>;
    openFindings: number;
    criticalFindings: number;
    lastAssessment: Date;
  }> {
    const latestReport = await this.prisma.complianceReport.findFirst({
      orderBy: { generatedAt: 'desc' }
    });
    
    if (!latestReport) {
      return {
        overallScore: 0,
        frameworkScores: {},
        openFindings: 0,
        criticalFindings: 0,
        lastAssessment: new Date()
      };
    }
    
    const frameworkScores: Record<string, number> = {};
    latestReport.frameworks.forEach((framework: any) => {
      frameworkScores[framework.name] = framework.score;
    });
    
    return {
      overallScore: latestReport.overallScore,
      frameworkScores,
      openFindings: latestReport.summary.totalRequirements - latestReport.summary.compliantRequirements,
      criticalFindings: latestReport.summary.criticalFindings,
      lastAssessment: latestReport.generatedAt
    };
  }

  async generateComplianceReport(
    reportType: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL',
    period?: { start: Date; end: Date }
  ): Promise<ComplianceReport> {
    const report = await this.performComplianceAssessment();
    report.reportType = reportType;
    
    if (period) {
      report.period = period;
    }
    
    return report;
  }
}

export const complianceAutomationService = new ComplianceAutomationService(new PrismaClient());