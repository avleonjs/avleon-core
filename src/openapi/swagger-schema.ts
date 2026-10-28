/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import { getMetadataStorage } from "class-validator";
import { CONTROLLER_META_KEY } from "../common/container";
import { ParamSchema } from "./openapi";
import {
  getRegisteredSchemaProperties,
  getTransformerProperties,
  getTransformerType,
  registerSchemaProperty,
} from "./schema-properties";

// Decorator to add OpenAPI metadata to properties
export function OpenApiProperty(
  options?: ParamSchema & {
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
  },
) {
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
    registerSchemaProperty(target, propertyKey);
  };
}

function extractOpenApiFields(meta: any): any {
  const result: any = {};
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
    "nullable",
  ];

  // Valid JSON Schema formats
  const validFormats = [
    "date-time",
    "date",
    "time",
    "duration",
    "email",
    "idn-email",
    "hostname",
    "idn-hostname",
    "ipv4",
    "ipv6",
    "uri",
    "uri-reference",
    "iri",
    "iri-reference",
    "uuid",
    "uri-template",
    "json-pointer",
    "relative-json-pointer",
    "regex",
    "int32",
    "int64",
    "float",
    "double",
    "byte",
    "binary",
    "password",
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

export type ClassSchemaOptions = {
  /**
   * Inline nested DTO schemas instead of emitting `$ref`s. Fastify route
   * schemas need this: they can't resolve `#/components/schemas/*`.
   */
  inline?: boolean;
  /**
   * When given (and `inline` is off), every nested DTO referenced through a
   * `$ref` gets its schema added here, keyed by class name.
   */
  components?: Record<string, any>;
};

/** Classes seen behind a `$ref`, so route schemas can inline them later. */
const refClasses = new Map<string, Function>();

const PRIMITIVES = new Set<any>([
  String,
  Number,
  Boolean,
  Date,
  Array,
  Object,
  Function,
  Promise,
  Symbol,
  BigInt,
]);

function isDtoClass(type: any): type is Function {
  return (
    typeof type === "function" && !PRIMITIVES.has(type) && !!type.prototype
  );
}

function nestedSchema(
  type: Function,
  options: ClassSchemaOptions,
  stack: Set<Function>,
): any {
  if (options.inline) {
    if (stack.has(type)) return { type: "object" };
    return buildClassSchema(type, options, stack);
  }
  const name = type.name;
  refClasses.set(name, type);
  if (options.components && !(name in options.components)) {
    options.components[name] = { type: "object" }; // placeholder for cycles
    options.components[name] = buildClassSchema(type, options, new Set([type]));
  }
  return { $ref: `#/components/schemas/${name}` };
}

function collectPropertyNames(
  classType: Function,
  validationMetadata: any[],
): string[] {
  const names = new Set<string>();
  for (const key of getRegisteredSchemaProperties(classType)) names.add(key);
  for (const m of validationMetadata) {
    if (typeof m?.propertyName === "string") names.add(m.propertyName);
  }
  for (const key of getTransformerProperties(classType)) names.add(key);
  names.delete("constructor");
  names.delete("");
  return [...names];
}

function buildClassSchema(
  classType: any,
  options: ClassSchemaOptions,
  stack: Set<Function>,
): any {
  const schema: any = { type: "object", properties: {}, required: [] };
  if (!classType || !classType.prototype) return schema;

  const innerStack = new Set(stack).add(classType);
  const validationMetadata: any[] =
    getMetadataStorage().getTargetValidationMetadatas(
      classType,
      "",
      true,
      false,
    ) ?? [];
  const prototype = classType.prototype;

  for (const propertyName of collectPropertyNames(
    classType,
    validationMetadata,
  )) {
    const openApiMeta: any = Reflect.getMetadata(
      "property:openapi",
      prototype,
      propertyName,
    );
    if (openApiMeta?.exclude) continue;

    const propertyType = Reflect.getMetadata(
      "design:type",
      prototype,
      propertyName,
    );
    const elementType = getTransformerType(classType, propertyName);
    let swaggerProperty: any = {};

    switch (propertyType) {
      case String:
        swaggerProperty.type = "string";
        break;
      case Number:
        swaggerProperty.type = "number";
        break;
      case Boolean:
        swaggerProperty.type = "boolean";
        break;
      case Date:
        swaggerProperty.type = "string";
        swaggerProperty.format = "date-time";
        break;
      case Array:
        swaggerProperty.type = "array";
        swaggerProperty.items = isDtoClass(elementType)
          ? nestedSchema(elementType, options, innerStack)
          : { type: "string" };
        break;
      case Object:
        swaggerProperty = isDtoClass(elementType)
          ? nestedSchema(elementType, options, innerStack)
          : { type: "object" };
        break;
      default:
        if (isDtoClass(propertyType)) {
          swaggerProperty = nestedSchema(propertyType, options, innerStack);
        } else if (isDtoClass(elementType)) {
          swaggerProperty = nestedSchema(elementType, options, innerStack);
        } else {
          swaggerProperty.type = propertyType?.name?.toLowerCase() || "string";
        }
    }

    if (openApiMeta) {
      const {
        required: _required,
        exclude: _exclude,
        isArray,
        ...safeOpenApiMeta
      } = openApiMeta;
      if (openApiMeta.format === "binary") {
        swaggerProperty =
          isArray || propertyType === Array
            ? {
                type: "array",
                items: { type: "string", format: "binary" },
                description: openApiMeta.description || "Array of files",
              }
            : {
                type: "string",
                format: "binary",
                description: openApiMeta.description || "File upload",
              };
      } else {
        const fields = extractOpenApiFields(safeOpenApiMeta);
        if (safeOpenApiMeta.type && !swaggerProperty.$ref)
          fields.type = safeOpenApiMeta.type;
        if (safeOpenApiMeta.items) fields.items = safeOpenApiMeta.items;
        swaggerProperty = { ...swaggerProperty, ...fields };
      }
    }

    schema.properties[propertyName] = swaggerProperty;
  }

  for (const meta of validationMetadata) {
    const propertyName = meta.propertyName;
    if (!propertyName) continue;
    if (!schema.properties[propertyName]) {
      schema.properties[propertyName] = { type: "string" };
    }
    const property = schema.properties[propertyName];
    const isRef = typeof property.$ref === "string";

    switch (meta.name) {
      case "isNotEmpty":
      case "isDefined":
        if (!schema.required.includes(propertyName))
          schema.required.push(propertyName);
        break;
      case "isOptional":
        schema.required = schema.required.filter(
          (item: any) => item !== propertyName,
        );
        break;
      default:
        // A $ref must stand alone, so constraints are not merged into it.
        if (isRef) break;
        switch (meta.name) {
          case "minLength":
            property.minLength = meta.constraints[0];
            break;
          case "maxLength":
            property.maxLength = meta.constraints[0];
            break;
          case "min":
            property.minimum = meta.constraints[0];
            break;
          case "max":
            property.maximum = meta.constraints[0];
            break;
          case "isEmail":
            property.format = "email";
            break;
          case "isDate":
            property.format = "date-time";
            break;
          case "isIn":
            property.enum = meta.constraints[0];
            break;
          case "isNumber":
            property.type = "number";
            break;
          case "isInt":
            property.type = "integer";
            break;
          case "isBoolean":
            property.type = "boolean";
            break;
          case "isString":
            property.type = "string";
            break;
        }
    }
  }

  if (schema.required.length === 0) delete schema.required;
  return schema;
}

/**
 * JSON schema for a DTO class, built from class-validator, class-transformer
 * and `@OpenApiProperty` metadata. The class is never instantiated and only
 * decorated properties are listed (methods and accessors are not).
 *
 * Nested DTOs become `$ref`s by default; pass `{ inline: true }` to embed
 * them, or `{ components }` to collect their schemas.
 */
export function generateClassSchema(
  classType: any,
  options: ClassSchemaOptions = {},
): any {
  return buildClassSchema(classType, options, new Set());
}

/** @deprecated Use {@link generateClassSchema}; this is an alias. */
export const CreateSwaggerObjectSchema = generateClassSchema;

/**
 * Replace every `#/components/schemas/X` `$ref` in `schema` whose class was
 * seen by {@link generateClassSchema} with that class's inline schema.
 * Unknown refs are left untouched.
 */
export function inlineSchemaRefs(schema: any): any {
  if (Array.isArray(schema)) return schema.map((s) => inlineSchemaRefs(s));
  if (!schema || typeof schema !== "object") return schema;
  const ref = schema.$ref;
  if (typeof ref === "string" && ref.startsWith("#/components/schemas/")) {
    const cls = refClasses.get(ref.slice("#/components/schemas/".length));
    if (!cls) return schema;
    const { $ref: _ref, ...rest } = schema;
    return {
      ...generateClassSchema(cls, { inline: true }),
      ...inlineSchemaRefs(rest),
    };
  }
  const out: any = {};
  for (const [k, v] of Object.entries(schema)) out[k] = inlineSchemaRefs(v);
  return out;
}

/**
 * `components.schemas` for every class marked with `@OpenApiSchema()` (plus
 * any `extraClasses`) and every nested DTO they reference, so each emitted
 * `$ref` resolves.
 */
export function generateSwaggerSchema(
  controllers: any[],
  extraClasses: Function[] = [],
): any {
  if (!Array.isArray(controllers)) {
    return generateClassSchema(controllers);
  }

  const components: Record<string, any> = {};

  for (const cls of [...controllers, ...extraClasses]) {
    if (!cls || typeof cls !== "function") continue;
    if (!cls.prototype) continue;

    // Skip @ApiController classes
    if (Reflect.getMetadata(CONTROLLER_META_KEY, cls)) continue;

    const isSchema =
      extraClasses.includes(cls) || Reflect.getMetadata("openapi:schema", cls);
    if (!isSchema) continue;

    components[cls.name] = generateClassSchema(cls, { components });
  }

  return {
    components:
      Object.keys(components).length > 0 ? { schemas: components } : undefined,
  };
}

export function OpenApiResponse(
  code: number = 200,
  model: any,
  description = "Successful response",
) {
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
    case 400:
      message = "Error";
      description = "Error: Bad Request";
      break;
    case 401:
      message = "Error";
      description = "Error: Unauthorized";
      break;
    case 403:
      message = "Error";
      description = "Error: Forbidden";
      break;
    case 201:
      message = "Created";
      description = "Success: Created";
      break;
    case 500:
      message = "Error";
      description = "Error: InternalError";
      break;
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
    case "string":
      return { type: "string", example: value };
    case "number":
      return { type: "number", example: value };
    case "boolean":
      return { type: "boolean", example: value };
    case "object":
      if (Array.isArray(value)) return inferSchemaFromExample(value);
      if (value === null) return { type: "null" };
      return inferSchemaFromExample(value);
    default:
      return { type: "string" };
  }
}
