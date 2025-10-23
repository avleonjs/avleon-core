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
  ROUTE_META_KEY,
} from "./container";
import { getDataType, isClassValidatorClass, isValidType } from "./helpers";
import { generateSwaggerSchema } from "./swagger-schema";

type ParameterOptions = {
  required?: boolean;
  validate?: boolean;
  type?: any;
};

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
    return function (target: any, propertyKey: any, parameterIndex: number) {
      // Determine correct meta key
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

      // Retrieve and preserve existing metadata
      const existingParams =
        Reflect.getMetadata(metaKey, target, propertyKey) || [];

      // Get parameter names (fallback safe)
      const functionSource: string = target[propertyKey].toString();
      const paramNames =
        functionSource.match(/\(([^)]*)\)/)?.[1]?.split(",").map((n) => n.trim()) || [];

      // Determine the param type
      const parameterTypes =
        Reflect.getMetadata("design:paramtypes", target, propertyKey) || [];
      const paramDataType = parameterTypes[parameterIndex];

      // Append new parameter
      existingParams.push({
        index: parameterIndex,
        key: typeof key === "string" ? key : "all",
        name: paramNames[parameterIndex],
        required: options.required ?? true,
        validate: options.validate ?? true,
        dataType: getDataType(paramDataType),
        validatorClass: isClassValidatorClass(paramDataType),
        schema: isClassValidatorClass(paramDataType)
          ? generateSwaggerSchema(paramDataType)
          : null,
        type,
      });

      // Save back using the correct meta key
      Reflect.defineMetadata(metaKey, existingParams, target, propertyKey);
    };
  };
}

export const Param = createParamDecorator("route:param");
export const Query = createParamDecorator("route:query");
export const Body = createParamDecorator("route:body");
export const Header = createParamDecorator("route:header");
export const AuthUser = createParamDecorator("route:user");
