/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import { getMetadataStorage } from "class-validator";
import { CONTROLLER_META_KEY } from "./container";
import { ParamSchema } from "./openapi";

// Decorator to add OpenAPI metadata to properties
export function OpenApiProperty(options?: ParamSchema & {
    exclude?: boolean;
    isArray?: boolean;
    items?: Record<string, any>;
    oneOf?: any[];
    allOf?: any[];
    anyOf?: any[];
    readOnly?: boolean;
    writeOnly?: boolean;
    nullable?: boolean;
    title?: string;
}) {
    return function (target: any, propertyKey: string) {
        let meta = options ? { ...options } : {};
        if ((meta as any).format === "binary") {
            if ((meta as any).isArray) {
                meta = {
                    ...meta,
                    type: "array",
                    items: (meta as any).items ?? { type: "string", format: "binary" },
                    description: (meta as any).description || "Array of files",
                };
            } else {
                meta = {
                    ...meta,
                    type: "string",
                    format: "binary",
                    description: (meta as any).description || "File upload",
                };
            }
        }

        Reflect.defineMetadata("property:openapi", meta, target, propertyKey);
    };
}

function extractOpenApiFields(meta: any): any {
    const result: any = {};

    // ✅ Complete list — was missing required, title, readOnly, writeOnly, nullable
    const jsonSchemaFields = [
        "description",
        "deprecated",
        "example",
        "enum",
        "format",
        "default",
        "minimum",
        "maximum",
        "minLength",
        "maxLength",
        "pattern",
        "oneOf",
        "allOf",
        "anyOf",
        "title",
        "readOnly",
        "writeOnly",
        "nullable"
    ];

    // Valid JSON Schema formats
    const validFormats = [
        "date-time", "date", "time", "duration",
        "email", "idn-email", "hostname", "idn-hostname",
        "ipv4", "ipv6", "uri", "uri-reference",
        "iri", "iri-reference", "uuid", "uri-template",
        "json-pointer", "relative-json-pointer", "regex",
        "int32", "int64", "float", "double",
        "byte", "binary", "password",
    ];

    jsonSchemaFields.forEach((field) => {
        if (meta[field] !== undefined) {
            if (field === "format") {
                const formatValue = meta[field];
                if (validFormats.includes(formatValue)) {
                    result[field] = formatValue;
                }
            } else {
                result[field] = meta[field];
            }
        }
    });

    return result;
}

