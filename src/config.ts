
import { Container, Service, Constructable } from "typedi";
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from "path";


function createEnvProxy(): NodeJS.ProcessEnv {
  return new Proxy(process.env, {
    get(target, prop) {
      const value = target[prop as string];
      if (value === undefined) {
        return undefined;
      }
      if (value === 'true') {
        return true;
      }
      if (value === 'false') {
        return false;
      }
      if (!isNaN(Number(value))) {
        return Number(value);
      }
      return value;
    },
  }) as NodeJS.ProcessEnv;
}

const env = createEnvProxy();


// function parsedEnvFile(filePath: string): Record<string, string> {
//   try {
//     const fileContent = fs.readFileSync(filePath, 'utf8');
//     const parsedEnv = dotenv.parse(fileContent);

//     console.log(parsedEnv)
//     return parsedEnv;
//   } catch (error) {
//     console.error(`Error parsing .env file: ${error}`);
//     return {};
//   }
// }
// const parsedEnv = parsedEnvFile(path.join(process.cwd(), '.env'));


function parseEnvFile(filePath: string): Record<string, string> {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const parsedEnv = dotenv.parse(fileContent);
    return parsedEnv;
  } catch (error) {
    console.error(`Error parsing .env file: ${error}`);
    return {};
  }
}

const parsedEnv = parseEnvFile(path.join(process.cwd(), '.env'));

const envKeys = Object.keys(parsedEnv) as (keyof typeof parsedEnv)[];

export type Environment = {
  [K in (typeof envKeys)[number]]: string;
};



export interface IConfig<T = any> {
  config( env: Environment): T;
}

// Custom decorator to register configurations in TypeDI
export function Config<T extends IConfig>(target: Constructable<T>) {
  Container.set({ id: target, type: target });
}

// AppConfig class using TypeDI for dynamic retrieval
export class AppConfig {
  get<T extends IConfig<R>, R>(configClass: Constructable<T>): R {
    const instance = Container.get(configClass);
    if (!instance) {
      throw new Error(`Configuration for ${configClass.name} not found.`);
    }
    return instance.config(parsedEnv);
  }
}

// Function to fetch registered config dynamically
export function GetConfig<T extends IConfig<R>, R = ReturnType<InstanceType<Constructable<T>>['config']>>(
  ConfigClass: Constructable<T>
): R {
  const instance = Container.get(ConfigClass);
  if (!instance) {
    throw new Error(`Class "${ConfigClass.name}" is not registered as a config.`);
  }
  return instance.config(parsedEnv);
}




export function GetEnvironment() {
  return parsedEnv as Environment;
}





/* import Container, { Constructable, Service } from "typedi";



export interface Environment extends NodeJS.ProcessEnv {
  [key: string]: string | undefined;
}

export interface IConfig {
  config(env: Environment): object;
}

const CONFIG_METADATA_KEY = Symbol("config");
const configInstances = new Map<string, IConfig>();


export class AppConfig {
  get<T extends { config(): any }>(configClass: new () => T): ReturnType<T['config']> {
    const config = configInstances.get(configClass.name);
    if (!config) {
      throw new Error(`Configuration for ${configClass.name} not found.`);
    }
    return config;
  }
}


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
 */