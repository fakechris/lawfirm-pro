"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoadingSpinner = void 0;
const react_1 = __importDefault(require("react"));
const LoadingSpinner = ({ size = 'medium', className = '', }) => {
    const sizeClasses = {
        small: 'w-4 h-4',
        medium: 'w-8 h-8',
        large: 'w-12 h-12',
    };
    return (<div className={`inline-block animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${sizeClasses[size]} ${className}`}/>);
};
exports.LoadingSpinner = LoadingSpinner;
//# sourceMappingURL=LoadingSpinner.js.map