export interface KnowledgeBaseContent {
    id: string;
    title: string;
    description?: string;
    content: string;
    contentType: 'article' | 'guide' | 'template' | 'case_study' | 'training' | 'policy' | 'procedure';
    category: string;
    tags: string[];
    status: 'draft' | 'review' | 'published' | 'archived';
    visibility: 'public' | 'internal' | 'restricted';
    authorId: string;
    reviewerId?: string;
    approverId?: string;
    publishedAt?: Date;
    reviewedAt?: Date;
    archivedAt?: Date;
    version: number;
    parentContentId?: string;
    metadata: Record<string, any>;
    searchVector?: any;
    createdAt: Date;
    updatedAt: Date;
}
export interface KnowledgeBaseContentVersion {
    id: string;
    contentId: string;
    version: number;
    title: string;
    description?: string;
    content: string;
    changeLog?: string;
    createdById: string;
    createdAt: Date;
    isCurrent: boolean;
}
export interface KnowledgeBaseCategory {
    id: string;
    name: string;
    description?: string;
    parentId?: string;
    icon?: string;
    color?: string;
    sortOrder: number;
    isActive: boolean;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export interface KnowledgeBaseTag {
    id: string;
    name: string;
    description?: string;
    color?: string;
    usageCount: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface TrainingModule {
    id: string;
    title: string;
    description?: string;
    content: string;
    category: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    duration: number;
    isRequired: boolean;
    targetRoles: string[];
    prerequisites: string[];
    learningObjectives: string[];
    materials: TrainingMaterial[];
    assessments: TrainingAssessment[];
    status: 'draft' | 'active' | 'inactive' | 'archived';
    authorId: string;
    reviewerId?: string;
    publishedAt?: Date;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export interface TrainingMaterial {
    id: string;
    moduleId: string;
    type: 'document' | 'video' | 'image' | 'link' | 'quiz';
    title: string;
    description?: string;
    url?: string;
    filePath?: string;
    fileSize?: number;
    mimeType?: string;
    sortOrder: number;
    isRequired: boolean;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export interface TrainingAssessment {
    id: string;
    moduleId: string;
    type: 'quiz' | 'assignment' | 'practical';
    title: string;
    description?: string;
    questions: AssessmentQuestion[];
    passingScore: number;
    timeLimit?: number;
    attemptsAllowed: number;
    isActive: boolean;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export interface AssessmentQuestion {
    id: string;
    assessmentId: string;
    type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
    question: string;
    options?: string[];
    correctAnswer?: string | string[];
    explanation?: string;
    points: number;
    sortOrder: number;
    metadata: Record<string, any>;
}
export interface UserTrainingProgress {
    id: string;
    userId: string;
    moduleId: string;
    status: 'not_started' | 'in_progress' | 'completed' | 'failed';
    progress: number;
    currentMaterialIndex: number;
    score?: number;
    timeSpent: number;
    startedAt?: Date;
    completedAt?: Date;
    lastAccessedAt: Date;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export interface UserContentInteraction {
    id: string;
    userId: string;
    contentId: string;
    action: 'view' | 'like' | 'bookmark' | 'share' | 'comment' | 'download';
    metadata: Record<string, any>;
    createdAt: Date;
}
export interface ContentWorkflow {
    id: string;
    name: string;
    description?: string;
    contentType: string[];
    stages: WorkflowStage[];
    isDefault: boolean;
    isActive: boolean;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface WorkflowStage {
    id: string;
    workflowId: string;
    name: string;
    description?: string;
    type: 'review' | 'approval' | 'publishing' | 'archival';
    requiredRole: string[];
    assignedTo?: string;
    dueDays?: number;
    autoApproveAfterDays?: number;
    sortOrder: number;
    conditions: WorkflowCondition[];
    actions: WorkflowAction[];
    isActive: boolean;
}
export interface WorkflowCondition {
    field: string;
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in';
    value: any;
}
export interface WorkflowAction {
    type: 'notify' | 'update_status' | 'assign_user' | 'send_email' | 'create_task';
    config: Record<string, any>;
}
export interface ContentWorkflowInstance {
    id: string;
    workflowId: string;
    contentId: string;
    currentStage: string;
    status: 'pending' | 'in_progress' | 'completed' | 'rejected';
    startedBy: string;
    startedAt: Date;
    completedAt?: Date;
    metadata: Record<string, any>;
    stages: WorkflowStageInstance[];
}
export interface WorkflowStageInstance {
    id: string;
    workflowInstanceId: string;
    stageId: string;
    status: 'pending' | 'in_progress' | 'completed' | 'skipped';
    assignedTo?: string;
    assignedAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
    notes?: string;
    metadata: Record<string, any>;
}
export interface ContentTemplate {
    id: string;
    name: string;
    description?: string;
    category: string;
    contentType: string;
    templateContent: string;
    variableSchema: TemplateVariable[];
    isPublic: boolean;
    requiredRole: string[];
    tags: string[];
    usageCount: number;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface TemplateVariable {
    name: string;
    type: 'string' | 'number' | 'date' | 'boolean' | 'select' | 'array' | 'object';
    description?: string;
    required: boolean;
    defaultValue?: any;
    options?: string[];
    validation?: {
        pattern?: string;
        min?: number;
        max?: number;
        custom?: string;
    };
}
export interface TemplateUsage {
    id: string;
    templateId: string;
    contentId: string;
    variables: Record<string, any>;
    createdBy: string;
    createdAt: Date;
}
export interface ContentSearchResult {
    id: string;
    title: string;
    description?: string;
    contentType: string;
    category: string;
    tags: string[];
    excerpt?: string;
    score: number;
    highlights?: string[];
    author?: {
        id: string;
        firstName: string;
        lastName: string;
    };
    status: string;
    publishedAt?: Date;
    metadata: Record<string, any>;
}
export interface ContentAnalytics {
    totalViews: number;
    totalDownloads: number;
    totalShares: number;
    uniqueUsers: number;
    topContent: Array<{
        contentId: string;
        title: string;
        views: number;
        downloads: number;
    }>;
    categoryStats: Array<{
        category: string;
        count: number;
        views: number;
    }>;
    userEngagement: Array<{
        userId: string;
        views: number;
        interactions: number;
    }>;
    timeSeriesData: Array<{
        date: string;
        views: number;
        interactions: number;
    }>;
}
export interface CreateContentInput {
    title: string;
    description?: string;
    content: string;
    contentType: string;
    category: string;
    tags: string[];
    visibility: string;
    authorId: string;
    metadata?: Record<string, any>;
}
export interface UpdateContentInput {
    title?: string;
    description?: string;
    content?: string;
    category?: string;
    tags?: string[];
    status?: string;
    visibility?: string;
    metadata?: Record<string, any>;
}
export interface CreateContentVersionInput {
    contentId: string;
    title: string;
    description?: string;
    content: string;
    changeLog?: string;
    createdById: string;
}
export interface CreateTrainingModuleInput {
    title: string;
    description?: string;
    content: string;
    category: string;
    difficulty: string;
    duration: number;
    isRequired: boolean;
    targetRoles: string[];
    prerequisites: string[];
    learningObjectives: string[];
    authorId: string;
}
export interface CreateWorkflowInput {
    name: string;
    description?: string;
    contentType: string[];
    stages: Omit<WorkflowStage, 'id' | 'workflowId' | 'isActive'>[];
    isDefault?: boolean;
    createdBy: string;
}
export interface ContentQuery {
    id?: string;
    title?: string;
    contentType?: string;
    category?: string;
    tags?: string[];
    status?: string;
    visibility?: string;
    authorId?: string;
    search?: string;
    fromDate?: Date;
    toDate?: Date;
}
export interface TrainingQuery {
    id?: string;
    title?: string;
    category?: string;
    difficulty?: string;
    isRequired?: boolean;
    targetRoles?: string[];
    status?: string;
    search?: string;
}
export interface WorkflowQuery {
    id?: string;
    name?: string;
    contentType?: string;
    isDefault?: boolean;
    isActive?: boolean;
}
export interface PaginationParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
//# sourceMappingURL=content.d.ts.map