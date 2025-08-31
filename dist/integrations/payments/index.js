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
exports.PaymentProcessorFactory = void 0;
__exportStar(require("./StripeService"), exports);
__exportStar(require("./PayPalService"), exports);
const StripeService_1 = require("./StripeService");
const PayPalService_1 = require("./PayPalService");
class PaymentProcessorFactory {
    static createProcessor(processorType) {
        switch (processorType) {
            case 'stripe':
                return new StripeService_1.StripeService();
            case 'paypal':
                return new PayPalService_1.PayPalService();
            default:
                throw new Error(`Unknown payment processor: ${processorType}`);
        }
    }
}
exports.PaymentProcessorFactory = PaymentProcessorFactory;
//# sourceMappingURL=index.js.map