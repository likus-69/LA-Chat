# LA Chat Mobile

Expo (React Native) app for Android and iOS.

## Prerequisites

- Node.js 22+
- Expo CLI (comes with the `expo` package)
- Android Studio (for Android emulator) or Xcode (for iOS simulator)

## Setup

```bash
# From the repo root
pnpm install

# Start the Expo dev server
pnpm --filter @la-chat/mobile start

# Or run on a specific platform
pnpm --filter @la-chat/mobile android
pnpm --filter @la-chat/mobile ios
```

## Environment

Set these before starting (in your shell or `.env`):

- `EXPO_PUBLIC_API_URL` — API base URL (default: `http://localhost:4000/api/v1`)
- `EXPO_PUBLIC_WS_URL` — WebSocket URL (default: `ws://localhost:4000/ws`)

For physical device testing, use your machine's LAN IP instead of `localhost`.

## Features

- Login with admission number / staff number / email
- Conversation list with unread badges
- Real-time chat via WebSocket (auto-reconnect, offline queue)
- Message bubbles, typing indicators
- Announcements list with acknowledge
- Push notification registration (expo-notifications)

## Building for app stores

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas login
eas build:configure

# Build for Android
eas build --platform android

# Build for iOS
eas build --platform ios

# Submit to stores
eas submit --platform android
eas submit --platform ios
```

See `documentation/deployment/roadmap.md` for the full app-store submission checklist.
