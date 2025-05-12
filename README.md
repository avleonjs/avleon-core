# AvleonJs

## ⚠️ WARNING: NOT FOR PRODUCTION USE

> **🚧 This project is in active development.**
>
> It is **not stable** and **not ready** for live environments.  
> Use **only for testing, experimentation, or internal evaluation**.
>
> ####❗ Risks of using this in production:
>
> - 🔄 Breaking changes may be introduced at any time
> - 🧪 Features are experimental and may be unstable
> - 🔐 Security has not been audited
> - 💥 Potential for data loss or critical errors
>
> **Please do not deploy this in production environments.**

## Overview

Avleon is a powerful, TypeScript-based web framework built on top of Fastify, designed to simplify API development with a focus on decorators, dependency injection, and OpenAPI documentation. It provides a robust set of tools for building scalable, maintainable web applications with minimal boilerplate code.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
  - [Route Based](#route-based)
  - [Controller Based](#controller-based)
- [Core Concepts](#core-concepts)
  - [Application Creation](#application-creation)
  - [Controllers](#controllers)
  - [Route Methods](#route-methods)
  - [Parameter Decorators](#parameter-decorators)
  - [Response Handling](#response-handling)
  - [Middleware](#middleware)
  - [Authentication & Authorization](#authentication--authorization)
  - [Validation](#validation)
  - [OpenAPI Documentation](#openapi-documentation)
- [Advanced Features](#advanced-features)
  - [Database Integration](#database-integration)
  - [File Uploads](#file-uploads)
  - [Static Files](#static-files)
  - [Testing](#testing)
- [Configuration](#configuration)
- [Route Mapping](#route-mapping)
  - [mapGet](#mapget)
  - [mapPost](#mappost)
  - [mapPut](#mapput)
  - [mapDelete](#mapdelete)

## Features

- **Decorator-based API Development**: Define controllers, routes, and middleware using TypeScript decorators
- **Dependency Injection**: Built-in DI system using TypeDI for service management
- **OpenAPI/Swagger Integration**: Automatic API documentation generation with support for both Swagger UI and Scalar
- **Validation**: Request validation with support for class-validator and custom validation rules
- **Middleware System**: Flexible middleware architecture for request processing
- **Response Handling**: Standardized response formats with HTTP status codes
- **File Upload**: Built-in support for multipart file uploads with file validation
- **Authentication & Authorization**: Middleware for securing your API endpoints
- **Database Integration**: Support for TypeORM for database operations
- **Queue System**: Background job processing capabilities
- **Environment Configuration**: Environment variable management
- **Logging**: Integrated logging with Pino
- **Testing**: Built-in testing utilities for API endpoints

## Installation

```bash
npm install @avleon/core
# or
yarn add @avleon/core
# or
pnpm add @avleon/core
```

## Quick Start

### Route Based

```typescript
import { Avleon, ApiController, Get, Results } from "@avleon/core";

const app = Avleon.createApplication();
app.mapGet("/", () => "Hello, Avleon");
app.run(); // or app.run(3000);
```

### Controller Based

```typescript
import { Avleon, ApiController, Get, Results } from "@avleon/core";

// Define a controller
@ApiController
class HelloController {
  @Get()
  sayHello() {
    return "Hello, Avleon!";
  }
}

// Create and start the application
const app = Avleon.createApplication();
app.useControllers([HelloController]);
app.run();
```

## Core Concepts

### Application Creation

Avleon provides a builder pattern for creating applications:

```typescript
import { Avleon } from "@avleon/core";

// Create an application
const app = Avleon.createApplication();

// Configure and run the application
app.useCors();
app.useControllers([UserController]);
app.run(3000);
```

### Controllers

Controllers are the entry points for your API requests. They are defined using the `@ApiController` decorator:

```typescript
@ApiController("/users")
class UserController {
  // Route handlers go here
}
```

### Route Methods

Define HTTP methods using decorators:

```typescript
@Get('/')
async getUsers() {
  // Handle GET request
}

@Post('/')
async createUser(@Body() user: UserDto) {
  // Handle POST request
}

@Put('/:id')
async updateUser(@Param('id') id: string, @Body() user: UserDto) {
  // Handle PUT request
}

@Delete('/:id')
async deleteUser(@Param('id') id: string) {
  // Handle DELETE request
}
```

### Parameter Decorators

Extract data from requests using parameter decorators:

```typescript
@Get('/:id')
async getUser(
  @Param('id') id: string,
  @Query('include') include: string,
  @Header('authorization') token: string,
  @Body() data: UserDto
) {
  // Access route parameters, query strings, headers, and request body
}
```

<!-- You can also access the current user and files:

```typescript
@Post('/upload')
async uploadFile(
  @User() currentUser: any,
  @File() file: any
) {
  // Access the current user and uploaded file
}

@Post('/upload-multiple')
async uploadFiles(
  @Files() files: any[]
) {
  // Access multiple uploaded files
}
``` -->

### Error Handling

Return standardized responses using the `HttpResponse` and `HttpExceptions` class:

```typescript
@Get('/:id')
async getUser(@Param('id') id: string) {
  const user = await this.userService.findById(id);

  if (!user) {
    throw HttpExceptions.NotFound('User not found');
  }

  return HttpResponse.Ok(user);
}
```

### Middleware

Create and apply middleware for cross-cutting concerns:

```typescript
@Middleware
class LoggingMiddleware extends AppMiddleware {
  async invoke(req: IRequest) {
    console.log(`Request: ${req.method} ${req.url}`);
    return req;
  }
}

@UseMiddleware(LoggingMiddleware)
@ApiController("/users")
class UserController {
  // Controller methods
}
```

You can also apply middleware to specific routes:

```typescript
@ApiController("/users")
class UserController {
  @UseMiddleware(LoggingMiddleware)
  @Get("/")
  async getUsers() {
    // Only this route will use the LoggingMiddleware
  }
}
```

### Authentication & Authorization

Secure your API with authentication and authorization:

```typescript
@Authorize
class JwtAuthorization extends AuthorizeMiddleware {
  authorize(roles: string[]) {
    return async (req: IRequest) => {
      // Implement JWT authentication logic
      return req;
    };
  }
}
```

Now register the authrization class to our app by `useAuthorization` function;

```typescript
app.useAuthorization(JwtAuthorization);
```

Then you have access the `AuthUser` on class lavel or method lavel depending on how you use the `@Authorized()` decorator.

```typescript
// admin.controller.ts
@Authorized()
@ApiController("/admin")
class AdminController {
  // Protected controller methods

  // protected controller has access to AuthUser in each route method
  @Get()
  async account(@AuthUser() user: User) {
    ///
  }
}

// Or protect specific routes with roles
@ApiController("/admin")
class AdminController {
  @Authorized({
    roles: ["admin"],
  })
  @Get("/")
  async adminDashboard() {
    // Only users with 'admin' role can access this
  }
}
```

### Validation

Validate request data using class-validator:

```typescript
class UserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsNumber()
  @Min(0)
  @Max(120)
  age: number;
}

@Post('/')
async createUser(@Body() user: UserDto) {
  // User data is automatically validated
  return user;
}
```

You can also use custom validation rules:

```typescript
class UserDto {
  @Validate({
    type: "string",
    required: true,
    message: "Name is required",
  })
  name: string;

  @Validate({
    type: "number",
    min: 0,
    max: 120,
    message: "Age must be between 0 and 120",
  })
  age: number;
}
```

### OpenAPI Documentation

Generate API documentation automatically:

```typescript
const app = new Avleon({
  controllers: [UserController],
  openapi: {
    info: {
      title: "User API",
      version: "1.0.0",
      description: "API for managing users",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
    ],
  },
});
```

You can also customize the OpenAPI UI:

```typescript
app.useOpenApi(OpenApiConfig, (config) => {
  // Modify the OpenAPI configuration
  config.info.title = "Custom API Title";
  return config;
});
```

## Advanced Features

### Database Integration

Connect to databases using TypeORM:

```typescript
const app = Avleon.createApplication();
app.useDataSource({
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

Or use the config class:

```typescript
// datasource.config.ts
import { Config, IConfig } from "@avleon/core";

@Config
export class DataSourceConfig implements IConfig {
  // config method is mendatory
  // config method has access to environment variables by default
  config(env: Environment) {
    return {
      type: env.get("type") || "postgres",
      host: "localhost",
      port: 5432,
      username: "postgres",
      password: "password",
      database: "avleon",
      entities: [User],
      synchronize: true,
    };
  }
}
```

```typescript
// app.ts
const app = Avleon.createApplication();
app.useDataSource(DataSourceConfig);
// ... other impments
```

### File Uploads

Handle file uploads with multipart support:

```typescript
// Configure multipart file uploads
app.useMultipart({
  destination: path.join(process.cwd(), 'uploads'),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// In your controller
@Post('/upload')
async uploadFile(@File() file: any) {
  // Process uploaded file
  return HttpResponse.Ok({ filename: file.filename });
}
```

### Static Files

Serve static files:

```typescript
app.useStaticFiles({
  path: path.join(process.cwd(), "public"),
  prefix: "/static/",
});
```

### Testing

Test your API endpoints with the built-in testing utilities:

```typescript
import { TestBuilder } from "@avleon/core";

const testBuilder = TestBuilder.createBuilder();
const app = testBuilder.getTestApplication({
  controllers: [UserController],
});

// Test your API endpoints
const response = await app.get("/users");
expect(response.statusCode).toBe(200);
```

## Configuration

Configure your application with environment variables:

```typescript
// .env
PORT=3000
DATABASE_URL=postgres://user:password@localhost:5432/db

// app.ts
import { Environment } from '@avleon/core';

const env = new Environment();
env.load();

const app = new Avleon({
  controllers: [UserController],
  env: {
    port: 'PORT',
    databaseUrl: 'DATABASE_URL',
  },
});
```

## Route Mapping

Avleon provides several methods for mapping routes in your application:

### mapGet

The `mapGet` method is used to define GET routes in your application. It takes a path string and a handler function as parameters.

```typescript
app.mapGet("/users", async (req, res) => {
  // Handle GET request to /users
  return { users: [] };
});
```

### mapPost

The `mapPost` method is used to define POST routes in your application. It takes a path string and a handler function as parameters.

```typescript
app.mapPost("/users", async (req, res) => {
  // Handle POST request to /users
  const userData = req.body;
  // Process user data
  return { success: true };
});
```

### mapPut

The `mapPut` method is used to define PUT routes in your application. It takes a path string and a handler function as parameters.

```typescript
app.mapPut("/users/:id", async (req, res) => {
  // Handle PUT request to /users/:id
  const userId = req.params.id;
  const userData = req.body;
  // Update user data
  return { success: true };
});
```

### mapDelete

The `mapDelete` method is used to define DELETE routes in your application. It takes a path string and a handler function as parameters.

```typescript
app.mapDelete("/users/:id", async (req, res) => {
  // Handle DELETE request to /users/:id
  const userId = req.params.id;
  // Delete user
  return { success: true };
});
```

Each of these methods returns a route object that can be used to add middleware or Swagger documentation to the route.

```typescript
app
  .mapGet("/users", async (req, res) => {
    // Handler function
  })
  .useMiddleware([AuthMiddleware])
  .useSwagger({
    summary: "Get all users",
    description: "Retrieves a list of all users",
    tags: ["users"],
    response: {
      200: {
        description: "Successful response",
        content: {
          "application/json": {
            schema: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  });
```

## License

ISC

## Author

Tareq Hossain - [GitHub](https://github.com/xtareq)
