import type {
  EntityManager,
  EntityTarget,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  DeepPartial,
  Repository as OrmRepository,
  ObjectLiteral,
  SelectQueryBuilder,
  QueryRunner,
  InsertResult,
  UpdateResult,
  DeleteResult,
  ObjectId,
  SaveOptions,
  RemoveOptions,
  EntityMetadata,
} from "typeorm";
import { Service } from "typedi";
import {
  Constructor,
  loadPackageFromClient,
} from "../common/utils/common-utils";
import { getDataSource } from "./datasource";
import {
  PageRequest,
  Paginated,
  normalizePageRequest,
  paginated,
} from "./pagination";

// ─── Query operators ─────────────────────────────────────────────────────────
//
// typeorm is an optional peer dependency, so these are lazy runtime wrappers:
// each call forwards to the operator exported by the application's own
// `typeorm` install (the same copy its DataSource uses).

type TypeOrm = typeof import("typeorm");

function typeormOperator<K extends keyof TypeOrm>(name: K): TypeOrm[K] {
  return ((...args: any[]) => {
    const typeorm = loadPackageFromClient<TypeOrm>("typeorm");
    return (typeorm[name] as any)(...args);
  }) as any;
}

export const Like = typeormOperator("Like");
export const ILike = typeormOperator("ILike");
export const In = typeormOperator("In");
export const Not = typeormOperator("Not");
export const Between = typeormOperator("Between");
export const LessThan = typeormOperator("LessThan");
export const LessThanOrEqual = typeormOperator("LessThanOrEqual");
export const MoreThan = typeormOperator("MoreThan");
export const MoreThanOrEqual = typeormOperator("MoreThanOrEqual");
export const IsNull = typeormOperator("IsNull");
export const Any = typeormOperator("Any");
export const Raw = typeormOperator("Raw");
export const Equal = typeormOperator("Equal");
export const ArrayContains = typeormOperator("ArrayContains");

// ─── Pagination ──────────────────────────────────────────────────────────────

/** @deprecated Use {@link PageRequest} (`{ page, perPage }`). */
export interface PaginationOptions {
  page: number; // 1-based
  limit: number;
}

/** @deprecated Use {@link Paginated}. Kept as an alias of the unified shape. */
export type PaginatedResult<T> = Paginated<T>;

// ─── Soft-delete guard ───────────────────────────────────────────────────────

export interface SoftDeletable {
  deletedAt?: Date | null;
}

// ─── Base Repository ─────────────────────────────────────────────────────────

const REPOSITORY_ENTITY = Symbol.for("avleon:repository:entity");

export class AvleonRepository<TEntity extends ObjectLiteral> {
  protected orm!: OrmRepository<TEntity>;
  protected entity: EntityTarget<TEntity>;
  protected manager: EntityManager;

  /**
   * Both arguments are optional for `@Repository(Entity)` classes: the entity
   * comes from the decorator and the manager from the registered DataSource,
   * so a subclass constructor can take its own injected dependencies and
   * call `super()` with no arguments.
   */
  constructor(entity?: EntityTarget<TEntity>, manager?: EntityManager) {
    const resolvedEntity =
      entity ??
      ((this.constructor as any)[REPOSITORY_ENTITY] as
        | EntityTarget<TEntity>
        | undefined);
    if (!resolvedEntity) {
      throw new Error(
        `[Avleon] ${this.constructor.name} has no entity. Decorate it with @Repository(Entity) or pass the entity to super().`,
      );
    }
    this.entity = resolvedEntity;
    this.manager = manager ?? getDataSource().manager;
    this.orm = this.manager.getRepository(this.entity);
  }

  // ─── Metadata ────────────────────────────────────────────────────────────

  get metadata(): EntityMetadata {
    return this.orm.metadata;
  }

  get target(): EntityTarget<TEntity> {
    return this.entity;
  }

  // ─── Basic CRUD ──────────────────────────────────────────────────────────

  find(options?: FindManyOptions<TEntity>): Promise<TEntity[]> {
    return this.orm.find(options);
  }

  findOne(options: FindOneOptions<TEntity>): Promise<TEntity | null> {
    return this.orm.findOne(options);
  }

  findOneBy(
    where: FindOptionsWhere<TEntity> | FindOptionsWhere<TEntity>[],
  ): Promise<TEntity | null> {
    return this.orm.findOneBy(where);
  }

  findBy(
    where: FindOptionsWhere<TEntity> | FindOptionsWhere<TEntity>[],
  ): Promise<TEntity[]> {
    return this.orm.findBy(where);
  }

  findById(id: number | string | ObjectId): Promise<TEntity | null> {
    return this.orm.findOne({ where: { id } as any });
  }

  findByIds(ids: (number | string | ObjectId)[]): Promise<TEntity[]> {
    return this.orm.findBy({ id: In(ids as any[]) } as any);
  }

