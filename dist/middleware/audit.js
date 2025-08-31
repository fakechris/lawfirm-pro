"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditMiddleware = void 0;
const tsyringe_1 = require("tsyringe");
const database_1 = require("../utils/database");
class AuditMiddleware {
    static async logAction(action, entityType, entityId, oldValues, newValues) {
        return async (req, res, next) => {
            const originalSend = res.send;
            const originalJson = res.json;
            res.send = function (data) {
                AuditMiddleware.createAuditLog(req, action, entityType, entityId, oldValues, newValues);
                return originalSend.call(this, data);
            };
            res.json = function (data) {
                AuditMiddleware.createAuditLog(req, action, entityType, entityId, oldValues, newValues);
                return originalJson.call(this, data);
            };
            next();
        };
    }
    static async createAuditLog(req, action, entityType, entityId, oldValues, newValues) {
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
        }
        catch (error) {
            console.error('Failed to create audit log:', error);
        }
    }
    static logUserAction(action, entityType) {
        return async (req, res, next) => {
            if (req.user) {
                await AuditMiddleware.createAuditLog(req, action, entityType);
            }
            next();
        };
    }
    static logDataModification(action, entityType) {
        return async (req, res, next) => {
            const originalSend = res.send;
            const originalJson = res.json;
            res.send = function (data) {
                if (req.user && req.params.id) {
                    AuditMiddleware.createAuditLog(req, action, entityType, req.params.id);
                }
                return originalSend.call(this, data);
            };
            res.json = function (data) {
                if (req.user && req.params.id) {
                    AuditMiddleware.createAuditLog(req, action, entityType, req.params.id);
                }
                return originalJson.call(this, data);
            };
            next();
        };
    }
}
exports.AuditMiddleware = AuditMiddleware;
AuditMiddleware.db = tsyringe_1.container.resolve(database_1.Database);
//# sourceMappingURL=audit.js.map