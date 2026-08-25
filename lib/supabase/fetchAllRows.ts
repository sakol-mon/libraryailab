import type { PostgrestError } from "@supabase/supabase-js";

const DEFAULT_PAGE_SIZE = 1000;

type RangeQueryResult<T> = {
  data: T[] | null;
  error: PostgrestError | null;
};

/**
 * PostgREST (and therefore Supabase) caps a single request at `max_rows` (default 1000).
 * This walks the result set with `.range()` until a page comes back shorter than `pageSize`,
 * so tables/RPCs with more than 1000 rows are still fetched in full.
 */
export async function fetchAllRows<T>(
  queryFactory: (from: number, to: number) => PromiseLike<RangeQueryResult<T>>,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<T[]> {
  const allRows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await queryFactory(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    allRows.push(...data);

    if (data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return allRows;
}
