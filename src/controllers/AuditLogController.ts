import { Request, Response } from 'express';
import { AuditLogModel } from '../models/AuditLogModel';

export class AuditLogController {
  /**
   * Get all audit logs with pagination and filtering
   */
  static async getAllAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const userId = req.query.userId as string;
      const action = req.query.action as string;
      const resource = req.query.resource as string;
      const resourceId = req.query.resourceId as string;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const result = await AuditLogModel.findAll(page, limit, {
        userId,
        action,
        resource,
        resourceId,
        startDate,
        endDate,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get audit log by ID
   */
  static async getAuditLogById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const auditLog = await AuditLogModel.findById(id);
      if (!auditLog) {
        res.status(404).json({
          success: false,
          error: 'Audit log not found',
        });
        return;
      }

      res.json({
        success: true,
        data: auditLog,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get user activity logs
   */
  static async getUserActivity(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      const activity = await AuditLogModel.getUserActivity(userId, limit);

      res.json({
        success: true,
        data: activity,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get resource activity logs
   */
  static async getResourceActivity(req: Request, res: Response): Promise<void> {
    try {
      const { resource } = req.params;
      const { resourceId } = req.query;
      const limit = parseInt(req.query.limit as string) || 50;

      if (!resourceId) {
        res.status(400).json({
          success: false,
          error: 'Resource ID is required',
        });
        return;
      }

      const activity = await AuditLogModel.getResourceActivity(resource, resourceId as string, limit);

      res.json({
        success: true,
        data: activity,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get action statistics
   */
  static async getActionStats(req: Request, res: Response): Promise<void> {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const stats = await AuditLogModel.getActionStats(startDate, endDate);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get resource statistics
   */
  static async getResourceStats(req: Request, res: Response): Promise<void> {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const stats = await AuditLogModel.getResourceStats(startDate, endDate);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get user statistics
   */
  static async getUserStats(req: Request, res: Response): Promise<void> {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const stats = await AuditLogModel.getUserStats(startDate, endDate);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get audit dashboard data
   */
  static async getAuditDashboard(req: Request, res: Response): Promise<void> {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const [actionStats, resourceStats, userStats] = await Promise.all([
        AuditLogModel.getActionStats(startDate, endDate),
        AuditLogModel.getResourceStats(startDate, endDate),
        AuditLogModel.getUserStats(startDate, endDate),
      ]);

      res.json({
        success: true,
        data: {
          actions: actionStats,
          resources: resourceStats,
          users: userStats,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Cleanup old audit logs
   */
  static async cleanupAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const { olderThanDays = 90 } = req.body;

      const deletedCount = await AuditLogModel.cleanup(olderThanDays);

      res.json({
        success: true,
        data: {
          deletedCount,
          olderThanDays,
        },
        message: `Cleaned up ${deletedCount} audit logs older than ${olderThanDays} days`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  }
}