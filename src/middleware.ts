import { Service } from "typedi";
import { IRequest, IResponse } from "./icore";
import { HttpExceptions } from "./exceptions";

export abstract class AppMiddleware {
  abstract invoke(req: IRequest, res?: IResponse): Promise<IRequest|HttpExceptions>;
}

export type Constructor<T> = { new(...args: any[]): T };




// export function CurrentUser(): ParameterDecorator {
//   return (target, propertyKey, parameterIndex) => {
//     const existingMetadata =
//       Reflect.getMetadata("currentUser:params", target, propertyKey!) || [];

//     existingMetadata.push(parameterIndex);
//     Reflect.defineMetadata("currentUser:params", existingMetadata, target, propertyKey!);
//   };
// }


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
