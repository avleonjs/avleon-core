/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import {
  Constructor,
  formatUrl,
  autoCast,
  normalizeQueryDeep,
  validateOrThrow,
  validateObjectByInstance,
} from "../helpers";
import Container, {
  CONTROLLER_META_KEY,
  ROUTE_META_KEY,
  PARAM_META_KEY,
  QUERY_META_KEY,
  REQUEST_BODY_META_KEY,
  REQUEST_HEADER_META_KEY,
  REQUEST_USER_META_KEY,
  AUTHORIZATION_META_KEY,
  REQUEST_BODY_FILE_KEY,
  REQUEST_BODY_FILES_KEY,
} from "../container";
import {
  MethodParamMeta,
  IRequest,
  FuncRoute,
  ParamMetaOptions,
} from "./types";
import { BadRequestException, ValidationErrorException } from "../exceptions";
import { AvleonMiddleware } from "../middleware";
import { REQUEST_METADATA_KEY } from "../controller";
import { OpenApiOptions } from "../openapi";
import mime from "mime";
import Stream from "stream";
import { HTTPMethods, FastifyInstance } from "fastify";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a flat params/query map like:
 *   { id: { type: "string", example: "abc-123" } }
 * into a valid AJV/JSON Schema object:
 *   { type: "object", properties: { id: { type: "string", example: "abc-123" } } }
 */
function normalizeParamsToJsonSchema(
  map: Record<string, any>,
  requiredKeys: string[] = [],
): any {
  const properties: Record<string, any> = {};
  for (const [key, val] of Object.entries(map)) {
    const { required, ...rest } = val;
    properties[key] = { type: "string", ...rest };
  }
  const schema: any = { type: "object", properties };
  if (requiredKeys.length > 0) schema.required = requiredKeys;
  return schema;
}

/**
 * Take a raw @OpenApi schema object and return a Fastify-compatible
 * route schema — normalizing params, query → querystring, and headers.
 */
