import { Container, Service, Token } from "typedi";
import type { Knex } from "knex";
import {
  PageRequest,
  Paginated,
  normalizePageRequest,
  paginated,
} from "./pagination";

/** DI token holding the initialized Knex instance. Set by `app.useKnex(...)`. */
export const AVLEON_KNEX_DB = new Token<Knex>("AVLEON_KNEX_DB");

/**
 * Injectable accessor for the application's Knex connection.
 *
 * The connection itself is created by `app.useKnex(...)`, which registers it
 * under {@link AVLEON_KNEX_DB}. Resolving this service before that call throws.
 */
@Service()
export class KnexDB {
  private readonly connection: Knex;

  constructor() {
    const existing = Container.has(AVLEON_KNEX_DB)
      ? Container.get<Knex>(AVLEON_KNEX_DB)
      : null;

    if (!existing) {
      throw new Error("Knex is not initialized. Call useKnex first.");
    }

    this.connection = existing;
  }

  public get client(): Knex {
    return this.connection;
  }

  /**
   * Run `query` for one page, returning the unified pagination shape.
   *
   * ```ts
   * const { data, meta } = await db.paginate(db.client("users").where("active", true), { page: 2 });
   * ```
   *
   * The total is counted on a clone of the query with its select, order and
   * limit/offset cleared.
   */
  async paginate<T = any>(
    query: Knex.QueryBuilder,
    options?: PageRequest,
  ): Promise<Paginated<T>> {
    return paginateKnex<T>(query, options);
  }
}

/** Paginate any Knex query builder into the unified `{ data, meta }` shape. */
export async function paginateKnex<T = any>(
  query: Knex.QueryBuilder,
  options?: PageRequest,
): Promise<Paginated<T>> {
  const { page, perPage, offset } = normalizePageRequest(options);

  const countRow: any = await query
    .clone()
    .clearSelect()
    .clearOrder()
    .clear("limit" as any)
    .clear("offset" as any)
    .count({ total: "*" })
    .first();
  const total = Number(countRow?.total ?? 0);

  const data = (await query.clone().offset(offset).limit(perPage)) as T[];
  return paginated(data, total, page, perPage);
}
