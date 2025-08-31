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
exports.CaseLifecycleService = void 0;
const tsyringe_1 = require("tsyringe");
const database_1 = require("../../utils/database");
const client_1 = require("@prisma/client");
const StateMachine_1 = require("./StateMachine");
const PhaseValidator_1 = require("./validators/PhaseValidator");
const CaseTypeValidator_1 = require("./validators/CaseTypeValidator");
let CaseLifecycleService = class CaseLifecycleService {
    constructor(db) {
        this.db = db;
        this.stateMachine = new StateMachine_1.StateMachine();
        this.phaseValidator = new PhaseValidator_1.PhaseValidator();
        this.caseTypeValidator = new CaseTypeValidator_1.CaseTypeValidator();
    }
    async initializeCaseLifecycle(caseId, caseType, userId) {
        const events = [];
        const initialEvent = {
            eventType: 'PHASE_ENTERED',
            phase: client_1.CasePhase.INTAKE_RISK_ASSESSMENT,
            status: client_1.CaseStatus.INTAKE,
            timestamp: new Date(),
            userId,
            description: `Case ${caseId} initialized in ${client_1.CasePhase.INTAKE_RISK_ASSESSMENT} phase`
        };
        events.push(initialEvent);
        await this.logLifecycleEvent(caseId, initialEvent);
        return events;
    }
    async transitionToPhase(caseId, targetPhase, userId, userRole, metadata) {
        const currentCase = await this.getCaseState(caseId);
        if (!currentCase) {
            return {
                success: false,
                events: [],
                errors: ['Case not found']
            };
        }
        const currentState = {
            phase: currentCase.phase,
            status: currentCase.status,
            caseType: currentCase.caseType,
            metadata: currentCase.metadata || {}
        };
        const transitionResult = this.stateMachine.canTransition(currentState, targetPhase, userRole, metadata);
        if (!transitionResult.success) {
            return {
                success: false,
                events: [],
                errors: transitionResult.errors
            };
        }
        const phaseValidation = await this.phaseValidator.validatePhaseTransition(currentCase, targetPhase, metadata);
        if (!phaseValidation.isValid) {
            return {
                success: false,
                events: [],
                errors: phaseValidation.errors
            };
        }
        const caseTypeValidation = await this.caseTypeValidator.validateCaseTypeTransition(currentCase.caseType, currentCase.phase, targetPhase, metadata);
        if (!caseTypeValidation.isValid) {
            return {
                success: false,
                events: [],
                errors: caseTypeValidation.errors
            };
        }
        const events = [];
        const exitEvent = {
            eventType: 'PHASE_COMPLETED',
            phase: currentCase.phase,
            timestamp: new Date(),
            userId,
            description: `Case ${caseId} completed ${currentCase.phase} phase`,
            metadata
        };
        events.push(exitEvent);
        await this.logLifecycleEvent(caseId, exitEvent);
        await this.updateCasePhase(caseId, targetPhase);
        const entryEvent = {
            eventType: 'PHASE_ENTERED',
            phase: targetPhase,
            timestamp: new Date(),
            userId,
            description: `Case ${caseId} entered ${targetPhase} phase`,
            metadata
        };
        events.push(entryEvent);
        await this.logLifecycleEvent(caseId, entryEvent);
        await this.executePhaseEntryLogic(caseId, targetPhase, userId);
        return {
            success: true,
            events
        };
    }
    async updateCaseStatus(caseId, newStatus, userId, reason) {
        const currentCase = await this.getCaseState(caseId);
        if (!currentCase) {
            throw new Error('Case not found');
        }
        const statusValidation = await this.phaseValidator.validateStatusTransition(currentCase.status, newStatus, currentCase.phase);
        if (!statusValidation.isValid) {
            throw new Error(`Invalid status transition: ${statusValidation.errors.join(', ')}`);
        }
        await this.db.client.case.update({
            where: { id: caseId },
            data: { status: newStatus }
        });
        const event = {
            eventType: 'STATUS_CHANGED',
            phase: currentCase.phase,
            status: newStatus,
            timestamp: new Date(),
            userId,
            description: `Case ${caseId} status changed from ${currentCase.status} to ${newStatus}${reason ? `: ${reason}` : ''}`
        };
        await this.logLifecycleEvent(caseId, event);
        return event;
    }
    async getCaseProgress(caseId) {
        const currentCase = await this.getCaseState(caseId);
        if (!currentCase) {
            throw new Error('Case not found');
        }
        const allPhases = Object.values(client_1.CasePhase);
        const currentPhaseIndex = allPhases.indexOf(currentCase.phase);
        const completedPhases = allPhases.slice(0, currentPhaseIndex);
        const progressPercentage = Math.round((currentPhaseIndex / (allPhases.length - 1)) * 100);
        const upcomingMilestones = await this.getUpcomingMilestones(caseId);
        const overdueTasks = await this.getOverdueTasks(caseId);
        const estimatedCompletion = await this.calculateEstimatedCompletion(caseId);
        return {
            currentPhase: currentCase.phase,
            currentStatus: currentCase.status,
            progressPercentage,
            completedPhases,
            upcomingMilestones,
            overdueTasks,
            estimatedCompletion
        };
    }
    async getPhaseRequirements(phase, caseType) {
        const requirements = this.stateMachine.getPhaseRequirements(phase, caseType);
        const phaseConfig = {
            [client_1.CasePhase.INTAKE_RISK_ASSESSMENT]: {
                phase: client_1.CasePhase.INTAKE_RISK_ASSESSMENT,
                requirements: ['clientInformation', 'caseDescription', 'initialEvidence', 'riskAssessment'],
                estimatedDuration: 7,
                criticalTasks: ['Initial consultation', 'Risk assessment', 'Document collection'],
                deliverables: ['Client intake form', 'Risk assessment report', 'Case file setup']
            },
            [client_1.CasePhase.PRE_PROCEEDING_PREPARATION]: {
                phase: client_1.CasePhase.PRE_PROCEEDING_PREPARATION,
                requirements: ['legalResearch', 'documentPreparation', 'witnessPreparation'],
                estimatedDuration: 30,
                criticalTasks: ['Legal research', 'Document preparation', 'Witness interviews'],
                deliverables: ['Legal research memo', 'Prepared documents', 'Witness statements']
            },
            [client_1.CasePhase.FORMAL_PROCEEDINGS]: {
                phase: client_1.CasePhase.FORMAL_PROCEEDINGS,
                requirements: ['courtFiling', 'evidenceSubmission', 'hearingPreparation'],
                estimatedDuration: 90,
                criticalTasks: ['File court documents', 'Submit evidence', 'Prepare for hearings'],
                deliverables: ['Court filings', 'Evidence packages', 'Hearing preparation']
            },
            [client_1.CasePhase.RESOLUTION_POST_PROCEEDING]: {
                phase: client_1.CasePhase.RESOLUTION_POST_PROCEEDING,
                requirements: ['judgmentAnalysis', 'settlementNegotiation', 'appealConsideration'],
                estimatedDuration: 30,
                criticalTasks: ['Analyze judgment', 'Negotiate settlement', 'Consider appeals'],
                deliverables: ['Judgment analysis', 'Settlement agreement', 'Appeal decision']
            },
            [client_1.CasePhase.CLOSURE_REVIEW_ARCHIVING]: {
                phase: client_1.CasePhase.CLOSURE_REVIEW_ARCHIVING,
                requirements: ['finalDocumentation', 'clientNotification', 'archivalPreparation'],
                estimatedDuration: 14,
                criticalTasks: ['Final documentation', 'Client notification', 'Case archival'],
                deliverables: ['Final case report', 'Client notification', 'Archived case file']
            }
        };
        const baseConfig = phaseConfig[phase];
        const caseTypeSpecificRequirements = this.getCaseTypeSpecificRequirements(caseType, phase);
        return {
            ...baseConfig,
            requirements: [...baseConfig.requirements, ...caseTypeSpecificRequirements]
        };
    }
    async getCaseState(caseId) {
        return await this.db.client.case.findUnique({
            where: { id: caseId }
        });
    }
    async logLifecycleEvent(caseId, event) {
        await this.db.client.caseLifecycleEvent.create({
            data: {
                caseId,
                eventType: event.eventType,
                phase: event.phase,
                status: event.status,
                timestamp: event.timestamp,
                userId: event.userId,
                description: event.description,
                metadata: event.metadata
            }
        });
    }
    async updateCasePhase(caseId, newPhase) {
        await this.db.client.case.update({
            where: { id: caseId },
            data: { phase: newPhase }
        });
    }
    async executePhaseEntryLogic(caseId, phase, userId) {
        switch (phase) {
            case client_1.CasePhase.INTAKE_RISK_ASSESSMENT:
                await this.executeIntakePhaseLogic(caseId, userId);
                break;
            case client_1.CasePhase.PRE_PROCEEDING_PREPARATION:
                await this.executePreparationPhaseLogic(caseId, userId);
                break;
            case client_1.CasePhase.FORMAL_PROCEEDINGS:
                await this.executeProceedingsPhaseLogic(caseId, userId);
                break;
            case client_1.CasePhase.RESOLUTION_POST_PROCEEDING:
                await this.executeResolutionPhaseLogic(caseId, userId);
                break;
            case client_1.CasePhase.CLOSURE_REVIEW_ARCHIVING:
                await this.executeClosurePhaseLogic(caseId, userId);
                break;
        }
    }
    async executeIntakePhaseLogic(caseId, userId) {
        await this.db.client.task.createMany({
            data: [
                {
                    title: 'Complete client intake form',
                    description: 'Gather all necessary client information and documentation',
                    caseId,
                    assignedTo: userId,
                    assignedBy: userId,
                    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
                    status: 'PENDING',
                    priority: 'HIGH'
                },
                {
                    title: 'Conduct risk assessment',
                    description: 'Assess case risks and determine viability',
                    caseId,
                    assignedTo: userId,
                    assignedBy: userId,
                    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                    status: 'PENDING',
                    priority: 'HIGH'
                }
            ]
        });
    }
    async executePreparationPhaseLogic(caseId, userId) {
        await this.db.client.task.createMany({
            data: [
                {
                    title: 'Complete legal research',
                    description: 'Research relevant laws and precedents',
                    caseId,
                    assignedTo: userId,
                    assignedBy: userId,
                    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                    status: 'PENDING',
                    priority: 'MEDIUM'
                },
                {
                    title: 'Prepare necessary documents',
                    description: 'Draft and prepare all required legal documents',
                    caseId,
                    assignedTo: userId,
                    assignedBy: userId,
                    dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
                    status: 'PENDING',
                    priority: 'MEDIUM'
                }
            ]
        });
    }
    async executeProceedingsPhaseLogic(caseId, userId) {
        await this.db.client.task.create({
            data: {
                title: 'Monitor court proceedings',
                description: 'Track and manage all court appearances and filings',
                caseId,
                assignedTo: userId,
                assignedBy: userId,
                dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
                status: 'PENDING',
                priority: 'MEDIUM'
            }
        });
    }
    async executeResolutionPhaseLogic(caseId, userId) {
        await this.db.client.task.create({
            data: {
                title: 'Finalize case resolution',
                description: 'Complete all post-proceeding requirements and documentation',
                caseId,
                assignedTo: userId,
                assignedBy: userId,
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                status: 'PENDING',
                priority: 'MEDIUM'
            }
        });
    }
    async executeClosurePhaseLogic(caseId, userId) {
        await this.db.client.case.update({
            where: { id: caseId },
            data: {
                status: client_1.CaseStatus.CLOSED,
                closedAt: new Date()
            }
        });
        await this.db.client.task.create({
            data: {
                title: 'Archive case file',
                description: 'Complete case archival and final documentation',
                caseId,
                assignedTo: userId,
                assignedBy: userId,
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                status: 'PENDING',
                priority: 'LOW'
            }
        });
    }
    async getUpcomingMilestones(caseId) {
        const tasks = await this.db.client.task.findMany({
            where: {
                caseId,
                status: { in: ['PENDING', 'IN_PROGRESS'] }
            },
            orderBy: { dueDate: 'asc' },
            take: 5
        });
        return tasks.map(task => task.title);
    }
    async getOverdueTasks(caseId) {
        const overdueTasks = await this.db.client.task.findMany({
            where: {
                caseId,
                status: { in: ['PENDING', 'IN_PROGRESS'] },
                dueDate: { lt: new Date() }
            }
        });
        return overdueTasks.map(task => task.title);
    }
    async calculateEstimatedCompletion(caseId) {
        const currentCase = await this.getCaseState(caseId);
        if (!currentCase)
            return undefined;
        const allPhases = Object.values(client_1.CasePhase);
        const currentPhaseIndex = allPhases.indexOf(currentCase.phase);
        const remainingPhases = allPhases.slice(currentPhaseIndex + 1);
        let totalDays = 0;
        for (const phase of remainingPhases) {
            const requirements = await this.getPhaseRequirements(phase, currentCase.caseType);
            totalDays += requirements.estimatedDuration || 0;
        }
        return new Date(Date.now() + totalDays * 24 * 60 * 60 * 1000);
    }
    getCaseTypeSpecificRequirements(caseType, phase) {
        const caseTypeRequirements = {
            [client_1.CaseType.CRIMINAL_DEFENSE]: {
                [client_1.CasePhase.INTAKE_RISK_ASSESSMENT]: ['bailHearing', 'policeReports', 'witnessStatements'],
                [client_1.CasePhase.FORMAL_PROCEEDINGS]: ['courtAppearances', 'evidencePresentation']
            },
            [client_1.CaseType.DIVORCE_FAMILY]: {
                [client_1.CasePhase.INTAKE_RISK_ASSESSMENT]: ['marriageCertificate', 'childrenInformation'],
                [client_1.CasePhase.PRE_PROCEEDING_PREPARATION]: ['mediationAttempts', 'custodyAgreement']
            },
            [client_1.CaseType.MEDICAL_MALPRACTICE]: {
                [client_1.CasePhase.INTAKE_RISK_ASSESSMENT]: ['medicalRecords', 'expertReports'],
                [client_1.CasePhase.FORMAL_PROCEEDINGS]: ['expertTestimony', 'medicalEvidence']
            }
        };
        return caseTypeRequirements[caseType]?.[phase] || [];
    }
};
exports.CaseLifecycleService = CaseLifecycleService;
exports.CaseLifecycleService = CaseLifecycleService = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(database_1.Database)),
    __metadata("design:paramtypes", [database_1.Database])
], CaseLifecycleService);
//# sourceMappingURL=CaseLifecycleService.js.map