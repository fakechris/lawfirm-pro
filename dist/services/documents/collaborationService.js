"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentCollaborationService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
class DocumentCollaborationService {
    constructor(io, prisma, documentService) {
        this.io = io;
        this.prisma = prisma;
        this.documentService = documentService;
        this.sessions = new Map();
        this.userSockets = new Map();
        this.setupSocketHandlers();
    }
    setupSocketHandlers() {
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token;
                if (!token) {
                    return next(new Error('Authentication required'));
                }
                const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'fallback-secret');
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
            }
            catch (error) {
                next(new Error('Authentication failed'));
            }
        });
        this.io.on('connection', (socket) => {
            this.handleConnection(socket);
        });
    }
    handleConnection(socket) {
        const user = socket.data.user;
        socket.on('join_document', async (data) => {
            await this.handleJoinDocument(socket, data.documentId, user);
        });
        socket.on('leave_document', async (data) => {
            await this.handleLeaveDocument(socket, data.documentId, user);
        });
        socket.on('cursor_move', (data) => {
            this.handleCursorMove(socket, data.documentId, user, data);
        });
        socket.on('selection_change', (data) => {
            this.handleSelectionChange(socket, data.documentId, user, data);
        });
        socket.on('add_comment', async (data) => {
            await this.handleAddComment(socket, data.documentId, user, data);
        });
        socket.on('update_comment', async (data) => {
            await this.handleUpdateComment(socket, data.documentId, user, data);
        });
        socket.on('resolve_comment', async (data) => {
            await this.handleResolveComment(socket, data.documentId, user, data);
        });
        socket.on('disconnect', () => {
            this.handleDisconnect(socket, user);
        });
    }
    async handleJoinDocument(socket, documentId, user) {
        try {
            const document = await this.documentService.getDocument(documentId);
            if (!document) {
                socket.emit('error', { message: 'Document not found' });
                return;
            }
            const hasAccess = await this.checkDocumentAccess(documentId, user.id);
            if (!hasAccess) {
                socket.emit('error', { message: 'Access denied' });
                return;
            }
            socket.join(`document:${documentId}`);
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
            session.activeUsers.add(user.id);
            if (!session.users.find(u => u.id === user.id)) {
                session.users.push(user);
            }
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
            this.broadcastToDocument(documentId, 'user_joined', {
                user,
                activeUsers: Array.from(session.activeUsers),
                totalUsers: session.users.length
            }, socket.id);
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
            await this.logCollaborationActivity({
                type: 'user_joined',
                documentId,
                userId: user.id,
                data: { userName: user.name },
                timestamp: new Date()
            });
        }
        catch (error) {
            socket.emit('error', { message: 'Failed to join document' });
        }
    }
    async handleLeaveDocument(socket, documentId, user) {
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
    handleCursorMove(socket, documentId, user, data) {
        const session = this.sessions.get(documentId);
        if (session && session.activeUsers.has(user.id)) {
            session.cursors.set(user.id, { x: data.x, y: data.y });
            this.broadcastToDocument(documentId, 'cursor_move', {
                userId: user.id,
                position: { x: data.x, y: data.y }
            }, socket.id);
        }
    }
    handleSelectionChange(socket, documentId, user, data) {
        const session = this.sessions.get(documentId);
        if (session && session.activeUsers.has(user.id)) {
            session.selections.set(user.id, { start: data.start, end: data.end });
            this.broadcastToDocument(documentId, 'selection_change', {
                userId: user.id,
                selection: { start: data.start, end: data.end }
            }, socket.id);
        }
    }
    async handleAddComment(socket, documentId, user, data) {
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
        }
        catch (error) {
            socket.emit('error', { message: 'Failed to add comment' });
        }
    }
    async handleUpdateComment(socket, documentId, user, data) {
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
        }
        catch (error) {
            socket.emit('error', { message: 'Failed to update comment' });
        }
    }
    async handleResolveComment(socket, documentId, user, data) {
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
        }
        catch (error) {
            socket.emit('error', { message: 'Failed to resolve comment' });
        }
    }
    handleDisconnect(socket, user) {
        this.userSockets.delete(user.id);
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
    async checkDocumentAccess(documentId, userId) {
        const document = await this.prisma.document.findUnique({
            where: { id: documentId },
            select: { uploadedBy: true, caseId: true }
        });
        if (!document)
            return false;
        if (document.uploadedBy === userId)
            return true;
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
            if (caseAccess)
                return true;
        }
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
    broadcastToDocument(documentId, event, data, excludeSocketId) {
        this.io.to(`document:${documentId}`).except(excludeSocketId || '').emit(event, data);
    }
    async logCollaborationActivity(event) {
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
        }
        catch (error) {
            console.error('Failed to log collaboration activity:', error);
        }
    }
    getActiveSessions() {
        return Array.from(this.sessions.entries()).map(([documentId, session]) => ({
            documentId,
            activeUsers: Array.from(session.activeUsers),
            totalUsers: session.users.length
        }));
    }
    getSessionUsers(documentId) {
        const session = this.sessions.get(documentId);
        return session ? session.users : [];
    }
    getActiveUsers(documentId) {
        const session = this.sessions.get(documentId);
        if (!session)
            return [];
        return session.users.filter(user => session.activeUsers.has(user.id));
    }
}
exports.DocumentCollaborationService = DocumentCollaborationService;
//# sourceMappingURL=collaborationService.js.map