declare class App {
    private app;
    private server;
    private db;
    private wsService;
    constructor();
    private setupMiddleware;
    private setupRoutes;
    private setupErrorHandling;
    start(): Promise<void>;
    private gracefulShutdown;
}
declare const app: App;
export default app;
//# sourceMappingURL=index.d.ts.map