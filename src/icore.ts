import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import Container from "typedi";
import fs from "fs/promises"; // Use promises for asynchronous file operations
import path from "path";
import container, { CONTROLLER_META_KEY, ROUTE_META_KEY, PARAM_META_KEY, QUERY_META_KEY, REQUEST_BODY_META_KEY, REQUEST_HEADER_META_KEY, getRegisteredControllers, registerController, isApiController } from "./container";
import { Constructor, formatUrl, validateObjectByInstance } from "./helpers";
import { DuplicateRouteException, SystemUseError } from "./exceptions/system-exception";
export interface IRequest extends FastifyRequest {
  params: any;
  query: any;
  body: any;
  headers: any;
}

export interface IResponse extends FastifyReply { }

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


const isTsNode = process.env.TS_NODE_DEV || process.env.TS_NODE_PROJECT || (process as any)[Symbol.for("ts-node.register.instance")];
const controllerDir = path.join(process.cwd(), isTsNode ? "./src/controllers" : "./dist/cotrollers");


class _InternalApplication {
  private static instance: _InternalApplication;
  private static buildOptions: any = {};
  private app!: FastifyInstance;
  private routeSet = new Set<string>(); // Use Set for fast duplicate detection
  private alreadyRun = false;
  private routes: Map<string, Function> = new Map();
  private constructor() {
    this.app = fastify();
  }



  static getInternalApp(buildOptions: any): _InternalApplication {
    if (!_InternalApplication.instance) {
      _InternalApplication.instance = new _InternalApplication();
    }
    _InternalApplication.buildOptions = buildOptions;
    return _InternalApplication.instance;
  }

  private async buildController(controller: any) {
    const ctrl: any = Container.get(controller);
    const controllerMeta = Reflect.getMetadata(CONTROLLER_META_KEY, ctrl.constructor);
    if (!controllerMeta) return;
    const prototype = Object.getPrototypeOf(ctrl);
    const methods = Object.getOwnPropertyNames(prototype).filter((name) => name !== "constructor");

    for (const method of methods) {
      const methodMeta = Reflect.getMetadata(ROUTE_META_KEY, prototype, method);
      if (!methodMeta) continue;
      const methodmetaOptions = { method: methodMeta.method.toLowerCase(), path: formatUrl(controllerMeta.path + methodMeta.path) };
      const routeKey = `${methodmetaOptions.method}:${methodmetaOptions.path}`;
      if (this.routeSet.has(routeKey)) {
        throw new SystemUseError(`Duplicate Error: Duplicate route found for methoed ${methodMeta.method}: ${methodMeta.path} in ${controller.name}`)
      }
      this.routeSet.add(routeKey);
      const allMeta = this._processMeta(prototype, controllerMeta, method, methodMeta);
      this.app.route({
        url: methodmetaOptions.path == "" ? "/" : methodmetaOptions.path,
        method: methodmetaOptions.method.toUpperCase(),
        preHandler: async (req, res, next) => {
          for (let bodyMeta of allMeta.body) {
            const args = await this._mapArgs(req, allMeta);
            if (bodyMeta.validatorClass) {
              const err = await validateObjectByInstance(bodyMeta.dataType, args[bodyMeta.index])
              if (err) {
                console.log("Has validation error", err)
                return await res.code(400).send({
                  code: 400,
                  errorType: "ValidationError",
                  errors: err,
                  message: err.message
                });
              }
            }
          }
          next();
        },
        handler: async (req, res) => {
          const args = await this._mapArgs(req, allMeta);
          try {
            return await prototype[method].apply(ctrl, args);
          } catch (err: any) {
            console.error(err);
            return res.code(err.statusCode || 500).send({
              code: err.statusCode || 500,
              errorType: err.name || "InternalServerError",
              message: err.message,
            });
          }
        },
      });
    }
  }

