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
  LightMyRequestResponse,
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
  FEATURE_KEY,
  registerKnex,
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
import { AvleonMiddleware } from "./middleware";
import {
  BadRequestException,
  BaseHttpException,
  ValidationErrorException,
} from "./exceptions";
import { OpenApiOptions, OpenApiUiOptions } from "./openapi";
import swagger from "@fastify/swagger";
import { AvleonConfig, IConfig } from "./config";
import { Environment } from "./environment-variables";
import cors, { FastifyCorsOptions } from "@fastify/cors";
import fastifyMultipart, { FastifyMultipartOptions } from "@fastify/multipart";
import { MultipartFile } from "./multipart";
import { validateOrThrow } from "./validation";
import { optionalRequire } from "./utils";

import { ServerOptions, Server as SocketIoServer } from "socket.io";
import { SocketContextService } from "./event-dispatcher";
import { EventSubscriberRegistry } from "./event-subscriber";
import Stream from "stream";
import { Knex } from "knex";

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

export interface DoneFunction extends HookHandlerDoneFunction { }
// IResponse
export interface IResponse extends FastifyReply { }

export type TestResponseType = LightMyRequestResponse;
export type TestResponse = TestResponseType | Promise<TestResponseType>;

export interface TestApplication {
  get: (url: string, options?: InjectOptions) => TestResponse;
  post: (url: string, options?: InjectOptions) => TestResponse;
  put: (url: string, options?: InjectOptions) => TestResponse;
  patch: (url: string, options?: InjectOptions) => TestResponse;
  delete: (url: string, options?: InjectOptions) => TestResponse;
  options: (url: string, options?: InjectOptions) => TestResponse;
  getController?: <T>(controller: Constructor<T>) => T;
}

// ParamMetaOptions
export interface ParamMetaOptions {
  index: number;
  key: string;
  name: string;
  required: boolean;
  validate: boolean;
  dataType: any;
  validatorClass: boolean;
  schema?: any;
  type:
  | "route:param"
  | "route:query"
  | "route:body"
  | "route:header"
  | "route:user"
  | "route:file"
  | "route:files";
}

export interface ParamMetaFilesOptions {
  index: number;
  type: "route:files";
  files: MultipartFile[];
  fieldName: string;
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
  files?: ParamMetaFilesOptions[];
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
  isTsNode ? "./src/controllers" : "./dist/cotrollers",
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
  dataSource?: DataSource;
};

export interface AvleonTestAppliction {
  addDataSource: (dataSourceOptions: DataSourceOptions) => void;
  getApp: (options?: TestAppOptions) => any;
  getController: <T>(controller: Constructor<T>, deps: any[]) => T;
}

export type AutoControllerOptions = {
  auto: true;
  path?: string;
};
export interface IAvleonApplication {
  isDevelopment(): boolean;
  useCors(corsOptions?: FastifyCorsOptions): void;
  useDataSource<
    T extends IConfig<R>,
    R = ReturnType<InstanceType<Constructable<T>>["config"]>,
  >(
    ConfigClass: Constructable<T>,
    modifyConfig?: (config: R) => R,
  ): void;
  useOpenApi<
    T extends IConfig<R>,
    R = ReturnType<InstanceType<Constructable<T>>["config"]>,
  >(
    ConfigClass: Constructable<T>,
    modifyConfig?: (config: R) => R,
  ): void;

  useMultipart(options: MultipartOptions): void;
  useCache(options: any): void;

  useMiddlewares<T extends AvleonMiddleware>(mclasses: Constructor<T>[]): void;
  useAuthoriztion<T extends any>(middleware: Constructor<T>): void;
  mapRoute<T extends (...args: any[]) => any>(
    method: "get" | "post" | "put" | "delete",
    path: string,
    fn: T,
  ): Promise<void>;
  mapGet<T extends (...args: any[]) => any>(path: string, fn: T): any;
  mapPost<T extends (...args: any[]) => any>(path: string, fn: T): any;
  mapPut<T extends (...args: any[]) => any>(path: string, fn: T): any;
  mapDelete<T extends (...args: any[]) => any>(path: string, fn: T): any;
  useControllers(controllers: any[]): any;
  useControllers(controllersOptions: AutoControllerOptions): any;
  useControllers(controllersOrOptions: any[] | AutoControllerOptions): any;
  useStaticFiles(options?: StaticFileOptions): void;
  run(port?: number): Promise<void>;
  getTestApp(): TestApplication;
}
type OpenApiConfigClass<T = any> = Constructable<IConfig<T>>;
type OpenApiConfigInput<T = any> = OpenApiConfigClass<T> | T;

