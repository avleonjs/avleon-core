/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import { getMetadataStorage } from "class-validator";

export function generateSwaggerSchema(classType: any): any {
  const metadataStorage = getMetadataStorage();
  const validationMetadata = metadataStorage.getTargetValidationMetadatas(
    classType,
    "",
    true,
    false,
  );

  const schema: any = {
    type: "object",
    properties: {},
    required: [],
  };

  const prototype = classType.prototype;

  const propertyKeys = new Set([
    ...Object.getOwnPropertyNames(prototype),
    ...validationMetadata.map((m: any) => m.propertyName),
  ]);

  propertyKeys.forEach((propertyName) => {
    if (!propertyName || propertyName === "constructor") return;

    const openApiMeta: any = Reflect.getMetadata(
      "property:openapi",
      prototype,
      propertyName,
    );

    if (openApiMeta?.exclude) return;

    const propertyType = Reflect.getMetadata(
      "design:type",
      prototype,
      propertyName,
    );

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
        swaggerProperty.items = { type: "string" }; // fallback
        break;
      case Object:
        swaggerProperty = generateSwaggerSchema(propertyType);
        break;
      default:
        swaggerProperty.type = propertyType?.name?.toLowerCase() || "string";
    }

    // Apply OpenApi metadata if present
    if (openApiMeta) {
      swaggerProperty = {
        ...swaggerProperty,
        ...extractOpenApiFields(openApiMeta),
      };
    }

    schema.properties[propertyName] = swaggerProperty;
  });

  // Handle validation rules
  validationMetadata.forEach((meta: any) => {
    const propertyName = meta.propertyName;
    switch (meta.name) {
      case "isNotEmpty":
        if (!schema.required.includes(propertyName)) {
          schema.required.push(propertyName);
        }
        break;
      case "isDefined":
        if (!schema.required.includes(propertyName)) {
          schema.required.push(propertyName);
        }
        break;
      case "isOptional":
        schema.required = schema.required.filter(
          (item: any) => item !== propertyName,
        );
        break;
      case "minLength":
        schema.properties[propertyName].minLength = meta.constraints[0];
        break;
      case "maxLength":
        schema.properties[propertyName].maxLength = meta.constraints[0];
        break;
      case "min":
        schema.properties[propertyName].minimum = meta.constraints[0];
        break;
      case "max":
        schema.properties[propertyName].maximum = meta.constraints[0];
        break;
      case "isEmail":
        schema.properties[propertyName].format = "email";
        break;
      case "isDate":
        schema.properties[propertyName].format = "date-time";
        break;
      case "isIn":
        schema.properties[propertyName].enum = meta.constraints[0];
        break;
      case "isNumber":
        schema.properties[propertyName].type = "number";
        break;
      case "isInt":
        schema.properties[propertyName].type = "integer";
        break;
      case "isBoolean":
        schema.properties[propertyName].type = "boolean";
        break;
      case "isString":
        schema.properties[propertyName].type = "string";
        break;
    }
  });
  return schema;
}

function extractOpenApiFields(meta: any): any {
  const result: any = {};
  const fields = [
    "description",
    "summary",
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
  ];

  fields.forEach((field) => {
    if (meta[field] !== undefined) {
      result[field] = meta[field];
    }
  });

  return result;
}

// export function generateSwaggerSchema(classType: any) {
//   const { getMetadataStorage } = require("class-validator");
//   const { plainToInstance } = require("class-transformer");

//   const metadataStorage = getMetadataStorage();
//   const validationMetadata = metadataStorage.getTargetValidationMetadatas(
//     classType,
//     "",
//     true,
//   );

//   const schema: any = {
//     type: "object",
//     properties: {},
//     required: [],
//   };

//   validationMetadata.forEach((meta: any) => {
//     const propertyName = meta.propertyName;

//     // Infer the type dynamically using Reflect metadata
//     const propertyType = Reflect.getMetadata(
//       "design:type",
//       classType.prototype,
//       propertyName,
//     );

//     schema.properties[propertyName] = {
//       type: propertyType?.name.toLowerCase() || "string", // Default to string if type cannot be inferred
//     };

//     if (meta.name === "isNotEmpty") {
//       schema.required.push(propertyName);
//     }

//     if (meta.name === "minLength") {
//       schema.properties[propertyName].minLength = meta.constraints[0];
//     }
//   });

//   return schema;
// }
