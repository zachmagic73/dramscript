# Push Notifications Implementation for Dramscript

## Overview

Push notifications have been added to the Dramscript app to notify users when:
1. They receive a new friend request
2. Someone accepts their friend request

The implementation uses the Web Push API with service workers for the frontend, and Cloudflare Workers for the backend.

## Components

### 1. Database Schema (`add-push-notifications.sql`)

Two new tables are created:

#### `push_subscriptions`
Stores device push subscriptions for each user.
- `id`: UUID
- `user_id`: Foreign key to users
- `endpoint`: Push service endpoint (unique)
- `auth_key`: Authentication key for push encryption
- `p256dh_key`: ECDH public key for push encryption
- `user_agent`: Browser/device identifier
- `subscribed_at`: Timestamp of subscription

#### `notifications`
Audit log of all notifications sent to users.
- `id`: UUID
- `user_id`: Recipient user ID
- `type`: Notification type ('friend_request_received', 'friend_request_accepted')
- `title`: Notification title
- `body`: Notification body/message
- `tag`: Notification tag for grouping similar notifications
- `icon_url`: Icon URL
- `badge_url`: Badge icon URL
- `related_user_id`: Foreign key to the user who triggered the notification
- `data`: JSON object with additional data
- `sent_at`: Timestamp when sent
- `read_at`: Timestamp when marked as read (null if unread)

### 2. Backend API Endpoints (`worker/notifications.ts`)

Added to `/api/notifications/*`:

#### `POST /api/notifications/subscribe`
Register a device for push notifications.
```json
Request:
{
  "endpoint": "https://fcm.googleapis.com/...",
  "auth_key": "...",
  "p256dh_key": "...",
  "userAgent": "Mozilla/5.0..."
}

Response:
{
  "id": "subscription-uuid",
  "subscribed": true
}
```

#### `POST /api/notifications/unsubscribe`
Remove a device from push notifications.
```json
Request:
{ "endpoint": "https://fcm.googleapis.com/..." }

Response:
{ "deleted": true }
```

#### `GET /api/notifications/subscriptions`
Get all push subscriptions for the current user.
```json
Response:
{
  "subscriptions": [
    {
      "id": "...",
      "endpoint": "...",
      "user_agent": "...",
      "subscribed_at": 1234567890
    }
  ]
}
```

#### `GET /api/notifications`
Get notification history with pagination and filtering.
```
Query params:
- limit: 1-100 (default 20)
- unread_only: true/false (default false)

Response:
{
  "notifications": [
    {
      "id": "...",
      "type": "friend_request_received",
      "title": "New Friend Request",
      "body": "John Smith sent you a friend request",
      "tag": "friend_request_...",
      "sent_at": 1234567890,
      "read_at": null,
      "related_user_id": "..."
    }
  ]
}
```

#### `PATCH /api/notifications/:id/read`
Mark a notification as read.
```json
Response:
{ "id": "notification-uuid", "read": true }
```

### 3. Service Worker Updates (`public/sw.js`)

Added two event listeners:

#### `push` event listener
Displays the notification when a push message arrives from the server.
- Extracts title, body, icon, badge from push payload
- Shows notification with `registration.showNotification()`
- Automatically adds Open/Close action buttons

#### `notificationclick` event listener
Handles user clicks on notifications.
- Focuses existing app window if open
- Otherwise opens a new window to the app
- Routes to the URL specified in notification data (`action_url` field)

### 4. React Hooks (`src/hooks/useNotifications.ts`)

The `useNotifications()` hook provides:

```typescript
const {
  subscriptions,              // Current push subscriptions
  notifications,              // Notification history
  unreadCount,               // Number of unread notifications
  permissionStatus,          // 'default' | 'granted' | 'denied'
  isLoading,                 // Loading state
  fetchSubscriptions,        // Refresh subscriptions list
  fetchNotifications,        // Refresh notification history
  requestPermissionAndSubscribe,  // Request permission & subscribe
  unsubscribeFromPush,       // Remove a subscription
  markAsRead,                // Mark notification as read
} = useNotifications();
```

Usage:
```typescript
import { useNotifications } from '../hooks/useNotifications';

function MyComponent() {
  const { notifications, unreadCount, requestPermissionAndSubscribe } = useNotifications();
  
  return (
    <>
      <Badge badgeContent={unreadCount}>
        <NotificationsIcon />
      </Badge>
      <Button onClick={requestPermissionAndSubscribe}>Enable Notifications</Button>
    </>
  );
}
```

### 5. React Components

#### `NotificationPermissionPrompt` (`src/components/NotificationPermissionPrompt.tsx`)
Shows a banner prompting users to enable notifications if they haven't already.
- Appears automatically on first load if permission is 'default'
- Can be dismissed
- Only shows once per session (configurable)

#### `NotificationCenter` (`src/components/NotificationCenter.tsx`)
Displays a popover with notification history and unread count badge.
- Shows as an icon button with notification count badge
- Popover displays:
  - Recent notifications (up to 50)
  - Unread indicator for each notification
  - Timestamp (in relative format like "5m ago")
  - Quick action buttons (e.g., "View Request" for friend requests)
- Auto-refreshes every 30 seconds
- Clicking a notification marks it as read

### 6. Integration with Friends System

Two functions in `worker/friends.ts` trigger notifications:

#### `sendFriendRequest()`
When a user sends a friend request:
1. Creates friendship record with status 'pending'
2. Calls `sendPushNotificationToUser()` on the recipient
3. Sends notification with type `friend_request_received`
4. Title: "New Friend Request"
5. Body: "{requester_name} sent you a friend request"
6. Action URL: `/friends`

