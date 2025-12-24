# Push Notifications Setup

## Overview
Phase 9 implements browser push notifications for critical alerts in the Care Coordination platform.

## Features Implemented

### 1. Service Worker (`public/sw.js`)
- Handles push notification events
- Displays notifications with custom icons and actions
- Manages notification clicks and opens relevant dashboard pages
- Supports different priority levels (normal, urgent, critical)

### 2. Push Notification Hook (`src/hooks/use-push-notifications.tsx`)
- Manages push notification permissions
- Handles service worker registration
- Subscribes/unsubscribes from push notifications
- Converts VAPID keys for browser compatibility

### 3. Notification Preferences Component
- Enhanced UI showing push notification status
- Visual badges for: Not Supported, Blocked, Active
- Test notification button for subscribed users
- Integration with push notification permissions

### 4. Database Schema
- `push_subscriptions` table stores browser subscription data
- Includes endpoint, encryption keys, and subscription metadata
- Row-level security ensures users only access their own subscriptions

### 5. API Routes
- `/api/push/vapid-key` - Returns public VAPID key
- `/api/push/subscribe` - Saves push subscription to database
- `/api/push/unsubscribe` - Removes push subscription
- `/api/push/test` - Sends test notification
- `/api/push/send` - Sends push notification for a specific notification

### 6. Real-time Integration
- Automatically sends push notifications when new notifications are created
- Triggered via database function and real-time hook
- Priority levels: normal, urgent, critical

## Setup Instructions

### 1. Generate VAPID Keys

```bash
node scripts/generate-vapid-keys.js
```

This will output three environment variables that need to be added to your project.

### 2. Add Environment Variables

Add these to your project settings (not to `.env` file):

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY="your-public-key-here"
VAPID_PRIVATE_KEY="your-private-key-here"
VAPID_SUBJECT="mailto:admin@carecoordination.app"
```

**Important:** 
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` must start with `NEXT_PUBLIC_` to be accessible in the browser
- `VAPID_PRIVATE_KEY` should NEVER be committed to git or exposed to the client
- `VAPID_SUBJECT` should be a valid mailto: URL or https: URL

### 3. Browser Requirements

Push notifications require:
- HTTPS (or localhost for development)
- Modern browser with Push API support:
  - Chrome/Edge 50+
  - Firefox 44+
  - Safari 16+ (macOS Ventura or later)
  - Opera 37+

### 4. Testing Push Notifications

1. Navigate to **Settings → Notifications**
2. Enable "Push Notifications" toggle
3. Grant browser permission when prompted
4. Click "Test Push Notification" button
5. You should receive a test notification

### 5. Notification Priority Levels

- **Normal**: Standard notifications (assignments, messages)
- **Urgent**: High-priority issues (urgent assignments, pain management)
- **Critical**: Critical alerts (overdue issues, system-wide alerts)
  - These require user interaction to dismiss
  - Include vibration pattern

## User Flow

1. User enables push notifications in settings
2. Browser requests permission (one-time)
3. Service worker is registered
4. Push subscription is saved to database
5. When notifications are created:
   - Database trigger marks them for push delivery
   - Real-time hook detects new notification
   - Push notification is sent via web-push
   - User receives browser notification
   - Clicking notification opens relevant issue

## Security

- VAPID keys authenticate push messages
- Subscriptions are encrypted with unique keys per user
- Row-level security on `push_subscriptions` table
- Service worker only handles notifications, no sensitive data
- All push endpoints require authentication

## Troubleshooting

### "Push notifications not configured"
- Ensure VAPID keys are set in environment variables
- Restart the dev server after adding env variables

### "Not supported in this browser"
- Browser doesn't support Push API
- Try Chrome, Firefox, or Edge
- Ensure you're on HTTPS (or localhost)

### Service worker not registering
- Check browser console for errors
- Ensure `/sw.js` is accessible at the root
- Clear browser cache and re-register

### Notifications not arriving
- Check notification permissions in browser settings
- Verify subscription exists in `push_subscriptions` table
- Check API logs for push sending errors
- Test with the "Test Push Notification" button

## Production Deployment

1. Generate new VAPID keys for production
2. Add environment variables to production hosting
3. Ensure HTTPS is enabled
4. Configure `VAPID_SUBJECT` with production email/URL
5. Test on production domain before launch

## Future Enhancements (Phase 12)

- Notification grouping/bundling
- Custom notification sounds
- Notification action handlers
- Background sync for offline support
- Desktop/mobile app deep linking
- Push notification analytics