type ConfigClass<T = any> = Constructable<IConfig<T>>;
type ConfigInput<T = any> = ConfigClass<T> | T;

interface FastifyWithIO extends FastifyInstance {
  io?: any;
}

const subscriberRegistry = Container.get(EventSubscriberRegistry);
// InternalApplication
export class AvleonApplication {
  private static instance: AvleonApplication;
  private static buildOptions: any = {};
  private app!: FastifyWithIO;
  private routeSet = new Set<string>(); // Use Set for fast duplicate detection
  private alreadyRun = false;
  private routes: Map<string, Function> = new Map();
  private middlewares: Map<string, AvleonMiddleware> = new Map();
  private rMap = new Map<string, FuncRoute>();
  private hasSwagger = false;
  private _hasWebsocket = false;
  private globalSwaggerOptions: any = {};
  private dataSourceOptions?: DataSourceOptions = undefined;
  private controllers: any[] = [];
  private authorizeMiddleware?: any = undefined;
  private appConfig: AvleonConfig;
  private dataSource?: DataSource = undefined;
  private isMapFeatures = false;
  private registerControllerAuto = false;
  private registerControllerPath = "./src";

  private metaCache = new Map<string, MethodParamMeta>();
  private multipartOptions: FastifyMultipartOptions | undefined;
  private constructor() {
    this.app = fastify();
    this.appConfig = new AvleonConfig();
  }

  static getApp(): AvleonApplication {
    let isTestEnv = process.env.NODE_ENV == "test";
    if (!AvleonApplication.instance) {
      AvleonApplication.instance = new AvleonApplication();
    }
    return AvleonApplication.instance;
  }

