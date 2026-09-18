# Avleon

![npm version](https://img.shields.io/npm/v/@avleon/core.svg)
![Build](https://github.com/avleonjs/avleon-core/actions/workflows/release.yml/badge.svg)
![License](https://img.shields.io/npm/l/@avleon/core.svg)

> **🚧 This project is in active development. APIs may change between versions.**

Avleon is a TypeScript-first web framework built on top of [Fastify](https://fastify.dev), designed for building scalable, maintainable REST APIs with minimal boilerplate. It provides decorator-based routing, built-in dependency injection, automatic OpenAPI documentation, and first-class validation support.

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
  - [OpenAPI Documentation](#openapi-documentation)
- [Advanced Features](#advanced-features)
  - [Database — Knex](#database--knex)
  - [Database — TypeORM](#database--typeorm)
  - [Queues & Workers](#queues--workers)
  - [Task Scheduling](#task-scheduling)
  - [Caching](#caching)
  - [File Uploads](#file-uploads)
  - [Static Files](#static-files)
  - [WebSocket (Socket.IO)](#websocket-socketio)
- [Route Mapping (Functional Style)](#route-mapping-functional-style)
- [Testing](#testing)
- [License](#license)

---

## Features

- 🎯 **Decorator-based routing** — define controllers and routes with TypeScript decorators
- 💉 **Dependency injection** — powered by [TypeDI](https://github.com/typestack/typedi)
- 📄 **OpenAPI / Swagger** — automatic docs with Swagger UI or [Scalar](https://scalar.com)
- ✅ **Validation** — request validation via [class-validator](https://github.com/typestack/class-validator)
- 🔑 **Authentication** — pluggable handler that populates `request.user`
- 🔒 **Authorization** — flexible middleware-based auth system
- 📁 **File uploads** — multipart form support out of the box
- 🗄️ **Database** — TypeORM and Knex integrations
- ⚙️ **Config** — typed, environment-aware config classes
- 📬 **Queues & workers** — background jobs on [BullMQ](https://docs.bullmq.io)
- ⏰ **Task scheduling** — cron, interval and timeout jobs
- 🗃️ **Caching** — in-memory or Redis, with tag-based invalidation
- 🔌 **WebSocket** — Socket.IO integration
- 🧪 **Testing** — built-in test utilities

---

## Installation

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

### Optional dependencies

Avleon keeps integrations out of the core install. Add only what you use — the
package imports fine without any of them, and you get a clear error the moment a
feature needs one:

| Feature | Install |
| --- | --- |
| TypeORM | `npm i typeorm` + a driver (`pg`, `mysql2`, `sqlite3`, …) |
| Knex | `npm i knex` + a driver |
| Queues & workers | `npm i bullmq ioredis` |
| Redis cache | `npm i ioredis` |
| WebSocket | `npm i socket.io fastify-socket.io` |

---

## Quick Start

### Minimal (functional style)

```typescript
import { Avleon } from '@avleon/core';

const app = Avleon.createApplication();

app.mapGet('/', () => ({ message: 'Hello, Avleon!' }));

app.run(4000);
```

### Controller style

```typescript
import { Avleon, ApiController, Get } from '@avleon/core';

@ApiController('/')
class HelloController {
  @Get()
  sayHello() {
    return { message: 'Hello, Avleon!' };
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
import { Avleon } from '@avleon/core';

const app = Avleon.createApplication();

app.useCors({ origin: '*' });
app.useControllers([UserController]);
// Auto-discover controllers from a directory:
// app.useControllers({ auto: true, path: 'src/controllers' });

app.run(4000);
```

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

| Decorator | HTTP Method |
|-----------|-------------|
| `@Get(path?)` | GET |
| `@Post(path?)` | POST |
| `@Put(path?)` | PUT |
| `@Patch(path?)` | PATCH |
| `@Delete(path?)` | DELETE |

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

| Decorator | Source |
|-----------|--------|
| `@Param(key?)` | Route path params |
| `@Query(key?)` | Query string |
| `@Body()` | Request body |
| `@Header(key?)` | Request headers |
| `@AuthUser()` | Current authenticated user |

---

### Error Handling

```typescript
import { HttpExceptions, HttpResponse } from '@avleon/core';

@Get('/:id')
async getUser(@Param('id') id: string) {
  const user = await this.userService.findById(id);

  if (!user) {
    throw HttpExceptions.NotFound('User not found');
  }

  return HttpResponse.Ok(user);
}
```

Available exceptions: `NotFound`, `BadRequest`, `Unauthorized`, `Forbidden`, `InternalServerError`.

---

### Middleware

```typescript
import { AppMiddleware, AvleonMiddleware, IRequest, UseMiddleware } from '@avleon/core';

@AppMiddleware
class LoggingMiddleware extends AvleonMiddleware {
  async invoke(req: IRequest) {
    console.log(`${req.method} ${req.url}`);
    return req;
  }
}

// Apply to entire controller
@UseMiddleware(LoggingMiddleware)
@ApiController('/users')
class UserController { ... }

// Or apply to a specific route
@ApiController('/users')
class UserController {
  @UseMiddleware(LoggingMiddleware)
  @Get('/')
  getAll() { ... }
}
```

---

### Authentication

Authentication establishes *who* the caller is. Register one handler and
whatever it returns becomes `request.user` — the value `@AuthUser()` injects.

**1 — Define your authentication class:**

```typescript
import { AvleonAuthentication, AppService, IRequest } from '@avleon/core';

@AppService
export class JwtAuthentication extends AvleonAuthentication<User> {
  async authenticate(request: IRequest) {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
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
@ApiController('/me')
class MeController {
  @Get()
  whoami(@AuthUser() user: User) {
    return user;
  }
}
```

Returning `null` leaves `request.user` unset — authentication only identifies
the caller. Rejecting anonymous requests is the job of authorization.

---

### Authorization

**1 — Define your authorization class:**

```typescript
import { CanAuthorize, AuthorizeMiddleware, IRequest } from '@avleon/core';

@CanAuthorize
class JwtAuthorization extends AuthorizeMiddleware {
  async authorize(req: IRequest, options?: any) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) throw HttpExceptions.Unauthorized('Missing token');
    req.user = verifyToken(token); // attach user to request
  }
}
```

**2 — Register with the app:**

```typescript
app.useAuthorization(JwtAuthorization);
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

---

### Validation

Validation is powered by `class-validator`. Decorate your DTOs and Avleon validates automatically:

```typescript
import { IsString, IsEmail, IsInt, Min, Max, IsOptional } from 'class-validator';

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
  return this.userService.create(body);
}
```

---

### Configuration

Config classes turn environment variables into typed, injectable settings.
Extend `AvleonConfig` and register with `@AppConfig`:

```typescript
import { AppConfig, AvleonConfig, Environment, GetConfig } from '@avleon/core';

type MailSettings = { host: string; port: number };

@AppConfig
export class MailConfig extends AvleonConfig<MailSettings> {
  config(env: Environment): MailSettings {
    return {
      host: env.get('MAIL_HOST') || 'localhost',
      port: Number(env.get('MAIL_PORT')) || 1025,
    };
  }
}

const mail = GetConfig(MailConfig); // MailSettings
```

A config class must `extend AvleonConfig` — that is how Avleon recognizes it
when you pass one to `useKnex`, `useTypeORM` or `useOpenApi`.

---

### OpenAPI Documentation

**Inline config:**

```typescript
app.useOpenApi({
  info: {
    title: 'User API',
    version: '1.0.0',
    description: 'API for managing users',
  },
  servers: [{ url: 'http://localhost:4000', description: 'Dev server' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
});
```

**Config class:**

```typescript
import { AppConfig, AvleonConfig, Environment } from '@avleon/core';

@AppConfig
export class OpenApiConfig extends AvleonConfig {
  config(env: Environment) {
    return {
      info: { title: 'My API', version: '1.0.0' },
      routePrefix: '/docs',
      provider: 'scalar', // or 'default' for Swagger UI
    };
  }
}

// In app.ts
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

---

## Advanced Features

### Database — Knex

`useKnex` connects eagerly and verifies the connection, so it returns a promise:

```typescript
await app.useKnex({
  client: 'mysql',
  connection: {
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'password',
    database: 'myapp',
  },
});
```

Using a config class:

```typescript
import { AppConfig, AvleonConfig, Environment } from '@avleon/core';
import type { Knex } from 'knex';

@AppConfig
export class KnexConfig extends AvleonConfig<Knex.Config> {
  config(env: Environment): Knex.Config {
    return {
      client: 'mysql',
      connection: {
        host:     env.get('DB_HOST') || '127.0.0.1',
        port:     Number(env.get('DB_PORT')) || 3306,
        user:     env.get('DB_USER') || 'root',
        password: env.get('DB_PASS') || 'password',
        database: env.get('DB_NAME') || 'myapp',
      },
    };
  }
}

await app.useKnex(KnexConfig);
```

Using in a service:

```typescript
import { KnexDB, AppService } from '@avleon/core';

@AppService
export class UsersService {
  constructor(private readonly db: KnexDB) {}

  async findAll() {
    return this.db.client.select('*').from('users');
  }
}
```

---

### Database — TypeORM

`useTypeORM` initializes the DataSource, so it returns a promise:

```typescript
await app.useTypeORM({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'password',
  database: 'avleon',
  entities: [User],
  synchronize: true,
});
```

Using a config class:

```typescript
import { AppConfig, AvleonConfig, Environment } from '@avleon/core';
import type { DataSourceOptions } from 'typeorm';

@AppConfig
export class DataSourceConfig extends AvleonConfig<DataSourceOptions> {
  config(env: Environment): DataSourceOptions {
    return {
      type:      'postgres',
      host:      env.get('DB_HOST') || 'localhost',
      port:      Number(env.get('DB_PORT')) || 5432,
      username:  env.get('DB_USER') || 'postgres',
      password:  env.get('DB_PASS') || 'password',
      database:  env.get('DB_NAME') || 'avleon',
      entities:  [User],
      synchronize: true,
    };
  }
}

await app.useTypeORM(DataSourceConfig);
```

> `useDatasource()` is deprecated and will be removed in the next stable
> version. Use `useTypeORM()` instead.

Using in a service:

```typescript
import { AppService, InjectRepository } from '@avleon/core';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@AppService
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findAll() {
    return this.userRepo.find();
  }
}
```

---

### Queues & Workers

Background jobs run on [BullMQ](https://docs.bullmq.io). Install it alongside a
Redis client:

```bash
npm i bullmq ioredis
```

A queue both produces and consumes jobs. Name each job with `@JobHandler`:

```typescript
import { AvleonQueue, Queue, JobHandler, Job } from '@avleon/core';

type EmailPayload = { userId: number; email: string };

@Queue({
  name: 'email',
  adapter: { connection: { host: '127.0.0.1', port: 6379 } },
  worker: { concurrency: 5 },
})
export class EmailQueue extends AvleonQueue<EmailPayload> {
  @JobHandler('welcome')
  async sendWelcome(job: Job<EmailPayload>) {
    await mailer.send(job.data.email, 'Welcome!');
  }

  @JobHandler('reminder')
  async sendReminder(job: Job<EmailPayload>) {
    await mailer.send(job.data.email, 'Don't forget…');
  }
}
```

Dispatch jobs from anywhere the queue is injected:

```typescript
@AppService
export class UsersService {
  constructor(private readonly emails: EmailQueue) {}

  async register(user: User) {
    await this.emails.dispatch('welcome', { userId: user.id, email: user.email });
    await this.emails.dispatch('reminder', { userId: user.id, email: user.email }, 86_400_000);
  }
}
```

Handlers declared on a base class are inherited, and a subclass may override one
by reusing its job name.

**Standalone workers.** When the consumer runs in its own process, use
`AvleonWorkerBase`:

```typescript
import { AvleonWorker, AvleonWorkerBase, Job } from '@avleon/core';

@AvleonWorker({ queue: 'email', concurrency: 5 })
export class EmailWorker extends AvleonWorkerBase<EmailPayload> {
  async process(job: Job<EmailPayload>) {
    await mailer.send(job.data.email, 'Welcome!');
  }

  onFailed(job: Job<EmailPayload> | undefined, error: Error) {
    logger.error(`Job ${job?.id} failed`, error);
  }
}
```

Register workers so they start with the app and close on shutdown:

```typescript
app.useWorker([EmailQueue, EmailWorker]);
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

Register tasks explicitly, or auto-discover them:

```typescript
app.useScheduler([ReportTask]);
// or
app.useScheduler({ path: 'src/tasks' });
```

---

### Caching

In-memory by default; pass `provider: 'redis'` to use Redis instead.

```typescript
app.useCache({ provider: 'memory' });

// Redis (requires: npm i ioredis)
app.useCache({
  provider: 'redis',
  redisOptions: { host: '127.0.0.1', port: 6379 },
});
```

Inject `CacheManager` where you need it. Entries can carry tags, so related
keys are invalidated together:

```typescript
import { CacheManager, AppService } from '@avleon/core';

@AppService
export class UsersService {
  constructor(private readonly cache: CacheManager) {}

  async findAll() {
    const cached = await this.cache.get<User[]>('users:all');
    if (cached) return cached;

    const users = await this.repo.find();
    await this.cache.set('users:all', users, 3600, ['users']);
    return users;
  }

  async update(user: User) {
    await this.repo.save(user);
    await this.cache.invalidateTags('users');
  }
}
```

---

### File Uploads

```typescript
// Configure multipart support
app.useMultipart({
  destination: path.join(process.cwd(), 'public/uploads'),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});
```

```typescript
import { FileStorage, UploadFile, MultipartFile } from '@avleon/core';

@ApiController('/files')
class FileController {
  constructor(private readonly fileStorage: FileStorage) {}

  @OpenApi({
    description: 'Upload a single file',
    body: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @Post('/upload')
  async upload(@UploadFile('file') file: MultipartFile) {
    const result = await this.fileStorage.save(file);
    // optionally rename: this.fileStorage.save(file, { as: 'newname.jpg' })
    return result;
    // { uploadPath: '/uploads/...', staticPath: '/static/...' }
  }
}
```

---

### Static Files

```typescript
import path from 'path';

app.useStaticFiles({
  path: path.join(process.cwd(), 'public'),
  prefix: '/static/',
});
```

---

### WebSocket (Socket.IO)

```typescript
app.useSocketIo({ cors: { origin: '*' } });
```

Dispatch events from services:

```typescript
import { AppService, EventDispatcher } from '@avleon/core';

@AppService
export class UserService {
  constructor(private readonly dispatcher: EventDispatcher) {}

  async create(data: any) {
    const user = await this.save(data);
    await this.dispatcher.dispatch('users:created', { userId: user.id });
    return user;
  }
}
```

---

## Route Mapping (Functional Style)

For simple routes without a controller class:

```typescript
app.mapGet('/users', async (req, res) => {
  return { users: [] };
});

app.mapPost('/users', async (req, res) => {
  return { success: true };
});

app.mapPut('/users/:id', async (req, res) => {
  return { success: true };
});

app.mapDelete('/users/:id', async (req, res) => {
  return { success: true };
});
```

Add middleware and OpenAPI docs to functional routes:

```typescript
app
  .mapGet('/users', async (req, res) => {
    return { users: [] };
  })
  .useMiddlewares([AuthMiddleware])
  .useOpenApi({
    summary: 'Get all users',
    tags: ['users'],
    security: [{ bearerAuth: [] }],
    response: {
      200: {
        description: 'List of users',
        type: 'array',
      },
    },
  });
```

---

## Testing

Resolve a controller directly, with its dependencies injected:

```typescript
import { AvleonTest } from '@avleon/core';
import { UserController } from './user.controller';

describe('UserController', () => {
  let controller: UserController;

  beforeAll(() => {
    controller = AvleonTest.getController(UserController);
  });

  afterAll(() => AvleonTest.clean());

  it('should return users', async () => {
    const result = await controller.getAll();
    expect(Array.isArray(result)).toBe(true);
  });
});
```

Or exercise real routes without binding a port:

```typescript
const app = AvleonTest.createTestApplication({ controllers: [UserController] });

const res = await app.get('/users');
expect(res.statusCode).toBe(200);

const created = await app.post('/users', { payload: { name: 'Tareq' } });
expect(created.statusCode).toBe(201);
```

`get`, `post`, `put`, `patch`, `delete` and `options` are all available, each
taking Fastify's inject options (`payload`, `headers`, `query`, …).

Pass stub dependencies positionally when a controller needs them:

```typescript
const controller = AvleonTest.getController(UserController, [mockUserService]);
```

---

## License

ISC © [Tareq Hossain](https://github.com/xtareq)