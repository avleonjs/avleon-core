import "reflect-metadata";
import { Container } from "typedi";
import type { Knex } from "knex";
import { DB } from "./kenx-provider";

jest.mock("knex", () => jest.fn(() => ({ mock: "knexInstance" })));

describe("DB", () => {
    beforeEach(() => {
        Container.reset();
    });

    it("should throw error if client is accessed before init", () => {
        const db = new DB();
        expect(() => db.client).toThrow("Knex is not initialized. Call DB.init(config) first.");
    });

    it("should initialize knex and set connection", () => {
        const db = new DB();
        const config = { client: "sqlite3", connection: {} };
        const conn = db.init(config as Knex.Config);
        expect(conn).toEqual({ mock: "knexInstance" });
        expect(db.client).toEqual({ mock: "knexInstance" });
        expect(Container.get("KnexConnection")).toEqual({ mock: "knexInstance" });
    });

    it("should use existing connection from Container", () => {
        const existingConn = { mock: "existingKnex" };
        Container.set("KnexConnection", existingConn);
        const db = new DB();
        expect(db.client).toBe(existingConn);
    });

    // it("should not reinitialize if connection exists", () => {
    //     const db = new DB();
    //     const config = { client: "sqlite3", connection: {} };
    //     db.init(config as Knex.Config);
    //     const conn2 = db.init(config as Knex.Config);
    //     expect(conn2).toEqual({ mock: "knexInstance" });
    // });
});