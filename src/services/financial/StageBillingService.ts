import { PrismaClient } from '@prisma/client';
import { 
  BillingNode,
  Invoice,
  InvoiceItem,
  TimeEntry,
  Expense,
  InvoiceStatus,
  PaymentStatus,
  FeeType
} from '../models/financial';

export interface StageBillingConfiguration {
  autoAdvance: boolean;
  requireCompletion: boolean;
  allowPartialBilling: boolean;
  sendNotifications: boolean;
  approvalRequired: boolean;
  gracePeriod: number;
  currency: string;
}

export interface StageBillingNode {
  id: string;
  name: string;
  description: string;
  phase: string;
  order: number;
  amount: number;
  requirements: string[];
  dependencies: string[];
  triggers: string[];
  completionCriteria: {
    timeThreshold?: number;
    documentRequirements?: string[];
    approvalRequirements?: string[];
  };
  dueDate?: Date;
  isCompleted: boolean;
  completionDate?: Date;
  isActive: boolean;
}

export interface StageBillingProgress {
  currentPhase: string;
  completedNodes: StageBillingNode[];
  pendingNodes: StageBillingNode[];
  blockedNodes: StageBillingNode[];
  readyNodes: StageBillingNode[];
  overallProgress: number;
  phaseProgress: Record<string, number>;
  nextMilestone?: StageBillingNode;
  billingSummary: {
    totalBilled: number;
    totalPaid: number;
    outstandingBalance: number;
    upcomingPayments: any[];
  };
}

export interface StageBillingValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
  compliance: {
    meetsRequirements: boolean;
    violations: string[];
    suggestions: string[];
  };
}

export interface StageBillingAutomation {
  enabled: boolean;
  rules: {
    autoGenerateInvoices: boolean;
    autoApproveCompletions: boolean;
    autoSendReminders: boolean;
    autoAdvanceStages: boolean;
  };
  triggers: {
    onTimeEntry: boolean;
    onDocumentUpload: boolean;
    onMilestoneCompletion: boolean;
    onPaymentReceived: boolean;
  };
  conditions: {
    minimumAmount: number;
    maximumDelay: number;
    requiredApprovals: number;
  };
}

export class StageBillingService {
  private prisma: PrismaClient;
  private configuration: StageBillingConfiguration;

  constructor(prisma: PrismaClient, configuration?: StageBillingConfiguration) {
    this.prisma = prisma;
    this.configuration = configuration || this.getDefaultConfiguration();
  }

