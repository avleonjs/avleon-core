/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */

import { CONTROLLER_META_KEY, ROUTE_META_KEY } from "../common/container";
import { OpenApiOptions } from "../openapi/openapi";

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
  maybeOptions?: RouteMethodOptions,
): MethodDecorator {
  return function (target, propertyKey, descriptor) {
    let path = "/";
    let options: RouteMethodOptions = {};

    if (typeof pathOrOptions === "string") {
      path = pathOrOptions || "/";
      options = maybeOptions || {};
    } else if (typeof pathOrOptions === "object" && pathOrOptions !== null) {
      options = pathOrOptions;
      path = options.path || options.name || "/";
    } else {
      // @Get() called with no args
      options = maybeOptions || {};
      path = "/";
    }

    //Ensure path is always a string
    path = typeof path === "string" ? path : "/";

    Reflect.defineMetadata("route:path", path, target, propertyKey);
    Reflect.defineMetadata("route:method", method, target, propertyKey);
    Reflect.defineMetadata(
      ROUTE_META_KEY,
      {
        ...options,
        method,
        path,
        controller: target.constructor.name,
      },
      target,
      propertyKey,
    );

    if (options) {
      Reflect.defineMetadata("route:options", options, target, propertyKey);
    }
  };
}

export const Get = (
  pathOrOptions?: string | RouteMethodOptions,
  maybeOptions?: RouteMethodOptions,
) => Route("GET", pathOrOptions, maybeOptions);

export const Post = (
  pathOrOptions?: string | RouteMethodOptions,
  maybeOptions?: RouteMethodOptions,
) => Route("POST", pathOrOptions, maybeOptions);

export const Put = (
  pathOrOptions?: string | RouteMethodOptions,
  maybeOptions?: RouteMethodOptions,
) => Route("PUT", pathOrOptions, maybeOptions);

export const Delete = (
  pathOrOptions?: string | RouteMethodOptions,
  maybeOptions?: RouteMethodOptions,
) => Route("DELETE", pathOrOptions, maybeOptions);

export const Patch = (
  pathOrOptions?: string | RouteMethodOptions,
  maybeOptions?: RouteMethodOptions,
) => Route("PATCH", pathOrOptions, maybeOptions);

export const Options = (
  pathOrOptions?: string | RouteMethodOptions,
  maybeOptions?: RouteMethodOptions,
) => Route("OPTIONS", pathOrOptions, maybeOptions);

/** Registers the handler for every HTTP method Fastify supports. */
export const All = (
  pathOrOptions?: string | RouteMethodOptions,
  maybeOptions?: RouteMethodOptions,
) => Route("ALL", pathOrOptions, maybeOptions);

export const HTTP_CODE_META_KEY = Symbol.for("avleon:http-code");

/**
 * Set the status code for a successful response from this route.
 * A returned `Results.*` / `HttpResponse.*` value with its own status wins.
 *
 *   @Post("/")
 *   @HttpCode(201)
 *   create(@Body() dto: CreateUserDto) { ... }
 */
export function HttpCode(statusCode: number): MethodDecorator {
  if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
    throw new Error(
      `[Avleon] @HttpCode expects a status code between 100 and 599, got ${statusCode}.`,
    );
  }
  return function (target, propertyKey) {
    Reflect.defineMetadata(HTTP_CODE_META_KEY, statusCode, target, propertyKey);
  };
}
