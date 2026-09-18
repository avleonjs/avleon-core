import { Validator, ValidationProps } from "./validation";

describe("Validator.validate", () => {
    const rules: ValidationProps = {
        username: { type: "string", required: true },
        age: { type: "number", required: true },
        isActive: { type: "boolean", required: true },
    };

    it("should pass validation for correct types", () => {
        const validator = new Validator(rules);
        const input = { username: "john", age: 25, isActive: true };
        const [errors, validated] = validator.validate(input);
        expect(errors).toEqual([]);
        expect(validated).toEqual({ username: "john", age: 25, isActive: true });
    });

    it("should fail when required fields are missing", () => {
        const validator = new Validator(rules);
        const input = { age: 30 };
        const [errors] = validator.validate(input);
        expect(errors).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ path: "username" }),
                expect.objectContaining({ path: "isActive" }),
            ])
        );
    });

    it("should fail when types are incorrect", () => {
        const validator = new Validator(rules);
        const input = { username: 123, age: "notanumber", isActive: "notabool" };
        const [errors] = validator.validate(input);
        expect(errors).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ path: "username" }),
                expect.objectContaining({ path: "age" }),
                expect.objectContaining({ path: "isActive" }),
            ])
        );
    });

    it("should coerce number and boolean types", () => {
        const validator = new Validator(rules);
        const input = { username: "john", age: "42", isActive: "true" };
        const [errors, validated] = validator.validate(input);
        expect(errors).toEqual([]);
        expect(validated.age).toBe(42);
        expect(validated.isActive).toBe(true);
    });

    it("should handle boolean values as 0/1 and 'true'/'false'", () => {
        const validator = new Validator(rules);
        const input1 = { username: "john", age: 20, isActive: 1 };
        const input2 = { username: "john", age: 20, isActive: "false" };
        const [errors1, validated1] = validator.validate(input1);
        const [errors2, validated2] = validator.validate(input2);
        expect(errors1).toEqual([]);
        expect(validated1.isActive).toBe(true);
        expect(errors2).toEqual([]);
        expect(validated2.isActive).toBe(false);
    });

    it("should include location in error if option is set", () => {
        const validator = new Validator(rules, { location: "body" });
        const input = { age: 30 };
        const [errors] = validator.validate(input);
        expect(errors[0]).toHaveProperty("location", "body");
    });
});