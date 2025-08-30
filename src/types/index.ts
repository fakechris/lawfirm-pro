import { UserRole, CaseType, CaseStatus, CasePhase, AppointmentStatus, InvoiceStatus, TaskStatus, TaskPriority } from '@prisma/client';

// Export Prisma types
export * from '@prisma/client';

// Extended types
export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientProfileResponse {
  id: string;
  userId: string;
  phone?: string;
  address?: string;
  company?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AttorneyProfileResponse {
  id: string;
  userId: string;
  licenseNumber: string;
  specialization: string;
  experience?: number;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CaseResponse {
  id: string;
  title: string;
  description?: string;
  caseType: CaseType;
  status: CaseStatus;
  phase: CasePhase;
  clientId: string;
  attorneyId: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
  client: ClientProfileResponse;
  attorney: AttorneyProfileResponse;
}

export interface DocumentResponse {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  caseId: string;
  uploadedBy: string;
  uploadedAt: Date;
  isConfidential: boolean;
}

export interface MessageResponse {
  id: string;
  content: string;
  caseId: string;
  senderId: string;
  receiverId: string;
  isRead: boolean;
  createdAt: Date;
  readAt?: Date;
  sender: UserResponse;
  receiver: UserResponse;
}

export interface AppointmentResponse {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  caseId: string;
  clientId: string;
  attorneyId: string;
  status: AppointmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceResponse {
  id: string;
  invoiceNumber: string;
  caseId: string;
  clientId: string;
  amount: number;
  status: InvoiceStatus;
  dueDate: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskResponse {
  id: string;
  title: string;
  description?: string;
  caseId: string;
  assignedTo: string;
  assignedBy: string;
  dueDate?: Date;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// Request types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone?: string;
  address?: string;
  company?: string;
}

export interface CreateCaseRequest {
  title: string;
  description?: string;
  caseType: CaseType;
  clientId: string;
}

export interface CreateMessageRequest {
  content: string;
  caseId: string;
  receiverId: string;
}

export interface CreateAppointmentRequest {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  caseId: string;
  attorneyId: string;
}

export interface UpdateAppointmentStatusRequest {
  status: AppointmentStatus;
}

// Dashboard types
export interface ClientDashboard {
  cases: CaseResponse[];
  upcomingAppointments: AppointmentResponse[];
  unreadMessages: MessageResponse[];
  recentInvoices: InvoiceResponse[];
}

export interface AttorneyDashboard {
  cases: CaseResponse[];
  upcomingAppointments: AppointmentResponse[];
  tasks: TaskResponse[];
  unreadMessages: MessageResponse[];
}

// Auth types
export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  token: string;
  user: UserResponse;
}

// Error types
export interface ErrorResponse {
  message: string;
  code?: string;
  details?: any;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// WebSocket types
export interface WebSocketMessage {
  type: 'message' | 'appointment' | 'case_update' | 'document';
  data: any;
  timestamp: Date;
}

// File upload types
export interface FileUploadResponse {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
}