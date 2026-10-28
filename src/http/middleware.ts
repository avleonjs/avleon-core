/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import { Service } from "typedi";
import { IRequest, IResponse } from "../core/types";
import { HttpExceptionTypes as HttpException } from "../common/exceptions";
import { AUTHORIZATION_META_KEY } from "../common/container";
import { Constructor } from "../common/helpers";

export abstract class AvleonMiddleware {
  abstract invoke(
    req: IRequest,
    res?: IResponse,
  ): Promise<IRequest | HttpException>;
}
/**
 * Shape of an authorization handler registered with `app.useAuthorization`.
 * Return `false` (or throw) to deny with 403.
 */
export interface AuthorizeClass {
  authorize(req: IRequest, options?: any): unknown;
}

/**
 * Marks a class as an authorization handler and registers it for DI.
 *
 *   @CanAuthorize
 *   class JwtAuthorization {
 *     authorize(req: IRequest, options?: { roles?: string[] }) { ... }
 *   }
 *
 *   app.useAuthorization(JwtAuthorization);
 */
export function CanAuthorize(target: { new (...args: any[]): AuthorizeClass }) {
  if (typeof target.prototype.authorize !== "function") {
    throw new Error(
      `Class "${target.name}" must implement an "authorize" method.`,
    );
  }
  Service()(target);
}

/**
 * Options accepted by @Authorized.
 *
 * @example
 * // Use the default (only) authorizer
 * @Authorized()
 *
 * @example
 * // Select a named authorizer registered via useAuthorization({ jwt: JwtAuth })
 * @Authorized("jwt")
 * @Authorized({ name: "oauth" })
 * @Authorized({ name: "jwt", roles: ["admin"] })
 */
export type AuthorizedOptions =
  | string // shorthand: the authorizer name
  | { name?: string; [key: string]: any }; // object form: { name, roles, ... }

export function Authorized(): ClassDecorator & MethodDecorator;
export function Authorized(
  options: AuthorizedOptions,
): ClassDecorator & MethodDecorator;
export function Authorized(
  options: AuthorizedOptions = {},
): MethodDecorator | ClassDecorator {
  // Normalise to { name?, ...rest } so the router always sees a consistent shape
  const normalised: { name?: string; [key: string]: any } =
    typeof options === "string" ? { name: options } : options;

  return function (
    target: any,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) {
    if (propertyKey && descriptor) {
      Reflect.defineMetadata(
        AUTHORIZATION_META_KEY,
        { authorize: true, options: normalised },
        target.constructor,
        propertyKey,
      );
    } else {
      Reflect.defineMetadata(
        AUTHORIZATION_META_KEY,
        { authorize: true, options: normalised },
        target,
      );
    }
  };
}

export function AppMiddleware(target: Constructor<AvleonMiddleware>) {
  if (typeof target.prototype.invoke !== "function") {
    throw new Error(
      `Class "${target.name}" must implement an "invoke" method.`,
    );
  }

  Service()(target);
}

/**
 * A decorator function that applies one or more middleware to a class or a method.
 *
 * When applied to a class, the middleware are registered for the entire controller.
 * When applied to a method, the middleware are registered for that specific route.
 *
 * Classes are resolved through the DI container when the route is registered,
 * so middleware can use constructor injection. They run after authentication,
 * authorization and the global middlewares, class-level before method-level.
 *
 * @param options - A single middleware instance/class or an array of middleware instances/classes to be applied.
 * @returns A decorator that registers the middleware metadata.
 */
export function UseMiddleware<
  T extends AvleonMiddleware | (new (...args: any[]) => AvleonMiddleware),
>(options: T | T[]): MethodDecorator & ClassDecorator {
  return function (
    target: Object | Function,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) {
    const middlewareList = Array.isArray(options) ? options : [options];
    if (typeof target === "function" && !propertyKey) {
      const existingMiddlewares =
        Reflect.getMetadata("controller:middleware", target) || [];
      Reflect.defineMetadata(
        "controller:middleware",
        [...existingMiddlewares, ...middlewareList],
        target,
      );
    } else if (descriptor) {
      const existingMiddlewares =
        Reflect.getMetadata("route:middleware", target, propertyKey!) || [];
      Reflect.defineMetadata(
        "route:middleware",
        [...existingMiddlewares, ...middlewareList],
        target,
        propertyKey!,
      );
    }
  };
}
