/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */

import { BadRequestException } from "../common/exceptions";

type BaseRule = {
  /** Defaults to `true`. `required: false` behaves like `optional: true`. */
  required?: boolean;
  /** Skip every check when the value is missing (`undefined`, `null` or `""`). */
  optional?: boolean;
  /** Replaces the generated messages for this field. */
  message?: string;
};

type StringRule = BaseRule & {
  type: "string";
};

type NumberRule = BaseRule & {
  type: "number";
  min?: number;
  max?: number;
  exact?: number;
};

type BooleanRule = BaseRule & {
  type: "boolean";
};

export type ValidationRule = StringRule | NumberRule | BooleanRule;

export type ValidationProps = {
  [key: string]: ValidationRule;
};

export type ValidateOptons = {
  location?: "header" | "queryparam" | "param" | "body" | "custom";
};

type ConstraintMessage = { constraint: string; message: string };

export type ValidatorIssue = {
  path: string;
  location?: ValidateOptons["location"];
  constraints: ConstraintMessage[];
};

const isMissing = (value: unknown) =>
  value === undefined || value === null || value === "";

export class Validator {
  private rules: [string, ValidationRule][] = [];
  private options: ValidateOptons = {};

  constructor(obj: ValidationProps, options?: ValidateOptons) {
    this.rules = Object.entries(obj ?? {});
    if (options) {
      this.options = options;
    }
  }

  /**
   * Validate `obj` against the rules. Numbers and booleans given as strings
   * are coerced in place. Returns `[errors, obj]`.
   */
  validate(obj: any, options?: ValidateOptons): [ValidatorIssue[], any] {
    const location = options?.location ?? this.options.location;
    const errors: ValidatorIssue[] = [];
    const target = obj ?? {};

    for (const [name, rule] of this.rules) {
      const messages = this.check(target, name, rule ?? ({} as ValidationRule));
      if (messages.length > 0) {
        errors.push({
          path: name,
          ...(location ? { location } : {}),
          constraints: rule?.message
            ? messages.map((m) => ({ ...m, message: rule.message! }))
            : messages,
        });
      }
    }

    return [errors, target];
  }

  private check(
    obj: any,
    name: string,
    rule: ValidationRule,
  ): ConstraintMessage[] {
    const value = obj[name];

    if (isMissing(value)) {
      if (rule.optional || rule.required === false) return [];
      return [{ constraint: "required", message: `${name} is required` }];
    }

    const typeError = (): ConstraintMessage[] => [
      { constraint: "type", message: `${name} must be type ${rule.type}` },
    ];

    switch (rule.type) {
      case "string":
        return typeof value === "string" ? [] : typeError();

      case "number": {
        const n =
          typeof value === "number"
            ? value
            : typeof value === "string" && value.trim() !== ""
              ? Number(value)
              : NaN;
        if (!Number.isFinite(n)) return typeError();
        obj[name] = n;
        const messages: ConstraintMessage[] = [];
        if (rule.min !== undefined && n < rule.min) {
          messages.push({
            constraint: "min",
            message: `${name} must not be less than ${rule.min}`,
          });
        }
        if (rule.max !== undefined && n > rule.max) {
          messages.push({
            constraint: "max",
            message: `${name} must not be greater than ${rule.max}`,
          });
        }
        if (rule.exact !== undefined && n !== rule.exact) {
          messages.push({
            constraint: "exact",
            message: `${name} must be exactly ${rule.exact}`,
          });
        }
        return messages;
      }

      case "boolean":
        if (!isBool(value)) return typeError();
        obj[name] = parseBoolean(value);
        return [];

      default:
        // Unknown or missing type (e.g. no decorator metadata): presence only.
        return [];
    }
  }
}

const isBool = (val: any) => {
  if (typeof val === "boolean") return true;
  if (val === 0 || val === 1 || val === "0" || val === "1") return true;
  if (val === "true" || val === "false") return true;
  return false;
};

const parseBoolean = (val: any): boolean => {
  if (typeof val === "boolean") return val;
  if (val === 1 || val === "1") return true;
  if (typeof val === "string") return val.trim().toLowerCase() === "true";
  return false;
};

export function validateOrThrow<T extends {}>(
  obj: T,
  rules: ValidationProps,
  options?: ValidateOptons,
) {
  const valid = new Validator(rules, options);
  const errors = valid.validate(obj);

  if (errors[0].length > 0) {
    throw new BadRequestException(errors[0]);
  }

  return errors[1];
}