  private async _mapArgs(req: IRequest, meta: MethodParamMeta): Promise<any[]> {
    const args: any[] = [];
    if (meta.params.length > 0) {
      meta.params.forEach((param) => {
        const value = param.key === "all" ? req.params : req.params[param.key];
        args[param.index] = value;
      });
    }
    if (meta.query.length > 0) {
      meta.query.forEach((q) => {
        const value = q.key === "all" ? req.query : req?.query[q.key];
        args[q.index] = value;
      });
    }
    if (meta.body.length > 0) {
      meta.body.forEach(async (body) => {
        args[body.index] = req.body;
      });
    }
    if (meta.headers.length > 0) {
      meta.headers.forEach((header) => {
        const value = header.key === "all" ? req.headers : req.headers[header.key];
        args[header.index] = value;
      });
    }
    return args;
  }

  private _processMeta(prototype: any, controllerMeta: any, method: string, methodMeta: any): MethodParamMeta {
    const paramsMetaList = Reflect.getMetadata(PARAM_META_KEY, prototype, method) || [];
    const queryMetaList = Reflect.getMetadata(QUERY_META_KEY, prototype, method) || [];
    const bodyMetaList = Reflect.getMetadata(REQUEST_BODY_META_KEY, prototype, method) || [];
    const headerMetaList = Reflect.getMetadata(REQUEST_HEADER_META_KEY, prototype, method) || [];
    return { params: paramsMetaList, query: queryMetaList, body: bodyMetaList, headers: headerMetaList };
  }

  async mapControllers() {
    // const controllers = getRegisteredControllers();
    // await Promise.all(controllers.map((controller) => this.buildController(controller)));
    await this._mapControllers();
  }

  async mapGroup(path: string) {

  }

  async handleRoute(args: any) {
    console.log(args)
  }

  async mapGet(path: string = '', fn: Function) {
    this.app.get(path, async (req, res) => {
      const result = await fn.apply(this, [req, res]);
      return res.send(result);
    })
    /*     this.handleRoute = fn.apply(this, arguments);
    
            this.routes.set(path, async (...args: any[]) => {
                try {
                    const result = await fn(...args);
                    return result;
                } catch (error) {
                    console.error(`Error handling route ${path}:`, error);
                    throw error;
                }
            }); */
  }


  async mapPost() { }
  async mapPut() { }
  async mapDelete() { }

  private async _mapControllers() {
    const controllers = getRegisteredControllers();
    await Promise.all(controllers.map((controller) => this.buildController(controller)));
  }

  async run(port: number = 4000): Promise<void> {
    if (this.alreadyRun) throw new SystemUseError("App already running");
    this.alreadyRun = true;
    if (_InternalApplication.buildOptions.database) {
    }

    ///await this._mapControllers();

    await this.app.listen({ port });
    console.log(`Application running on port: ${port}`);
  }
}

export class AppBuilder {
  private static instance: AppBuilder;
  private alreadyBuilt = false;
  private databse: boolean = false;

  private constructor() { }

  static createBuilder(): AppBuilder {
    if (!AppBuilder.instance) {
      AppBuilder.instance = new AppBuilder();
    }
    return AppBuilder.instance;
  }


  async registerPlugin<T extends Function, S extends {}>(plugin: T, options: S) {
    container.set<T>(plugin, plugin.prototype)
  }

  async useDatabase() {
    this.databse = true;
  }



  async build(): Promise<_InternalApplication> {
    //console.log("Hello", hello())
    if (this.alreadyBuilt) throw new Error("Already built");
    this.alreadyBuilt = true;

    const controllers: Function[] = [];
    const files = await fs.readdir(controllerDir);
    for (const file of files) {
      if (isTsNode ? file.endsWith(".ts") : file.endsWith(".js")) {
        const filePath = path.join(controllerDir, file);
        const module = await import(filePath);
        for (const exported of Object.values(module)) {
          if (typeof exported === "function" && isApiController(exported)) {
            controllers.push(exported);
          }
        }
      }
    }

    const app = _InternalApplication.getInternalApp({ database: this.databse });
    controllers.forEach(registerController);
    return app;
  }
}

