"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvironmentVariableNotFound = exports.DuplicateRouteException = exports.SystemUseError = void 0;
class SystemUseError extends Error {
    constructor(message) {
        super(message);
    }
}
exports.SystemUseError = SystemUseError;
class DuplicateRouteException extends Error {
    constructor(params) {
        let sameController = params.controller == params.inverseController;
        let message = `Duplicate route found for method ${params.method.toUpperCase()}:${params.path == "" ? "'/'" : params.path} `;
        message += sameController
            ? `in ${params.controller}`
            : `both in ${params.controller} and ${params.inverseController}`;
        super(message);
    }
}
exports.DuplicateRouteException = DuplicateRouteException;
class EnvironmentVariableNotFound extends Error {
    constructor(key) {
        super(`${key} not found in environment variables.`);
    }
}
exports.EnvironmentVariableNotFound = EnvironmentVariableNotFound;
