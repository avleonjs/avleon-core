/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */

/**
 * One pagination shape shared by `Collection`, `AvleonRepository`,
 * `@InjectRepository` repositories and `KnexDB`.
 */

/** A page request. `page` is 1-based. */
export interface PageRequest {
  /** 1-based page number. Defaults to 1. */
  page?: number;
  /** Items per page. Defaults to 10. */
  perPage?: number;
  /** @deprecated Use `perPage`. */
  limit?: number;
  /** @deprecated Offset-style request. Use `page` and `perPage`. */
  take?: number;
  /** @deprecated Offset-style request. Use `page` and `perPage`. */
  skip?: number;
}

export interface PaginationMeta {
  /** Total number of items across all pages. */
  total: number;
  /** Current 1-based page. */
  page: number;
  /** Items per page. */
  perPage: number;
  /** Last page number (at least 1). */
  lastPage: number;
  /** Next page number, or `null` on the last page. */
  next: number | null;
  /** Previous page number, or `null` on the first page. */
  prev: number | null;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export const DEFAULT_PER_PAGE = 10;

/** Resolve a page request (new or legacy shape) into page, perPage and offset. */
export function normalizePageRequest(req: PageRequest = {}): {
  page: number;
  perPage: number;
  offset: number;
} {
  const rawPerPage = req.perPage ?? req.limit ?? req.take ?? DEFAULT_PER_PAGE;
  const perPage = Math.max(
    1,
    Math.floor(Number(rawPerPage)) || DEFAULT_PER_PAGE,
  );

  let page: number;
  if (req.page != null) {
    page = Math.floor(Number(req.page)) || 1;
  } else if (req.skip != null) {
    page = Math.floor(Math.max(0, Number(req.skip) || 0) / perPage) + 1;
  } else {
    page = 1;
  }
  page = Math.max(1, page);

  return { page, perPage, offset: (page - 1) * perPage };
}

/** Build the `meta` block for a page of `total` items. */
export function buildPaginationMeta(
  total: number,
  page: number,
  perPage: number,
): PaginationMeta {
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  return {
    total,
    page,
    perPage,
    lastPage,
    next: page < lastPage ? page + 1 : null,
    prev: page > 1 ? Math.min(page - 1, lastPage) : null,
  };
}

/** Wrap a page of data with its metadata. */
export function paginated<T>(
  data: T[],
  total: number,
  page: number,
  perPage: number,
): Paginated<T> {
  return { data, meta: buildPaginationMeta(total, page, perPage) };
}
