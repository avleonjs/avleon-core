/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 */

type MockQueryBuilder = {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  where: jest.Mock;
  whereIn: jest.Mock;
  whereLike: jest.Mock;
  first: jest.Mock;
  returning: jest.Mock;
  orderBy: jest.Mock;
  limit: jest.Mock;
  offset: jest.Mock;
};

function createQueryBuilder(resolvedValue: any = []): MockQueryBuilder {
  const builder: any = {};

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
    .mockResolvedValue(
      Array.isArray(resolvedValue) ? (resolvedValue[0] ?? null) : resolvedValue,
    );

  return builder;
}

export class MockDB {
  private _resolvedValue: any = [];
  private _clientMock: jest.Mock;

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
  mockResolvedValue(value: any) {
    this._resolvedValue = value;
    this._clientMock.mockReturnValue(createQueryBuilder(value));
    return this;
  }

  /** Make the next call resolve with a specific value, then revert */
  mockResolvedValueOnce(value: any) {
    this._clientMock.mockReturnValueOnce(createQueryBuilder(value));
    return this;
  }

  /** Simulate a DB error */
  mockRejectedValue(error: Error) {
    const builder: any = createQueryBuilder([]);
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
