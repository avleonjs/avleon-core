import Container from "typedi";
import { NotFoundException } from "./exceptions";
import { DataSource, EntityTarget, FindOneOptions, FindManyOptions, ObjectLiteral, Repository as TypeOrmRepository, SaveOptions } from "typeorm";

type ObjKey<T> = keyof T;
type ObjKeys<T> = ObjKey<T>[];
type PaginationOptions = {
  take: number,
  skip?: number,

}

type Predicate<T> = (item: T) => boolean;
interface IEnitity<T> extends ObjectLiteral{}

export type PaginationResult<T> = {
  total: number,
  data: T[],
  next?: number | null,
  prev?: number | null,
  first?: number | null,
  last?: number | null
  totalPage?: number
}
export class Repository<Entity extends ObjectLiteral> extends TypeOrmRepository<Entity> {
  async paginate(options: PaginationOptions = { take: 10, skip: 0 }): Promise<PaginationResult<Entity>> {
    const total = await this.count();
    const data = await this.find({
      take: options.take || 10,
      skip: options.skip || 0
    });

    return { total, data }
  }
}


export class Collection<T=ObjectLiteral>{
  private items: T[];
  private model?: any;
  private isTypeormMode: boolean = false;
  private constructor(items: T[], model?: T) {
    if (model) {
      this.isTypeormMode = true;
      this.model = model;
    }
    this.items = items;
  }
  private _fields: string[] = [];
  static from<T>(items: T[]): Collection<T> {
    return new Collection(items);
  }
  static fromEntity<T extends ObjectLiteral>(item: EntityTarget<T>): Collection<T> {
    return new Collection([], item) as any;
  }

  static fromRepositry<T extends ObjectLiteral>(item: EntityTarget<T>): Collection<T> {
    const collection = new Collection([], item);
     return collection as any;
  }

  private getDataSource() {
    const dataSource = Container.get("idatasource");
    return dataSource as DataSource;
  }

  private getRepository<T extends ObjectLiteral>() {
    const repo = this.getDataSource().getRepository(this.model).extend({ paginate: () => { } }) as Repository<T>;
    repo.paginate = async function (
      options: PaginationOptions = { take: 10, skip: 0 }
    ): Promise<PaginationResult<T>> {
      const [data, total] = await this.findAndCount({
        take: options.take || 10,
        skip: options.skip || 0,
      });

      return {
        total,
        totalPage: Math.ceil(total / (options.take || 10)),
        next: options.skip! + options.take! < total ? options.skip! + options.take! : null,
        data,
      };
    };
    return repo;
  }

  private connectionManager() {
    console.log(this.getDataSource);
    return this.getDataSource().manager;
  }


  findAll(): T[];
  findAll<T extends ObjectLiteral>(options: FindManyOptions<T>): Promise<T[]>;
  findAll(options?: any): T[] | Promise<T[]> {
    const results = this.isTypeormMode ? this.connectionManager().find(this.model, options) as unknown as Promise<T[]> : Array.from(this.items)
    return this.isTypeormMode ? Promise.resolve(results) : results;
  }

  findOne(predicate: Predicate<T>): T;
  findOne(predicate: FindOneOptions<T>): Promise<T | null>;
  findOne(predicate: Predicate<T> | FindOneOptions<T>): T | Promise<T | null> {
    if (this.isTypeormMode) {
      if (typeof predicate === "object" && !this.isFunction(predicate)) {
        return this.getRepository().findOne(predicate as any) as Promise<T| null>;
      }
      throw new Error("Invalid predicate for TypeORM mode");
    }

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
  add<T extends ObjectLiteral>(item: Partial<T>, options?:SaveOptions): Promise<T>;
  add(item: Partial<T>, options?:SaveOptions): T | Promise<T> {
    if (this.isTypeormMode) {
      const partialItem = this.getRepository().create({...item});
      return this.getRepository().save(partialItem,options?options:{}) as unknown as Promise<T> ;
    } else {
      this.items.push(item as T);
      return this.items[this.items.length - 1];
    }
  }

  async paginate(options: PaginationOptions) {
    return this.getRepository().paginate(options);
  }


  async save(item:T) {
    return 
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

  private getDeepValue(item: any, path: string | keyof T): any {
    if (typeof path !== "string") return item[path];
    return path.split(".").reduce((acc, key) => acc?.[key], item);
  }
}
