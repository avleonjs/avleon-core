/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import { Constructor } from "../common/helpers";
import { AvleonMiddleware } from "../http/middleware";
import type { DataSource, DataSourceOptions } from "typeorm";
import type { Knex } from "knex";
import { AvleonConfig, AvleonConfigClass } from "../config/config";
import type { AvleonAuthentication } from "../security/authentication";
import { OpenApiUiOptions } from "../openapi/openapi";
import { FastifyServerOptions, InjectOptions, LightMyRequestResponse } from "fastify";
import type { RedisOptions } from "ioredis";

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
  provider: "memory" | "redis",
  redisOptions?: RedisOptions
}

export interface IAvleonApplication {
  // all use
  useCors: (options: CorsOptions) => this;
  useCache: (options?: CacheOptions)=>this;
  /**
   * @deprecated Use {@link useTypeORM} instead. Will be removed in the next stable version.
   */
  useDatasource: (dataSource: DataSource) => this;
  /** Initialize TypeORM from a DataSource config object or an `@AppConfig` class. */
  useTypeORM: (options: DataSourceOptions | AvleonConfigClass<DataSourceOptions>) => Promise<this>;
  /** Initialize Knex from a config object or an `@AppConfig` class. */
  useKnex: (options: Knex.Config | AvleonConfigClass<Knex.Config>) => Promise<this>;
  useMultipart: (options?: any) => this;
  useOpenApi: (options?: OpenApiUiOptions | Constructor<AvleonConfig<OpenApiUiOptions>>) => this;
  useMiddlewares: (middlewares: Constructor<AvleonMiddleware>[]) => this;
  /** Register the global authentication handler that populates `request.user`. */
  useAuthentication: (authentication: Constructor<AvleonAuthentication>) => this;
  useAuthorization: (authorization: Constructor<any>) => this;
  useSerialization: () => this;
  useControllers: (controllers: Constructor[] | AutoControllerOptions) => this;
  useStaticFiles: (options: any) => this;
  useHttps: (options?: any) => this;
  useGlobal: (options: GlobalOptions) => this;
  useSocketIo: (options?: any) => this;

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
