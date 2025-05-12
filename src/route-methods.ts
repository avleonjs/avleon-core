/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */

import { CONTROLLER_META_KEY, ROUTE_META_KEY } from './container';
import { OpenApiOptions } from './openapi';
import { HttpResponse } from './response';
import { Results } from './results';
export type RouteMethods =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS'
  | 'ALL';

const schema: OpenApiOptions = {
  tags: ['hello'],
};

/**
 * Options for defining a route's method and metadata.
 */
export type RouteMethodOptions = {
  /**
   * HTTP method for the route (e.g., GET, POST, PUT, DELETE).
   */
  method?: RouteMethods;

  /**
   * The path or endpoint for the route (e.g., "/users/:id").
   */
  path?: string;

  /**
   * OpenAPI metadata for the route, including summary and description.
   */
  openapi?: OpenApiOptions;

  /**
   * Name of the route.
   *
   * @description If Swagger is enabled in the project, this will appear as a tag in the generated documentation.
   */
  name?: string;
};

// Overloads

// Implementation
export function createRouteDecorator(
  method: RouteMethods = 'GET',
): (
  pathOrOptions: string | RouteMethodOptions,
  maybeOptions?: RouteMethodOptions,
) => MethodDecorator {
  return function (
    pathOrOptions: string | RouteMethodOptions,
    maybeOptions?: RouteMethodOptions,
  ): MethodDecorator {
    return function (
      target,
      propertyKey: string | symbol,
      descriptor: PropertyDescriptor,
    ) {
      let path = '/';
      let options: RouteMethodOptions = {};

      if (typeof pathOrOptions === 'string') {
        path = pathOrOptions;
        options = maybeOptions || {};
      } else if (typeof pathOrOptions === 'object') {
        options = pathOrOptions;
        path = options.name || '/';
      }

      // Define metadata
      Reflect.defineMetadata('route:path', path, target, propertyKey);
      Reflect.defineMetadata(
        'route:method',
        method || 'GET',
        target,
        propertyKey,
      );
      Reflect.getMetadata(CONTROLLER_META_KEY, target.constructor);
      Reflect.defineMetadata(
        ROUTE_META_KEY,
        { ...options, method, path, controller: target.constructor.name },
        target,
        propertyKey,
      );

      if (options) {
        Reflect.defineMetadata('route:options', options, target, propertyKey);
      }
    };
  };
}

// Usage Example
/**
 * @description HTTP Get method
 * @param {string} path
 */
export function Get(path?: string): MethodDecorator;
export function Get(path: string | RouteMethodOptions): MethodDecorator;
/**
 * @description HTTP Get method
 * @param {string} path
 * @param {RouteMethodOptions} options
 */
export function Get(path: string, options: RouteMethodOptions): MethodDecorator;
export function Get(
  path?: string | RouteMethodOptions,
  options?: RouteMethodOptions,
) {
  const parsedPath =
    !path && !options ? '/' : (path as string | RouteMethodOptions);
  if (options) {
    return createRouteDecorator('GET')(parsedPath, options);
  } else {
    return createRouteDecorator('GET')(parsedPath);
  }
}

export function Post(path?: string): MethodDecorator;
export function Post(path: string | RouteMethodOptions): MethodDecorator;
export function Post(
  path: string,
  options: RouteMethodOptions,
): MethodDecorator;
export function Post(
  path?: string | RouteMethodOptions,
  options?: RouteMethodOptions,
) {
  const parsedPath =
    !path && !options ? '/' : (path as string | RouteMethodOptions);
  if (options) {
    return createRouteDecorator('POST')(parsedPath, options);
  } else {
    return createRouteDecorator('POST')(parsedPath);
  }
}

export function Put(path?: string): MethodDecorator;
export function Put(path: string | RouteMethodOptions): MethodDecorator;
export function Put(path: string, options: RouteMethodOptions): MethodDecorator;
export function Put(
  path?: string | RouteMethodOptions,
  options?: RouteMethodOptions,
) {
  const parsedPath =
    !path && !options ? '/' : (path as string | RouteMethodOptions);
  if (options) {
    return createRouteDecorator('PUT')(parsedPath, options);
  } else {
    return createRouteDecorator('PUT')(parsedPath);
  }
}

export function Delete(path?: string): MethodDecorator;
export function Delete(path: string | RouteMethodOptions): MethodDecorator;
export function Delete(
  path: string,
  options: RouteMethodOptions,
): MethodDecorator;
export function Delete(
  path?: string | RouteMethodOptions,
  options?: RouteMethodOptions,
) {
  const parsedPath =
    !path && !options ? '/' : (path as string | RouteMethodOptions);
  if (options) {
    return createRouteDecorator('DELETE')(parsedPath, options);
  } else {
    return createRouteDecorator('DELETE')(parsedPath);
  }
}

export const Patch = createRouteDecorator('PATCH');
export const Options = createRouteDecorator('OPTIONS');
export const All = createRouteDecorator('ALL');
