
import type  {
    DataSource,
    EntityManager,
    EntityTarget,
    FindManyOptions,
    FindOneOptions,
    FindOptionsWhere,
    DeepPartial,
    Repository as OrmRepository,
    ObjectLiteral,
    DataSourceOptions,
    SelectQueryBuilder,
    QueryRunner,
    InsertResult,
    UpdateResult,
    DeleteResult,
    ObjectId,
    SaveOptions,
    RemoveOptions,
    EntityMetadata,
    Like,
    ILike,
    In,
    Not,
    Between,
    LessThan,
    LessThanOrEqual,
    MoreThan,
    MoreThanOrEqual,
    IsNull,
    Any,
    Raw,
} from "typeorm";
import { Service, Container } from "typedi";
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
    Index,
    ManyToOne,
    OneToMany,
    JoinColumn,
} from "typeorm";
import { Constructor, loadPackageFromClient } from "../utils/common-utils";

// ─── Re-export common operators for convenience ─────────────────────────────
export {
    Like, ILike, In, Not, Between,
    LessThan, LessThanOrEqual, MoreThan, MoreThanOrEqual,
    IsNull, Any, Raw,
};

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginationOptions {
    page: number;   // 1-based
    limit: number;
}

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

// ─── Soft-delete guard ───────────────────────────────────────────────────────

export interface SoftDeletable {
    deletedAt?: Date | null;
}

// ─── Base Repository ─────────────────────────────────────────────────────────

export class AvleonRepository<TEntity extends ObjectLiteral> {
    protected orm!: OrmRepository<TEntity>;



