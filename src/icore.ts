import fastify, {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction,
  preHandlerHookHandler
} from "fastify";
import Container from "typedi";
import fs from "fs/promises"; // Use promises for asynchronous file operations
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
} from "./container";
import { Constructor, formatUrl, validateObjectByInstance } from "./helpers";
import { SystemUseError } from "./exceptions/system-exception";
import { existsSync, writeFileSync } from "fs";
import { DataSource, DataSourceOptions } from "typeorm";
import { AppMiddleware } from "./middleware";




// IRequest
export interface IRequest extends FastifyRequest {
  params: any;
  query: any;
  body: any;
  headers: any;
}

// IResponse
export interface IResponse extends FastifyReply { }

export interface DoneFunction extends HookHandlerDoneFunction{}

// ParamMetaOptions
export interface ParamMetaOptions {
  index: number;
  key: string;
  name: string;
  required: boolean;
  validate: boolean;
  dataType: any;
  validatorClass: boolean;
  type: "route:param" | "route:query" | "route:body" | "route:header";
}

// Method Param Meta options
export interface MethodParamMeta {
  params: ParamMetaOptions[];
  query: ParamMetaOptions[];
  body: ParamMetaOptions[];
  headers: ParamMetaOptions[];
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

// InternalApplication
class _InternalApplication {
  private static instance: _InternalApplication;
  private static buildOptions: any = {};
  private app!: FastifyInstance;
  private routeSet = new Set<string>(); // Use Set for fast duplicate detection
  private alreadyRun = false;
  private routes: Map<string, Function> = new Map();
  private middlewares: Map<string, AppMiddleware> = new Map();

  private constructor() {
    this.app = fastify();
  }

  static getInternalApp(buildOptions: any): _InternalApplication {
    if (!_InternalApplication.instance) {
      _InternalApplication.instance = new _InternalApplication();
    }
    _InternalApplication.buildOptions = buildOptions;
    if (buildOptions.controllers) {
    }
    return _InternalApplication.instance;
  }

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

    for (const method of methods) {
      const methodMeta = Reflect.getMetadata(ROUTE_META_KEY, prototype, method);
      if (!methodMeta) continue;
      const methodmetaOptions = {
        method: methodMeta.method.toLowerCase(),
        path: formatUrl(controllerMeta.path + methodMeta.path),
      };
      const routeKey = `${methodmetaOptions.method}:${methodmetaOptions.path}`;
      if (this.routeSet.has(routeKey)) {
        throw new SystemUseError(
          `Duplicate Error: Duplicate route found for methoed ${methodMeta.method}: ${methodMeta.path} in ${controller.name}`,
        );
      }
      this.routeSet.add(routeKey);

      const allMeta = this._processMeta(
        prototype,
        method
      );
      this.app.route({
        url: methodmetaOptions.path == "" ? "/" : methodmetaOptions.path,
        method: methodmetaOptions.method.toUpperCase(),
        handler: async (req, res) => {
          const args = await this._mapArgs(req, allMeta);
            for (let bodyMeta of allMeta.body) {
              if (bodyMeta.validatorClass) {
                const err = await validateObjectByInstance(
                  bodyMeta.dataType,
                  args[bodyMeta.index],
                );
                if (err) {
                  console.log("Has validation error", err);
                  return await res.code(400).send({
                    code: 400,
                    errorType: "ValidationError",
                    errors: err,
                    message: err.message,
                  });
                }
              }
            }
            return await prototype[method].apply(ctrl, args);
        },
      });
    }
  }

  // private _mapArgs(req: IRequest, meta: MethodParamMeta) {
  //   const args: any[] = [];
  //   if (meta.params.length > 0) {
  //     meta.params.forEach((param) => {
  //       const value = param.key === "all" ? req.params : req.params[param.key];
  //       args[param.index] = value;
  //     });
  //   }
  //   if (meta.query.length > 0) {
  //     meta.query.forEach((q) => {
  //       const value = q.key === "all" ? req.query : req?.query[q.key];
  //       args[q.index] = value;
  //     });
  //   }
  //   if (meta.body.length > 0) {
  //     meta.body.forEach(async (body) => {
  //       args[body.index] = req.body;
  //     });
  //   }
  //   if (meta.headers.length > 0) {
  //     meta.headers.forEach((header) => {
  //       const value =
  //         header.key === "all" ? req.headers : req.headers[header.key];
  //       args[header.index] = value;
  //     });
  //   }
  //   return args;
  // }


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

