# ADR 001: Keep typedi as the DI container for 0.3

- Status: Accepted
- Date: 2026-10-29

## Context

Avleon's dependency injection is built on [typedi](https://github.com/typestack/typedi)
0.10. typedi is effectively unmaintained, and it has no request scope: services
are singletons per container, with only transient (`Container.of` / `transient`)
alternatives. Replacing it or vendoring a container before 0.3 would touch most of
`src/` and delay the release.

## Decision

Keep typedi for 0.3, behind Avleon's own API:

- Application code uses `AvleonContainer` and Avleon's decorators (`@AppService`
  and similar), not typedi directly. typedi types should not appear in new
  public signatures.
- No request-scoped services in 0.3. Per-request state lives on the request
  object (`IRequest`), not in the container.

## Consequences

- typedi stays a runtime dependency of `@avleon/core`.
- Because consumers depend on `AvleonContainer` rather than typedi, the container
  can be replaced in a later minor release (a maintained library or a small vendored
  container with request scope) as long as the `AvleonContainer` surface stays
  compatible.
- Code that imports from `typedi` directly is unsupported and may break when the
  container is replaced.
