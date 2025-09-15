import { Service } from "typedi";
import type { Knex } from "knex";
import { Container } from "typedi";




@Service()
export class DB {
  private connection: Knex;

  constructor() {
    const existing = Container.has("KnexConnection")
      ? Container.get<Knex>("KnexConnection")
      : null;

    if (existing) {
      this.connection = existing;
    }
  }

  // Initialize manually (call this in main if you want)
  public init(config: Knex.Config) {
    if (!this.connection) {
      const knex = require("knex");
      this.connection = knex(config);
      Container.set("KnexConnection", this.connection);
    }
    return this.connection;
  }

  public get client(): Knex {
    if (!this.connection) {
      throw new Error("Knex is not initialized. Call DB.init(config) first.");
    }
    return this.connection;
  }
}