    constructor(
        protected entity: EntityTarget<TEntity>,
        protected manager: EntityManager
    ) {
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

    findOneBy(where: FindOptionsWhere<TEntity> | FindOptionsWhere<TEntity>[]): Promise<TEntity | null> {
        return this.orm.findOneBy(where);
    }

    findBy(where: FindOptionsWhere<TEntity> | FindOptionsWhere<TEntity>[]): Promise<TEntity[]> {
        return this.orm.findBy(where);
    }

    findById(id: number | string | ObjectId): Promise<TEntity | null> {
        return this.orm.findOne({ where: { id } as any });
    }

    findByIds(ids: (number | string | ObjectId)[]): Promise<TEntity[]> {

        const typeorm = loadPackageFromClient("typeorm");
        return this.orm.findBy({ id: typeorm.In(ids) } as any);
    }

    findAndCount(options?: FindManyOptions<TEntity>): Promise<[TEntity[], number]> {
        return this.orm.findAndCount(options);
    }

    findAndCountBy(where: FindOptionsWhere<TEntity> | FindOptionsWhere<TEntity>[]): Promise<[TEntity[], number]> {
        return this.orm.findAndCountBy(where);
    }

    count(options?: FindManyOptions<TEntity>): Promise<number> {
        return this.orm.count(options);
    }

    countBy(where: FindOptionsWhere<TEntity> | FindOptionsWhere<TEntity>[]): Promise<number> {
        return this.orm.countBy(where);
    }

    exists(options?: FindManyOptions<TEntity>): Promise<boolean> {
        return this.orm.exists(options);
    }

    existsBy(where: FindOptionsWhere<TEntity> | FindOptionsWhere<TEntity>[]): Promise<boolean> {
        return this.orm.existsBy(where);
    }

    // ─── Pagination ──────────────────────────────────────────────────────────

    async paginate(
        options: FindManyOptions<TEntity>,
        pagination: PaginationOptions
    ): Promise<PaginatedResult<TEntity>> {
        const { page, limit } = pagination;
        const skip = (page - 1) * limit;

        const [data, total] = await this.orm.findAndCount({
            ...options,
            skip,
            take: limit,
        });

        const totalPages = Math.ceil(total / limit);
        return {
            data,
            total,
            page,
            limit,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
        };
    }

    // ─── Create & Save ───────────────────────────────────────────────────────

    create(data?: DeepPartial<TEntity>) {
         return this.orm.create(data as any)
    }

    createMany(dataArray: DeepPartial<TEntity>[]) {
        return dataArray.map(d => this.orm.create(d as any));
    }

    async save(
        data: DeepPartial<TEntity>,
        options?: SaveOptions
    ): Promise<TEntity> {
        return this.orm.save(data as any, options);
    }

    async saveMany(
        dataArray: DeepPartial<TEntity>[],
        options?: SaveOptions
    ): Promise<TEntity[]> {
        return this.orm.save(dataArray as any[], options);
    }

    // ─── Insert ──────────────────────────────────────────────────────────────

    async insert(data: DeepPartial<TEntity> | DeepPartial<TEntity>[]): Promise<InsertResult> {
        return this.orm.insert(data as any);
    }

    // ─── Upsert ──────────────────────────────────────────────────────────────

    async upsert(
        data: DeepPartial<TEntity> | DeepPartial<TEntity>[],
        conflictPaths: string[] | any
    ): Promise<InsertResult> {
        return this.orm.upsert(data as any, conflictPaths as any);
    }

    // ─── Update ──────────────────────────────────────────────────────────────

    async update(
        criteria: string | string[] | number | number[] | FindOptionsWhere<TEntity>,
        data: DeepPartial<TEntity>
    ): Promise<UpdateResult> {
        return this.orm.update(criteria as any, data as any);
    }

    async updateById(id: number | string, data: DeepPartial<TEntity>): Promise<UpdateResult> {
        return this.orm.update(id, data as any);
    }

    // ─── Delete & Remove ─────────────────────────────────────────────────────

    async delete(
        criteria: string | string[] | number | number[] | FindOptionsWhere<TEntity>
    ): Promise<DeleteResult> {
        return this.orm.delete(criteria as any);
    }

    async deleteById(id: number | string): Promise<DeleteResult> {
        return this.orm.delete(id);
    }

    async remove(entity: TEntity, options?: RemoveOptions): Promise<TEntity> {
        return this.orm.remove(entity, options);
    }

    async removeMany(entities: TEntity[], options?: RemoveOptions): Promise<TEntity[]> {
        return this.orm.remove(entities, options);
    }

    // ─── Soft Delete (requires @DeleteDateColumn) ────────────────────────────

    async softDelete(
        criteria: string | string[] | number | number[] | FindOptionsWhere<TEntity>
    ): Promise<UpdateResult> {
        return this.orm.softDelete(criteria as any);
    }

    async softDeleteById(id: number | string): Promise<UpdateResult> {
        return this.orm.softDelete(id);
    }

    async restore(
        criteria: string | string[] | number | number[] | FindOptionsWhere<TEntity>
    ): Promise<UpdateResult> {
        return this.orm.restore(criteria as any);
    }

    async softRemove(entity: TEntity, options?: SaveOptions): Promise<TEntity> {
        return this.orm.softRemove(entity, options);
    }

    // ─── Aggregation via Query Builder ───────────────────────────────────────

    async sum(column: keyof TEntity, where?: FindOptionsWhere<TEntity>): Promise<number | null> {
        const alias = "e";
        const qb = this.orm.createQueryBuilder(alias).select(`SUM(${alias}.${String(column)})`, "sum");
        if (where) qb.where(where as any);
        const result = await qb.getRawOne<{ sum: string | null }>();
        return result?.sum != null ? Number(result.sum) : null;
    }

    async avg(column: keyof TEntity, where?: FindOptionsWhere<TEntity>): Promise<number | null> {
        const alias = "e";
        const qb = this.orm.createQueryBuilder(alias).select(`AVG(${alias}.${String(column)})`, "avg");
        if (where) qb.where(where as any);
        const result = await qb.getRawOne<{ avg: string | null }>();
        return result?.avg != null ? Number(result.avg) : null;
    }

    async min(column: keyof TEntity, where?: FindOptionsWhere<TEntity>): Promise<number | null> {
        const alias = "e";
        const qb = this.orm.createQueryBuilder(alias).select(`MIN(${alias}.${String(column)})`, "min");
        if (where) qb.where(where as any);
        const result = await qb.getRawOne<{ min: string | null }>();
        return result?.min != null ? Number(result.min) : null;
    }

    async max(column: keyof TEntity, where?: FindOptionsWhere<TEntity>): Promise<number | null> {
        const alias = "e";
        const qb = this.orm.createQueryBuilder(alias).select(`MAX(${alias}.${String(column)})`, "max");
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
        work: (repo: this, queryRunner: QueryRunner) => Promise<T>
    ): Promise<T> {
        const queryRunner = this.manager.connection.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        // Bind a scoped repo to the transaction's manager
        const txRepo = new (this.constructor as any)(
            this.entity,
            queryRunner.manager
        ) as this;

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

    // ─── Query Builder Access ────────────────────────────────────────────────

    /** Create a QueryBuilder with a default alias of the entity table name. */
    qb(alias?: string): SelectQueryBuilder<TEntity> {
        return this.orm.createQueryBuilder(alias ?? this.orm.metadata.tableName);
    }

    // ─── Bulk / Raw ──────────────────────────────────────────────────────────

    /**
     * Efficient bulk insert using chunking to avoid hitting SQL parameter limits.
     */
    async bulkInsert(rows: DeepPartial<TEntity>[], chunkSize = 500): Promise<void> {
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
 * Class decorator that:
 *  1. Marks the class as a typedi @Service
 *  2. Resolves the DataSource from the DI container and wires it into AvleonRepository
 */
export function Repository<TEntity extends ObjectLiteral>(
    entity: EntityTarget<TEntity>
) {
    return function <TBase extends Constructor<AvleonRepository<TEntity>>>(
        Base: TBase
    ) {
        @Service()
        class RepositoryClass extends Base {
            constructor(...args: any[]) {
                const typeorm = loadPackageFromClient<typeof import("typeorm")>("typeorm")
                const dataSource = Container.get(typeorm.DataSource);
                super(entity, dataSource.manager, ...args);
            }
        }

        Object.defineProperty(RepositoryClass, "name", {
            value: Base.name,
            writable: false,
        });

        return RepositoryClass as unknown as TBase;
    };
}
