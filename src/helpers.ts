import { instanceToPlain, plainToInstance } from "class-transformer";
import { InternalErrorException } from "./exceptions";
import fs from 'fs';
import container from "./container";


export function inject<T>(cls: new (...args: any[]) => T): T {
  return container.get(cls);
}

export type Constructor<T = any> = new (...args: any[]) => T;



export function formatUrl(path: string): string {
  if (typeof path !== 'string') {
    throw new Error('The path must be a string');
  }
  path = path.trim();

  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  path = path.replace(/\/\/+/g, '/');
  if (path.endsWith('/')) {
    path = path.slice(0, -1);
  }

  return path;
}


export function parsedPath(ipath: string): string {
  return !ipath.startsWith('/') ? '/' + ipath : ipath;
}
export const isClassValidator = (target: Constructor) => {
  try {
    const clsval = require("class-validator");
    const result = clsval.getMetadataStorage().getTargetValidationMetadatas(target, undefined, false, false)
    return result.length > 0;

  } catch (err: any) {

    console.log(err)
    return false;
  }
}

export interface MatchLocation {
  line: number; // 1-based line number
  column: number; // 0-based column index where the match starts
}
export const getLineNumber = (filePath: string, rpath: string | RegExp): MatchLocation[] | null => {
  let numbers = []
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8'); // Read file content
    const lines = fileContent.split('\n'); // Split content into line
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(rpath);

      if (match) {
        console.log(match)
        numbers.push({
          line: i + 1, // 1-based line number
          column: match.index ?? 0 // 0-based column index
        })
      }
    }

    return numbers; // Class not found
  } catch (error) {
    //console.error(`Error reading file: ${error.message}`);
    return numbers;
  }
}


export function normalizePath(base: string = "/", subPath: string = "/") {
  return `/${base}/${subPath}`.replace(/\/+/g, "/").replace(/\/$/, "");
}

export function extrctParamFromUrl(url: string) {
  const splitPart = url.split("/").filter(x => x.startsWith(':') || x.startsWith("?:"));
  return splitPart.map(f => ({
    key: f.replace(/(\?|:)/g, ""),
    required: !f.startsWith("?:")
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

  return Array.from(duplicates) as string[]; // Convert duplicates to an array if needed
}

export function getDataType(expectedType: any) {
  switch (expectedType.name) {
    case "Object":
      if (Array.isArray(expectedType)) {
        return 'array'
      }
      return "object"
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
    return plainToInstance(instance, parsedValue)
  } catch (err: any) {
    return false;
  }
}


export function transformObjectByInstanceToObject(instance: Constructor, value: object) {
  return instanceToPlain(plainToInstance(instance, value), { excludeExtraneousValues: true, exposeUnsetFields: true });
}

export const isClassValidatorClass = (target: Constructor) => {
  try {
    const clsval = require("class-validator");
    const result = clsval.getMetadataStorage().getTargetValidationMetadatas(target, undefined, false, false)
    return result.length > 0;
  } catch (err: any) {
    return false;
  }
}

export async function validateObjectByInstance(target: Constructor, value: object) {
  try {
    const { validateOrReject } = require("class-validator");
    const { plainToInstance } = require("class-transformer");
    await validateOrReject(plainToInstance(target, value))
  } catch (error: any) {
    if (typeof error == 'object' && Array.isArray(error)) {
      const errors = error.reduce((acc: any, x: any) => {
        //acc[x.property] = Object.values(x.constraints);
        acc[x.property] = x.constraints;
        return acc;
      }, {});

      return errors;
    } else {
      throw new InternalErrorException("Can't validate object")
    }
  }
}


