export function generateSwaggerSchema(classType: any): any {
  const { getMetadataStorage } = require("class-validator");
  const { plainToInstance } = require("class-transformer");
  //const { isArray } = require("lodash"); // Add lodash for array check

  const metadataStorage = getMetadataStorage();
  const validationMetadata = metadataStorage.getTargetValidationMetadatas(
    classType,
    "",
    true
  );

  const schema: any = {
    type: "object",
    properties: {},
    required: [],
  };

  validationMetadata.forEach((meta: any) => {
    const propertyName = meta.propertyName;

    // Infer the type dynamically using Reflect metadata
    const propertyType = Reflect.getMetadata(
      "design:type",
      classType.prototype,
      propertyName
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
        // Attempt to infer array item type
        const arrayItemType = Reflect.getMetadata(
          "design:type",
          classType.prototype,
          propertyName + "[0]" // Attempt to get array item type. Very fragile.
        );

        if (arrayItemType) {
          swaggerProperty.type = "array";
          swaggerProperty.items = {
            type: arrayItemType.name.toLowerCase(), // basic type inference
          };

          if (arrayItemType === Object) {
            //try to infer the Object type within array
            const nestedSchema = generateSwaggerSchema(Reflect.getMetadata("design:type", classType.prototype, propertyName + "[0]"));
            swaggerProperty.items = nestedSchema;
          }
        } else {
          swaggerProperty.type = "array";
          swaggerProperty.items = {}; // Array of unknown type
        }
        break;
      case Object:
        //Nested object
        const nestedSchema = generateSwaggerSchema(Reflect.getMetadata("design:type", classType.prototype, propertyName));
        swaggerProperty = nestedSchema;
        break;
      default:
        swaggerProperty.type = propertyType?.name?.toLowerCase() || "string"; // Default to string if type cannot be inferred
    }

    schema.properties[propertyName] = swaggerProperty;

    meta.constraints?.forEach((constraint: any) => {
      switch (constraint.name) {
        case "isNotEmpty":
          if (!schema.required.includes(propertyName)) {
            schema.required.push(propertyName);
          }
          break;
        case "minLength":
          schema.properties[propertyName].minLength = constraint.constraints[0];
          break;
        case "maxLength":
          schema.properties[propertyName].maxLength = constraint.constraints[0];
          break;
        case "min":
          schema.properties[propertyName].minimum = constraint.constraints[0];
          break;
        case "max":
          schema.properties[propertyName].maximum = constraint.constraints[0];
          break;
        case "isEmail":
          schema.properties[propertyName].format = "email";
          break;
        case "isDate":
          schema.properties[propertyName].format = "date-time";
          break;
        case "isIn":
          schema.properties[propertyName].enum = constraint.constraints[0];
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
        case "isOptional":
          if (schema.required.includes(propertyName)) {
            schema.required = schema.required.filter((item:any) => item !== propertyName);
          }
          break;
        // Add more cases for other validators as needed
      }
    });
  });

  return schema;
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
