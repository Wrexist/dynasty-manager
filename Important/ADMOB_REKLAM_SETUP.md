# AdMob — Reklam för Bronze-paketet (Svensk Guide)

> **NÄR ska detta göras?**
> Innan du lämnar in appen till App Store / Google Play för granskning.
> INTE efter lansering.
>
> **Tills du gör detta:** appen funkar i dev-läge. Bronze-paketet "öppnar"
> utan riktig reklam (testläge är inbakat). Du kan testa hela paket-flödet
> på datorn utan att göra något i AdMob.
>
> **Vad gör detta?**
> Sätter upp belöningsannonser så Bronze-paketet kan öppnas gratis genom
> att spelaren tittar på en kort video-annons. Begränsat till 3 öppningar
> per dag (per spelare, per riktig dag). Detta är gratis intäktsmodell
> som många mobilspel använder.

---

## Steg 1 — Skapa AdMob-konto

1. Gå till https://admob.google.com
2. Logga in med ditt Google-konto
3. Klicka **"Sign up"** om du inte har konto
4. Välj:
   - **Country:** `Sweden`
   - **Time zone:** `(GMT+01:00) Stockholm`
   - **Currency:** `SEK – Swedish Krona`
5. Acceptera AdMob-villkoren

---

## Steg 2 — Lägg till iOS-app i AdMob

1. I AdMob-vänstermenyn → **Apps** → klicka **ADD APP**
2. På frågan **"Have you published your app on a supported app store?"**:
   - **Om appen redan finns på App Store:** välj **Yes** → sök efter "Dynasty Manager" → välj din app
   - **Om appen inte finns ännu:** välj **No**
3. Plattform: **iOS**
4. Om du valde "No" — fyll i:
   - **App name:**
     ```
     Dynasty Manager
     ```
5. Klicka **ADD**
6. På nästa sida — **kopiera App ID** (ser ut så här: `ca-app-pub-1234567890123456~9876543210` — notera tilde-tecknet `~`)
7. Spara App ID i en textfil och döp den till `AdMob-iOS-App-ID`

---

## Steg 3 — Lägg till Android-app i AdMob

Upprepa Steg 2 men välj **Android** som plattform.

Spara även den App ID:n som `AdMob-Android-App-ID`.

---

## Steg 4 — Skapa Rewarded-annonsenhet (iOS)

1. Klicka på din iOS-app i AdMob-listan
2. Vänster meny → **Ad units** → klicka **ADD AD UNIT**
3. Välj annonsformat: **Rewarded** → klicka **Select**
4. Fyll i:

| Fält | Värde |
|------|-------|
| Ad unit name | `Bronze Pack Rewarded iOS` |
| Reward amount | `1` |
| Reward item | `bronze_pack` |
| Apply to all users | ✓ ikryssad |
| Frequency capping | lämna avstängt |
| Eligibility for ad partner bidding | lämna standard |

5. Klicka **CREATE AD UNIT**
6. **Kopiera Ad unit ID** (ser ut så här: `ca-app-pub-1234567890123456/1111111111` — notera snedstrecket `/`, INTE tilde)
7. Spara som `AdMob-iOS-Rewarded-Unit-ID`

---

## Steg 5 — Skapa Rewarded-annonsenhet (Android)

Klicka på din Android-app i AdMob-listan, sedan upprepa Steg 4 med dessa värden:

| Fält | Värde |
|------|-------|
| Ad unit name | `Bronze Pack Rewarded Android` |
| Reward amount | `1` |
| Reward item | `bronze_pack` |

Spara som `AdMob-Android-Rewarded-Unit-ID`.

---

## Steg 6 — Lägg till nycklarna i `.env.local`

1. I projektroten (samma mapp som `package.json`), öppna eller skapa filen:
   ```
   .env.local
   ```
2. Lägg till dessa två rader (byt ut platshållarna mot riktiga ID:n från Steg 4 & 5):
   ```
   VITE_ADMOB_REWARDED_IOS=ca-app-pub-DITT-IOS-AD-UNIT-ID
   VITE_ADMOB_REWARDED_ANDROID=ca-app-pub-DITT-ANDROID-AD-UNIT-ID
   ```
3. Spara filen.

> ⚠️ `.env.local` ska INTE checka in i git (den ligger redan i `.gitignore`). Lägg till samma nycklar som secrets i GitHub Actions om du vill att CI ska bygga med produktions-ID.

---

## Steg 7 — Slå på native-läget i koden

1. Öppna filen `src/utils/ads.ts`
2. Hitta raden:
   ```ts
   const NATIVE_ADS_READY = false;
   ```
3. Ändra till:
   ```ts
   const NATIVE_ADS_READY = true;
   ```
4. Spara filen.

---

## Steg 8 — Installera Capacitor-pluginen

Öppna terminalen i projektroten och kör:

```bash
npm install @capacitor-community/admob
npm run cap:sync
```

