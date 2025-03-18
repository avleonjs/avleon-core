/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import fastify, {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction,
  preHandlerHookHandler,
  RouteGenericInterface,
  InjectOptions,
} from "fastify";
import Container, { Constructable } from "typedi";
import fs from "fs/promises";
import path from "path";
import container, {
  CONTROLLER_META_KEY,
  ROUTE_META_KEY,
  PARAM_META_KEY,
  QUERY_META_KEY,
  REQUEST_BODY_META_KEY,
  REQUEST_HEADER_META_KEY,
  getRegisteredControllers,
  isApiController,
  REQUEST_USER_META_KEY,
  AUTHORIZATION_META_KEY,
  REQUEST_BODY_FILES_KEY,
  REQUEST_BODY_FILE_KEY,
} from "./container";
import {
  Constructor,
  formatUrl,
  isValidJsonString,
  validateObjectByInstance,
} from "./helpers";
import { SystemUseError } from "./exceptions/system-exception";
import { existsSync, PathLike } from "fs";
import { DataSource, DataSourceOptions } from "typeorm";
import { AppMiddleware } from "./middleware";
import { BaseHttpException, ValidationErrorException } from "./exceptions";
import { OpenApiOptions, OpenApiUiOptions } from "./openapi";
import swagger from "@fastify/swagger";
import { AppConfig, IConfig } from "./config";
import { Environment } from "./environment-variables";
import cors, { FastifyCorsOptions } from "@fastify/cors";
import fastifyMultipart, { FastifyMultipartOptions } from "@fastify/multipart";
import { MultipartFile } from "./multipart";

export type FuncRoute = {
  handler: any;
  middlewares?: any[];
  schema?: {};
};

// IRequest
export interface IRequest extends FastifyRequest {
  params: any;
  query: any;
  body: any;
  headers: any;
  user?: any;
}

// IResponse
export interface IResponse extends FastifyReply {}

export interface DoneFunction extends HookHandlerDoneFunction {}

// ParamMetaOptions
export interface ParamMetaOptions {
  index: number;
  key: string;
  name: string;
  required: boolean;
  validate: boolean;
  dataType: any;
  validatorClass: boolean;
  type:
    | "route:param"
    | "route:query"
    | "route:body"
    | "route:header"
    | "route:user"
    | "route:file"
    | "route:files";
}

// Method Param Meta options
export interface MethodParamMeta {
  params: ParamMetaOptions[];
  query: ParamMetaOptions[];
  body: ParamMetaOptions[];
  headers: ParamMetaOptions[];
  currentUser: ParamMetaOptions[];
  swagger?: OpenApiUiOptions;
  file?: any[];
  files?: MultipartFile[];
}

interface IRoute {
  url: string;
  method: string;
  controller: string;
}

const isTsNode =
  process.env.TS_NODE_DEV ||
  process.env.TS_NODE_PROJECT ||
  (process as any)[Symbol.for("ts-node.register.instance")];
const controllerDir = path.join(
  process.cwd(),
  isTsNode ? "./src/controllers" : "./dist/cotrollers"
);

type StaticFileOptions = {
  path?: PathLike;
  prefix?: string;
};

type MultipartOptions = {
  destination: PathLike;
} & FastifyMultipartOptions;

type AvleonApp = FastifyInstance;

export type TestAppOptions = {
  controllers: Constructor[];
};

export interface AvleonTestAppliction {
  addDataSource: (dataSourceOptions: DataSourceOptions) => void;
  getApp: (options?: TestAppOptions) => any;
  getController: <T>(controller: Constructor<T>) => T;
}
export interface IAvleonApplication {
  isDevelopment(): boolean;
  useCors(corsOptions?: FastifyCorsOptions): void;
  useOpenApi<
    T extends IConfig<R>,
    R = ReturnType<InstanceType<Constructable<T>>["config"]>
  >(
    ConfigClass: Constructable<T>,
    modifyConfig?: (config: R) => R
  ): void;
  useSwagger(options: OpenApiUiOptions): Promise<void>; // Deprecated
  useMultipart(options: MultipartOptions): IAvleonApplication;
  useMiddlewares<T extends AppMiddleware>(mclasses: Constructor<T>[]): void;
  useAuthoriztion<T extends any>(middleware: Constructor<T>): void;
  mapRoute<T extends (...args: any[]) => any>(
    method: "get" | "post" | "put" | "delete",
    path: string,
    fn: T
  ): Promise<void>;
  mapGet<T extends (...args: any[]) => any>(path: string, fn: T): any;
  mapPost<T extends (...args: any[]) => any>(path: string, fn: T): any;
  mapPut<T extends (...args: any[]) => any>(path: string, fn: T): any;
  mapDelete<T extends (...args: any[]) => any>(path: string, fn: T): any;
  mapControllers(controllers: any[]): any;
  useStaticFiles(options?: StaticFileOptions): void;
  run(port?: number): Promise<void>;
  getTestApp(): any;
}

