import { useCallback, useEffect, useState } from 'react';

const memoryDrafts = new Map<string, unknown>();

function readDraft<T>(key: string, initial: T): T {
  if (memoryDrafts.has(key)) return memoryDrafts.get(key) as T;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return (memoryDrafts.get(key) as T | undefined) ?? initial;
    const value: unknown = JSON.parse(raw);
    return value !== null && typeof value === typeof initial && !Array.isArray(value)
      ? (value as T)
      : initial;
  } catch {
    return (memoryDrafts.get(key) as T | undefined) ?? initial;
  }
}

// Scope changes never move an existing draft into another conversation or revision.
export function useDraft<T>(key: string, initial: T) {
  const [draft, setDraft] = useState(() => ({ key, value: readDraft(key, initial) }));
  const [stored, setStored] = useState(true);
  const value = draft.key === key ? draft.value : readDraft(key, initial);
  useEffect(() => {
    setDraft((current) =>
      current.key === key ? current : { key, value: readDraft(key, initial) },
    );
  }, [key]);
  const update = useCallback(
    (next: T) => {
      setDraft({ key, value: next });
      memoryDrafts.set(key, next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
        setStored(true);
      } catch {
        setStored(false);
      }
    },
    [key],
  );
  return [value, update, stored] as const;
}
