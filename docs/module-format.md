# Module format: CommonJS only (0.3)

`@avleon/core` 0.3 ships a single CommonJS build in `dist/`, with type
declarations next to it. There is no ESM build.

```json
"main": "./dist/index.js",
"types": "./dist/index.d.ts",
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "require": "./dist/index.js",
    "default": "./dist/index.js"
  },
  "./package.json": "./package.json"
}
```

## Why CJS only

- The framework relies on `experimentalDecorators`, `emitDecoratorMetadata` and
  `reflect-metadata`. Those work the same in CJS and ESM, but a dual build would
  load two copies of the package when a CJS and an ESM consumer meet, giving two
  typedi containers and two metadata registries (the "dual package hazard").
- Several optional integrations are loaded lazily with `require()` so that they
  can stay optional peer dependencies.
- ESM consumers can still `import { ... } from "@avleon/core"`: Node supports
  importing CommonJS from ESM, and named exports are detected for the compiled
  `exports.*` assignments.

## Deep imports

The `exports` map only exposes the root entry and `package.json`. Importing
`@avleon/core/dist/...` is not supported. Anything consumers need must be
exported from `src/index.ts`.

## `sideEffects: true`

Importing the package has side effects: `src/index.ts` imports
`reflect-metadata` (a global polyfill), and decorators register metadata with
typedi and class-validator when their modules are evaluated. Marking the package
side-effect free would let bundlers drop those modules, so `sideEffects` is
`true`.

## Revisiting

An ESM build can be added in a later minor release without breaking consumers, by
adding an `import` condition to the `exports` map. Removing the CJS build would be
a breaking change.
