/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */

import { BadRequestException } from "./exceptions";

class PValidationRule<T> {
  name: string;
  type: T;
  message?: string;

  constructor(name: string, type: T, message?: string) {
    this.name = name;
    this.type = type;
    this.message = message;
  }
}

type BaseRule = {
  required?: boolean;
  optional?: boolean;
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

class Validator {
  private rules: PValidationRule<any>[] = [];

  constructor(obj: ValidationProps) {
    this.init(obj);
  }

  private init(obj: ValidationProps) {
    Object.keys(obj).forEach((key) => {
      const rule = obj[key];
      this.rules.push(
        new PValidationRule<typeof rule.type>(key, rule.type, rule.message),
      );
    });
  }

  validate(obj: any | Array<any>) {
    const erors: any[] = [];

    this.rules.forEach((k) => {
      const r = Object.keys(obj).find((key) => key == k.name);
      let messages: any = [];
      if (!r || obj[r] == undefined || obj[r] == "") {
        messages.push({
          constraint: "required",
          message: k.name + " is required",
        });
      }

      if (k.type == "string" && typeof obj[k.name] != "string") {
        messages.push({
          constraint: "type",
          message: `${k.name} must be type ${k.type}`,
        });
      }
      if (k.type == "number" && !parseInt(obj[k.name])) {
        messages.push({
          constraint: "type",
          message: `${k.name} must be type ${k.type}`,
        });
      }

      if (k.type == "number") {
        obj[k.name] = parseInt(obj[k.name]);
      }
      if (k.type == "boolean" && !isBool(obj[k.name])) {
        messages.push({
          constraint: "type",
          message: `${k.name} must be type ${k.type}`,
        });
      }
      if (k.type == "boolean") {
        obj[k.name] = parseBoolean(obj[k.name]);
      }
      if (messages.length > 0) {
        erors.push({
          path: k.name,
          messages: messages,
        });
      }
    });

    return [erors, obj];
  }
}

const isBool = (val: any) => {
  if (typeof val == "boolean") return true;
  if (parseInt(val) == 0 || parseInt(val) == 1) return true;
  if (val == "true" || val == "false") return true;

  return false;
};

const parseBoolean = (val: any): boolean => {
  if (typeof val === "boolean") return val;

  // if (typeof val === "number") {
  //   return val !== 0; // Common convention: 0 → false, any other number → true
  // }

  if (parseInt(val) == 1) return true;
  if (typeof val === "string") {
    const normalized = val.trim().toLowerCase();
    return normalized === "true";
  }
  return false; // Default for unsupported types (null, undefined, objects, etc.)
};

export function validateOrThrow<T extends {}>(obj: T, rules: ValidationProps) {
  const valid = new Validator(rules);
  const errors = valid.validate(obj);

  if (errors[0].length > 0) {
    throw new BadRequestException(errors[0]);
  }

  return errors[1];
}
