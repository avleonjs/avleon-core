/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import Fastify, { FastifyInstance, HTTPMethods } from "fastify";
import "@fastify/swagger";
import path from "path";
import fs from "fs";
import { AvleonRouter } from "./router";
import Container from "typedi";
import {
    IAvleonApplication,
    AvleonApplicationOptions,
    CorsOptions,
    GlobalOptions,
} from "../interfaces/avleon-application";
import {
    BaseHttpException,
    ValidationErrorException,
} from "../exceptions";
import { SystemUseError } from "../exceptions/system-exception";
import { Constructor, isValidJsonString } from "../helpers";
import {
    generateSwaggerSchema,
} from "../swagger-schema";
import { OpenApiUiOptions } from "../openapi";
import { DataSource, DataSourceOptions } from "typeorm";
import { DB } from "../kenx-provider";
import { AvleonMiddleware } from "../middleware";
import { SocketContextService } from "../event-dispatcher";
import { EventSubscriberRegistry } from "../event-subscriber";
import { SocketIoServer } from "../websocket";
import { isApiController } from "../container";
import { AutoControllerOptions, IResponse, TestApplication } from "./types";


export class AvleonApplication implements IAvleonApplication {
    public app: FastifyInstance;
    private router: AvleonRouter;
    private static instance: AvleonApplication;
    private alreadyRun = false;
    private hasSwagger = false;
    private globalSwaggerOptions: OpenApiUiOptions | undefined;
    private dataSourceOptions: DataSourceOptions | null = null;
    private dataSource: DataSource | null = null;
    private isMapFeatures = false;
    private registerControllerAuto = false;
    private registerControllerPath = "src/controllers";
    private controllers: any[] = [];
    private _hasWebsocket = false;
    private io: any;

    private constructor(options?: AvleonApplicationOptions) {
        this.app = Fastify({
            ...options?.server,
            ajv: {
                customOptions: {
                    strict: false, // allows `example`, `examples` and other OpenAPI keywords
                },
                ...options?.server?.ajv,
            },
        });
        this.router = new AvleonRouter(this.app);
        if (options?.dataSourceOptions) {
            this.dataSourceOptions = options.dataSourceOptions;
            if (this.dataSourceOptions) {
                this.dataSource = new DataSource(this.dataSourceOptions);
                Container.set(DataSource, this.dataSource);
            }
        }
    }

    public static getApp(options?: AvleonApplicationOptions) {
        if (!AvleonApplication.instance) {
            AvleonApplication.instance = new AvleonApplication(options);
        }
        return AvleonApplication.instance;
    }

    /**
     * @deprecated Use `getApp` instead. This is internal.
     */
    public static getInternalApp(options?: AvleonApplicationOptions) {
        return new AvleonApplication(options);
    }

    useCors(options: CorsOptions) {
        this.app.register(require("@fastify/cors"), options);
        return this;
    }

    useDatasource(dataSource: DataSource) {
        this.dataSource = dataSource;
        Container.set(DataSource, this.dataSource);
        return this;
    }

    useMultipart(options?: any) {
        this.app.register(require("@fastify/multipart"), {
            attachFieldsToBody: true,
            limits: {
                fileSize: 10 * 1024 * 1024, // 10MB default
            },
            ...options,
        });
        return this;
    }

    useOpenApi(options: OpenApiUiOptions) {
        this.hasSwagger = true;
        this.globalSwaggerOptions = options;
        return this;
    }

