import { Service, Token } from "typedi";
import type { Knex } from "knex";
import { Container } from "typedi";

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
}
