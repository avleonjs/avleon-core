import { Service } from "typedi";
import Container from "./container";
import { DoneFunction, IRequest, IResponse } from "./icore";
import { HookHandlerDoneFunction, preCloseAsyncHookHandler, preHandlerAsyncHookHandler, preHandlerHookHandler } from "fastify";

export abstract class AppMiddleware{
    abstract invoke(req: IRequest, res: IResponse, done?: DoneFunction):any
}

export type Constructor<T> = { new(...args: any[]): T}

export function Middleware(target: Constructor<AppMiddleware>) {
  if (typeof target.prototype.invoke !== 'function') {
        throw new Error(`Class "${target.name}" must implement an "invoke" method.`);
    }
    
    Service()(target);

  //Reflect.defineMetadata(CONFIG_METADATA_KEY, target, target);
}



