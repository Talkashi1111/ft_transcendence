"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.counterOperations = void 0;
// Simple in-memory counter implementation
let counterValue = 0;
// Counter operations
exports.counterOperations = {
    getValue: () => {
        return { value: counterValue };
    },
    setValue: (value) => {
        counterValue = value;
        return { value: counterValue };
    }
};
// Export a dummy object for compatibility
exports.default = {};
