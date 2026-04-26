# In-App Purchases — Gold, Premium Gold, Rare Gold & Icon-paket (Svensk Guide)

> **NÄR ska detta göras?**
> Innan du lämnar in appen till App Store / Google Play för granskning.
> INTE efter lansering — Apple och Google kräver att produkterna finns
> i butikerna INNAN de granskar bygget som använder dem.
>
> **Tills du gör detta:** appen funkar i dev-läge. Gold, Premium Gold,
> Rare Gold och Icon "köps" tyst utan riktig betalning (test-nyckel
> inbakad). Du kan testa hela köp-flödet på datorn utan att göra något
> i App Store / Google Play.
>
> **Vad gör detta?**
> Sätter upp riktiga betalningar för Gold ($2.99), Premium Gold ($4.99),
> Rare Gold ($6.99) och Icon ($9.99). Alla fyra är **konsumerbara**
> (consumable) — varje köp ger ett paket-öppning, inget permanent. Gold
> är ett extra paket utöver det dagliga gratis-paketet (1/dag). Det är
> samma modell som t.ex. mynt-paket i andra spel.

---

## Översikt — du behöver konfigurera 8 produkter totalt

| Produkt | Plattform | Pris | Product ID |
|---------|-----------|------|------------|
| Gold (iOS) | App Store | $2.99 | `com.dynastymanager.pack.gold` |
| Gold (Android) | Google Play | $2.99 | `com.dynastymanager.pack.gold` |
| Premium Gold (iOS) | App Store | $4.99 | `com.dynastymanager.pack.premium_gold` |
| Premium Gold (Android) | Google Play | $4.99 | `com.dynastymanager.pack.premium_gold` |
| Rare Gold (iOS) | App Store | $6.99 | `com.dynastymanager.pack.rare_gold` |
| Rare Gold (Android) | Google Play | $6.99 | `com.dynastymanager.pack.rare_gold` |
| Icon (iOS) | App Store | $9.99 | `com.dynastymanager.pack.icon` |
| Icon (Android) | Google Play | $9.99 | `com.dynastymanager.pack.icon` |

Sedan kopplas de ihop via **RevenueCat** så koden bara behöver hantera ett system.

> **OBS:** Gold-paketet är ett extra köp **efter** det dagliga gratis-paketet
> har använts. Bronze och Silver kräver INGEN IAP — bara reklam efter det
> dagliga gratis-paketet (se `ADMOB_REKLAM_SETUP.md`).

---

## DEL A — RevenueCat-nyckel (innan något annat)

### Steg A.1 — Skaffa publika SDK-nycklar

1. Logga in på https://app.revenuecat.com
2. Välj projektet **Dynasty Manager** (ska redan finnas eftersom Pro-IAP fungerar)
3. Vänster meny → **Project Settings** → **API Keys**
4. Du ser två publika SDK-nycklar:
   - **iOS:** börjar med `appl_...`
   - **Android:** börjar med `goog_...`

### Steg A.2 — Lägg nyckeln i `.env.local`

I projektroten, öppna eller skapa filen `.env.local` och lägg till:

```
VITE_REVENUECAT_API_KEY=appl_DIN-IOS-NYCKEL-HÄR
```

(Eller `goog_DIN-ANDROID-NYCKEL-HÄR` om du bygger Android först. För
produktion brukar man ha olika `.env.production.ios` och
`.env.production.android` så CI väljer rätt nyckel per plattform.)

> ⚠️ `.env.local` checkas inte in i git. Lägg samma nyckel som secret i GitHub Actions om CI ska bygga med produktionsnyckeln.

---

## DEL B — App Store Connect (iOS)

### Steg B.0 — Gold-produkt (iOS)

1. Logga in på https://appstoreconnect.apple.com
2. **My Apps** → välj **Dynasty Manager**
3. Vänster meny → **In-App Purchases** → klicka **+** → välj **Consumable** → **Create**

| Fält | Värde |
|------|-------|
| Reference Name | `Gold Pack` |
| Product ID | `com.dynastymanager.pack.gold` |
| Pricing Tier | **Tier 3 ($2.99 USD)** |

**English Display Name:** `Gold Pack`
**English Description:**
```
Open one Gold pack with 5 players including a guaranteed 78+ rated player. Available after today's daily free Gold pack.
```

**Swedish Display Name:** `Gold-paket`
**Swedish Description:**
```
Öppna ett Gold-paket med 5 spelare, varav minst en med betyg 78 eller högre. Tillgängligt efter dagens gratis Gold-paket.
```