  findAndCount(
    options?: FindManyOptions<TEntity>,
  ): Promise<[TEntity[], number]> {
    return this.orm.findAndCount(options);
  }

  findAndCountBy(
    where: FindOptionsWhere<TEntity> | FindOptionsWhere<TEntity>[],
  ): Promise<[TEntity[], number]> {
    return this.orm.findAndCountBy(where);
  }

  count(options?: FindManyOptions<TEntity>): Promise<number> {
    return this.orm.count(options);
  }

  countBy(
    where: FindOptionsWhere<TEntity> | FindOptionsWhere<TEntity>[],
  ): Promise<number> {
    return this.orm.countBy(where);
  }

  exists(options?: FindManyOptions<TEntity>): Promise<boolean> {
    return this.orm.exists(options);
  }

  existsBy(
    where: FindOptionsWhere<TEntity> | FindOptionsWhere<TEntity>[],
  ): Promise<boolean> {
    return this.orm.existsBy(where);
  }

  // ─── Pagination ──────────────────────────────────────────────────────────

  /**
   * Fetch one page of entities.
   *
   * ```ts
   * const { data, meta } = await repo.paginate({ where: { active: true } }, { page: 2, perPage: 20 });
   * ```
   */
  async paginate(
    options: FindManyOptions<TEntity> = {},
    pagination: PageRequest = {},
  ): Promise<Paginated<TEntity>> {
    const { page, perPage, offset } = normalizePageRequest(pagination);

    const [data, total] = await this.orm.findAndCount({
      ...options,
      skip: offset,
      take: perPage,
    });

    return paginated(data, total, page, perPage);
  }

  // ─── Create & Save ───────────────────────────────────────────────────────

  create(data?: DeepPartial<TEntity>) {
    return this.orm.create(data as any);
  }

  createMany(dataArray: DeepPartial<TEntity>[]) {
    return dataArray.map((d) => this.orm.create(d as any));
  }

  async save(
    data: DeepPartial<TEntity>,
    options?: SaveOptions,
  ): Promise<TEntity> {
    return this.orm.save(data as any, options);
  }

  async saveMany(
    dataArray: DeepPartial<TEntity>[],
    options?: SaveOptions,
  ): Promise<TEntity[]> {
    return this.orm.save(dataArray as any[], options);
  }

  // ─── Insert ──────────────────────────────────────────────────────────────

  async insert(
    data: DeepPartial<TEntity> | DeepPartial<TEntity>[],
  ): Promise<InsertResult> {
    return this.orm.insert(data as any);
  }

  // ─── Upsert ──────────────────────────────────────────────────────────────

  async upsert(
    data: DeepPartial<TEntity> | DeepPartial<TEntity>[],
    conflictPaths: string[] | any,
  ): Promise<InsertResult> {
    return this.orm.upsert(data as any, conflictPaths as any);
  }

  // ─── Update ──────────────────────────────────────────────────────────────

  async update(
    criteria: string | string[] | number | number[] | FindOptionsWhere<TEntity>,
    data: DeepPartial<TEntity>,
  ): Promise<UpdateResult> {
    return this.orm.update(criteria as any, data as any);
  }

  async updateById(
    id: number | string,
    data: DeepPartial<TEntity>,
  ): Promise<UpdateResult> {
    return this.orm.update(id, data as any);
  }

  // ─── Delete & Remove ─────────────────────────────────────────────────────

  async delete(
    criteria: string | string[] | number | number[] | FindOptionsWhere<TEntity>,
  ): Promise<DeleteResult> {
    return this.orm.delete(criteria as any);
  }

  async deleteById(id: number | string): Promise<DeleteResult> {
    return this.orm.delete(id);
  }

  async remove(entity: TEntity, options?: RemoveOptions): Promise<TEntity> {
    return this.orm.remove(entity, options);
  }

  async removeMany(
    entities: TEntity[],
    options?: RemoveOptions,
  ): Promise<TEntity[]> {
    return this.orm.remove(entities, options);
  }

  // ─── Soft Delete (requires @DeleteDateColumn) ────────────────────────────

  async softDelete(
    criteria: string | string[] | number | number[] | FindOptionsWhere<TEntity>,
  ): Promise<UpdateResult> {
    return this.orm.softDelete(criteria as any);
  }

  async softDeleteById(id: number | string): Promise<UpdateResult> {
    return this.orm.softDelete(id);
  }

  async restore(
    criteria: string | string[] | number | number[] | FindOptionsWhere<TEntity>,
  ): Promise<UpdateResult> {
    return this.orm.restore(criteria as any);
  }

  async softRemove(entity: TEntity, options?: SaveOptions): Promise<TEntity> {
    return this.orm.softRemove(entity, options);
  }

  // ─── Aggregation via Query Builder ───────────────────────────────────────

