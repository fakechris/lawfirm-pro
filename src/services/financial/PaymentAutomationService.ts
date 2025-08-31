import { PrismaClient } from '@prisma/client';
import { PaymentService } from './PaymentService';
import { RefundService } from './RefundService';
import { PaymentReconciliationService } from './PaymentReconciliationService';
import { PaymentMethod, PaymentStatus } from '../models/financial';
import { getPaymentConfig } from '../../config/financial';

export interface PaymentAutomationConfig {
  enabled: boolean;
  reconciliation: {
    enabled: boolean;
    interval: number; // in minutes
    retryAttempts: number;
    retryDelay: number; // in minutes
  };
  scheduledPayments: {
    enabled: boolean;
    checkInterval: number; // in minutes
    advanceNotice: number; // in hours
  };
  statusMonitoring: {
    enabled: boolean;
    checkInterval: number; // in minutes
    stalePaymentThreshold: number; // in hours
  };
  refunds: {
    enabled: boolean;
    autoRefundFailed: boolean;
    expireCredits: boolean;
    checkInterval: number; // in minutes
  };
  notifications: {
    enabled: boolean;
    paymentSuccess: boolean;
    paymentFailed: boolean;
    paymentOverdue: boolean;
    refundProcessed: boolean;
    lowBalance: boolean;
  };
}