**Review notes:**
```
Consumable IAP. Each purchase grants one Gold pack opening with 5 randomized in-game players, including at least one rated 78 or higher. The reward is granted immediately. No permanent unlock. Cannot be restored. Players also receive one free Gold pack per real-world day at no cost.
```

Klicka **Save**.

### Steg B.1 — Premium Gold-produkt (iOS)

1. Logga in på https://appstoreconnect.apple.com
2. **My Apps** → välj **Dynasty Manager**
3. Vänster meny → **In-App Purchases** (under Features)
4. Klicka **+** (plus-ikonen) för att skapa
5. Välj typ: **Consumable**
6. Klicka **Create**

Fyll i (klistra in EXAKT så här):

| Fält | Värde |
|------|-------|
| Reference Name | `Premium Gold Pack` |
| Product ID | `com.dynastymanager.pack.premium_gold` |

> ⚠️ Product ID måste matcha EXAKT — annars hittar koden inte produkten.

Klicka **Create**.

### Steg B.2 — Pricing för Premium Gold

På produktens redigeringssida:
1. Klicka **Add Pricing** (eller "Edit" bredvid Pricing)
2. Välj prisnivå: **Tier 5 ($4.99 USD)**
3. Klicka **Confirm** → **Save**

### Steg B.3 — Localizations för Premium Gold

På samma sida, scrolla ner till **App Store Localization**:

1. Klicka **+** → välj **English (U.S.)**
   - **Display Name:**
     ```
     Premium Gold Pack
     ```
   - **Description:**
     ```
     Open one Premium Gold pack with 5 players including a guaranteed 82+ rated star.
     ```
   - Klicka **Save**

2. Klicka **+** igen → välj **Swedish**
   - **Display Name:**
     ```
     Premium Gold-paket
     ```
   - **Description:**
     ```
     Öppna ett Premium Gold-paket med 5 spelare, varav minst en med betyg 82 eller högre.
     ```
   - Klicka **Save**

### Steg B.4 — Review Information för Premium Gold

På samma sida, sektionen **Review Information**:

- **Screenshot:** ladda upp en skärmdump som visar paket-butiken (storlek 640×920 eller liknande). Du kan ta en screenshot från din iPhone i appen.
- **Review Notes** (kopiera och klistra in):
  ```
  This is a consumable in-app purchase. Each purchase grants the player one Premium Gold pack opening with 5 randomized in-game players, including at least one player rated 82 or higher. The reward is granted immediately after purchase. No permanent unlock. Cannot be restored across reinstalls.
  ```

Klicka **Save**.

### Steg B.4b — Rare Gold-produkt (iOS)

Skapa ännu en **Consumable** med dessa värden:

| Fält | Värde |
|------|-------|
| Reference Name | `Rare Gold Pack` |
| Product ID | `com.dynastymanager.pack.rare_gold` |
| Pricing Tier | **Tier 7 ($6.99 USD)** |

**English Display Name:** `Rare Gold Pack`
**English Description:**
```
Open one Rare Gold pack with 5 players including a guaranteed 84+ rated player and a chance for a walkout reveal.
```

**Swedish Display Name:** `Rare Gold-paket`
**Swedish Description:**
```
Öppna ett Rare Gold-paket med 5 spelare, varav minst en med betyg 84 eller högre och en chans för en walkout-animation.
```

**Review Notes:**
```
Consumable IAP. Each purchase grants one Rare Gold pack opening with 5 randomized in-game players, including at least one rated 84 or higher with a chance of a walkout reveal. The reward is granted immediately. No permanent unlock. Cannot be restored.
```

### Steg B.5 — Icon Pack-produkt (iOS)

Upprepa Steg B.1 — B.4 men med dessa värden:

| Fält | Värde |
|------|-------|
| Reference Name | `Icon Pack` |
| Product ID | `com.dynastymanager.pack.icon` |
| Pricing Tier | **Tier 10 ($9.99 USD)** |

**English Display Name:** `Icon Pack`
**English Description:**
```
Open one Icon pack — guaranteed 88+ rated Icon player with a walkout reveal.
```

**Swedish Display Name:** `Ikon-paket`
**Swedish Description:**
```
Öppna ett Ikon-paket — garanterad ikon-spelare med betyg 88 eller högre och en walkout-animation.
```

