"use strict";
/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockDB = void 0;
function createQueryBuilder(resolvedValue = []) {
    const builder = {};
    // Chainable methods return `this`
    const chainable = [
        "where",
        "whereIn",
        "whereLike",
        "orderBy",
        "limit",
        "offset",
        "returning",
    ];
    chainable.forEach((method) => {
        builder[method] = jest.fn().mockReturnThis();
    });
    // Terminal methods resolve with value
    builder.select = jest.fn().mockResolvedValue(resolvedValue);
    builder.insert = jest.fn().mockResolvedValue(resolvedValue);
    builder.update = jest.fn().mockResolvedValue(resolvedValue);
    builder.delete = jest.fn().mockResolvedValue(resolvedValue);
    builder.first = jest
        .fn()
        .mockResolvedValue(Array.isArray(resolvedValue) ? (resolvedValue[0] ?? null) : resolvedValue);
    return builder;
}
class MockDB {
    _resolvedValue = [];
    _clientMock;
    constructor() {
        this._clientMock = jest
            .fn()
            .mockReturnValue(createQueryBuilder(this._resolvedValue));
    }
    // ✅ Matches real DB getter signature
    get client() {
        return this._clientMock;
    }
    // ✅ No-op — never touches Knex
    init = jest.fn();
    // ── Helpers for per-test overrides ──────────────────────────────
    /** Override what all query methods resolve with */
    mockResolvedValue(value) {
        this._resolvedValue = value;
        this._clientMock.mockReturnValue(createQueryBuilder(value));
        return this;
    }
    /** Make the next call resolve with a specific value, then revert */
    mockResolvedValueOnce(value) {
        this._clientMock.mockReturnValueOnce(createQueryBuilder(value));
        return this;
    }
    /** Simulate a DB error */
    mockRejectedValue(error) {
        const builder = createQueryBuilder([]);
        ["select", "insert", "update", "delete", "first"].forEach((m) => {
            builder[m] = jest.fn().mockRejectedValue(error);
        });
        this._clientMock.mockReturnValue(builder);
        return this;
    }
    /** Reset all mocks to default empty state */
    reset() {
        this._resolvedValue = [];
        this._clientMock = jest.fn().mockReturnValue(createQueryBuilder([]));
    }
}
exports.MockDB = MockDB;
