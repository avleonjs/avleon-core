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
exports.AvleonApplication = void 0;
/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
const fastify_1 = __importDefault(require("fastify"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router_1 = require("./router");
const typedi_1 = __importDefault(require("typedi"));
const exceptions_1 = require("../exceptions");
const system_exception_1 = require("../exceptions/system-exception");
const swagger_schema_1 = require("../swagger-schema");
const container_1 = require("../container");
// ---------------------------------------------------------------------------
// Lazy loaders for optional peer dependencies
// ---------------------------------------------------------------------------
function requireTypeorm() {
    try {
        return require("typeorm");
    }
    catch {
        throw new Error("[Avleon] typeorm is not installed.\n" +
            "Run: npm install typeorm\n" +
            "Then install a driver: npm install pg  (or mysql2, sqlite3, etc.)");
    }
}
function requireSocketIo() {
    try {
        return require("fastify-socket.io");
    }
    catch {
        throw new Error("[Avleon] fastify-socket.io is not installed.\n" +
            "Run: npm install fastify-socket.io socket.io");
    }
}
function requireKnex() {
    try {
        return require("knex");
    }
    catch {
        throw new Error("[Avleon] knex is not installed.\n" +
            "Run: npm install knex\n" +
            "Then install a driver: npm install pg  (or mysql2, sqlite3, etc.)");
    }
}
function requireSwagger() {
    try {
        return require("@fastify/swagger");
    }
    catch {
        throw new Error("[Avleon] @fastify/swagger is not installed.\n" +
            "Run: npm install @fastify/swagger @fastify/swagger-ui");
    }
}
function requireSwaggerUi() {
    try {
        return require("@fastify/swagger-ui");
    }
    catch {
        throw new Error("[Avleon] @fastify/swagger-ui is not installed.\n" +
            "Run: npm install @fastify/swagger-ui");
    }
}
function requireScalar() {
    try {
        return require("@scalar/fastify-api-reference");
    }
    catch {
        throw new Error("[Avleon] @scalar/fastify-api-reference is not installed.\n" +
            "Run: npm install @scalar/fastify-api-reference");
    }
}
function requireCors() {
    try {
        return require("@fastify/cors");
    }
    catch {
        throw new Error("[Avleon] @fastify/cors is not installed.\n" +
            "Run: npm install @fastify/cors");
    }
}
function requireMultipart() {
    try {
        return require("@fastify/multipart");
    }
    catch {
        throw new Error("[Avleon] @fastify/multipart is not installed.\n" +
            "Run: npm install @fastify/multipart");
    }
}
function requireStatic() {
    try {
        return require("@fastify/static");
    }
    catch {
        throw new Error("[Avleon] @fastify/static is not installed.\n" +
            "Run: npm install @fastify/static");
    }
}
// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------
class AvleonApplication {
    app;
    router;
    static instance;
    alreadyRun = false;
    hasSwagger = false;
    globalSwaggerOptions;
    dataSourceOptions = null; // ✅ no longer typed as DataSourceOptions
    dataSource = null; // ✅ no longer typed as DataSource
    isMapFeatures = false;
    registerControllerAuto = false;
    registerControllerPath = "src/controllers";
    controllers = [];
    _hasWebsocket = false;
    io;
    constructor(options) {
        this.app = (0, fastify_1.default)({
            ...options?.server,
            ajv: {
                customOptions: {
                    strict: false,
                    ...options?.server?.ajv?.customOptions,
                },
            },
        });
        this.router = new router_1.AvleonRouter(this.app);
        // ✅ Only load typeorm if dataSourceOptions provided
        if (options?.dataSourceOptions) {
            this.dataSourceOptions = options.dataSourceOptions;
            if (this.dataSourceOptions) {
                const { DataSource } = requireTypeorm();
                this.dataSource = new DataSource(this.dataSourceOptions);
                typedi_1.default.set(DataSource, this.dataSource);
            }
        }
    }
    static getApp(options) {
        if (!AvleonApplication.instance) {
            AvleonApplication.instance = new AvleonApplication(options);
        }
        return AvleonApplication.instance;
    }
    /** @deprecated Use `getApp` instead. This is internal. */
    static getInternalApp(options) {
        return new AvleonApplication(options);
    }
    // ── Feature methods ──────────────────────────────────────────────────────
    useCors(options) {
        this.app.register(requireCors(), options); // ✅ lazy
        return this;
    }
    useDatasource(dataSource) {
        // ✅ lazy — only resolve DataSource token when actually used
        const { DataSource } = requireTypeorm();
        this.dataSource = dataSource;
        typedi_1.default.set(DataSource, this.dataSource);
        return this;
    }
    useMultipart(options) {
        this.app.register(requireMultipart(), {
            // ✅ lazy
            attachFieldsToBody: true,
            limits: {
                fileSize: 10 * 1024 * 1024,
            },
            ...options,
        });
        return this;
    }
    useOpenApi(options) {
        this.hasSwagger = true;
        this.globalSwaggerOptions = options;
        return this;
    }
    async initSwagger(options) {
        const safeControllers = (this.controllers ?? []).filter((c) => c != null && typeof c === "function");
        const baseSchema = (0, swagger_schema_1.generateSwaggerSchema)(safeControllers);
        await this.app.register(requireSwagger(), {
            // ✅ lazy
            openapi: {
                ...baseSchema,
                info: options?.info || { title: "API", version: "1.0.0" },
                servers: options?.servers,
                tags: options?.tags,
                components: {
                    ...baseSchema?.components,
                    ...options?.components,
                    schemas: {
                        ...baseSchema?.components?.schemas,
                        ...options?.components?.schemas,
                    },
                },
                security: options?.security,
                externalDocs: options?.externalDocs,
            },
        });
        const routePrefix = options?.routePrefix || "/swagger";
        if (options?.provider === "scalar") {
            await this.app.register(requireScalar(), {
                // ✅ lazy
                routePrefix,
                configuration: {
                    spec: {
                        content: () => requireSwagger(),
                    },
                    ...options?.uiConfig,
                },
            });
        }
        else {
            await this.app.register(requireSwaggerUi(), {
                // ✅ lazy
                routePrefix,
                uiConfig: {
                    docExpansion: "full",
                    deepLinking: false,
                    ...options?.uiConfig,
                },
                uiHooks: {
                    onRequest: function (request, reply, next) {
                        next();
                    },
                    preHandler: function (request, reply, next) {
                        next();
                    },
                },
                staticCSP: true,
                transformSpecificationClone: true,
            });
        }
    }
    useMiddlewares(middlewares) {
        middlewares.forEach((m) => {
            const cls = typedi_1.default.get(m);
            this.app.addHook("preHandler", async (req, res) => {
                await cls.invoke(req, res);
            });
        });
        return this;
    }
    useAuthorization(authorization) {
        this.router.setAuthorizeMiddleware(authorization);
        return this;
    }
    useSerialization() {
        return this;
    }
    useControllers(controllers) {
        if (Array.isArray(controllers)) {
            this.controllers = controllers;
            controllers.forEach((controller) => {
                if (!this.controllers.includes(controller)) {
                    this.controllers.push(controller);
                }
            });
        }
        else {
            this.registerControllerAuto = true;
            if (controllers.path) {
                this.registerControllerPath = controllers.path;
            }
        }
        return this;
    }
    useStaticFiles(options) {
        this.app.register(requireStatic(), options); // ✅ lazy
        return this;
    }
    useHttps(options) {
        return this;
    }
    useGlobal(options) {
        if (options.cors)
            this.useCors(options.cors);
        if (options.openApi)
            this.useOpenApi(options.openApi);
        if (options.controllers)
            this.useControllers(options.controllers);
        if (options.middlewares)
            this.useMiddlewares(options.middlewares);
        if (options.authorization)
            this.useAuthorization(options.authorization);
        if (options.multipart)
            this.useMultipart(options.multipart);
        if (options.staticFiles)
            this.useStaticFiles(options.staticFiles);
        return this;
    }
    useSocketIo(options) {
        this._hasWebsocket = true;
        this.app.register(requireSocketIo(), options); // ✅ lazy
        return this;
    }
    useKnex(options) {
        // ✅ lazy — only load DB + knex when explicitly called
        try {
            const { DB } = require("../kenx-provider");
            const db = typedi_1.default.get(DB);
            db.init(options.config ?? options);
        }
        catch (e) {
            if (e.message?.includes("knex"))
                throw e;
            throw new Error("[Avleon] Failed to initialize Knex. Make sure knex and a database driver are installed.\n" +
                "Run: npm install knex pg  (or mysql2, sqlite3, etc.)");
        }
        return this;
    }
    mapFeatures() {
        this.isMapFeatures = true;
        return this;
    }
    isDevelopment() {
        return process.env.NODE_ENV === "development" || !process.env.NODE_ENV;
    }
    async _mapControllers() {
        const safeControllers = (this.controllers ?? []).filter((c) => c != null && typeof c === "function");
        if (safeControllers.length > 0) {
            for (const controller of safeControllers) {
                if ((0, container_1.isApiController)(controller)) {
                    await this.router.buildController(controller);
                }
                else {
                    throw new system_exception_1.SystemUseError("Not an API controller.");
                }
            }
        }
    }
    _resolveControllerDir(dir) {
        const isTsNode = process.env.TS_NODE_DEV ||
            process.env.TS_NODE_PROJECT ||
            process[Symbol.for("ts-node.register.instance")];
        const controllerDir = path_1.default.join(process.cwd(), this.registerControllerPath);
        return isTsNode ? controllerDir : controllerDir.replace("src", "dist");
    }
    async autoControllers(controllersPath) {
        const conDir = this._resolveControllerDir(controllersPath);
        const isTsNode = process.env.TS_NODE_DEV ||
            process.env.TS_NODE_PROJECT ||
            process[Symbol.for("ts-node.register.instance")];
        try {
            const files = fs_1.default.readdirSync(conDir, {
                recursive: true,
                encoding: "utf-8",
            });
            for (const file of files) {
                const isTestFile = /\.(test|spec|e2e-spec)\.(ts|js)$/.test(file);
                if (isTestFile)
                    continue;
                if (isTsNode ? file.endsWith(".ts") : file.endsWith(".js")) {
                    const filePath = path_1.default.join(conDir, file);
                    const module = await Promise.resolve(`${filePath}`).then(s => __importStar(require(s)));
                    for (const exported of Object.values(module)) {
                        if (typeof exported === "function" && (0, container_1.isApiController)(exported)) {
                            if (!this.controllers.some((con) => exported.name === con.name)) {
                                this.controllers.push(exported);
                            }
                        }
                    }
                }
            }
        }
        catch (e) {
            console.warn("Could not auto-register controllers from " + conDir, e);
        }
    }
    _mapFeatures() {
        try {
            typedi_1.default.get("features");
        }
        catch {
            // features token not registered — safe to ignore
        }
    }
    async initializeDatabase() {
        if (this.dataSourceOptions && this.dataSource) {
            await this.dataSource.initialize();
        }
    }
    handleSocket(socket) {
        // ✅ lazy — only resolve socket services when socket actually connects
        try {
            const { SocketContextService } = require("../event-dispatcher");
            const { EventSubscriberRegistry } = require("../event-subscriber");
            const { SocketIoServer } = require("../websocket");
            const contextService = typedi_1.default.get(SocketContextService);
            const subscriberRegistry = typedi_1.default.get(EventSubscriberRegistry);
            subscriberRegistry.register(socket);
            const originalOn = socket.on.bind(socket);
            socket.on = (event, handler) => {
                return originalOn(event, (...args) => {
                    contextService.run(socket, () => handler(...args));
                });
            };
        }
        catch (e) {
            console.warn("[Avleon] Socket handler error:", e);
        }
    }
    // ── Functional routing proxies ───────────────────────────────────────────
    mapGet(path = "", fn) {
        return this.router.mapGet(path, fn);
    }
    mapPost(path = "", fn) {
        return this.router.mapPost(path, fn);
    }
    mapPut(path = "", fn) {
        return this.router.mapPut(path, fn);
    }
    mapDelete(path = "", fn) {
        return this.router.mapDelete(path, fn);
    }
    // ── Run ──────────────────────────────────────────────────────────────────
    async run(port = 4000, fn) {
        if (this.alreadyRun)
            throw new system_exception_1.SystemUseError("App already running");
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
        this.router.processFunctionalRoutes();
        this.app.setErrorHandler((error, request, reply) => {
            const isDev = process.env.NODE_ENV === "development";
            const timestamp = new Date().toISOString();
            const requestInfo = `${request.method} ${request.url}`;
            // ✅ Handle Fastify AJV validation errors — these come with statusCode 400
            if (error.statusCode === 400 || error.validation) {
                console.warn(`[${timestamp}] HTTP 400 ${requestInfo} — ${error.message}`);
                return reply.status(400).send({
                    code: 400,
                    status: "Error",
                    message: error.message,
                    errors: error.validation ?? undefined,
                });
            }
            if (error instanceof exceptions_1.BaseHttpException) {
                console.warn(`[${timestamp}] HTTP ${error.code} ${requestInfo} — ${error.message}`);
                return reply
                    .status(error.code || 500)
                    .type("application/json")
                    .serializer((payload) => JSON.stringify(payload))
                    .send({
                    code: error.code,
                    status: "Error",
                    message: error.message,
                    data: error.payload,
                });
            }
            // Unexpected errors
            console.error(`\n❌ UNHANDLED ERROR @ ${timestamp}`);
            console.error(`   ${requestInfo}`);
            console.error(`   ${error.name}: ${error.message}`);
            if (error.stack) {
                console.error(`   Stack:\n${error.stack
                    .split("\n")
                    .slice(1)
                    .map((l) => `      ${l.trim()}`)
                    .join("\n")}`);
            }
            if (isDev) {
                console.error(`   Params:`, JSON.stringify(request.params));
                console.error(`   Query: `, JSON.stringify(request.query));
                console.error(`   Body:  `, JSON.stringify(request.body));
            }
            console.error("");
            return reply.status(500).send({
                code: 500,
                status: "Error",
                message: isDev ? error.message : "Internal Server Error",
                ...(isDev && {
                    error: error.name,
                    stack: error.stack?.split("\n").slice(0, 5),
                }),
            });
        });
        await this.app.ready();
        if (this._hasWebsocket) {
            // @ts-ignore
            if (!this.app.io) {
                throw new Error("Socket.IO not initialized. Make sure fastify-socket.io is registered correctly.");
            }
            // ✅ lazy — resolve SocketIoServer token only when websocket is ready
            try {
                const { SocketIoServer } = require("../websocket");
                // @ts-ignore
                typedi_1.default.set(SocketIoServer, this.app.io);
                // @ts-ignore
                await this.app.io.on("connection", this.handleSocket.bind(this));
            }
            catch (e) {
                console.warn("[Avleon] WebSocket setup error:", e);
            }
        }
        await this.app.listen({ port });
        console.log(`Application running on http://127.0.0.1:${port}`);
        if (fn)
            fn();
    }
}
exports.AvleonApplication = AvleonApplication;
