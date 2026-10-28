/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import Container from "typedi";
import type { EntityTarget, ObjectLiteral, Repository } from "typeorm";
import { NotFoundException } from "../common/exceptions";
import { getDataSource } from "./datasource";
import {
  PageRequest,
  Paginated,
  normalizePageRequest,
  paginated,
} from "./pagination";

type Predicate<T> = (item: T) => boolean;
type ValueOperator<T> = {
  $in?: T[];
};

type FieldCondition<T> = T | ValueOperator<T>;

type WhereCondition<T> = {
  [K in keyof T]?: FieldCondition<T[K]>;
};

type LogicalOperators<T> =
  | { $and: Where<T>[] }
  | { $or: Where<T>[] }
  | { $not: Where<T> };

type Where<T> = WhereCondition<T> | LogicalOperators<T>;

export interface IFindOneOptions<T = any> {
  where: Where<T>;
}

/** @deprecated Use {@link Paginated}. Kept as an alias of the unified shape. */
export type PaginationResult<T> = Paginated<T>;

/** A TypeORM repository extended with the unified `paginate`. */
export type PaginatedRepository<T extends ObjectLiteral> = Repository<T> & {
  paginate(options?: PageRequest): Promise<Paginated<T>>;
};

async function paginateRepository<T extends ObjectLiteral>(
  repo: Repository<T>,
  options?: PageRequest,
): Promise<Paginated<T>> {
  const { page, perPage, offset } = normalizePageRequest(options);
  const [data, total] = await repo.findAndCount({
    skip: offset,
    take: perPage,
  });
  return paginated(data, total, page, perPage);
}

export interface IList<T> {
  /** All items, or those matching `predicate`. */
  Find(predicate?: Predicate<T>): Promise<T[]>;
  /** The first item matching `predicate`, or `undefined`. */
  FindOne(predicate?: Predicate<T>): Promise<T | undefined>;
}

/**
 * A small in-memory list with an async, repository-like surface.
 *
 * Every read resolves through a promise so a list can stand in for a
 * repository in tests without callers having to change shape.
 */
export class List<T> implements IList<T> {
  private _items: T[] = [];

  constructor(items: T[] = []) {
    this._items = [...items];
  }

  /** Build a list from an existing array. The array is copied, not captured. */
  static from<T>(items: T[]): List<T> {
    return new List<T>(items);
  }

  /** Number of items held. */
  Count(): number {
    return this._items.length;
  }

  /** A copy of the backing array. */
  ToArray(): T[] {
    return [...this._items];
  }

  /** Append an item. */
  Add(item: T): this {
    this._items.push(item);
    return this;
  }

  /** Append several items. */
  AddRange(items: T[]): this {
    this._items.push(...items);
    return this;
  }

  /** Remove every item matching `predicate`; returns how many were removed. */
  Remove(predicate: Predicate<T>): number {
    const before = this._items.length;
    this._items = this._items.filter((item) => !predicate(item));
    return before - this._items.length;
  }

  /** Drop all items. */
  Clear(): this {
    this._items = [];
    return this;
  }

  /** Items matching `predicate`, or every item when it is omitted. */
  Find(predicate?: Predicate<T>): Promise<T[]> {
    const result = predicate ? this._items.filter(predicate) : [...this._items];
    return Promise.resolve(result);
  }

  /** The first item matching `predicate`, or `undefined` if none does. */
  FindOne(predicate?: Predicate<T>): Promise<T | undefined> {
    const result = predicate ? this._items.find(predicate) : this._items[0];
    return Promise.resolve(result);
  }

  /** Synchronous filter, kept chainable. */
  Where(predicate: Predicate<T>): List<T> {
    return new List<T>(this._items.filter(predicate));
  }

  /** Whether any item matches `predicate`. */
  Any(predicate?: Predicate<T>): boolean {
    return predicate ? this._items.some(predicate) : this._items.length > 0;
  }
}

export interface BasicCollection<T> {
  clear(): void;
  find(predicate?: Predicate<T>): T[];
  findAsync(predicate?: Predicate<T>): Promise<T[]>;
  findOne(predicate: Predicate<T> | IFindOneOptions<T>): T | undefined;
  findOneAsync(
    predicate: Predicate<T> | IFindOneOptions<T>,
  ): Promise<T | undefined>;
}

class BasicCollectionImpl<T> implements BasicCollection<T> {
  private items: T[];

  private constructor(items: T[]) {
    this.items = items;
  }

  static from<T>(items: T[]): BasicCollectionImpl<T> {
    return new BasicCollectionImpl(items);
  }

  clear() {
    this.items = [];
  }

  firstItem(): T | undefined {
    return this.items.length > 0 ? this.items[0] : undefined;
  }
  lastItem(): T | undefined {
    return this.items.length > 0
      ? this.items[this.items.length - 1]
      : undefined;
  }

  find(predicate?: Predicate<T>) {
    if (this.isFunction(predicate)) {
      return this.items.filter(predicate as Predicate<T>) as T[];
    }
    const results = Array.from(this.items);
    return results;
  }

  async findAsync(predicate?: Predicate<T>): Promise<T[]> {
    return this.find(predicate);
  }

  private _matches<T>(item: T, where: Where<T>): boolean {
    if ("$or" in where) {
      return where.$or.some((cond) => this._matches(item, cond));
    }

    if ("$and" in where) {
      return where.$and.every((cond) => this._matches(item, cond));
    }

    if ("$not" in where) {
      return !this._matches(item, where.$not);
    }

    // Field-based matching
    return Object.entries(where).every(([key, condition]) => {
      const itemValue = item[key as keyof T];
      if (
        condition &&
        typeof condition === "object" &&
        !Array.isArray(condition)
      ) {
        const op = condition as ValueOperator<any>;

        if ("$in" in op && Array.isArray(op.$in)) {
          return op.$in.includes(itemValue);
        }
      }

      return itemValue === condition;
    });
  }