**Review Notes:**
```
Consumable IAP. Each purchase grants one Icon pack opening with one Icon-tier player (minimum 88 OVR rating). Reward is granted immediately. No permanent unlock. Cannot be restored across reinstalls.
```

---

## DEL C — Google Play Console (Android)

### Steg C.0 — Gold-produkt (Android)

1. Logga in på https://play.google.com/console
2. Välj **Dynasty Manager**
3. Vänster meny → **Monetize** → **Products** → **In-app products** → **Create product**

| Fält | Värde |
|------|-------|
| Product ID | `com.dynastymanager.pack.gold` |
| Name | `Gold Pack` |
| Description | `Open one Gold pack with 5 players including a guaranteed 78+ rated player. Available after today's daily free Gold pack.` |
| Default price | **USD 2.99** (≈ 32 kr i SEK) |
| Status | **Active** |

Klicka **Save** → **Activate**.

### Steg C.1 — Premium Gold-produkt (Android)

1. Logga in på https://play.google.com/console
2. Välj **Dynasty Manager**
3. Vänster meny → **Monetize** → **Products** → **In-app products**
4. Klicka **Create product**

Fyll i:

| Fält | Värde |
|------|-------|
| Product ID | `com.dynastymanager.pack.premium_gold` |
| Name | `Premium Gold Pack` |
| Description | `Open one Premium Gold pack with 5 players including a guaranteed 82+ rated star.` |

> ⚠️ Product ID kan INTE ändras efter du har klickat Save. Dubbelkolla stavningen.

### Steg C.2 — Pricing för Premium Gold (Android)

1. Klicka **Set price**
2. Välj **USD 4.99**
3. Klicka **Apply** — övriga valutor fylls i automatiskt baserat på Googles växelkurser
4. Verifiera att SEK ungefär blir **49 kr** (kan vara ±5 kr)

### Steg C.3 — Aktivera Premium Gold (Android)

1. På samma sida — sätt **Status** till **Active**
2. Klicka **Save** sedan **Activate**

### Steg C.3b — Rare Gold-produkt (Android)

Upprepa Steg C.1 — C.3 med:

| Fält | Värde |
|------|-------|
| Product ID | `com.dynastymanager.pack.rare_gold` |
| Name | `Rare Gold Pack` |
| Description | `Open one Rare Gold pack with 5 players including a guaranteed 84+ rated player and a chance for a walkout reveal.` |
| Default price | **USD 6.99** (≈ 75 kr i SEK) |

Aktivera.

### Steg C.4 — Icon Pack-produkt (Android)

Upprepa Steg C.1 — C.3 med:

| Fält | Värde |
|------|-------|
| Product ID | `com.dynastymanager.pack.icon` |
| Name | `Icon Pack` |
| Description | `Open one Icon pack — guaranteed 88+ rated Icon player with a walkout reveal.` |
| Default price | **USD 9.99** (≈ 109 kr i SEK) |

Aktivera.

---

## DEL D — RevenueCat-konfiguration (KRITISKT)

> Detta är där det är lättast att göra fel. Läs noga.

### Steg D.0 — Lägg till Gold (iOS + Android) i RevenueCat

1. https://app.revenuecat.com → välj projektet → vänster meny → **Products**
2. Klicka **+ New** för iOS:

| Fält | Värde |
|------|-------|
| Store | **App Store** |
| App | välj din iOS-app |
| Identifier | `com.dynastymanager.pack.gold` |
| Type | **Consumable** ⚠️ |
| Entitlement | TOMT |

3. Klicka **+ New** igen för Android med samma Identifier men **Store: Play Store**.

### Steg D.1 — Lägg till Premium Gold (iOS) i RevenueCat

1. https://app.revenuecat.com → välj projektet → vänster meny → **Products**
2. Klicka **+ New** (uppe till höger)
3. Fyll i:

| Fält | Värde |
|------|-------|
| Store | **App Store** |
| App | välj din iOS-app |
| Identifier | `com.dynastymanager.pack.premium_gold` |
| Type | **Consumable** ⚠️ |

⚠️ **Type måste vara Consumable** — INTE "Non-consumable", INTE "Subscription". Detta är HELT avgörande.

4. **Entitlement:** lämna TOMT — konsumerbara paket har inga entitlements
5. Klicka **Save**

### Steg D.2 — Lägg till Premium Gold (Android) i RevenueCat

Klicka **+ New** igen och upprepa men:

