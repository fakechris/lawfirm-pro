"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaseController = void 0;
const tsyringe_1 = require("tsyringe");
const case_1 = require("../services/case");
const audit_1 = require("../middleware/audit");
const client_1 = require("@prisma/client");
class CaseController {
    constructor() {
        this.caseService = tsyringe_1.container.resolve(case_1.CaseService);
    }
    async createCase(req, res) {
        try {
            const userId = req.user.id;
            const caseRequest = req.body;
            if (!caseRequest.title || !caseRequest.caseType || !caseRequest.clientId) {
                res.status(400).json({
                    success: false,
                    message: 'Title, case type, and client ID are required',
                });
                return;
            }
            const attorneyProfile = await this.caseService['db'].client.attorneyProfile.findUnique({
                where: { userId }
            });
            if (!attorneyProfile) {
                res.status(404).json({
                    success: false,
                    message: 'Attorney profile not found',
                });
                return;
            }
            const result = await this.caseService.createCase(caseRequest, attorneyProfile.id);
            await audit_1.AuditMiddleware.createAuditLog(req, 'CASE_CREATE', 'case', result.id, null, {
                title: result.title,
                caseType: result.caseType,
                clientId: result.clientId
            });
            res.status(201).json({
                success: true,
                data: result,
                message: 'Case created successfully',
            });
        }
        catch (error) {
            console.error('Create case error:', error);
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to create case',
            });
        }
    }
    async getClientCases(req, res) {
        try {
            const userId = req.user.id;
            const userRole = req.user.role;
            if (userRole !== client_1.UserRole.CLIENT) {
                res.status(403).json({
                    success: false,
                    message: 'Access denied. Client access required.',
                });
                return;
            }
            const clientProfile = await this.caseService['db'].client.clientProfile.findUnique({
                where: { userId }
            });
            if (!clientProfile) {
                res.status(404).json({
                    success: false,
                    message: 'Client profile not found',
                });
                return;
            }
            const cases = await this.caseService.getCasesByClientId(clientProfile.id);
            res.json({
                success: true,
                data: cases,
                message: 'Cases retrieved successfully',
            });
        }
        catch (error) {
            console.error('Get client cases error:', error);
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to retrieve cases',
            });
        }
    }
    async getAttorneyCases(req, res) {
        try {
            const userId = req.user.id;
            const userRole = req.user.role;
            if (userRole !== client_1.UserRole.ATTORNEY) {
                res.status(403).json({
                    success: false,
                    message: 'Access denied. Attorney access required.',
                });
                return;
            }
            const attorneyProfile = await this.caseService['db'].client.attorneyProfile.findUnique({
                where: { userId }
            });
            if (!attorneyProfile) {
                res.status(404).json({
                    success: false,
                    message: 'Attorney profile not found',
                });
                return;
            }
            const cases = await this.caseService.getCasesByAttorneyId(attorneyProfile.id);
            res.json({
                success: true,
                data: cases,
                message: 'Cases retrieved successfully',
            });
        }
        catch (error) {
            console.error('Get attorney cases error:', error);
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to retrieve cases',
            });
        }
    }
    async getCaseById(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const userRole = req.user.role;
            const caseResponse = await this.caseService.getCaseById(id, userId, userRole);
            res.json({
                success: true,
                data: caseResponse,
                message: 'Case retrieved successfully',
            });
        }
        catch (error) {
            console.error('Get case error:', error);
            res.status(404).json({
                success: false,
                message: error instanceof Error ? error.message : 'Case not found',
            });
        }
    }
    async updateCaseStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const userId = req.user.id;
            const userRole = req.user.role;
            if (!status) {
                res.status(400).json({
                    success: false,
                    message: 'Status is required',
                });
                return;
            }
            const oldCase = await this.caseService['db'].client.case.findUnique({
                where: { id },
                select: { status: true }
            });
            const result = await this.caseService.updateCaseStatus(id, status, userId, userRole);
            await audit_1.AuditMiddleware.createAuditLog(req, 'CASE_STATUS_UPDATE', 'case', id, { status: oldCase?.status }, { status: result.status });
            res.json({
                success: true,
                data: result,
                message: 'Case status updated successfully',
            });
        }
        catch (error) {
            console.error('Update case status error:', error);
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to update case status',
            });
        }
    }
    async updateCasePhase(req, res) {
        try {
            const { id } = req.params;
            const { phase } = req.body;
            const userId = req.user.id;
            const userRole = req.user.role;
            if (!phase) {
                res.status(400).json({
                    success: false,
                    message: 'Phase is required',
                });
                return;
            }
            const oldCase = await this.caseService['db'].client.case.findUnique({
                where: { id },
                select: { phase: true }
            });
            const result = await this.caseService.updateCasePhase(id, phase, userId, userRole);
            await audit_1.AuditMiddleware.createAuditLog(req, 'CASE_PHASE_UPDATE', 'case', id, { phase: oldCase?.phase }, { phase: result.phase });
            res.json({
                success: true,
                data: result,
                message: 'Case phase updated successfully',
            });
        }
        catch (error) {
            console.error('Update case phase error:', error);
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to update case phase',
            });
        }
    }
    async getClientDashboard(req, res) {
        try {
            const userId = req.user.id;
            const userRole = req.user.role;
            if (userRole !== client_1.UserRole.CLIENT) {
                res.status(403).json({
                    success: false,
                    message: 'Access denied. Client access required.',
                });
                return;
            }
            const clientProfile = await this.caseService['db'].client.clientProfile.findUnique({
                where: { userId }
            });
            if (!clientProfile) {
                res.status(404).json({
                    success: false,
                    message: 'Client profile not found',
                });
                return;
            }
            const dashboard = await this.caseService.getClientDashboard(clientProfile.id);
            res.json({
                success: true,
                data: dashboard,
                message: 'Client dashboard retrieved successfully',
            });
        }
        catch (error) {
            console.error('Get client dashboard error:', error);
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to retrieve client dashboard',
            });
        }
    }
    async getAttorneyDashboard(req, res) {
        try {
            const userId = req.user.id;
            const userRole = req.user.role;
            if (userRole !== client_1.UserRole.ATTORNEY) {
                res.status(403).json({
                    success: false,
                    message: 'Access denied. Attorney access required.',
                });
                return;
            }
            const attorneyProfile = await this.caseService['db'].client.attorneyProfile.findUnique({
                where: { userId }
            });
            if (!attorneyProfile) {
                res.status(404).json({
                    success: false,
                    message: 'Attorney profile not found',
                });
                return;
            }
            const dashboard = await this.caseService.getAttorneyDashboard(attorneyProfile.id);
            res.json({
                success: true,
                data: dashboard,
                message: 'Attorney dashboard retrieved successfully',
            });
        }
        catch (error) {
            console.error('Get attorney dashboard error:', error);
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to retrieve attorney dashboard',
            });
        }
    }
    async getCaseStats(req, res) {
        try {
            const userId = req.user.id;
            const userRole = req.user.role;
            let stats;
            if (userRole === client_1.UserRole.CLIENT) {
                const clientProfile = await this.caseService['db'].client.clientProfile.findUnique({
                    where: { userId }
                });
                if (!clientProfile) {
                    res.status(404).json({
                        success: false,
                        message: 'Client profile not found',
                    });
                    return;
                }
                stats = await this.getClientCaseStats(clientProfile.id);
            }
            else if (userRole === client_1.UserRole.ATTORNEY) {
                const attorneyProfile = await this.caseService['db'].client.attorneyProfile.findUnique({
                    where: { userId }
                });
                if (!attorneyProfile) {
                    res.status(404).json({
                        success: false,
                        message: 'Attorney profile not found',
                    });
                    return;
                }
                stats = await this.getAttorneyCaseStats(attorneyProfile.id);
            }
            else {
                res.status(403).json({
                    success: false,
                    message: 'Access denied',
                });
                return;
            }
            res.json({
                success: true,
                data: stats,
                message: 'Case statistics retrieved successfully',
            });
        }
        catch (error) {
            console.error('Get case stats error:', error);
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to retrieve case statistics',
            });
        }
    }
    async getClientCaseStats(clientId) {
        const cases = await this.caseService['db'].client.case.findMany({
            where: { clientId },
        });
        const stats = {
            total: cases.length,
            active: cases.filter(c => c.status === 'ACTIVE').length,
            pending: cases.filter(c => c.status === 'PENDING').length,
            completed: cases.filter(c => c.status === 'COMPLETED').length,
            closed: cases.filter(c => c.status === 'CLOSED').length,
            byType: {},
            byPhase: {},
        };
        cases.forEach(caseItem => {
            stats.byType[caseItem.caseType] = (stats.byType[caseItem.caseType] || 0) + 1;
            stats.byPhase[caseItem.phase] = (stats.byPhase[caseItem.phase] || 0) + 1;
        });
        return stats;
    }
    async getAttorneyCaseStats(attorneyId) {
        const cases = await this.caseService['db'].client.case.findMany({
            where: { attorneyId },
        });
        const stats = {
            total: cases.length,
            active: cases.filter(c => c.status === 'ACTIVE').length,
            pending: cases.filter(c => c.status === 'PENDING').length,
            completed: cases.filter(c => c.status === 'COMPLETED').length,
            closed: cases.filter(c => c.status === 'CLOSED').length,
            byType: {},
            byPhase: {},
        };
        cases.forEach(caseItem => {
            stats.byType[caseItem.caseType] = (stats.byType[caseItem.caseType] || 0) + 1;
            stats.byPhase[caseItem.phase] = (stats.byPhase[caseItem.phase] || 0) + 1;
        });
        return stats;
    }
}
exports.CaseController = CaseController;
//# sourceMappingURL=case.js.map