export class PaymentAutomationService {
  private prisma: PrismaClient;
  private paymentService: PaymentService;
  private refundService: RefundService;
  private reconciliationService: PaymentReconciliationService;
  private config: PaymentAutomationConfig;
  private timers: { [key: string]: NodeJS.Timeout } = {};

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.paymentService = new PaymentService(prisma);
    this.refundService = new RefundService(prisma);
    this.reconciliationService = new PaymentReconciliationService(prisma);
    this.config = this.loadConfig();
  }

  // Start all automation services
  async start(): Promise<void> {
    if (!this.config.enabled) {
      console.log('Payment automation is disabled');
      return;
    }

    console.log('Starting payment automation services...');

    // Start reconciliation automation
    if (this.config.reconciliation.enabled) {
      this.startReconciliationAutomation();
    }

    // Start scheduled payments automation
    if (this.config.scheduledPayments.enabled) {
      this.startScheduledPaymentsAutomation();
    }

    // Start status monitoring
    if (this.config.statusMonitoring.enabled) {
      this.startStatusMonitoring();
    }

    // Start refunds automation
    if (this.config.refunds.enabled) {
      this.startRefundsAutomation();
    }

    console.log('Payment automation services started successfully');
  }

  // Stop all automation services
  async stop(): Promise<void> {
    console.log('Stopping payment automation services...');

    // Clear all timers
    Object.values(this.timers).forEach(timer => {
      if (timer) {
        clearInterval(timer);
      }
    });
    this.timers = {};

    console.log('Payment automation services stopped');
  }

  // Start reconciliation automation
  private startReconciliationAutomation(): void {
    const interval = this.config.reconciliation.interval * 60 * 1000; // Convert to milliseconds

    this.timers.reconciliation = setInterval(async () => {
      try {
        await this.runReconciliationAutomation();
      } catch (error) {
        console.error('Reconciliation automation failed:', error);
      }
    }, interval);

    console.log(`Reconciliation automation started (interval: ${this.config.reconciliation.interval} minutes)`);
  }

  // Run reconciliation automation
  private async runReconciliationAutomation(): Promise<void> {
    console.log('Running reconciliation automation...');

    try {
      // Auto-reconcile pending payments
      await this.reconciliationService.autoReconcilePayments();

      // Generate daily reconciliation report
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      await this.reconciliationService.generateReconciliationReport({
        startDate: yesterday,
        endDate: today,
        autoMatch: true,
        generateReport: true,
      });

      console.log('Reconciliation automation completed');
    } catch (error) {
      console.error('Reconciliation automation error:', error);
    }
  }

  // Start scheduled payments automation
  private startScheduledPaymentsAutomation(): void {
    const interval = this.config.scheduledPayments.checkInterval * 60 * 1000; // Convert to milliseconds

    this.timers.scheduledPayments = setInterval(async () => {
      try {
        await this.runScheduledPaymentsAutomation();
      } catch (error) {
        console.error('Scheduled payments automation failed:', error);
      }
    }, interval);

    console.log(`Scheduled payments automation started (interval: ${this.config.scheduledPayments.checkInterval} minutes)`);
  }

  // Run scheduled payments automation
  private async runScheduledPaymentsAutomation(): Promise<void> {
    console.log('Running scheduled payments automation...');

    try {
      // Process scheduled payments
      await this.paymentService.processScheduledPayments();

      // Send advance notifications for upcoming scheduled payments
      await this.sendScheduledPaymentNotifications();

      console.log('Scheduled payments automation completed');
    } catch (error) {
      console.error('Scheduled payments automation error:', error);
    }
  }

  // Send notifications for upcoming scheduled payments
  private async sendScheduledPaymentNotifications(): Promise<void> {
    try {
      const advanceTime = new Date();
      advanceTime.setHours(advanceTime.getHours() + this.config.scheduledPayments.advanceNotice);

      const upcomingPayments = await this.prisma.scheduledPayment.findMany({
        where: {
          status: 'SCHEDULED',
          scheduleDate: {
            lte: advanceTime,
            gt: new Date(),
          },
          notified: false,
        },
      });

      for (const payment of upcomingPayments) {
        // Send notification (implement based on your notification system)
        await this.sendNotification({
          type: 'SCHEDULED_PAYMENT_REMINDER',
          recipient: payment.clientEmail,
          subject: 'Payment Reminder',
          message: `Your scheduled payment of ${payment.amount} will be processed on ${payment.scheduleDate}`,
          data: payment,
        });

        // Mark as notified
        await this.prisma.scheduledPayment.update({
          where: { id: payment.id },
          data: { notified: true },
        });
      }
    } catch (error) {
      console.error('Failed to send scheduled payment notifications:', error);
    }
  }

  // Start status monitoring
  private startStatusMonitoring(): void {
    const interval = this.config.statusMonitoring.checkInterval * 60 * 1000; // Convert to milliseconds

    this.timers.statusMonitoring = setInterval(async () => {
      try {
        await this.runStatusMonitoring();
      } catch (error) {
        console.error('Status monitoring failed:', error);
      }
    }, interval);

    console.log(`Status monitoring started (interval: ${this.config.statusMonitoring.checkInterval} minutes)`);
  }

  // Run status monitoring
  private async runStatusMonitoring(): Promise<void> {
    console.log('Running status monitoring...');

    try {
      // Check for stale payments
      await this.checkStalePayments();

      // Monitor payment success rates
      await this.monitorPaymentMetrics();

      // Check for payment anomalies
      await this.detectPaymentAnomalies();

      console.log('Status monitoring completed');
    } catch (error) {
      console.error('Status monitoring error:', error);
    }
  }

  // Check for stale payments
  private async checkStalePayments(): Promise<void> {
    try {
      const staleThreshold = new Date();
      staleThreshold.setHours(staleThreshold.getHours() - this.config.statusMonitoring.stalePaymentThreshold);

      const stalePayments = await this.prisma.payment.findMany({
        where: {
          status: PaymentStatus.PENDING,
          createdAt: {
            lt: staleThreshold,
          },
        },
      });

      for (const payment of stalePayments) {
        // Try to reconcile with gateway
        const result = await this.reconciliationService.reconcilePayment(payment);

        if (!result) {
          // Send alert for stale payment
          await this.sendNotification({
            type: 'STALE_PAYMENT_ALERT',
            recipient: 'admin', // Or appropriate recipient
            subject: 'Stale Payment Alert',
            message: `Payment ${payment.id} has been pending for too long`,
            data: payment,
          });
        }
      }
    } catch (error) {
      console.error('Failed to check stale payments:', error);
    }
  }

  // Monitor payment metrics
  private async monitorPaymentMetrics(): Promise<void> {
    try {
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [totalPayments, failedPayments, totalAmount] = await Promise.all([
        this.prisma.payment.count({
          where: {
            createdAt: { gte: last24Hours },
          },
        }),
        this.prisma.payment.count({
          where: {
            createdAt: { gte: last24Hours },
            status: PaymentStatus.FAILED,
          },
        }),
        this.prisma.payment.aggregate({
          where: {
            createdAt: { gte: last24Hours },
          },
          _sum: { amount: true },
        }),
      ]);

      const failureRate = totalPayments > 0 ? (failedPayments / totalPayments) * 100 : 0;

      // Send alert if failure rate is too high
      if (failureRate > 10) { // 10% threshold
        await this.sendNotification({
          type: 'HIGH_FAILURE_RATE_ALERT',
          recipient: 'admin',
          subject: 'High Payment Failure Rate',
          message: `Payment failure rate is ${failureRate.toFixed(2)}% in the last 24 hours`,
          data: {
            totalPayments,
            failedPayments,
            failureRate,
            totalAmount: totalAmount._sum.amount || 0,
          },
        });
      }
    } catch (error) {
      console.error('Failed to monitor payment metrics:', error);
    }
  }

  // Detect payment anomalies
  private async detectPaymentAnomalies(): Promise<void> {
    try {
      // Look for unusual patterns in payments
      const now = new Date();
      const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

      const recentPayments = await this.prisma.payment.findMany({
        where: {
          createdAt: { gte: lastHour },
        },
        orderBy: { amount: 'desc' },
        take: 10,
      });

      // Check for unusually large payments
      const avgAmount = recentPayments.reduce((sum, p) => sum + p.amount, 0) / recentPayments.length;
      const largePayments = recentPayments.filter(p => p.amount > avgAmount * 3);

      for (const payment of largePayments) {
        await this.sendNotification({
          type: 'LARGE_PAYMENT_ALERT',
          recipient: 'admin',
          subject: 'Large Payment Detected',
          message: `Unusually large payment detected: ${payment.amount}`,
          data: payment,
        });
      }
    } catch (error) {
      console.error('Failed to detect payment anomalies:', error);
    }
  }

  // Start refunds automation
  private startRefundsAutomation(): void {
    const interval = this.config.refunds.checkInterval * 60 * 1000; // Convert to milliseconds

    this.timers.refunds = setInterval(async () => {
      try {
        await this.runRefundsAutomation();
      } catch (error) {
        console.error('Refunds automation failed:', error);
      }
    }, interval);

    console.log(`Refunds automation started (interval: ${this.config.refunds.checkInterval} minutes)`);
  }

  // Run refunds automation
  private async runRefundsAutomation(): Promise<void> {
    console.log('Running refunds automation...');

    try {
      // Process automatic refunds
      if (this.config.refunds.autoRefundFailed) {
        await this.refundService.processAutomaticRefunds();
      }

      // Expire old credits
      if (this.config.refunds.expireCredits) {
        await this.refundService.expireOldCredits();
      }

      console.log('Refunds automation completed');
    } catch (error) {
      console.error('Refunds automation error:', error);
    }
  }

  // Send notification (placeholder implementation)
  private async sendNotification(notification: any): Promise<void> {
    try {
      console.log(`Sending notification: ${notification.type}`, notification);
      
      // Implement based on your notification system
      // This could be email, SMS, push notification, etc.
      
      if (this.config.notifications.enabled) {
        // Add notification logic here
      }
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  // Load automation configuration
  private loadConfig(): PaymentAutomationConfig {
    const paymentConfig = getPaymentConfig();
    
    return {
      enabled: paymentConfig.autoReconciliation || false,
      reconciliation: {
        enabled: paymentConfig.autoReconciliation || false,
        interval: 30, // 30 minutes
        retryAttempts: paymentConfig.processing?.retryAttempts || 3,
        retryDelay: 5, // 5 minutes
      },
      scheduledPayments: {
        enabled: true,
        checkInterval: 15, // 15 minutes
        advanceNotice: 24, // 24 hours
      },
      statusMonitoring: {
        enabled: true,
        checkInterval: 10, // 10 minutes
        stalePaymentThreshold: 24, // 24 hours
      },
      refunds: {
        enabled: true,
        autoRefundFailed: true,
        expireCredits: true,
        checkInterval: 60, // 60 minutes
      },
      notifications: {
        enabled: true,
        paymentSuccess: true,
        paymentFailed: true,
        paymentOverdue: true,
        refundProcessed: true,
        lowBalance: true,
      },
    };
  }

  // Get automation status
  getAutomationStatus(): any {
    return {
      enabled: this.config.enabled,
      running: Object.keys(this.timers).length > 0,
      services: {
        reconciliation: !!this.timers.reconciliation,
        scheduledPayments: !!this.timers.scheduledPayments,
        statusMonitoring: !!this.timers.statusMonitoring,
        refunds: !!this.timers.refunds,
      },
      config: this.config,
    };
  }

  // Update automation configuration
  updateConfig(newConfig: Partial<PaymentAutomationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart services if needed
    if (Object.keys(this.timers).length > 0) {
      this.stop();
      this.start();
    }
  }

  // Manually trigger reconciliation
  async triggerReconciliation(): Promise<void> {
    try {
      await this.runReconciliationAutomation();
    } catch (error) {
      console.error('Manual reconciliation failed:', error);
      throw error;
    }
  }

  // Manually trigger scheduled payments processing
  async triggerScheduledPayments(): Promise<void> {
    try {
      await this.runScheduledPaymentsAutomation();
    } catch (error) {
      console.error('Manual scheduled payments processing failed:', error);
      throw error;
    }
  }

  // Manually trigger status monitoring
  async triggerStatusMonitoring(): Promise<void> {
    try {
      await this.runStatusMonitoring();
    } catch (error) {
      console.error('Manual status monitoring failed:', error);
      throw error;
    }
  }

  // Manually trigger refunds processing
  async triggerRefunds(): Promise<void> {
    try {
      await this.runRefundsAutomation();
    } catch (error) {
      console.error('Manual refunds processing failed:', error);
      throw error;
    }
  }
}