| Fält | Värde |
|------|-------|
| Store | **Play Store** |
| App | välj din Android-app |
| Identifier | `com.dynastymanager.pack.premium_gold` (samma) |
| Type | **Consumable** |
| Entitlement | TOMT |

### Steg D.2b — Lägg till Rare Gold (iOS + Android) i RevenueCat

Upprepa två gånger till för Rare Gold-paketet med:

- Identifier: `com.dynastymanager.pack.rare_gold`
- Type: **Consumable**
- Entitlement: **TOMT**

### Steg D.3 — Lägg till Icon (iOS + Android) i RevenueCat

Upprepa två gånger till för Icon-paketet med:

- Identifier: `com.dynastymanager.pack.icon`
- Type: **Consumable**
- Entitlement: **TOMT**

Du har nu 8 produkter totalt i RevenueCat (4 paket × 2 plattformar).

### Steg D.4 — Lägg produkterna i en Offering

1. Vänster meny → **Offerings**
2. Välj din nuvarande offering. Om du inte har en, klicka **+ New Offering**:
   - **Identifier:** `default` (eller `packs`)
   - Klicka **Create**

3. Klicka **+ New package** inuti offeringen — gör detta fyra gånger.

**Paket 1 — Gold:**

| Fält | Värde |
|------|-------|
| Identifier | `gold` |
| Package type | **Custom** |
| Products | välj BÅDA Gold-produkterna (App Store + Play Store) |

**Paket 2 — Premium Gold:**

| Fält | Värde |
|------|-------|
| Identifier | `premium_gold` |
| Package type | **Custom** |
| Products | välj BÅDA Premium Gold-produkterna |

**Paket 3 — Rare Gold:**

| Fält | Värde |
|------|-------|
| Identifier | `rare_gold` |
| Package type | **Custom** |
| Products | välj BÅDA Rare Gold-produkterna |

**Paket 4 — Icon:**

| Fält | Värde |
|------|-------|
| Identifier | `icon` |
| Package type | **Custom** |
| Products | välj BÅDA Icon-produkterna |

Klicka **Save** efter varje.

### Steg D.5 — Aktivera offeringen

1. På offerings-sidan, hitta din offering
2. Klicka **Make current** om den inte redan visar "Current"

Det är denna offering som koden hämtar via `Purchases.getOfferings()`.

---

## DEL E — Testa innan du skickar till granskning

### På datorn (snabbtest, ingen riktig betalning)
- Öppna appen lokalt med `npm run dev`
- Gå till **Player Packs**
- Tryck på **Premium Gold** eller **Icon**
- Köpet "lyckas" tyst utan att du betalar (test-läge)
- Paketet ska öppnas och spelaren läggas till
- ⚠️ Detta bevisar bara att flödet i koden funkar — INTE att RevenueCat-konfigurationen är rätt

### På riktig iOS-enhet (TestFlight + Sandbox)

1. Skapa Sandbox-konto:
   - App Store Connect → **Users and Access** → **Sandbox Testers** → **+**
   - **First Name:** `Test`
   - **Last Name:** `User`
   - **Email:** `dynastytest+sandbox1@dinmail.se` (måste vara UNIK och INTE en riktig Apple ID)
   - **Password:** välj själv
   - **Country:** **Sweden**
   - Klicka **Save**

2. På din iPhone:
   - Logga **UT** ur ditt vanliga Apple ID i App Store-appen (inte i iCloud — bara i App Store)
   - Eller: **Inställningar → App Store → Sandbox Account** → logga in med Sandbox-kontot

3. Installera appen via TestFlight

4. Öppna appen → gå till **Player Packs** → tryck på **Premium Gold**
   - En **iOS-systemprompt** ska visa "$4.99 — Confirm with Touch ID/Face ID"
   - Tryck **Confirm**
   - Sandbox-konton debiteras INTE riktigt
   - Paketet ska öppnas direkt

> Om köpet misslyckas: kolla att Product ID är EXAKT samma i App Store Connect och RevenueCat. Vanligaste felet.

### På riktig Android-enhet (Internal testing)

1. Lägg till ditt e-post som testare:
   - Play Console → **Testing → Internal testing → Testers** → klicka **Create email list**
   - Klistra in din Gmail
   - Klicka **Save**

2. Hämta opt-in-länken:
   - **Internal testing → Testers** → kopiera länken **"Copy link"**
   - Öppna den på din Android-telefon
   - Klicka **Become a tester**

3. Installera appen från Play Store-länken

