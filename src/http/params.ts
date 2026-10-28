/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */

import {
  PARAM_META_KEY,
  QUERY_META_KEY,
  REQUEST_BODY_META_KEY,
  REQUEST_HEADER_META_KEY,
  REQUEST_USER_META_KEY,
} from "../common/container";
import { getDataType, isClassValidatorClass } from "../common/helpers";

type ParameterOptions = {
  required?: boolean;
  validate?: boolean;
  /**
   * The parameter's type. Only needed when the compiler does not emit
   * decorator metadata (tsx, esbuild, SWC), e.g. `@Body({ type: CreateUserDto })`.
   */
  type?: any;
};

/**
 * Best-effort parameter names from the function source. Only used for
 * diagnostics, so any failure yields an empty list.
 */
function readParameterNames(fn: unknown): string[] {
  try {
    if (typeof fn !== "function") return [];
    const src = Function.prototype.toString.call(fn);
    const open = src.indexOf("(");
    if (open === -1) return [];
    let depth = 0;
    let close = -1;
    for (let i = open; i < src.length; i++) {
      const ch = src[i];
      if (ch === "(" || ch === "{" || ch === "[") depth++;
      else if (ch === ")" || ch === "}" || ch === "]") {
        depth--;
        if (depth === 0) {
          close = i;
          break;
        }
      }
    }
    if (close === -1) return [];
    const names: string[] = [];
    let current = "";
    depth = 0;
    for (const ch of src.slice(open + 1, close)) {
      if (ch === "(" || ch === "{" || ch === "[") depth++;
      if (ch === ")" || ch === "}" || ch === "]") depth--;
      if (ch === "," && depth === 0) {
        names.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    if (current.trim() !== "") names.push(current);
    return names.map((n) => {
      const m = n
        .replace(/\/\*.*?\*\//gs, "")
        .trim()
        .match(/^(?:\.\.\.)?\s*([A-Za-z_$][\w$]*)/);
      return m ? m[1] : "";
    });
  } catch {
    return [];
  }
}

function createParamDecorator(
  type: string | symbol,
): (
  key?: string | ParameterOptions,
  options?: ParameterOptions,
) => ParameterDecorator {
  return function (
    key?: string | ParameterOptions,
    options: ParameterOptions = {},
  ): ParameterDecorator {
    if (key !== null && typeof key === "object") {
      options = key;
      key = undefined;
    }
    return function (target: any, propertyKey: any, parameterIndex: number) {
      let metaKey: string | symbol;
      switch (type) {
        case "route:param":
          metaKey = PARAM_META_KEY;
          break;
        case "route:query":
          metaKey = QUERY_META_KEY;
          break;
        case "route:body":
          metaKey = REQUEST_BODY_META_KEY;
          break;
        case "route:user":
          metaKey = REQUEST_USER_META_KEY;
          break;
        case "route:header":
          metaKey = REQUEST_HEADER_META_KEY;
          break;
        default:
          throw new Error(`Unknown param decorator type: ${String(type)}`);
      }

      const existingParams =
        Reflect.getMetadata(metaKey, target, propertyKey) || [];

      const paramNames = readParameterNames(
        propertyKey !== undefined ? target?.[propertyKey] : target,
      );
      // design:paramtypes is missing under tsx / esbuild / SWC; treat the
      // parameter as untyped instead of crashing.
      const parameterTypes: unknown[] =
        Reflect.getMetadata("design:paramtypes", target, propertyKey) || [];
      const paramDataType = options.type ?? parameterTypes[parameterIndex];
      const validatorClass = isClassValidatorClass(paramDataType as any);
      existingParams.push({
        index: parameterIndex,
        key: typeof key === "string" ? key : "all",
        name: paramNames[parameterIndex],
        required: options.required ?? true,
        validate: options.validate ?? true,
        dataType: getDataType(paramDataType),
        validatorClass,
        // Filled in by the router when the route is registered, once every
        // nested DTO class is defined.
        schema: null,
        type,
      });
      Reflect.defineMetadata(metaKey, existingParams, target, propertyKey);
    };
  };
}

export const Param = createParamDecorator("route:param");
export const Query = createParamDecorator("route:query");
export const Body = createParamDecorator("route:body");
export const Header = createParamDecorator("route:header");
export const AuthUser = createParamDecorator("route:user");
