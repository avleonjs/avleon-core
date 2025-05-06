/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import { Container, Service, Constructable } from "typedi";
import { Environment } from "./environment-variables";




export interface IConfig<T = any> {
  config(env: Environment): T;
}

export function Config<T extends IConfig>(target: Constructable<T>) {
  Container.set({ id: target, type: target });
}

export class AppConfig {
  get<T extends IConfig<R>, R>(configClass: Constructable<T>): R {
    const instance = Container.get(configClass);
    if (!instance) {
      throw new Error(`Configuration for ${configClass.name} not found.`);
    }
    return instance.config(new Environment());
  }
}

export function GetConfig<
  T extends IConfig<R>,
  R = ReturnType<InstanceType<Constructable<T>>["config"]>,
>(ConfigClass: Constructable<T>): R {
  const instance = Container.get(ConfigClass);
  if (!instance) {
    throw new Error(
      `Class "${ConfigClass.name}" is not registered as a config.`,
    );
  }
  return instance.config(new Environment());
}
