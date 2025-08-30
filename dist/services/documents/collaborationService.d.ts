import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { DocumentService } from '../services/documents/documentService';
export interface CollaborationUser {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    role: string;
}
export interface DocumentCollaborationSession {
    documentId: string;
    users: CollaborationUser[];
    activeUsers: Set<string>;
    cursors: Map<string, {
        x: number;
        y: number;
    }>;
    selections: Map<string, {
        start: number;
        end: number;
    }>;
    comments: Map<string, any[]>;
}
export interface CollaborationEvent {
    type: 'user_joined' | 'user_left' | 'cursor_move' | 'selection_change' | 'comment_added' | 'comment_updated' | 'comment_resolved';
    documentId: string;
    userId: string;
    data: any;
    timestamp: Date;
}
export declare class DocumentCollaborationService {
    private io;
    private prisma;
    private documentService;
    private sessions;
    private userSockets;
    constructor(io: SocketIOServer, prisma: PrismaClient, documentService: DocumentService);
    private setupSocketHandlers;
    private handleConnection;
    private handleJoinDocument;
    private handleLeaveDocument;
    private handleCursorMove;
    private handleSelectionChange;
    private handleAddComment;
    private handleUpdateComment;
    private handleResolveComment;
    private handleDisconnect;
    private checkDocumentAccess;
    private broadcastToDocument;
    private logCollaborationActivity;
    getActiveSessions(): Array<{
        documentId: string;
        activeUsers: string[];
        totalUsers: number;
    }>;
    getSessionUsers(documentId: string): CollaborationUser[];
    getActiveUsers(documentId: string): CollaborationUser[];
}
//# sourceMappingURL=collaborationService.d.ts.map