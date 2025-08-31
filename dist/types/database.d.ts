import { User, Client, Case, Task, Document, Fee, Payment, TimeEntry, Note, Contact, CaseTeamMember, CasePhaseHistory, SubTask, TaskDependency, DocumentVersion, DocumentApproval } from '@prisma/client';
export type { User, Client, Case, Task, Document, Fee, Payment, TimeEntry, Note, Contact, CaseTeamMember, CasePhaseHistory, SubTask, TaskDependency, DocumentVersion, DocumentApproval };
export type UserWithRelations = User & {
    cases?: Case[];
    tasks?: Task[];
    documents?: Document[];
    timeEntries?: TimeEntry[];
    notes?: Note[];
};
export type ClientWithRelations = Client & {
    cases?: Case[];
    documents?: Document[];
    contacts?: Contact[];
    fees?: Fee[];
};
export type CaseWithRelations = Case & {
    client?: Client;
    leadLawyer?: User;
    teamMembers?: CaseTeamMember[];
    tasks?: Task[];
    documents?: Document[];
    fees?: Fee[];
    timeEntries?: TimeEntry[];
    notes?: Note[];
    phases?: CasePhaseHistory[];
};
export type TaskWithRelations = Task & {
    case?: Case;
    assignee?: User;
    createdBy?: User;
    subtasks?: SubTask[];
    dependencies?: TaskDependency[];
    dependents?: TaskDependency[];
};
export type DocumentWithRelations = Document & {
    case?: Case;
    client?: Client;
    uploadedBy?: User;
    parent?: Document;
    children?: Document[];
    versions?: DocumentVersion[];
    approvals?: DocumentApproval[];
};
export type CreateUserData = Omit<User, 'id' | 'createdAt' | 'updatedAt'>;
export type CreateClientData = Omit<Client, 'id' | 'createdAt' | 'updatedAt'>;
export type CreateCaseData = Omit<Case, 'id' | 'createdAt' | 'updatedAt' | 'caseNumber'>;
export type CreateTaskData = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>;
export type CreateDocumentData = Omit<Document, 'id' | 'createdAt' | 'updatedAt'>;
export type CreateFeeData = Omit<Fee, 'id' | 'createdAt' | 'updatedAt'>;
export type CreatePaymentData = Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>;
export type CreateTimeEntryData = Omit<TimeEntry, 'id' | 'createdAt' | 'updatedAt'>;
export type CreateNoteData = Omit<Note, 'id' | 'createdAt' | 'updatedAt'>;
export type CreateContactData = Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateUserData = Partial<CreateUserData>;
export type UpdateClientData = Partial<CreateClientData>;
export type UpdateCaseData = Partial<CreateCaseData>;
export type UpdateTaskData = Partial<CreateTaskData>;
export type UpdateDocumentData = Partial<CreateDocumentData>;
export type UpdateFeeData = Partial<CreateFeeData>;
export type UpdatePaymentData = Partial<CreatePaymentData>;
export type UpdateTimeEntryData = Partial<CreateTimeEntryData>;
export type UpdateNoteData = Partial<CreateNoteData>;
export type UpdateContactData = Partial<CreateContactData>;
export type UserQuery = {
    id?: string;
    email?: string;
    username?: string;
    role?: string;
    status?: string;
};
export type ClientQuery = {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
};
export type CaseQuery = {
    id?: string;
    caseNumber?: string;
    title?: string;
    caseType?: string;
    phase?: string;
    status?: string;
    clientId?: string;
    leadLawyerId?: string;
};
export type TaskQuery = {
    id?: string;
    title?: string;
    status?: string;
    priority?: string;
    caseId?: string;
    assigneeId?: string;
    createdById?: string;
    dueDate?: Date;
};
export type DocumentQuery = {
    id?: string;
    filename?: string;
    type?: string;
    status?: string;
    caseId?: string;
    clientId?: string;
    uploadedById?: string;
};
export type PaginationParams = {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
};
export type PaginatedResult<T> = {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};
export type ApiResponse<T> = {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
};
export type PaginatedApiResponse<T> = {
    success: boolean;
    data?: T[];
    pagination?: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
    error?: string;
    message?: string;
};
//# sourceMappingURL=database.d.ts.map