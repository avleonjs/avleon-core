import Container, { Constructable, Service } from "typedi";

export interface IDBConfig {
  type: string;
  host: string;
  port: number | string;
  username: string;
  password: string;
  database: string;
  synchronize: boolean;
  logging: boolean;
  entities: any[];
  migrations?: string[];
  subscribers?: string[];
}

export interface Environment extends NodeJS.ProcessEnv {
  [key: string]: string | undefined;
}

export interface IAppConfig {
  apiKey: string;
  timezone: string;
}

export interface IConfig {
  config(env: Environment): object;
}

const CONFIG_METADATA_KEY = Symbol("config");
const configInstances = new Map<string, IConfig>();

export function Config<T extends IConfig>(target: { new(): T }) {
  if (typeof target.prototype.config !== "function") {
    throw new Error(`Class "${target.name}" must implement a "config" method.`);
  }

  Reflect.defineMetadata(CONFIG_METADATA_KEY, target, target);

  // Auto-instantiate and store the config instance
  configInstances.set(target.name, new target());
}

export function GetConfig<T extends IConfig>(ConfigClass: {
  new(): T;
}): ReturnType<T["config"]> {
  const instance = configInstances.get(ConfigClass.name) as T;
  if (!instance) {
    throw new Error(
      `Class "${ConfigClass.name}" is not registered as a config.`,
    );
  }

  return instance.config(process.env) as unknown as ReturnType<T["config"]>;
}
