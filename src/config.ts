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
  timezone: string
}
interface ConfigClass {
  invoke(env: Environment): object;
}

const CONFIG_METADATA_KEY = Symbol('config');

export function Config(target: { new(...args: any[]): ConfigClass }) {
  if (typeof target.prototype.invoke !== 'function') {
    throw new Error(`Class "${target.name}" must implement an "invoke" method.`);
  }

  Reflect.defineMetadata(CONFIG_METADATA_KEY, target, target);
}

export function GetConfig<T extends ConfigClass>(ConfigClass: { new(...args: any[]): T }): ReturnType<T['invoke']> {
  const ConfigCtor = Reflect.getMetadata(CONFIG_METADATA_KEY, ConfigClass);
  if (!ConfigCtor) {
    throw new Error(`Class "${ConfigClass.name}" is not decorated with @Config.`);
  }

  const instance = new ConfigCtor();
  return instance.invoke(process.env);
}