  static getInternalApp(buildOptions: any): AvleonApplication {
    let isTestEnv = process.env.NODE_ENV == "test";
    if (!AvleonApplication.instance) {
      AvleonApplication.instance = new AvleonApplication();
    }
    AvleonApplication.buildOptions = buildOptions;
    if (buildOptions.dataSourceOptions) {
      AvleonApplication.instance.dataSourceOptions =
        buildOptions.dataSourceOptions;
      const typeorm = require("typeorm");
      const datasource = new typeorm.DataSource(
        buildOptions.dataSourceOptions,
      ) as DataSource;

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
    const { routePrefix, logo, ui, theme, configuration, ...restOptions } =
      options;

    this.app.register(swagger, {
      openapi: {
        openapi: "3.0.0",
        ...restOptions,
      },
    });
    const rPrefix = routePrefix ? routePrefix : "/docs";

    if (options.ui && options.ui == "scalar") {
      const scalarPlugin = optionalRequire("@scalar/fastify-api-reference", {
        failOnMissing: true,
        customMessage:
          "Install \"@scalar/fastify-api-reference\" to enable API docs.\n\n  npm install @scalar/fastify-api-reference",
      });
      await this.app.register(scalarPlugin, {
        routePrefix: rPrefix as any,
        configuration: configuration
          ? configuration
          : {
            metaData: {
              title: "Avleon Api",
              ogTitle: "Avleon",
            },
            theme: options.theme ? options.theme : "kepler",
            favicon: "/static/favicon.png",
          },
      });
    } else {
      const fastifySwaggerUi = optionalRequire("@fastify/swagger-ui", {
        failOnMissing: true,
        customMessage:
          "Install \"@fastify/swagger-ui\" to enable API docs.\n\n  npm install @fastify/swagger-ui",
      });
      await this.app.register(fastifySwaggerUi, {
        logo: logo ? logo : null,
        theme: theme ? theme : {},
        routePrefix: rPrefix as any,
      });
    }
  }

  private _isConfigClass<T>(input: any): input is ConfigClass<T> {
    return (
      typeof input === "function" &&
      typeof input.prototype === "object" &&
      input.prototype?.constructor === input
    );
  }
  useCors<T = FastifyCorsOptions>(corsOptions?: ConfigInput<T>) {
    let coptions: any = {};
    if (corsOptions) {
      if (this._isConfigClass<T>(corsOptions)) {
        coptions = this.appConfig.get(corsOptions) as T;
      } else {
        coptions = corsOptions as T;
      }
    }
    this.app.register(cors, coptions);
  }

  useWebSocket<T = Partial<ServerOptions>>(socketOptions: ConfigInput<T>) {
    this._hasWebsocket = true;
    this._initWebSocket(socketOptions);
  }

  private async _initWebSocket(options: any) {
    const fsSocketIO = optionalRequire("fastify-socket.io", {
      failOnMissing: true,
      customMessage:
        "Install \"fastify-socket.io\" to enable socket.io.\n\n run pnpm install fastify-socket.io",
    });
    await this.app.register(fsSocketIO, options);
    const socketIO = await this.app.io;
    Container.set(SocketIoServer, socketIO);
  }

  useOpenApi<T = OpenApiUiOptions>(configOrClass: OpenApiConfigInput<T>) {
    let openApiConfig: T;
    if (this._isConfigClass(configOrClass)) {
      openApiConfig = this.appConfig.get(configOrClass);
    } else {
      openApiConfig = configOrClass as T;
    }
    this.globalSwaggerOptions = openApiConfig;
    this.hasSwagger = true;
  }

  useMultipart<T extends MultipartOptions>(options: ConfigInput<T>) {
    let multipartOptions: T;
    if (this._isConfigClass(options)) {
      multipartOptions = this.appConfig.get(options);
    } else {
      multipartOptions = options as T;
    }
    if (multipartOptions) {
      this.multipartOptions = multipartOptions;
      this.app.register(fastifyMultipart, {
        ...this.multipartOptions,
        attachFieldsToBody: true,
      });
    }
  }

  useDataSource<T extends DataSourceOptions>(options: ConfigInput<T>) {
    let dataSourceOptions: T;
    if (this._isConfigClass(options)) {
      dataSourceOptions = this.appConfig.get(options);
    } else {
      dataSourceOptions = options as T;
    }

    if (!dataSourceOptions)
      throw new SystemUseError("Invlaid datasource options.");

    this.dataSourceOptions = dataSourceOptions;
    const typeorm = require("typeorm");
    const datasource = new typeorm.DataSource(dataSourceOptions) as DataSource;

    this.dataSource = datasource;

    Container.set<DataSource>("idatasource", datasource);
  }

  useKnex<T extends Knex.Config>(options: ConfigInput<T>) {
    let dataSourceOptions: T;
    if (this._isConfigClass(options)) {
      dataSourceOptions = this.appConfig.get(options);
    } else {
      dataSourceOptions = options as T;
    }

    if (!dataSourceOptions)
      throw new SystemUseError("Invlaid datasource options.");

    registerKnex(dataSourceOptions);

  }

  private _useCache(options: any) { }

  useMiddlewares<T extends AvleonMiddleware>(mclasses: Constructor<T>[]) {
    for (const mclass of mclasses) {
      const cls = Container.get<T>(mclass);
      this.middlewares.set(mclass.name, cls);
      this.app.addHook("preHandler", cls.invoke);
    }
  }

  useAuthoriztion<T extends any>(middleware: Constructor<T>) {
    this.authorizeMiddleware = middleware as any;
  }

  useStaticFiles(
    options: StaticFileOptions = { path: undefined, prefix: undefined },
  ) {
    this.app.register(require("@fastify/static"), {
      root: options.path ? options.path : path.join(process.cwd(), "public"),
      prefix: options.prefix ? options.prefix : "/static/",
    });
  }

  private handleMiddlewares<T extends AvleonMiddleware>(
    mclasses: Constructor<T>[],
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
      ctrl.constructor,
    );
    if (!controllerMeta) return;
    const prototype = Object.getPrototypeOf(ctrl);
    const methods = Object.getOwnPropertyNames(prototype).filter(
      (name) => name !== "constructor",
    );
    const tag = ctrl.constructor.name.replace("Controller", "");
    const swaggerControllerMeta =
      Reflect.getMetadata("controller:openapi", ctrl.constructor) || {};
    const authClsMeata = Reflect.getMetadata(
      AUTHORIZATION_META_KEY,
      ctrl.constructor,
    ) || { authorize: false, options: undefined };

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
        method,
      ) || { authorize: false, options: undefined };
      const allMeta = this._processMeta(prototype, method);

