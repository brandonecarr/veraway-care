'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export type PushPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

interface UsePushNotificationsReturn {
  permission: PushPermissionState;
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  requestPermission: () => Promise<boolean>;
  subscribeToPush: () => Promise<boolean>;
  unsubscribeFromPush: () => Promise<boolean>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [permission, setPermission] = useState<PushPermissionState>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const supported = 
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;
      
      setIsSupported(supported);
      
      if (supported) {
        setPermission(Notification.permission as PushPermissionState);
        await checkSubscriptionStatus();
      } else {
        setPermission('unsupported');
        setIsLoading(false);
      }
    };
    
    init();
  }, []);

  const checkSubscriptionStatus = async () => {
    try {
      // Check if service worker is registered before trying to access it
      const existingReg = await navigator.serviceWorker.getRegistration('/');
      if (!existingReg) {
        setIsSubscribed(false);
        setIsLoading(false);
        return;
      }
      
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      // Silently fail - push notifications may not be available
      setIsSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  };

  const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
    try {
      // Check for existing registration first
      let registration = await navigator.serviceWorker.getRegistration('/');
      
      if (registration) {
        console.log('Service Worker already registered:', registration);
        // Check if there's an update waiting
        if (registration.waiting) {
          console.log('Service Worker update waiting, activating...');
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      } else {
        registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });
        console.log('Service Worker registered:', registration);
      }
      
      // Wait for the service worker to be ready and active
      if (registration.installing) {
        console.log('Service Worker installing...');
        await new Promise<void>((resolve) => {
          registration!.installing!.addEventListener('statechange', (e) => {
            if ((e.target as ServiceWorker).state === 'activated') {
              console.log('Service Worker activated');
              resolve();
            }
          });
        });
      } else if (registration.waiting) {
        console.log('Service Worker waiting...');
        // Skip waiting and activate immediately
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        await new Promise<void>((resolve) => {
          registration!.waiting!.addEventListener('statechange', (e) => {
            if ((e.target as ServiceWorker).state === 'activated') {
              console.log('Service Worker activated');
              resolve();
            }
          });
          // Timeout fallback
          setTimeout(resolve, 1000);
        });
      }
      
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      toast.error('Failed to register service worker');
      return null;
    }
  };

  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) {
      toast.error('Push notifications are not supported in this browser');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result as PushPermissionState);
      
      if (result === 'granted') {
        toast.success('Notification permission granted');
        return true;
      } else if (result === 'denied') {
        toast.error('Notification permission denied');
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error requesting permission:', error);
      toast.error('Failed to request notification permission');
      return false;
    }
  };

  const subscribeToPush = async (): Promise<boolean> => {
    if (!isSupported) {
      toast.error('Push notifications are not supported');
      return false;
    }

    if (permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) return false;
    }

    try {
      setIsLoading(true);

      // Register service worker if not already registered
      let registration = await registerServiceWorker();
      if (!registration) return false;

      // Wait for service worker to be ready and active
      console.log('Waiting for service worker to be ready...');
      const activeRegistration = await navigator.serviceWorker.ready;
      console.log('Service worker ready:', activeRegistration);
      
      // Ensure the service worker is in the active state
      if (activeRegistration.active?.state !== 'activated') {
        console.log('Service worker state:', activeRegistration.active?.state);
        // Wait a bit for it to fully activate
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Get VAPID public key from server
      const response = await fetch('/api/push/vapid-key');
      if (!response.ok) {
        throw new Error('Failed to get VAPID key');
      }
      const { publicKey } = await response.json();

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Send subscription to server
      const saveResponse = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save subscription');
      }

      setIsSubscribed(true);
      toast.success('Push notifications enabled');
      return true;
    } catch (error) {
      // Only show error toast if it's a user-initiated action, not automatic check
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (!errorMessage.includes('Load failed')) {
        toast.error('Failed to enable push notifications');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribeFromPush = async (): Promise<boolean> => {
    try {
      setIsLoading(true);

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();

        // Remove subscription from server
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        setIsSubscribed(false);
        toast.success('Push notifications disabled');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      toast.error('Failed to disable push notifications');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    permission,
    isSupported,
    isSubscribed,
    isLoading,
    requestPermission,
    subscribeToPush,
    unsubscribeFromPush,
  };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
