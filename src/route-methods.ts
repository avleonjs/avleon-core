/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */

import { CONTROLLER_META_KEY, ROUTE_META_KEY } from "./container";
import { OpenApiOptions } from "./openapi";

export type RouteMethods =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "ALL";

export type RouteMethodOptions = {
  method?: RouteMethods;
  path?: string;
  openapi?: OpenApiOptions;
  name?: string;
};

/**
 * Generic Route decorator factory
 */
export function Route(
  method: RouteMethods,
  pathOrOptions?: string | RouteMethodOptions,
  maybeOptions?: RouteMethodOptions
): MethodDecorator {
  return function (target, propertyKey, descriptor) {
    let path = "/";
    let options: RouteMethodOptions = {};

    if (typeof pathOrOptions === "string") {
      path = pathOrOptions;
      options = maybeOptions || {};
    } else if (typeof pathOrOptions === "object") {
      options = pathOrOptions;
      path = options.name || "/";
    }

    // Define metadata
    Reflect.defineMetadata("route:path", path, target, propertyKey);
    Reflect.defineMetadata("route:method", method, target, propertyKey);
    Reflect.defineMetadata(
      ROUTE_META_KEY,
      { ...options, method, path, controller: target.constructor.name },
      target,
      propertyKey
    );

    if (options) {
      Reflect.defineMetadata("route:options", options, target, propertyKey);
    }
  };
}


export const Get = (pathOrOptions?: string | RouteMethodOptions, maybeOptions?: RouteMethodOptions) =>
  Route("GET", pathOrOptions, maybeOptions);

export const Post = (pathOrOptions?: string | RouteMethodOptions, maybeOptions?: RouteMethodOptions) =>
  Route("POST", pathOrOptions, maybeOptions);

export const Put = (pathOrOptions?: string | RouteMethodOptions, maybeOptions?: RouteMethodOptions) =>
  Route("PUT", pathOrOptions, maybeOptions);

export const Delete = (pathOrOptions?: string | RouteMethodOptions, maybeOptions?: RouteMethodOptions) =>
  Route("DELETE", pathOrOptions, maybeOptions);

export const Patch = (pathOrOptions?: string | RouteMethodOptions, maybeOptions?: RouteMethodOptions) =>
  Route("PATCH", pathOrOptions, maybeOptions);

export const Options = (pathOrOptions?: string | RouteMethodOptions, maybeOptions?: RouteMethodOptions) =>
  Route("OPTIONS", pathOrOptions, maybeOptions);

export const All = (pathOrOptions?: string | RouteMethodOptions, maybeOptions?: RouteMethodOptions) =>
  Route("ALL", pathOrOptions, maybeOptions);