      let bodySchema: any = null;
      allMeta.body.forEach((r) => {
        if (r.schema) {
          bodySchema = { ...r.schema };
        }
      });

      const routePath =
        methodmetaOptions.path == "" ? "/" : methodmetaOptions.path;

      let schema = { ...swaggerControllerMeta, ...swaggerMeta, tags: [tag] };
      if (!swaggerMeta.body && bodySchema) {
        schema = { ...schema, body: bodySchema };
      }

      this.app.route({
        url: routePath,
        method: methodmetaOptions.method.toUpperCase(),
        schema: { ...schema },
        handler: async (req, res) => {
          let reqClone = req as IRequest;

          // class level authrization
          if (authClsMeata.authorize && this.authorizeMiddleware) {
            const cls = container.get(this.authorizeMiddleware) as any;
            await cls.authorize(reqClone, authClsMeata.options);
            if (res.sent) return;
          }

          // method level authorization
          if (authClsMethodMeata.authorize && this.authorizeMiddleware) {
            const cls = container.get(this.authorizeMiddleware) as any;
            await cls.authorize(reqClone, authClsMethodMeata.options);
            if (res.sent) return;
          }
          if (classMiddlewares.length > 0) {
            for (let m of classMiddlewares) {
              const cls = Container.get<AvleonMiddleware>(m.constructor);
              reqClone = (await cls.invoke(reqClone, res)) as IRequest;
              if (res.sent) return;
            }
          }
          const args = await this._mapArgs(reqClone, allMeta);

          for (let paramMeta of allMeta.params) {
            if (paramMeta.required) {
              validateOrThrow(
                { [paramMeta.key]: args[paramMeta.index] },
                { [paramMeta.key]: { type: paramMeta.dataType } },
                { location: "param" },
              );
            }
          }

          for (let queryMeta of allMeta.query) {
            if (queryMeta.validatorClass) {
              const err = await validateObjectByInstance(
                queryMeta.dataType,
                args[queryMeta.index],
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
            if (queryMeta.required) {
              validateOrThrow(
                { [queryMeta.key]: args[queryMeta.index] },
                { [queryMeta.key]: { type: queryMeta.dataType } },
                { location: "queryparam" },
              );
            }
          }

          for (let bodyMeta of allMeta.body) {
            if (bodyMeta.validatorClass) {
              const err = await validateObjectByInstance(
                bodyMeta.dataType,
                args[bodyMeta.index],
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
          // Custom wrapped file download
          if (result?.__isFileDownload) {
            const {
              stream,
              filename,
              contentType = "application/octet-stream",
            } = result;

            if (!stream || typeof stream.pipe !== "function") {
              return res.code(500).send({
                code: 500,
                error: "INTERNAL_ERROR",
                message: "Invalid stream object",
              });
            }

            res.header("Content-Type", contentType);
            res.header(
              "Content-Disposition",
              `attachment; filename="${filename}"`,
            );

            stream.on("error", (err: any) => {
              console.error("Stream error:", err);
              if (!res.sent) {
                res.code(500).send({
                  code: 500,
                  error: "StreamError",
                  message: "Error while streaming file.",
                });
              }
            });

            return res.send(stream);
          }

          // Native stream (not wrapped)
          if (result instanceof Stream || typeof result?.pipe === "function") {
            result.on("error", (err: any) => {
              console.error("Stream error:", err);
              if (!res.sent) {
                res.code(500).send({
                  code: 500,
                  error: "StreamError",
                  message: "Error while streaming file.",
                });
              }
            });
            res.header("Content-Type", "application/octet-stream");
            return res.send(result);
          }

          return res.send(result);
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
      (q) => (args[q.index] = q.key === "all" ? req.query : req.query[q.key]),
    );
    meta.body.forEach(
      (body) => (args[body.index] = { ...req.body, ...req.formData }),
    );
    meta.currentUser.forEach((user) => (args[user.index] = req.user));
    meta.headers.forEach(
      (header) =>
      (args[header.index] =
        header.key === "all" ? req.headers : req.headers[header.key]),
    );

    if (meta.file) {
      for await (let f of meta.file) {
        args[f.index] = await req.file();
      }
    }

    if (
      meta.files &&
      req.headers["content-type"]?.startsWith("multipart/form-data") === true
    ) {
      const files = await req.saveRequestFiles();
      if (!files || files.length === 0) {
        throw new BadRequestException({ error: "No files uploaded" });
      }

      const fileInfo = files.map((file) => ({
        type: file.type,
        filepath: file.filepath,
        fieldname: file.fieldname,
        filename: file.filename,
        encoding: file.encoding,
        mimetype: file.mimetype,
        fields: file.fields,
      }));
      for await (let f of meta.files) {
        const findex = fileInfo.findIndex((x) => x.fieldname == f.fieldName);
        if (f.fieldName != "all" && findex == -1) {
          throw new BadRequestException(
            `${f.fieldName} doesn't exists in request files tree.`,
          );
        }
        args[f.index] =
          f.fieldName == "all"
            ? fileInfo
            : fileInfo.filter((x) => x.fieldname == f.fieldName);
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

  private _resolveControllerDir(dir?: string) {
    const isTsNode =
      process.env.TS_NODE_DEV ||
      process.env.TS_NODE_PROJECT ||
      (process as any)[Symbol.for("ts-node.register.instance")];
    const controllerDir = path.join(process.cwd(), this.registerControllerPath);

    return isTsNode ? controllerDir : controllerDir.replace("src", "dist");
  }

  private async autoControllers(controllersPath?: string) {
    const conDir = this._resolveControllerDir(controllersPath);

    const files = await fs.readdir(conDir, { recursive: true });
    for (const file of files) {
      const isTestFile = /\.(test|spec|e2e-spec)\.ts$/.test(file);
      if (isTestFile) continue;
      if (isTsNode ? file.endsWith(".ts") : file.endsWith(".js")) {
        const filePath = path.join(conDir, file);
        const module = await import(filePath);
        for (const exported of Object.values(module)) {
          if (typeof exported === "function" && isApiController(exported)) {
            console.log("adding", exported.name);
            if (!this.controllers.some((con) => exported.name == con.name)) {
              this.controllers.push(exported);
            }

            //this.buildController(exported);
          }
        }
      }
    }
  }

  useControllers(controllers: Constructor[] | AutoControllerOptions) {
    if (Array.isArray(controllers)) {
      this.controllers = controllers;

      controllers.forEach((controller) => {
        if (!this.controllers.includes(controller)) {
          this.controllers.push(controller);
        }
      });
    } else {
      this.registerControllerAuto = true;
      if (controllers.path) {
        this.registerControllerPath = controllers.path;
      }
    }
  }
  private async _mapControllers() {
    if (this.controllers.length > 0) {
      for (let controller of this.controllers) {
        if (isApiController(controller)) {
          this.buildController(controller);
        } else {
          throw new SystemUseError("Not a api controller.");
        }
      }
    }
  }


  private async mapFn(fn: Function) {
    const original = fn;
    fn = function () { };
    return fn;
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
    fn: T,
  ) {
    await this.mapFn(fn);

    this.app[method](path, async (req: any, res: any) => {
      try {
        const result = await fn.apply(this, [req, res]);
        if (typeof result === "object" && result !== null) {
          res.json(result);
        } else {
          res.send(result);
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
    fn: T,
  ) {
    const routeKey = method + ":" + routePath;
    this.rMap.set(routeKey, {
      handler: fn,
      middlewares: [],
      schema: {},
    });

    const route = {
      useMiddleware: <M extends AvleonMiddleware>(
        middlewares: Constructor<AvleonMiddleware>[],
      ) => {
        const midds = Array.isArray(middlewares) ? middlewares : [middlewares];
        const ms: any[] = (midds as unknown as any[]).map((mclass) => {
          const cls = Container.get<AvleonMiddleware>(mclass);
          this.middlewares.set(mclass.name, cls);
          return cls.invoke;
        });

        const r = this.rMap.get(routeKey);
        if (r) {
          r.middlewares = ms;
        }
        return route;
      },

      useOpenApi: (options: OpenApiOptions) => {
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

  private _mapFeatures() {
    const features = Container.get("features");
    console.log("Features", features);
  }

  async initializeDatabase() {
    if (this.dataSourceOptions && this.dataSource) {
      await this.dataSource.initialize();
    }
  }

  handleSocket(socket: any) {
    subscriberRegistry.register(socket);
  }

  async run(port: number = 4000, fn?: CallableFunction): Promise<void> {
    if (this.alreadyRun) throw new SystemUseError("App already running");
    this.alreadyRun = true;

    if (this.hasSwagger) {
      await this.initSwagger(this.globalSwaggerOptions);
    }
    await this.initializeDatabase();
    if (this.isMapFeatures) {
      this._mapFeatures();
    }

    if (this.registerControllerAuto) {
      await this.autoControllers();
    }
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
      if (
        error instanceof ValidationErrorException ||
        error instanceof BadRequestException
      ) {
        return res.status(handledErr.code).send({
          code: handledErr.code,
          error: handledErr.error,
          errors: handledErr.message,
        });
      }
      return res.status(handledErr.code).send(handledErr);
    });

    await this.app.ready();
    if (this._hasWebsocket) {
      await this.app.io.on("connection", this.handleSocket);
      await this.app.io.use(
        (
          socket: { handshake: { auth: { token: any } }; data: { user: any } },
          next: any,
        ) => {
          const token = socket.handshake.auth.token;
          try {
            console.log("token", token);
            const user = { id: 1, name: "tareq" };
            socket.data.user = user; // this powers @AuthUser()
            next();
          } catch {
            next(new Error("Unauthorized"));
          }
        },
      );
    }
    await this.app.listen({ port });
    console.log(`Application running on http://127.0.0.1:${port}`);
  }
  getTestApp(buildOptions?: any): TestApplication {
    try {
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
      // return this.app as any;
      //
      return {
        get: async (url: string, options?: InjectOptions) =>
          this.app.inject({ method: "GET", url, ...options }),
        post: async (url: string, options?: InjectOptions) =>
          this.app.inject({ method: "POST", url, ...options }),
        put: async (url: string, options?: InjectOptions) =>
          this.app.inject({ method: "PUT", url, ...options }),
        patch: async (url: string, options?: InjectOptions) =>
          this.app.inject({ method: "PATCH", url, ...options }),
        delete: async (url: string, options?: InjectOptions) =>
          this.app.inject({ method: "DELETE", url, ...options }),
        options: async (url: string, options?: InjectOptions) =>
          this.app.inject({ method: "OPTIONS", url, ...options }),
        getController: <T>(controller: Constructor<T>, deps: any[] = []) => {
          const paramTypes =
            Reflect.getMetadata("design:paramtypes", controller) || [];

          deps.forEach((dep, i) => {
            Container.set(paramTypes[i], dep);
          });

          return Container.get(controller);
        },
      };
    } catch (error) {
      console.log(error);
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
    options: S,
  ): Promise<void>;
  addDataSource<
    T extends IConfig<R>,
    R = ReturnType<InstanceType<Constructable<T>>["config"]>,
  >(
    ConfigClass: Constructable<T>,
    modifyConfig?: (config: R) => R,
  ): void;
  build<T extends IAvleonApplication>(): T;
}

export class AvleonTest {
  private constructor() {
    process.env.NODE_ENV = "test";
  }
  static getController<T>(controller: Constructor<T>, deps: any[] = []) {
    const paramTypes =
      Reflect.getMetadata("design:paramtypes", controller) || [];

    deps.forEach((dep, i) => {
      Container.set(paramTypes[i], dep);
    });

    return Container.get(controller);
  }

  static getProvider<T>(service: Constructor<T>, deps: any[] = []) {
    const paramTypes =
      Reflect.getMetadata("design:paramtypes", service) || [];

    deps.forEach((dep, i) => {
      Container.set(paramTypes[i], dep);
    });

    return Container.get(service);
  }


  static createTestApplication(options: TestAppOptions) {
    const app = AvleonApplication.getInternalApp({
      dataSourceOptions: options.dataSource ? options.dataSource : null,
    });
    app.useControllers([...options.controllers]);
    return app.getTestApp();
  }

  static from(app: AvleonApplication) {
    return app.getTestApp();
  }

  static clean() {
    Container.reset();
  }
}

export class Avleon {
  static createApplication() {
    const app = AvleonApplication.getApp();
    return app;
  }
  static createTestApplication(options: TestAppOptions) {
    const app = AvleonTest.createTestApplication(options);
    return app;
  }
}
