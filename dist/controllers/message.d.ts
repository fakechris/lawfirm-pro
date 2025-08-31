import { Request, Response } from 'express';
export declare class MessageController {
    private messageService;
    sendMessage(req: Request, res: Response): Promise<void>;
    getCaseMessages(req: Request, res: Response): Promise<void>;
    getUserMessages(req: Request, res: Response): Promise<void>;
    getUnreadMessages(req: Request, res: Response): Promise<void>;
    markMessageAsRead(req: Request, res: Response): Promise<void>;
    markAllMessagesAsRead(req: Request, res: Response): Promise<void>;
    deleteMessage(req: Request, res: Response): Promise<void>;
    getMessageStats(req: Request, res: Response): Promise<void>;
    searchMessages(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=message.d.ts.map