import { useRegisterSW } from 'virtual:pwa-register/react';

export function usePwaUpdate(): { needRefresh: boolean; updateApp: () => void } {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({});

  return {
    needRefresh,
    updateApp: () => {
      void updateServiceWorker(true);
    },
  };
}

/**
 * ストレージの永続化を要求する。
 * iOS Safari は 7 日間使われないサイトのデータを消すことがあるため、
 * 起動時に一度だけ要求しておく。拒否されても動作は変わらない。
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
