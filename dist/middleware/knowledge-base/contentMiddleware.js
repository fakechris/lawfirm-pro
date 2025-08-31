"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentMiddleware = void 0;
const content_1 = require("../../utils/knowledge-base/content");
class ContentMiddleware {
    static validateContent(req, res, next) {
        const validation = content_1.ContentValidationUtils.validateContent(req.body);
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validation.errors
            });
        }
        if (req.body.content) {
            const sizeValidation = content_1.ContentValidationUtils.validateContentSize(req.body.content);
            if (!sizeValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    error: 'Content size validation failed',
                    details: sizeValidation.errors
                });
            }
        }
        if (req.body.tags) {
            const tagValidation = content_1.ContentValidationUtils.validateTags(req.body.tags);
            if (!tagValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    error: 'Tag validation failed',
                    details: tagValidation.errors
                });
            }
        }
        if (req.body.category) {
            const categoryValidation = content_1.ContentValidationUtils.validateCategory(req.body.category);
            if (!categoryValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    error: 'Category validation failed',
                    details: categoryValidation.errors
                });
            }
        }
        next();
    }
    static validateTemplate(req, res, next) {
        const validation = content_1.ContentValidationUtils.validateTemplate(req.body);
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                error: 'Template validation failed',
                details: validation.errors
            });
        }
        if (req.body.variableSchema) {
            const schemaValidation = content_1.ContentValidationUtils.validateVariableSchema(req.body.variableSchema);
            if (!schemaValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    error: 'Variable schema validation failed',
                    details: schemaValidation.errors
                });
            }
        }
        next();
    }
    static validateTrainingModule(req, res, next) {
        const validation = content_1.ContentValidationUtils.validateTrainingModule(req.body);
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                error: 'Training module validation failed',
                details: validation.errors
            });
        }
        next();
    }
    static validateAssessment(req, res, next) {
        const validation = content_1.ContentValidationUtils.validateAssessment(req.body);
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                error: 'Assessment validation failed',
                details: validation.errors
            });
        }
        next();
    }
    static validateWorkflowStage(req, res, next) {
        const validation = content_1.ContentValidationUtils.validateWorkflowStage(req.body);
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                error: 'Workflow stage validation failed',
                details: validation.errors
            });
        }
        next();
    }
    static validateSearchQuery(req, res, next) {
        const query = req.body.query || req.query.query;
        const validation = content_1.ContentValidationUtils.validateSearchQuery(query);
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                error: 'Search query validation failed',
                details: validation.errors
            });
        }
        next();
    }
    static sanitizeContent(req, res, next) {
        try {
            if (req.body.content) {
                const { ContentProcessingUtils } = require('../../utils/knowledge-base/content/processingUtils');
                req.body.content = ContentProcessingUtils.sanitizeHtml(req.body.content);
            }
            if (req.body.description) {
                const { ContentProcessingUtils } = require('../../utils/knowledge-base/content/processingUtils');
                req.body.description = ContentProcessingUtils.sanitizeHtml(req.body.description);
            }
            next();
        }
        catch (error) {
            next(error);
        }
    }
    static async checkUserPermission(userId, permission) {
        return true;
    }
    static async getContentById(contentId) {
        return null;
    }
    static async checkUserContentAccess(userId, contentId) {
        return true;
    }
    static async trackVersionChange(contentId, userId, changes) {
        console.log(`Version change tracked for content ${contentId} by user ${userId}`, changes);
    }
    static async trackInteraction(contentId, userId, action) {
        console.log(`Interaction tracked: ${action} on content ${contentId} by user ${userId}`);
    }
}
exports.ContentMiddleware = ContentMiddleware;
_a = ContentMiddleware;
ContentMiddleware.checkContentAccess = (requiredPermission) => {
    return async (req, res, next) => {
        try {
            const user = req.user;
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
            }
            const hasPermission = await _a.checkUserPermission(user.id, requiredPermission);
            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    error: 'Insufficient permissions'
                });
            }
            next();
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Access check failed'
            });
        }
    };
};
ContentMiddleware.checkContentVisibility = async (req, res, next) => {
    try {
        const user = req.user;
        const contentId = req.params.id;
        if (!user) {
            const content = await _a.getContentById(contentId);
            if (!content || content.visibility !== 'public') {
                return res.status(403).json({
                    success: false,
                    error: 'Authentication required to access this content'
                });
            }
            next();
            return;
        }
        const hasAccess = await _a.checkUserContentAccess(user.id, contentId);
        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions to access this content'
            });
        }
        next();
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Visibility check failed'
        });
    }
};
ContentMiddleware.trackContentVersion = async (req, res, next) => {
    try {
        const originalSend = res.send;
        const contentId = req.params.id;
        const userId = req.user?.id;
        const changes = req.body;
        res.send = function (data) {
            if (res.statusCode < 400 && data && data.success) {
                if (userId && contentId && changes) {
                    _a.trackVersionChange(contentId, userId, changes)
                        .catch(error => {
                        console.error('Failed to track version change:', error);
                    });
                }
            }
            originalSend.call(this, data);
        };
        next();
    }
    catch (error) {
        next(error);
    }
};
ContentMiddleware.trackContentInteraction = (action) => {
    return async (req, res, next) => {
        try {
            const originalSend = res.send;
            const contentId = req.params.id;
            const userId = req.user?.id;
            res.send = function (data) {
                if (res.statusCode < 400 && data && data.success) {
                    if (userId && contentId) {
                        _a.trackInteraction(contentId, userId, action)
                            .catch(error => {
                            console.error('Failed to track interaction:', error);
                        });
                    }
                }
                originalSend.call(this, data);
            };
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
ContentMiddleware.rateLimitContentOperations = (maxOperations, windowMs) => {
    const operations = new Map();
    return (req, res, next) => {
        const userId = req.user?.id || req.ip;
        const now = Date.now();
        const windowStart = now - windowMs;
        if (!operations.has(userId)) {
            operations.set(userId, []);
        }
        const userOperations = operations.get(userId);
        const recentOperations = userOperations.filter(time => time > windowStart);
        operations.set(userId, recentOperations);
        if (recentOperations.length >= maxOperations) {
            return res.status(429).json({
                success: false,
                error: 'Too many content operations. Please try again later.'
            });
        }
        recentOperations.push(now);
        next();
    };
};
//# sourceMappingURL=contentMiddleware.js.map