function buildRouteSchema(raw: any): any {
  const schema: any = { ...raw };

  // ✅ Normalize path params
  if (raw.params && typeof raw.params === "object" && !raw.params.type) {
    const required = Object.entries(raw.params)
      .filter(([, v]: [string, any]) => v.required !== false)
      .map(([k]) => k);
    schema.params = normalizeParamsToJsonSchema(raw.params, required);
  }

  // ✅ Normalize query → Fastify uses "querystring", not "query"
  if (raw.query && typeof raw.query === "object" && !raw.query.type) {
    const required = Object.entries(raw.query)
      .filter(([, v]: [string, any]) => v.required === true)
      .map(([k]) => k);
    schema.querystring = normalizeParamsToJsonSchema(raw.query, required);
    delete schema.query;
  }

  // ✅ Normalize headers
  if (raw.headers && typeof raw.headers === "object" && !raw.headers.type) {
    schema.headers = normalizeParamsToJsonSchema(raw.headers);
  }

  return schema;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export class AvleonRouter {
  private routeSet = new Set<string>();
  private metaCache = new Map<string, MethodParamMeta>();
  private middlewares: Map<string, AvleonMiddleware> = new Map();
  private rMap = new Map<string, FuncRoute>();
  private app: FastifyInstance;
  private authorizeMiddleware?: Constructor<any>;
  private authorizeMiddlewareMap = new Map<string, Constructor<any>>();

  constructor(app: FastifyInstance) {
    this.app = app;
  }

  setAuthorizeMiddleware(middleware: Constructor<any>) {
    this.authorizeMiddleware = middleware;
  }

  setAuthorizeMiddlewareMap(map: Record<string, Constructor<any>>) {
    for (const [name, cls] of Object.entries(map)) {
      this.authorizeMiddlewareMap.set(name, cls);
    }
    // First entry also becomes the default for bare @Authorized()
    if (!this.authorizeMiddleware) {
      this.authorizeMiddleware = Object.values(map)[0];
    }
  }

  /**
   * Resolve the correct authorizer class from @Authorized options.
   *   @Authorized("jwt")            -> map.get("jwt")
   *   @Authorized({ name: "oauth"}) -> map.get("oauth")
   *   @Authorized()                 -> default authorizeMiddleware
   */
  private _resolveAuthorizer(options?: { name?: string }): Constructor<any> | undefined {
    if (options?.name) {
      const named = this.authorizeMiddlewareMap.get(options.name);
      if (!named) {
        throw new Error(
          `[Avleon] No authorization handler registered under the name "${options.name}". ` +
          `Did you call useAuthorization({ ${options.name}: YourClass })?`,
        );
      }
      return named;
    }
    return this.authorizeMiddleware;
  }

  registerMiddleware(name: string, instance: AvleonMiddleware) {
    this.middlewares.set(name, instance);
  }

  private _processMeta(prototype: any, method: string): MethodParamMeta {
    const cacheKey = `${prototype.constructor.name}_${method}`;
    if (this.metaCache.has(cacheKey)) {
      return this.metaCache.get(cacheKey)!;
    }

    const meta: MethodParamMeta = {
      request:
        Reflect.getMetadata(REQUEST_METADATA_KEY, prototype, method) || [],
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
    };

    // Pre-compute args array size once at boot (avoids 8x .map + spread + Math.max per request).
    let _maxIdx = -1;
    const _groups = [
      meta.params, meta.query, meta.body, meta.currentUser,
      meta.headers, meta.request ?? [], meta.file ?? [], meta.files ?? [],
    ];
    for (const group of _groups) {
      for (const item of group) {
        if (item.index > _maxIdx) _maxIdx = item.index;
      }
    }
    (meta as any)._argCount = _maxIdx + 1;

    // Pre-compute branch flags so the handler can skip entire loop bodies
    // in the common case where no files/validation are involved.
    (meta as any)._needsFiles = (meta.file?.length ?? 0) > 0 || (meta.files?.length ?? 0) > 0;
    (meta as any)._hasRequiredParams = meta.params.some((p: any) => p.required);
    (meta as any)._hasValidatorQuery = meta.query.some((q: any) => q.validatorClass || q.required);
    (meta as any)._hasValidatorBody = meta.body.some((b: any) => b.validatorClass);

    this.metaCache.set(cacheKey, meta);
    return meta;
  }

  private executeMiddlewares(target: any, propertyKey?: string) {
    const classMiddlewares =
      Reflect.getMetadata("controller:middleware", target.constructor) || [];
    const methodMiddlewares = propertyKey
      ? Reflect.getMetadata("route:middleware", target, propertyKey) || []
      : [];
    return [...classMiddlewares, ...methodMiddlewares];
  }

  async buildController(controller: any) {
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
      const swaggerMeta =
        Reflect.getMetadata("route:openapi", prototype, method) || {};
      const authClsMethodMeata = Reflect.getMetadata(
        AUTHORIZATION_META_KEY,
        ctrl.constructor,
        method,
      ) || { authorize: false, options: undefined };

      const allMeta = this._processMeta(prototype, method);

      // --- Build body schema from @Body() decorator ---
      let bodySchema: any = null;
      allMeta.body.forEach((r) => {
        if (r.schema) {
          bodySchema = { ...r.schema };
        }
      });

      // --- Build base schema (single declaration) ---
      let schema: any = {
        ...swaggerControllerMeta,
        ...swaggerMeta,
        tags: [tag],
      };

      // Apply body schema if not manually set in @OpenApi
      if (!swaggerMeta.body && bodySchema) {
        schema = { ...schema, body: bodySchema };
      }

      // ✅ Auto-detect querystring from @Query() DTO if not manually set in @OpenApi
      if (!swaggerMeta.query && !schema.querystring) {
        for (const queryMeta of allMeta.query) {
          if (queryMeta.validatorClass && queryMeta.schema) {
            schema.querystring = queryMeta.schema;
            break;
          }
        }
      }

      // ✅ Auto-detect body from @Body() DTO if still not set
      if (!swaggerMeta.body && !bodySchema) {
        for (const bodyMeta of allMeta.body) {
          if (bodyMeta.validatorClass && bodyMeta.schema) {
            schema = { ...schema, body: bodyMeta.schema };
            break;
          }
        }
      }

      const routePath =
        methodmetaOptions.path === "" ? "/" : methodmetaOptions.path;

      // --- Handle multipart ---
      const isMultipart =
        schema?.consumes?.includes("multipart/form-data") ||
        Object.values(schema?.body?.properties || {}).some(
          (p: any) => p.format === "binary",
        );

      if (isMultipart) {
        schema.consumes = ["multipart/form-data"];
        if (!schema.body) {
          schema.body = { type: "object", properties: {} };
        }
        for (const param of allMeta.body) {
          if (param.type === "route:file") {
            schema.body.properties[param.key] = {
              type: "string",
              format: "binary",
            };
          } else {
            schema.body.properties[param.key] = { type: param.dataType };
          }
        }
      }

      // ✅ Normalize params/query/headers into valid JSON Schema
      const routeSchema = buildRouteSchema(schema);

      // Resolve DI singletons once at route-registration time, not per request.
      // _resolveAuthorizer picks the named handler when @Authorized("jwt") is used,
      // or falls back to the default handler for bare @Authorized().
      const _clsAuthCls   = authClsMeata.authorize   ? this._resolveAuthorizer(authClsMeata.options)   : null;
      const _mthdAuthCls  = authClsMethodMeata.authorize ? this._resolveAuthorizer(authClsMethodMeata.options) : null;
      const _clsAuthInst  = _clsAuthCls  ? Container.get(_clsAuthCls)  as any : null;
      const _mthdAuthInst = _mthdAuthCls ? Container.get(_mthdAuthCls) as any : null;
      const _resolvedMw: AvleonMiddleware[] = classMiddlewares.map(
        (m: any) => Container.get<AvleonMiddleware>(m.constructor),
      );

      this.app.route({
        url: routePath,
        method: methodmetaOptions.method.toUpperCase() as HTTPMethods,
        schema: routeSchema,
        attachValidation: isMultipart,
        handler: async (req, res) => {
          let reqClone = req as unknown as IRequest;

          if (_clsAuthInst) {
            await _clsAuthInst.authorize(reqClone, authClsMeata.options);
            if (res.sent) return;
          }

          if (_mthdAuthInst) {
            await _mthdAuthInst.authorize(reqClone, authClsMethodMeata.options);
            if (res.sent) return;
          }

          if (_resolvedMw.length > 0) {
            for (const mInst of _resolvedMw) {
              reqClone = (await mInst.invoke(reqClone, res)) as IRequest;
              if (res.sent) return;
            }
          }

          const _argsResult = this._mapArgs(reqClone, allMeta);
          const args = (_argsResult !== null && typeof (_argsResult as any).then === "function")
            ? await (_argsResult as Promise<any[]>)
            : _argsResult as any[];

          if ((allMeta as any)._hasRequiredParams) {
            for (let i = 0; i < allMeta.params.length; i++) {
              const paramMeta = allMeta.params[i];
              if (paramMeta.required) {
                validateOrThrow(
                  { [paramMeta.key]: args[paramMeta.index] },
                  { [paramMeta.key]: { type: paramMeta.dataType } },
                  { location: "param" },
                );
              }
            }
          }

          if ((allMeta as any)._hasValidatorQuery) {
            for (let i = 0; i < allMeta.query.length; i++) {
              const queryMeta = allMeta.query[i];
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
          }

          if (!isMultipart && (allMeta as any)._hasValidatorBody) {
            for (let i = 0; i < allMeta.body.length; i++) {
              const bodyMeta = allMeta.body[i];
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
          }

          const result = await prototype[method].apply(ctrl, args);

          if (result && result.download) {
            const { stream, filename } = result;
            if (!stream || typeof stream.pipe !== "function") {
              return res.code(500).send({
                code: 500,
                error: "INTERNAL_ERROR",
                message: "Invalid stream object",
              });
            }
            const contentType =
              result.contentType ||
              mime.getType(filename) ||
              "application/octet-stream";
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

          if (result && result.pipe) {
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

  private _mapArgs(req: IRequest, meta: MethodParamMeta): any[] | Promise<any[]> {
    // _argCount pre-computed at boot in _processMeta; no allocations here.
    const args: any[] = new Array((meta as any)._argCount);

    for (let i = 0; i < meta.params.length; i++) {
      const p = meta.params[i];
      const raw = p.key === "all" ? { ...req.params } : (req.params[p.key] ?? null);
      args[p.index] = autoCast(raw, p.dataType, p.schema);
    }

    for (let i = 0; i < meta.query.length; i++) {
      const q = meta.query[i];
      const raw = q.key === "all"
        ? normalizeQueryDeep({ ...req.query })
        : req.query[q.key];
      args[q.index] = autoCast(raw, q.dataType, q.schema);
    }

    for (let i = 0; i < meta.body.length; i++) {
      const _fd = (req as any).formData;
      args[meta.body[i].index] = _fd ? { ...req.body, ..._fd } : req.body;
    }

    for (let i = 0; i < meta.currentUser.length; i++) {
      args[meta.currentUser[i].index] = (req as any).user;
    }

    for (let i = 0; i < meta.headers.length; i++) {
      const header = meta.headers[i];
      args[header.index] = header.key === "all" ? { ...req.headers } : req.headers[header.key];
    }

    for (let i = 0; i < meta.request.length; i++) {
      args[meta.request[i].index] = req;
    }

    if (!(meta as any)._needsFiles) return args;

    if (
      (meta as any)._needsFiles &&
      req.headers["content-type"]?.startsWith("multipart/form-data") &&
      (req as any).saveRequestFiles
    ) {
      const files = (req as any).saveRequestFiles();

      if (!files || files.length === 0) {
        if (meta.files && meta.files.length > 0) {
          throw new BadRequestException({ error: "No files uploaded" });
        }
        if (meta.file && meta.file.length > 0) {
          meta.file.forEach((f) => {
            args[f.index] = null;
          });
        }
      } else {
        const fileInfo = files.map((file: any) => ({
          type: file.type,
          filepath: file.filepath,
          fieldname: file.fieldname,
          filename: file.filename,
          encoding: file.encoding,
          mimetype: file.mimetype,
          fields: file.fields,
          toBuffer: file.toBuffer,
        }));

        if (meta.file && meta.file.length > 0) {
          meta.file.forEach((f) => {
            if (f.fieldName === "all") {
              args[f.index] = fileInfo[0] || null;
            } else {
              const file = fileInfo.find(
                (x: any) => x.fieldname === f.fieldName,
              );
              if (!file) {
                throw new BadRequestException(
                  `File field "${f.fieldName}" not found in uploaded files`,
                );
              }
              args[f.index] = file;
            }
          });
        }

        if (meta.files && meta.files.length > 0) {
          meta.files.forEach((f) => {
            if (f.fieldName === "all") {
              args[f.index] = fileInfo;
            } else {
              const matchingFiles = fileInfo.filter(
                (x: any) => x.fieldname === f.fieldName,
              );
              if (matchingFiles.length === 0) {
                throw new BadRequestException(
                  `No files found for field "${f.fieldName}"`,
                );
              }
              args[f.index] = matchingFiles;
            }
          });
        }
      }
    } else {
      throw new BadRequestException({
        error:
          "Invalid content type. Expected multipart/form-data for file uploads",
      });
    }

    return args;
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
        if (r) r.middlewares = ms;
        return route;
      },

      useOpenApi: (options: OpenApiOptions) => {
        const r = this.rMap.get(routeKey);
        if (r) r.schema = options;
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

  async mapRoute<T extends (...args: any[]) => any>(
    method: "get" | "post" | "put" | "delete",
    path: string = "",
    fn: T,
  ) {
    this.app[method](path, async (req: any, res: any) => {
      try {
        const result = await fn(req, res);
        if (typeof result === "object" && result !== null) {
          res.json(result);
        } else {
          res.send(result);
        }
      } catch (error) {
        console.error(`Error in ${method} route handler:`, error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });
  }

  processFunctionalRoutes() {
    this.rMap.forEach((value, key) => {
      const colonIdx = key.indexOf(":");
      const m = key.slice(0, colonIdx);
      const r = key.slice(colonIdx + 1); // ✅ handles paths containing ":"

      const routeSchema = buildRouteSchema(value.schema || {});

      this.app.route({
        method: m.toUpperCase() as HTTPMethods,
        url: r,
        schema: routeSchema,
        preHandler: value.middlewares ?? [],
        handler: async (req, res) => {
          return value.handler(req, res);
        },
      });
    });
  }
}