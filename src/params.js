"use strict";
/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthUser = exports.Header = exports.Body = exports.Query = exports.Param = void 0;
const container_1 = require("./container");
const helpers_1 = require("./helpers");
const swagger_schema_1 = require("./swagger-schema");
function createParamDecorator(type) {
    return function (key, options = {}) {
        return function (target, propertyKey, parameterIndex) {
            let metaKey;
            switch (type) {
                case "route:param":
                    metaKey = container_1.PARAM_META_KEY;
                    break;
                case "route:query":
                    metaKey = container_1.QUERY_META_KEY;
                    break;
                case "route:body":
                    metaKey = container_1.REQUEST_BODY_META_KEY;
                    break;
                case "route:user":
                    metaKey = container_1.REQUEST_USER_META_KEY;
                    break;
                case "route:header":
                    metaKey = container_1.REQUEST_HEADER_META_KEY;
                    break;
                default:
                    throw new Error(`Unknown param decorator type: ${String(type)}`);
            }
            const existingParams = Reflect.getMetadata(metaKey, target, propertyKey) || [];
            // Get parameter names (fallback safe)
            const functionSource = target[propertyKey].toString();
            const paramNames = functionSource.match(/\(([^)]*)\)/)?.[1]?.split(",").map((n) => n.trim()) || [];
            const parameterTypes = Reflect.getMetadata("design:paramtypes", target, propertyKey) || [];
            const paramDataType = parameterTypes[parameterIndex];
            existingParams.push({
                index: parameterIndex,
                key: typeof key === "string" ? key : "all",
                name: paramNames[parameterIndex],
                required: options.required ?? true,
                validate: options.validate ?? true,
                dataType: (0, helpers_1.getDataType)(paramDataType),
                validatorClass: (0, helpers_1.isClassValidatorClass)(paramDataType),
                schema: (0, helpers_1.isClassValidatorClass)(paramDataType)
                    ? (0, swagger_schema_1.generateClassSchema)(paramDataType)
                    : null,
                type,
            });
            Reflect.defineMetadata(metaKey, existingParams, target, propertyKey);
        };
    };
}
exports.Param = createParamDecorator("route:param");
exports.Query = createParamDecorator("route:query");
exports.Body = createParamDecorator("route:body");
exports.Header = createParamDecorator("route:header");
exports.AuthUser = createParamDecorator("route:user");
