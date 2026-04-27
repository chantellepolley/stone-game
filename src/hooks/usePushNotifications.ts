import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const VAPID_PUBLIC_KEY = 'BCA5egHrzIzUF8wYUNGa0eBLcUW6cq-1D6jL8SLK_vMFX7rArVtLdfAfxfVfBMBVvfVeekeA46fCJqwyKRdACEk';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [supported] = useState(
    typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
  );

  // Register service worker on mount
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    try {
      const reg = await navigator.serviceWorker.ready;
      // Check if already subscribed
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as ArrayBuffer,
        });
      }

      // Save subscription to Supabase
      const token = localStorage.getItem('stone_device_token');
      if (!token) return false;

      const { data: player } = await supabase
        .from('players')
        .select('id')
        .eq('device_token', token)
        .single();

      if (!player) return false;

      const subJson = sub.toJSON();
      await supabase.from('push_subscriptions').upsert({
        player_id: player.id,
        endpoint: sub.endpoint,
        keys: subJson.keys,
      }, { onConflict: 'player_id,endpoint' });

      return true;
    } catch (err) {
      console.error('[STONE] Push subscribe failed:', err);
      return false;
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!supported) return false;
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm === 'granted') {
        // Actually subscribe to push
        await subscribe();
      }
      return perm === 'granted';
    } catch {
      return false;
    }
  }, [supported, subscribe]);

  // If permission was already granted (from a previous session), ensure subscription is saved
  useEffect(() => {
    if (supported && permission === 'granted') {
      subscribe();
    }
  }, [supported, permission, subscribe]);

  return { supported, permission, requestPermission, subscribe };
}

/** Show a system notification (works when app is open or recently backgrounded) */
export function showNotification(title: string, body: string, tag = 'stone-notification') {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  // Use service worker registration if available (works when backgrounded)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        body,
        icon: '/app-icon.png',
        badge: '/favicon.png',
        tag,
        data: { url: '/' },
      } as NotificationOptions);
    }).catch(() => {
      // Fallback to regular notification
      new Notification(title, { body, icon: '/app-icon.png', tag });
    });
  } else {
    new Notification(title, { body, icon: '/app-icon.png', tag });
  }
}

/** Send a server-side push notification via Supabase Edge Function */
export async function sendPushNotification(
  playerId: string,
  title: string,
  body: string,
  tag = 'stone-notification',
  url = '/'
) {
  try {
    await fetch(
      'https://tabsvmsnkdltuzenhgkw.supabase.co/functions/v1/send-push',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhYnN2bXNua2RsdHV6ZW5oZ2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMDgzMTYsImV4cCI6MjA5MTg4NDMxNn0.jHLlIj_u998taHN-Qo4zp_ivjQi6UDA11kiKeqQ48Rc`,
        },
        body: JSON.stringify({ playerId, title, body, tag, url }),
      }
    );
  } catch (err) {
    console.error('[STONE] Failed to send push notification:', err);
  }
}
