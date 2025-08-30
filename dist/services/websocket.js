"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketService = void 0;
const socket_io_1 = require("socket.io");
class WebSocketService {
    constructor(server, db) {
        this.db = db;
        this.io = new socket_io_1.Server(server, {
            cors: {
                origin: process.env.CLIENT_URL || 'http://localhost:3000',
                credentials: true,
            },
        });
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`Client connected: ${socket.id}`);
            socket.on('join-case', (caseId) => {
                socket.join(`case-${caseId}`);
                console.log(`Client ${socket.id} joined case ${caseId}`);
            });
            socket.on('case-update', (data) => {
                this.io.to(`case-${data.caseId}`).emit('case-updated', data.update);
            });
            socket.on('disconnect', () => {
                console.log(`Client disconnected: ${socket.id}`);
            });
        });
    }
    broadcastCaseUpdate(caseId, update) {
        this.io.to(`case-${caseId}`).emit('case-updated', update);
    }
    broadcastTaskUpdate(caseId, update) {
        this.io.to(`case-${caseId}`).emit('task-updated', update);
    }
    broadcastDocumentUpdate(caseId, update) {
        this.io.to(`case-${caseId}`).emit('document-updated', update);
    }
}
exports.WebSocketService = WebSocketService;
//# sourceMappingURL=websocket.js.map