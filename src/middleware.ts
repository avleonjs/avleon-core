/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import { Service } from "typedi";
import { IRequest, IResponse } from "./core/types";
import {
  HttpExceptionTypes as HttpException,
  UnauthorizedException,
} from "./exceptions";
import Container, { AUTHORIZATION_META_KEY } from "./container";
import { Constructor } from "./helpers";

export abstract class AvleonMiddleware {
  abstract invoke(
    req: IRequest,
    res?: IResponse,
  ): Promise<IRequest | HttpException>;
}
export type AuthHandler = (
  req: IRequest,
  roles?: string[],
) => Promise<IRequest | HttpException>;



export abstract class AuthorizeMiddleware {
  abstract authorize(
    roles: string[],
  ): (req: IRequest, res?: IResponse) => IRequest | Promise<IRequest>;
}

export type AuthReturnTypes = IRequest | Promise<IRequest>;

interface AuthorizeClass {
  authorize(req: IRequest, options?: any): AuthReturnTypes;
}


export function CanAuthorize(target: {
  new(...args: any[]): AuthorizeClass;
}) {
  if (typeof target.prototype.authorize !== "function") {
    throw new Error(
      `Class "${target.name}" must implement an "authorize" method.`,
    );
  }
  Service()(target);
}


export function AppAuthorization(target: {
  new(...args: any[]): AuthorizeClass;
}) {
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
  | string                           // shorthand: the authorizer name
  | { name?: string; [key: string]: any }; // object form: { name, roles, ... }

export function Authorized(): ClassDecorator & MethodDecorator;
export function Authorized(options: AuthorizedOptions): ClassDecorator & MethodDecorator;
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
    const normalizeMiddleware = (middleware: any) =>
      typeof middleware === "function" ? new middleware() : middleware;
    const middlewareList = (Array.isArray(options) ? options : [options]).map(
      normalizeMiddleware,
    );
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