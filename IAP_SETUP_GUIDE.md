# Dynasty Manager — Complete IAP & RevenueCat Setup Guide

This guide walks you through **everything** you need to do to make in-app purchases
and subscriptions work in Dynasty Manager. Follow each section in order.

The code is already written and ready. This guide covers the **external setup**
(accounts, dashboards, store configuration) that you need to do yourself.

---

## Table of Contents

1. [How It All Fits Together](#1-how-it-all-fits-together)
2. [Create Your RevenueCat Account](#2-create-your-revenuecat-account)
3. [Apple App Store Connect Setup (iOS)](#3-apple-app-store-connect-setup-ios)
4. [Google Play Console Setup (Android)](#4-google-play-console-setup-android)
5. [Connect Stores to RevenueCat](#5-connect-stores-to-revenuecat)
6. [Create Products in RevenueCat](#6-create-products-in-revenuecat)
7. [Create Entitlements in RevenueCat](#7-create-entitlements-in-revenuecat)
8. [Create Offerings & Packages in RevenueCat](#8-create-offerings--packages-in-revenuecat)
9. [Design Your Paywall in RevenueCat](#9-design-your-paywall-in-revenuecat)
10. [Fix Android launchMode](#10-fix-android-launchmode)
11. [Add iOS In-App Purchase Capability](#11-add-ios-in-app-purchase-capability)
12. [Sync Native Projects](#12-sync-native-projects)
13. [Update API Keys for Production](#13-update-api-keys-for-production)
14. [Testing Purchases (Sandbox)](#14-testing-purchases-sandbox)
15. [App Store Submission Requirements](#15-app-store-submission-requirements)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. How It All Fits Together

Here's the big picture of how money flows:

```
User taps "Buy" in app
        ↓
RevenueCat SDK talks to Apple/Google
        ↓
Apple App Store / Google Play processes payment
        ↓
RevenueCat receives receipt, validates it
        ↓
RevenueCat tells your app: "User now has entitlement X"
        ↓
Your app unlocks the feature
```

**RevenueCat** is the middleman. It talks to both Apple and Google so you don't
have to write separate code for each store. It also gives you a dashboard to see
revenue, manage subscriptions, and configure paywalls.

### Your Products

| Product ID | Name | Type | Price |
|---|---|---|---|
| `com.dynastymanager.pro` | Dynasty Pro | One-time purchase | $7.99 |
| `com.dynastymanager.pro.monthly` | Dynasty Pro Monthly | Subscription (auto-renew) | $1.99/month |
| `com.dynastymanager.pro.yearly` | Dynasty Pro Yearly | Subscription (auto-renew) | $9.99/year |
| `com.dynastymanager.pro.lifetime` | Dynasty Pro Lifetime | One-time purchase | $19.99 |
| `com.dynastymanager.pack.manager` | Manager Identity Pack | One-time purchase | $2.99 |
| `com.dynastymanager.pack.stadium` | Stadium Atmosphere Pack | One-time purchase | $1.99 |
| `com.dynastymanager.pack.legends` | Dynasty Legends Pack | One-time purchase | $3.99 |
| `com.dynastymanager.bundle.all` | Dynasty Edition (everything) | One-time purchase | $9.99 |

---

## 2. Create Your RevenueCat Account

1. Go to **https://app.revenuecat.com** and sign up (free tier is fine to start)
2. Click **"Create New Project"**
3. Name it `Dynasty Manager`
4. You'll land on the project dashboard — keep this tab open, you'll come back to it

---

## 3. Apple App Store Connect Setup (iOS)

You need an **Apple Developer Account** ($99/year) at https://developer.apple.com.

### 3a. Create Your App in App Store Connect

1. Go to **https://appstoreconnect.apple.com**
2. Click **"My Apps"** → **"+"** → **"New App"**
3. Fill in:
   - **Platform:** iOS
   - **Name:** Dynasty Manager
   - **Primary Language:** English
   - **Bundle ID:** `com.dynastymanager` (must match `capacitor.config.ts`)
   - **SKU:** `dynastymanager` (any unique string)
4. Click **"Create"**

### 3b. Create a Shared Secret

RevenueCat needs this to validate receipts from Apple.

1. In App Store Connect, go to **"My Apps"** → **"Dynasty Manager"**
2. Click **"App Information"** in the left sidebar (under "General")
3. Scroll to **"App-Specific Shared Secret"** → Click **"Manage"**
4. Click **"Generate"** → Copy the secret → **Save it somewhere safe**
5. You'll paste this into RevenueCat later (Step 5)

### 3c. Create Subscription Products

1. In App Store Connect → **"Dynasty Manager"** → click **"Subscriptions"** in the left sidebar
2. Click **"+"** next to "Subscription Groups" → Name it **"Dynasty Pro"** → Click **"Create"**
3. Inside the "Dynasty Pro" group, click **"+"** to create subscriptions:

**Monthly Subscription:**
- Reference Name: `Dynasty Pro Monthly`
- Product ID: `com.dynastymanager.pro.monthly` ← **must match exactly**
- Subscription Duration: **1 Month**
- Subscription Price: Click "Add Subscription Price" → set $1.99 (or your local equivalent)
- Add a localization (English): Display Name = "Dynasty Pro Monthly", Description = "All Pro features, billed monthly."

**Yearly Subscription:**
- Reference Name: `Dynasty Pro Yearly`
- Product ID: `com.dynastymanager.pro.yearly` ← **must match exactly**
- Subscription Duration: **1 Year**
- Subscription Price: $9.99
- Localization: Display Name = "Dynasty Pro Yearly", Description = "All Pro features, billed yearly."

### 3d. Create One-Time Purchase Products (Non-Consumable)

1. In App Store Connect → **"Dynasty Manager"** → click **"In-App Purchases"** in the left sidebar
2. Click **"+"** to create each product:

| Reference Name | Product ID | Price |
|---|---|---|
| Dynasty Pro | `com.dynastymanager.pro` | $7.99 |
| Dynasty Pro Lifetime | `com.dynastymanager.pro.lifetime` | $19.99 |
| Manager Identity Pack | `com.dynastymanager.pack.manager` | $2.99 |
| Stadium Atmosphere Pack | `com.dynastymanager.pack.stadium` | $1.99 |
| Dynasty Legends Pack | `com.dynastymanager.pack.legends` | $3.99 |
| Dynasty Edition | `com.dynastymanager.bundle.all` | $9.99 |

For each product:
- **Type:** Non-Consumable
- **Product ID:** Must match the table above **exactly** (copy-paste recommended)
- **Price:** Set via "Add Pricing" button
- **Localization:** Add English display name and description
- **Review Screenshot:** You'll need a screenshot of the purchase in your app (can add later)

> **Important:** Products start in "Missing Metadata" state. Fill in all required
> fields (localization, price, screenshot) to move them to "Ready to Submit".

### 3e. Create Sandbox Test Accounts

You need sandbox accounts to test purchases without real money.

1. In App Store Connect → **"Users and Access"** (top nav)
2. Click **"Sandbox"** tab → **"Testers"** → **"+"**
3. Create a test account with a fake email (e.g., `test@dynastymanager.com`)
4. Set a password you'll remember
5. On your iPhone, go to **Settings → App Store → Sandbox Account** and sign in with this account

---

## 4. Google Play Console Setup (Android)

You need a **Google Play Developer Account** ($25 one-time) at https://play.google.com/console.

### 4a. Create Your App in Google Play Console

1. Go to **https://play.google.com/console**
2. Click **"Create app"**
3. Fill in:
   - **App name:** Dynasty Manager
   - **Default language:** English
   - **App or Game:** Game
   - **Free or Paid:** Free
4. Accept declarations and click **"Create app"**

> **Important:** To create in-app products on Google Play, you must first upload
> at least one signed APK or AAB to any track (internal testing is fine).
> Run `npm run build && npx cap sync && npx cap open android`, then build a
> signed release in Android Studio and upload it to the Internal Testing track.

### 4b. Create One-Time Products

1. In Google Play Console → **"Dynasty Manager"** → **"Monetize"** → **"In-app products"**
2. Click **"Create product"** for each:

| Product ID | Name | Price |
|---|---|---|
| `com.dynastymanager.pro` | Dynasty Pro | $7.99 |
| `com.dynastymanager.pro.lifetime` | Dynasty Pro Lifetime | $19.99 |
| `com.dynastymanager.pack.manager` | Manager Identity Pack | $2.99 |
| `com.dynastymanager.pack.stadium` | Stadium Atmosphere Pack | $1.99 |
| `com.dynastymanager.pack.legends` | Dynasty Legends Pack | $3.99 |
| `com.dynastymanager.bundle.all` | Dynasty Edition | $9.99 |

For each: set the product ID (must match exactly), name, description, and price.
Click **"Activate"** after creating each product.

### 4c. Create Subscriptions

1. In Google Play Console → **"Monetize"** → **"Subscriptions"**
2. Click **"Create subscription"**:

**Monthly:**
- Product ID: `com.dynastymanager.pro.monthly`
- Name: Dynasty Pro Monthly
- Add a **base plan**: Billing period = 1 month, Price = $1.99
- Activate the base plan

**Yearly:**
- Product ID: `com.dynastymanager.pro.yearly`
- Name: Dynasty Pro Yearly
- Add a **base plan**: Billing period = 1 year, Price = $9.99
- Activate the base plan

### 4d. Create a Service Account (for RevenueCat)

RevenueCat needs a service account to validate Android purchases.

1. Go to **Google Cloud Console** → https://console.cloud.google.com
2. Select or create a project linked to your Play Console
3. Go to **"IAM & Admin"** → **"Service Accounts"** → **"Create Service Account"**
4. Name: `revenuecat-validator`
5. Grant role: **none** (skip this step)
6. Click **"Done"**
7. Click on the service account → **"Keys"** tab → **"Add Key"** → **"Create New Key"** → **JSON**
8. Download the JSON file → **Save it safely**
9. In Google Play Console → **"Users and Permissions"** → **"Invite New Users"**
10. Enter the service account email (from the JSON file, field `client_email`)
11. Under **"App permissions"**, add Dynasty Manager
12. Under **"Account permissions"**, enable:
    - **View financial data, orders, and cancellation survey responses**
    - **Manage orders and subscriptions**
13. Click **"Invite User"** → **"Send Invite"**

> **Note:** It can take up to 24 hours for the service account permissions to
> propagate. If RevenueCat shows errors, wait and retry.

### 4e. Set Up License Testing

1. In Google Play Console → **"Settings"** → **"License testing"**
2. Add your Google account email (the one on your test device)
3. Set **License response** to **"RESPOND_NORMALLY"**

---

## 5. Connect Stores to RevenueCat

Go back to your RevenueCat dashboard at https://app.revenuecat.com.

### 5a. Add iOS App

1. In your project → click **"Apps"** in the left sidebar → **"+ New"**
2. Select **"Apple App Store"**
3. Fill in:
   - **App name:** Dynasty Manager iOS
   - **Bundle ID:** `com.dynastymanager`
   - **App-Specific Shared Secret:** Paste the secret from Step 3b
4. Click **"Save"**
5. **Copy the iOS API key** that appears (starts with `appl_`) → save it for Step 13

### 5b. Add Android App

1. Click **"+ New"** again
2. Select **"Google Play Store"**
3. Fill in:
   - **App name:** Dynasty Manager Android
   - **Package name:** `com.dynastymanager`
   - **Service Account credentials:** Upload the JSON file from Step 4d
4. Click **"Save"**
5. **Copy the Android API key** (starts with `goog_`) → save it for Step 13

---

## 6. Create Products in RevenueCat

RevenueCat needs to know about your store products.

1. In your RevenueCat project → **"Products"** (left sidebar)
2. Click **"+ New"**
3. For each product, add it for **both** iOS and Android:

| App Store Product ID | Play Store Product ID |
|---|---|
| `com.dynastymanager.pro` | `com.dynastymanager.pro` |
| `com.dynastymanager.pro.monthly` | `com.dynastymanager.pro.monthly` |
| `com.dynastymanager.pro.yearly` | `com.dynastymanager.pro.yearly` |
| `com.dynastymanager.pro.lifetime` | `com.dynastymanager.pro.lifetime` |
| `com.dynastymanager.pack.manager` | `com.dynastymanager.pack.manager` |
| `com.dynastymanager.pack.stadium` | `com.dynastymanager.pack.stadium` |
| `com.dynastymanager.pack.legends` | `com.dynastymanager.pack.legends` |
| `com.dynastymanager.bundle.all` | `com.dynastymanager.bundle.all` |

For each: select the iOS app and enter the App Store product ID, then select the
Android app and enter the Play Store product ID. They're the same IDs.

---

## 7. Create Entitlements in RevenueCat

Entitlements are the **features** users unlock. Products **grant** entitlements.

1. In RevenueCat → **"Entitlements"** (left sidebar) → **"+ New"**
2. Create these entitlements:

### `pro`
- **Identifier:** `pro`
- **Description:** Grants Dynasty Pro features
- **Attach these products:** (click "Attach" for each)
  - `com.dynastymanager.pro`
  - `com.dynastymanager.pro.monthly`
  - `com.dynastymanager.pro.yearly`
  - `com.dynastymanager.pro.lifetime`
  - `com.dynastymanager.bundle.all`

### `pack_manager`
- **Identifier:** `pack_manager`
- **Description:** Grants Manager Identity Pack cosmetics
- **Attach these products:**
  - `com.dynastymanager.pack.manager`
  - `com.dynastymanager.bundle.all`

### `pack_stadium`
- **Identifier:** `pack_stadium`
- **Description:** Grants Stadium Atmosphere Pack cosmetics
- **Attach these products:**
  - `com.dynastymanager.pack.stadium`
  - `com.dynastymanager.bundle.all`

### `pack_legends`
- **Identifier:** `pack_legends`
- **Description:** Grants Dynasty Legends Pack cosmetics
- **Attach these products:**
  - `com.dynastymanager.pack.legends`
  - `com.dynastymanager.bundle.all`

> **Why `bundle.all` is attached to every entitlement:** Because buying the bundle
> should unlock everything. RevenueCat checks which entitlements a product grants,
> so buying the bundle will grant `pro` + `pack_manager` + `pack_stadium` + `pack_legends`.

---

## 8. Create Offerings & Packages in RevenueCat

Offerings define **what products the user sees** in the app. Packages are the
individual items inside an offering.

1. In RevenueCat → **"Offerings"** (left sidebar)
2. You should see a **"Default"** offering already created
3. Click on it → **"+ New Package"** for each:

| Package Identifier | Product |
|---|---|
| `$rc_monthly` | `com.dynastymanager.pro.monthly` |
| `$rc_annual` | `com.dynastymanager.pro.yearly` |
| `$rc_lifetime` | `com.dynastymanager.pro.lifetime` |
| `pro_onetime` | `com.dynastymanager.pro` |
| `pack_manager` | `com.dynastymanager.pack.manager` |
| `pack_stadium` | `com.dynastymanager.pack.stadium` |
| `pack_legends` | `com.dynastymanager.pack.legends` |
| `bundle_all` | `com.dynastymanager.bundle.all` |

> **Note:** `$rc_monthly`, `$rc_annual`, and `$rc_lifetime` are RevenueCat's
> standard package identifiers. Using these lets RevenueCat's paywall templates
> automatically pick the right products.

---

## 9. Design Your Paywall in RevenueCat

The paywall is the screen users see when they're asked to subscribe. RevenueCat
lets you design it in their dashboard — no code changes needed.

1. In RevenueCat → **"Paywalls"** (left sidebar) → **"+ Create Paywall"**
2. Choose a template (recommended: one with a feature list)
3. Customize the design to match Dynasty Manager's dark theme:
   - **Background color:** `#0f1524`
   - **Accent/CTA color:** `#d4a017` (gold)
   - **Text color:** `#FFFFFF`
   - **Secondary text:** `#9CA3AF`
4. Add content:
   - **Title:** "Unlock Dynasty Pro"
   - **Features list:**
     - Ad-Free Experience
     - Advanced Analytics
     - Custom Tactics Creator
     - Instant Match Sim
     - Expanded Press Conferences
     - Historical Record Book
     - Pro Badge
   - **CTA button text:** "Subscribe Now"
5. The template should automatically show Monthly / Yearly / Lifetime options
   (because you used `$rc_monthly`, `$rc_annual`, `$rc_lifetime` package IDs)
6. Click **"Save"**
7. **Attach the paywall to your Default offering:**
   - Go to **"Offerings"** → **"Default"** → **"Current Paywall"** → Select your paywall

---************************************************************************************************************************************************************************************************************************

## 10. Fix Android launchMode

Google Play requires `singleTop` (not `singleTask`) to prevent purchases from
being cancelled when the app is backgrounded during payment verification.

Open `android/app/src/main/AndroidManifest.xml` and change line 17:

**Before:**
```xml
android:launchMode="singleTask"
```

**After:**
```xml
android:launchMode="singleTop"
```

---

## 11. Add iOS In-App Purchase Capability

The iOS app needs the In-App Purchase capability enabled in Xcode.

1. Run `npx cap open ios` to open the Xcode project
2. In the left sidebar, click the **"App"** project (blue icon at the top)
3. Select the **"App"** target
4. Click the **"Signing & Capabilities"** tab
5. Click **"+ Capability"** (top left)
6. Search for **"In-App Purchase"** and double-click it
7. It should appear in your capabilities list — that's it
8. Close Xcode (changes are saved automatically)

---

## 12. Sync Native Projects

After making code changes, you need to sync them to the native iOS and Android projects.

```bash
# Build the web app and sync to native projects
npm run build && npx cap sync
```

This copies:
- Your built web app into the native projects
- Any new Capacitor plugin native code (like `@revenuecat/purchases-capacitor-ui`)

---

## 13. Update API Keys for Production

Right now, the app uses a test API key. Before releasing, you need to switch to
production keys.

Open `src/utils/purchases.ts` and replace line 19:

**Before:**
```typescript
const REVENUECAT_API_KEY = 'test_CBbgpDnLxWJvQXQQLWVvIEXjoYF';
```

**After (for production):**
```typescript
import { Capacitor } from '@capacitor/core';

const REVENUECAT_API_KEY = Capacitor.getPlatform() === 'ios'
  ? 'appl_YOUR_IOS_KEY_HERE'    // ← paste your iOS key from Step 5a
  : 'goog_YOUR_ANDROID_KEY_HERE'; // ← paste your Android key from Step 5b
```

> **Note:** The `Capacitor` import already exists at the top of the file.
> You only need to change the key constant. Remove the old single-key line
> and replace it with the platform-conditional version above.

---

## 14. Testing Purchases (Sandbox)

### Testing on iOS

1. Use the sandbox account you created in Step 3e
2. On your iPhone: Settings → App Store → Sandbox Account → sign in
3. Build and run the app via Xcode (`npx cap open ios` → Run)
4. Navigate to the Shop page in the app
5. Tap a product → the App Store payment sheet should appear
6. Complete the purchase with your sandbox account
7. The product should unlock immediately

**Sandbox subscription behavior:**
| Real Duration | Sandbox Duration |
|---|---|
| 1 month | 5 minutes |
| 1 year | 1 hour |

Subscriptions renew automatically up to 6 times in sandbox, then stop.

### Testing on Android

1. Make sure your Google account is added as a license tester (Step 4e)
2. Upload a signed build to the **Internal Testing** track
3. Add yourself as a tester and opt-in via the testing link
4. Install the app from the Play Store (or sideload the signed APK)
5. Purchases will use Google Play's test card (no real charges)

### Testing on Web (Development)

On web (`npm run dev`), the RevenueCat SDK is not available. The app
automatically mocks purchases:
- Buying any product instantly "succeeds" and grants the entitlement
- Restore returns empty (no purchases to restore)
- Paywall returns `'not_presented'` (shows inline Shop UI instead)

This lets you test the UI flow without a real device.

---

## 15. App Store Submission Requirements

Both Apple and Google have requirements for apps with subscriptions.

### Apple Requirements

1. **Terms of Use URL** — Add to App Store Connect → App Information
2. **Privacy Policy URL** — Add to App Store Connect → App Information
3. **Subscription description in app metadata** — Must include:
   - Title of publication or service
   - Length of subscription
   - Price of subscription
   - That payment will be charged to iTunes Account at confirmation of purchase
   - That subscription automatically renews unless auto-renew is turned off at
     least 24 hours before the end of the current period
   - That account will be charged for renewal within 24 hours prior to the end
     of the current period
   - That subscriptions may be managed and auto-renewal turned off in Account
     Settings after purchase
   - Links to Terms of Use and Privacy Policy
4. **Restore Purchases button** — Already implemented in Settings page
5. **Review screenshot** — Screenshot of each IAP product in the app

### Google Requirements

1. **Privacy Policy URL** — Add to Google Play Console → Store Listing
2. **Subscription terms** — Similar to Apple, must describe auto-renewal terms
3. **Subscription management** — Already implemented (Settings → Manage Subscription)

---

## 16. Troubleshooting

### "Product not found in offerings"

- Make sure the product ID in App Store Connect / Google Play matches **exactly**
  what's in `src/config/monetization.ts`
- Make sure you created the product in RevenueCat (Step 6) and attached it to a
  package in an offering (Step 8)
- Apple products need to be in "Ready to Submit" state (not "Missing Metadata")
- Google products need to be "Active" (not "Draft")

### "Purchase failed" on iOS

- Make sure you're signed into a **sandbox** account (not your real Apple ID)
- Make sure the In-App Purchase capability is enabled in Xcode (Step 11)
- Make sure the App-Specific Shared Secret is set in RevenueCat (Step 5a)

### "Purchase cancelled" on Android

- Check that `android:launchMode` is `"singleTop"` (Step 10)
- Make sure your Google account is a license tester (Step 4e)
- Make sure you uploaded at least one build to the Internal Testing track

### RevenueCat shows "No purchases"

- On iOS: Sandbox purchases take a moment to show up. Wait 30 seconds and refresh.
- On Android: Service account permissions can take up to 24 hours to propagate.
- Check RevenueCat → "Customers" tab → search for your user to see their purchase history.

### Paywall doesn't show

- Make sure you assigned the paywall to the Default offering (Step 9, item 7)
- Paywall only works on native (iOS/Android), not on web
- Check the RevenueCat debug logs in Xcode/Android Studio console for errors

### Subscription status not updating

- The app syncs subscriptions on launch (GameShell.tsx) and listens for real-time
  updates. If status seems stale, force-close and reopen the app.
- Check RevenueCat dashboard → Customers → your user → verify the entitlement is active.

---

## Quick Reference: File Locations

| What | File |
|---|---|
| API key | `src/utils/purchases.ts` line 19 |
| Product definitions | `src/config/monetization.ts` |
| Product IDs (type system) | `src/types/game.ts` line 861 |
| Shop page UI | `src/pages/ShopPage.tsx` |
| Settings page (restore/manage) | `src/pages/SettingsPage.tsx` |
| Purchase modal | `src/components/game/PurchaseModal.tsx` |
| Entitlement check logic | `src/utils/monetization.ts` |
| Zustand store slice | `src/store/slices/monetizationSlice.ts` |
| Save migration | `src/utils/saveMigration.ts` |
| Capacitor config | `capacitor.config.ts` |
| Android manifest | `android/app/src/main/AndroidManifest.xml` |
| Support email | `src/pages/SettingsPage.tsx` (search for `mailto:`) |
