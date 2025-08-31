"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegalResearchServiceFactory = void 0;
__exportStar(require("./LexisNexisService"), exports);
__exportStar(require("./WestlawService"), exports);
const LexisNexisService_1 = require("./LexisNexisService");
const WestlawService_1 = require("./WestlawService");
class LegalResearchServiceFactory {
    static createService(serviceType) {
        switch (serviceType) {
            case 'lexisnexis':
                return new LexisNexisService_1.LexisNexisService();
            case 'westlaw':
                return new WestlawService_1.WestlawService();
            default:
                throw new Error(`Unknown legal research service: ${serviceType}`);
        }
    }
}
exports.LegalResearchServiceFactory = LegalResearchServiceFactory;
//# sourceMappingURL=index.js.map