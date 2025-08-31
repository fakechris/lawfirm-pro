"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrustTransactionType = exports.PaymentStatus = exports.PaymentMethod = exports.ExpenseCategory = exports.FeeType = exports.InvoiceStatus = void 0;
var InvoiceStatus;
(function (InvoiceStatus) {
    InvoiceStatus["DRAFT"] = "DRAFT";
    InvoiceStatus["SENT"] = "SENT";
    InvoiceStatus["PARTIALLY_PAID"] = "PARTIALLY_PAID";
    InvoiceStatus["PAID"] = "PAID";
    InvoiceStatus["OVERDUE"] = "OVERDUE";
    InvoiceStatus["CANCELLED"] = "CANCELLED";
})(InvoiceStatus || (exports.InvoiceStatus = InvoiceStatus = {}));
var FeeType;
(function (FeeType) {
    FeeType["HOURLY"] = "HOURLY";
    FeeType["FLAT"] = "FLAT";
    FeeType["CONTINGENCY"] = "CONTINGENCY";
    FeeType["RETAINER"] = "RETAINER";
    FeeType["HYBRID"] = "HYBRID";
})(FeeType || (exports.FeeType = FeeType = {}));
var ExpenseCategory;
(function (ExpenseCategory) {
    ExpenseCategory["FILING_FEES"] = "FILING_FEES";
    ExpenseCategory["COURT_COSTS"] = "COURT_COSTS";
    ExpenseCategory["TRAVEL"] = "TRAVEL";
    ExpenseCategory["RESEARCH"] = "RESEARCH";
    ExpenseCategory["EXPERT_WITNESS"] = "EXPERT_WITNESS";
    ExpenseCategory["COPYING"] = "COPYING";
    ExpenseCategory["POSTAGE"] = "POSTAGE";
    ExpenseCategory["MEALS"] = "MEALS";
    ExpenseCategory["ACCOMMODATION"] = "ACCOMMODATION";
    ExpenseCategory["TRANSLATION"] = "TRANSLATION";
    ExpenseCategory["OTHER"] = "OTHER";
})(ExpenseCategory || (exports.ExpenseCategory = ExpenseCategory = {}));
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["CASH"] = "CASH";
    PaymentMethod["BANK_TRANSFER"] = "BANK_TRANSFER";
    PaymentMethod["ALIPAY"] = "ALIPAY";
    PaymentMethod["WECHAT_PAY"] = "WECHAT_PAY";
    PaymentMethod["CREDIT_CARD"] = "CREDIT_CARD";
    PaymentMethod["CHECK"] = "CHECK";
    PaymentMethod["OTHER"] = "OTHER";
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["PENDING"] = "PENDING";
    PaymentStatus["COMPLETED"] = "COMPLETED";
    PaymentStatus["FAILED"] = "FAILED";
    PaymentStatus["REFUNDED"] = "REFUNDED";
    PaymentStatus["PARTIALLY_REFUNDED"] = "PARTIALLY_REFUNDED";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
var TrustTransactionType;
(function (TrustTransactionType) {
    TrustTransactionType["DEPOSIT"] = "DEPOSIT";
    TrustTransactionType["WITHDRAWAL"] = "WITHDRAWAL";
    TrustTransactionType["TRANSFER"] = "TRANSFER";
    TrustTransactionType["INTEREST"] = "INTEREST";
})(TrustTransactionType || (exports.TrustTransactionType = TrustTransactionType = {}));
//# sourceMappingURL=index.js.map