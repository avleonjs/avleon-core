/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import Container from "typedi";
import { NotFoundException } from "./exceptions";
import {
  DataSource,
  EntityTarget,
  FindOneOptions,
  ObjectLiteral,
  Repository,
} from "typeorm";
import { UpsertOptions } from "typeorm/repository/UpsertOptions";

type ObjKey<T> = keyof T;
type ObjKeys<T> = ObjKey<T>[];
type PaginationOptions = {
  take: number;
  skip?: number;
};

type Predicate<T> = (item: T) => boolean;
interface TypeormEnitity extends ObjectLiteral {}

export type PaginationResult<T> = {
  total: number;
  data: T[];
  next?: number | null;
  prev?: number | null;
  first?: number | null;
  last?: number | null;
  totalPage?: number;
};

type ICollection<T> = {
  findAll(): T[] | Promise<T[]>;
};

type EntityCollection<T extends ObjectLiteral> = {};

class BasicCollection<T> implements ICollection<T> {
  private items: T[];

  private constructor(items: T[]) {
    this.items = items;
  }

  static from<T>(items: T[]): BasicCollection<T> {
    return new BasicCollection(items);
  }

  findAll(predicate?: Predicate<T>) {
    const results = Array.from(this.items);
    return results;
  }

  findOne(predicate: Predicate<T> | FindOneOptions<T>): T | Promise<T | null> {
    if (this.isFunction(predicate)) {
      return this.items.find(predicate as Predicate<T>) as T;
    }
    throw new Error("Invalid predicate type");
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
  deleteAll(predicate: (item: T) => boolean): void {
    this.items = this.items.filter((item) => !predicate(item));
  }
  max<K extends keyof T>(key: K & string): number {
    return Math.max(...this.items.map((item) => item[key] as number));
  }

  min<K extends keyof T>(key: K & string): number {
    return Math.max(...this.items.map((item) => item[key] as number));
  }

  sum<K extends keyof T>(key: K & string): number {
    const nums = this.items.flatMap((x) => x[key]) as number[];
    return nums.reduce((sum, num) => sum + num, 0);
  }

  avg<K extends keyof T>(key: K & string): number {
    const nums = this.items.flatMap((x) => x[key]) as number[];
    return nums.reduce((sum, num) => sum + num, 0) / nums.length;
  }

  paginate(options?: PaginationOptions) {
    const take = options?.take || 10;
    const skip = options?.skip || 0;
    const total = this.items.length;
    const data = this.items.slice(skip, take);
    return {
      total,
      totalPage: Math.ceil(total / take),
      next: skip + take < total ? skip + take : null,
      data,
    };
  }

  private getDeepValue(item: any, path: string | keyof T): any {
    if (typeof path !== "string") return item[path];
    return path.split(".").reduce((acc, key) => acc?.[key], item);
  }
}

class AsynchronousCollection<T extends ObjectLiteral> {
  private model: EntityTarget<T>;
  private repo?: Repository<T>;

  private constructor(model: EntityTarget<T>) {
    this.model = model;
  }

  static fromRepository<T extends ObjectLiteral>(
    model: EntityTarget<T>,
  ): AsynchronousCollection<T> {
    return new AsynchronousCollection(model);
  }

  getRepository() {
    if (!this.repo) {
      const dataSourceKey = "idatasource";
      const dataSource = Container.get(dataSourceKey) as DataSource;
      console.log('datasource', dataSource);
      const repository = dataSource.getRepository<T>(this.model);
      this.repo = repository;
      return repository;
    }
    return this.repo;
  }

  // Pagination with query builder
  async paginate(options?: PaginationOptions): Promise<PaginationResult<T>> {
    const take = options?.take || 10;
    const skip = options?.skip || 0;

    const [data, total] = await this.getRepository().findAndCount({
      take,
      skip,
    });

    return {
      total,
      totalPage: Math.ceil(total / take),
      next: skip + take < total ? skip + take : null,
      prev: skip + take < total ? skip + take : null,
      data,
    };
  }
}

export class Collection {
  private constructor() {}

  static from<T>(items: T[]): BasicCollection<T> {
    return BasicCollection.from(items);
  }
  // Example refactoring of Collection.fromRepository for better type safety
  static fromRepository<T extends ObjectLiteral>(
    entity: EntityTarget<T>,
  ): Repository<T> {
    const asyncCollection = AsynchronousCollection.fromRepository(entity);
    // Assuming AsynchronousCollection has a method to get the Repository<T>
    return asyncCollection.getRepository();
  }
}

export function InjectRepository<T extends Repository<T>>(
  model: EntityTarget<T>,
) {
  return function (
    object: any,
    propertyName: string | undefined,
    index?: number,
  ) {
    let repo!: any | Repository<T>;
    try {
      Container.registerHandler({
        object,
        propertyName,
        index,
        value: (containerInstance) => {
          const dataSource = containerInstance.get<DataSource>("idatasource");
    
          repo = dataSource
            .getRepository<T>(model)
            .extend({ paginate: () => {} });
          repo.paginate = async function (
            options: PaginationOptions = { take: 10, skip: 0 },
          ): Promise<PaginationResult<T>> {
            const [data, total] = await this.findAndCount({
              take: options.take || 10,
              skip: options.skip || 0,
            });

            return {
              total,
              totalPage: Math.ceil(total / (options.take || 10)),
              next:
                options.skip! + options.take! < total
                  ? options.skip! + options.take!
                  : null,
              data,
            };
          };
          return repo;
        },
      });
    } catch (error: any) {
      console.log(error);
      if (error.name && error.name == "ServiceNotFoundError") {
        console.log("Database didn't initialized.");
      }
    }
  };
}