  async sum(
    column: keyof TEntity,
    where?: FindOptionsWhere<TEntity>,
  ): Promise<number | null> {
    const alias = "e";
    const qb = this.orm
      .createQueryBuilder(alias)
      .select(`SUM(${alias}.${String(column)})`, "sum");
    if (where) qb.where(where as any);
    const result = await qb.getRawOne<{ sum: string | null }>();
    return result?.sum != null ? Number(result.sum) : null;
  }

  async avg(
    column: keyof TEntity,
    where?: FindOptionsWhere<TEntity>,
  ): Promise<number | null> {
    const alias = "e";
    const qb = this.orm
      .createQueryBuilder(alias)
      .select(`AVG(${alias}.${String(column)})`, "avg");
    if (where) qb.where(where as any);
    const result = await qb.getRawOne<{ avg: string | null }>();
    return result?.avg != null ? Number(result.avg) : null;
  }

  async min(
    column: keyof TEntity,
    where?: FindOptionsWhere<TEntity>,
  ): Promise<number | null> {
    const alias = "e";
    const qb = this.orm
      .createQueryBuilder(alias)
      .select(`MIN(${alias}.${String(column)})`, "min");
    if (where) qb.where(where as any);
    const result = await qb.getRawOne<{ min: string | null }>();
    return result?.min != null ? Number(result.min) : null;
  }

  async max(
    column: keyof TEntity,
    where?: FindOptionsWhere<TEntity>,
  ): Promise<number | null> {
    const alias = "e";
    const qb = this.orm
      .createQueryBuilder(alias)
      .select(`MAX(${alias}.${String(column)})`, "max");
    if (where) qb.where(where as any);
    const result = await qb.getRawOne<{ max: string | null }>();
    return result?.max != null ? Number(result.max) : null;
  }

  // ─── Transactions ────────────────────────────────────────────────────────

  /**
   * Run a callback inside a transaction. If the callback throws,
   * the transaction is rolled back automatically.
   */
  async transaction<T>(
    work: (repo: this, queryRunner: QueryRunner) => Promise<T>,
  ): Promise<T> {
    // Already inside a transaction: join it rather than opening a new one.
    const current = this.manager.queryRunner;
    if (current?.isTransactionActive) {
      return work(this, current);
    }

    const queryRunner = this.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const txRepo = this.withManager(queryRunner.manager);

    try {
      const result = await work(txRepo, queryRunner);
      await queryRunner.commitTransaction();
      return result;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * A copy of this repository bound to another `EntityManager` (for example a
   * transaction's). The copy keeps every injected dependency of the original;
   * no constructor runs.
   */
  withManager(manager: EntityManager): this {
    const copy = Object.create(Object.getPrototypeOf(this)) as this;
    Object.assign(copy, this);
    copy.manager = manager;
    copy.orm = manager.getRepository(this.entity);
    return copy;
  }

  // ─── Query Builder Access ────────────────────────────────────────────────

  /** Create a QueryBuilder with a default alias of the entity table name. */
  qb(alias?: string): SelectQueryBuilder<TEntity> {
    return this.orm.createQueryBuilder(alias ?? this.orm.metadata.tableName);
  }

  // ─── Bulk / Raw ──────────────────────────────────────────────────────────

  /**
   * Efficient bulk insert using chunking to avoid hitting SQL parameter limits.
   */
  async bulkInsert(
    rows: DeepPartial<TEntity>[],
    chunkSize = 500,
  ): Promise<void> {
    for (let i = 0; i < rows.length; i += chunkSize) {
      await this.orm.insert(rows.slice(i, i + chunkSize) as any);
    }
  }

  /**
   * Execute raw SQL. Use sparingly — prefer the query builder.
   * @param sql  Parameterised SQL string
   * @param params  Positional parameters
   */
  async raw<T = any>(sql: string, params?: any[]): Promise<T[]> {
    return this.manager.query(sql, params);
  }

  // ─── Protected helpers ───────────────────────────────────────────────────

  protected getRepository(): OrmRepository<TEntity> {
    return this.orm;
  }

  protected getManager(): EntityManager {
    return this.manager;
  }
}

// ─── @Repository decorator ───────────────────────────────────────────────────

/**
 * Class decorator that registers a repository with the DI container and binds
 * it to `entity`. The DataSource is resolved from the container when the
 * repository is constructed.
 *
 * The class keeps its own constructor, so it can inject other services:
 *
 * ```ts
 * @Repository(User)
 * class UserRepository extends AvleonRepository<User> {
 *   constructor(private readonly audit: AuditService) { super(); }
 * }
 * ```
 */
export function Repository<TEntity extends ObjectLiteral>(
  entity: EntityTarget<TEntity>,
) {
  return function <TBase extends Constructor<AvleonRepository<TEntity>>>(
    Base: TBase,
  ): TBase {
    Object.defineProperty(Base, REPOSITORY_ENTITY, {
      value: entity,
      enumerable: false,
      configurable: true,
      writable: true,
    });
    Service()(Base);
    return Base;
  };
}