// InternalApplication
class AvleonApplication implements IAvleonApplication {
  private static instance: AvleonApplication;
  private static buildOptions: any = {};
  private app!: FastifyInstance;
  private routeSet = new Set<string>(); // Use Set for fast duplicate detection
  private alreadyRun = false;
  private routes: Map<string, Function> = new Map();
  private middlewares: Map<string, AppMiddleware> = new Map();
  private rMap = new Map<string, FuncRoute>();
  private hasSwagger = false;
  private globalSwaggerOptions: any = {};
  private dataSourceOptions?: DataSourceOptions = undefined;
  private controllers: any[] = [];
  private authorizeMiddleware?: any = undefined;
  private appConfig: AppConfig;
  private dataSource?: DataSource = undefined;

  private metaCache = new Map<string, MethodParamMeta>();
  private multipartOptions: FastifyMultipartOptions | undefined;
  private constructor() {
    this.app = fastify();
    this.appConfig = new AppConfig();
    // this.app.setValidatorCompiler(() => () => true);
  }

  static getInternalApp(buildOptions: any): AvleonApplication {
    if (!AvleonApplication.instance) {
      AvleonApplication.instance = new AvleonApplication();
    }
    AvleonApplication.buildOptions = buildOptions;
    if (buildOptions.controllers) {
    }
    if (buildOptions.dataSourceOptions) {
      AvleonApplication.instance.dataSourceOptions =
        buildOptions.dataSourceOptions;
      const typeorm = require("typeorm");
      const datasource = new typeorm.DataSource(buildOptions.dataSourceOptions);
      Container.set<DataSource>("idatasource", datasource);
      AvleonApplication.instance.dataSource = datasource;
    }
    return AvleonApplication.instance;
  }

  isDevelopment() {
    const env = container.get(Environment);
    return env.get("NODE_ENV") == "development";
  }

  private async initSwagger(options: OpenApiUiOptions) {
    const { routePrefix, logo, theme, ...restOptions } = options;

    this.app.register(swagger, {
      openapi: {
        openapi: "3.0.0",
        ...restOptions,
      },
    });
    const rPrefix = routePrefix ? routePrefix : "/docs";
    await this.app.register(require("@fastify/swagger-ui"), {
      logo: logo ? logo : null,
      theme: theme ? theme : {},
      routePrefix: rPrefix as any,
      configuration: {
        metaData: {
          title: "Avleon Api",
          ogTitle: "Avleon",
        },
        theme: "kepler",
        favicon: "/static/favicon.png",
      },
    });
  }
  useCors(corsOptions: FastifyCorsOptions = {}) {
    this.app.register(cors, corsOptions);
  }
  useOpenApi<
    T extends IConfig<R>,
    R = ReturnType<InstanceType<Constructable<T>>["config"]>
  >(ConfigClass: Constructable<T>, modifyConfig?: (config: R) => R) {
    const openApiConfig: R = this.appConfig.get(ConfigClass);
    if (modifyConfig) {
      const modifiedConfig: R = modifyConfig(openApiConfig);
      this.globalSwaggerOptions = modifiedConfig;
    } else {
      this.globalSwaggerOptions = openApiConfig;
    }
    this.hasSwagger = true;
  }

  /**
   * @deprecated
   * Will remove in next major version
   */
  async useSwagger(options: OpenApiUiOptions) {
    this.hasSwagger = true;
    this.globalSwaggerOptions = options;
  }

  useMultipart(options: MultipartOptions) {
    this.multipartOptions = options;
    this.app.register(fastifyMultipart, options);
    return this;
  }

  private handleMiddlewares<T extends AppMiddleware>(
    mclasses: Constructor<T>[]
  ) {
    for (const mclass of mclasses) {
      const cls = Container.get<T>(mclass.constructor);
      this.middlewares.set(mclass.name, cls);
      this.app.addHook("preHandler", cls.invoke);
    }
  }