    const args: any[] = meta.params.map(p => req.params[p.key] || null);
    meta.query.forEach(q => args[q.index] = q.key === "all" ? req.query : req.query[q.key]);
    meta.body.forEach(body => args[body.index] = req.body);
    meta.headers.forEach(header => args[header.index] = header.key === "all" ? req.headers : req.headers[header.key]);

    cache.set(cacheKey, args);
    return args;
  }



  private metaCache = new Map<string, MethodParamMeta>();
  private _processMeta(prototype: any, method: string): MethodParamMeta {
    const cacheKey = `${prototype.constructor.name}_${method}`;
    if (this.metaCache.has(cacheKey)) {
      return this.metaCache.get(cacheKey)!;
    }

    const meta: MethodParamMeta = {
      params: Reflect.getMetadata(PARAM_META_KEY, prototype, method) || [],
      query: Reflect.getMetadata(QUERY_META_KEY, prototype, method) || [],
      body: Reflect.getMetadata(REQUEST_BODY_META_KEY, prototype, method) || [],
      headers: Reflect.getMetadata(REQUEST_HEADER_META_KEY, prototype, method) || [],
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

    if (controllers) {
      controllers.forEach((c) => {
        if (isApiController(c)) {
          this.buildController(c);
        }
      });
    } else {
      const isExists = existsSync(controllerDir);
      if (isExists) {
        this.autoControllers();
      }
    }
  }

  async mapGroup(path: string) {}

  async handleRoute(args: any) {
    console.log(args);
  }

  private async mapFn(fn: Function) {
    const original = fn;

    fn = function () {
      console.log(arguments);
    };

    return fn;
  }

  useMiddlewares<T extends AppMiddleware>(mclasses: Constructor<T>[]) {

    for (const mclass of mclasses) {
      const cls = Container.get<T>(mclass);
      this.middlewares.set(mclass.name, cls);
      this.app.addHook('preHandler', cls.invoke);
    }

  }









  async mapGet<T extends (...args: any[]) => any>(path: string = "", fn: T) {
    type FnArgs = Parameters<T>;
    await this.mapFn(fn);

    this.app.get(path, async (req, res) => {
      const result = await fn.apply(this, [req, res]);
      return res.send(result);
    });
  }

  async mapPost() {}
  async mapPut() {}
  async mapDelete() {}

  async run(port: number = 4000): Promise<void> {
    if (this.alreadyRun) throw new SystemUseError("App already running");
    this.alreadyRun = true;
    if (_InternalApplication.buildOptions.database) {
    }
    

    await this.app.listen({ port });
    console.log(`Application running on port: ${port}`);
  }
}

export class AppBuilder {
  private static instance: AppBuilder;
  private alreadyBuilt = false;
  private database: boolean = false;

  private constructor() {}

  static createBuilder(): AppBuilder {
    if (!AppBuilder.instance) {
      AppBuilder.instance = new AppBuilder();
    }
    return AppBuilder.instance;
  }

  async registerPlugin<T extends Function, S extends {}>(
    plugin: T,
    options: S,
  ) {
    container.set<T>(plugin, plugin.prototype);
  }

  async useDatabase(config: DataSourceOptions) {
    this.database = true;
    try {
      const typeorm = await import("typeorm");
      if (!typeorm) {
        throw new SystemUseError("TypeOrm not installed");
      }
      const datasource = new typeorm.DataSource(config);
      Container.set<DataSource>("idatasource", datasource);
      await datasource.initialize();
    } catch (error: unknown | any) {
      console.log(error)
      console.error("Database Initialize Error:", error.message);
    }
  }

  build(): _InternalApplication {
    if (this.alreadyBuilt) throw new Error("Already built");
    this.alreadyBuilt = true;

    const app = _InternalApplication.getInternalApp({
      database: this.database,
    });
    return app;
  }
}
