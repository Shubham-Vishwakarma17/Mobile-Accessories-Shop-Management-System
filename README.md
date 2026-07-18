# Mobile Accessories Shop Management System

Offline-first Android inventory and sales management for a single local mobile accessories shop. Built with React Native, Expo, SQLite, and Firebase.

## Current milestone

- Persistent SQLite inventory
- Product and variant creation
- Automatic QR generation per variant
- Camera QR scanning
- Scan-once product confirmation and quantity selection
- Stock deduction only after quantity confirmation
- Cash, UPI, card, credit, and other payment recording
- Dashboard and low-stock visibility
- Dedicated actionable low-stock and out-of-stock alerts page
- Compact product-name QR labels that save to the Android gallery
- Persistent Home, Stock, Scan, Sale, and Alerts navigation
- Searchable stock list with simple per-variant restocking
- Keyboard-safe scrolling forms
- Persistent single-owner Firebase Email/Password login
- Owner UID authorization guard
- Firestore bootstrap, upload, and backup-device download synchronization
- Retryable offline sync status on the dashboard

The first launch includes two sample variants so the inventory and QR workflow can be tested immediately.

## Run locally

Requirements: Node.js 22.13 or newer, Android Studio/emulator or an Android phone, and npm.

```bash
npm install
npm run android
```

You can also start Metro and scan the development QR code:

```bash
npm start
```

## Firebase configuration

1. Create a Firebase project and Android app using package name `com.shubhamvishwakarma.mobileaccessoriesshop`.
2. Enable Email/Password Authentication and Cloud Firestore.
3. Copy `.env.example` to `.env` and fill in the Firebase web-app configuration values.
4. Deploy `firestore.rules` and `firestore.indexes.json` with the Firebase CLI.

The configured owner UID is the only Firebase account accepted by the application. A signed-in phone keeps its authenticated session across app restarts. Completed sales and newly created products synchronize automatically; tapping the dashboard sync status retries manually.

On the first device, an empty Firestore shop is initialized from SQLite. A backup phone with an existing cloud shop downloads that shop before normal use, preventing its starter database from replacing cloud inventory.

## Validation

```bash
npx tsc --noEmit
npm run lint
npx expo-doctor
```

## Data model

SQLite stores products, variants, sales, sale items, inventory movements, and a durable synchronization outbox. Prices are stored as integer paise to avoid floating-point rounding errors.