  private executeMiddlewares(target: any, propertyKey?: string) {
    const classMiddlewares =
      Reflect.getMetadata("controller:middleware", target.constructor) || [];
    const methodMiddlewares = propertyKey
      ? Reflect.getMetadata("route:middleware", target, propertyKey) || []
      : [];

    return [...classMiddlewares, ...methodMiddlewares];
  }

  /**
   * build controller
   * @param controller
   * @returns void
   */
  private async buildController(controller: any) {
    const ctrl: any = Container.get(controller);
    const controllerMeta = Reflect.getMetadata(
      CONTROLLER_META_KEY,
      ctrl.constructor
    );
    if (!controllerMeta) return;
    const prototype = Object.getPrototypeOf(ctrl);
    const methods = Object.getOwnPropertyNames(prototype).filter(
      (name) => name !== "constructor"
    );
    const tag = ctrl.constructor.name.replace("Controller", "");
    const swaggerControllerMeta =
      Reflect.getMetadata("controller:openapi", ctrl.constructor) || {};
    const authClsMeata = Reflect.getMetadata(
      AUTHORIZATION_META_KEY,
      ctrl.constructor
    ) || { authorize: false, options: undefined };

    if (authClsMeata.authorize && this.authorizeMiddleware) {
      this.app.addHook("preHandler", (req, res) => {
        return this.authorizeMiddleware.authorize(req);
      });
    }

    for await (const method of methods) {
      const methodMeta = Reflect.getMetadata(ROUTE_META_KEY, prototype, method);
      if (!methodMeta) continue;
      const methodmetaOptions = {
        method: methodMeta.method.toLowerCase(),
        path: formatUrl(controllerMeta.path + methodMeta.path),
      };
      const routeKey = `${methodmetaOptions.method}:${methodmetaOptions.path}`;
      if (!this.routeSet.has(routeKey)) {
        this.routeSet.add(routeKey);
      }

      const classMiddlewares = this.executeMiddlewares(ctrl, method);

      // handle openapi data
      const swaggerMeta =
        Reflect.getMetadata("route:openapi", prototype, method) || {};

      const authClsMethodMeata = Reflect.getMetadata(
        AUTHORIZATION_META_KEY,
        ctrl.constructor,
        method
      ) || { authorize: false, options: undefined };
      const allMeta = this._processMeta(prototype, method);
      const routePath =
        methodmetaOptions.path == "" ? "/" : methodmetaOptions.path;
      this.app.route({
        url: routePath,
        method: methodmetaOptions.method.toUpperCase(),
        schema: { ...swaggerControllerMeta, ...swaggerMeta, tags: [tag] },
        handler: async (req, res) => {
          let reqClone = req as IRequest;
          if (authClsMethodMeata.authorize && this.authorizeMiddleware) {
            const cls = container.get(this.authorizeMiddleware) as any;
            await cls.authorize(reqClone, authClsMethodMeata.options);
            if (res.sent) return;
          }
          if (classMiddlewares.length > 0) {
            for (let m of classMiddlewares) {
              const cls = Container.get<AppMiddleware>(m.constructor);
              reqClone = (await cls.invoke(reqClone, res)) as IRequest;
              if (res.sent) return;
            }
          }
          const args = await this._mapArgs(reqClone, allMeta);
          for (let bodyMeta of allMeta.body) {
            if (bodyMeta.validatorClass) {
              const err = await validateObjectByInstance(
                bodyMeta.dataType,
                args[bodyMeta.index]
              );
              if (err) {
                return await res.code(400).send({
                  code: 400,
                  error: "ValidationError",
                  errors: err,
                  message: err.message,
                });
              }
            }
          }
          const result = await prototype[method].apply(ctrl, args);
          return result;
        },
      });
    }
  }

  /**
   * map all request parameters
   * @param req
   * @param meta
   * @returns
   */
  private async _mapArgs(req: IRequest, meta: MethodParamMeta): Promise<any[]> {
    if (!req.hasOwnProperty("_argsCache")) {
      Object.defineProperty(req, "_argsCache", {
        value: new Map<string, any[]>(),
        enumerable: false,
      });
    }

    const cache: Map<string, any[]> = (req as any)._argsCache;
    const cacheKey = JSON.stringify(meta); // Faster key-based lookup

    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }

