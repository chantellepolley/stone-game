import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Player {
  id: string;
  username: string;
  deviceToken: string;
}

function generateDeviceToken(): string {
  return 'dev_' + crypto.randomUUID();
}

export function usePlayer() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: check localStorage for existing device token
  useEffect(() => {
    const loadPlayer = async () => {
      const token = localStorage.getItem('stone_device_token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('device_token', token)
        .single();

      if (data && !error) {
        setPlayer({ id: data.id, username: data.username, deviceToken: data.device_token });
      } else {
        // Token exists but player not found — clear it
        localStorage.removeItem('stone_device_token');
      }
      setIsLoading(false);
    };

    loadPlayer();
  }, []);

  const createPlayer = useCallback(async (username: string): Promise<boolean> => {
    const token = generateDeviceToken();

    const { data, error } = await supabase
      .from('players')
      .insert({ username, device_token: token })
      .select()
      .single();

    if (data && !error) {
      localStorage.setItem('stone_device_token', token);
      setPlayer({ id: data.id, username: data.username, deviceToken: token });

      // Create stats row
      await supabase.from('player_stats').insert({ player_id: data.id });

      return true;
    }
    return false;
  }, []);

  const updateUsername = useCallback(async (newUsername: string): Promise<boolean> => {
    if (!player) return false;

    const { error } = await supabase
      .from('players')
      .update({ username: newUsername })
      .eq('id', player.id);

    if (!error) {
      setPlayer(prev => prev ? { ...prev, username: newUsername } : null);
      return true;
    }
    return false;
  }, [player]);

  return { player, isLoading, createPlayer, updateUsername };
}
