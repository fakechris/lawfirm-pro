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
exports.CaseService = void 0;
const tsyringe_1 = require("tsyringe");
const database_1 = require("../utils/database");
const client_1 = require("@prisma/client");
let CaseService = class CaseService {
    constructor(db) {
        this.db = db;
    }
    async createCase(caseRequest, attorneyId) {
        const { title, description, caseType, clientId } = caseRequest;
        const client = await this.db.client.clientProfile.findUnique({
            where: { id: clientId },
            include: { user: true }
        });
        if (!client) {
            throw new Error('Client not found');
        }
        const attorney = await this.db.client.attorneyProfile.findUnique({
            where: { id: attorneyId },
            include: { user: true }
        });
        if (!attorney) {
            throw new Error('Attorney not found');
        }
        const caseData = await this.db.client.case.create({
            data: {
                title,
                description,
                caseType,
                clientId,
                attorneyId,
                status: client_1.CaseStatus.INTAKE,
                phase: client_1.CasePhase.INTAKE_RISK_ASSESSMENT,
            },
            include: {
                client: true,
                attorney: true,
            },
        });
        return this.transformCaseResponse(caseData);
    }
    async getCasesByClientId(clientId) {
        const cases = await this.db.client.case.findMany({
            where: { clientId },
            include: {
                client: true,
                attorney: true,
                documents: {
                    orderBy: { uploadedAt: 'desc' },
                    take: 5,
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
                appointments: {
                    orderBy: { startTime: 'asc' },
                    take: 3,
                },
            },
            orderBy: { updatedAt: 'desc' },
        });
        return cases.map(caseData => this.transformCaseResponse(caseData));
    }
    async getCasesByAttorneyId(attorneyId) {
        const cases = await this.db.client.case.findMany({
            where: { attorneyId },
            include: {
                client: true,
                attorney: true,
                documents: {
                    orderBy: { uploadedAt: 'desc' },
                    take: 5,
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
                appointments: {
                    orderBy: { startTime: 'asc' },
                    take: 3,
                },
            },
            orderBy: { updatedAt: 'desc' },
        });
        return cases.map(caseData => this.transformCaseResponse(caseData));
    }
    async getCaseById(caseId, userId, userRole) {
        let caseData;
        if (userRole === client_1.UserRole.CLIENT) {
            const client = await this.db.client.clientProfile.findUnique({
                where: { userId }
            });
            if (!client) {
                throw new Error('Client profile not found');
            }
            caseData = await this.db.client.case.findFirst({
                where: {
                    id: caseId,
                    clientId: client.id
                },
                include: {
                    client: { include: { user: true } },
                    attorney: { include: { user: true } },
                    documents: {
                        orderBy: { uploadedAt: 'desc' },
                    },
                    messages: {
                        orderBy: { createdAt: 'desc' },
                        include: {
                            sender: true,
                            receiver: true,
                        },
                    },
                    appointments: {
                        orderBy: { startTime: 'desc' },
                    },
                    tasks: {
                        orderBy: { createdAt: 'desc' },
                    },
                },
            });
        }
        else if (userRole === client_1.UserRole.ATTORNEY) {
            const attorney = await this.db.client.attorneyProfile.findUnique({
                where: { userId }
            });
            if (!attorney) {
                throw new Error('Attorney profile not found');
            }
            caseData = await this.db.client.case.findFirst({
                where: {
                    id: caseId,
                    attorneyId: attorney.id
                },
                include: {
                    client: { include: { user: true } },
                    attorney: { include: { user: true } },
                    documents: {
                        orderBy: { uploadedAt: 'desc' },
                    },
                    messages: {
                        orderBy: { createdAt: 'desc' },
                        include: {
                            sender: true,
                            receiver: true,
                        },
                    },
                    appointments: {
                        orderBy: { startTime: 'desc' },
                    },
                    tasks: {
                        orderBy: { createdAt: 'desc' },
                    },
                },
            });
        }
        else {
            throw new Error('Unauthorized access');
        }
        if (!caseData) {
            throw new Error('Case not found');
        }
        return this.transformCaseResponse(caseData);
    }
    async updateCaseStatus(caseId, status, userId, userRole) {
        await this.verifyCaseAccess(caseId, userId, userRole);
        const updatedCase = await this.db.client.case.update({
            where: { id: caseId },
            data: { status },
            include: {
                client: true,
                attorney: true,
            },
        });
        return this.transformCaseResponse(updatedCase);
    }
    async updateCasePhase(caseId, phase, userId, userRole) {
        await this.verifyCaseAccess(caseId, userId, userRole);
        const updatedCase = await this.db.client.case.update({
            where: { id: caseId },
            data: { phase },
            include: {
                client: true,
                attorney: true,
            },
        });
        return this.transformCaseResponse(updatedCase);
    }
    async getClientDashboard(clientId) {
        const cases = await this.getCasesByClientId(clientId);
        const upcomingAppointments = await this.db.client.appointment.findMany({
            where: {
                clientId,
                startTime: {
                    gte: new Date(),
                },
                status: {
                    in: ['SCHEDULED', 'CONFIRMED'],
                },
            },
            include: {
                case: true,
                attorney: { include: { user: true } },
            },
            orderBy: { startTime: 'asc' },
            take: 10,
        });
        const unreadMessages = await this.db.client.message.findMany({
            where: {
                receiverId: clientId,
                isRead: false,
            },
            include: {
                sender: true,
                case: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });
        const recentInvoices = await this.db.client.invoice.findMany({
            where: { clientId },
            include: {
                case: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });
        return {
            cases,
            upcomingAppointments: upcomingAppointments.map(apt => ({
                id: apt.id,
                title: apt.title,
                description: apt.description,
                startTime: apt.startTime,
                endTime: apt.endTime,
                caseId: apt.caseId,
                clientId: apt.clientId,
                attorneyId: apt.attorneyId,
                status: apt.status,
                createdAt: apt.createdAt,
                updatedAt: apt.updatedAt,
            })),
            unreadMessages: unreadMessages.map(msg => ({
                id: msg.id,
                content: msg.content,
                caseId: msg.caseId,
                senderId: msg.senderId,
                receiverId: msg.receiverId,
                isRead: msg.isRead,
                createdAt: msg.createdAt,
                readAt: msg.readAt,
                sender: {
                    id: msg.sender.id,
                    email: msg.sender.email,
                    firstName: msg.sender.firstName,
                    lastName: msg.sender.lastName,
                    role: msg.sender.role,
                    createdAt: msg.sender.createdAt,
                    updatedAt: msg.sender.updatedAt,
                },
                receiver: {
                    id: msg.receiver.id,
                    email: msg.receiver.email,
                    firstName: msg.receiver.firstName,
                    lastName: msg.receiver.lastName,
                    role: msg.receiver.role,
                    createdAt: msg.receiver.createdAt,
                    updatedAt: msg.receiver.updatedAt,
                },
            })),
            recentInvoices: recentInvoices.map(invoice => ({
                id: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                caseId: invoice.caseId,
                clientId: invoice.clientId,
                amount: Number(invoice.amount),
                status: invoice.status,
                dueDate: invoice.dueDate,
                paidAt: invoice.paidAt,
                createdAt: invoice.createdAt,
                updatedAt: invoice.updatedAt,
            })),
        };
    }
    async getAttorneyDashboard(attorneyId) {
        const cases = await this.getCasesByAttorneyId(attorneyId);
        const upcomingAppointments = await this.db.client.appointment.findMany({
            where: {
                attorneyId,
                startTime: {
                    gte: new Date(),
                },
                status: {
                    in: ['SCHEDULED', 'CONFIRMED'],
                },
            },
            include: {
                case: true,
                client: { include: { user: true } },
            },
            orderBy: { startTime: 'asc' },
            take: 10,
        });
        const tasks = await this.db.client.task.findMany({
            where: {
                assignedTo: attorneyId,
                status: {
                    in: ['PENDING', 'IN_PROGRESS'],
                },
            },
            include: {
                case: true,
            },
            orderBy: [
                { priority: 'desc' },
                { dueDate: 'asc' },
            ],
            take: 20,
        });
        const unreadMessages = await this.db.client.message.findMany({
            where: {
                receiverId: attorneyId,
                isRead: false,
            },
            include: {
                sender: true,
                case: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });
        return {
            cases,
            upcomingAppointments: upcomingAppointments.map(apt => ({
                id: apt.id,
                title: apt.title,
                description: apt.description,
                startTime: apt.startTime,
                endTime: apt.endTime,
                caseId: apt.caseId,
                clientId: apt.clientId,
                attorneyId: apt.attorneyId,
                status: apt.status,
                createdAt: apt.createdAt,
                updatedAt: apt.updatedAt,
            })),
            tasks: tasks.map(task => ({
                id: task.id,
                title: task.title,
                description: task.description,
                caseId: task.caseId,
                assignedTo: task.assignedTo,
                assignedBy: task.assignedBy,
                dueDate: task.dueDate,
                status: task.status,
                priority: task.priority,
                createdAt: task.createdAt,
                updatedAt: task.updatedAt,
                completedAt: task.completedAt,
            })),
            unreadMessages: unreadMessages.map(msg => ({
                id: msg.id,
                content: msg.content,
                caseId: msg.caseId,
                senderId: msg.senderId,
                receiverId: msg.receiverId,
                isRead: msg.isRead,
                createdAt: msg.createdAt,
                readAt: msg.readAt,
                sender: {
                    id: msg.sender.id,
                    email: msg.sender.email,
                    firstName: msg.sender.firstName,
                    lastName: msg.sender.lastName,
                    role: msg.sender.role,
                    createdAt: msg.sender.createdAt,
                    updatedAt: msg.sender.updatedAt,
                },
                receiver: {
                    id: msg.receiver.id,
                    email: msg.receiver.email,
                    firstName: msg.receiver.firstName,
                    lastName: msg.receiver.lastName,
                    role: msg.receiver.role,
                    createdAt: msg.receiver.createdAt,
                    updatedAt: msg.receiver.updatedAt,
                },
            })),
        };
    }
    async verifyCaseAccess(caseId, userId, userRole) {
        if (userRole === client_1.UserRole.CLIENT) {
            const client = await this.db.client.clientProfile.findUnique({
                where: { userId }
            });
            if (!client) {
                throw new Error('Client profile not found');
            }
            const caseAccess = await this.db.client.case.findFirst({
                where: {
                    id: caseId,
                    clientId: client.id
                }
            });
            if (!caseAccess) {
                throw new Error('Access denied to this case');
            }
        }
        else if (userRole === client_1.UserRole.ATTORNEY) {
            const attorney = await this.db.client.attorneyProfile.findUnique({
                where: { userId }
            });
            if (!attorney) {
                throw new Error('Attorney profile not found');
            }
            const caseAccess = await this.db.client.case.findFirst({
                where: {
                    id: caseId,
                    attorneyId: attorney.id
                }
            });
            if (!caseAccess) {
                throw new Error('Access denied to this case');
            }
        }
        else {
            throw new Error('Unauthorized access');
        }
    }
    transformCaseResponse(caseData) {
        return {
            id: caseData.id,
            title: caseData.title,
            description: caseData.description,
            caseType: caseData.caseType,
            status: caseData.status,
            phase: caseData.phase,
            clientId: caseData.clientId,
            attorneyId: caseData.attorneyId,
            createdAt: caseData.createdAt,
            updatedAt: caseData.updatedAt,
            closedAt: caseData.closedAt,
            client: {
                id: caseData.client.id,
                userId: caseData.client.userId,
                phone: caseData.client.phone,
                address: caseData.client.address,
                company: caseData.client.company,
                createdAt: caseData.client.createdAt,
                updatedAt: caseData.client.updatedAt,
            },
            attorney: {
                id: caseData.attorney.id,
                userId: caseData.attorney.userId,
                licenseNumber: caseData.attorney.licenseNumber,
                specialization: caseData.attorney.specialization,
                experience: caseData.attorney.experience,
                bio: caseData.attorney.bio,
                createdAt: caseData.attorney.createdAt,
                updatedAt: caseData.attorney.updatedAt,
            },
        };
    }
};
exports.CaseService = CaseService;
exports.CaseService = CaseService = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(database_1.Database)),
    __metadata("design:paramtypes", [database_1.Database])
], CaseService);
//# sourceMappingURL=case.js.map