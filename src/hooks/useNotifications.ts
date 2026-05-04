import { useState, useEffect, useCallback } from 'react';

interface PushSubscription {
  id: string;
  endpoint: string;
  user_agent: string;
  subscribed_at: number;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  tag?: string;
  icon_url?: string;
  badge_url?: string;
  related_user_id?: string;
  sent_at: number;
  read_at?: number;
}

export function useNotifications() {
  const [subscriptions, setSubscriptions] = useState<PushSubscription[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(false);

  // Check notification permission status
  useEffect(() => {
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  // Fetch existing subscriptions
  const fetchSubscriptions = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/subscriptions');
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data.subscriptions);
      }
    } catch (err) {
      console.error('Failed to fetch subscriptions:', err);
    }
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async (unreadOnly = false) => {
    try {
      const params = new URLSearchParams();
      if (unreadOnly) params.set('unread_only', 'true');
      params.set('limit', '50');

      const res = await fetch(`/api/notifications?${params}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
        setUnreadCount(data.notifications.filter((n: Notification) => !n.read_at).length);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, []);

  // Request notification permission and subscribe
  const requestPermissionAndSubscribe = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('Notifications not supported');
      return false;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported');
      return false;
    }

    setIsLoading(true);
    try {
      // Request permission
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);

      if (permission !== 'granted') {
        console.log('Notification permission denied');
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Fetch VAPID public key from server
      let vapidPublicKey: string | null = null;
      try {
        const keyRes = await fetch('/api/notifications/vapid-public-key');
        if (keyRes.ok) {
          const keyData = await keyRes.json();
          vapidPublicKey = keyData.vapidPublicKey;
        }
      } catch {
        // Proceed without VAPID key — browser will still subscribe but without applicationServerKey
      }

      const subscriptionOptions: PushSubscriptionOptionsInit = {
        userVisibleOnly: true,
      };

      if (vapidPublicKey) {
        // Convert base64url to Uint8Array for applicationServerKey
        const padding = '='.repeat((4 - (vapidPublicKey.length % 4)) % 4);
        const base64 = (vapidPublicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawKey = atob(base64);
        subscriptionOptions.applicationServerKey = Uint8Array.from(rawKey, (c) =>
          c.charCodeAt(0),
        );
      }

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe(subscriptionOptions);

      // Send subscription to server
      const subscriptionJson = subscription.toJSON();
      const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          auth_key: subscriptionJson.keys?.auth,
          p256dh_key: subscriptionJson.keys?.p256dh,
          userAgent: navigator.userAgent,
        }),
      });

      if (res.ok) {
        await fetchSubscriptions();
        return true;
      } else {
        console.error('Failed to subscribe:', await res.text());
        return false;
      }
    } catch (err) {
      console.error('Failed to request permission or subscribe:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchSubscriptions]);

  // Unsubscribe from push notifications
  const unsubscribeFromPush = useCallback(async (endpoint: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });

      if (res.ok) {
        await fetchSubscriptions();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to unsubscribe:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchSubscriptions]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      await fetchNotifications(false);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, [fetchNotifications]);

  return {
    subscriptions,
    notifications,
    unreadCount,
    permissionStatus,
    isLoading,
    fetchSubscriptions,
    fetchNotifications,
    requestPermissionAndSubscribe,
    unsubscribeFromPush,
    markAsRead,
  };
}
