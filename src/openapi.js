"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeParamsToJsonSchema = normalizeParamsToJsonSchema;
exports.OpenApiSchema = OpenApiSchema;
exports.OpenApi = OpenApi;
var HttpMethods;
(function (HttpMethods) {
    HttpMethods["GET"] = "get";
    HttpMethods["PUT"] = "put";
    HttpMethods["POST"] = "post";
    HttpMethods["DELETE"] = "delete";
    HttpMethods["OPTIONS"] = "options";
    HttpMethods["HEAD"] = "head";
    HttpMethods["PATCH"] = "patch";
    HttpMethods["TRACE"] = "trace";
})(HttpMethods || (HttpMethods = {}));
/**
 * Normalize a flat ParamsSchemaMap into a valid JSON Schema object
 * that Fastify/AJV can validate against.
 *
 * Input:  { id: { type: "string", example: "abc-123" } }
 * Output: { type: "object", properties: { id: { type: "string", example: "abc-123" } } }
 */
function normalizeParamsToJsonSchema(params, requiredKeys = []) {
    const properties = {};
    for (const [key, val] of Object.entries(params)) {
        properties[key] = {
            type: "string", // sensible default
            ...val,
        };
    }
    const schema = {
        type: "object",
        properties,
    };
    if (requiredKeys.length > 0) {
        schema.required = requiredKeys;
    }
    return schema;
}
function OpenApiSchema() {
    return function (target) {
        Reflect.defineMetadata("openapi:schema", true, target);
    };
}
function OpenApi(options) {
    return function (target, propertyKey, descriptor) {
        if (typeof target === "function" && !propertyKey) {
            Reflect.defineMetadata("controller:openapi", options, target);
        }
        else if (descriptor) {
            // ✅ Store options as-is — router's buildRouteSchema handles normalization
            Reflect.defineMetadata("route:openapi", options, target, propertyKey);
        }
        else if (propertyKey) {
            Reflect.defineMetadata("property:openapi", options, target, propertyKey);
        }
    };
}
