import { useState, useEffect, useCallback } from 'react';

export type NotificationPermission = 'default' | 'granted' | 'denied';

interface PushNotificationState {
  permission: NotificationPermission;
  isSupported: boolean;
  isEnabled: boolean;
  serviceWorkerReady: boolean;
}

interface UsePushNotificationsReturn extends PushNotificationState {
  requestPermission: () => Promise<boolean>;
  sendNotification: (title: string, options?: NotificationOptions & { type?: string; alertId?: string; resource?: string }) => void;
  toggleEnabled: () => void;
}

const STORAGE_KEY = 'devops-push-notifications-enabled';

export function usePushNotifications(): UsePushNotificationsReturn {
  const [state, setState] = useState<PushNotificationState>({
    permission: 'default',
    isSupported: false,
    isEnabled: false,
    serviceWorkerReady: false,
  });

  // Check if notifications are supported
  useEffect(() => {
    const isSupported = 'Notification' in window && 'serviceWorker' in navigator;
    const savedEnabled = localStorage.getItem(STORAGE_KEY) === 'true';
    
    setState(prev => ({
      ...prev,
      isSupported,
      permission: isSupported ? (Notification.permission as NotificationPermission) : 'denied',
      isEnabled: savedEnabled && Notification.permission === 'granted',
    }));

    // Register service worker
    if (isSupported) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('[Push] Service Worker registered:', registration.scope);
          setState(prev => ({ ...prev, serviceWorkerReady: true }));
        })
        .catch((error) => {
          console.error('[Push] Service Worker registration failed:', error);
        });
    }
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      console.warn('[Push] Notifications not supported');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      
      setState(prev => ({
        ...prev,
        permission: permission as NotificationPermission,
        isEnabled: granted,
      }));

      if (granted) {
        localStorage.setItem(STORAGE_KEY, 'true');
      }

      return granted;
    } catch (error) {
      console.error('[Push] Permission request failed:', error);
      return false;
    }
  }, [state.isSupported]);

  // Send notification via Service Worker
  const sendNotification = useCallback((
    title: string,
    options?: NotificationOptions & { type?: string; alertId?: string; resource?: string }
  ) => {
    if (!state.isEnabled || !state.serviceWorkerReady) {
      console.log('[Push] Notifications disabled or SW not ready');
      return;
    }

    navigator.serviceWorker.ready.then((registration) => {
      // Send message to service worker to show notification
      if (registration.active) {
        registration.active.postMessage({
          type: 'SHOW_NOTIFICATION',
          title,
          body: options?.body || '',
          alertType: options?.type || 'info',
          alertId: options?.alertId,
          resource: options?.resource,
        });
      }
    });
  }, [state.isEnabled, state.serviceWorkerReady]);

  // Toggle notifications enabled/disabled
  const toggleEnabled = useCallback(() => {
    if (state.permission !== 'granted') {
      requestPermission();
      return;
    }

    const newEnabled = !state.isEnabled;
    setState(prev => ({ ...prev, isEnabled: newEnabled }));
    localStorage.setItem(STORAGE_KEY, String(newEnabled));
  }, [state.permission, state.isEnabled, requestPermission]);

  return {
    ...state,
    requestPermission,
    sendNotification,
    toggleEnabled,
  };
}
