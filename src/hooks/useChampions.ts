import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

let cachedChampionId: string | null = null;
let cacheLoaded = false;

/** Returns the player ID of the most recent POTM champion (only the reigning champion gets the crown) */
export function useChampions() {
  const [championIds, setChampionIds] = useState<Set<string>>(cachedChampionId ? new Set([cachedChampionId]) : new Set());

  useEffect(() => {
    if (cacheLoaded) return;
    cacheLoaded = true;
    supabase.from('champions').select('player_id').order('month', { ascending: false }).limit(1).then(({ data }) => {
      if (data && data.length > 0) {
        cachedChampionId = data[0].player_id;
        setChampionIds(new Set([data[0].player_id]));
      }
    });
  }, []);

  return championIds;
}
