import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.ts';
export function useHistory<
  T extends {
    id?: string;
    seq?: number;
    createdAt?: string;
    startedAt?: string;
    at?: string;
    truncated?: boolean;
    preview?: boolean;
    updatedAt?: string;
  },
>(query: string, live: T[]) {
  const [page, setPage] = useState<{ key: string; items: T[]; before?: number; hasMore: boolean }>({
    key: query,
    items: [],
    hasMore: false,
  });
  const [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    setError('');
    void api(query)
      .then((result) => {
        if (!disposed) setPage({ key: query, ...result });
      })
      .catch((e) => {
        if (!disposed) setError(e.message);
      });
    return () => {
      disposed = true;
    };
  }, [query]);
  const load = useCallback(async () => {
    if (loading || page.key !== query || !page.before) return;
    setLoading(true);
    setError('');
    try {
      const result = await api(query + '&before=' + page.before);
      setPage((previous) =>
        previous.key === query
          ? {
              key: query,
              items: [...result.items, ...previous.items],
              before: result.before,
              hasMore: result.hasMore,
            }
          : previous,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query, page.before, page.key, loading]);
  const items = useMemo(() => {
    const map = new Map<string | number, T>();
    for (const item of page.key === query ? page.items : []) map.set(item.id ?? item.seq!, item);
    for (const item of live) {
      const key = item.id ?? item.seq!,
        existing = map.get(key);
      if (
        (item.truncated || item.preview) &&
        existing &&
        !existing.truncated &&
        !existing.preview &&
        existing.updatedAt === item.updatedAt
      )
        continue;
      map.set(key, item);
    }
    return [...map.values()].sort((a, b) =>
      a.seq !== undefined && b.seq !== undefined
        ? a.seq - b.seq
        : (a.createdAt ?? a.startedAt ?? a.at ?? '').localeCompare(
            b.createdAt ?? b.startedAt ?? b.at ?? '',
          ),
    );
  }, [page, query, live]);
  return { items, load, loading, error, hasMore: page.key === query && page.hasMore };
}
