/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import Fastify, { FastifyInstance, HTTPMethods } from "fastify";
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
import { BaseHttpException } from "../exceptions";
import { SystemUseError } from "../exceptions/system-exception";
import { Constructor } from "../helpers";
import { generateSwaggerSchema } from "../swagger-schema";
import { OpenApiUiOptions } from "../openapi";
import { AvleonMiddleware } from "../middleware";
import { AvleonScheduler } from "../task-scheduler";
import { isApiController } from "../container";
import { AutoControllerOptions, IResponse, TestApplication } from "./types";
import { IConfig } from "../config";

// ---------------------------------------------------------------------------
// Lazy loaders for optional peer dependencies
// ---------------------------------------------------------------------------

function requireTypeorm() {
  try {
    return require("typeorm");
  } catch {
    throw new Error(
      "[Avleon] typeorm is not installed.\n" +
      "Run: npm install typeorm\n" +
      "Then install a driver: npm install pg  (or mysql2, sqlite3, etc.)",
    );
  }
}

function requireSocketIo() {
  try {
    return require("fastify-socket.io");
  } catch {
    throw new Error(
      "[Avleon] fastify-socket.io is not installed.\n" +
      "Run: npm install fastify-socket.io socket.io",
    );
  }
}

function requireKnex() {
  try {
    return require("knex");
  } catch {
    throw new Error(
      "[Avleon] knex is not installed.\n" +
      "Run: npm install knex\n" +
      "Then install a driver: npm install pg  (or mysql2, sqlite3, etc.)",
    );
  }
}

function requireSwagger() {
  try {
    return require("@fastify/swagger");
  } catch {
    throw new Error(
      "[Avleon] @fastify/swagger is not installed.\n" +
      "Run: npm install @fastify/swagger @fastify/swagger-ui",
    );
  }
}

function requireSwaggerUi() {
  try {
    return require("@fastify/swagger-ui");
  } catch {
    throw new Error(
      "[Avleon] @fastify/swagger-ui is not installed.\n" +
      "Run: npm install @fastify/swagger-ui",
    );
  }
}

function requireScalar() {
  try {
    return require("@scalar/fastify-api-reference");
  } catch {
    throw new Error(
      "[Avleon] @scalar/fastify-api-reference is not installed.\n" +
      "Run: npm install @scalar/fastify-api-reference",
    );
  }
}

function requireCors() {
  try {
    return require("@fastify/cors");
  } catch {
    throw new Error(
      "[Avleon] @fastify/cors is not installed.\n" +
      "Run: npm install @fastify/cors",
    );
  }
}

function requireMultipart() {
  try {
    return require("@fastify/multipart");
  } catch {
    throw new Error(
      "[Avleon] @fastify/multipart is not installed.\n" +
      "Run: npm install @fastify/multipart",
    );
  }
}

function requireStatic() {
  try {
    return require("@fastify/static");
  } catch {
    throw new Error(
      "[Avleon] @fastify/static is not installed.\n" +
      "Run: npm install @fastify/static",
    );
  }
}

// ---------------------------------------------------------------------------
// Knex integration types
// ---------------------------------------------------------------------------

/** Lifecycle hooks passed to useKnex. */
export interface KnexHooks {
  /** Called once after the knex instance is created and ready. */
  onInit?: (db: any) => void | Promise<void>;
  /** Called when knex encounters a connection error. */
  onError?: (err: Error) => void;
}

/** A sync or async factory that returns KnexHooks. */
export type KnexHooksFactory = () => KnexHooks | Promise<KnexHooks>;

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------

export class AvleonApplication implements IAvleonApplication {
  public app: FastifyInstance;
  private router: AvleonRouter;
  private static instance: AvleonApplication;
  private alreadyRun = false;
  private hasSwagger = false;
  private globalSwaggerOptions: OpenApiUiOptions | undefined;
  private dataSourceOptions: any | null = null; // ✅ no longer typed as DataSourceOptions
  private dataSource: any | null = null; // ✅ no longer typed as DataSource
  private isMapFeatures = false;
  private registerControllerAuto = false;
  private registerControllerPath = "src/controllers";
  private controllers: any[] = [];
  private _hasWebsocket = false;
  private io: any;
  private _knexHooksFactory: KnexHooksFactory | null = null;
  private scheduler: AvleonScheduler = new AvleonScheduler();
  private schedulerTasks: any[] = [];
  private registerSchedulerAuto = false;
  private registerSchedulerPath = "src/tasks";

