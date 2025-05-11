/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import { Service } from "typedi";
import { IRequest, IResponse } from "./icore";
import { HttpExceptionTypes as HttpException, UnauthorizedException } from "./exceptions";
import Container, { AUTHORIZATION_META_KEY } from "./container";

export abstract class AppMiddleware {
  abstract invoke(req: IRequest, res?: IResponse): Promise<IRequest|HttpException>;
}
export type AuthHandler = (req: IRequest, roles?: string[]) => Promise<IRequest | HttpException>;



export type Constructor<T> = { new(...args: any[]): T };

export abstract class AuthorizeMiddleware {
  abstract authorize(roles: string[]): (req: IRequest, res?: IResponse) => IRequest | Promise<IRequest>;

}


export type AuthReturnTypes = IRequest | Promise<IRequest>

interface AuthorizeClass {
  authorize(req: IRequest, options?:any): AuthReturnTypes;
}

export function Authorize(target: { new (...args: any[]): AuthorizeClass }) {
  if (typeof target.prototype.authorize !== "function") {
    throw new Error(
      `Class "${target.name}" must implement an "authorize" method.`,
    );
  }
  Service()(target);
}


// export function Authorized(target: Function): void;
export function Authorized(): ClassDecorator & MethodDecorator;
export function Authorized(options?: any): ClassDecorator & MethodDecorator;
export function Authorized(options: any = {}): MethodDecorator | ClassDecorator {
  return function (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) {
    if (propertyKey && descriptor) {
      Reflect.defineMetadata(AUTHORIZATION_META_KEY, { authorize: true, options}, target.constructor, propertyKey);
    } else {
      Reflect.defineMetadata(AUTHORIZATION_META_KEY, { authorize: true, options}, target);
    }
  };
}


export function Middleware(target: Constructor<AppMiddleware>) {
  if (typeof target.prototype.invoke !== "function") {
    throw new Error(
      `Class "${target.name}" must implement an "invoke" method.`,
    );
  }

  Service()(target);
}


export function UseMiddleware<T extends AppMiddleware | (new (...args: any[]) => AppMiddleware)>(
  options: T | T[],
): MethodDecorator & ClassDecorator {
  return function (
    target: Object | Function,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) {
    const normalizeMiddleware = (middleware: any) =>
      typeof middleware === "function" ? new middleware() : middleware;
    const middlewareList = (Array.isArray(options) ? options : [options]).map(normalizeMiddleware);
    if (typeof target === "function" && !propertyKey) {
      const existingMiddlewares =
        Reflect.getMetadata("controller:middleware", target) || [];
      Reflect.defineMetadata(
        "controller:middleware",
        [...existingMiddlewares, ...middlewareList],
        target
      );
    } else if (descriptor) {
      const existingMiddlewares =
        Reflect.getMetadata("route:middleware", target, propertyKey!) || [];
      Reflect.defineMetadata(
        "route:middleware",
        [...existingMiddlewares, ...middlewareList],
        target,
        propertyKey!
      );
    }
  };
}
