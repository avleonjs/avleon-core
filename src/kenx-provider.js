"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DB = void 0;
const typedi_1 = require("typedi");
const typedi_2 = require("typedi");
let DB = class DB {
    connection;
    constructor() {
        const existing = typedi_2.Container.has("KnexConnection")
            ? typedi_2.Container.get("KnexConnection")
            : null;
        if (existing) {
            this.connection = existing;
        }
    }
    // Initialize manually (call this in main if you want)
    init(config) {
        if (!this.connection) {
            const knex = require("knex");
            this.connection = knex(config);
            typedi_2.Container.set("KnexConnection", this.connection);
        }
        return this.connection;
    }
    get client() {
        if (!this.connection) {
            throw new Error("Knex is not initialized. Call DB.init(config) first.");
        }
        return this.connection;
    }
};
exports.DB = DB;
exports.DB = DB = __decorate([
    (0, typedi_1.Service)(),
    __metadata("design:paramtypes", [])
], DB);