export function CreateSwaggerObjectSchema(classType: any): any {
    const metadataStorage = getMetadataStorage();
    const validationMetadata = metadataStorage.getTargetValidationMetadatas(
        classType, "", true, false,
    );

    const schema: any = { type: "object", properties: {}, required: [] };
    const prototype = classType.prototype;
    const propertyKeys = new Set<string>();

    Object.getOwnPropertyNames(prototype).forEach((k) => propertyKeys.add(k));
    Object.keys(prototype).forEach((k) => propertyKeys.add(k));
    validationMetadata.forEach((m: any) => propertyKeys.add(m.propertyName));

    // ✅ Discover instance-level properties (class fields with !)
    try {
        const instance = new classType();
        Reflect.ownKeys(instance).forEach((k) => {
            if (typeof k === "string") propertyKeys.add(k);
        });
    } catch (_) {}

    propertyKeys.forEach((propertyName) => {
        if (!propertyName || propertyName === "constructor") return;

        const openApiMeta: any = Reflect.getMetadata("property:openapi", prototype, propertyName);
        if (openApiMeta?.exclude) return;

        const propertyType = Reflect.getMetadata("design:type", prototype, propertyName);
        let swaggerProperty: any = {};

        switch (propertyType) {
            case String:   swaggerProperty.type = "string"; break;
            case Number:   swaggerProperty.type = "number"; break;
            case Boolean:  swaggerProperty.type = "boolean"; break;
            case Date:
                swaggerProperty.type = "string";
                swaggerProperty.format = "date-time";
                break;
            case Array:
                swaggerProperty.type = "array";
                swaggerProperty.items = { type: "string" };
                break;
            case Object:
                swaggerProperty = CreateSwaggerObjectSchema(propertyType);
                break;
            default:
                if (propertyType && typeof propertyType === "function") {
                    swaggerProperty.$ref = `#/components/schemas/${propertyType.name}`;
                } else {
                    swaggerProperty.type = propertyType?.name?.toLowerCase() || "string";
                }
        }

        if (openApiMeta) {
            swaggerProperty = {
                ...swaggerProperty,
                ...openApiMeta,
                ...extractOpenApiFields(openApiMeta),
            };

            if (openApiMeta.format === "binary") {
                if (openApiMeta.isArray || propertyType === Array) {
                    swaggerProperty = {
                        type: "array",
                        items: { type: "string", format: "binary" },
                        description: openApiMeta.description || "Array of files",
                    };
                } else {
                    swaggerProperty = {
                        type: "string",
                        format: "binary",
                        description: openApiMeta.description || "File upload",
                    };
                }
            }
        }

        schema.properties[propertyName] = swaggerProperty;
    });

    validationMetadata.forEach((meta: any) => {
        const propertyName = meta.propertyName;
        const property = schema.properties[propertyName];
        if (!property) return;

        switch (meta.name) {
            case "isNotEmpty":
            case "isDefined":
                if (!schema.required.includes(propertyName)) schema.required.push(propertyName);
                break;
            case "isOptional":
                schema.required = schema.required.filter((item: any) => item !== propertyName);
                break;
            case "minLength":   property.minLength = meta.constraints[0]; break;
            case "maxLength":   property.maxLength = meta.constraints[0]; break;
            case "min":         property.minimum = meta.constraints[0]; break;
            case "max":         property.maximum = meta.constraints[0]; break;
            case "isEmail":     property.format = "email"; break;
            case "isDate":      property.format = "date-time"; break;
            case "isIn":        property.enum = meta.constraints[0]; break;
            case "isNumber":    property.type = "number"; break;
            case "isInt":       property.type = "integer"; break;
            case "isBoolean":   property.type = "boolean"; break;
            case "isString":    property.type = "string"; break;
        }
    });

    if (schema.required.length === 0) delete schema.required;
    return schema;
}

export function generateClassSchema(classType: any): any {
    const schema: any = { type: "object", properties: {}, required: [] };

    // ✅ Guard against null/undefined
    if (!classType || !classType.prototype) return schema;

    const metadataStorage = getMetadataStorage();
    const validationMetadata = metadataStorage.getTargetValidationMetadatas(
        classType, "", true, false,
    );

    const prototype = classType.prototype;
    const propertyKeys = new Set<string>([
        ...Object.getOwnPropertyNames(prototype),
        ...validationMetadata.map((m: any) => m.propertyName),
    ]);

    // ✅ Discover instance-level class fields (e.g. `search!: string`)
    // These don't appear on prototype — only on instantiated objects
    try {
        const instance = new classType();
        Reflect.ownKeys(instance).forEach((k) => {
            if (typeof k === "string") propertyKeys.add(k);
        });
    } catch (_) {}

    propertyKeys.forEach((propertyName) => {
        if (!propertyName || propertyName === "constructor") return;

        const openApiMeta: any = Reflect.getMetadata("property:openapi", prototype, propertyName);
        if (openApiMeta?.exclude) return;

        const propertyType = Reflect.getMetadata("design:type", prototype, propertyName);
        let swaggerProperty: any = {};

        switch (propertyType) {
            case String:   swaggerProperty.type = "string"; break;
            case Number:   swaggerProperty.type = "number"; break;
            case Boolean:  swaggerProperty.type = "boolean"; break;
            case Date:
                swaggerProperty.type = "string";
                swaggerProperty.format = "date-time";
                break;
            case Array:
                swaggerProperty.type = "array";
                swaggerProperty.items = { type: "string" };
                break;
            case Object:
                swaggerProperty = generateClassSchema(propertyType);
                break;
            default:
                if (propertyType && typeof propertyType === "function") {
                    swaggerProperty.$ref = `#/components/schemas/${propertyType.name}`;
                } else {
                    swaggerProperty.type = propertyType?.name?.toLowerCase() || "string";
                }
        }

        // ✅ Apply OpenApi metadata — extractOpenApiFields now includes all fields
if (openApiMeta) {
    const { required: _required, exclude: _exclude, isArray: _isArray, ...safeOpenApiMeta } = openApiMeta;
    swaggerProperty = {
        ...swaggerProperty,
        ...extractOpenApiFields(safeOpenApiMeta),
    };
}

        schema.properties[propertyName] = swaggerProperty;
    });

    validationMetadata.forEach((meta: any) => {
        const propertyName = meta.propertyName;

        // Guard: property might not be in schema if it had no type info
        if (!schema.properties[propertyName]) {
            schema.properties[propertyName] = { type: "string" }; // ✅ safe fallback
        }

        switch (meta.name) {
            case "isNotEmpty":
            case "isDefined":
                if (!schema.required.includes(propertyName)) schema.required.push(propertyName);
                break;
            case "isOptional":
                schema.required = schema.required.filter((item: any) => item !== propertyName);
                break;
            case "minLength":   schema.properties[propertyName].minLength = meta.constraints[0]; break;
            case "maxLength":   schema.properties[propertyName].maxLength = meta.constraints[0]; break;
            case "min":         schema.properties[propertyName].minimum = meta.constraints[0]; break;
            case "max":         schema.properties[propertyName].maximum = meta.constraints[0]; break;
            case "isEmail":     schema.properties[propertyName].format = "email"; break;
            case "isDate":      schema.properties[propertyName].format = "date-time"; break;
            case "isIn":        schema.properties[propertyName].enum = meta.constraints[0]; break;
            case "isNumber":    schema.properties[propertyName].type = "number"; break;
            case "isInt":       schema.properties[propertyName].type = "integer"; break;
            case "isBoolean":   schema.properties[propertyName].type = "boolean"; break;
            case "isString":    schema.properties[propertyName].type = "string"; break;
        }
    });

    if (schema.required.length === 0) delete schema.required;
    return schema;
}