`cap:sync` bygger appen och synkar in pluginet i både iOS- och Android-projekten.

---

## Steg 9 — iOS Info.plist

1. Öppna projektet i Xcode:
   ```bash
   npm run cap:ios
   ```
2. I Xcode, hitta filen **App → App → Info.plist**
3. Högerklicka → **Open As → Source Code**
4. Lägg till INNAN sista `</dict>`:

```xml
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-DITT-IOS-APP-ID</string>
<key>NSUserTrackingUsageDescription</key>
<string>Vi använder din annons-ID för att visa relevanta belöningsannonser så du kan öppna gratis paket.</string>
<key>SKAdNetworkItems</key>
<array>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>cstr6suwn9.skadnetwork</string>
  </dict>
</array>
```

⚠️ `GADApplicationIdentifier` ska vara **App ID** från Steg 2 (med `~`), INTE Ad unit ID från Steg 4.

5. Spara filen och stäng Xcode.

---

## Steg 10 — Android AndroidManifest.xml

1. Öppna filen `android/app/src/main/AndroidManifest.xml`
2. Hitta `<application ...>`-taggen
3. Inuti `<application>` (före `</application>`), lägg till:

```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-DITT-ANDROID-APP-ID"/>
```

⚠️ Värdet ska vara **App ID** från Steg 3 (med `~`), INTE Ad unit ID från Steg 5.

4. Spara filen.

---

## Steg 11 — Testa på riktig enhet

### iOS (TestFlight)
1. Bygg via GitHub Actions iOS TestFlight-workflowet
2. Installera på iPhone via TestFlight
3. När du öppnar appen första gången — Apple visar **"Allow tracking"**-prompt → tryck **Allow**
4. I appen, gå till **Player Packs** → tryck på **Bronze Pack**
5. En testkonfigurerad video-annons ska spelas upp
6. När den är klar → paketet öppnas

### Android (Internal testing)
1. Lägg till ditt Gmail som testare i Play Console → **Testing → Internal testing → Testers**
2. Ladda ner via opt-in-länken
3. Tryck på **Bronze Pack** → testreklam ska spelas

> Det är **HELT NORMALT** att se "Test Ad" / "Sample Ad" i testbygget. AdMob byter automatiskt till riktiga annonser när din app godkänns och publiceras i App Store / Google Play.

---

## Steg 12 — Aktivera AdMob för produktion

1. AdMob → **Apps** → välj din iOS-app
2. **App settings** → kontrollera att **App store URL** är ifylld (länk till App Store-sidan)
3. Upprepa för Android-appen (Play Store URL)
4. AdMob → **Privacy & messaging** → konfigurera:
   - **EU consent message** (krav i EU/Sverige) — AdMob ger en färdig mall, tryck bara **Publish**
5. AdMob behöver upp till 24 timmar för att börja servera riktiga annonser efter att appen är publicerad

---

## Snabb-checklista

| Steg | Klart? |
|------|--------|
| AdMob iOS App skapad — App ID sparad | ☐ |
| AdMob Android App skapad — App ID sparad | ☐ |
| iOS Rewarded Ad Unit skapad — Ad unit ID sparat | ☐ |
| Android Rewarded Ad Unit skapad — Ad unit ID sparat | ☐ |
| `.env.local` har `VITE_ADMOB_REWARDED_IOS` ifylld | ☐ |
| `.env.local` har `VITE_ADMOB_REWARDED_ANDROID` ifylld | ☐ |
| `NATIVE_ADS_READY = true` i `src/utils/ads.ts` | ☐ |
| `npm install @capacitor-community/admob` körd | ☐ |
| `npm run cap:sync` körd | ☐ |
| `Info.plist` har `GADApplicationIdentifier` + tracking-text | ☐ |
| `AndroidManifest.xml` har `com.google.android.gms.ads.APPLICATION_ID` | ☐ |
| Test-annons spelas på TestFlight-iOS | ☐ |
| Test-annons spelas på Android internal-test | ☐ |
| EU consent message publicerat i AdMob | ☐ |

När alla rutor är ikryssade → kör `npm run ship -- "Wire AdMob for production"` och bygg ny TestFlight / Play-version.

---

## Felsökning

**"No ad available" / annons spelas inte**
→ Vänta 30 minuter, AdMob behöver tid att hitta en annons. Du kan också inte hämta för många annonser snabbt på samma enhet — testbygget begränsar till några per dag.

**App kraschar vid öppning**
→ Kontrollera att `GADApplicationIdentifier` är App ID (med `~`), inte Ad unit ID (med `/`). Detta är det vanligaste felet.

**"App ID is not configured" i loggar**
→ Du har troligen lagt App ID i `.env.local` istället för Info.plist. App ID hör hemma i Info.plist + AndroidManifest.xml. Ad unit ID hör hemma i `.env.local`.
