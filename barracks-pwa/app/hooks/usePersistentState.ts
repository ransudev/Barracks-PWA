import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

export function usePersistentState<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loadStoredValue = () => {
      try {
        const stored = window.localStorage.getItem(key);
        if (stored) setValue(JSON.parse(stored) as T);
      } catch {
        // Keep the in-memory value when browser storage is unavailable or invalid.
      } finally {
        setHydrated(true);
      }
    };
    const loadTimer = window.setTimeout(loadStoredValue, 0);
    return () => window.clearTimeout(loadTimer);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Keep the interaction usable when browser storage is unavailable.
    }
  }, [hydrated, key, value]);

  return [value, setValue];
}