  findOne(predicate: Predicate<T> | IFindOneOptions<T>): T | undefined {
    if (this.isFunction(predicate)) {
      return this.items.find(predicate as Predicate<T>) as T;
    }
    const result = this.items.filter((item) =>
      this._matches(item, predicate.where),
    );
    if (result.length > 0) {
      return result[0];
    }
    return undefined;
  }

  findOneAt(index: number): T | undefined {
    return this.items.at(index);
  }

  async findOneAsync(
    predicate: Predicate<T> | IFindOneOptions<T>,
  ): Promise<T | undefined> {
    if (this.isFunction(predicate)) {
      return this.items.find(predicate as Predicate<T>) as T;
    }
    return this.items.find((item) => this._matches(item, predicate.where));
  }

  // Utility function to check if a value is a function
  private isFunction(value: unknown): value is Function {
    return typeof value === "function";
  }

  add(item: Partial<T>): T;
  add(item: Partial<T>): T | Promise<T> {
    this.items.push(item as T);
    return this.items[this.items.length - 1];
  }

  addAll(items: T[]): void {
    this.items.push(...items);
  }

  update(predicate: (item: T) => boolean, updater: Partial<T>): void {
    const item = this.items.find(predicate);
    if (item) {
      const index = this.items.indexOf(item)!;
      this.items[index] = { ...item, ...updater };
    } else {
      throw new NotFoundException("Item not found");
    }
  }

  updateAt(index: number, updater: Partial<T>): void {
    const item = this.items.at(index);
    if (item) {
      this.items[index] = { ...item, ...updater };
    } else {
      throw new NotFoundException("Index out of range.");
    }
  }

  updateBy(
    where: Partial<{ [K in keyof T]: T[K] }>,
    updater: Partial<T>,
  ): void {
    const keys = Object.keys(where) as (keyof T)[];

    const index = this.items.findIndex((item) =>
      keys.every((k) => item[k] === where[k]),
    );

    if (index === -1) {
      throw new NotFoundException("Item not found");
    }

    this.items[index] = {
      ...this.items[index],
      ...updater,
    };
  }

  updateAll(predicate: (item: T) => boolean, updater: (item: T) => T): void {
    for (let i = 0; i < this.items.length; i++) {
      if (predicate(this.items[i])) {
        this.items[i] = updater(this.items[i]);
      }
    }
  }
  delete(predicate: (item: T) => boolean): void {
    const index = this.items.findIndex(predicate);
    if (index !== -1) {
      this.items.splice(index, 1);
    }
  }
  deleteAt(index: number): void {
    const item = this.items.at(index);
    if (item) {
      this.items.splice(index, 1);
    } else {
      throw new NotFoundException("Index out of range.");
    }
  }
  deleteBy(where: Partial<{ [K in keyof T]: T[K] }>): void {
    const keys = Object.keys(where) as (keyof T)[];

    const index = this.items.findIndex((item) =>
      keys.every((k) => item[k] === where[k]),
    );

    if (index === -1) {
      throw new NotFoundException("Item not found");
    }

    this.items.splice(index, 1);
  }

  deleteAll(predicate: (item: T) => boolean): void {
    this.items = this.items.filter((item) => !predicate(item));
  }
  max<K extends keyof T>(key: K & string): number {
    return Math.max(...this.items.map((item) => item[key] as number));
  }

  min<K extends keyof T>(key: K & string): number {
    return Math.min(...this.items.map((item) => item[key] as number));
  }

  sum<K extends keyof T>(key: K & string): number {
    const nums = this.items.flatMap((x) => x[key]) as number[];
    return nums.reduce((sum, num) => sum + num, 0);
  }

  avg<K extends keyof T>(key: K & string): number {
    const nums = this.items.flatMap((x) => x[key]) as number[];
    return nums.reduce((sum, num) => sum + num, 0) / nums.length;
  }

  /** One page of items: `{ data, meta: { total, page, perPage, lastPage, next, prev } }`. */
  paginate(options?: PageRequest): Paginated<T> {
    const { page, perPage, offset } = normalizePageRequest(options);
    const data = this.items.slice(offset, offset + perPage);
    return paginated(data, this.items.length, page, perPage);
  }
}

export interface Collection<T> extends BasicCollectionImpl<T> {}

export class Collection<T> {
  static from<T>(items: T[]): Collection<T> {
    return BasicCollectionImpl.from(items);
  }

  /**
   * The TypeORM repository for `entity`, from the registered DataSource, with
   * the unified `paginate({ page, perPage })` added.
   */
  static fromRepository<T extends ObjectLiteral>(
    entity: EntityTarget<T>,
  ): PaginatedRepository<T> {
    return createPaginatedRepository(entity);
  }
}

function createPaginatedRepository<T extends ObjectLiteral>(
  entity: EntityTarget<T>,
  dataSource = getDataSource(),
): PaginatedRepository<T> {
  return dataSource.getRepository<T>(entity).extend({
    paginate(this: Repository<T>, options?: PageRequest) {
      return paginateRepository(this, options);
    },
  }) as PaginatedRepository<T>;
}

/**
 * Inject the TypeORM repository for `model`, extended with the unified
 * `paginate({ page, perPage })`. Requires a registered DataSource.
 */
export function InjectRepository<T extends ObjectLiteral>(
  model: EntityTarget<T>,
) {
  return function (
    object: any,
    propertyName: string | undefined,
    index?: number,
  ) {
    Container.registerHandler({
      object,
      propertyName,
      index,
      value: () => createPaginatedRepository(model),
    });
  };
}
