/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import { Constructor } from "./common-utils";
import { InternalErrorException } from "../exceptions"; // Need to check path relative to utils

/**
 * Map a `design:type` / `design:paramtypes` entry to the data type the router
 * validates against. Returns `undefined` when no type information was emitted
 * (tsx, esbuild, SWC without decorator metadata), which means "untyped".
 */
export function getDataType(expectedType: any) {
  if (expectedType === undefined || expectedType === null) return undefined;
  switch (expectedType.name) {
    case "Object":
      if (Array.isArray(expectedType)) {
        return "array";
      }
      return "object";
    case "String":
      return "string";
    case "Number":
      return "number";
    case "Boolean":
      return "boolean";
    default:
      return expectedType;
  }
}

export function isValidType(value: any, expectedType: any): boolean {
  if (value === undefined || value === null) return true;
  if (!expectedType) return true;

  switch (expectedType.name) {
    case "String":
      return typeof value === "string";
    case "Number":
      return typeof value === "number" || !isNaN(Number(value));
    case "Boolean":
      return typeof value === "boolean";
    default:
      return value instanceof expectedType;
  }
}

export function isValidJsonString(value: string): object | boolean {
  try {
    return JSON.parse(value);
  } catch (err: any) {
    return false;
  }
}

export const isClassValidatorClass = (target: Constructor) => {
  if (typeof target !== "function") return false;
  try {
    const clsval = require("class-validator");
    const result = clsval
      .getMetadataStorage()
      .getTargetValidationMetadatas(target, undefined, false, false);
    return result.length > 0;
  } catch (err: any) {
    return false;
  }
};

export async function validateObjectByInstance(
  target: Constructor,
  value: object = {},
  options: "object" | "array" = "array",
) {
  try {
    const { validateOrReject } = require("class-validator");
    const { plainToInstance } = require("class-transformer");
    await validateOrReject(plainToInstance(target, value));
  } catch (error: any) {
    if (typeof error == "object" && Array.isArray(error)) {
      const errors =
        options == "object"
          ? error.reduce((acc: any, x: any) => {
              //acc[x.property] = Object.values(x.constraints);
              acc[x.property] = x.constraints;
              return acc;
            }, {})
          : error.map((x) => ({
              path: x.property,
              constraints: x.constraints,
            }));
      return errors;
    } else {
      throw new InternalErrorException("Can't validate object");
    }
  }
}

export type RequestValidationIssue = {
  path: string;
  constraints: Record<string, string>;
};

export type RequestValidationResult<T = any> = {
  value: T;
  errors: RequestValidationIssue[] | null;
};

/** Default class-validator options for request DTOs. */
export const REQUEST_VALIDATION_OPTIONS = {
  whitelist: true,
  forbidNonWhitelisted: true,
};

function flattenValidationErrors(
  errors: any[],
  parent = "",
  out: RequestValidationIssue[] = [],
): RequestValidationIssue[] {
  for (const err of errors) {
    const path = parent ? `${parent}.${err.property}` : String(err.property);
    if (err.constraints && Object.keys(err.constraints).length > 0) {
      out.push({ path, constraints: err.constraints });
    }
    if (err.children?.length) {
      flattenValidationErrors(err.children, path, out);
    }
  }
  return out;
}

/**
 * Turn `value` into an instance of the DTO class `target` and validate it.
 *
 * Properties without a class-validator decorator are rejected
 * (`forbidNonWhitelisted`), so handlers only ever see declared fields.
 * On success `value` is the transformed instance; on failure `errors` lists
 * every failing property, with nested paths dotted (`address.city`).
 */
export async function transformAndValidate<T extends object>(
  target: Constructor<T>,
  value: unknown,
  options: Record<string, any> = REQUEST_VALIDATION_OPTIONS,
): Promise<RequestValidationResult<T>> {
  const { validate } = require("class-validator");
  const { plainToInstance } = require("class-transformer");
  if (
    value !== null &&
    value !== undefined &&
    (typeof value !== "object" || Array.isArray(value))
  ) {
    return {
      value: value as T,
      errors: [
        { path: "", constraints: { isObject: "payload must be an object" } },
      ],
    };
  }
  const plain = value ?? {};
  const instance = plainToInstance(target, plain) as T;
  const errors = await validate(instance, options);
  return {
    value: instance,
    errors: errors.length > 0 ? flattenValidationErrors(errors) : null,
  };
}

/** One-line summary of validation issues, for the response `message`. */
export function formatValidationMessage(
  issues: RequestValidationIssue[],
): string {
  const messages = issues.flatMap((i) => Object.values(i.constraints));
  return messages.length > 0 ? messages.join("; ") : "Validation failed";
}
