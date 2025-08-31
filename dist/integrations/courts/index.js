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
exports.CourtIntegrationFactory = void 0;
__exportStar(require("./PACERService"), exports);
__exportStar(require("./StateCourtService"), exports);
const PACERService_1 = require("./PACERService");
const StateCourtService_1 = require("./StateCourtService");
class CourtIntegrationFactory {
    static createService(courtType) {
        switch (courtType) {
            case 'pacer':
                return new PACERService_1.PACERService();
            case 'state':
                return new StateCourtService_1.StateCourtService();
            default:
                throw new Error(`Unknown court type: ${courtType}`);
        }
    }
}
exports.CourtIntegrationFactory = CourtIntegrationFactory;
//# sourceMappingURL=index.js.map