    const args: any[] = meta.params.map((p) => req.params[p.key] || null);
    meta.query.forEach(
      (q) => (args[q.index] = q.key === "all" ? req.query : req.query[q.key])
    );
    meta.body.forEach((body) => (args[body.index] = req.body));
    meta.currentUser.forEach((user) => (args[user.index] = req.user));
    meta.headers.forEach(
      (header) =>
        (args[header.index] =
          header.key === "all" ? req.headers : req.headers[header.key])
    );

    if (meta.file) {
      for await (let f of meta.file) {
        args[f.index] = await req.file();
      }
    }
    cache.set(cacheKey, args);
    return args;
  }

  /**
   * Process Meta for controlelr class methods
   * @param prototype
   * @param method
   * @returns
   */
  private _processMeta(prototype: any, method: string): MethodParamMeta {
    const cacheKey = `${prototype.constructor.name}_${method}`;
    if (this.metaCache.has(cacheKey)) {
      return this.metaCache.get(cacheKey)!;
    }

    const meta: MethodParamMeta = {
      params: Reflect.getMetadata(PARAM_META_KEY, prototype, method) || [],
      query: Reflect.getMetadata(QUERY_META_KEY, prototype, method) || [],
      body: Reflect.getMetadata(REQUEST_BODY_META_KEY, prototype, method) || [],
      file: Reflect.getMetadata(REQUEST_BODY_FILE_KEY, prototype, method) || [],
      files:
        Reflect.getMetadata(REQUEST_BODY_FILES_KEY, prototype, method) || [],
      headers:
        Reflect.getMetadata(REQUEST_HEADER_META_KEY, prototype, method) || [],
      currentUser:
        Reflect.getMetadata(REQUEST_USER_META_KEY, prototype, method) || [],
      // swagger: Reflect.getMetadata("route:openapi", prototype, method) || {}
    };

    this.metaCache.set(cacheKey, meta);
    return meta;
  }

  async autoControllers() {
    const controllers: Function[] = [];
    const files = await fs.readdir(controllerDir);
    for (const file of files) {
      if (isTsNode ? file.endsWith(".ts") : file.endsWith(".js")) {
        const filePath = path.join(controllerDir, file);
        const module = await import(filePath);
        for (const exported of Object.values(module)) {
          if (typeof exported === "function" && isApiController(exported)) {
            //controllers.push(exported);
            this.buildController(exported);
          }
        }
      }
    }
  }

  mapControllers(controllers: Function[]) {
    this.controllers = controllers;
  }

  private async _mapControllers() {
    if (this.controllers.length > 0) {
      for (let controller of this.controllers) {
        if (isApiController(controller)) {
          this.buildController(controller);
        }
      }
    }
  }

  mapControllersAuto() {
    const isExists = existsSync(controllerDir);
    if (isExists) {
      this.autoControllers();
    }
  }

  async handleRoute(args: any) {}

  private async mapFn(fn: Function) {
    const original = fn;

    fn = function () {};

    return fn;
  }

  useMiddlewares<T extends AppMiddleware>(mclasses: Constructor<T>[]) {
    for (const mclass of mclasses) {
      const cls = Container.get<T>(mclass);
      this.middlewares.set(mclass.name, cls);
      this.app.addHook("preHandler", cls.invoke);
    }
  }

  useAuthoriztion<T extends any>(middleware: Constructor<T>) {
    this.authorizeMiddleware = middleware as any;
  }

  private _handleError(error: any): {
    code: number;
    error: string;
    message: any;
  } {
    if (error instanceof BaseHttpException) {
      return {
        code: error.code,
        error: error.name,
        message: isValidJsonString(error.message)
          ? JSON.parse(error.message)
          : error.message,
      };
    }
    return {
      code: 500,
      error: "INTERNAL_ERROR",
      message: error.message ? error.message : "Something going wrong.",
    };
  }

  async mapRoute<T extends (...args: any[]) => any>(
    method: "get" | "post" | "put" | "delete",
    path: string = "",
    fn: T
  ) {
    await this.mapFn(fn); // Assuming mapFn is needed for all methods

    this.app[method](path, async (req: any, res: any) => {
      // Dynamic method call
      try {
        const result = await fn.apply(this, [req, res]);
        if (typeof result === "object" && result !== null) {
          res.json(result); // Use res.json for objects
        } else {
          res.send(result); // Fallback for other types
        }
      } catch (error) {
        console.error(`Error in ${method} route handler:`, error);
        const handledErr = this._handleError(error);
        res.status(handledErr.code).send(handledErr);
      }
    });
  }
  private _routeHandler<T extends (...args: any[]) => any>(
    routePath: string,
    method: string,
    fn: T
  ) {
    const routeKey = method + ":" + routePath;
    this.rMap.set(routeKey, {
      handler: fn,
      middlewares: [],
      schema: {},
    });

    this.mapFn(fn);

    const route = {
      useMiddleware: <M extends AppMiddleware>(
        middlewares: Constructor<AppMiddleware>[]
      ) => {
        const midds = Array.isArray(middlewares) ? middlewares : [middlewares];
        const ms: any[] = (midds as unknown as any[]).map((mclass) => {
          const cls = Container.get<AppMiddleware>(mclass);
          this.middlewares.set(mclass.name, cls);
          return cls.invoke;
        });

        const r = this.rMap.get(routeKey);
        if (r) {
          r.middlewares = ms;
        }
        return route;
      },

      useSwagger: (options: OpenApiOptions) => {
        const r = this.rMap.get(routeKey);
        if (r) {
          r.schema = options;
        }
        return route;
      },
    };

    return route;
  }

  mapGet<T extends (...args: any[]) => any>(path: string = "", fn: T) {
    return this._routeHandler(path, "GET", fn);
  }

  mapPost<T extends (...args: any[]) => any>(path: string = "", fn: T) {
    return this._routeHandler(path, "POST", fn);
  }

  mapPut<T extends (...args: any[]) => any>(path: string = "", fn: T) {
    return this._routeHandler(path, "PUT", fn);
  }

  mapDelete<T extends (...args: any[]) => any>(path: string = "", fn: T) {
    return this._routeHandler(path, "DELETE", fn);
  }

  useStaticFiles(
    options: StaticFileOptions = { path: undefined, prefix: undefined }
  ) {
    this.app.register(require("@fastify/static"), {
      root: options.path ? options.path : path.join(process.cwd(), "public"),
      prefix: options.prefix ? options.prefix : "/static/",
    });
  }

  async initializeDatabase() {
    if (this.dataSourceOptions && this.dataSource) {
      await this.dataSource.initialize();
    }
  }

  async run(port: number = 4000): Promise<void> {
    if (this.alreadyRun) throw new SystemUseError("App already running");
    this.alreadyRun = true;

    if (this.hasSwagger) {
      await this.initSwagger(this.globalSwaggerOptions);
    }
    await this.initializeDatabase();

    await this._mapControllers();

    this.rMap.forEach((value, key) => {
      const [m, r] = key.split(":");
      this.app.route({
        method: m,
        url: r,
        schema: value.schema || {},
        preHandler: value.middlewares ? value.middlewares : [],
        handler: async (req, res) => {
          const result = await value.handler.apply(this, [req, res]);
          return result;
        },
      });
    });
    this.app.setErrorHandler(async (error, req, res) => {
      const handledErr = this._handleError(error);
      if (error instanceof ValidationErrorException) {
        return res.status(handledErr.code).send({
          code: handledErr.code,
          error: handledErr.error,
          errors: handledErr.message,
        });
      }
      return res.status(handledErr.code).send(handledErr);
    });
    await this.app.ready();
    await this.app.listen({ port });
    console.log(`Application running on http://127.0.0.1:${port}`);
  }
  async getTestApp(buildOptions?: any) {
    try {
      if (buildOptions && buildOptions.addDataSource) {
        const typeorm = await import("typeorm");
        if (!typeorm) {
          throw new SystemUseError("TypeOrm not installed");
        }
        const datasource = new typeorm.DataSource(buildOptions.addDataSource);
        Container.set<DataSource>("idatasource", datasource);
        await datasource.initialize();
      }
      this._mapControllers();
      this.rMap.forEach((value, key) => {
        const [m, r] = key.split(":");
        this.app.route({
          method: m,
          url: r,
          schema: value.schema || {},
          preHandler: value.middlewares ? value.middlewares : [],
          handler: async (req, res) => {
            const result = await value.handler.apply(this, [req, res]);
            return result;
          },
        });
      });

      this.app.setErrorHandler(async (error, req, res) => {
        const handledErr = this._handleError(error);
        if (error instanceof ValidationErrorException) {
          return res.status(handledErr.code).send({
            code: handledErr.code,
            error: handledErr.error,
            errors: handledErr.message,
          });
        }
        return res.status(handledErr.code).send(handledErr);
      });
      return this.app as any;
    } catch (error) {
      throw new SystemUseError("Can't get test appliction");
    }
  }
}