    private async initSwagger(options?: OpenApiUiOptions) {
        const safeControllers = (this.controllers ?? []).filter(
            (c) => c != null && typeof c === "function"
        );
        const baseSchema = generateSwaggerSchema(safeControllers);
        await this.app.register(require("@fastify/swagger"), {
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
            await this.app.register(require("@scalar/fastify-api-reference"), {
                routePrefix,
                configuration: {
                    spec: {
                        content: () => this.app.swagger(),
                    },
                    ...options?.uiConfig,
                },
            });
        } else {
            await this.app.register(require("@fastify/swagger-ui"), {
                routePrefix,

                uiConfig: {
                    docExpansion: "full",
                    deepLinking: false,
                    ...options?.uiConfig,

                },
                uiHooks: {
                    onRequest: function (request: any, reply: any, next: any) {
                        next();
                    },
                    preHandler: function (request: any, reply: any, next: any) {
                        next();
                    },
                },
                staticCSP: true,
                transformSpecificationClone: true,

            });
        }
    }
    useMiddlewares(middlewares: Constructor<AvleonMiddleware>[]) {
        middlewares.forEach((m) => {
            const cls = Container.get<AvleonMiddleware>(m);
            this.app.addHook("preHandler", async (req, res) => {
                await cls.invoke(req as any, res as IResponse);
            });
        });
        return this;
    }

    useAuthorization(authorization: Constructor<any>) {
        this.router.setAuthorizeMiddleware(authorization);
        return this;
    }

    useSerialization() {
        // Implementation if needed, currently seemingly handled elsewhere or default
        return this;
    }

    useControllers(controllers: Constructor[] | AutoControllerOptions) {
        if (Array.isArray(controllers)) {
            this.controllers = controllers;
            // Dedupe
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
        return this;
    }

    useStaticFiles(options: any) {
        this.app.register(require("@fastify/static"), options);
        return this;
    }

    useHttps(options?: any) {
        // Fastify handles https via server options usually, but if this is strictly for https
        // this might need logic. Original icore didn't show body for this.
        return this;
    }

    useGlobal(options: GlobalOptions) {
        if (options.cors) this.useCors(options.cors);
        if (options.openApi) this.useOpenApi(options.openApi);
        if (options.controllers) this.useControllers(options.controllers);
        if (options.middlewares) this.useMiddlewares(options.middlewares);
        if (options.authorization) this.useAuthorization(options.authorization);
        if (options.multipart) this.useMultipart(options.multipart);
        if (options.staticFiles) this.useStaticFiles(options.staticFiles);
        return this;
    }

    useSocketIo(options?: any) {
        this._hasWebsocket = true;
        this.app.register(require("fastify-socket.io"), options);
        return this;
    }

    useKnex(options: any) {
        const db = Container.get(DB);
        db.init(options.config);
        return this;
    }

    mapFeatures() {
        this.isMapFeatures = true;
        return this;
    }

    private async _mapControllers() {
        if (this.controllers.length > 0) {
            for (let controller of this.controllers) {
                if (isApiController(controller)) {
                    await this.router.buildController(controller);
                } else {
                    throw new SystemUseError("Not a api controller.");
                }
            }
        }
    }

    // Auto controller discovery logic
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

        // This relies on isTsNode logic which we might want to clean up, but keeping for parity
        const isTsNode =
            process.env.TS_NODE_DEV ||
            process.env.TS_NODE_PROJECT ||
            (process as any)[Symbol.for("ts-node.register.instance")];


        try {
            const files = await fs.readdirSync(conDir, { recursive: true, encoding: 'utf-8' }) as string[]; // recursive readdir is node 20+
            for (const file of files) {
                const isTestFile = /\.(test|spec|e2e-spec)\.ts$/.test(file);
                if (isTestFile) continue;
                if (isTsNode ? file.endsWith(".ts") : file.endsWith(".js")) {
                    const filePath = path.join(conDir, file);
                    // Dynamically import
                    const module = await import(filePath);
                    for (const exported of Object.values(module)) {
                        if (typeof exported === "function" && isApiController(exported)) {
                            // double check if constructor
                            if (!this.controllers.some((con) => exported.name == con.name)) {
                                this.controllers.push(exported);
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.warn("Could not auto-register controllers from " + conDir, e);
        }
    }

    private _mapFeatures() {
        // Placeholder as per original
        const features = Container.get("features");
    }

    async initializeDatabase() {
        if (this.dataSourceOptions && this.dataSource) {
            await this.dataSource.initialize();
        }
    }

    handleSocket(socket: any) {
        const contextService = Container.get(SocketContextService);
        const subscriberRegistry = Container.get(EventSubscriberRegistry);

        subscriberRegistry.register(socket);

        // Wrap all future event handlers with context
        const originalOn = socket.on.bind(socket);
        socket.on = (event: string, handler: Function) => {
            return originalOn(event, (...args: any[]) => {
                contextService.run(socket, () => handler(...args));
            });
        };
    }

    // Proxy routing methods to Router for functional usage
    mapGet<T extends (...args: any[]) => any>(path: string = "", fn: T) {
        return this.router.mapGet(path, fn);
    }
    mapPost<T extends (...args: any[]) => any>(path: string = "", fn: T) {
        return this.router.mapPost(path, fn);
    }
    mapPut<T extends (...args: any[]) => any>(path: string = "", fn: T) {
        return this.router.mapPut(path, fn);
    }
    mapDelete<T extends (...args: any[]) => any>(path: string = "", fn: T) {
        return this.router.mapDelete(path, fn);
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

        // Process functional routes if any were added to router
        this.router.processFunctionalRoutes();

        this.app.setErrorHandler((error, request, reply) => {
            const isDev = process.env.NODE_ENV === "development";
            const timestamp = new Date().toISOString();
            const requestInfo = `${request.method} ${request.url}`;

            if (error instanceof BaseHttpException) {
                // ✅ Expected HTTP errors — compact one-liner
                console.warn(
                    `[${timestamp}] HTTP ${error.code} ${requestInfo} — ${error.message}`,
                );

                return reply
                    .status(error.code || 500)
                    .type("application/json")
                    .serializer((payload: any) => JSON.stringify(payload))
                    .send({
                        code: error.code,
                        status: "Error",
                        message: error.message,
                        data: error.payload,
                    });
            }

            // ✅ Unexpected errors — full details
            console.error(`\n❌ UNHANDLED ERROR @ ${timestamp}`);
            console.error(`   ${requestInfo}`);
            console.error(`   ${error.name}: ${error.message}`);
            if (error.stack) {
                console.error(
                    `   Stack:\n${error.stack
                        .split("\n")
                        .slice(1)           // skip first line (duplicate of message)
                        .map((l) => `      ${l.trim()}`)
                        .join("\n")}`,
                );
            }
            if (isDev) {
                console.error(`   Params:`, JSON.stringify(request.params));
                console.error(`   Query: `, JSON.stringify(request.query));
                console.error(`   Body:  `, JSON.stringify(request.body));
            }
            console.error(""); // blank line for readability

            return reply.status(500).send({
                code: 500,
                status: "Error",
                message: isDev ? error.message : "Internal Server Error",
                ...(isDev && {
                    error: error.name,
                    stack: error.stack?.split("\n").slice(0, 5), // first 5 lines only
                }),
            });
        });
        await this.app.ready();
        if (this._hasWebsocket) {
            // @ts-ignore
            if (!this.app.io) {
                throw new Error(
                    "Socket.IO not initialized. Make sure fastify-socket.io is registered correctly.",
                );
            }

            // Register the io instance in Container
            // @ts-ignore
            Container.set(SocketIoServer, this.app.io);

            // Then register connection handler
            // @ts-ignore
            await this.app.io.on("connection", this.handleSocket.bind(this));
        }
        await this.app.listen({ port });
        console.log(`Application running on http://127.0.0.1:${port}`);
        if (fn) fn();
    }
}