// Build OpenAPI components.schemas from an array of controller/DTO classes
export function generateSwaggerSchema(controllers: any[]): any {
    if (!Array.isArray(controllers)) {
        return generateClassSchema(controllers);
    }

    const components: Record<string, any> = {};

    for (const controller of controllers) {
        if (!controller || typeof controller !== "function") continue;
        if (!controller.prototype) continue;

        // Skip @ApiController classes
        const isController = Reflect.getMetadata(CONTROLLER_META_KEY, controller);
        if (isController) continue;

        // Only include classes explicitly marked with @ApiSchema
        const isSchema = Reflect.getMetadata("openapi:schema", controller);
        if (!isSchema) continue;

        components[controller.name] = generateClassSchema(controller);
    }

    return {
        components: Object.keys(components).length > 0
            ? { schemas: components }
            : undefined,
    };
}

export function OpenApiResponse(code: number = 200, model: any, description = "Successful response") {
    let dataSchema: any;

    if (typeof model === "function") {
        dataSchema = generateClassSchema(model);
    } else if (model && typeof model === "object") {
        dataSchema = inferSchemaFromExample(model);
    } else {
        dataSchema = { type: "string" };
    }

    let message = "OK";
    switch (code) {
        case 400: message = "Error"; description = "Error: Bad Request"; break;
        case 401: message = "Error"; description = "Error: Unauthorized"; break;
        case 403: message = "Error"; description = "Error: Forbidden"; break;
        case 201: message = "Created"; description = "Success: Created"; break;
        case 500: message = "Error"; description = "Error: InternalError"; break;
    }

    return {
        description,
        content: {
            "application/json": {
                schema: {
                    type: "object",
                    properties: {
                        code: { type: "number", example: code },
                        status: { type: "string", example: message },
                        data: dataSchema,
                    },
                },
            },
        },
    };
}

function inferSchemaFromExample(obj: any): any {
    if (Array.isArray(obj)) {
        return { type: "array", items: inferSchemaFromExample(obj[0] ?? {}) };
    }
    if (obj && typeof obj === "object") {
        const properties: Record<string, any> = {};
        for (const [key, value] of Object.entries(obj)) {
            properties[key] = inferType(value);
        }
        return { type: "object", properties };
    }
    return inferType(obj);
}

function inferType(value: any): any {
    const type = typeof value;
    switch (type) {
        case "string":  return { type: "string", example: value };
        case "number":  return { type: "number", example: value };
        case "boolean": return { type: "boolean", example: value };
        case "object":
            if (Array.isArray(value)) return inferSchemaFromExample(value);
            if (value === null) return { type: "null" };
            return inferSchemaFromExample(value);
        default:
            return { type: "string" };
    }
}