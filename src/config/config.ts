import { Environment } from "./environment-variables";
import { Constructor, inject } from "../common/helpers";
import Container, { Constructable } from "typedi";


// The abstract base
export abstract class AvleonConfig<T = any> {
  abstract config(env: Environment): T;
}

// Constructor type that TypeScript recognizes for subclasses
export type AvleonConfigClass<T = any> = Function & { prototype: AvleonConfig<T> };

// Decorator — registers in DI
export function AppConfig<T extends AvleonConfig>(target: Constructor<T>): Constructor<T> {
  Container.set({ id: target, type: target });
  return target;
}
export function GetConfig<T extends AvleonConfig<R>, R>(
  ConfigClass: Constructor<T>,
): R;
export function GetConfig<T = any>(token: string | symbol): T;
export function GetConfig<R>(token: any): R {
  if (
    typeof token === "function" &&
    token.prototype != null &&
    typeof token.prototype.config === "function"
  ) {
    try {
      const instance = Container.get<AvleonConfig<R>>(
        token as Constructor<AvleonConfig<R>>,
      );
      return instance.config(inject(Environment));
    } catch {
      throw new Error(
        `Config class "${(token as Constructor<unknown>).name}" is not registered. ` +
          "Did you forget to apply the @AppConfig decorator?",
      );
    }
  }
  try {
    return Container.get<R>(token);
  } catch {
    throw new Error(
      `Config token "${String(token)}" is not registered in the container.`,
    );
  }
}