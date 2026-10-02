import { Capacitor } from '@capacitor/core';

/**
 * Checks whether the application is running inside native Capacitor environment.
 */
export const isCapacitorNative = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

/**
 * Specifically detects if running inside the Android Capacitor APK.
 * Returns false when running in Web browser or as an installed PWA.
 */
export const isCapacitorAndroid = (): boolean => {
  try {
    if (typeof window === 'undefined') return false;

    // Direct Capacitor official platform check
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      return true;
    }

    // Secondary fallback check via global Capacitor object in WebView
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor;
    if (cap?.isNativePlatform?.() && cap?.getPlatform?.() === 'android') {
      return true;
    }

    return false;
  } catch {
    return false;
  }
};

/**
 * Initializes Capacitor runtime customizations.
 * Adds 'capacitor-android' class to <html> when running inside the Android APK.
 */
export const initCapacitorApp = (): void => {
  if (typeof window === 'undefined') return;

  try {
    if (isCapacitorAndroid()) {
      document.documentElement.classList.add('capacitor-android');
      document.documentElement.setAttribute('data-platform', 'capacitor-android');
    }
  } catch (err) {
    console.warn('Failed to initialize Capacitor platform detection:', err);
  }
};
