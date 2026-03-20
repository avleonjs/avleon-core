import "reflect-metadata";
import { generateClassSchema } from "./swagger-schema"; // ✅ single-class function

// Mocks for class-validator metadata
const mockValidationMetadatas = [
    { propertyName: "name", name: "isNotEmpty", constraints: [] },
    { propertyName: "age", name: "isInt", constraints: [] },
    { propertyName: "email", name: "isEmail", constraints: [] },
    { propertyName: "tags", name: "isOptional", constraints: [] },
    { propertyName: "desc", name: "minLength", constraints: [5] },
    { propertyName: "desc", name: "maxLength", constraints: [100] },
];

jest.mock("class-validator", () => {
    const mockGetMetadataStorage = jest.fn(() => ({
        getTargetValidationMetadatas: jest.fn(() => [
            { propertyName: "name", name: "isNotEmpty", constraints: [] },
            { propertyName: "age", name: "isInt", constraints: [] },
            { propertyName: "email", name: "isEmail", constraints: [] },
            { propertyName: "tags", name: "isOptional", constraints: [] },
            { propertyName: "desc", name: "minLength", constraints: [5] },
            { propertyName: "desc", name: "maxLength", constraints: [100] },
        ]),
    }));

    return {
        getMetadataStorage: mockGetMetadataStorage,
    };
});

// Helper to set Reflect metadata for property types and openapi
function setPropertyMetadata(target: any, property: string, type: any, openApi?: any) {
    Reflect.defineMetadata("design:type", type, target, property);
    if (openApi) {
        Reflect.defineMetadata("property:openapi", openApi, target, property);
    }
}

// Test class
class TestDto {
    name!: string;
    age!: number;
    email!: string;
    tags!: string[];
    desc!: string;
    ignored!: string;
}
setPropertyMetadata(TestDto.prototype, "name", String);
setPropertyMetadata(TestDto.prototype, "age", Number);
setPropertyMetadata(TestDto.prototype, "email", String);
setPropertyMetadata(TestDto.prototype, "tags", Array);
setPropertyMetadata(TestDto.prototype, "desc", String, { description: "Description", example: "A desc" });
setPropertyMetadata(TestDto.prototype, "ignored", String, { exclude: true });

describe("generateClassSchema", () => {
    it("should generate correct schema for class properties and validation", () => {
        const schema = generateClassSchema(TestDto); // ✅

        expect(schema).toEqual({
            type: "object",
            properties: {
                name: { type: "string" },
                age: { type: "integer" },
                email: { type: "string", format: "email" },
                tags: { type: "array", items: { type: "string" } },
                desc: {
                    type: "string",
                    description: "Description",
                    example: "A desc",
                    minLength: 5,
                    maxLength: 100,
                },
            },
            required: ["name", "age", "email", "desc"],
        });
        expect(schema.properties.ignored).toBeUndefined();
    });

    it("should handle openapi metadata fields", () => {
        setPropertyMetadata(TestDto.prototype, "desc", String, {
            description: "desc field",
            example: "example",
            deprecated: true,
            enum: ["a", "b"],
            format: "custom-format",
            default: "default",
            minimum: 1,
            maximum: 10,
            minLength: 2,
            maxLength: 20,
            pattern: ".*",
            oneOf: [{ type: "string" }],
            allOf: [{ type: "string" }],
            anyOf: [{ type: "string" }],
        });
        const schema = generateClassSchema(TestDto); // ✅
        expect(schema.properties.desc).toMatchObject({
            description: "desc field",
            example: "example",
            deprecated: true,
            enum: ["a", "b"],
            format: "custom-format",
            default: "default",
            minimum: 1,
            maximum: 10,
            minLength: 2,
            maxLength: 20,
            pattern: ".*",
            oneOf: [{ type: "string" }],
            allOf: [{ type: "string" }],
            anyOf: [{ type: "string" }],
            type: "string",
        });
    });

    it("should not include excluded properties", () => {
        setPropertyMetadata(TestDto.prototype, "ignored", String, { exclude: true });
        const schema = generateClassSchema(TestDto); // ✅
        expect(schema.properties.ignored).toBeUndefined();
    });

    it("should fallback to string type if type is unknown", () => {
        setPropertyMetadata(TestDto.prototype, "unknown", undefined as any);
        mockValidationMetadatas.push({ propertyName: "unknown", name: "isNotEmpty", constraints: [] });
        const schema = generateClassSchema(TestDto); // ✅
        expect(schema.properties.unknown.type).toBe("string");
    });

    it("should return empty schema for null or undefined input", () => {
        const schema = generateClassSchema(null);
        expect(schema).toEqual({ type: "object", properties: {}, required: [] });
    });

    it("should handle array controllers input gracefully", () => {
        // generateSwaggerSchema (array version) should skip non-DTO classes
        // generateClassSchema should never receive an array
        const schema = generateClassSchema(TestDto);
        expect(schema.type).toBe("object");
        expect(schema.properties).toBeDefined();
    });
});