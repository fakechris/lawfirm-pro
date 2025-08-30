import { Server as SocketIOServer, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
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
  cursors: Map<string, { x: number; y: number }>;
  selections: Map<string, { start: number; end: number }>;
  comments: Map<string, any[]>;
}

export interface CollaborationEvent {
  type: 'user_joined' | 'user_left' | 'cursor_move' | 'selection_change' | 'comment_added' | 'comment_updated' | 'comment_resolved';
  documentId: string;
  userId: string;
  data: any;
  timestamp: Date;
}

export class DocumentCollaborationService {
  private io: SocketIOServer;
  private prisma: PrismaClient;
  private documentService: DocumentService;
  private sessions: Map<string, DocumentCollaborationSession>;
  private userSockets: Map<string, Socket>;

  constructor(io: SocketIOServer, prisma: PrismaClient, documentService: DocumentService) {
    this.io = io;
    this.prisma = prisma;
    this.documentService = documentService;
    this.sessions = new Map();
    this.userSockets = new Map();
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.io.use(async (socket: Socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
        const user = await this.prisma.user.findUnique({
          where: { id: decoded.userId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true
          }
        });

        if (!user) {
          return next(new Error('User not found'));
        }

        socket.data.user = {
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          role: user.role
        };

        this.userSockets.set(user.id, socket);
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });
  }

  private handleConnection(socket: Socket): void {
    const user = socket.data.user as CollaborationUser;

    socket.on('join_document', async (data: { documentId: string }) => {
      await this.handleJoinDocument(socket, data.documentId, user);
    });

    socket.on('leave_document', async (data: { documentId: string }) => {
      await this.handleLeaveDocument(socket, data.documentId, user);
    });

    socket.on('cursor_move', (data: { documentId: string; x: number; y: number }) => {
      this.handleCursorMove(socket, data.documentId, user, data);
    });

    socket.on('selection_change', (data: { documentId: string; start: number; end: number }) => {
      this.handleSelectionChange(socket, data.documentId, user, data);
    });

    socket.on('add_comment', async (data: { documentId: string; content: string; position?: any }) => {
      await this.handleAddComment(socket, data.documentId, user, data);
    });

    socket.on('update_comment', async (data: { documentId: string; commentId: string; content: string }) => {
      await this.handleUpdateComment(socket, data.documentId, user, data);
    });

    socket.on('resolve_comment', async (data: { documentId: string; commentId: string }) => {
      await this.handleResolveComment(socket, data.documentId, user, data);
    });

    socket.on('disconnect', () => {
      this.handleDisconnect(socket, user);
    });
  }

