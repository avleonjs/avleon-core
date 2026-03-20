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
  - [Authorization](#authorization)
  - [Validation](#validation)
  - [OpenAPI Documentation](#openapi-documentation)
- [Advanced Features](#advanced-features)
  - [Database — Knex](#database--knex)
  - [Database — TypeORM](#database--typeorm)
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
- 🔒 **Authorization** — flexible middleware-based auth system
- 📁 **File uploads** — multipart form support out of the box
- 🗄️ **Database** — TypeORM and Knex integrations
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
import { Middleware, AppMiddleware, IRequest, UseMiddleware } from '@avleon/core';

@Middleware
class LoggingMiddleware extends AppMiddleware {
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
import { AppConfig, IConfig, Environment } from '@avleon/core';

@AppConfig
export class OpenApiConfig implements IConfig {
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

```typescript
app.useKnex({
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
@AppConfig
export class KnexConfig implements IConfig {
  config(env: Environment) {
    return {
      client: 'mysql',
      connection: {
        host:     env.get('DB_HOST')     || '127.0.0.1',
        port:     env.get('DB_PORT')     || 3306,
        user:     env.get('DB_USER')     || 'root',
        password: env.get('DB_PASS')     || 'password',
        database: env.get('DB_NAME')     || 'myapp',
      },
    };
  }
}

app.useKnex(KnexConfig);
```

Using in a service:

```typescript
import { DB, AppService } from '@avleon/core';

@AppService
export class UsersService {
  constructor(private readonly db: DB) {}

  async findAll() {
    return this.db.client.select('*').from('users');
  }
}
```

---

### Database — TypeORM

```typescript
app.useDataSource({
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
@AppConfig
export class DataSourceConfig implements IConfig {
  config(env: Environment) {
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

app.useDataSource(DataSourceConfig);
```

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
  .useMiddleware([AuthMiddleware])
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

```typescript
import { AvleonTest } from '@avleon/core';
import { UserController } from './user.controller';

describe('UserController', () => {
  let controller: UserController;

  beforeAll(() => {
    controller = AvleonTest.getController(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return users', async () => {
    const result = await controller.getAll();
    expect(Array.isArray(result)).toBe(true);
  });
});
```

---

## License

ISC © [Tareq Hossain](https://github.com/xtareq)