export type Application = typeof AvleonApplication;

// Applciation Builder
export interface ITestBuilder {
  getTestApplication(): AvleonTestAppliction;
  createTestApplication(options: any): AvleonTestAppliction;
}

export interface IAppBuilder {
  registerPlugin<T extends Function, S extends {}>(
    plugin: T,
    options: S
  ): Promise<void>;
  addDataSource<
    T extends IConfig<R>,
    R = ReturnType<InstanceType<Constructable<T>>["config"]>
  >(
    ConfigClass: Constructable<T>,
    modifyConfig?: (config: R) => R
  ): void;
  build<T extends IAvleonApplication>(): T;
}

export class TestBuilder {
  private static instance: TestBuilder;
  private app: any;
  private dataSourceOptions?: DataSourceOptions | undefined;
  private constructor() {}

  static createBuilder() {
    if (!TestBuilder.instance) {
      TestBuilder.instance = new TestBuilder();
    }
    return TestBuilder.instance;
  }

  getController<T>(controller: Constructor<T>) {
    return Container.get(controller);
  }

  getService<T>(service: Constructor<T>) {
    return Container.get(service);
  }

  async getTestApplication(options: TestAppOptions) {
    const app = AvleonApplication.getInternalApp({
      dataSourceOptions: this.dataSourceOptions,
    });
    app.mapControllers([...options.controllers]);
    const fa = await app.getTestApp();
    return fa as AvleonApp;
  }

