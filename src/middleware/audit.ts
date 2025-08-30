import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { Database } from '../utils/database';
import { UserRole } from '@prisma/client';

export interface AuditedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

export class AuditMiddleware {
  private static db = container.resolve(Database);

  static async logAction(
    action: string,
    entityType: string,
    entityId?: string,
    oldValues?: any,
    newValues?: any
  ) {
    return async (req: AuditedRequest, res: Response, next: NextFunction) => {
      const originalSend = res.send;
      const originalJson = res.json;
      
      res.send = function(data) {
        AuditMiddleware.createAuditLog(req, action, entityType, entityId, oldValues, newValues);
        return originalSend.call(this, data);
      };
      
      res.json = function(data) {
        AuditMiddleware.createAuditLog(req, action, entityType, entityId, oldValues, newValues);
        return originalJson.call(this, data);
      };

      next();
    };
  }

  static async createAuditLog(
    req: AuditedRequest,
    action: string,
    entityType: string,
    entityId?: string,
    oldValues?: any,
    newValues?: any
  ) {
    try {
      await AuditMiddleware.db.client.auditLog.create({
        data: {
          action,
          entityType,
          entityId: entityId || 'unknown',
          userId: req.user?.id || 'anonymous',
          oldValues: oldValues || null,
          newValues: newValues || null,
          ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
        },
      });
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }
  }

  static logUserAction(action: string, entityType: string) {
    return async (req: AuditedRequest, res: Response, next: NextFunction) => {
      if (req.user) {
        await AuditMiddleware.createAuditLog(req, action, entityType);
      }
      next();
    };
  }

  static logDataModification(action: string, entityType: string) {
    return async (req: AuditedRequest, res: Response, next: NextFunction) => {
      const originalSend = res.send;
      const originalJson = res.json;
      
      res.send = function(data) {
        if (req.user && req.params.id) {
          AuditMiddleware.createAuditLog(req, action, entityType, req.params.id);
        }
        return originalSend.call(this, data);
      };
      
      res.json = function(data) {
        if (req.user && req.params.id) {
          AuditMiddleware.createAuditLog(req, action, entityType, req.params.id);
        }
        return originalJson.call(this, data);
      };

      next();
    };
  }
}