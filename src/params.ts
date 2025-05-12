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
    options: { required?: boolean; validate?: boolean } = {},
  ): ParameterDecorator {
    return function (target: any, propertyKey: any, parameterIndex: number) {
      const existingParams =
        Reflect.getMetadata(type, target, propertyKey) || [];
      const parameterTypes =
        Reflect.getMetadata("design:paramtypes", target, propertyKey) || [];
      const functionSource: any = target[propertyKey].toString();
      const paramNames = functionSource
        .match(/\(([^)]*)\)/)?.[1]
        .split(",")
        .map((name: any) => name.trim());
      const paramDataType = parameterTypes[parameterIndex];
      existingParams.push({
        index: parameterIndex,
        key: key ? key : "all",
        name: paramNames[parameterIndex],
        required: options.required == undefined ? true : options.required,
        validate: options.validate == undefined ? true : options.validate,
        dataType: getDataType(paramDataType),
        validatorClass: isClassValidatorClass(paramDataType),
        schema: isClassValidatorClass(paramDataType)
          ? generateSwaggerSchema(paramDataType)
          : null,
        type,
      });
      switch (type) {
        case "route:param":
          Reflect.defineMetadata(
            PARAM_META_KEY,
            existingParams,
            target,
            propertyKey,
          );
          break;
        case "route:query":
          Reflect.defineMetadata(
            QUERY_META_KEY,
            existingParams,
            target,
            propertyKey,
          );
          break;
        case "route:body":
          Reflect.defineMetadata(
            REQUEST_BODY_META_KEY,
            existingParams,
            target,
            propertyKey,
          );
          break;
        case "route:user":
          Reflect.defineMetadata(
            REQUEST_USER_META_KEY,
            existingParams,
            target,
            propertyKey,
          );
          break;
        case "route:header":
          Reflect.defineMetadata(
            REQUEST_HEADER_META_KEY,
            existingParams,
            target,
            propertyKey,
          );
          break;
        default:
          break;
      }
    };
  };
}

export const Param = createParamDecorator("route:param");
export const Query = createParamDecorator("route:query");
export const Body = createParamDecorator("route:body");
export const Header = createParamDecorator("route:header");
export const AuthUser = createParamDecorator("route:user");
