import { useEffect, useState } from 'react';
import type { WxtStorageItem } from 'wxt/utils/storage';

export function useItem<T, M extends Record<string, unknown> = {}>(
  item: WxtStorageItem<T, M>,
): [T, (v: T) => Promise<void>, boolean] {
  const [value, setValue] = useState(item.fallback),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    item.getValue().then((v) => {
      setValue(v);
      setLoaded(true);
    });
    return item.watch(setValue);
  }, [item]);
  return [value, item.setValue, loaded];
}
