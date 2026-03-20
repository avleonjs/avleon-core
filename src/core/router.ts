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
import Container from "typedi";
import container, {
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
import {
    BadRequestException,
    ValidationErrorException,
} from "../exceptions";
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

    constructor(app: FastifyInstance) {
        this.app = app;
    }

    setAuthorizeMiddleware(middleware: Constructor<any>) {
        this.authorizeMiddleware = middleware;
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
            let schema: any = { ...swaggerControllerMeta, ...swaggerMeta, tags: [tag] };

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

            this.app.route({
                url: routePath,
                method: methodmetaOptions.method.toUpperCase() as HTTPMethods,
                schema: routeSchema,
                attachValidation: isMultipart,
                handler: async (req, res) => {
                    let reqClone = req as unknown as IRequest;

                    if (authClsMeata.authorize && this.authorizeMiddleware) {
                        const cls = container.get(this.authorizeMiddleware) as any;
                        await cls.authorize(reqClone, authClsMeata.options);
                        if (res.sent) return;
                    }

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

                    if (!isMultipart) {
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
                    }

                    const result = await prototype[method].apply(ctrl, args);

                    if (result?.download) {
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

    private async _mapArgs(req: IRequest, meta: MethodParamMeta): Promise<any[]> {
        if (!req.hasOwnProperty("_argsCache")) {
            Object.defineProperty(req, "_argsCache", {
                value: new Map<string, any[]>(),
                enumerable: false,
                writable: false,
                configurable: false,
            });
        }

        const cache: Map<string, any[]> = (req as any)._argsCache;
        const cacheKey = JSON.stringify(meta);

        if (cache.has(cacheKey)) {
            return cache.get(cacheKey)!;
        }

        const maxIndex =
            Math.max(
                ...meta.params.map((p) => p.index || 0),
                ...meta.query.map((q) => q.index),
                ...meta.body.map((b) => b.index),
                ...meta.currentUser.map((u) => u.index),
                ...meta.headers.map((h) => h.index),
                ...(meta.request?.map((r) => r.index) || []),
                ...(meta.file?.map((f) => f.index) || []),
                ...(meta.files?.map((f) => f.index) || []),
                -1,
            ) + 1;

        const args: any[] = new Array(maxIndex).fill(undefined);

        meta.params.forEach((p) => {
            const raw =
                p.key === "all" ? { ...req.params } : (req.params[p.key] ?? null);
            args[p.index] = autoCast(raw, p.dataType, p.schema);
        });

        meta.query.forEach((q) => {
            const raw =
                q.key === "all"
                    ? normalizeQueryDeep({ ...req.query })
                    : req.query[q.key];
            args[q.index] = autoCast(raw, q.dataType, q.schema);
        });

        meta.body.forEach((body) => {
            args[body.index] = { ...req.body, ...(req as any).formData };
        });

        meta.currentUser.forEach((user) => {
            args[user.index] = (req as any).user;
        });

        meta.headers.forEach((header) => {
            args[header.index] =
                header.key === "all"
                    ? { ...req.headers }
                    : req.headers[header.key];
        });

        if (meta.request && meta.request.length > 0) {
            meta.request.forEach((r) => {
                args[r.index] = req;
            });
        }

        const needsFiles =
            (meta.file && meta.file.length > 0) ||
            (meta.files && meta.files.length > 0);

        if (
            needsFiles &&
            req.headers["content-type"]?.startsWith("multipart/form-data") &&
            (req as any).saveRequestFiles
        ) {
            const files = await (req as any).saveRequestFiles();

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
                            const file = fileInfo.find((x: any) => x.fieldname === f.fieldName);
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
        } else if (needsFiles) {
            throw new BadRequestException({
                error: "Invalid content type. Expected multipart/form-data for file uploads",
            });
        }

        cache.set(cacheKey, args);
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