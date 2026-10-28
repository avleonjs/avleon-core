/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 *
 * Internal: discovering a DTO's properties without instantiating it.
 */

const SCHEMA_PROPERTIES_KEY = Symbol.for("avleon:openapi:properties");

/** Record `key` as a schema property declared on `prototype`. */
export function registerSchemaProperty(prototype: object, key: string) {
  const own: string[] =
    Reflect.getOwnMetadata(SCHEMA_PROPERTIES_KEY, prototype) ?? [];
  if (!own.includes(key)) {
    Reflect.defineMetadata(SCHEMA_PROPERTIES_KEY, [...own, key], prototype);
  }
}

/** Properties registered via `registerSchemaProperty` on the class and its ancestors. */
export function getRegisteredSchemaProperties(classType: Function): string[] {
  const out: string[] = [];
  let proto = classType?.prototype;
  while (proto && proto !== Object.prototype) {
    for (const key of Reflect.getOwnMetadata(SCHEMA_PROPERTIES_KEY, proto) ??
      []) {
      if (!out.includes(key)) out.push(key);
    }
    proto = Object.getPrototypeOf(proto);
  }
  return out;
}

/** class-transformer's metadata storage, or `undefined` if it can't be loaded. */
export function getTransformerStorage(): any {
  try {
    return require("class-transformer/cjs/storage").defaultMetadataStorage;
  } catch {
    return undefined;
  }
}

/** Names of properties class-transformer knows about (`@Type`, `@Expose`, `@Exclude`, `@Transform`). */
export function getTransformerProperties(classType: Function): string[] {
  const storage = getTransformerStorage();
  if (!storage) return [];
  const names = new Set<string>();
  const maps = [
    storage._typeMetadatas,
    storage._exposeMetadatas,
    storage._excludeMetadatas,
    storage._transformMetadatas,
  ];
  let target: any = classType;
  while (typeof target === "function" && target !== Function.prototype) {
    for (const map of maps) {
      const entry = map instanceof Map ? map.get(target) : undefined;
      if (entry instanceof Map) {
        for (const key of entry.keys()) {
          if (typeof key === "string") names.add(key);
        }
      }
    }
    target = Object.getPrototypeOf(target);
  }
  return [...names];
}

/** The element class given with `@Type(() => X)`, if any. */
export function getTransformerType(
  classType: Function,
  key: string,
): Function | undefined {
  try {
    const meta = getTransformerStorage()?.findTypeMetadata(classType, key);
    const t = meta?.typeFunction?.();
    return typeof t === "function" ? t : undefined;
  } catch {
    return undefined;
  }
}