  private constructor(options?: AvleonApplicationOptions) {
    this.app = Fastify({
      ...options?.server,
      ajv: {
        customOptions: {
          strict: false,
          ...options?.server?.ajv?.customOptions,
        },
      },
    }) as FastifyInstance;
    this.router = new AvleonRouter(this.app);

    // ✅ Only load typeorm if dataSourceOptions provided
    if (options?.dataSourceOptions) {
      this.dataSourceOptions = options.dataSourceOptions;
      if (this.dataSourceOptions) {
        const { DataSource } = requireTypeorm();
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

  /** @deprecated Use `getApp` instead. This is internal. */
  public static getInternalApp(options?: AvleonApplicationOptions) {
    return new AvleonApplication(options);
  }

  // ── Feature methods ──────────────────────────────────────────────────────

  useCors(options: CorsOptions) {
    this.app.register(requireCors(), options); // ✅ lazy
    return this;
  }

  useDatasource(dataSource: any) {
    // ✅ lazy — only resolve DataSource token when actually used
    const { DataSource } = requireTypeorm();
    this.dataSource = dataSource;
    Container.set(DataSource, this.dataSource);
    return this;
  }

  useMultipart(options?: any) {
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

  useOpenApi(options: OpenApiUiOptions | Constructor<IConfig<OpenApiUiOptions>>) {
    this.hasSwagger = true;
    if (
      typeof options === "function" &&
      options.prototype != null &&
      typeof options.prototype.config === "function"
    ) {
      const { GetConfig } = require("../config");
      this.globalSwaggerOptions = GetConfig(options);
    } else {
      this.globalSwaggerOptions = options as OpenApiUiOptions;
    }

    return this;
  }

  private async initSwagger(options?: OpenApiUiOptions) {
    const safeControllers = (this.controllers ?? []).filter(
      (c) => c != null && typeof c === "function",
    );
    const baseSchema = generateSwaggerSchema(safeControllers);

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
    } else {
      await this.app.register(requireSwaggerUi(), {
        // ✅ lazy
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

  /**
   * Register one or more authorization handlers.
   *
   * Single handler:
   *   app.useAuthorization(JwtAuthorization)
   *
   * Named map (multi-strategy):
   *   app.useAuthorization({ jwt: JwtAuthorization, oauth: OAuthV2 })
   *
   * Then in controllers:
   *   @Authorized()                    // uses the first/default handler
   *   @Authorized("jwt")               // uses the "jwt" handler
   *   @Authorized({ name: "oauth" })   // uses the "oauth" handler
   */
  useAuthorization(authorization: Constructor<any> | Record<string, Constructor<any>>) {
    if (typeof authorization === "function") {
      this.router.setAuthorizeMiddleware(authorization);
    } else {
      this.router.setAuthorizeMiddlewareMap(authorization);
    }
    return this;
  }

  useSerialization() {
    return this;
  }

  /**
   * Register scheduled task classes.
   *
   * Explicit list:
   *   app.useScheduler([ReportTask, CleanupTask])
   *
   * Auto-scan a directory (mirrors useControllers):
   *   app.useScheduler({ path: "src/tasks" })
   */
  useScheduler(tasks: Constructor[] | { path: string }) {
    if (Array.isArray(tasks)) {
      this.schedulerTasks = tasks;
      this.scheduler.addTaskClasses(tasks);
    } else {
      this.registerSchedulerAuto = true;
      if (tasks.path) this.registerSchedulerPath = tasks.path;
    }
    return this;
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
    return this;
  }

  useStaticFiles(options?: any) {
    this.app.register(requireStatic(), options); // ✅ lazy
    return this;
  }

  useHttps(options?: any) {
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
    if ((options as any).scheduler) this.useScheduler((options as any).scheduler);
    return this;
  }

  useSocketIo(options?: any) {
    this._hasWebsocket = true;
    this.app.register(requireSocketIo(), options); // ✅ lazy
    return this;
  }

  /**
   * Configure Knex. Three call forms are supported:
   *
   * 1. Raw knex config object (original behaviour):
   *    app.useKnex({ client: "pg", connection: "..." })
   *
   * 2. IConfig class:
   *    app.useKnex(DatabaseConfig)
   *
   * 3. IConfig class + async hooks factory:
   *    app.useKnex(DatabaseConfig, async () => ({
   *      onInit(db) { console.log("connected"); },
   *      onError(err) { console.error(err); },
   *    }))
   */
  useKnex(config: any, hooksFactory?: KnexHooksFactory) {
    try {
      const { DB } = require("../kenx-provider");
      const db = Container.get(DB) as any;

      // Resolve config: IConfig class, plain object, or { config: ... } wrapper
      let resolvedConfig: any;
      if (
        typeof config === "function" &&
        config.prototype != null &&
        typeof config.prototype.config === "function"
      ) {
        const { GetConfig } = require("../config");
        resolvedConfig = GetConfig(config);
      } else {
        resolvedConfig = config.config ?? config;
      }

      db.init(resolvedConfig);

      if (hooksFactory) {
        this._knexHooksFactory = hooksFactory;
      }
    } catch (e: any) {
      // Only intercept MODULE_NOT_FOUND (knex or driver not installed).
      // All other errors (bad config, missing @AppConfig, wrong credentials)
      // must surface as-is so the real message is visible to the developer.
      if (e.code === "MODULE_NOT_FOUND") {
        throw new Error(
          "[Avleon] knex or a database driver is not installed.\n" +
          "Run: npm install knex pg  (or mysql2, mssql, sqlite3, etc.)\n" +
          `Original: ${e.message}`,
        );
      }
      throw e;
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

  private async _mapControllers() {
    const safeControllers = (this.controllers ?? []).filter(
      (c) => c != null && typeof c === "function",
    );
    if (safeControllers.length > 0) {
      for (const controller of safeControllers) {
        if (isApiController(controller)) {
          await this.router.buildController(controller);
        } else {
          throw new SystemUseError("Not an API controller.");
        }
      }
    }
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
    const isTsNode =
      process.env.TS_NODE_DEV ||
      process.env.TS_NODE_PROJECT ||
      (process as any)[Symbol.for("ts-node.register.instance")];

    try {
      const files = fs.readdirSync(conDir, {
        recursive: true,
        encoding: "utf-8",
      }) as string[];

      for (const file of files) {
        const isTestFile = /\.(test|spec|e2e-spec)\.(ts|js)$/.test(file);
        if (isTestFile) continue;
        if (isTsNode ? file.endsWith(".ts") : file.endsWith(".js")) {
          const filePath = path.join(conDir, file);
          const module = await import(filePath);
          for (const exported of Object.values(module)) {
            if (typeof exported === "function" && isApiController(exported)) {
              if (!this.controllers.some((con) => exported.name === con.name)) {
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
    try {
      Container.get("features");
    } catch {
      // features token not registered — safe to ignore
    }
  }

  private async initializeDatabase() {
    if (this.dataSourceOptions && this.dataSource) {
      await this.dataSource.initialize();
    }
  }

  private handleSocket(socket: any) {
    // ✅ lazy — only resolve socket services when socket actually connects
    try {
      const { SocketContextService } = require("../event-dispatcher");
      const { EventSubscriberRegistry } = require("../event-subscriber");
      const { SocketIoServer } = require("../websocket");

      const contextService = Container.get(SocketContextService) as any;
      const subscriberRegistry = Container.get(EventSubscriberRegistry) as any;

      subscriberRegistry.register(socket);

      const originalOn = socket.on.bind(socket);
      socket.on = (event: string, handler: Function) => {
        return originalOn(event, (...args: any[]) => {
          contextService.run(socket, () => handler(...args));
        });
      };
    } catch (e) {
      console.warn("[Avleon] Socket handler error:", e);
    }
  }

  // ── Functional routing proxies ───────────────────────────────────────────

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

  // ── Run ──────────────────────────────────────────────────────────────────

  private async _initKnexHooks(): Promise<void> {
    if (!this._knexHooksFactory) return;
    try {
      const { DB } = require("../kenx-provider");
      const db = Container.get(DB) as any;
      const hooks = await this._knexHooksFactory();
      if (hooks.onInit) {
        await hooks.onInit(db.instance ?? db);
      }
      if (hooks.onError) {
        const knexInstance = db.instance ?? db;
        if (knexInstance && typeof knexInstance.on === "function") {
          knexInstance.on("error", hooks.onError);
        }
      }
    } catch (e: any) {
      console.warn("[Avleon] Knex hooks error:", e?.message ?? e);
    }
  }

  private async _autoSchedulerTasks(): Promise<void> {
    const isTsNode =
      process.env.TS_NODE_DEV ||
      process.env.TS_NODE_PROJECT ||
      (process as any)[Symbol.for("ts-node.register.instance")];
    const nodePath = require("path");
    const nodeFs = require("fs");
    const { isScheduledTask } = require("../schedule-registry");
    const dir = nodePath.join(process.cwd(), this.registerSchedulerPath);
    const resolvedDir = isTsNode ? dir : dir.replace("src", "dist");
    try {
      const files = nodeFs.readdirSync(resolvedDir, { recursive: true, encoding: "utf-8" }) as string[];
      for (const file of files) {
        const isTest = /\.(test|spec|e2e-spec)\.(ts|js)$/.test(file);
        if (isTest) continue;
        if (isTsNode ? file.endsWith(".ts") : file.endsWith(".js")) {
          const mod = await import(nodePath.join(resolvedDir, file));
          for (const exported of Object.values(mod)) {
            if (typeof exported === "function" && isScheduledTask(exported)) {
              if (!this.schedulerTasks.some((t) => t.name === (exported as any).name)) {
                this.schedulerTasks.push(exported);
                this.scheduler.addTaskClasses([exported as any]);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("[Avleon] Could not auto-register tasks from " + resolvedDir, e);
    }
  }

  async run(port: number = 4000, fn?: CallableFunction): Promise<void> {
    if (this.alreadyRun) throw new SystemUseError("App already running");
    this.alreadyRun = true;

    if (this.hasSwagger) {
      await this.initSwagger(this.globalSwaggerOptions);
    }

    await this.initializeDatabase();
    await this._initKnexHooks();

    if (this.isMapFeatures) {
      this._mapFeatures();
    }

    if (this.registerControllerAuto) {
      await this.autoControllers();
    }

    await this._mapControllers();
    this.router.processFunctionalRoutes();

    // Start scheduler after DB is ready and controllers are mapped,
    // but before the HTTP server starts accepting traffic.
    if (this.registerSchedulerAuto) {
      await this._autoSchedulerTasks();
    }
    if (this.schedulerTasks.length > 0) {
      this.scheduler.start();
    }

    this.app.setErrorHandler((error: any, request, reply) => {
      const isDev = process.env.NODE_ENV === "development";
      const timestamp = new Date().toISOString();
      const requestInfo = `${request.method} ${request.url}`;

      // ✅ Handle Fastify AJV validation errors — these come with statusCode 400
      if ((error as any).statusCode === 400 || (error as any).validation) {
        console.warn(
          `[${timestamp}] HTTP 400 ${requestInfo} — ${error.message}`,
        );
        return reply.status(400).send({
          code: 400,
          status: "Error",
          message: error.message,
          errors: (error as any).validation ?? undefined,
        });
      }

      if (error instanceof BaseHttpException) {
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

      // Unexpected errors
      console.error(`\n❌ UNHANDLED ERROR @ ${timestamp}`);
      console.error(`   ${requestInfo}`);
      console.error(`   ${error.name}: ${error.message}`);
      if (error.stack) {
        console.error(
          `   Stack:\n${error.stack
            .split("\n")
            .slice(1)
            .map((l: any) => `      ${l.trim()}`)
            .join("\n")}`,
        );
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
        throw new Error(
          "Socket.IO not initialized. Make sure fastify-socket.io is registered correctly.",
        );
      }
      // ✅ lazy — resolve SocketIoServer token only when websocket is ready
      try {
        const { SocketIoServer } = require("../websocket");
        // @ts-ignore
        Container.set(SocketIoServer, this.app.io);
        // @ts-ignore
        await this.app.io.on("connection", this.handleSocket.bind(this));
      } catch (e) {
        console.warn("[Avleon] WebSocket setup error:", e);
      }
    }

    const gracefulStop = () => { this.scheduler.stopAll(); process.exit(0); };
    process.once("SIGTERM", gracefulStop);
    process.once("SIGINT", gracefulStop);

    await this.app.listen({ port });
    console.log(`Application running on http://127.0.0.1:${port}`);
    if (fn) fn();
  }
}