  build(app: IAvleonApplication) {
    return app.getTestApp();
  }

  fromApplication(app: IAvleonApplication) {
    return app.getTestApp();
  }
}

export class Builder implements ITestBuilder, IAppBuilder {
  private static instance: Builder;
  private alreadyBuilt = false;
  private database: boolean = false;
  private dataSource?: DataSource;
  private multipartOptions: FastifyMultipartOptions | undefined;
  private dataSourceOptions?: DataSourceOptions | undefined;
  private testBuilder = false;
  private appConfig: AppConfig;

  private constructor() {
    this.appConfig = new AppConfig();
  }
  getTestApplication(): AvleonTestAppliction {
    throw new Error("Method not implemented.");
  }

  static createAppBuilder(): Builder {
    if (!Builder.instance) {
      Builder.instance = new Builder();
    }
    return Builder.instance;
  }

  static creatTestAppBuilder(): ITestBuilder {
    if (!Builder.instance) {
      Builder.instance = new Builder();
      Builder.instance.testBuilder = true;
    }
    return Builder.instance as ITestBuilder;
  }

  async registerPlugin<T extends Function, S extends {}>(
    plugin: T,
    options: S
  ) {
    container.set<T>(plugin, plugin.prototype);
  }

  addDataSource<
    T extends IConfig<R>,
    R = ReturnType<InstanceType<Constructable<T>>["config"]>
  >(ConfigClass: Constructable<T>, modifyConfig?: (config: R) => R) {
    const openApiConfig: R = this.appConfig.get(ConfigClass);
    if (modifyConfig) {
      const modifiedConfig: R = modifyConfig(openApiConfig);
      this.dataSourceOptions = modifiedConfig as unknown as DataSourceOptions;
    } else {
      this.dataSourceOptions = openApiConfig as unknown as DataSourceOptions;
    }
  }

  createTestApplication<T extends AvleonTestAppliction>(
    buildOptions?: any
  ): any {
    return {
      addDataSource: (dataSourceOptions: DataSourceOptions) =>
        (this.dataSourceOptions = dataSourceOptions),
      getApp: async (options: TestAppOptions) => {
        const app = AvleonApplication.getInternalApp({
          database: this.database,
          dataSourceOptions: buildOptions.datSource,
        });
        app.mapControllers([...options.controllers]);
        const _tapp = await app.getTestApp();

        return {
          async get(url: string, options: any) {
            const res = await _tapp.inject({ url, method: "GET", ...options });
            return res;
          },
        };
      },
      getController<T>(controller: Constructor<T>) {
        return Container.get<T>(controller);
      },
    };
  }

  build<T extends IAvleonApplication>(): T {
    if (this.alreadyBuilt) {
      throw new Error("Already built");
    }
    this.alreadyBuilt = true;

    const app = AvleonApplication.getInternalApp({
      database: this.database,
      multipartOptions: this.multipartOptions,
      dataSourceOptions: this.dataSourceOptions,
    });
    return app as unknown as T;
  }
}
