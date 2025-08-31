"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = void 0;
const requestLogger = (req, res, next) => {
    const start = Date.now();
    console.log(`${req.method} ${req.path} - ${req.ip}`);
    const originalEnd = res.end;
    res.end = function (chunk, encoding) {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
        return originalEnd.call(this, chunk, encoding);
    };
    next();
};
exports.requestLogger = requestLogger;
//# sourceMappingURL=requestLogger.js.map