  private async handleJoinDocument(socket: Socket, documentId: string, user: CollaborationUser): Promise<void> {
    try {
      // Check if user has permission to access the document
      const document = await this.documentService.getDocument(documentId);
      if (!document) {
        socket.emit('error', { message: 'Document not found' });
        return;
      }

      // Check if user is authorized (document owner, shared user, or case participant)
      const hasAccess = await this.checkDocumentAccess(documentId, user.id);
      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      // Join the document room
      socket.join(`document:${documentId}`);

      // Get or create session
      let session = this.sessions.get(documentId);
      if (!session) {
        session = {
          documentId,
          users: [],
          activeUsers: new Set(),
          cursors: new Map(),
          selections: new Map(),
          comments: new Map()
        };
        this.sessions.set(documentId, session);
      }

      // Add user to session
      session.activeUsers.add(user.id);
      if (!session.users.find(u => u.id === user.id)) {
        session.users.push(user);
      }

      // Load existing comments
      const comments = await this.prisma.documentComment.findMany({
        where: { documentId, isResolved: false },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Notify other users
      this.broadcastToDocument(documentId, 'user_joined', {
        user,
        activeUsers: Array.from(session.activeUsers),
        totalUsers: session.users.length
      }, socket.id);

      // Send current state to the joining user
      socket.emit('document_joined', {
        documentId,
        users: session.users,
        activeUsers: Array.from(session.activeUsers),
        cursors: Array.from(session.cursors.entries()),
        selections: Array.from(session.selections.entries()),
        comments: comments.map(comment => ({
          id: comment.id,
          content: comment.content,
          position: comment.position,
          isResolved: comment.isResolved,
          createdAt: comment.createdAt,
          user: {
            id: comment.user.id,
            name: `${comment.user.firstName} ${comment.user.lastName}`,
            email: comment.user.email
          }
        }))
      });

      // Log the activity
      await this.logCollaborationActivity({
        type: 'user_joined',
        documentId,
        userId: user.id,
        data: { userName: user.name },
        timestamp: new Date()
      });
    } catch (error) {
      socket.emit('error', { message: 'Failed to join document' });
    }
  }

  private async handleLeaveDocument(socket: Socket, documentId: string, user: CollaborationUser): Promise<void> {
    const session = this.sessions.get(documentId);
    if (session) {
      session.activeUsers.delete(user.id);
      session.cursors.delete(user.id);
      session.selections.delete(user.id);

      socket.leave(`document:${documentId}`);

      this.broadcastToDocument(documentId, 'user_left', {
        user,
        activeUsers: Array.from(session.activeUsers)
      }, socket.id);

      // Clean up empty sessions
      if (session.activeUsers.size === 0) {
        this.sessions.delete(documentId);
      }

      await this.logCollaborationActivity({
        type: 'user_left',
        documentId,
        userId: user.id,
        data: { userName: user.name },
        timestamp: new Date()
      });
    }
  }

  private handleCursorMove(socket: Socket, documentId: string, user: CollaborationUser, data: { x: number; y: number }): void {
    const session = this.sessions.get(documentId);
    if (session && session.activeUsers.has(user.id)) {
      session.cursors.set(user.id, { x: data.x, y: data.y });

      this.broadcastToDocument(documentId, 'cursor_move', {
        userId: user.id,
        position: { x: data.x, y: data.y }
      }, socket.id);
    }
  }

  private handleSelectionChange(socket: Socket, documentId: string, user: CollaborationUser, data: { start: number; end: number }): void {
    const session = this.sessions.get(documentId);
    if (session && session.activeUsers.has(user.id)) {
      session.selections.set(user.id, { start: data.start, end: data.end });

      this.broadcastToDocument(documentId, 'selection_change', {
        userId: user.id,
        selection: { start: data.start, end: data.end }
      }, socket.id);
    }
  }

  private async handleAddComment(socket: Socket, documentId: string, user: CollaborationUser, data: { content: string; position?: any }): Promise<void> {
    try {
      const comment = await this.prisma.documentComment.create({
        data: {
          documentId,
          userId: user.id,
          content: data.content,
          position: data.position,
          isResolved: false
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      const commentData = {
        id: comment.id,
        content: comment.content,
        position: comment.position,
        isResolved: comment.isResolved,
        createdAt: comment.createdAt,
        user: {
          id: comment.user.id,
          name: `${comment.user.firstName} ${comment.user.lastName}`,
          email: comment.user.email
        }
      };

      this.broadcastToDocument(documentId, 'comment_added', commentData);

      await this.logCollaborationActivity({
        type: 'comment_added',
        documentId,
        userId: user.id,
        data: { commentId: comment.id, content: data.content },
        timestamp: new Date()
      });
    } catch (error) {
      socket.emit('error', { message: 'Failed to add comment' });
    }
  }

  private async handleUpdateComment(socket: Socket, documentId: string, user: CollaborationUser, data: { commentId: string; content: string }): Promise<void> {
    try {
      const comment = await this.prisma.documentComment.update({
        where: { id: data.commentId },
        data: { content: data.content },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      const commentData = {
        id: comment.id,
        content: comment.content,
        position: comment.position,
        isResolved: comment.isResolved,
        createdAt: comment.createdAt,
        user: {
          id: comment.user.id,
          name: `${comment.user.firstName} ${comment.user.lastName}`,
          email: comment.user.email
        }
      };

      this.broadcastToDocument(documentId, 'comment_updated', commentData);

      await this.logCollaborationActivity({
        type: 'comment_updated',
        documentId,
        userId: user.id,
        data: { commentId: data.commentId, content: data.content },
        timestamp: new Date()
      });
    } catch (error) {
      socket.emit('error', { message: 'Failed to update comment' });
    }
  }

  private async handleResolveComment(socket: Socket, documentId: string, user: CollaborationUser, data: { commentId: string }): Promise<void> {
    try {
      const comment = await this.prisma.documentComment.update({
        where: { id: data.commentId },
        data: { isResolved: true },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      const commentData = {
        id: comment.id,
        content: comment.content,
        position: comment.position,
        isResolved: comment.isResolved,
        createdAt: comment.createdAt,
        user: {
          id: comment.user.id,
          name: `${comment.user.firstName} ${comment.user.lastName}`,
          email: comment.user.email
        }
      };

      this.broadcastToDocument(documentId, 'comment_resolved', commentData);

      await this.logCollaborationActivity({
        type: 'comment_resolved',
        documentId,
        userId: user.id,
        data: { commentId: data.commentId },
        timestamp: new Date()
      });
    } catch (error) {
      socket.emit('error', { message: 'Failed to resolve comment' });
    }
  }

  private handleDisconnect(socket: Socket, user: CollaborationUser): void {
    this.userSockets.delete(user.id);

    // Remove user from all active sessions
    for (const [documentId, session] of this.sessions.entries()) {
      if (session.activeUsers.has(user.id)) {
        session.activeUsers.delete(user.id);
        session.cursors.delete(user.id);
        session.selections.delete(user.id);

        this.broadcastToDocument(documentId, 'user_left', {
          user,
          activeUsers: Array.from(session.activeUsers)
        });

        if (session.activeUsers.size === 0) {
          this.sessions.delete(documentId);
        }
      }
    }
  }

  private async checkDocumentAccess(documentId: string, userId: string): Promise<boolean> {
    // Check if user is the document owner
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { uploadedBy: true, caseId: true }
    });

    if (!document) return false;
    if (document.uploadedBy === userId) return true;

    // Check if user has access through case
    if (document.caseId) {
      const caseAccess = await this.prisma.case.findFirst({
        where: {
          id: document.caseId,
          OR: [
            { clientId: userId },
            { attorneyId: userId }
          ]
        }
      });
      if (caseAccess) return true;
    }

    // Check if document is shared with user
    const sharedAccess = await this.prisma.documentShare.findFirst({
      where: {
        documentId,
        sharedWith: userId,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    return !!sharedAccess;
  }

  private broadcastToDocument(documentId: string, event: string, data: any, excludeSocketId?: string): void {
    this.io.to(`document:${documentId}`).except(excludeSocketId || '').emit(event, data);
  }

  private async logCollaborationActivity(event: CollaborationEvent): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: event.type,
          entityType: 'document',
          entityId: event.documentId,
          userId: event.userId,
          newValues: event.data
        }
      });
    } catch (error) {
      console.error('Failed to log collaboration activity:', error);
    }
  }

  // Public methods for getting session information
  getActiveSessions(): Array<{
    documentId: string;
    activeUsers: string[];
    totalUsers: number;
  }> {
    return Array.from(this.sessions.entries()).map(([documentId, session]) => ({
      documentId,
      activeUsers: Array.from(session.activeUsers),
      totalUsers: session.users.length
    }));
  }

  getSessionUsers(documentId: string): CollaborationUser[] {
    const session = this.sessions.get(documentId);
    return session ? session.users : [];
  }

  getActiveUsers(documentId: string): CollaborationUser[] {
    const session = this.sessions.get(documentId);
    if (!session) return [];
    
    return session.users.filter(user => session.activeUsers.has(user.id));
  }
}