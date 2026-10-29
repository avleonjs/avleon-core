# Avleon

![npm version](https://img.shields.io/npm/v/@avleon/core.svg)
![CI](https://github.com/avleonjs/avleon-core/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/npm/l/@avleon/core.svg)

Avleon is a TypeScript-first web framework built on top of [Fastify](https://fastify.dev), designed for building scalable, maintainable REST APIs with minimal boilerplate. It provides decorator-based routing, built-in dependency injection, automatic OpenAPI documentation, and first-class validation support.

> **Upgrading from 0.2?** 0.3 has breaking changes in authorization, validation,
> pagination, file storage and dependencies. See [Upgrading to 0.3](#upgrading-to-03).

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
  - [Application](#application)
  - [Controllers](#controllers)
  - [Route Methods](#route-methods)
  - [Parameter Decorators](#parameter-decorators)
  - [Error Handling](#error-handling)
  - [Middleware](#middleware)
  - [Authentication](#authentication)
  - [Authorization](#authorization)
  - [Validation](#validation)
  - [Configuration](#configuration)
  - [Logging](#logging)
  - [OpenAPI Documentation](#openapi-documentation)
- [Advanced Features](#advanced-features)
  - [Database — Knex](#database--knex)
  - [Database — TypeORM](#database--typeorm)
  - [Pagination](#pagination)
  - [Events](#events)
  - [Queues & Workers](#queues--workers)
  - [Task Scheduling](#task-scheduling)
  - [Caching](#caching)
  - [File Uploads](#file-uploads)
  - [Static Files](#static-files)
  - [WebSocket (Socket.IO)](#websocket-socketio)
- [Route Mapping (Functional Style)](#route-mapping-functional-style)
- [Testing](#testing)
- [Production](#production)
- [Upgrading to 0.3](#upgrading-to-03)
- [Known Issues in 0.3.0](#known-issues-in-030)
- [Roadmap to 1.0.0](#roadmap-to-100)
- [License](#license)

---

## Features

- 🎯 **Decorator-based routing** — define controllers and routes with TypeScript decorators
- 💉 **Dependency injection** — `AvleonContainer`, powered by [TypeDI](https://github.com/typestack/typedi)
- 📄 **OpenAPI / Swagger** — automatic docs with Swagger UI or [Scalar](https://scalar.com)
- ✅ **Validation** — request DTOs validated and whitelisted via [class-validator](https://github.com/typestack/class-validator)
- 🔑 **Authentication** — pluggable handler that populates `request.user`
- 🔒 **Authorization** — deny-by-default `@Authorized` routes
- 📁 **File uploads** — multipart support with safe, confined storage
- 🗄️ **Database** — TypeORM and Knex integrations with one pagination shape
- ⚙️ **Config** — typed, environment-aware config classes
- 📣 **Events** — typed events with queued delivery and Socket.IO broadcast
- 📬 **Queues & workers** — background jobs on [BullMQ](https://docs.bullmq.io), with in-memory drivers for tests
- ⏰ **Task scheduling** — cron, interval and timeout jobs
- 🗃️ **Caching** — in-memory or Redis, with TTL and tag-based invalidation
- 📝 **Logging** — structured JSON logs via [pino](https://getpino.io)
- 🔌 **WebSocket** — Socket.IO integration
- 🧪 **Testing** — built-in test utilities

---

## Installation

Avleon requires **Node.js 20 or newer**.

Scaffold a new project using the CLI:

```bash
npx @avleon/cli new myapp
# or
yarn dlx @avleon/cli new myapp
# or
pnpm dlx @avleon/cli new myapp
```

Or install manually:

```bash
npm install @avleon/core reflect-metadata class-validator class-transformer
```

`class-validator` and `class-transformer` are declared as optional peers, but
the package imports them at load time, so install them in every project.

Enable decorators in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### Optional dependencies

Avleon keeps integrations out of the core install. Add only what you use. The
package imports fine without any of them, and you get a clear error the moment a
feature needs one:

| Feature                                      | Install                                                                           |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| CORS (`useCors`)                             | `npm i @fastify/cors`                                                             |
| File uploads (`useMultipart`, `@UploadFile`) | `npm i @fastify/multipart`                                                        |
| Static files (`useStaticFiles`)              | `npm i @fastify/static`                                                           |
| OpenAPI with Swagger UI                      | `npm i @fastify/swagger @fastify/swagger-ui`                                      |
| OpenAPI with Scalar                          | `npm i @fastify/swagger @scalar/fastify-api-reference`                            |
| TypeORM                                      | `npm i typeorm` + a driver (`pg`, `mysql2`, `sqlite3`, `better-sqlite3`, `mssql`) |
| Knex                                         | `npm i knex` + a driver                                                           |
| Queues & workers                             | `npm i bullmq ioredis` (not needed with the `memory`/`sync` drivers)              |
| Redis cache                                  | `npm i ioredis`                                                                   |
| WebSocket                                    | `npm i socket.io fastify-socket.io`                                               |
| Image transforms in `FileStorage`            | `npm i sharp`                                                                     |
| Pretty dev logs                              | `npm i -D pino-pretty`                                                            |

### Module format

`@avleon/core` ships a single CommonJS build. ESM projects can still
`import { ... } from '@avleon/core'`. Only the package root is exported:
deep imports such as `@avleon/core/dist/...` are not supported.

---

## Quick Start

### Minimal (functional style)

```typescript
import { Avleon } from "@avleon/core";

const app = Avleon.createApplication();

app.mapGet("/", () => ({ message: "Hello, Avleon!" }));

app.run(4000);
```

### Controller style

```typescript
import { Avleon, ApiController, Get } from "@avleon/core";

@ApiController("/")
class HelloController {
  @Get()
  sayHello() {
    return { message: "Hello, Avleon!" };
  }
}

const app = Avleon.createApplication();
app.useControllers([HelloController]);
app.run(4000);
```

---

## Core Concepts

### Application

```typescript
import { Avleon } from "@avleon/core";

const app = Avleon.createApplication();

app.useCors({ origin: "*" }); // requires @fastify/cors
app.useControllers([UserController]);
// Auto-discover controllers from a directory:
// app.useControllers({ auto: true, path: 'src/controllers' });

app.run(4000);
```

`app.isDevelopment()` is true only when `NODE_ENV=development`. An unset
`NODE_ENV` counts as production.

---

### Controllers

```typescript
import { ApiController, Get, Post, Put, Delete } from '@avleon/core';

@ApiController('/users')
class UserController {
  @Get('/')
  getAll() { ... }

  @Post('/')
  create() { ... }

  @Put('/:id')
  update() { ... }

  @Delete('/:id')
  remove() { ... }
}
```

---

### Route Methods

| Decorator        | HTTP Method |
| ---------------- | ----------- |
| `@Get(path?)`    | GET         |
| `@Post(path?)`   | POST        |
| `@Put(path?)`    | PUT         |
| `@Patch(path?)`  | PATCH       |
| `@Delete(path?)` | DELETE      |

---

### Parameter Decorators

```typescript
@Get('/:id')
async getUser(
  @Param('id')             id: string,
  @Query('include')        include: string,
  @Query()                 query: UserQuery,   // maps full query to a DTO
  @Body()                  body: CreateUserDto,
  @Header('authorization') token: string,
  @AuthUser()              user: CurrentUser,
) {
  // ...
}
```

| Decorator       | Source                     |
| --------------- | -------------------------- |
| `@Param(key?)`  | Route path params          |
| `@Query(key?)`  | Query string               |
| `@Body()`       | Request body               |
| `@Header(key?)` | Request headers            |
| `@AuthUser()`   | Current authenticated user |

If you compile with tsx, esbuild or SWC, the compiler does not emit decorator
metadata. Pass the DTO type explicitly so validation still runs:

```typescript
create(@Body({ type: CreateUserDto }) body: CreateUserDto) { ... }
```

---

### Error Handling

Throw an `HttpExceptions` error to send a non-200 response:

```typescript
import { HttpExceptions } from '@avleon/core';

@Get('/:id')
async getUser(@Param('id') id: string) {
  const user = await this.userService.findById(id);

  if (!user) {
    throw HttpExceptions.notFound('User not found');
  }

  return user;
}
```

Available exceptions: `badRequest` (400), `unauthorized` (401), `forbidden` (403),
`notFound` (404), `validationError` and `internalError` (500).

Error responses have the shape `{ code, status: "Error", message, data? }`.
Outside development, 5xx responses hide the message and data and return
`"Internal Server Error"`.

---

### Middleware

```typescript
import { AppMiddleware, AvleonMiddleware, IRequest } from "@avleon/core";

@AppMiddleware
class LoggingMiddleware extends AvleonMiddleware {
  async invoke(req: IRequest) {
    console.log(`${req.method} ${req.url}`);
    return req;
  }
}

// Apply to every request
app.useMiddlewares([LoggingMiddleware]);
```

Scope middleware to a controller or route with `@UseMiddleware`. In 0.3.0, pass
an **instance**. The class form crashes at boot (see
[Known Issues](#known-issues-in-030)):

```typescript
// Apply to entire controller
@UseMiddleware(new LoggingMiddleware())
@ApiController('/users')
class UserController { ... }

// Or apply to a specific route
@ApiController('/users')
class UserController {
  @UseMiddleware(new LoggingMiddleware())
  @Get('/')
  getAll() { ... }
}
```

Requests pass through these stages in order:

1. Global middlewares (`useMiddlewares`)
2. Authentication
3. Class `@Authorized`, then method `@Authorized`
4. Class `@UseMiddleware`, then method `@UseMiddleware`
5. Parameter validation
6. Handler

---

### Authentication

Authentication establishes _who_ the caller is. Register one handler and
whatever it returns becomes `request.user`, the value `@AuthUser()` injects.

**1 — Define your authentication class:**

```typescript
import { AvleonAuthentication, AppService, IRequest } from "@avleon/core";

@AppService
export class JwtAuthentication extends AvleonAuthentication<User> {
  async authenticate(request: IRequest) {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) return null;
    return verifyToken(header.slice(7)); // becomes request.user
  }
}
```

**2 — Register with the app:**

```typescript
app.useAuthentication(JwtAuthentication);
```

**3 — Read the user in any controller:**

```typescript
@ApiController("/me")
class MeController {
  @Get()
  whoami(@AuthUser() user: User) {
    return user;
  }
}
```

Returning `null` leaves `request.user` unset. Authentication only identifies
the caller; rejecting anonymous requests is the job of authorization.

---

### Authorization

Authorization is **deny-by-default**. A route marked `@Authorized` answers
**403** unless an authorizer is registered and allows the request.

**1 — Define your authorization class.** Return `false` (→ 403) or throw an
`HttpExceptions` error to deny. Any other return value allows the request:

```typescript
import { CanAuthorize, IRequest, HttpExceptions } from "@avleon/core";

@CanAuthorize
class JwtAuthorization {
  async authorize(req: IRequest, options?: { roles?: string[] }) {
    if (!req.user) throw HttpExceptions.unauthorized("Login required");
    if (options?.roles && !options.roles.includes(req.user.role)) return false;
  }
}
```

**2 — Register with the app:**

```typescript
app.useAuthorization(JwtAuthorization);

// or register several by name, and pick one with @Authorized('jwt')
app.useAuthorization({ jwt: JwtAuthorization, apiKey: ApiKeyAuthorization });
```

**3 — Protect controllers or routes:**

```typescript
// Protect entire controller
@Authorized()
@ApiController('/admin')
class AdminController {
  @Get('/')
  dashboard(@AuthUser() user: User) {
    return user;
  }
}

// Protect specific route with roles
@ApiController('/admin')
class AdminController {
  @Authorized({ roles: ['admin'] })
  @Get('/stats')
  stats() { ... }
}
```

If no authorizer is registered, Avleon logs a warning at boot and every
`@Authorized` route returns 403. `@Authorized('name')` with no handler registered
under that name makes `app.run()` fail.

---

### Validation

Validation is powered by `class-validator`. Decorate your DTOs and Avleon validates `@Body()` and `@Query()` automatically:

```typescript
import { IsString, IsNotEmpty, IsEmail, IsInt, Min, Max, IsOptional } from 'class-validator';

class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsInt()
  @Min(0)
  @Max(120)
  age: number;

  @IsOptional()
  @IsString()
  role?: string;
}

@Post('/')
async createUser(@Body() body: CreateUserDto) {
  return this.userService.create(body); // body is a CreateUserDto instance
}
```

- The handler receives the **transformed DTO instance**, so `class-transformer`
  decorators such as `@Type(() => Number)` apply.
- Properties not declared on the DTO are **rejected** (`whitelist` +
  `forbidNonWhitelisted`), which prevents mass assignment.

A failed validation returns **400**:

```json
{
  "code": 400,
  "status": "Error",
  "message": "email must be an email",
  "errors": [
    { "path": "email", "constraints": { "isEmail": "email must be an email" } }
  ]
}
```

Nested errors use dotted paths (`address.city`).

To validate a value by hand with the same rules, call
`transformAndValidate(Dto, value)`. It returns `{ value, errors }`.

---

### Configuration

Config classes turn environment variables into typed, injectable settings.
Extend `AvleonConfig` and register with `@AppConfig`:

```typescript
import { AppConfig, AvleonConfig, Environment, GetConfig } from "@avleon/core";

type MailSettings = { host: string; port: number };

@AppConfig
export class MailConfig extends AvleonConfig<MailSettings> {
  config(env: Environment): MailSettings {
    return {
      host: env.get("MAIL_HOST") || "localhost",
      port: Number(env.get("MAIL_PORT")) || 1025,
    };
  }
}

const mail = GetConfig(MailConfig); // MailSettings
```

A config class must `extend AvleonConfig`. That is how Avleon recognizes it
when you pass one to `useKnex`, `useTypeORM` or `useOpenApi`.

---

### Logging

`LoggerService` wraps [pino](https://getpino.io). It writes structured JSON by
default, and pretty output only when `NODE_ENV=development` and `pino-pretty`
is installed. Framework logs (events, queues, workers, scheduler) go through
the same logger.

```typescript
import { AppService, LoggerService } from "@avleon/core";

@AppService
export class OrdersService {
  constructor(private readonly logger: LoggerService) {}

  place(order: Order) {
    this.logger.info("order placed", { orderId: order.id });
  }
}

LoggerService.configure({ level: "debug" });
const log = LoggerService.child({ module: "billing" });
```

Avleon does not hand this logger to Fastify. To share one pino instance, pass it
in explicitly: `LoggerService.getPino()`.

---

### OpenAPI Documentation

Install the UI you want first: `@fastify/swagger` plus `@fastify/swagger-ui`,
or `@scalar/fastify-api-reference` for Scalar.

**Inline config:**

```typescript
app.useOpenApi({
  info: {
    title: "User API",
    version: "1.0.0",
    description: "API for managing users",
  },
  servers: [{ url: "http://localhost:4000", description: "Dev server" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
});
```

**Config class:**

```typescript
import { AppConfig, AvleonConfig, Environment } from "@avleon/core";

@AppConfig
export class OpenApiConfig extends AvleonConfig {
  config(env: Environment) {
    return {
      info: { title: "My API", version: "1.0.0" },
      routePrefix: "/docs",
      provider: "scalar", // or 'default' for Swagger UI
    };
  }
}

// In app.ts. Only active when NODE_ENV=development.
if (app.isDevelopment()) {
  app.useOpenApi(OpenApiConfig);
}
```

**Route-level docs with `@OpenApi`:**

```typescript
import { OpenApi, OpenApiProperty, OpenApiSchema } from '@avleon/core';

@OpenApiSchema()
export class UserQuery {
  @OpenApiProperty({ type: 'string', example: 'john', required: false })
  @IsOptional()
  search?: string;

  @OpenApiProperty({ type: 'integer', example: 1, required: false })
  @IsOptional()
  page?: number;
}

@OpenApi({
  summary: 'Get all users',
  tags: ['users'],
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      description: 'List of users',
      type: 'object',
      properties: {
        data: { type: 'array' },
        total: { type: 'integer', example: 100 },
      },
    },
    401: { description: 'Unauthorized' },
  },
})
@Get('/')
getAll(@Query() query: UserQuery) { ... }
```

Schemas are generated from decorated properties only, and nested DTOs become
`$ref`s under `components.schemas`.

---

## Advanced Features

### Database — Knex

`useKnex` connects eagerly and verifies the connection, so it returns a promise:

```typescript
await app.useKnex({
  client: "mysql",
  connection: {
    host: "127.0.0.1",
    port: 3306,
    user: "root",
    password: "password",
    database: "myapp",
  },
});
```

Using a config class:

```typescript
import { AppConfig, AvleonConfig, Environment } from "@avleon/core";
import type { Knex } from "knex";

@AppConfig
export class KnexConfig extends AvleonConfig<Knex.Config> {
  config(env: Environment): Knex.Config {
    return {
      client: "mysql",
      connection: {
        host: env.get("DB_HOST") || "127.0.0.1",
        port: Number(env.get("DB_PORT")) || 3306,
        user: env.get("DB_USER") || "root",
        password: env.get("DB_PASS") || "password",
        database: env.get("DB_NAME") || "myapp",
      },
    };
  }
}

await app.useKnex(KnexConfig);
```

Using in a service:

```typescript
import { KnexDB, AppService } from "@avleon/core";

@AppService
export class UsersService {
  constructor(private readonly db: KnexDB) {}

  async findAll() {
    return this.db.client.select("*").from("users");
  }

  async page(page: number) {
    return this.db.paginate(this.db.client("users").orderBy("id"), {
      page,
      perPage: 20,
    });
  }
}
```

---

### Database — TypeORM

`useTypeORM` initializes the DataSource, so it returns a promise:

```typescript
await app.useTypeORM({
  type: "postgres",
  host: "localhost",
  port: 5432,
  username: "postgres",
  password: "password",
  database: "avleon",
  entities: [User],
  synchronize: true,
});
```

Using a config class:

```typescript
import { AppConfig, AvleonConfig, Environment } from "@avleon/core";
import type { DataSourceOptions } from "typeorm";

@AppConfig
export class DataSourceConfig extends AvleonConfig<DataSourceOptions> {
  config(env: Environment): DataSourceOptions {
    return {
      type: "postgres",
      host: env.get("DB_HOST") || "localhost",
      port: Number(env.get("DB_PORT")) || 5432,
      username: env.get("DB_USER") || "postgres",
      password: env.get("DB_PASS") || "password",
      database: env.get("DB_NAME") || "avleon",
      entities: [User],
      synchronize: true,
    };
  }
}

await app.useTypeORM(DataSourceConfig);
```

> `useDatasource()` is deprecated and will be removed in the next major
> version. Use `useTypeORM()` instead.

**Injecting a repository.** `@InjectRepository` gives you the TypeORM repository
plus a `paginate()` method:

```typescript
import {
  AppService,
  InjectRepository,
  PaginatedRepository,
} from "@avleon/core";
import { User } from "./user.entity";

@AppService
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: PaginatedRepository<User>,
  ) {}

  findAll() {
    return this.userRepo.find();
  }

  page(page: number) {
    return this.userRepo.paginate({ page, perPage: 20 });
  }
}
```

**Custom repositories.** Extend `AvleonRepository` for pagination, transactions
and your own query methods. Query operators (`Like`, `In`, `Not`, `Between`,
`IsNull`, `Equal`, `ArrayContains`, …) are exported from `@avleon/core`.

In 0.3.0, give the class an explicit constructor that calls `super()`, even if
it has no dependencies (see [Known Issues](#known-issues-in-030)):

```typescript
import { AvleonRepository, Repository, Like } from "@avleon/core";

@Repository(User)
export class UserRepository extends AvleonRepository<User> {
  constructor(private readonly audit: AuditService) {
    super();
  }

  search(term: string, page = 1) {
    return this.paginate(
      { where: { name: Like(`%${term}%`) } },
      { page, perPage: 20 },
    );
  }

  async rename(id: number, name: string) {
    return this.transaction(async (tx) => {
      await tx.update({ id }, { name });
      await this.audit.log("rename", id);
    });
  }
}
```

`transaction()` joins an already active transaction instead of opening a nested
one. `withManager(manager)` returns a copy of the repository bound to another
`EntityManager`.

---

### Pagination

Every paginator (`Collection`, `@InjectRepository`, `AvleonRepository`,
`KnexDB`) takes `{ page, perPage }` and returns the same shape:

```json
{
  "data": [ ... ],
  "meta": { "total": 57, "page": 2, "perPage": 20, "lastPage": 3, "next": 3, "prev": 1 }
}
```

`page` defaults to 1 and `perPage` to 10. The `Paginated<T>` and `PageRequest`
types are exported.

---

### Events

```typescript
import {
  AvleonEvent,
  AvleonEventListener,
  EventRegistry,
  EventDispatcher,
} from "@avleon/core";

class UserCreated extends AvleonEvent<{ userId: number }> {}

class SendWelcome extends AvleonEventListener<UserCreated> {
  async handler(event: UserCreated) {
    await mailer.welcome(event.payload.userId);
  }
}

EventRegistry.getInstance().register(UserCreated, new SendWelcome());

const dispatcher = new EventDispatcher();
await dispatcher.dispatch(new UserCreated({ userId: 1 }));

// queued, delayed and retried
await dispatcher.dispatch(new UserCreated({ userId: 1 }), {
  queue: true,
  delay: "5s",
  retry: 3,
  retryDelay: 500,
});

// also broadcast over Socket.IO (requires app.useSocketIo())
await dispatcher.dispatch(new UserCreated({ userId: 1 }), {
  broadcast: { type: "socket", channel: "users", room: "admins" },
});
```

- Listeners are keyed by the event class.
- `once` listeners fire exactly once, even under concurrent dispatch.
- Queued jobs that keep failing are kept in
  `EventQueue.getInstance().getFailedJobs()`.
- Kafka and RabbitMQ broadcast are not implemented in 0.3, and using them
  throws.

---

### Queues & Workers

Background jobs run on [BullMQ](https://docs.bullmq.io). Install it alongside a
Redis client:

```bash
npm i bullmq ioredis
```

A queue both produces and consumes jobs. Name each job with `@JobHandler`. In
0.3.0 the class needs an explicit constructor that calls `super()` (see
[Known Issues](#known-issues-in-030)):

```typescript
import { AvleonQueue, Queue, JobHandler, Job } from "@avleon/core";

type EmailPayload = { userId: number; email: string };

@Queue({
  name: "email",
  adapter: { connection: { host: "127.0.0.1", port: 6379 } },
  worker: { concurrency: 5 },
})
export class EmailQueue extends AvleonQueue<EmailPayload> {
  constructor() {
    super();
  }

  @JobHandler("welcome")
  async sendWelcome(job: Job<EmailPayload>) {
    await mailer.send(job.data.email, "Welcome!");
  }

  @JobHandler("reminder")
  async sendReminder(job: Job<EmailPayload>) {
    await mailer.send(job.data.email, "Don't forget…");
  }
}
```

Dispatch jobs from anywhere the queue is injected:

```typescript
@AppService
export class UsersService {
  constructor(private readonly emails: EmailQueue) {}

  async register(user: User) {
    await this.emails.dispatch("welcome", {
      userId: user.id,
      email: user.email,
    });
    await this.emails.dispatch(
      "reminder",
      { userId: user.id, email: user.email },
      86_400_000,
    );
  }
}
```

Handlers declared on a base class are inherited, and a subclass may override one
by reusing its job name.

**Producer-only queues.** Pass `worker: false` when another process consumes the
jobs. No worker is started:

```typescript
@Queue({ name: "reports", worker: false })
export class ReportProducer extends AvleonQueue<ReportPayload> {
  constructor() {
    super();
  }
}
```

**Standalone workers.** When the consumer runs in its own process, use
`AvleonWorkerBase`:

```typescript
import { AvleonWorker, AvleonWorkerBase, Job } from "@avleon/core";

@AvleonWorker({ queue: "email", concurrency: 5 })
export class EmailWorker extends AvleonWorkerBase<EmailPayload> {
  async process(job: Job<EmailPayload>) {
    await mailer.send(job.data.email, "Welcome!");
  }

  onFailed(job: Job<EmailPayload> | undefined, error: Error) {
    logger.error(`Job ${job?.id} failed`, error);
  }
}
```

Register queues and workers so they start with the app and close on shutdown.
Decorating a worker class no longer starts it:

```typescript
app.useWorker([EmailQueue, EmailWorker]);
```

**In-memory drivers.** Run queues without Redis in tests and local development.
`memory` runs jobs asynchronously and honours `delay`. `sync` runs each job
before `add()` resolves:

```typescript
import {
  setQueueDriver,
  waitForMemoryQueues,
  resetMemoryQueues,
} from "@avleon/core";

setQueueDriver("memory"); // or AVLEON_QUEUE_DRIVER=memory, or @Queue({ driver: 'memory' })

await usersService.register(user);
await waitForMemoryQueues(); // wait until all jobs finish
resetMemoryQueues();
```

---

### Task Scheduling

Mark a class with `@ScheduledTask()`, then schedule its methods:

```typescript
import { ScheduledTask, Cron, Interval, Timeout } from '@avleon/core';

@ScheduledTask()
export class ReportTask {
  constructor(private readonly reports: ReportService) {}

  @Cron('0 8 * * 1-5', { timezone: 'Asia/Dhaka' })
  async sendDailyReport() {
    await this.reports.send();
  }

  @Interval(60_000)          // every minute
  async pollQueue() { ... }

  @Timeout(5_000)            // once, 5s after startup
  async warmCache() { ... }
}
```

Scheduled methods are inherited, and a subclass can override them method by
method.

Register tasks explicitly, or auto-discover them:

```typescript
app.useScheduler([ReportTask]);
// or
app.useScheduler({ path: "src/tasks" });
```

---

### Caching

In-memory by default; pass `provider: 'redis'` to use Redis instead.

```typescript
app.useCache({ provider: "memory" });

// Redis (requires: npm i ioredis)
app.useCache({
  provider: "redis",
  redisOptions: { host: "127.0.0.1", port: 6379 },
});
```

Inject `CacheManager` where you need it. Entries can carry tags, so related
keys are invalidated together:

```typescript
import { CacheManager, AppService } from "@avleon/core";

@AppService
export class UsersService {
  constructor(private readonly cache: CacheManager) {}

  async findAll() {
    const cached = await this.cache.get<User[]>("users:all");
    if (cached) return cached;

    const users = await this.repo.find();
    await this.cache.set("users:all", users, 3600, ["users"]);
    return users;
  }

  async update(user: User) {
    await this.repo.save(user);
    await this.cache.invalidateTags("users");
  }
}
```

The TTL is in seconds; `0` or less means no expiry. The memory store drops
expired entries on read and in a background sweep, every 60 s by default. It has
no size limit. Each `new CacheManager()` has its own store; the instance
registered by `useCache` is shared through DI.

---

### File Uploads

```typescript
// Configure multipart support (requires @fastify/multipart)
app.useMultipart({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});
```

```typescript
import { FileStorage, UploadFile, MultipartFile, OpenApi } from "@avleon/core";

@ApiController("/files")
class FileController {
  constructor(private readonly fileStorage: FileStorage) {}

  @OpenApi({
    description: "Upload a single file",
    requestBody: {
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            properties: { file: { type: "string", format: "binary" } },
            required: ["file"],
          },
        },
      },
    },
  })
  @Post("/upload")
  async upload(@UploadFile("file") file: MultipartFile) {
    return this.fileStorage.save(file, { to: "avatars" });
    // { filename, originalFilename, size, uploadPath, staticPath }
  }
}
```

`FileStorage` is safe by default:

- Saved files get a **random UUID name** that keeps the extension. Pass
  `saveAs: 'name.jpg'` or `preserveFilename: true` to choose the name.
- `overwrite` defaults to `false`.
- Only common safe extensions are accepted. HTML, SVG and JS are rejected.
- The default size limit is 50 MB, enforced while streaming.
- Every path, including `to`, `download`, `downloadAs`, `getUploadFile` and
  `remove`, is confined to `baseDir`. Missing files give 404.

Configure the defaults once, or override them per call:

```typescript
storage.configure({
  baseDir: "public/uploads", // default: <cwd>/public
  allowedMimeTypes: ["image/*"],
  maxFileSize: 5_000_000,
});

await storage.save(file, {
  to: "avatars",
  transform: { resize: { width: 256, height: 256 }, format: "webp" }, // requires sharp
});
```

---

### Static Files

```typescript
import path from "path";

// requires @fastify/static
app.useStaticFiles({
  path: path.join(process.cwd(), "public"),
  prefix: "/static/",
});
```

---

### WebSocket (Socket.IO)

```typescript
// requires socket.io and fastify-socket.io
app.useSocketIo({ cors: { origin: "*" } });
```

Push events to clients with `SocketEventDispatcher`:

```typescript
import { AppService, SocketEventDispatcher } from "@avleon/core";

@AppService
export class UserService {
  constructor(private readonly socket: SocketEventDispatcher) {}

  async create(data: any) {
    const user = await this.save(data);
    await this.socket.dispatch("users:created", { userId: user.id });
    return user;
  }
}
```

You can also broadcast a domain event; see [Events](#events).

---

## Route Mapping (Functional Style)

For simple routes without a controller class:

```typescript
app.mapGet("/users", async (req, res) => {
  return { users: [] };
});

app.mapPost("/users", async (req, res) => {
  return { success: true };
});

app.mapPut("/users/:id", async (req, res) => {
  return { success: true };
});

app.mapDelete("/users/:id", async (req, res) => {
  return { success: true };
});
```

Add middleware and OpenAPI docs to functional routes:

```typescript
app
  .mapGet("/users", async (req, res) => {
    return { users: [] };
  })
  .useMiddleware([AuthMiddleware])
  .useOpenApi({
    summary: "Get all users",
    tags: ["users"],
    security: [{ bearerAuth: [] }],
    response: {
      200: {
        description: "List of users",
        type: "array",
      },
    },
  });
```

Functional routes do not run authentication, `@Authorized` checks or DTO
validation.

---

## Testing

Resolve a controller directly, with its dependencies injected:

```typescript
import { AvleonTest } from "@avleon/core";
import { UserController } from "./user.controller";

describe("UserController", () => {
  let controller: UserController;

  beforeAll(() => {
    controller = AvleonTest.getController(UserController);
  });

  afterAll(() => AvleonTest.clean());

  it("should return users", async () => {
    const result = await controller.getAll();
    expect(Array.isArray(result)).toBe(true);
  });
});
```

Or exercise real routes without binding a port:

```typescript
const app = AvleonTest.createTestApplication({ controllers: [UserController] });

const res = await app.get("/users");
expect(res.statusCode).toBe(200);

const invalid = await app.post("/users", { payload: { unknown: true } });
expect(invalid.statusCode).toBe(400);
```

`get`, `post`, `put`, `patch`, `delete` and `options` are all available, each
taking Fastify's inject options (`payload`, `headers`, `query`, …).

Pass stub dependencies positionally when a controller needs them:

```typescript
const controller = AvleonTest.getController(UserController, [mockUserService]);
```

Use the `memory` or `sync` [queue driver](#queues--workers) to test code that
dispatches jobs without Redis.

---

## Production

- Set `NODE_ENV=production`. Unset also counts as production, but be explicit.
  Production mode hides 5xx details, writes JSON logs, and makes
  `app.isDevelopment()` false.
- `app.run(port)` defaults to port 4000. It handles `SIGTERM`/`SIGINT` by
  stopping the scheduler and closing registered workers before exiting.
- Register an authorizer if you use `@Authorized`; without one those routes
  return 403.

---

## Upgrading to 0.3

| Area            | Change                                                                                                                                                                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dependencies    | `@fastify/cors`, `@fastify/multipart`, `@fastify/static`, `@fastify/swagger`, `@fastify/swagger-ui`, `@scalar/fastify-api-reference`, `fastify-socket.io`, `class-validator`, `class-transformer` and `pino-pretty` are now peer dependencies. Install the ones you use ([table](#optional-dependencies)). |
| Package         | CommonJS only, with an `exports` map. Deep imports (`@avleon/core/dist/...`) no longer resolve. License is now MIT.                                                                                                                                                                                        |
| Environment     | `isDevelopment()` requires `NODE_ENV=development`; unset now means production.                                                                                                                                                                                                                             |
| Authorization   | `@Authorized` is deny-by-default. An authorizer that returns `false` now denies. `AuthorizeMiddleware`, `AppAuthorization`, `AuthHandler` and `AuthReturnTypes` were removed. Use a plain `@CanAuthorize` class with an `authorize()` method.                                                              |
| Validation      | Unknown DTO properties are rejected with 400. Handlers receive DTO instances. The error body is now `{ code, status, message, errors[] }` (was `{ code, error: "ValidationError", errors }`).                                                                                                              |
| Pagination      | All paginators return `{ data, meta: { total, page, perPage, lastPage, next, prev } }` and take `{ page, perPage }`.                                                                                                                                                                                       |
| File storage    | Random filenames, `overwrite: false`, extension allowlist and 50 MB limit by default. `save` options use `saveAs` (not `as`). `download`/`downloadAs`/`getUploadFile` resolve paths relative to `baseDir`. `UploadFileFromRequest`'s `dest` is now a string path.                                          |
| Events          | `dispatch` takes an `AvleonEvent` instance. Kafka and RabbitMQ broadcast throw. Socket broadcast requires `useSocketIo()`. `getListeners` takes a class or event, and `flushOnce` was removed.                                                                                                             |
| Queues          | `@AvleonWorker` no longer starts on import; register with `app.useWorker([...])`.                                                                                                                                                                                                                          |
| Cache           | The memory store is per instance and TTL is enforced.                                                                                                                                                                                                                                                      |
| Logging         | JSON by default; pretty only in development with `pino-pretty` installed.                                                                                                                                                                                                                                  |
| Results         | `Results.Ok(x)` now serializes as `{ headers, data, statusCode }`.                                                                                                                                                                                                                                         |
| Removed exports | `registerKnex`, `FEATURE_KEY`, `uuid`, `getLineNumber`, `MatchLocation`, `extrctParamFromUrl`, `findDuplicates`, `isClassValidator`, `validateRequestBody`, `OkOptions`, `Results.code`, `KafkaBroadcastOption`, `RabbitMqBroadcastOption`, and `ControllerOptions.version`/`since`/`meta`.                |

---

## Known Issues in 0.3.0

These are regressions or gaps in 0.3.0 that are expected to be fixed in a patch release:

- **`@UseMiddleware(SomeClass)` crashes `app.run()`.** Pass an instance,
  `@UseMiddleware(new SomeClass())`, or use `app.useMiddlewares()`.
- **`@Repository` and `@Queue` classes without an explicit constructor break
  under dependency injection.** Add `constructor() { super(); }`.
- **Status codes from `Results.Created`, `Results.NoContent`,
  `Results.NotFound`, `HttpResponse.Created` and `@HttpCode` are not applied.**
  The response is 200. Throw `HttpExceptions` to send error statuses.
- **`@Body()`/`@Query()` DTOs are missing from the generated OpenAPI document.**
  Validation still runs. Describe them with `@OpenApi({ requestBody, query })`
  for now.
- **`@All()` crashes `app.run()`.**
- **Upload policy violations return 500**, not 400 or 413.
- **`app.run()` has no `host` option.** The server binds to localhost.

---

## Roadmap to 1.0.0

1.0.0 is the first release with a stable API: after it, breaking changes wait
for 2.0. These lists track what has landed and what still blocks 1.0.0.

### Done

**Security**

- [x] `@Authorized` is deny-by-default, and an authorizer returning `false` gives 403
- [x] Handlers receive the validated DTO; unknown properties are rejected (mass-assignment protection)
- [x] File storage confines every read, write and delete to `baseDir`, including sibling-prefix and symlink escapes
- [x] Uploads get random names, don't overwrite, and are checked against an extension allowlist and a size limit
- [x] Path traversal in `UploadFileFromRequest` closed
- [x] `Content-Disposition` header injection closed
- [x] Credentials are no longer logged, and production hides 5xx details and requires `NODE_ENV=development` for dev mode
- [x] Concurrent requests no longer share `FileStorage` transform settings

**Correctness**

- [x] Built-in `Validator` accepts `0` and enforces `min` / `max` / `exact` / `optional`
- [x] Missing decorator metadata (tsx, esbuild, SWC) no longer crashes; `@Body({ type })` supplies the type
- [x] TypeORM query operators work at runtime
- [x] `AvleonRepository.transaction()` runs inside the transaction, and `@InjectRepository` works after `useTypeORM()`
- [x] Collection fixes: `paginate`, `min`, `findAsync`
- [x] One pagination shape across Collection, TypeORM and Knex
- [x] Events keyed by class, exactly-once `once` listeners, `delay` honoured when queued, failed jobs kept
- [x] Scheduler decorators no longer leak into parent classes
- [x] In-memory cache enforces TTL; Redis tag sets expire
- [x] JSON logs in production; framework logs go through `LoggerService`
- [x] OpenAPI component schemas generated without instantiating classes

**Features**

- [x] Producer-only queues (`worker: false`) and workers that no longer start on import
- [x] In-memory `memory` and `sync` queue drivers for tests
- [x] `Results.Created` / `NoContent` / `OkStream` and `@HttpCode` APIs (not yet applied; see below)

**Packaging and tooling**

- [x] CommonJS-only build with an `exports` map and `sideEffects` ([module format](docs/module-format.md))
- [x] Integrations moved to optional peer dependencies
- [x] Keep typedi behind `AvleonContainer` for 1.0 ([ADR 001](docs/adr-001-typedi.md))
- [x] MIT license file matches `package.json`
- [x] Build without rimraf, ESLint/Jest configs fixed, husky 9, coverage off by default
- [x] CI on Node 20 and 22 (typecheck, lint, test, build) and a tag-based publish workflow
- [x] Request-pipeline integration tests

**Docs**

- [x] README and docs site rewritten for the current API, with an upgrade guide
- [x] New pages: authentication, file uploads, caching, logging
- [x] Docs site moved to VitePress, with template links removed and typos fixed

### Left for 1.0.0

**Regressions from 0.3.0** (see [Known Issues](#known-issues-in-030))

- [ ] `@UseMiddleware(SomeClass)` crashes boot
- [ ] `@Repository` / `@Queue` classes without a constructor break under DI
- [ ] Apply status codes from `Results`, `HttpResponse.Created` and `@HttpCode`
- [ ] Put `@Body()` / `@Query()` DTO schemas back into the OpenAPI document
- [ ] Upload policy violations should return 400 / 413, not 500

**Core correctness**

- [ ] `useScheduler({ path })` crashes `run()` (wrong `require` path)
- [ ] `@UploadFile` / `@UploadFiles` don't await `saveRequestFiles()`
- [ ] `@All()` crashes at registration
- [ ] Respect `error.statusCode` (401, 413, 415, 429, …) for non-HTTP-exception errors
- [ ] One consistent middleware order; resolve `@UseMiddleware` through DI
- [ ] Route metadata cache is keyed on `constructor.name`, so same-named classes collide
- [ ] Controller discovery: `_resolveControllerDir` ignores its argument and rewrites the first `src` in the path; repeated `useControllers` calls overwrite each other
- [ ] Functional routes: add `mapPatch`, and run authentication, DI and the standard error shape
- [ ] `run()` `host` option (default `0.0.0.0` in containers)
- [ ] Graceful shutdown: `app.close()` and close TypeORM, Knex, Redis and Socket.IO with a drain timeout instead of `process.exit(0)`
- [ ] `PartialType` / `OmitType` / `PickType` don't carry class-validator rules correctly
- [ ] Scalar `spec.content` returns the plugin module instead of the spec
- [ ] `Environment` re-reads `.env` on every `get()`, and `dotenv` loads on import
- [ ] Socket handler errors become unhandled rejections
- [ ] `@AvleonWorker` `autoStart` is not wired to app boot
- [ ] `class-validator` / `class-transformer` are loaded at import time despite being optional peers

**Missing features**

- [ ] Security headers (helmet) and rate limiting as `use*` options
- [ ] Health and readiness endpoints
- [ ] Request IDs in logs, and the logger wired into Fastify
- [ ] Redirects and response headers from handlers
- [ ] Pluggable error handler / exception filters
- [ ] Lifecycle hooks (`onInit`, `onBootstrap`, `onShutdown`)
- [ ] Config schema validation at boot
- [ ] Global route prefix and API versioning
- [ ] Compression
- [ ] Socket.IO handshake authentication and per-channel authorization

**API cleanup** (a 1.0 surface is a promise)

- [ ] Finish or remove the no-ops `useHttps()`, `useSerialization()` and `mapFeatures()`, and remove deprecated `useDatasource()`
- [ ] Remove the `AvleonSocketIo` stubs and unused adapter types
- [ ] Remove `KnexHooks` / `KnexHooksFactory`, `DuplicateRouteException`, `mapRoute()` and `registerMiddleware()`
- [ ] Stop exporting `mock-db` from the public index, and build without Jest types
- [ ] Replace remaining `console.log` calls with the logger

**Tests**

- [ ] `application.ts`: `run()`, shutdown, controller auto-discovery, `useScheduler({ path })`
- [ ] Events, scheduler, workers, Redis cache, `testing.ts`, `map-types.ts`, config
- [ ] Fix hollow tests and `AvleonTest` (`from()` race, global container mutation)
- [ ] Coverage thresholds

**CLI** (`@avleon/cli`, rewrite in progress)

- [ ] Finish the commander-based rewrite: `--help` / `--version`, consistent flags and naming, refuse to overwrite existing projects
- [ ] Generated code compiles against `@avleon/core`
- [ ] CLI tests (snapshots for every `make:*` command)
- [ ] Release with versions matched to core

**Docs and release**

- [ ] Pages for configuration, scheduler, testing, dependency injection, responses, deployment and security hardening
- [ ] API reference and FAQ
- [ ] Update `docs/architecture.md` (stale file list, "acyclic" claim)
- [ ] Changelog and a versioning policy across core, CLI and docs

---

## License

MIT © [Tareq Hossain](https://github.com/xtareq)
