/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import { Container, Service, Constructable, Token } from "typedi";
import { Environment } from "./environment-variables";
import { inject } from "./helpers";

export interface IConfig<T = any> {
  config(env: Environment): T;
}

export function AppConfig<T extends IConfig>(target: Constructable<T>) {
  Container.set({ id: target, type: target });
}

export class AvleonConfig {
  get<T extends IConfig<R>, R>(configClass: Constructable<T>): R {
    const instance = Container.get(configClass);
    if (!instance) {
      throw new Error(`Configuration for ${configClass.name} not found.`);
    }
    return instance.config(new Environment());
  }
}

// export function GetConfig<
//   T extends IConfig<R>,
//   R = ReturnType<InstanceType<Constructable<T>>["config"]>,
// >(ConfigClass: Constructable<T>): R {
//   const instance = Container.get(ConfigClass);
//   if (!instance) {
//     throw new Error(
//       `Class "${ConfigClass.name}" is not registered as a config.`,
//     );
//   }
//   return instance.config(new Environment());
// }

export function GetConfig<
  T extends IConfig<R>,
  R = ReturnType<InstanceType<Constructable<T>>["config"]>,
>(ConfigClass: Constructable<T>): R;

export function GetConfig<T = any>(config: string | symbol): T;

// Implementation
export function GetConfig<R>(token: any): R {
  // 1. Class‐based: token.prototype.config is a function
  if (
    typeof token === "function" &&
    token.prototype != null &&
    typeof token.prototype.config === "function"
  ) {
    const instance = Container.get(token as Constructable<any>);
    if (!instance) {
      throw new Error(`Class "${token.name}" is not registered as a config.`);
    }
    return instance.config(inject(Environment));
  }

  // 2. Functional: token is the callback itself
  const stored = Container.get(token);
  if (!stored) {
    throw new Error("Config object is not registered.");
  }
  return stored as R;
}

export function CreateConfig<T>(
  token: string | symbol,
  callback: (env: Environment) => T,
) {
  let env!: Environment;
  try {
    env = Container.get(Environment);
  } catch (error) {
    env = new Environment();
  }

  let config: T = callback(env);
  Container.set<T>(token as Token<T>, config);
}
