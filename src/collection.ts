import Container from "typedi";
import { NotFoundException } from "./exceptions";
import {
  DataSource,
  EntityTarget,
  FindOneOptions,
  FindManyOptions,
  ObjectLiteral,
  Repository as TypeOrmRepository,
  SaveOptions,
  DeepPartial,
  DeleteResult,
  EntityManager,
  EntityMetadata,
  FindOptionsWhere,
  InsertResult,
  ObjectId,
  QueryRunner,
  SelectQueryBuilder,
  UpdateResult,
  In,
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
export class Repository<
  Entity extends ObjectLiteral,
> extends TypeOrmRepository<Entity> {
  async paginate(
    options: PaginationOptions = { take: 10, skip: 0 },
  ): Promise<PaginationResult<Entity>> {
    const total = await this.count();
    const data = await this.find({
      take: options.take || 10,
      skip: options.skip || 0,
    });

    return { total, data };
  }
}

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

  private getRepository() {
    if (!this.repo) {
      const dataSource = Container.get("idatasource") as DataSource;
      const repository = dataSource.getRepository<T>(this.model).extend({
        paginate: this.paginate,
      });
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
      data,
    };
  }

  createQueryBuilder(
    alias?: string,
    queryRunner?: QueryRunner,
  ): SelectQueryBuilder<T> {
    return this.getRepository().createQueryBuilder(alias, queryRunner);
  }

  hasId(entity: T): boolean {
    return this.getRepository().hasId(entity);
  }
  getId(entity: T): any {
    return this.getRepository().getId(entity);
  }

  create(entityLike?: Partial<T>): T | T[] {
    return this.getRepository().create(entityLike as any);
  }
  merge(mergeIntoEntity: T, ...entityLikes: Partial<T>[]): T {
    return this.getRepository().merge(mergeIntoEntity, ...(entityLikes as any));
  }
  async preload(entityLike: Partial<T>): Promise<T | undefined> {
    return this.getRepository().preload(entityLike as any);
  }

  async save(
    entities: any[],
    options: SaveOptions & {
      reload: false;
    },
  ): Promise<T | T[]> {
    return this.getRepository().save(entities, options);
  }
  async remove(entity: T | T[]): Promise<T | T[]> {
    return this.getRepository().remove(entity as any);
  }
  async softRemove(entity: T | T[]): Promise<T | T[]> {
    return this.getRepository().softRemove(entity as any);
  }
  async recover(entity: T | T[]): Promise<T | T[]> {
    return this.getRepository().recover(entity as any);
  }

  async insert(entity: Partial<T> | Partial<T>[]): Promise<void> {
    await this.getRepository().insert(entity);
  }
  async update(
    criteria: FindOptionsWhere<T>,
    partialEntity: Partial<T>,
  ): Promise<UpdateResult> {
    return this.getRepository().update(criteria, partialEntity);
  }
  async upsert(
    entityOrEntities: T | T[],
    conflictPathsOrOptions: UpsertOptions<T>,
  ): Promise<void> {
    await this.getRepository().upsert(entityOrEntities, conflictPathsOrOptions);
  }
  async delete(criteria: FindOptionsWhere<T>): Promise<DeleteResult> {
    return this.getRepository().delete(criteria);
  }
  async softDelete(criteria: FindOptionsWhere<T>): Promise<UpdateResult> {
    return this.getRepository().softDelete(criteria);
  }
  async restore(criteria: FindOptionsWhere<T>): Promise<UpdateResult> {
    return this.getRepository().restore(criteria);
  }
  async exist(options?: FindManyOptions<T>): Promise<boolean> {
    return (await this.getRepository().count(options)) > 0;
  }
  async exists(options?: FindManyOptions<T>): Promise<boolean> {
    return this.exist(options);
  }
  async existsBy(
    where: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  ): Promise<boolean> {
    return (await this.getRepository().count({ where })) > 0;
  }
  async count(options?: FindManyOptions<T>): Promise<number> {
    return this.getRepository().count(options);
  }
  async countBy(
    where: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  ): Promise<number> {
    return this.getRepository().count({ where });
  }
  async sum(
    columnName: keyof T | any,
    where?: FindOptionsWhere<T>,
  ): Promise<number | null> {
    return this.getRepository()
      .createQueryBuilder()
      .select(`SUM(${columnName})`, "sum")
      .where(where || {})
      .getRawOne()
      .then((res) => res?.sum || null);
  }
  async average(
    columnName: keyof T | any,
    where?: FindOptionsWhere<T>,
  ): Promise<number | null> {
    return this.getRepository()
      .createQueryBuilder()
      .select(`AVG(${columnName})`, "average")
      .where(where || {})
      .getRawOne()
      .then((res) => res?.average || null);
  }
  async minimum(
    columnName: keyof T | any,
    where?: FindOptionsWhere<T>,
  ): Promise<number | null> {
    return this.getRepository()
      .createQueryBuilder()
      .select(`MIN(${columnName})`, "minimum")
      .where(where || {})
      .getRawOne()
      .then((res) => res?.minimum || null);
  }
  async maximum(
    columnName: keyof T | any,
    where?: FindOptionsWhere<T>,
  ): Promise<number | null> {
    return this.getRepository().maximum(columnName, where);
  }
  async find(options?: FindManyOptions<T>): Promise<T[]> {
    return await this.getRepository().find(options);
  }
  async findBy(
    where: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  ): Promise<T[]> {
    return this.getRepository().findBy(where);
  }
  async findAndCount(options?: FindManyOptions<T>): Promise<[T[], number]> {
    return this.getRepository().findAndCount(options);
  }
  async findAndCountBy(
    where: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  ): Promise<[T[], number]> {
    return this.getRepository().findAndCount({ where });
  }
  async findByIds(ids: any[]): Promise<T[]> {
    return this.getRepository().findBy(ids);
  }
  async findOne(options: FindOneOptions<T>): Promise<T | null> {
    return this.getRepository().findOne(options);
  }
  async findOneBy(
    where: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  ): Promise<T | null> {
    return this.getRepository().findOneBy(where);
  }
  async findOneById(id: number | string | Date | ObjectId): Promise<T | null> {
    return this.getRepository().findOneBy({ id } as any);
  }
  async findOneOrFail(options: FindOneOptions<T>): Promise<T> {
    return this.getRepository().findOneOrFail(options);
  }
  async findOneByOrFail(
    where: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  ): Promise<T> {
    return this.getRepository().findOneByOrFail(where);
  }
  async query(query: string, parameters?: any[]): Promise<any> {
    return this.getRepository().query(query, parameters);
  }
  async clear(): Promise<void> {
    await this.getRepository().clear();
  }
  async increment(
    conditions: FindOptionsWhere<T>,
    propertyPath: keyof T,
    value: number,
  ): Promise<UpdateResult> {
    return this.getRepository().increment(
      conditions,
      propertyPath as string,
      value,
    );
  }
  async decrement(
    conditions: FindOptionsWhere<T>,
    propertyPath: keyof T,
    value: number,
  ): Promise<UpdateResult> {
    return this.getRepository().decrement(
      conditions,
      propertyPath as string,
      value,
    );
  }
}

export class Collection {
  private constructor() {}

  static from<T>(items: T[]): BasicCollection<T> {
    return BasicCollection.from(items);
  }
  static fromRepositry<T extends ObjectLiteral>(entity: EntityTarget<T>) {
    return AsynchronousCollection.fromRepository(
      entity,
    ) as unknown as Repository<T>;
  }
}
