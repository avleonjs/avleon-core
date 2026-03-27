"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Collection = void 0;
exports.InjectRepository = InjectRepository;
/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
const typedi_1 = __importDefault(require("typedi"));
const exceptions_1 = require("./exceptions");
class BasicCollectionImpl {
    items;
    constructor(items) {
        this.items = items;
    }
    static from(items) {
        return new BasicCollectionImpl(items);
    }
    clear() {
        this.items = [];
    }
    find(predicate) {
        if (this.isFunction(predicate)) {
            return this.items.filter(predicate);
        }
        const results = Array.from(this.items);
        return results;
    }
    async findAsync(predicate) {
        const results = Array.from(this.items);
        return results;
    }
    _matches(item, where) {
        if ("$or" in where) {
            return where.$or.some((cond) => this._matches(item, cond));
        }
        if ("$and" in where) {
            return where.$and.every((cond) => this._matches(item, cond));
        }
        if ("$not" in where) {
            return !this._matches(item, where.$not);
        }
        // Field-based matching
        return Object.entries(where).every(([key, condition]) => {
            const itemValue = item[key];
            if (condition &&
                typeof condition === "object" &&
                !Array.isArray(condition)) {
                const op = condition;
                if ("$in" in op && Array.isArray(op.$in)) {
                    return op.$in.includes(itemValue);
                }
            }
            return itemValue === condition;
        });
    }
    findOne(predicate) {
        if (this.isFunction(predicate)) {
            return this.items.find(predicate);
        }
        const result = this.items.filter((item) => this._matches(item, predicate.where));
        if (result.length > 0) {
            return result[0];
        }
        return undefined;
    }
    async findOneAsync(predicate) {
        if (this.isFunction(predicate)) {
            return this.items.find(predicate);
        }
        return this.items.find((item) => this._matches(item, predicate.where));
    }
    // Utility function to check if a value is a function
    isFunction(value) {
        return typeof value === "function";
    }
    add(item) {
        this.items.push(item);
        return this.items[this.items.length - 1];
    }
    addAll(items) {
        this.items.push(...items);
    }
    update(predicate, updater) {
        const item = this.items.find(predicate);
        if (item) {
            const index = this.items.indexOf(item);
            this.items[index] = { ...item, ...updater };
        }
        else {
            throw new exceptions_1.NotFoundException("Item not found");
        }
    }
    updateAll(predicate, updater) {
        for (let i = 0; i < this.items.length; i++) {
            if (predicate(this.items[i])) {
                this.items[i] = updater(this.items[i]);
            }
        }
    }
    delete(predicate) {
        const index = this.items.findIndex(predicate);
        if (index !== -1) {
            this.items.splice(index, 1);
        }
    }
    deleteAll(predicate) {
        this.items = this.items.filter((item) => !predicate(item));
    }
    max(key) {
        return Math.max(...this.items.map((item) => item[key]));
    }
    min(key) {
        return Math.max(...this.items.map((item) => item[key]));
    }
    sum(key) {
        const nums = this.items.flatMap((x) => x[key]);
        return nums.reduce((sum, num) => sum + num, 0);
    }
    avg(key) {
        const nums = this.items.flatMap((x) => x[key]);
        return nums.reduce((sum, num) => sum + num, 0) / nums.length;
    }
    paginate(options) {
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
    getDeepValue(item, path) {
        if (typeof path !== "string")
            return item[path];
        return path.split(".").reduce((acc, key) => acc?.[key], item);
    }
}
class AsynchronousCollection {
    model;
    repo;
    constructor(model) {
        this.model = model;
    }
    static fromRepository(model) {
        return new AsynchronousCollection(model);
    }
    getRepository() {
        if (!this.repo) {
            const dataSourceKey = "idatasource";
            const dataSource = typedi_1.default.get(dataSourceKey);
            console.log("datasource", dataSource);
            const repository = dataSource.getRepository(this.model);
            this.repo = repository;
            return repository;
        }
        return this.repo;
    }
    // Pagination with query builder
    async paginate(options) {
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
            prev: skip + take < total ? skip + take : null,
            data,
        };
    }
}
class Collection {
    constructor() { }
    static from(items) {
        return BasicCollectionImpl.from(items);
    }
    // Example refactoring of Collection.fromRepository for better type safety
    static fromRepository(entity) {
        const asyncCollection = AsynchronousCollection.fromRepository(entity);
        // Assuming AsynchronousCollection has a method to get the Repository<T>
        return asyncCollection.getRepository();
    }
}
exports.Collection = Collection;
function InjectRepository(model) {
    return function (object, propertyName, index) {
        let repo;
        try {
            typedi_1.default.registerHandler({
                object,
                propertyName,
                index,
                value: (containerInstance) => {
                    const dataSource = containerInstance.get("idatasource");
                    repo = dataSource
                        .getRepository(model)
                        .extend({ paginate: () => { } });
                    repo.paginate = async function (options = { take: 10, skip: 0 }) {
                        const [data, total] = await this.findAndCount({
                            take: options.take || 10,
                            skip: options.skip || 0,
                        });
                        return {
                            total,
                            totalPage: Math.ceil(total / (options.take || 10)),
                            next: options.skip + options.take < total
                                ? options.skip + options.take
                                : null,
                            data,
                        };
                    };
                    return repo;
                },
            });
        }
        catch (error) {
            if (error.name && error.name == "ServiceNotFoundError") {
                console.log("Database didn't initialized.");
            }
        }
    };
}