4. Tryck på **Icon Pack** → Play-Store-prompten ska visa **109 kr**
   - Acceptera
   - Du laddas inte (testkonto)
   - Paketet ska öppnas

---

## Snabb-checklista

| Steg | Klart? |
|------|--------|
| RevenueCat iOS-nyckel sparad | ☐ |
| RevenueCat Android-nyckel sparad | ☐ |
| `.env.local` har `VITE_REVENUECAT_API_KEY` | ☐ |
| App Store: `com.dynastymanager.pack.gold` skapad som **Consumable** ($2.99) | ☐ |
| App Store: Gold har English + Swedish localizations | ☐ |
| App Store: `com.dynastymanager.pack.premium_gold` skapad som **Consumable** ($4.99) | ☐ |
| App Store: Premium Gold har English + Swedish localizations | ☐ |
| App Store: `com.dynastymanager.pack.rare_gold` skapad som **Consumable** ($6.99) | ☐ |
| App Store: Rare Gold har English + Swedish localizations | ☐ |
| App Store: `com.dynastymanager.pack.icon` skapad som **Consumable** ($9.99) | ☐ |
| App Store: Icon har English + Swedish localizations | ☐ |
| Play Store: `com.dynastymanager.pack.gold` skapad och **Active** ($2.99) | ☐ |
| Play Store: `com.dynastymanager.pack.premium_gold` skapad och **Active** ($4.99) | ☐ |
| Play Store: `com.dynastymanager.pack.rare_gold` skapad och **Active** ($6.99) | ☐ |
| Play Store: `com.dynastymanager.pack.icon` skapad och **Active** ($9.99) | ☐ |
| RevenueCat: alla 8 produkter typ **Consumable** (INTE subscription/non-consumable) | ☐ |
| RevenueCat: alla 8 har TOMT entitlement-fält | ☐ |
| RevenueCat: alla 4 paketen ligger i en **current** Offering | ☐ |
| Sandbox-test iOS — Gold ($2.99) lyckas | ☐ |
| Sandbox-test iOS — Premium Gold ($4.99) lyckas | ☐ |
| Sandbox-test iOS — Rare Gold ($6.99) lyckas | ☐ |
| Sandbox-test iOS — Icon ($9.99) lyckas | ☐ |
| Internal-test Android — Gold (32 kr) lyckas | ☐ |
| Internal-test Android — Premium Gold (49 kr) lyckas | ☐ |
| Internal-test Android — Rare Gold (75 kr) lyckas | ☐ |
| Internal-test Android — Icon (109 kr) lyckas | ☐ |

När alla rutor är ikryssade → kör `npm run ship -- "Wire RevenueCat IAPs for production"` och bygg ny TestFlight / Play-version.

---

## Felsökning

**Sandbox-köp visar "Cannot connect to iTunes Store"**
→ Logga ut ur ditt vanliga Apple ID i App Store-appen och testa igen. Sandbox och produktionskonto kan inte vara inloggade samtidigt.

**Köp lyckas men paketet öppnas inte**
→ Kolla loggen för felmeddelande. Vanligen är det att Product ID i App Store ≠ Product ID i RevenueCat. De måste vara EXAKT samma sträng.

**RevenueCat säger "Product not found in offerings"**
→ Du har lagt produkten under **Products** men inte lagt den i en **Offering**. Gör Steg D.4 igen.

**"Restore purchases" återställer Premium Gold / Icon-köp**
→ Det är ett FEL — konsumerbara köp får INTE återställas. Dubbelkolla att Type är **Consumable** i App Store Connect, Play Console OCH RevenueCat. Alla tre måste matcha.

**Apple avvisar appen ("Missing Metadata for IAP")**
→ Du har inte fyllt i Review Notes eller laddat upp Screenshot för IAP-produkten. Gå tillbaka till Steg B.4.

---

## Viktigt att veta

- **Konsumerbara IAP återställs INTE.** Det betyder att om en spelare avinstallerar appen och installerar den igen får de INTE tillbaka Premium Gold-paket de köpt. Detta är medvetet — köpet är att öppna ETT paket, inte att äga något permanent. Apple/Google tillåter denna modell explicit för konsumerbara köp.

- **App Store Small Business Program** — Apple tar 15% provision (istället för 30%) om din app tjänar under $1M/år. Anmäl dig på App Store Connect.

- **Skatt och avgifter** — Apple och Google sköter all moms automatiskt. Du får utbetalning ungefär 30 dagar efter månaden där köpet skedde, minus deras provision.
