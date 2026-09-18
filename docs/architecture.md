# Avleon Core — Project Structure

The `src/` tree is organized by feature module. Every module owns an `index.ts`
barrel, and tests live next to the code they cover.

```
src/
├── index.ts              Public API — the single package entrypoint
│
├── core/                 Application lifecycle
│   ├── application.ts    AvleonApplication — the app builder
│   ├── router.ts         Route registration + request pipeline
│   ├── interfaces.ts     IAvleonApplication contract
│   ├── types.ts          IRequest / IResponse and shared core types
│   ├── testing.ts        Test harness (Avleon.createTestApp)
│   └── mock-db.ts        In-memory DB for tests
│
├── http/                 Request handling
│   ├── controller.ts     @ApiController
│   ├── route-methods.ts  @Get / @Post / @Put / @Delete
│   ├── params.ts         @Param / @Query / @Body / @Header
│   ├── middleware.ts     AvleonMiddleware
│   ├── multipart.ts      File upload handling
│   ├── validation.ts     DTO validation
│   ├── validator-extend.ts  Custom class-validator rules
│   ├── map-types.ts      PartialType and friends
│   ├── response.ts       Response helpers
│   └── results.ts        Result types
│
├── openapi/              API documentation
│   ├── openapi.ts        OpenAPI decorators + UI options
│   └── swagger-schema.ts Schema generation
│
├── data/                 Persistence
│   ├── typeorm-provider.ts  TypeORM repositories + pagination
│   ├── knex-provider.ts     KnexDB + AVLEON_KNEX_DB token
│   └── collection.ts        Collection / List utilities
│
├── events/               Eventing
│   ├── event-registry.ts    Typed events: AvleonEvent, EventRegistry,
│   │                        EventQueue, EventDispatcher
│   ├── socket-dispatcher.ts SocketEventDispatcher — socket.io transport
│   └── event-subscriber.ts  @Subscribe / @PrivateChannel
│
├── queue/                Background jobs
│   ├── queue.ts          AvleonQueue, @Queue, @JobHandler
│   └── worker.ts         @AvleonWorker
│
├── scheduler/            Cron / task scheduling
├── config/               AvleonConfig, @AppConfig, Environment
├── storage/              File storage
├── realtime/             socket.io integration
├── observability/        Logger + cache
│
└── common/               Shared foundation
    ├── container.ts      DI container
    ├── decorators.ts     Re-exported decorator surface
    ├── helpers.ts        Helper re-exports
    ├── constants.ts
    ├── exceptions/       HTTP + system exceptions
    └── utils/            Pure utilities
```

## Conventions

**Dependency direction.** `common/` depends on nothing internal. Feature modules
depend on `common/` and on `core/` types. `core/application.ts` wires features
together. The import graph is acyclic — keep it that way.

**Barrels.** Import across modules through the barrel (`../common`), not by
reaching into a file (`../common/utils/object-utils`). Within a module, import
siblings directly.

**Public API.** `src/index.ts` is the only entrypoint. Consumers always write
`import { ... } from "@avleon/core"`. Internal paths can be rearranged freely as
long as the root barrel still re-exports the same names.

**Tests.** Colocated as `<module>.test.ts` beside the file under test.

**Optional peer dependencies.** typeorm, knex, bullmq, socket.io, kafkajs and the
DB drivers are optional peers. Load them lazily via
`loadPackageFromClient(name)` from `common/utils/common-utils`, which resolves
from the consumer's `cwd` and throws an install hint when missing. Never import
them at module top level in code reachable from `src/index.ts`.
