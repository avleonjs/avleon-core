"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvleonRouter = void 0;
/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
const helpers_1 = require("../helpers");
const container_1 = __importStar(require("../container"));
const exceptions_1 = require("../exceptions");
const controller_1 = require("../controller");
const mime_1 = __importDefault(require("mime"));
const stream_1 = __importDefault(require("stream"));
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/**
 * Normalize a flat params/query map like:
 *   { id: { type: "string", example: "abc-123" } }
 * into a valid AJV/JSON Schema object:
 *   { type: "object", properties: { id: { type: "string", example: "abc-123" } } }
 */
function normalizeParamsToJsonSchema(map, requiredKeys = []) {
    const properties = {};
    for (const [key, val] of Object.entries(map)) {
        const { required, ...rest } = val;
        properties[key] = { type: "string", ...rest };
    }
    const schema = { type: "object", properties };
    if (requiredKeys.length > 0)
        schema.required = requiredKeys;
    return schema;
}
/**
 * Take a raw @OpenApi schema object and return a Fastify-compatible
 * route schema — normalizing params, query → querystring, and headers.
 */
function buildRouteSchema(raw) {
    const schema = { ...raw };
    // ✅ Normalize path params
    if (raw.params && typeof raw.params === "object" && !raw.params.type) {
        const required = Object.entries(raw.params)
            .filter(([, v]) => v.required !== false)
            .map(([k]) => k);
        schema.params = normalizeParamsToJsonSchema(raw.params, required);
    }
    // ✅ Normalize query → Fastify uses "querystring", not "query"
    if (raw.query && typeof raw.query === "object" && !raw.query.type) {
        const required = Object.entries(raw.query)
            .filter(([, v]) => v.required === true)
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
class AvleonRouter {
    routeSet = new Set();
    metaCache = new Map();
    middlewares = new Map();
    rMap = new Map();
    app;
    authorizeMiddleware;
    constructor(app) {
        this.app = app;
    }
    setAuthorizeMiddleware(middleware) {
        this.authorizeMiddleware = middleware;
    }
    registerMiddleware(name, instance) {
        this.middlewares.set(name, instance);
    }
    _processMeta(prototype, method) {
        const cacheKey = `${prototype.constructor.name}_${method}`;
        if (this.metaCache.has(cacheKey)) {
            return this.metaCache.get(cacheKey);
        }
        const meta = {
            request: Reflect.getMetadata(controller_1.REQUEST_METADATA_KEY, prototype, method) || [],
            params: Reflect.getMetadata(container_1.PARAM_META_KEY, prototype, method) || [],
            query: Reflect.getMetadata(container_1.QUERY_META_KEY, prototype, method) || [],
            body: Reflect.getMetadata(container_1.REQUEST_BODY_META_KEY, prototype, method) || [],
            file: Reflect.getMetadata(container_1.REQUEST_BODY_FILE_KEY, prototype, method) || [],
            files: Reflect.getMetadata(container_1.REQUEST_BODY_FILES_KEY, prototype, method) || [],
            headers: Reflect.getMetadata(container_1.REQUEST_HEADER_META_KEY, prototype, method) || [],
            currentUser: Reflect.getMetadata(container_1.REQUEST_USER_META_KEY, prototype, method) || [],
        };
        this.metaCache.set(cacheKey, meta);
        return meta;
    }
    executeMiddlewares(target, propertyKey) {
        const classMiddlewares = Reflect.getMetadata("controller:middleware", target.constructor) || [];
        const methodMiddlewares = propertyKey
            ? Reflect.getMetadata("route:middleware", target, propertyKey) || []
            : [];
        return [...classMiddlewares, ...methodMiddlewares];
    }
    async buildController(controller) {
        const ctrl = container_1.default.get(controller);
        const controllerMeta = Reflect.getMetadata(container_1.CONTROLLER_META_KEY, ctrl.constructor);
        if (!controllerMeta)
            return;
        const prototype = Object.getPrototypeOf(ctrl);
        const methods = Object.getOwnPropertyNames(prototype).filter((name) => name !== "constructor");
        const tag = ctrl.constructor.name.replace("Controller", "");
        const swaggerControllerMeta = Reflect.getMetadata("controller:openapi", ctrl.constructor) || {};
        const authClsMeata = Reflect.getMetadata(container_1.AUTHORIZATION_META_KEY, ctrl.constructor) || { authorize: false, options: undefined };
        for await (const method of methods) {
            const methodMeta = Reflect.getMetadata(container_1.ROUTE_META_KEY, prototype, method);
            if (!methodMeta)
                continue;
            const methodmetaOptions = {
                method: methodMeta.method.toLowerCase(),
                path: (0, helpers_1.formatUrl)(controllerMeta.path + methodMeta.path),
            };
            const routeKey = `${methodmetaOptions.method}:${methodmetaOptions.path}`;
            if (!this.routeSet.has(routeKey)) {
                this.routeSet.add(routeKey);
            }
            const classMiddlewares = this.executeMiddlewares(ctrl, method);
            const swaggerMeta = Reflect.getMetadata("route:openapi", prototype, method) || {};
            const authClsMethodMeata = Reflect.getMetadata(container_1.AUTHORIZATION_META_KEY, ctrl.constructor, method) || { authorize: false, options: undefined };
            const allMeta = this._processMeta(prototype, method);
            // --- Build body schema from @Body() decorator ---
            let bodySchema = null;
            allMeta.body.forEach((r) => {
                if (r.schema) {
                    bodySchema = { ...r.schema };
                }
            });
            // --- Build base schema (single declaration) ---
            let schema = {
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
            const routePath = methodmetaOptions.path === "" ? "/" : methodmetaOptions.path;
            // --- Handle multipart ---
            const isMultipart = schema?.consumes?.includes("multipart/form-data") ||
                Object.values(schema?.body?.properties || {}).some((p) => p.format === "binary");
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
                    }
                    else {
                        schema.body.properties[param.key] = { type: param.dataType };
                    }
                }
            }
            // ✅ Normalize params/query/headers into valid JSON Schema
            const routeSchema = buildRouteSchema(schema);
            this.app.route({
                url: routePath,
                method: methodmetaOptions.method.toUpperCase(),
                schema: routeSchema,
                attachValidation: isMultipart,
                handler: async (req, res) => {
                    let reqClone = req;
                    if (authClsMeata.authorize && this.authorizeMiddleware) {
                        const cls = container_1.default.get(this.authorizeMiddleware);
                        await cls.authorize(reqClone, authClsMeata.options);
                        if (res.sent)
                            return;
                    }
                    if (authClsMethodMeata.authorize && this.authorizeMiddleware) {
                        const cls = container_1.default.get(this.authorizeMiddleware);
                        await cls.authorize(reqClone, authClsMethodMeata.options);
                        if (res.sent)
                            return;
                    }
                    if (classMiddlewares.length > 0) {
                        for (let m of classMiddlewares) {
                            const cls = container_1.default.get(m.constructor);
                            reqClone = (await cls.invoke(reqClone, res));
                            if (res.sent)
                                return;
                        }
                    }
                    const args = await this._mapArgs(reqClone, allMeta);
                    for (let paramMeta of allMeta.params) {
                        if (paramMeta.required) {
                            (0, helpers_1.validateOrThrow)({ [paramMeta.key]: args[paramMeta.index] }, { [paramMeta.key]: { type: paramMeta.dataType } }, { location: "param" });
                        }
                    }
                    for (let queryMeta of allMeta.query) {
                        if (queryMeta.validatorClass) {
                            const err = await (0, helpers_1.validateObjectByInstance)(queryMeta.dataType, args[queryMeta.index]);
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
                            (0, helpers_1.validateOrThrow)({ [queryMeta.key]: args[queryMeta.index] }, { [queryMeta.key]: { type: queryMeta.dataType } }, { location: "queryparam" });
                        }
                    }
                    if (!isMultipart) {
                        for (let bodyMeta of allMeta.body) {
                            if (bodyMeta.validatorClass) {
                                const err = await (0, helpers_1.validateObjectByInstance)(bodyMeta.dataType, args[bodyMeta.index]);
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
                        const contentType = result.contentType ||
                            mime_1.default.getType(filename) ||
                            "application/octet-stream";
                        res.header("Content-Type", contentType);
                        res.header("Content-Disposition", `attachment; filename="${filename}"`);
                        stream.on("error", (err) => {
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
                    if (result instanceof stream_1.default || typeof result?.pipe === "function") {
                        result.on("error", (err) => {
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
    async _mapArgs(req, meta) {
        if (!req.hasOwnProperty("_argsCache")) {
            Object.defineProperty(req, "_argsCache", {
                value: new Map(),
                enumerable: false,
                writable: false,
                configurable: false,
            });
        }
        const cache = req._argsCache;
        const cacheKey = JSON.stringify(meta);
        if (cache.has(cacheKey)) {
            return cache.get(cacheKey);
        }
        const maxIndex = Math.max(...meta.params.map((p) => p.index || 0), ...meta.query.map((q) => q.index), ...meta.body.map((b) => b.index), ...meta.currentUser.map((u) => u.index), ...meta.headers.map((h) => h.index), ...(meta.request?.map((r) => r.index) || []), ...(meta.file?.map((f) => f.index) || []), ...(meta.files?.map((f) => f.index) || []), -1) + 1;
        const args = new Array(maxIndex).fill(undefined);
        meta.params.forEach((p) => {
            const raw = p.key === "all" ? { ...req.params } : (req.params[p.key] ?? null);
            args[p.index] = (0, helpers_1.autoCast)(raw, p.dataType, p.schema);
        });
        meta.query.forEach((q) => {
            const raw = q.key === "all"
                ? (0, helpers_1.normalizeQueryDeep)({ ...req.query })
                : req.query[q.key];
            args[q.index] = (0, helpers_1.autoCast)(raw, q.dataType, q.schema);
        });
        meta.body.forEach((body) => {
            args[body.index] = { ...req.body, ...req.formData };
        });
        meta.currentUser.forEach((user) => {
            args[user.index] = req.user;
        });
        meta.headers.forEach((header) => {
            args[header.index] =
                header.key === "all" ? { ...req.headers } : req.headers[header.key];
        });
        if (meta.request && meta.request.length > 0) {
            meta.request.forEach((r) => {
                args[r.index] = req;
            });
        }
        const needsFiles = (meta.file && meta.file.length > 0) ||
            (meta.files && meta.files.length > 0);
        if (needsFiles &&
            req.headers["content-type"]?.startsWith("multipart/form-data") &&
            req.saveRequestFiles) {
            const files = await req.saveRequestFiles();
            if (!files || files.length === 0) {
                if (meta.files && meta.files.length > 0) {
                    throw new exceptions_1.BadRequestException({ error: "No files uploaded" });
                }
                if (meta.file && meta.file.length > 0) {
                    meta.file.forEach((f) => {
                        args[f.index] = null;
                    });
                }
            }
            else {
                const fileInfo = files.map((file) => ({
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
                        }
                        else {
                            const file = fileInfo.find((x) => x.fieldname === f.fieldName);
                            if (!file) {
                                throw new exceptions_1.BadRequestException(`File field "${f.fieldName}" not found in uploaded files`);
                            }
                            args[f.index] = file;
                        }
                    });
                }
                if (meta.files && meta.files.length > 0) {
                    meta.files.forEach((f) => {
                        if (f.fieldName === "all") {
                            args[f.index] = fileInfo;
                        }
                        else {
                            const matchingFiles = fileInfo.filter((x) => x.fieldname === f.fieldName);
                            if (matchingFiles.length === 0) {
                                throw new exceptions_1.BadRequestException(`No files found for field "${f.fieldName}"`);
                            }
                            args[f.index] = matchingFiles;
                        }
                    });
                }
            }
        }
        else if (needsFiles) {
            throw new exceptions_1.BadRequestException({
                error: "Invalid content type. Expected multipart/form-data for file uploads",
            });
        }
        cache.set(cacheKey, args);
        return args;
    }
    _routeHandler(routePath, method, fn) {
        const routeKey = method + ":" + routePath;
        this.rMap.set(routeKey, {
            handler: fn,
            middlewares: [],
            schema: {},
        });
        const route = {
            useMiddleware: (middlewares) => {
                const midds = Array.isArray(middlewares) ? middlewares : [middlewares];
                const ms = midds.map((mclass) => {
                    const cls = container_1.default.get(mclass);
                    this.middlewares.set(mclass.name, cls);
                    return cls.invoke;
                });
                const r = this.rMap.get(routeKey);
                if (r)
                    r.middlewares = ms;
                return route;
            },
            useOpenApi: (options) => {
                const r = this.rMap.get(routeKey);
                if (r)
                    r.schema = options;
                return route;
            },
        };
        return route;
    }
    mapGet(path = "", fn) {
        return this._routeHandler(path, "GET", fn);
    }
    mapPost(path = "", fn) {
        return this._routeHandler(path, "POST", fn);
    }
    mapPut(path = "", fn) {
        return this._routeHandler(path, "PUT", fn);
    }
    mapDelete(path = "", fn) {
        return this._routeHandler(path, "DELETE", fn);
    }
    async mapRoute(method, path = "", fn) {
        this.app[method](path, async (req, res) => {
            try {
                const result = await fn(req, res);
                if (typeof result === "object" && result !== null) {
                    res.json(result);
                }
                else {
                    res.send(result);
                }
            }
            catch (error) {
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
                method: m.toUpperCase(),
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
exports.AvleonRouter = AvleonRouter;
