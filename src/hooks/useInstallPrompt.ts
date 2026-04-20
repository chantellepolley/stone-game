import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(() =>
    localStorage.getItem('stone_install_dismissed') === '1'
  );

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // iOS doesn't fire beforeinstallprompt — detect Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    if (isIOS && isSafari) {
      // Can't auto-prompt on iOS, but we can show instructions
      setDeferredPrompt(null);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  const dismissBanner = () => {
    setBannerDismissed(true);
    localStorage.setItem('stone_install_dismissed', '1');
  };

  // Can we show the native install prompt?
  const canInstall = !!deferredPrompt && !isInstalled;

  // Should we show instructions for iOS?
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const showIOSInstructions = isIOS && !isInstalled;

  return {
    canInstall,
    isInstalled,
    install,
    showIOSInstructions,
    bannerDismissed,
    dismissBanner,
  };
}
