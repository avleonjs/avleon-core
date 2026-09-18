import { Service, Token } from "typedi";
import knex, { Knex } from "knex";
import { Container } from "typedi";


export const AVLEON_KNEX_DB =new Token<Knex>("AVLEON_KNEX_DB")


@Service()
export class KnexDB {
  private connection: Knex;

  private constructor() {
    const existing = Container.has(AVLEON_KNEX_DB)
      ? Container.get<Knex>(AVLEON_KNEX_DB)
      : null;

    if (existing) {
      this.connection = existing;
    }else{
      throw new Error("Knex is not initialized. Call useKnex first.");
    }
  }


  public get client(): Knex {
    if (!this.connection) {
      throw new Error("Knex is not initialized. Call DB.init(config) first.");
    }
    return this.connection;
  }
}
