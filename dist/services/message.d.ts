import { Database } from '../utils/database';
import { WebSocketService } from './websocket';
import { CreateMessageRequest, MessageResponse } from '../types';
export declare class MessageService {
    private db;
    private wsService;
    constructor(db: Database, wsService: WebSocketService);
    sendMessage(messageRequest: CreateMessageRequest, senderId: string): Promise<MessageResponse>;
    getMessagesByCaseId(caseId: string, userId: string): Promise<MessageResponse[]>;
    getMessagesBetweenUsers(user1Id: string, user2Id: string, userId: string): Promise<MessageResponse[]>;
    getUnreadMessages(userId: string): Promise<MessageResponse[]>;
    markMessageAsRead(messageId: string, userId: string): Promise<MessageResponse>;
    markAllMessagesAsRead(userId: string, caseId?: string): Promise<void>;
    deleteMessage(messageId: string, userId: string): Promise<void>;
    getMessageStats(userId: string): Promise<{
        total: number;
        unread: number;
        sent: number;
        received: number;
    }>;
    searchMessages(userId: string, query: string, caseId?: string): Promise<MessageResponse[]>;
    private verifyCaseAccess;
    private transformMessageResponse;
}
//# sourceMappingURL=message.d.ts.map