#### `acceptFriendRequest()`
When a user accepts a friend request:
1. Updates friendship status to 'accepted'
2. Calls `sendPushNotificationToUser()` on the requester
3. Sends notification with type `friend_request_accepted`
4. Title: "Friend Request Accepted"
5. Body: "{acceptee_name} accepted your friend request"
6. Action URL: `/friends`

### 7. Internal Notification Service

The `sendPushNotificationToUser()` function in `notifications.ts`:
- Saves notification to DB for audit/history
- Queries all push subscriptions for the user
- (TODO) Sends encrypted push message to each subscription via Web Push Protocol

## Setup Instructions

### 1. Run Database Migration

```powershell
# Local development
npx wrangler d1 execute dramscript-db --local --file=./add-push-notifications.sql

# Production
npx wrangler d1 execute dramscript-db --remote --file=./add-push-notifications.sql --yes
```

### 2. Update Layout Component

The `NotificationCenter` and `NotificationPermissionPrompt` components are already integrated into `src/components/Layout.tsx`. No additional setup needed.

### 3. Configure VAPID Keys (for Production)

Web Push requires a VAPID key pair for authentication. In production:

1. Generate VAPID keys:
   ```bash
   npm install -g web-push
   web-push generate-vapid-keys
   ```

2. Add to Cloudflare Worker secrets:
   ```powershell
   npx wrangler secret put VAPID_PUBLIC_KEY
   npx wrangler secret put VAPID_PRIVATE_KEY
   ```

3. Update `src/hooks/useNotifications.ts` to fetch VAPID public key from server:
   ```typescript
   const res = await fetch('/api/config/vapid-public-key');
   const { vapidPublicKey } = await res.json();
   subscriptionOptions.applicationServerKey = vapidPublicKey;
   ```

4. Add endpoint to worker to serve public VAPID key (unauth):
   ```typescript
   if (pathname === '/api/config/vapid-public-key') {
     return json({ vapidPublicKey: env.VAPID_PUBLIC_KEY });
   }
   ```

### 4. Implement Web Push Sending (TODO)

Currently, `sendPushNotificationToUser()` logs notifications to DB but doesn't actually send push messages. To enable:

1. Install web-push library in worker project:
   ```bash
   npm install web-push
   ```

2. Update `notifications.ts` to send push:
   ```typescript
   import * as webpush from 'web-push';

   webpush.setVapidDetails(
     'mailto:your-email@example.com',
     env.VAPID_PUBLIC_KEY,
     env.VAPID_PRIVATE_KEY
   );

   for (const sub of subscriptions.results) {
     try {
       await webpush.sendNotification({
         endpoint: sub.endpoint,
         keys: {
           auth: sub.auth_key,
           p256dh: sub.p256dh_key,
         }
       }, JSON.stringify(payload));
     } catch (err) {
       console.error(`Failed to send push:`, err);
     }
   }
   ```

## User Flow

1. **User opens app** → `NotificationPermissionPrompt` appears
2. **User clicks "Enable"** → Browser requests notification permission
3. **Permission granted** → `useNotifications.requestPermissionAndSubscribe()` triggers:
   - Service worker subscription created
   - Subscription endpoint sent to `/api/notifications/subscribe`
   - User subscribed and ready to receive notifications
4. **Friend request sent to user** → Backend calls `sendPushNotificationToUser()`:
   - Notification saved to DB
   - Push message sent to all device subscriptions (when Web Push is implemented)
   - Browser displays notification
5. **User clicks notification** → Service worker handles click:
   - App window focused or opened
   - Routes to `/friends` page
6. **User open notification in NotificationCenter** → Marked as read via `/api/notifications/:id/read`

## Browser Support

Web Push Notifications are supported in:
- Chrome/Edge 50+
- Firefox 48+
- Safari 16+ (macOS/iOS)
- Opera 37+

Gracefully degrades in older browsers or if permission is denied.

## Testing Locally

1. Start dev server:
   ```powershell
   npm run wrangler:dev  # In another terminal
   npm run dev           # In another terminal
   ```

2. Open `http://localhost:5175`
3. Allow notifications when prompted
4. Open DevTools → Application → Service Workers (verify registered)
5. Send yourself a friend request from another account/session
6. Check for notification

To simulate a push notification locally (without real Web Push):
```javascript
// In browser DevTools console
navigator.serviceWorker.controller.postMessage({
  type: 'FAKE_PUSH',
  data: {
    title: 'Test Notification',
    body: 'This is a test',
  }
});
```

## Future Enhancements

- [ ] Implement actual Web Push Protocol sending via `web-push` library
- [ ] Add notification preferences/settings (opt-out by type)
- [ ] Add in-app notification bell with unread badges
- [ ] Support additional notification types (new followers, comments, etc.)
- [ ] Add notification sound/vibration options
- [ ] Implement notification expiry (auto-archive after 30 days)
- [ ] Add push notification analytics

## Troubleshooting

### Notifications not appearing
- Check if service worker is registered: DevTools → Application → Service Workers
- Check if VAPID public key is configured
- Check browser console for errors
- Verify `push_subscriptions` table has entries

### Old notifications showing "Service Worker Error"
- Service worker code was updated; clear cache and re-register
- Restart browser and re-enable notifications

### CORS errors when subscribing
- Ensure notification endpoints are same-origin
- Check HTTPS is enabled (required for Web Push in production)

