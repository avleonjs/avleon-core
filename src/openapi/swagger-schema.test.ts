import "reflect-metadata";
import { generateClassSchema } from "./swagger-schema";

// ─── Mock class-validator ────────────────────────────────────────────────────

// Mutable array — each test replaces contents via currentValidationMetadatas = [...]
// so the mock always returns whatever the test set up.
let currentValidationMetadatas: Array<{
  propertyName: string;
  name: string;
  constraints: any[];
}> = [];

jest.mock("class-validator", () => ({
  getMetadataStorage: jest.fn(() => ({
    getTargetValidationMetadatas: jest.fn(() => currentValidationMetadatas),
  })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setPropertyMetadata(
  target: any,
  property: string,
  type: any,
  openApi?: any,
) {
  Reflect.defineMetadata("design:type", type, target, property);
  if (openApi !== undefined) {
    Reflect.defineMetadata("property:openapi", openApi, target, property);
  }
}

// Baseline validators — intentionally excludes minLength/maxLength on desc so
// that openApi metadata values are not clobbered in unrelated tests.
// isInt/isEmail only set type/format; isNotEmpty is what drives required[].
const BASE_VALIDATION_METADATA = [
  { propertyName: "name", name: "isNotEmpty", constraints: [] },
  { propertyName: "age", name: "isNotEmpty", constraints: [] },
  { propertyName: "age", name: "isInt", constraints: [] },
  { propertyName: "email", name: "isNotEmpty", constraints: [] },
  { propertyName: "email", name: "isEmail", constraints: [] },
  { propertyName: "tags", name: "isOptional", constraints: [] },
];

// ─── Shared test DTO ─────────────────────────────────────────────────────────

class TestDto {
  name!: string;
  age!: number;
  email!: string;
  tags!: string[];
  desc!: string;
  ignored!: string;
}

function applyBaseMetadata() {
  setPropertyMetadata(TestDto.prototype, "name", String);
  setPropertyMetadata(TestDto.prototype, "age", Number);
  setPropertyMetadata(TestDto.prototype, "email", String);
  setPropertyMetadata(TestDto.prototype, "tags", Array);
  setPropertyMetadata(TestDto.prototype, "desc", String, {
    description: "Description",
    example: "A desc",
  });
  setPropertyMetadata(TestDto.prototype, "ignored", String, { exclude: true });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("generateClassSchema", () => {
  beforeEach(() => {
    applyBaseMetadata();
    currentValidationMetadatas = [...BASE_VALIDATION_METADATA];
  });

  // ── Core schema generation ──────────────────────────────────────────────

  it("should generate correct schema for class properties and validation", () => {
    currentValidationMetadatas = [
      ...BASE_VALIDATION_METADATA,
      { propertyName: "desc", name: "isNotEmpty", constraints: [] },
      { propertyName: "desc", name: "minLength", constraints: [5] },
      { propertyName: "desc", name: "maxLength", constraints: [100] },
    ];

    const schema = generateClassSchema(TestDto);

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
  });

  it("should not include excluded properties", () => {
    const schema = generateClassSchema(TestDto);
    expect(schema.properties.ignored).toBeUndefined();
  });

  it("should filter out 'constructor' from properties", () => {
    const schema = generateClassSchema(TestDto);
    expect(Object.keys(schema.properties)).not.toContain("constructor");
  });

  // ── required array behaviour ────────────────────────────────────────────

  it("should add a property to required when isNotEmpty is present", () => {
    const schema = generateClassSchema(TestDto);
    expect(schema.required).toContain("name");
  });

  it("should add a property to required when isDefined is present", () => {
    currentValidationMetadatas = [
      ...BASE_VALIDATION_METADATA,
      { propertyName: "email", name: "isDefined", constraints: [] },
    ];
    const schema = generateClassSchema(TestDto);
    expect(schema.required).toContain("email");
  });

  it("should remove a property from required when isOptional is present", () => {
    // tags has isOptional in BASE_VALIDATION_METADATA
    const schema = generateClassSchema(TestDto);
    expect(schema.required).not.toContain("tags");
  });

  it("should omit the required key entirely when no required properties exist", () => {
    currentValidationMetadatas = [
      { propertyName: "name", name: "isOptional", constraints: [] },
      { propertyName: "age", name: "isOptional", constraints: [] },
    ];
    const schema = generateClassSchema(TestDto);
    expect(schema.required).toBeUndefined();
  });

  // ── Type mapping ────────────────────────────────────────────────────────

  it("should map String to type string", () => {
    const schema = generateClassSchema(TestDto);
    expect(schema.properties.name.type).toBe("string");
  });

  it("should map Number to type number, overridden to integer by isInt", () => {
    const schema = generateClassSchema(TestDto);
    expect(schema.properties.age.type).toBe("integer");
  });

  it("should map Array to type array with string items", () => {
    const schema = generateClassSchema(TestDto);
    expect(schema.properties.tags).toEqual({
      type: "array",
      items: { type: "string" },
    });
  });

  it("should map Boolean property to type boolean", () => {
    class BoolDto {
      active!: boolean;
    }
    setPropertyMetadata(BoolDto.prototype, "active", Boolean);
    currentValidationMetadatas = [
      { propertyName: "active", name: "isBoolean", constraints: [] },
    ];
    const schema = generateClassSchema(BoolDto);
    expect(schema.properties.active.type).toBe("boolean");
  });

  it("should map Date property to string with date-time format", () => {
    class DateDto {
      createdAt!: Date;
    }
    setPropertyMetadata(DateDto.prototype, "createdAt", Date);
    currentValidationMetadatas = [
      { propertyName: "createdAt", name: "isDate", constraints: [] },
    ];
    const schema = generateClassSchema(DateDto);
    expect(schema.properties.createdAt).toMatchObject({
      type: "string",
      format: "date-time",
    });
  });

  it("should fall back to string type if design:type is undefined", () => {
    Reflect.defineMetadata("design:type", undefined, TestDto.prototype, "name");
    currentValidationMetadatas = [
      { propertyName: "name", name: "isNotEmpty", constraints: [] },
    ];
    const schema = generateClassSchema(TestDto);
    expect(schema.properties.name.type).toBe("string");
  });

  it("should use $ref for a nested DTO class type", () => {
    class NestedDto {}
    class ParentDto {
      child!: NestedDto;
    }
    setPropertyMetadata(ParentDto.prototype, "child", NestedDto);
    currentValidationMetadatas = [];
    const schema = generateClassSchema(ParentDto);
    expect(schema.properties.child.$ref).toBe("#/components/schemas/NestedDto");
  });

  // ── Validation constraint mapping ───────────────────────────────────────

  it("should apply minLength and maxLength from validation metadata", () => {
    // Dedicated DTO with no openApi metadata — only validator constraints apply
    class ConstraintDto {
      desc!: string;
    }
    setPropertyMetadata(ConstraintDto.prototype, "desc", String);
    currentValidationMetadatas = [
      { propertyName: "desc", name: "minLength", constraints: [5] },
      { propertyName: "desc", name: "maxLength", constraints: [100] },
    ];
    const schema = generateClassSchema(ConstraintDto);
    expect(schema.properties.desc.minLength).toBe(5);
    expect(schema.properties.desc.maxLength).toBe(100);
  });

  it("should apply minimum and maximum from min/max validators", () => {
    class RangeDto {
      score!: number;
    }
    setPropertyMetadata(RangeDto.prototype, "score", Number);
    currentValidationMetadatas = [
      { propertyName: "score", name: "min", constraints: [0] },
      { propertyName: "score", name: "max", constraints: [100] },
    ];
    const schema = generateClassSchema(RangeDto);
    expect(schema.properties.score.minimum).toBe(0);
    expect(schema.properties.score.maximum).toBe(100);
  });

  it("should apply enum from isIn validator", () => {
    class EnumDto {
      role!: string;
    }
    setPropertyMetadata(EnumDto.prototype, "role", String);
    currentValidationMetadatas = [
      {
        propertyName: "role",
        name: "isIn",
        constraints: [["admin", "user", "guest"]],
      },
    ];
    const schema = generateClassSchema(EnumDto);
    expect(schema.properties.role.enum).toEqual(["admin", "user", "guest"]);
  });

  it("should apply format email from isEmail validator", () => {
    const schema = generateClassSchema(TestDto);
    expect(schema.properties.email.format).toBe("email");
  });

  it("should apply type string from isString validator", () => {
    class StrDto {
      label!: string;
    }
    setPropertyMetadata(StrDto.prototype, "label", String);
    currentValidationMetadatas = [
      { propertyName: "label", name: "isString", constraints: [] },
    ];
    const schema = generateClassSchema(StrDto);
    expect(schema.properties.label.type).toBe("string");
  });

  it("should apply type number from isNumber validator", () => {
    class NumDto {
      price!: number;
    }
    setPropertyMetadata(NumDto.prototype, "price", Number);
    currentValidationMetadatas = [
      { propertyName: "price", name: "isNumber", constraints: [] },
    ];
    const schema = generateClassSchema(NumDto);
    expect(schema.properties.price.type).toBe("number");
  });

  // ── OpenAPI metadata fields ─────────────────────────────────────────────
  // Each test uses a fresh, isolated DTO with no validator constraints so that
  // the validator pass (which runs after openApi meta is merged) cannot
  // overwrite values asserted here.

  it("should apply all supported openApi metadata fields to a property", () => {
    class OpenApiDto {
      desc!: string;
    }
    setPropertyMetadata(OpenApiDto.prototype, "desc", String, {
      description: "desc field",
      example: "example",
      deprecated: true,
      enum: ["a", "b"],
      format: "uuid",
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
    currentValidationMetadatas = [];

    const schema = generateClassSchema(OpenApiDto);
    expect(schema.properties.desc).toMatchObject({
      type: "string",
      description: "desc field",
      example: "example",
      deprecated: true,
      enum: ["a", "b"],
      format: "uuid",
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
  });

  it("should strip invalid format values and not include them in the schema", () => {
    class FmtDto {
      field!: string;
    }
    setPropertyMetadata(FmtDto.prototype, "field", String, {
      format: "not-a-valid-format",
    });
    currentValidationMetadatas = [];

    const schema = generateClassSchema(FmtDto);
    expect(schema.properties.field.format).toBeUndefined();
  });

  it("should not expose internal openApi fields (exclude, isArray, required) on schema property", () => {
    class InternalDto {
      field!: string;
    }
    setPropertyMetadata(InternalDto.prototype, "field", String, {
      description: "safe",
      exclude: false,
      isArray: true,
      required: true,
    });
    currentValidationMetadatas = [];

    const schema = generateClassSchema(InternalDto);
    expect(schema.properties.field.exclude).toBeUndefined();
    expect(schema.properties.field.isArray).toBeUndefined();
    expect(schema.properties.field.required).toBeUndefined();
  });

  it("should apply nullable, readOnly, writeOnly, and title from openApi metadata", () => {
    class MetaDto {
      secret!: string;
    }
    setPropertyMetadata(MetaDto.prototype, "secret", String, {
      nullable: true,
      readOnly: true,
      writeOnly: false,
      title: "Secret Field",
    });
    currentValidationMetadatas = [];

    const schema = generateClassSchema(MetaDto);
    expect(schema.properties.secret).toMatchObject({
      nullable: true,
      readOnly: true,
      writeOnly: false,
      title: "Secret Field",
    });
  });

  // ── Guard / edge cases ──────────────────────────────────────────────────

  it("should return empty schema for null input", () => {
    const schema = generateClassSchema(null);
    expect(schema).toEqual({ type: "object", properties: {}, required: [] });
  });

  it("should return empty schema for undefined input", () => {
    const schema = generateClassSchema(undefined);
    expect(schema).toEqual({ type: "object", properties: {}, required: [] });
  });

  it("should return empty schema for a plain object without a prototype", () => {
    const schema = generateClassSchema({});
    expect(schema).toEqual({ type: "object", properties: {}, required: [] });
  });

  it("should gracefully handle a class that throws on instantiation", () => {
    class ThrowingDto {
      constructor() {
        throw new Error("boom");
      }
    }
    setPropertyMetadata(ThrowingDto.prototype, "value", String);
    currentValidationMetadatas = [
      { propertyName: "value", name: "isNotEmpty", constraints: [] },
    ];

    expect(() => generateClassSchema(ThrowingDto)).not.toThrow();
    const schema = generateClassSchema(ThrowingDto);
    expect(schema.properties.value).toBeDefined();
  });

  it("should create a string fallback for a property that appears only in validation metadata", () => {
    currentValidationMetadatas = [
      { propertyName: "phantom", name: "isNotEmpty", constraints: [] },
    ];
    const schema = generateClassSchema(TestDto);
    expect(schema.properties.phantom).toBeDefined();
    expect(schema.properties.phantom.type).toBe("string");
    expect(schema.required).toContain("phantom");
  });
});

