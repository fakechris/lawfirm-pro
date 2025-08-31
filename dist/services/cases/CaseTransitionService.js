"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaseTransitionService = void 0;
const tsyringe_1 = require("tsyringe");
const database_1 = require("../../utils/database");
const client_1 = require("@prisma/client");
const StateMachine_1 = require("./StateMachine");
const CaseLifecycleService_1 = require("./CaseLifecycleService");
const PhaseValidator_1 = require("./validators/PhaseValidator");
const CaseTypeValidator_1 = require("./validators/CaseTypeValidator");
let CaseTransitionService = class CaseTransitionService {
    constructor(db) {
        this.db = db;
        this.stateMachine = new StateMachine_1.StateMachine();
        this.lifecycleService = new CaseLifecycleService_1.CaseLifecycleService(db);
        this.phaseValidator = new PhaseValidator_1.PhaseValidator();
        this.caseTypeValidator = new CaseTypeValidator_1.CaseTypeValidator();
    }
    async requestTransition(request) {
        try {
            const currentCase = await this.getCurrentCase(request.caseId);
            if (!currentCase) {
                return {
                    success: false,
                    message: 'Case not found',
                    errors: ['Case not found']
                };
            }
            const requiresApproval = await this.requiresApproval(currentCase, request.targetPhase, request.userRole);
            if (requiresApproval) {
                return await this.createApprovalRequest(currentCase, request);
            }
            return await this.executeTransition(currentCase, request);
        }
        catch (error) {
            console.error('Error in requestTransition:', error);
            return {
                success: false,
                message: 'Internal server error',
                errors: [error instanceof Error ? error.message : 'Unknown error']
            };
        }
    }
    async executeTransition(currentCase, request) {
        const currentState = {
            phase: currentCase.phase,
            status: currentCase.status,
            caseType: currentCase.caseType,
            metadata: currentCase.metadata || {}
        };
        const stateMachineResult = this.stateMachine.canTransition(currentState, request.targetPhase, request.userRole, request.metadata);
        if (!stateMachineResult.success) {
            return {
                success: false,
                message: stateMachineResult.message || 'Transition not allowed',
                errors: stateMachineResult.errors
            };
        }
        const phaseValidation = await this.phaseValidator.validatePhaseTransition(currentCase, request.targetPhase, request.metadata);
        if (!phaseValidation.isValid) {
            return {
                success: false,
                message: 'Phase validation failed',
                errors: phaseValidation.errors,
                warnings: phaseValidation.warnings
            };
        }
        const caseTypeValidation = await this.caseTypeValidator.validateCaseTypeTransition(currentCase.caseType, currentCase.phase, request.targetPhase, request.metadata);
        if (!caseTypeValidation.isValid) {
            return {
                success: false,
                message: 'Case type validation failed',
                errors: caseTypeValidation.errors,
                warnings: caseTypeValidation.warnings,
                recommendations: caseTypeValidation.recommendations
            };
        }
        const lifecycleResult = await this.lifecycleService.transitionToPhase(request.caseId, request.targetPhase, request.userId, request.userRole, request.metadata);
        if (!lifecycleResult.success) {
            return {
                success: false,
                message: 'Phase transition failed',
                errors: lifecycleResult.errors
            };
        }
        if (request.targetStatus && request.targetStatus !== currentCase.status) {
            try {
                await this.lifecycleService.updateCaseStatus(request.caseId, request.targetStatus, request.userId, request.reason);
            }
            catch (error) {
                return {
                    success: false,
                    message: 'Status update failed',
                    errors: [error instanceof Error ? error.message : 'Status update failed']
                };
            }
        }
        const transitionRecord = await this.recordTransitionHistory(currentCase, request);
        await this.createTransitionNotifications(currentCase, request, transitionRecord.id);
        await this.executePostTransitionLogic(currentCase, request);
        return {
            success: true,
            message: `Successfully transitioned case from ${currentCase.phase} to ${request.targetPhase}`,
            transitionId: transitionRecord.id,
            events: lifecycleResult.events,
            warnings: [
                ...(phaseValidation.warnings || []),
                ...(caseTypeValidation.warnings || [])
            ],
            recommendations: caseTypeValidation.recommendations
        };
    }
    async approveTransition(transitionId, approvedBy, approvedByRole, reason) {
        try {
            const approvalRequest = await this.db.client.transitionApproval.findUnique({
                where: { id: transitionId },
                include: {
                    case: true
                }
            });
            if (!approvalRequest) {
                return {
                    success: false,
                    message: 'Approval request not found',
                    errors: ['Approval request not found']
                };
            }
            if (approvalRequest.status !== 'PENDING') {
                return {
                    success: false,
                    message: `Approval request already ${approvalRequest.status.toLowerCase()}`,
                    errors: [`Approval request already ${approvalRequest.status.toLowerCase()}`]
                };
            }
            await this.db.client.transitionApproval.update({
                where: { id: transitionId },
                data: {
                    status: 'APPROVED',
                    approvedBy,
                    approvedByRole,
                    reason,
                    decidedAt: new Date()
                }
            });
            const transitionRequest = {
                caseId: approvalRequest.caseId,
                targetPhase: approvalRequest.targetPhase,
                targetStatus: approvalRequest.targetStatus,
                userId: approvalRequest.requestedBy,
                userRole: approvalRequest.requestedByRole,
                reason: approvalRequest.reason,
                metadata: approvalRequest.metadata
            };
            return await this.executeTransition(approvalRequest.case, transitionRequest);
        }
        catch (error) {
            console.error('Error in approveTransition:', error);
            return {
                success: false,
                message: 'Internal server error',
                errors: [error instanceof Error ? error.message : 'Unknown error']
            };
        }
    }
    async rejectTransition(transitionId, approvedBy, approvedByRole, reason) {
        try {
            const approvalRequest = await this.db.client.transitionApproval.findUnique({
                where: { id: transitionId }
            });
            if (!approvalRequest) {
                return {
                    success: false,
                    message: 'Approval request not found',
                    errors: ['Approval request not found']
                };
            }
            if (approvalRequest.status !== 'PENDING') {
                return {
                    success: false,
                    message: `Approval request already ${approvalRequest.status.toLowerCase()}`,
                    errors: [`Approval request already ${approvalRequest.status.toLowerCase()}`]
                };
            }
            await this.db.client.transitionApproval.update({
                where: { id: transitionId },
                data: {
                    status: 'REJECTED',
                    approvedBy,
                    approvedByRole,
                    reason,
                    decidedAt: new Date()
                }
            });
            await this.db.client.transitionNotification.create({
                data: {
                    caseId: approvalRequest.caseId,
                    transitionId,
                    recipientId: approvalRequest.requestedBy,
                    recipientRole: approvalRequest.requestedByRole,
                    message: `Your transition request was rejected: ${reason}`,
                    type: 'APPROVAL_REQUIRED',
                    isRead: false
                }
            });
            return {
                success: true,
                message: 'Transition request rejected successfully'
            };
        }
        catch (error) {
            console.error('Error in rejectTransition:', error);
            return {
                success: false,
                message: 'Internal server error',
                errors: [error instanceof Error ? error.message : 'Unknown error']
            };
        }
    }
    async getTransitionHistory(caseId) {
        const transitions = await this.db.client.caseTransition.findMany({
            where: { caseId },
            include: {
                user: true
            },
            orderBy: { timestamp: 'desc' }
        });
        return transitions.map(transition => ({
            id: transition.id,
            caseId: transition.caseId,
            fromPhase: transition.fromPhase,
            toPhase: transition.toPhase,
            fromStatus: transition.fromStatus,
            toStatus: transition.toStatus,
            userId: transition.userId,
            userRole: transition.userRole,
            reason: transition.reason,
            timestamp: transition.timestamp,
            metadata: transition.metadata
        }));
    }
    async getAvailableTransitions(caseId, userRole) {
        const currentCase = await this.getCurrentCase(caseId);
        if (!currentCase) {
            return [];
        }
        const currentState = {
            phase: currentCase.phase,
            status: currentCase.status,
            caseType: currentCase.caseType,
            metadata: currentCase.metadata || {}
        };
        return this.stateMachine.getAvailableTransitions(currentState, userRole);
    }
    async getPendingApprovals(userId, userRole) {
        const approvals = await this.db.client.transitionApproval.findMany({
            where: {
                status: 'PENDING',
            },
            include: {
                case: {
                    include: {
                        client: { include: { user: true } },
                        attorney: { include: { user: true } }
                    }
                },
                requestedByUser: true
            },
            orderBy: { createdAt: 'desc' }
        });
        return approvals.map(approval => ({
            id: approval.id,
            transitionId: approval.id,
            caseId: approval.caseId,
            requestedBy: approval.requestedBy,
            requestedByRole: approval.requestedByRole,
            approvedBy: approval.approvedBy,
            approvedByRole: approval.approvedByRole,
            status: approval.status,
            reason: approval.reason,
            createdAt: approval.createdAt,
            decidedAt: approval.decidedAt
        }));
    }
    async getNotifications(userId, userRole) {
        const notifications = await this.db.client.transitionNotification.findMany({
            where: {
                recipientId: userId,
                recipientRole: userRole
            },
            orderBy: { createdAt: 'desc' }
        });
        return notifications.map(notification => ({
            id: notification.id,
            caseId: notification.caseId,
            transitionId: notification.transitionId,
            recipientId: notification.recipientId,
            recipientRole: notification.recipientRole,
            message: notification.message,
            type: notification.type,
            isRead: notification.isRead,
            createdAt: notification.createdAt,
            readAt: notification.readAt
        }));
    }
    async markNotificationAsRead(notificationId) {
        await this.db.client.transitionNotification.update({
            where: { id: notificationId },
            data: { isRead: true, readAt: new Date() }
        });
    }
    async getCurrentCase(caseId) {
        return await this.db.client.case.findUnique({
            where: { id: caseId }
        });
    }
    async requiresApproval(currentCase, targetPhase, userRole) {
        const approvalRules = {
            [client_1.CaseType.CRIMINAL_DEFENSE]: {
                [client_1.CasePhase.FORMAL_PROCEEDINGS]: [client_1.UserRole.ADMIN],
                [client_1.CasePhase.RESOLUTION_POST_PROCEEDING]: [client_1.UserRole.ADMIN]
            },
            [client_1.CaseType.MEDICAL_MALPRACTICE]: {
                [client_1.CasePhase.PRE_PROCEEDING_PREPARATION]: [client_1.UserRole.ADMIN],
                [client_1.CasePhase.FORMAL_PROCEEDINGS]: [client_1.UserRole.ADMIN]
            },
            [client_1.CaseType.DIVORCE_FAMILY]: {
                [client_1.CasePhase.FORMAL_PROCEEDINGS]: [client_1.UserRole.ADMIN]
            }
        };
        const caseTypeRules = approvalRules[currentCase.caseType];
        if (!caseTypeRules)
            return false;
        const requiredRoles = caseTypeRules[targetPhase];
        if (!requiredRoles)
            return false;
        return !requiredRoles.includes(userRole);
    }
    async createApprovalRequest(currentCase, request) {
        const approval = await this.db.client.transitionApproval.create({
            data: {
                caseId: request.caseId,
                targetPhase: request.targetPhase,
                targetStatus: request.targetStatus,
                requestedBy: request.userId,
                requestedByRole: request.userRole,
                reason: request.reason,
                metadata: request.metadata,
                status: 'PENDING'
            }
        });
        await this.createApprovalNotifications(currentCase, approval.id);
        return {
            success: true,
            message: 'Transition approval request created successfully',
            transitionId: approval.id
        };
    }
    async createApprovalNotifications(currentCase, approvalId) {
        const approvers = await this.db.client.user.findMany({
            where: {
                role: client_1.UserRole.ADMIN
            }
        });
        for (const approver of approvers) {
            await this.db.client.transitionNotification.create({
                data: {
                    caseId: currentCase.id,
                    transitionId: approvalId,
                    recipientId: approver.id,
                    recipientRole: approver.role,
                    message: `Transition approval required for case ${currentCase.title}`,
                    type: 'APPROVAL_REQUIRED',
                    isRead: false
                }
            });
        }
    }
    async recordTransitionHistory(currentCase, request) {
        return await this.db.client.caseTransition.create({
            data: {
                caseId: request.caseId,
                fromPhase: currentCase.phase,
                toPhase: request.targetPhase,
                fromStatus: currentCase.status,
                toStatus: request.targetStatus || currentCase.status,
                userId: request.userId,
                userRole: request.userRole,
                reason: request.reason,
                metadata: request.metadata
            }
        });
    }
    async createTransitionNotifications(currentCase, request, transitionId) {
        if (currentCase.attorneyId !== request.userId) {
            await this.db.client.transitionNotification.create({
                data: {
                    caseId: currentCase.id,
                    transitionId,
                    recipientId: currentCase.attorneyId,
                    recipientRole: client_1.UserRole.ATTORNEY,
                    message: `Case ${currentCase.title} transitioned to ${request.targetPhase}`,
                    type: 'PHASE_CHANGE',
                    isRead: false
                }
            });
        }
        if (currentCase.clientId !== request.userId) {
            await this.db.client.transitionNotification.create({
                data: {
                    caseId: currentCase.id,
                    transitionId,
                    recipientId: currentCase.clientId,
                    recipientRole: client_1.UserRole.CLIENT,
                    message: `Your case ${currentCase.title} has moved to ${request.targetPhase}`,
                    type: 'PHASE_CHANGE',
                    isRead: false
                }
            });
        }
    }
    async executePostTransitionLogic(currentCase, request) {
        const updatedMetadata = {
            ...(currentCase.metadata || {}),
            lastTransition: {
                timestamp: new Date(),
                fromPhase: currentCase.phase,
                toPhase: request.targetPhase,
                by: request.userId
            }
        };
        await this.db.client.case.update({
            where: { id: currentCase.id },
            data: {
                metadata: updatedMetadata
            }
        });
        await this.executeCaseTypePostTransitionLogic(currentCase, request);
    }
    async executeCaseTypePostTransitionLogic(currentCase, request) {
        switch (currentCase.caseType) {
            case client_1.CaseType.CRIMINAL_DEFENSE:
                if (request.targetPhase === client_1.CasePhase.FORMAL_PROCEEDINGS) {
                    await this.scheduleCriminalDefenseAppointments(currentCase.id);
                }
                break;
            case client_1.CaseType.MEDICAL_MALPRACTICE:
                if (request.targetPhase === client_1.CasePhase.PRE_PROCEEDING_PREPARATION) {
                    await this.scheduleMedicalExpertConsultations(currentCase.id);
                }
                break;
            case client_1.CaseType.DIVORCE_FAMILY:
                if (request.targetPhase === client_1.CasePhase.PRE_PROCEEDING_PREPARATION) {
                    await this.scheduleMediationSession(currentCase.id);
                }
                break;
        }
    }
    async scheduleCriminalDefenseAppointments(caseId) {
        await this.db.client.appointment.create({
            data: {
                caseId,
                title: 'Court Appearance - Arraignment',
                description: 'Initial court appearance for arraignment',
                startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
                status: 'SCHEDULED',
                attorneyId: (await this.db.client.case.findUnique({ where: { id: caseId } }))?.attorneyId || '',
                clientId: (await this.db.client.case.findUnique({ where: { id: caseId } }))?.clientId || ''
            }
        });
    }
    async scheduleMedicalExpertConsultations(caseId) {
        const caseData = await this.db.client.case.findUnique({ where: { id: caseId } });
        if (!caseData)
            return;
        await this.db.client.task.create({
            data: {
                title: 'Schedule Medical Expert Consultation',
                description: 'Arrange consultation with medical expert for case evaluation',
                caseId,
                assignedTo: caseData.attorneyId,
                assignedBy: caseData.attorneyId,
                dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                status: 'PENDING',
                priority: 'HIGH'
            }
        });
    }
    async scheduleMediationSession(caseId) {
        const caseData = await this.db.client.case.findUnique({ where: { id: caseId } });
        if (!caseData)
            return;
        await this.db.client.appointment.create({
            data: {
                caseId,
                title: 'Mediation Session',
                description: 'Court-ordered mediation session',
                startTime: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
                endTime: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
                status: 'SCHEDULED',
                attorneyId: caseData.attorneyId,
                clientId: caseData.clientId
            }
        });
    }
};
exports.CaseTransitionService = CaseTransitionService;
exports.CaseTransitionService = CaseTransitionService = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(database_1.Database)),
    __metadata("design:paramtypes", [database_1.Database])
], CaseTransitionService);
//# sourceMappingURL=CaseTransitionService.js.map