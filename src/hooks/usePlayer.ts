import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Player {
  id: string;
  username: string;
  deviceToken: string;
  avatarUrl: string | null;
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
        setPlayer({ id: data.id, username: data.username, deviceToken: data.device_token, avatarUrl: data.avatar_url || null });
      } else {
        // Token exists but player not found — clear it
        localStorage.removeItem('stone_device_token');
      }
      setIsLoading(false);
    };

    loadPlayer();
  }, []);

  const createPlayer = useCallback(async (username: string, password?: string): Promise<boolean> => {
    const token = generateDeviceToken();

    const { data, error } = await supabase
      .from('players')
      .insert({ username, device_token: token, ...(password ? { password } : {}) })
      .select()
      .single();

    if (data && !error) {
      localStorage.setItem('stone_device_token', token);
      setPlayer({ id: data.id, username: data.username, deviceToken: token, avatarUrl: null });

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

  const updateAvatar = useCallback(async (file: File): Promise<boolean> => {
    if (!player) return false;

    // Validate file
    if (!file.type.startsWith('image/')) return false;
    if (file.size > 5 * 1024 * 1024) return false; // 5MB max

    const ext = file.name.split('.').pop() || 'jpg';
    const filePath = `${player.id}.${ext}`;

    // Upload to Supabase Storage (overwrite if exists)
    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadErr) {
      console.error('[STONE] Avatar upload failed:', uploadErr.message);
      return false;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    const avatarUrl = urlData.publicUrl + `?t=${Date.now()}`; // cache-bust

    // Update player record
    const { error: updateErr } = await supabase
      .from('players')
      .update({ avatar_url: avatarUrl })
      .eq('id', player.id);

    if (updateErr) {
      console.error('[STONE] Avatar URL update failed:', updateErr.message);
      return false;
    }

    setPlayer(prev => prev ? { ...prev, avatarUrl } : null);
    return true;
  }, [player]);

  const login = useCallback(async (username: string, password: string): Promise<string | true> => {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !data) return 'Player not found';
    if (!data.password) return 'No password set for this account';
    if (data.password !== password) return 'Incorrect password';

    // Update device token to this device
    const token = generateDeviceToken();
    await supabase.from('players').update({ device_token: token }).eq('id', data.id);

    localStorage.setItem('stone_device_token', token);
    setPlayer({ id: data.id, username: data.username, deviceToken: token, avatarUrl: data.avatar_url || null });
    return true;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('stone_device_token');
    localStorage.removeItem('stone_active_game');
    setPlayer(null);
  }, []);

  const updatePassword = useCallback(async (newPassword: string): Promise<boolean> => {
    if (!player) return false;
    const { error } = await supabase
      .from('players')
      .update({ password: newPassword })
      .eq('id', player.id);
    return !error;
  }, [player]);

  return { player, isLoading, createPlayer, updateUsername, updateAvatar, login, logout, updatePassword };
}
