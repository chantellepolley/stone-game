import { useState, useEffect, useCallback } from 'react';

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [supported] = useState(
    typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator
  );

  // Register service worker on mount
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!supported) return false;
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      return perm === 'granted';
    } catch {
      return false;
    }
  }, [supported]);

  return { supported, permission, requestPermission };
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
