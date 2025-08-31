"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeBaseStatus = exports.KnowledgeBaseAccessLevel = exports.KnowledgeBaseContentType = void 0;
var KnowledgeBaseContentType;
(function (KnowledgeBaseContentType) {
    KnowledgeBaseContentType["BEST_PRACTICE"] = "BEST_PRACTICE";
    KnowledgeBaseContentType["CASE_STUDY"] = "CASE_STUDY";
    KnowledgeBaseContentType["LEGAL_GUIDE"] = "LEGAL_GUIDE";
    KnowledgeBaseContentType["TEMPLATE"] = "TEMPLATE";
    KnowledgeBaseContentType["TRAINING_MATERIAL"] = "TRAINING_MATERIAL";
    KnowledgeBaseContentType["POLICY"] = "POLICY";
    KnowledgeBaseContentType["PROCEDURE"] = "PROCEDURE";
    KnowledgeBaseContentType["RESEARCH_NOTE"] = "RESEARCH_NOTE";
    KnowledgeBaseContentType["LEGAL_OPINION"] = "LEGAL_OPINION";
    KnowledgeBaseContentType["CHECKLIST"] = "CHECKLIST";
    KnowledgeBaseContentType["WORKFLOW"] = "WORKFLOW";
    KnowledgeBaseContentType["RESOURCE"] = "RESOURCE";
})(KnowledgeBaseContentType || (exports.KnowledgeBaseContentType = KnowledgeBaseContentType = {}));
var KnowledgeBaseAccessLevel;
(function (KnowledgeBaseAccessLevel) {
    KnowledgeBaseAccessLevel["PUBLIC"] = "PUBLIC";
    KnowledgeBaseAccessLevel["INTERNAL"] = "INTERNAL";
    KnowledgeBaseAccessLevel["RESTRICTED"] = "RESTRICTED";
    KnowledgeBaseAccessLevel["CONFIDENTIAL"] = "CONFIDENTIAL";
})(KnowledgeBaseAccessLevel || (exports.KnowledgeBaseAccessLevel = KnowledgeBaseAccessLevel = {}));
var KnowledgeBaseStatus;
(function (KnowledgeBaseStatus) {
    KnowledgeBaseStatus["DRAFT"] = "DRAFT";
    KnowledgeBaseStatus["REVIEW"] = "REVIEW";
    KnowledgeBaseStatus["PUBLISHED"] = "PUBLISHED";
    KnowledgeBaseStatus["ARCHIVED"] = "ARCHIVED";
    KnowledgeBaseStatus["DEPRECATED"] = "DEPRECATED";
})(KnowledgeBaseStatus || (exports.KnowledgeBaseStatus = KnowledgeBaseStatus = {}));
//# sourceMappingURL=knowledge-base.js.map