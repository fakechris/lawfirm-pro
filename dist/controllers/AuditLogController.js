"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogController = void 0;
const AuditLogModel_1 = require("../models/AuditLogModel");
class AuditLogController {
    static async getAllAuditLogs(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const userId = req.query.userId;
            const action = req.query.action;
            const resource = req.query.resource;
            const resourceId = req.query.resourceId;
            const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
            const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
            const result = await AuditLogModel_1.AuditLogModel.findAll(page, limit, {
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
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getAuditLogById(req, res) {
        try {
            const { id } = req.params;
            const auditLog = await AuditLogModel_1.AuditLogModel.findById(id);
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
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getUserActivity(req, res) {
        try {
            const { userId } = req.params;
            const limit = parseInt(req.query.limit) || 50;
            const activity = await AuditLogModel_1.AuditLogModel.getUserActivity(userId, limit);
            res.json({
                success: true,
                data: activity,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getResourceActivity(req, res) {
        try {
            const { resource } = req.params;
            const { resourceId } = req.query;
            const limit = parseInt(req.query.limit) || 50;
            if (!resourceId) {
                res.status(400).json({
                    success: false,
                    error: 'Resource ID is required',
                });
                return;
            }
            const activity = await AuditLogModel_1.AuditLogModel.getResourceActivity(resource, resourceId, limit);
            res.json({
                success: true,
                data: activity,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getActionStats(req, res) {
        try {
            const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
            const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
            const stats = await AuditLogModel_1.AuditLogModel.getActionStats(startDate, endDate);
            res.json({
                success: true,
                data: stats,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getResourceStats(req, res) {
        try {
            const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
            const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
            const stats = await AuditLogModel_1.AuditLogModel.getResourceStats(startDate, endDate);
            res.json({
                success: true,
                data: stats,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getUserStats(req, res) {
        try {
            const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
            const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
            const stats = await AuditLogModel_1.AuditLogModel.getUserStats(startDate, endDate);
            res.json({
                success: true,
                data: stats,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async getAuditDashboard(req, res) {
        try {
            const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
            const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
            const [actionStats, resourceStats, userStats] = await Promise.all([
                AuditLogModel_1.AuditLogModel.getActionStats(startDate, endDate),
                AuditLogModel_1.AuditLogModel.getResourceStats(startDate, endDate),
                AuditLogModel_1.AuditLogModel.getUserStats(startDate, endDate),
            ]);
            res.json({
                success: true,
                data: {
                    actions: actionStats,
                    resources: resourceStats,
                    users: userStats,
                },
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
    static async cleanupAuditLogs(req, res) {
        try {
            const { olderThanDays = 90 } = req.body;
            const deletedCount = await AuditLogModel_1.AuditLogModel.cleanup(olderThanDays);
            res.json({
                success: true,
                data: {
                    deletedCount,
                    olderThanDays,
                },
                message: `Cleaned up ${deletedCount} audit logs older than ${olderThanDays} days`,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
}
exports.AuditLogController = AuditLogController;
//# sourceMappingURL=AuditLogController.js.map