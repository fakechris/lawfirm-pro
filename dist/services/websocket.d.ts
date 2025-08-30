import { Server as HTTPServer } from 'http';
import { Database } from '../utils/database';
export declare class WebSocketService {
    private io;
    private db;
    constructor(server: HTTPServer, db: Database);
    private setupEventHandlers;
    broadcastCaseUpdate(caseId: string, update: any): void;
    broadcastTaskUpdate(caseId: string, update: any): void;
    broadcastDocumentUpdate(caseId: string, update: any): void;
}
//# sourceMappingURL=websocket.d.ts.map