import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useState } from 'react';
import { listTrips } from '../data/tripRepo';
import type { Trip } from '../domain/types';

const STORAGE_KEY = 'trip-wallet:active-trip';

// Safari のプライベートモードでは localStorage が例外を投げることがある
function readStoredTripId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeTripId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // 保存できなくても動作は続ける
  }
}

/** 保存された旅行が削除されていたら先頭(いちばん新しい旅行)に落とす。 */
export function pickActiveTrip(trips: Trip[], storedId: string | null): Trip | null {
  if (trips.length === 0) return null;
  return trips.find((t) => t.id === storedId) ?? trips[0];
}

export function useActiveTrip(): {
  trips: Trip[];
  activeTrip: Trip | null;
  loading: boolean;
  selectTrip: (id: string) => void;
} {
  const trips = useLiveQuery(() => listTrips(), []);
  const [storedId, setStoredId] = useState<string | null>(() => readStoredTripId());

  const selectTrip = useCallback((id: string) => {
    storeTripId(id);
    setStoredId(id);
  }, []);

  const loading = trips === undefined;
  const activeTrip = loading ? null : pickActiveTrip(trips, storedId);

  useEffect(() => {
    if (activeTrip && activeTrip.id !== storedId) selectTrip(activeTrip.id);
  }, [activeTrip, storedId, selectTrip]);

  return { trips: trips ?? [], activeTrip, loading, selectTrip };
}
