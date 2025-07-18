/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import { instanceToPlain, plainToInstance } from "class-transformer";
import { InternalErrorException } from "./exceptions";
import fs from "fs";
import container from "./container";
import { SystemUseError } from "./exceptions/system-exception";
import crypto, { UUID } from "crypto";
import { getMetadataStorage, validate, validateSync } from "class-validator";

export const uuid = crypto.randomUUID();

export function inject<T>(cls: new (...args: any[]) => T): T {
  try {
    return container.get(cls);
  } catch (error) {
    throw new SystemUseError(
      "Not a project class. Maybe you wanna register it first.",
    );
  }
}

export type Constructor<T = any> = new (...args: any[]) => T;

export function isConstructor(func: any): boolean {
  if (typeof func !== "function") {
    return false;
  }

  if (func === Function.prototype.bind || func instanceof RegExp) {
    return false;
  }

  if (func.prototype && typeof func.prototype === "object") {
    return true;
  }

  try {
    const instance = new (func as any)();
    return typeof instance === "object";
  } catch (e) {
    return false;
  }
}

export function formatUrl(path: string): string {
  if (typeof path !== "string") {
    throw new Error("The path must be a string");
  }
  path = path.trim();

  if (!path.startsWith("/")) {
    path = "/" + path;
  }
  path = path.replace(/\/\/+/g, "/");
  if (path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  return path;
}

export function parsedPath(ipath: string): string {
  return !ipath.startsWith("/") ? "/" + ipath : ipath;
}
export const isClassValidator = (target: Constructor) => {
  try {
    const clsval = require("class-validator");
    const result = getMetadataStorage().getTargetValidationMetadatas(
      target,
      "",
      false,
      false,
    );
    return result.length > 0;
  } catch (err: any) {
    console.log(err);
    return false;
  }
};

export interface MatchLocation {
  line: number;
  column: number;
}
export const getLineNumber = (
  filePath: string,
  rpath: string | RegExp,
): MatchLocation[] | null => {
  let numbers = [];
  try {
    const fileContent = fs.readFileSync(filePath, "utf8");
    const lines = fileContent.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(rpath);

      if (match) {
        console.log(match);
        numbers.push({
          line: i + 1,
          column: match.index ?? 0,
        });
      }
    }

    return numbers;
  } catch (error) {
    return numbers;
  }
};

export function normalizePath(base: string = "/", subPath: string = "/") {
  return `/${base}/${subPath}`.replace(/\/+/g, "/").replace(/\/$/, "");
}

export function extrctParamFromUrl(url: string) {
  const splitPart = url
    .split("/")
    .filter((x) => x.startsWith(":") || x.startsWith("?:"));
  return splitPart.map((f) => ({
    key: f.replace(/(\?|:)/g, ""),
    required: !f.startsWith("?:"),
  }));
}

export function findDuplicates(arr: string[]): string[] {
  const seen = new Set();
  const duplicates = new Set();

  for (const str of arr) {
    if (seen.has(str)) {
      duplicates.add(str);
    } else {
      seen.add(str);
    }
  }

  return Array.from(duplicates) as string[];
}

export function getDataType(expectedType: any) {
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

export function jsonToJs(value: string) {
  try {
    return JSON.parse(value);
  } catch (err: any) {
    return false;
  }
}

export function jsonToInstance(value: string, instance: Constructor) {
  try {
    const parsedValue = JSON.parse(value);
    return plainToInstance(instance, parsedValue);
  } catch (err: any) {
    return false;
  }
}

export function transformObjectByInstanceToObject(
  instance: Constructor,
  value: object,
) {
  return instanceToPlain(plainToInstance(instance, value), {
    excludeExtraneousValues: true,
    exposeUnsetFields: true,
  });
}

export const isClassValidatorClass = (target: Constructor) => {
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

type ValidationError = {
  count: number;
  errors: any;
};

export function validateRequestBody(
  target: Constructor,
  value: object,
  options: "object" | "array" = "array",
): ValidationError {
  if (!isClassValidatorClass(target)) return { count: 0, errors: {} };
  const error = validateSync(plainToInstance(target, value ? value : {}));
  const errors =
    options == "object"
      ? error.reduce((acc: any, x: any) => {
          //acc[x.property] = Object.values(x.constraints);
          acc[x.property] = x.constraints;
          return acc;
        }, {})
      : error.map((x) => ({ path: x.property, constraints: x.constraints }));
  return { count: error.length, errors } as ValidationError;
}

export function pick<T extends object>(obj: T, paths: string[]): Partial<T> {
  const result: any = {};

  for (const path of paths) {
    const keys = path.split(".");
    let source: any = obj;
    let target: any = result;

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];

      if (!(key in source)) break;

      if (i === keys.length - 1) {
        target[key] = source[key];
      } else {
        source = source[key];
        target[key] = target[key] || {};
        target = target[key];
      }
    }
  }

  return result;
}

export function exclude<T extends object>(
  obj: T | T[],
  paths: string[],
): Partial<T> | Partial<T>[] {
  if (Array.isArray(obj)) {
    return obj.map((item) => exclude(item, paths) as Partial<T>);
  }

  const clone = structuredClone(obj); // Or use lodash.cloneDeep
  for (const path of paths) {
    const keys = path.split(".");
    let target: any = clone;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in target)) break;
      target = target[keys[i]];
    }

    delete target?.[keys[keys.length - 1]];
  }

  return clone;
}
