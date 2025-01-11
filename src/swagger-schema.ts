export function generateSwaggerSchema(classType: any) {
    const { getMetadataStorage } = require("class-validator");
    const { plainToInstance } = require("class-transformer");

    const metadataStorage = getMetadataStorage();
    const validationMetadata = metadataStorage.getTargetValidationMetadatas(
        classType,
        "",
        true,
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
            propertyName,
        );

        schema.properties[propertyName] = {
            type: propertyType?.name.toLowerCase() || "string", // Default to string if type cannot be inferred
        };

        if (meta.name === "isNotEmpty") {
            schema.required.push(propertyName);
        }

        if (meta.name === "minLength") {
            schema.properties[propertyName].minLength = meta.constraints[0];
        }
    });

    return schema;
}

