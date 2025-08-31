"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrainingModuleService = void 0;
const documentService_1 = require("../../documents/documentService");
class TrainingModuleService {
    constructor(prisma) {
        this.prisma = prisma;
        this.documentService = new documentService_1.DocumentService(prisma);
    }
    async createModule(input) {
        const module = await this.prisma.trainingModule.create({
            data: {
                title: input.title,
                description: input.description,
                content: input.content,
                category: input.category,
                difficulty: input.difficulty,
                duration: input.duration,
                isRequired: input.isRequired,
                targetRoles: input.targetRoles,
                prerequisites: input.prerequisites,
                learningObjectives: input.learningObjectives,
                status: 'draft',
                authorId: input.authorId,
                metadata: {}
            },
            include: {
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                reviewer: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });
        return module;
    }
    async getModuleById(id) {
        return await this.prisma.trainingModule.findUnique({
            where: { id },
            include: {
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                reviewer: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                materials: {
                    orderBy: { sortOrder: 'asc' }
                },
                assessments: {
                    include: {
                        questions: {
                            orderBy: { sortOrder: 'asc' }
                        }
                    },
                    orderBy: { sortOrder: 'asc' }
                },
                _count: {
                    select: {
                        progress: true
                    }
                }
            }
        });
    }
    async updateModule(id, updates) {
        const updatedModule = await this.prisma.trainingModule.update({
            where: { id },
            data: {
                ...updates,
                updatedAt: new Date()
            },
            include: {
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                reviewer: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });
        return updatedModule;
    }
    async deleteModule(id) {
        await this.prisma.trainingModule.update({
            where: { id },
            data: {
                status: 'archived',
                archivedAt: new Date()
            }
        });
    }
    async queryModules(query = {}) {
        const where = {};
        if (query.id)
            where.id = query.id;
        if (query.title)
            where.title = { contains: query.title, mode: 'insensitive' };
        if (query.category)
            where.category = query.category;
        if (query.difficulty)
            where.difficulty = query.difficulty;
        if (query.isRequired !== undefined)
            where.isRequired = query.isRequired;
        if (query.targetRoles)
            where.targetRoles = { hasSome: query.targetRoles };
        if (query.status)
            where.status = query.status;
        if (query.search) {
            where.OR = [
                { title: { contains: query.search, mode: 'insensitive' } },
                { description: { contains: query.search, mode: 'insensitive' } },
                { learningObjectives: { hasSome: [query.search] } }
            ];
        }
        return await this.prisma.trainingModule.findMany({
            where,
            include: {
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                reviewer: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                _count: {
                    select: {
                        progress: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
    async addMaterial(moduleId, material) {
        return await this.prisma.trainingMaterial.create({
            data: {
                moduleId,
                ...material
            },
            include: {
                module: {
                    select: {
                        id: true,
                        title: true
                    }
                }
            }
        });
    }
    async updateMaterial(id, updates) {
        return await this.prisma.trainingMaterial.update({
            where: { id },
            data: {
                ...updates,
                updatedAt: new Date()
            }
        });
    }
    async deleteMaterial(id) {
        await this.prisma.trainingMaterial.delete({
            where: { id }
        });
    }
    async reorderMaterials(moduleId, materialIds) {
        const updates = materialIds.map((id, index) => ({
            where: { id },
            data: { sortOrder: index }
        }));
        await Promise.all(updates.map(update => this.prisma.trainingMaterial.update(update)));
    }
    async addAssessment(moduleId, assessment) {
        const createdAssessment = await this.prisma.trainingAssessment.create({
            data: {
                moduleId,
                ...assessment,
                questions: {
                    create: assessment.questions.map((q, index) => ({
                        ...q,
                        sortOrder: index
                    }))
                }
            },
            include: {
                questions: {
                    orderBy: { sortOrder: 'asc' }
                }
            }
        });
        return createdAssessment;
    }
    async updateAssessment(id, updates) {
        return await this.prisma.trainingAssessment.update({
            where: { id },
            data: {
                ...updates,
                updatedAt: new Date()
            },
            include: {
                questions: {
                    orderBy: { sortOrder: 'asc' }
                }
            }
        });
    }
    async deleteAssessment(id) {
        await this.prisma.trainingAssessment.delete({
            where: { id }
        });
    }
    async startModule(userId, moduleId) {
        const existingProgress = await this.prisma.userTrainingProgress.findUnique({
            where: {
                userId_moduleId: {
                    userId,
                    moduleId
                }
            }
        });
        if (existingProgress) {
            return existingProgress;
        }
        const progress = await this.prisma.userTrainingProgress.create({
            data: {
                userId,
                moduleId,
                status: 'in_progress',
                progress: 0,
                currentMaterialIndex: 0,
                timeSpent: 0,
                startedAt: new Date(),
                lastAccessedAt: new Date(),
                metadata: {}
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                module: {
                    select: {
                        id: true,
                        title: true,
                        difficulty: true,
                        duration: true
                    }
                }
            }
        });
        return progress;
    }
    async updateProgress(userId, moduleId, progress, timeSpent) {
        const currentProgress = await this.prisma.userTrainingProgress.findUnique({
            where: {
                userId_moduleId: {
                    userId,
                    moduleId
                }
            }
        });
        if (!currentProgress) {
            throw new Error('Progress not found');
        }
        const status = progress >= 100 ? 'completed' : 'in_progress';
        const completedAt = progress >= 100 ? new Date() : undefined;
        const updatedProgress = await this.prisma.userTrainingProgress.update({
            where: {
                userId_moduleId: {
                    userId,
                    moduleId
                }
            },
            data: {
                progress,
                timeSpent: currentProgress.timeSpent + timeSpent,
                status,
                completedAt,
                lastAccessedAt: new Date()
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                module: {
                    select: {
                        id: true,
                        title: true,
                        difficulty: true,
                        duration: true
                    }
                }
            }
        });
        return updatedProgress;
    }
    async completeMaterial(userId, moduleId, materialIndex) {
        const progress = await this.prisma.userTrainingProgress.findUnique({
            where: {
                userId_moduleId: {
                    userId,
                    moduleId
                }
            }
        });
        if (!progress) {
            throw new Error('Progress not found');
        }
        const module = await this.getModuleById(moduleId);
        if (!module) {
            throw new Error('Module not found');
        }
        const totalMaterials = module.materials.length;
        const nextMaterialIndex = Math.min(materialIndex + 1, totalMaterials - 1);
        const newProgress = Math.round(((materialIndex + 1) / totalMaterials) * 100);
        const updatedProgress = await this.prisma.userTrainingProgress.update({
            where: {
                userId_moduleId: {
                    userId,
                    moduleId
                }
            },
            data: {
                currentMaterialIndex: nextMaterialIndex,
                progress: newProgress,
                status: newProgress >= 100 ? 'completed' : 'in_progress',
                completedAt: newProgress >= 100 ? new Date() : undefined,
                lastAccessedAt: new Date()
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                module: {
                    select: {
                        id: true,
                        title: true,
                        difficulty: true,
                        duration: true
                    }
                }
            }
        });
        return updatedProgress;
    }
    async submitAssessment(userId, moduleId, assessmentId, answers) {
        const assessment = await this.prisma.trainingAssessment.findUnique({
            where: { id: assessmentId },
            include: {
                questions: {
                    orderBy: { sortOrder: 'asc' }
                }
            }
        });
        if (!assessment) {
            throw new Error('Assessment not found');
        }
        let totalPoints = 0;
        let earnedPoints = 0;
        const feedback = [];
        for (const question of assessment.questions) {
            totalPoints += question.points;
            const userAnswer = answers[question.id];
            if (this.isAnswerCorrect(question, userAnswer)) {
                earnedPoints += question.points;
            }
            else {
                feedback.push(`Question about "${question.question}": ${question.explanation || 'Incorrect answer'}`);
            }
        }
        const score = Math.round((earnedPoints / totalPoints) * 100);
        const passed = score >= assessment.passingScore;
        await this.prisma.userAssessmentResult.create({
            data: {
                userId,
                assessmentId,
                answers,
                score,
                passed,
                timeSpent: 0,
                completedAt: new Date()
            }
        });
        return { score, passed, feedback };
    }
    isAnswerCorrect(question, userAnswer) {
        switch (question.type) {
            case 'multiple_choice':
                return Array.isArray(question.correctAnswer)
                    ? question.correctAnswer.includes(userAnswer)
                    : question.correctAnswer === userAnswer;
            case 'true_false':
                return question.correctAnswer === userAnswer;
            case 'short_answer':
                return String(userAnswer).toLowerCase().trim() === String(question.correctAnswer).toLowerCase().trim();
            case 'essay':
                return true;
            default:
                return false;
        }
    }
    async getUserProgress(userId) {
        return await this.prisma.userTrainingProgress.findMany({
            where: { userId },
            include: {
                module: {
                    select: {
                        id: true,
                        title: true,
                        category: true,
                        difficulty: true,
                        duration: true
                    }
                }
            },
            orderBy: { lastAccessedAt: 'desc' }
        });
    }
    async getModuleProgress(moduleId) {
        return await this.prisma.userTrainingProgress.findMany({
            where: { moduleId },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
            },
            orderBy: { progress: 'desc' }
        });
    }
    async getTrainingAnalytics() {
        const [totalModules, totalUsers, completionStats, popularModules] = await Promise.all([
            this.prisma.trainingModule.count({
                where: { status: 'active' }
            }),
            this.prisma.userTrainingProgress.groupBy({
                by: ['userId'],
                _count: { userId: true }
            }),
            this.prisma.userTrainingProgress.groupBy({
                by: ['status'],
                _count: { status: true }
            }),
            this.prisma.trainingModule.findMany({
                where: { status: 'active' },
                include: {
                    _count: {
                        select: {
                            progress: true
                        }
                    }
                },
                orderBy: {
                    progress: {
                        _count: 'desc'
                    }
                },
                take: 10
            })
        ]);
        return {
            totalModules,
            totalUsers: totalUsers.length,
            completionStats,
            popularModules
        };
    }
    async getRecommendedModules(userId) {
        const userProgress = await this.getUserProgress(userId);
        const completedModules = userProgress.filter(p => p.status === 'completed').map(p => p.moduleId);
        const inProgressModules = userProgress.filter(p => p.status === 'in_progress').map(p => p.moduleId);
        const userRoles = await this.prisma.userRole.findMany({
            where: { userId },
            include: {
                role: true
            }
        });
        const roleNames = userRoles.map(ur => ur.role.name);
        const recommendedModules = await this.prisma.trainingModule.findMany({
            where: {
                AND: [
                    { status: 'active' },
                    { id: { notIn: [...completedModules, ...inProgressModules] } },
                    {
                        OR: [
                            { targetRoles: { hasSome: roleNames } },
                            { isRequired: true }
                        ]
                    },
                    {
                        prerequisites: {
                            array_contains: completedModules
                        }
                    }
                ]
            },
            include: {
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                _count: {
                    select: {
                        progress: true
                    }
                }
            },
            orderBy: [
                { isRequired: 'desc' },
                { difficulty: 'asc' },
                { createdAt: 'desc' }
            ],
            take: 10
        });
        return recommendedModules;
    }
    async generateCertificate(userId, moduleId) {
        const progress = await this.prisma.userTrainingProgress.findFirst({
            where: {
                userId,
                moduleId,
                status: 'completed'
            },
            include: {
                user: true,
                module: true
            }
        });
        if (!progress) {
            throw new Error('Module not completed');
        }
        const certificateContent = `
      Certificate of Completion
      
      This certifies that ${progress.user.firstName} ${progress.user.lastName}
      has successfully completed the training module:
      
      "${progress.module.title}"
      
      Duration: ${progress.module.duration} minutes
      Completed on: ${progress.completedAt?.toLocaleDateString()}
      
      Score: ${progress.score || 'N/A'}%
    `;
        const certificateDocument = await this.documentService.createDocument({
            filename: `certificate-${moduleId}-${userId}.pdf`,
            originalName: `Certificate - ${progress.module.title}`,
            path: `/certificates/${moduleId}-${userId}.pdf`,
            size: certificateContent.length,
            mimeType: 'application/pdf',
            type: 'certificate',
            uploadedById: 'system',
            isConfidential: false,
            description: `Training certificate for ${progress.module.title}`,
            metadata: {
                certificateType: 'training_completion',
                moduleId,
                userId,
                completedAt: progress.completedAt,
                score: progress.score
            }
        });
        return certificateDocument.id;
    }
    async createTrainingPath(name, description, moduleIds, createdBy) {
        return await this.prisma.trainingPath.create({
            data: {
                name,
                description,
                createdBy,
                modules: {
                    create: moduleIds.map((moduleId, index) => ({
                        moduleId,
                        sortOrder: index,
                        isRequired: true
                    }))
                }
            },
            include: {
                modules: {
                    include: {
                        module: {
                            select: {
                                id: true,
                                title: true,
                                difficulty: true,
                                duration: true
                            }
                        }
                    },
                    orderBy: { sortOrder: 'asc' }
                }
            }
        });
    }
    async getTrainingPaths() {
        return await this.prisma.trainingPath.findMany({
            include: {
                createdBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                modules: {
                    include: {
                        module: {
                            select: {
                                id: true,
                                title: true,
                                difficulty: true,
                                duration: true
                            }
                        }
                    },
                    orderBy: { sortOrder: 'asc' }
                },
                _count: {
                    select: {
                        enrollments: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
}
exports.TrainingModuleService = TrainingModuleService;
//# sourceMappingURL=trainingModuleService.js.map