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
      ]),
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
      ]),
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
describe("Validator rules", () => {
  it("accepts 0 for a required number", () => {
    const [errors, value] = new Validator({ n: { type: "number" } }).validate({
      n: 0,
    });
    expect(errors).toEqual([]);
    expect(value.n).toBe(0);

    const [fromString] = new Validator({ n: { type: "number" } }).validate({
      n: "0",
    });
    expect(fromString).toEqual([]);
  });

  it("accepts false and 0 for a required boolean", () => {
    const [errors, value] = new Validator({ b: { type: "boolean" } }).validate({
      b: 0,
    });
    expect(errors).toEqual([]);
    expect(value.b).toBe(false);
  });

  it("enforces min, max and exact", () => {
    const v = new Validator({ n: { type: "number", min: 1, max: 10 } });
    expect(
      v.validate({ n: 0 })[0][0].constraints.map((c: any) => c.constraint),
    ).toEqual(["min"]);
    expect(
      v.validate({ n: 11 })[0][0].constraints.map((c: any) => c.constraint),
    ).toEqual(["max"]);
    expect(v.validate({ n: 5 })[0]).toEqual([]);

    const exact = new Validator({ n: { type: "number", exact: 3 } });
    expect(exact.validate({ n: 4 })[0][0].constraints[0].constraint).toBe(
      "exact",
    );
    expect(exact.validate({ n: "3" })[0]).toEqual([]);
  });

  it("skips missing optional fields but still checks present ones", () => {
    const v = new Validator({
      a: { type: "string", optional: true },
      b: { type: "number", required: false },
    });
    expect(v.validate({})[0]).toEqual([]);
    expect(v.validate({ b: "abc" })[0].map((e: any) => e.path)).toEqual(["b"]);
  });

  it("rejects a blank string for a number instead of coercing it to 0", () => {
    const [errors] = new Validator({
      n: { type: "number", optional: true },
    }).validate({ n: " " });
    expect(errors.map((e: any) => e.path)).toEqual(["n"]);
  });

  it("uses the custom message", () => {
    const [errors] = new Validator({
      n: { type: "number", message: "bad n" },
    }).validate({});
    expect(errors[0].constraints[0].message).toBe("bad n");
  });
});
