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

const BLOCKED_WORDS = ['fuck','shit','ass','bitch','dick','cock','pussy','nigger','nigga','faggot','retard','cunt','whore','slut'];
function containsProfanity(name: string): boolean {
  const lower = name.toLowerCase().replace(/[^a-z]/g, '');
  return BLOCKED_WORDS.some(w => lower.includes(w));
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'stone_salt_2026');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
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

  const createPlayer = useCallback(async (username: string, password?: string): Promise<string | true> => {
    if (containsProfanity(username)) {
      return 'That username is not allowed. Please choose a different name.';
    }

    // Check if username already exists
    const { data: existing } = await supabase
      .from('players')
      .select('id')
      .ilike('username', username)
      .limit(1);

    if (existing && existing.length > 0) {
      return 'Username already taken. Please log in or choose a different name.';
    }

    const token = generateDeviceToken();

    const { data, error } = await supabase
      .from('players')
      .insert({ username, device_token: token, ...(password ? { password: await hashPassword(password) } : {}) })
      .select()
      .single();

    if (data && !error) {
      localStorage.setItem('stone_device_token', token);
      setPlayer({ id: data.id, username: data.username, deviceToken: token, avatarUrl: null });

      // Create stats row
      await supabase.from('player_stats').insert({ player_id: data.id });

      return true;
    }
    return 'Could not create account. Try again.';
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
    // Case-insensitive username lookup
    const { data: matches, error: lookupErr } = await supabase
      .from('players')
      .select('*')
      .ilike('username', username);

    if (lookupErr || !matches || matches.length === 0) return 'Player not found';

    // If multiple matches, prefer exact match or the one with a password set
    const data = matches.find(m => m.password) || matches[0];

    if (!data.password) return 'This account has no password. Please log in on your original device and set a password first.';
    const hashed = await hashPassword(password);
    // Support both hashed and legacy plaintext passwords
    if (data.password !== hashed && data.password !== password) return 'Incorrect password';
    // If matched plaintext, upgrade to hashed
    if (data.password === password && data.password !== hashed) {
      await supabase.from('players').update({ password: hashed }).eq('id', data.id);
    }

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
    const hashed = await hashPassword(newPassword);
    const { error } = await supabase
      .from('players')
      .update({ password: hashed })
      .eq('id', player.id);
    return !error;
  }, [player]);

  return { player, isLoading, createPlayer, updateUsername, updateAvatar, login, logout, updatePassword };
}
