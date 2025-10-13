# Avleon 

![npm version](https://img.shields.io/npm/v/@avleon/core.svg) ![Build](https://github.com/avleonjs/avleon-core/actions/workflows/release.yml/badge.svg)
## ⚠️ WARNING

> **🚧 This project is in active development.**

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
- [Testing](#testing)

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
npx @avleon/cli new myapp
# or
yarn dlx @avleon/cli new myapp
# or
pnpm dlx @avleon/cli new myapp
```

## Quick Start

### Minimal

```typescript
import { Avleon } from "@avleon/core";

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
// For auto register controller `app.useControllers({auto:true});`

app.run(); // or app.run(port)
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
import { CanAuthorize } from "@avleon/core";

@CanAuthorize
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

app.useOpenApi({
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

## 1. Knex

```typescript
const app = Avleon.createApplication();
app.useKnex({
  client: 'mysql',
  connection: {
    host: '127.0.0.1',
    port: 3306,
    user: 'your_database_user',
    password: 'your_database_password',
    database: 'myapp_test',
  },
})
```
or using config class 

```typescript
@AppConfig
export class KnexConfig implements IConfig {
  // config method is mendatory
  // config method has access to environment variables by default
  config(env: Environment) {
    return {
      client: 'mysql',
      connection: {
        host: env.get("DB_HOST") || '127.0.0.1',
        port: env.get("DB_PORT") || 3306,
        user: env.get("DB_USER")|| 'your_database_user',
        password: env.get("DB_PASS") || 'your_database_password',
        database: env.get("DB_NAME") || 'myapp_test',
      },
    };
  }
}

// now we can register it with our app

app.useKenx(KnexConfig)
```

### Exmaple uses

```typescript
import { DB, AppService } from "@avleon/core";

@AppService
export class UsersService{
  constructor(
    private readonly db: DB
  ){}

  async findAll(){
    const result = await this.db.client.select("*").from("users");
    return result;
  }
}
```

## 2. Typeorm
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
import { AppConfig, IConfig } from "@avleon/core";

@AppConfig
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

Now in your Controller or Injected service use can use like this

```typescript
import { AppService, InjectRepository } from "@avleon/core";
import { Repository } from "typeorm";
import { User } from "model_path";

@AppService
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly _userRepository: Repository<User>,
  ) {}

  async findAll() {
    const users = await this._userRepository.find();
    return users;
  }
}
```

### File Uploads & File Storage

Handle file uploads with multipart support:

```typescript
// Configure multipart file uploads
app.useMultipart({
  destination: path.join(process.cwd(), 'public/uploads'),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});
```
```typescript
// In your controller
import {FileStorage} from '@avleon/core';

//inject FileStorage into constructor
constructor(
  private readonly fileStorage: FileStorage
){}

@OpenApi({
  description: "Uploading single file"
  body:{
    type:"object",
    properties:{
      file:{
        type:"string",
        format:"binary"
      }
    },
    required:["file"]
  }
})
@Post('/upload')
async uploadSingleFile(@UploadFile('file') file: MultipartFile) {
  // Process uploaded file
  const result = await this.fileStorage.save(file);
  // or with new name 
  //  const result = await this.fileStorage.save(file, {as:newname.ext});
  // result
  // {
  //  uploadPath:"/uplaod",
  //  staticPath: "/static/"
  //}
  return result;
}
```

### Static Files

Serve static files:

```typescript
import path from 'path';


app.useStaticFiles({
  path: path.join(process.cwd(), "public"),
  prefix: "/static/",
});
```

## Configuration

Coming soon...

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

### Add openapi and middleware support for inline route

Each of these methods returns a route object that can be used to add middleware or Swagger documentation to the route.

```typescript
app
  .mapGet("/users", async (req, res) => {
    // Handler function
  })
  .useMiddleware([AuthMiddleware])
  .useOpenApi({
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

### Testing

Test your API endpoints with the built-in testing utilities:

Coming soon...

## License

ISC

## Author

Tareq Hossain - [GitHub](https://github.com/xtareq)
