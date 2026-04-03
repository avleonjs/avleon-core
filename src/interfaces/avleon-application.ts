/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import { Constructor } from "../helpers";
import { AvleonMiddleware } from "../middleware";
import { DataSource, DataSourceOptions } from "typeorm";
import { OpenApiUiOptions } from "../openapi";
import { FastifyServerOptions, InjectOptions, LightMyRequestResponse } from "fastify";
import { RedisOptions } from "ioredis";

export type CorsOptions = {
  origin?: boolean | string | RegExp | (string | RegExp)[] | ((origin: string, cb: (err: Error | null, allow?: boolean) => void) => void);
  methods?: string | string[];
  allowedHeaders?: string | string[];
  exposedHeaders?: string | string[];
  credentials?: boolean;
  maxAge?: number;
  preflight?: boolean;
  strictPreflight?: boolean;
  hideOptionsRoute?: boolean;
  optionsSuccessStatus?: number;
};

export type GlobalOptions = {
  cors?: CorsOptions;
  openApi?: OpenApiUiOptions;
  controllers?: any;
  middlewares?: any;
  authorization?: any;
  multipart?: any;
  staticFiles?: any;
};

export type AvleonApplicationOptions = {
  server?: FastifyServerOptions;
  dataSourceOptions?: DataSourceOptions;
};

export type AutoControllerOptions = {
  auto: true;
  path?: string;
};

export type CacheOptions = {
  provider: 'memory' | 'redis',
  redisOptions?: RedisOptions
}

export interface IAvleonApplication {
  // all use
  useCors: (options: CorsOptions) => this;
  useCache: (options?: CacheOptions)=>this;
  useDatasource: (dataSource: DataSource) => this;
  useMultipart: (options?: any) => this;
  useOpenApi: (options: OpenApiUiOptions) => this;
  useMiddlewares: (middlewares: Constructor<AvleonMiddleware>[]) => this;
  useAuthorization: (authorization: Constructor<any>) => this;
  useSerialization: () => this;
  useControllers: (controllers: Constructor[] | AutoControllerOptions) => this;
  useStaticFiles: (options: any) => this;
  useHttps: (options?: any) => this;
  useGlobal: (options: GlobalOptions) => this;
  useSocketIo: (options?: any) => this;
  useKnex: (options: any) => this;
  mapFeatures: () => this;

  // all map
  mapGet: <T extends (...args: any[]) => any>(path: string, fn: T) => any;
  mapPost: <T extends (...args: any[]) => any>(path: string, fn: T) => any;
  mapPut: <T extends (...args: any[]) => any>(path: string, fn: T) => any;
  mapDelete: <T extends (...args: any[]) => any>(path: string, fn: T) => any;

  // run
  run: (port?: number, fn?: CallableFunction) => Promise<void>;
}

export type TestResponse = LightMyRequestResponse | Promise<LightMyRequestResponse>;

export interface TestApplication {
  get: (url: string, options?: InjectOptions) => TestResponse;
  post: (url: string, options?: InjectOptions) => TestResponse;
  put: (url: string, options?: InjectOptions) => TestResponse;
  patch: (url: string, options?: InjectOptions) => TestResponse;
  delete: (url: string, options?: InjectOptions) => TestResponse;
  options: (url: string, options?: InjectOptions) => TestResponse;
  getController: <T>(controller: Constructor<T>, deps?: any[]) => T;
}

export type TestAppOptions = {
  controllers: Constructor[] | unknown[];
  dataSource?: DataSourceOptions;
};
