import { PrismaClient } from '@prisma/client';
import { TrainingModule, TrainingMaterial, TrainingAssessment, UserTrainingProgress, CreateTrainingModuleInput, TrainingQuery } from '../../../models/knowledge-base';
export declare class TrainingModuleService {
    private prisma;
    private documentService;
    constructor(prisma: PrismaClient);
    createModule(input: CreateTrainingModuleInput): Promise<TrainingModule>;
    getModuleById(id: string): Promise<TrainingModule | null>;
    updateModule(id: string, updates: any): Promise<TrainingModule>;
    deleteModule(id: string): Promise<void>;
    queryModules(query?: TrainingQuery): Promise<TrainingModule[]>;
    addMaterial(moduleId: string, material: Omit<TrainingMaterial, 'id' | 'moduleId' | 'createdAt' | 'updatedAt'>): Promise<TrainingMaterial>;
    updateMaterial(id: string, updates: any): Promise<TrainingMaterial>;
    deleteMaterial(id: string): Promise<void>;
    reorderMaterials(moduleId: string, materialIds: string[]): Promise<void>;
    addAssessment(moduleId: string, assessment: Omit<TrainingAssessment, 'id' | 'moduleId' | 'createdAt' | 'updatedAt'>): Promise<TrainingAssessment>;
    updateAssessment(id: string, updates: any): Promise<TrainingAssessment>;
    deleteAssessment(id: string): Promise<void>;
    startModule(userId: string, moduleId: string): Promise<UserTrainingProgress>;
    updateProgress(userId: string, moduleId: string, progress: number, timeSpent: number): Promise<UserTrainingProgress>;
    completeMaterial(userId: string, moduleId: string, materialIndex: number): Promise<UserTrainingProgress>;
    submitAssessment(userId: string, moduleId: string, assessmentId: string, answers: Record<string, any>): Promise<{
        score: number;
        passed: boolean;
        feedback: string[];
    }>;
    private isAnswerCorrect;
    getUserProgress(userId: string): Promise<UserTrainingProgress[]>;
    getModuleProgress(moduleId: string): Promise<UserTrainingProgress[]>;
    getTrainingAnalytics(): Promise<any>;
    getRecommendedModules(userId: string): Promise<TrainingModule[]>;
    generateCertificate(userId: string, moduleId: string): Promise<string>;
    createTrainingPath(name: string, description: string, moduleIds: string[], createdBy: string): Promise<any>;
    getTrainingPaths(): Promise<any[]>;
}
//# sourceMappingURL=trainingModuleService.d.ts.map