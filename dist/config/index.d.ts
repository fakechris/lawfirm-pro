export declare const config: {
    port: string | number;
    nodeEnv: string;
    database: {
        url: string;
    };
    jwt: {
        secret: string;
        expiresIn: string;
        refreshExpiresIn: string;
    };
    bcrypt: {
        saltRounds: number;
    };
    rateLimit: {
        windowMs: number;
        max: number;
    };
    cors: {
        origin: string;
        credentials: boolean;
    };
    storage: {
        basePath: string;
        maxFileSize: number;
        allowedMimeTypes: string[];
        paths: {
            documents: {
                original: string;
                versions: string;
                processed: string;
            };
            templates: {
                active: string;
                archive: string;
            };
            evidence: {
                original: string;
                thumbnails: string;
                processed: string;
            };
            temp: {
                uploads: string;
            };
        };
    };
    ocr: {
        enabled: boolean;
        language: string;
        timeout: number;
    };
    search: {
        minContentLength: number;
        maxContentLength: number;
        batchSize: number;
    };
};
//# sourceMappingURL=index.d.ts.map