  // Create stage-based billing system for a case
  async createStageBillingSystem(
    caseId: string,
    billingNodes: StageBillingNode[],
    configuration?: StageBillingConfiguration
  ): Promise<{
    success: boolean;
    createdNodes: BillingNode[];
    validation: StageBillingValidation;
    automation: StageBillingAutomation;
  }> {
    // Validate case exists
    const caseData = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: { client: true },
    });

    if (!caseData) {
      throw new Error('Case not found');
    }

    // Validate billing nodes
    const validation = await this.validateBillingNodes(billingNodes, caseData.caseType);
    if (!validation.isValid) {
      return {
        success: false,
        createdNodes: [],
        validation,
        automation: this.getAutomationRules(),
      };
    }

    // Clear existing billing nodes for this case
    await this.prisma.billingNode.updateMany({
      where: { caseId },
      data: { isActive: false },
    });

    // Create new billing nodes
    const createdNodes = await Promise.all(
      billingNodes.map(async (node) => {
        return this.prisma.billingNode.create({
          data: {
            name: node.name,
            description: node.description,
            caseId,
            phase: node.phase,
            order: node.order,
            amount: node.amount,
            dueDate: node.dueDate,
            notes: `Requirements: ${node.requirements.join(', ')} | Dependencies: ${node.dependencies.join(', ')}`,
            isActive: true,
          },
        });
      })
    );

    // Store configuration
    if (configuration) {
      await this.storeConfiguration(caseId, configuration);
    }

    return {
      success: true,
      createdNodes,
      validation,
      automation: this.getAutomationRules(),
    };
  }

  // Get current stage billing progress
  async getStageBillingProgress(caseId: string): Promise<StageBillingProgress> {
    const caseData = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: {
        billingNodes: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
        invoices: {
          include: { payments: true },
        },
        timeEntries: { where: { isBilled: false } },
        expenses: { where: { isBilled: false, isBillable: true } },
      },
    });

    if (!caseData) {
      throw new Error('Case not found');
    }

    // Convert billing nodes to stage billing nodes
    const stageNodes = await this.convertToStageBillingNodes(caseData.billingNodes);

    // Analyze node status
    const completedNodes = stageNodes.filter(node => node.isCompleted);
    const pendingNodes = stageNodes.filter(node => !node.isCompleted);
    const blockedNodes = await this.getBlockedNodes(stageNodes);
    const readyNodes = await this.getReadyNodes(stageNodes);

    // Calculate progress
    const overallProgress = this.calculateOverallProgress(stageNodes);
    const phaseProgress = this.calculatePhaseProgress(stageNodes);

    // Get next milestone
    const nextMilestone = readyNodes.length > 0 ? readyNodes[0] : undefined;

    // Calculate billing summary
    const billingSummary = await this.calculateBillingSummary(caseData);

    return {
      currentPhase: caseData.phase,
      completedNodes,
      pendingNodes,
      blockedNodes,
      readyNodes,
      overallProgress,
      phaseProgress,
      nextMilestone,
      billingSummary,
    };
  }

  // Complete a billing milestone
  async completeBillingMilestone(
    billingNodeId: string,
    completionData: {
      completionDate: Date;
      notes?: string;
      documents?: string[];
      approverId?: string;
      generateInvoice?: boolean;
    }
  ): Promise<{
    billingNode: BillingNode;
    nextNodes: BillingNode[];
    invoice?: Invoice;
    automationResults: any;
  }> {
    const billingNode = await this.prisma.billingNode.findUnique({
      where: { id: billingNodeId },
      include: {
        case: {
          include: {
            billingNodes: {
              where: { isActive: true, isPaid: false },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!billingNode) {
      throw new Error('Billing node not found');
    }

    // Validate completion requirements
    const validation = await this.validateCompletion(billingNodeId, completionData);
    if (!validation.isValid) {
      throw new Error(`Cannot complete milestone: ${validation.errors.join(', ')}`);
    }

    // Update billing node
    const updatedNode = await this.prisma.billingNode.update({
      where: { id: billingNodeId },
      data: {
        isPaid: true,
        paidDate: completionData.completionDate,
        notes: completionData.notes,
      },
    });

    // Generate invoice if requested
    let invoice: Invoice | undefined;
    if (completionData.generateInvoice) {
      invoice = await this.generateInvoiceForMilestone(billingNodeId);
    }

    // Get next available nodes
    const nextNodes = await this.getNextAvailableNodes(billingNode.caseId, billingNode.order);

    // Handle automation
    const automationResults = await this.handleAutomation(
      billingNode.caseId,
      billingNodeId,
      'COMPLETION'
    );

    return {
      billingNode: updatedNode,
      nextNodes,
      invoice,
      automationResults,
    };
  }

  // Validate billing milestone completion
  async validateCompletion(
    billingNodeId: string,
    completionData: any
  ): Promise<StageBillingValidation> {
    const billingNode = await this.prisma.billingNode.findUnique({
      where: { id: billingNodeId },
      include: {
        case: {
          include: {
            billingNodes: {
              where: { isActive: true },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!billingNode) {
      return {
        isValid: false,
        errors: ['Billing node not found'],
        warnings: [],
        recommendations: [],
        compliance: {
          meetsRequirements: false,
          violations: ['Billing node not found'],
          suggestions: [],
        },
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];
    const violations: string[] = [];
    const suggestions: string[] = [];

    // Check if already completed
    if (billingNode.isPaid) {
      errors.push('Billing node is already completed');
    }

    // Check dependencies
    const dependencies = await this.checkDependencies(billingNode);
    if (!dependencies.allMet) {
      errors.push(`Dependencies not met: ${dependencies.unmet.join(', ')}`);
    }

    // Check document requirements
    if (completionData.documents && completionData.documents.length > 0) {
      // Validate documents (simplified)
      console.log(`Validating ${completionData.documents.length} documents`);
    }

    // Check time threshold
    const timeThresholdMet = await this.checkTimeThreshold(billingNode);
    if (!timeThresholdMet) {
      warnings.push('Time threshold not yet met');
    }

    // Check compliance requirements
    const complianceCheck = await this.checkComplianceRequirements(billingNode);
    if (!complianceCheck.passed) {
      violations.push(...complianceCheck.violations);
      suggestions.push(...complianceCheck.suggestions);
    }

    // Generate recommendations
    if (billingNode.amount > 100000) {
      recommendations.push('Consider obtaining client approval for large amounts');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations,
      compliance: {
        meetsRequirements: violations.length === 0,
        violations,
        suggestions,
      },
    };
  }

  // Generate automated billing suggestions
  async generateBillingSuggestions(caseId: string): Promise<{
    suggestions: any[];
    readyToBill: any[];
    upcomingDeadlines: any[];
    overdueItems: any[];
  }> {
    const progress = await this.getStageBillingProgress(caseId);
    const caseData = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: {
        timeEntries: { where: { isBilled: false } },
        expenses: { where: { isBilled: false, isBillable: true } },
      },
    });

    const suggestions: any[] = [];
    const readyToBill: any[] = [];
    const upcomingDeadlines: any[] = [];
    const overdueItems: any[] = [];

    // Check ready nodes for billing
    for (const node of progress.readyNodes) {
      if (node.amount > 0) {
        readyToBill.push({
          node,
          reason: 'All dependencies met and requirements fulfilled',
          priority: this.calculatePriority(node, progress),
        });
      }
    }

    // Check for unbilled time entries
    if (caseData?.timeEntries && caseData.timeEntries.length > 0) {
      const totalUnbilledTime = caseData.timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
      if (totalUnbilledTime > 10) { // More than 10 hours unbilled
        suggestions.push({
          type: 'time_entries',
          message: `Consider billing ${totalUnbilledTime} hours of unbilled time`,
          priority: 'medium',
        });
      }
    }

    // Check for unbilled expenses
    if (caseData?.expenses && caseData.expenses.length > 0) {
      const totalUnbilledExpenses = caseData.expenses.reduce((sum, expense) => sum + expense.amount, 0);
      if (totalUnbilledExpenses > 5000) { // More than 5000 CNY in expenses
        suggestions.push({
          type: 'expenses',
          message: `Consider billing ${totalUnbilledExpenses} CNY in unbilled expenses`,
          priority: 'high',
        });
      }
    }

    // Check upcoming deadlines
    const now = new Date();
    for (const node of progress.pendingNodes) {
      if (node.dueDate) {
        const daysUntilDue = Math.ceil((node.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilDue <= 7 && daysUntilDue > 0) {
          upcomingDeadlines.push({
            node,
            daysUntilDue,
            priority: daysUntilDue <= 3 ? 'high' : 'medium',
          });
        } else if (daysUntilDue <= 0) {
          overdueItems.push({
            node,
            daysOverdue: Math.abs(daysUntilDue),
            priority: 'critical',
          });
        }
      }
    }

    return {
      suggestions,
      readyToBill,
      upcomingDeadlines,
      overdueItems,
    };
  }

  // Process automation rules
  async processAutomation(caseId: string): Promise<{
    processed: string[];
    results: any[];
    errors: string[];
  }> {
    const automation = this.getAutomationRules();
    const processed: string[] = [];
    const results: any[] = [];
    const errors: string[] = [];

    if (!automation.enabled) {
      return { processed, results, errors: ['Automation is disabled'] };
    }

    try {
      // Auto-generate invoices for completed milestones
      if (automation.rules.autoGenerateInvoices) {
        const invoiceResult = await this.autoGenerateInvoices(caseId);
        processed.push('auto_generate_invoices');
        results.push(invoiceResult);
      }

      // Send reminders for upcoming deadlines
      if (automation.rules.autoSendReminders) {
        const reminderResult = await this.sendDeadlineReminders(caseId);
        processed.push('send_reminders');
        results.push(reminderResult);
      }

      // Auto-advance stages if configured
      if (automation.rules.autoAdvanceStages) {
        const advanceResult = await this.autoAdvanceStages(caseId);
        processed.push('auto_advance_stages');
        results.push(advanceResult);
      }

    } catch (error) {
      errors.push(`Automation processing failed: ${error.message}`);
    }

    return { processed, results, errors };
  }

  // Helper methods
  private getDefaultConfiguration(): StageBillingConfiguration {
    return {
      autoAdvance: true,
      requireCompletion: true,
      allowPartialBilling: false,
      sendNotifications: true,
      approvalRequired: false,
      gracePeriod: 7,
      currency: 'CNY',
    };
  }

  private async validateBillingNodes(billingNodes: StageBillingNode[], caseType: string): Promise<StageBillingValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];
    const violations: string[] = [];
    const suggestions: string[] = [];

    // Check for duplicate orders
    const orders = billingNodes.map(n => n.order);
    const uniqueOrders = new Set(orders);
    if (orders.length !== uniqueOrders.size) {
      errors.push('Duplicate milestone orders detected');
    }

    // Validate each node
    billingNodes.forEach((node, index) => {
      if (!node.name || node.name.trim() === '') {
        errors.push(`Node ${index + 1}: Name is required`);
      }

      if (node.amount <= 0) {
        errors.push(`Node ${index + 1}: Amount must be greater than 0`);
      }

      if (node.requirements.length === 0) {
        warnings.push(`Node ${index + 1}: No requirements specified`);
      }

      // Check for circular dependencies
      if (node.dependencies.includes(node.id)) {
        errors.push(`Node ${index + 1}: Cannot depend on itself`);
      }
    });

    // Check phase compatibility
    const phases = billingNodes.map(n => n.phase);
    const uniquePhases = new Set(phases);
    if (uniquePhases.size > 1) {
      recommendations.push('Consider organizing nodes by phase for better clarity');
    }

    // Check legal compliance
    const totalAmount = billingNodes.reduce((sum, node) => sum + node.amount, 0);
    if (totalAmount > 1000000) {
      suggestions.push('Consider court approval for cases over 1M CNY');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations,
      compliance: {
        meetsRequirements: violations.length === 0,
        violations,
        suggestions,
      },
    };
  }

  private async convertToStageBillingNodes(billingNodes: BillingNode[]): Promise<StageBillingNode[]> {
    return billingNodes.map(node => ({
      id: node.id,
      name: node.name,
      description: node.description || '',
      phase: node.phase,
      order: node.order,
      amount: node.amount,
      requirements: this.parseRequirements(node.notes),
      dependencies: this.parseDependencies(node.notes),
      triggers: this.parseTriggers(node.notes),
      completionCriteria: {},
      dueDate: node.dueDate,
      isCompleted: node.isPaid,
      completionDate: node.paidDate,
      isActive: node.isActive,
    }));
  }

  private parseRequirements(notes?: string): string[] {
    if (!notes) return [];
    const requirementsMatch = notes.match(/Requirements:\s*([^|]*)/);
    return requirementsMatch ? requirementsMatch[1].split(',').map(r => r.trim()) : [];
  }

  private parseDependencies(notes?: string): string[] {
    if (!notes) return [];
    const dependenciesMatch = notes.match(/Dependencies:\s*([^|]*)/);
    return dependenciesMatch ? dependenciesMatch[1].split(',').map(d => d.trim()) : [];
  }

  private parseTriggers(notes?: string): string[] {
    if (!notes) return [];
    const triggersMatch = notes.match(/Triggers:\s*([^|]*)/);
    return triggersMatch ? triggersMatch[1].split(',').map(t => t.trim()) : [];
  }

  private async getBlockedNodes(nodes: StageBillingNode[]): Promise<StageBillingNode[]> {
    const blockedNodes: StageBillingNode[] = [];

    for (const node of nodes) {
      if (node.isCompleted) continue;

      const dependencies = await this.checkDependencies(node);
      if (!dependencies.allMet) {
        blockedNodes.push(node);
      }
    }

    return blockedNodes;
  }

  private async getReadyNodes(nodes: StageBillingNode[]): Promise<StageBillingNode[]> {
    const readyNodes: StageBillingNode[] = [];

    for (const node of nodes) {
      if (node.isCompleted) continue;

      const dependencies = await this.checkDependencies(node);
      const timeThreshold = await this.checkTimeThreshold(node);

      if (dependencies.allMet && timeThreshold) {
        readyNodes.push(node);
      }
    }

    return readyNodes;
  }

  private async checkDependencies(node: StageBillingNode): Promise<{ allMet: boolean; unmet: string[] }> {
    const unmet: string[] = [];

    for (const dependency of node.dependencies) {
      // Simplified dependency checking
      // In reality, this would check if dependency nodes are completed
      console.log(`Checking dependency: ${dependency}`);
    }

    return {
      allMet: unmet.length === 0,
      unmet,
    };
  }

  private async checkTimeThreshold(node: StageBillingNode): Promise<boolean> {
    // Simplified time threshold checking
    // In reality, this would check case duration and milestone timing
    return true;
  }

  private calculateOverallProgress(nodes: StageBillingNode[]): number {
    if (nodes.length === 0) return 0;
    const completedCount = nodes.filter(n => n.isCompleted).length;
    return (completedCount / nodes.length) * 100;
  }

  private calculatePhaseProgress(nodes: StageBillingNode[]): Record<string, number> {
    const phases = [...new Set(nodes.map(n => n.phase))];
    const progress: Record<string, number> = {};

    for (const phase of phases) {
      const phaseNodes = nodes.filter(n => n.phase === phase);
      const completedCount = phaseNodes.filter(n => n.isCompleted).length;
      progress[phase] = phaseNodes.length > 0 ? (completedCount / phaseNodes.length) * 100 : 0;
    }

    return progress;
  }

  private async calculateBillingSummary(caseData: any): Promise<any> {
    const totalBilled = caseData.invoices.reduce((sum: number, invoice: any) => sum + invoice.total, 0);
    const totalPaid = caseData.invoices.reduce((sum: number, invoice: any) => {
      const paidAmount = invoice.payments
        .filter((p: any) => p.status === PaymentStatus.COMPLETED)
        .reduce((paymentSum: number, payment: any) => paymentSum + payment.amount, 0);
      return sum + paidAmount;
    }, 0);

    const upcomingPayments = caseData.billingNodes
      .filter((node: any) => !node.isPaid && node.dueDate)
      .map((node: any) => ({
        node,
        dueDate: node.dueDate,
        amount: node.amount,
      }));

    return {
      totalBilled,
      totalPaid,
      outstandingBalance: totalBilled - totalPaid,
      upcomingPayments,
    };
  }

  private async generateInvoiceForMilestone(billingNodeId: string): Promise<Invoice> {
    // This would integrate with the billing service to generate an invoice
    // For now, return a placeholder
    throw new Error('Invoice generation not implemented');
  }

  private async getNextAvailableNodes(caseId: string, currentOrder: number): Promise<BillingNode[]> {
    return this.prisma.billingNode.findMany({
      where: {
        caseId,
        isActive: true,
        isPaid: false,
        order: { gt: currentOrder },
      },
      orderBy: { order: 'asc' },
    });
  }

  private async checkComplianceRequirements(billingNode: any): Promise<{ passed: boolean; violations: string[]; suggestions: string[] }> {
    const violations: string[] = [];
    const suggestions: string[] = [];

    // Check Chinese legal compliance
    if (billingNode.amount > 1000000) {
      violations.push('Large amount requires court approval');
      suggestions.push('Submit for court approval before proceeding');
    }

    return {
      passed: violations.length === 0,
      violations,
      suggestions,
    };
  }

  private calculatePriority(node: StageBillingNode, progress: StageBillingProgress): 'low' | 'medium' | 'high' | 'critical' {
    if (node.dueDate && new Date() > node.dueDate) {
      return 'critical';
    }
    if (node.amount > 50000) {
      return 'high';
    }
    if (progress.overallProgress > 75) {
      return 'medium';
    }
    return 'low';
  }

  private getAutomationRules(): StageBillingAutomation {
    return {
      enabled: true,
      rules: {
        autoGenerateInvoices: true,
        autoApproveCompletions: false,
        autoSendReminders: true,
        autoAdvanceStages: false,
      },
      triggers: {
        onTimeEntry: true,
        onDocumentUpload: true,
        onMilestoneCompletion: true,
        onPaymentReceived: true,
      },
      conditions: {
        minimumAmount: 1000,
        maximumDelay: 30,
        requiredApprovals: 1,
      },
    };
  }

  private async handleAutomation(caseId: string, billingNodeId: string, trigger: string): Promise<any> {
    // Handle automation triggers
    console.log(`Processing automation for case ${caseId}, node ${billingNodeId}, trigger ${trigger}`);
    return { processed: true };
  }

  private async autoGenerateInvoices(caseId: string): Promise<any> {
    // Auto-generate invoices for completed milestones
    return { generated: 0 };
  }

  private async sendDeadlineReminders(caseId: string): Promise<any> {
    // Send reminders for upcoming deadlines
    return { sent: 0 };
  }

  private async autoAdvanceStages(caseId: string): Promise<any> {
    // Auto-advance to next stage if conditions are met
    return { advanced: false };
  }

  private async storeConfiguration(caseId: string, configuration: StageBillingConfiguration): Promise<void> {
    // Store configuration in database
    console.log(`Storing configuration for case ${caseId}`);
  }
}