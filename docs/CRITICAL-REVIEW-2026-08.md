# Kritisk granskning — Dynasty Manager v1.3.0

Genomförd 2026-08-05 mot `main` @ `952ac1d`. Allt nedan är verifierat i koden.
`npm run lint`, `npm run typecheck` och `npm run build` är gröna; testsviten tar
>10 minuter och hann inte slutföras inom granskningen.

Ordnat efter hur mycket det kostar er — inte efter hur svårt det är att fixa.

---

## KRITISKT — spelmekanik som är trasig i produktion

### 1. Halvtidstalet raderas mitt i andra halvlek

`src/engine/match.ts`

`teamTalkModifiers` appliceras på `homeStr`/`awayStr` på två ställen: rad 322–332
(matchstart) och rad 523–534 (halvlekens början). Därefter skrivs `homeStr` och
`awayStr` över av `computeStrengths(...)` på **tio** ställen utan att team
talk-modifierarna appliceras om:

| Rad | Trigger |
|---|---|
| 1075, 1084 | AI:s taktiska reaktion vid minut 60 och 75 |
| 1605, 1634 | rött kort (andra gult / direkt rött) |
| 1663, 1771 | skada (foul-relaterad / icke-foul) |
| 1686, 1788 | AI-byte efter skada |
| 1822, 1843 | AI:s taktiska byte |

`AI_REACTIVITY_MINUTES` innehåller 60 och 75, och gate:n är bara
`club.id !== playerClubId && club.aiManagerProfile` — dvs. den träffar i
praktiken varje match. **Resultat: spelarens halvtidstal har effekt i högst 14
minuter av andra halvlek och försvinner därefter tyst.** Samma bugg gäller
`etMods` i förlängningen (`matchActions.ts:1497`).

Detta är en av få mekaniker där spelaren har direkt agens under matchen. Den
fungerar inte.

### 2. Medical Centre-uppgraderingar påverkar inte matchskador

`src/store/slices/orchestration/matchActions.ts:1092, 1267, 1497`
`src/engine/match.ts:2066`

Alla fyra callsites skickar `hc.facilities` / `ac.facilities` som parametern
`homeMedicalLevel` / `awayMedicalLevel`. `Club.facilities` är en **statisk**
skalär 2–10 som sätts från ligafilerna vid `initGame` och aldrig ändras.

Den uppgraderbara nivån heter `state.facilities.medicalLevel`
(`initGame.ts:580`, `careerSlice.ts:553`, uppgraderas i `systemsSlice.ts:464`,
visas för spelaren som "Medical Center Lv.N" i `PlayerDetail.tsx:986`). Den
används av `weekAdvance.ts:934` för veckoskador och av sponsorvärderingen — men
**aldrig av matchmotorn**.

Konsekvens, med `MEDICAL_INJURY_PREVENTION_PER_LEVEL = 0.015`:

- `medPrevention` i `match.ts:1756` fryses på klubbens startvärde.
- `generateInjuryDetails(isFoul, medLevel)` (`helpers.ts:396`) fryser både
  skadelängd (`Math.floor(medicalLevel/5)`) och återfallsrisk.
- Sex nivåers uppgradering = 9 procentenheters skadesänkning som spelaren
  betalar för och aldrig får. Matchskador är den dominerande skadekällan.

### 3. Uppflyttningsplayoff är två osynliga tärningskast

`src/utils/promotionRelegation.ts:61`

```ts
const matchup = (a: string, b: string) => Math.random() < 0.6 ? a : b;
```

Ingen hänsyn till trupp, form, hemmaplan, skador eller taktik. Ingen match, ingen
ticker, ingen commentary, inget spelarinflytande — och detta gäller **spelarens
eget lag**. Du kan spela 46 seriomgångar i Championship, sluta fyra, och få hela
säsongen avgjord av `Math.random()` två gånger i rad utan att ens se en skärm.

För ett fotbollsmanagerspel är playoff-finalen säsongens känslomässiga höjdpunkt
i tier 2–4. Här är den en osynlig `if`-sats.

### 4. Spanien, Italien, Tyskland och Frankrike har inget playoff alls

Samma fil, rad 31 och 57. Dessa ligor har `playoffSpots: 1`, vilket ger
`playoffCandidates = ids.slice(2, 3)` — exakt ett lag. `simulatePlayoff`
returnerar då kandidaten direkt (`if (candidates.length === 1) return candidates[0]`).

**3:an går alltid upp automatiskt.** La Ligas och Serie B:s riktiga playoff bland
3:e–6:e plats existerar inte i spelet. Verifierat mot alla 45 ligakonfigurationer:

```
Spain  T1(rel=3) <- T2(auto=2,po=1)
Italy  T1(rel=3) <- T2(auto=2,po=1)
Germany T1(rel=3) <- T2(auto=2,po=1)
Germany T2(rel=3) <- T3(auto=2,po=1)
France T1(rel=3) <- T2(auto=2,po=1)
```

Bara England (`po=4`) kör faktiskt en bracket.

---

## HÖGT — kommersiellt och compliance

### 5. Ni säljer "Ad-Free Experience" i en app som inte har reklam

`src/pages/SubscribeOnboarding.tsx:61`

> `{ title: 'Ad-Free Experience', description: 'No banners, no video pre-rolls. Ever.' }`

`ad_free` är dessutom **första** posten i `PRO_FEATURES`
(`config/monetization.ts:161`) och renderas som sådan i `ShopPage.tsx:586`.

`src/utils/ads.ts`: `NATIVE_ADS_READY = false`. AdMob är helt borttaget ur
`package.json` och `Package.swift`. Gratisanvändare ser noll reklam.

Ni tar betalt — abonnemang och engångsköp — för att ta bort något som inte finns.
Det är refund-risk, recensionsrisk, och en rimlig träff på App Store Guideline
2.3.1 (accurate metadata). Ta bort raden tills ads faktiskt lever.

### 6. 35 MB source maps skeppas i IPA:n

- `vite.config.ts:91` — `sourcemap: 'hidden'`
- `capacitor.config.ts:6` — `webDir: 'dist'`
- Ingen städning någonstans i `.github/workflows/ios-testflight.yml` eller
  `scripts/`.

Uppmätt på en ren build: `dist` = **66 MB**, varav **35 MB** i 122 `.map`-filer.
`cap sync ios` kopierar hela `dist` in i app-bundlen.

Två separata problem:
1. Över hälften av nedladdningsstorleken är död vikt. Nedladdningsstorlek är en
   direkt konverteringsfaktor på App Store, särskilt över mobilnät.
2. `'hidden'` tar bara bort `//# sourceMappingURL`-kommentaren — filerna skrivs
   ändå. Hela er källkod ligger läsbar för den som packar upp IPA:n.

Fix: `find dist -name '*.map' -delete` före `cap sync`, eller ladda upp dem till
Sentry och radera dem i samma steg.

### 7. Hela ad-offer-systemet är dead code i shippad build

`AdOfferHost` är monterad i `GameShell` och sätter en 2,5-sekunders timer vid
varje skärmbyte (`AdOfferHost.tsx:79`). `canPrompt` returnerar alltid
`{ allowed: false, reason: 'ads_unavailable' }` eftersom `REWARDED_ADS_USABLE`
är `false` (`adPacing.ts:91`).

Pacinglogiken, modalen, fem placements, `adEngagement` i sparfilen (bumpade
schemat till v79) och 24 enhetstester — allt shippat i 1.3.0 för exakt noll
effekt. Gating-beslutet i `adPacing.ts:78–90` är korrekt resonerat (att släppa
igenom Pro hade varit pay-to-win), men då hör systemet inte hemma i en release.

### 8. `AdOfferHost` gör inte det dess egen dokumentation påstår

Filhuvudet:

> "a budget top-up is offered when the transfer window is open and the budget is low"

Koden (rad 68–71):

```ts
if ((screen === 'transfers' || screen === 'squad') && club && claimable('transfer_budget')) {
  return 'transfer_budget';
}
```

Varken transferfönstret eller budgetnivån kontrolleras. Dagen ads slås på blir
spelare med £200M i kassan tiggda om budget-boost i december på truppskärmen.
Det är exakt det beteende som filens egen kommentar säger tränar spelare att
avfärda popupen på reflex — vilket decay-logiken sedan läser som ointresse.

---

## MEDEL — simulering och realism

### 9. Målsmak-trösklarna staplar fel

`src/engine/match.ts:1342–1354`

Grenarna använder kumulativa trösklar (`CA`, `CA+LR`, `CA+LR+HEADER`, …) men
gate:as var för sig på oberoende villkor (`hasHighLine`, `shooting >= 75`,
`physical >= 70`, `skillMoves >= 4 && pace >= 70`).

När motståndaren saknar hög linje faller den första grenen bort och
long-range-grenen konsumerar `[0, CA+LR)` i stället för `[CA, CA+LR)`. Samma
kaskad för header och solo. Nettoeffekt: långskott och nickmål blir märkbart
vanligare än konstanterna anger, och `free_kick_goal` — som ligger sist — svälts
ut. Frisparksmål är dessutom den enda grenen som respekterar
`club.setPieceTakerId`, så spelarens val av frisparksläggare påverkar mindre än
det ser ut.

### 10. Målvaktsmisstag-mål räknas inte som skott

`src/engine/match.ts:1507–1527`. Grenen ökar `homeGoals`/`awayGoals` men aldrig
`homeShots`/`homeSoT`. Alla andra målgrenar gör det (1298, 1445, 1492, 1712).
Matchstatistiken kan därför visa fler mål än skott.

### 11. En avbruten match kan få mål efter avbrottet

`checkAbandon` (anropad 1607 och 1636) nollställer målen, sätter forfeit 0–3,
strippar målhändelser och nollar spelarstatistik. Men `abandonMatch` bryter
loopen först vid **nästa** minutiteration (rad 1033).

Skadeblocket (1648) och straffblocket (1696) ligger efter i samma iteration.
Ett straff som går in där ger `homeGoals++` **efter** forfeit-nollställningen →
slutresultat 1–3 i stället för 0–3, med ett målskyttestatistik som forfeiten
just påstod sig ha raderat. Sällsynt, men resultatet blir osammanhängande.

### 12. Rött kort, skada eller byte återställer AI:ns taktikbyte

Alla omräkningar på rad 1604, 1633, 1662, 1770, 1685, 1788, 1821, 1842 skickar in
`homeTactics` / `awayTactics` — parametervärdena från halvlekens start, inte de
reaktiva taktiker som sattes vid minut 60/75. Ett rött kort i 70:e minuten
återställer alltså motståndarmanagerns taktikbyte till utgångsläget.

### 13. Skott på mål-andelen är cirka 55 % (verklighet: ~33 %)

`src/engine/match.ts:1286` och `1443`.

Målrullningen har redan vägt in målvakten: `effectiveGoalChance = clampedChance *
(1 - oppGKSave)`. Räddningsgrenen rullar därefter `oppGKSave` **en gång till** på
de skott som inte blev mål.

Med `clampedChance ≈ 0.25` och `GK_SAVE ≈ 0.5`:
`P(mål) = 0.125`, `P(räddning) = 0.875 × 0.5 = 0.4375` → SoT-andel ≈ **56 %**.
Riktig fotboll ligger runt 33 %. Matchstatistiken ser konsekvent fel ut för alla
som känner sporten, vilket är målgruppen.

### 14. Playoff-bracketen seedar bara rätt för exakt fyra lag

`promotionRelegation.ts:74–85`. Det generella fallet parar `remaining[i]` mot
`remaining[i+1]` — dvs. 1 mot 2 och 3 mot 4, inte 1 mot N. Vid udda antal får
sista laget walkover, dvs. den **sämst** placerade får friläge till nästa runda.
Idag räddas ni av att bara `length === 2` och `length === 4` inträffar, men koden
är fel för alla andra konfigurationer.

### 15. "Record Signing"-milstolpen mäter fel sak

`transferSlice.ts:566`

```ts
const isRecordSigning = fee > state.managerStats.totalSpent * RECORD_SIGNING_SPEND_RATIO && fee >= RECORD_SIGNING_MIN_FEE;
```

Jämför mot **karriärens totala utgifter**, inte mot största tidigare övergångssumma.
Första köpet över `MIN_FEE` utlöser den alltid (`totalSpent` är 0). Därefter blir
den allt svårare att utlösa allteftersom `totalSpent` växer — helt oberoende av om
köpet faktiskt är ett klubbrekord. En £120M-signering säsong 8 loggas inte medan
en £15M-signering säsong 1 gör det.

---

## LÅGT — process, prestanda, räckvidd

### 16. `CLAUDE.md` har redan drivit ifrån koden

Filen påstår "Last verified against the codebase 2026-07-29" — en vecka gammal.

| Påstående | Faktiskt |
|---|---|
| save schema v78 | **79** (`saveMigration.ts:15`) |
| 136 testfiler | **165** |
| `weekAdvance.ts` 3 094 LOC | **3 238** |
| `seasonEnd.ts` 1 651 LOC | **1 940** |
| `matchActions.ts` 1 611 LOC | **1 937** |

Ett dokument som säger "trust the code" och sedan är fel på fem punkter efter en
vecka är ett dokument ingen kommer lita på. Antingen genereras siffrorna av ett
skript i preflight, eller så tas de bort.

### 17. Ingen i18n — engelska hårdkodat överallt

Noll `i18next` / `react-intl` / `useTranslation` i hela `src/`. Samtidigt:

- ASO-metadata på 37 locales (`aso-metadata`-skill).
- 45 ligor i 37 länder, riktiga klubbnamn.
- `ios/App/App/*.lproj/InfoPlist.strings` finns redan lokaliserade.

Ni betalar för butikssynlighet på marknader där produkten inte går att spela på
användarens språk. Det syns inte i CPI — det syns i D1-retention och i
recensionerna. Ett managerspel är dessutom textungt: commentary, pressmöten,
styrelsemeddelanden, kontraktsförhandlingar.

### 18. `npm run preflight` är i praktiken oanvändbart

Era egna regler säger att ingen commit får pushas utan preflight. Testsviten
ensam sprang >10 minuter på denna maskin utan att bli klar (165 filer, inklusive
longevity- och stresssviter som simulerar hela säsonger). Med lint + build + size
landar gaten långt över kvarten.

En gate som tar en kvart körs inte. Dela upp: en snabb `preflight` (lint +
typecheck + enhetstester, <60 s) och en `preflight:full` som CI kör.

### 19. Eager bundle har 37,9 kB kvar av budgeten

```
── TOTAL 522.1 kB gz across 8 files (hard limit 560.0 kB)
Eager bundle OK — 37.9 kB gz headroom.
```

`index-BZcY_MUP.js` ensam är **1,28 MB rå / 368 kB gz** — allt som inte
manuellt chunkats hamnar där. Chunkstrategin i `vite.config.ts` är genomtänkt och
väldokumenterad, men huvudchunken är en monolit och taket är 93 % fullt. Nästa
feature spränger det.

Det som faktiskt kostar på en mellanklassmobil är inte nedladdningen utan
parse/compile av ~4 MB rå JS vid kallstart.

### 20. Prenumerationsvalidering är helt klientsidig

`utils/monetization.ts:40–61`. `isSubscriptionExpired` jämför en lokalt cachad
`expiresAt` mot `Date.now()`. Ställ enhetsklockan bakåt → Pro för alltid, offline,
utan att RevenueCat någonsin blir tillfrågad. Samma vektor öppnar Starter
Kit-fönstret på nytt (`isStarterKitAvailable`, rad 218) och nollställer daglig
ad-pacing (`dayKeyFor`).

Logiken kring `UNANCHORED_WINDOW_MS` och `PRO_ONE_TIME_PRODUCT_IDS` är för övrigt
det bäst genomtänkta i hela kodbasen — men den försvarar mot RevenueCats
egenheter, inte mot användaren. Räckvidden av exploiten är begränsad (enbart
lokalt låst innehåll), men den finns.

### 21. AI-spelarnas utveckling batchas till säsongsslutet

`config/aiSimulation.ts` — `AI_SEASON_DEVELOPMENT_PASSES = 12`, körda i klump i
`seasonEnd`. Kommentaren motiverar det väl (veckovis över 756 klubbar är för
dyrt), men konsekvensen är att hela världen står stilla i 46 veckor och hoppar i
juni. Rivalens 19-årige wonderkid utvecklas aldrig medan du följer honom — han
byter bara siffra över natten. För ett spel vars kärnfantasi är att bygga över
tid är det en märkbar förlust av levande värld.

### 22. Online är `comingSoon` — spelet har inget socialt lager

`/mode-select`. Ingen liga mot vänner, ingen leaderboard, ingen delning av
säsongsresultat. Retention i genren drivs tungt av jämförelse och skryträtt.
Detta är inte en bugg, men det är det största hålet i produkten och det är värt
mer än något annat på listan ovan.

---

## Vad som faktiskt är bra

Sagt utan artighet, eftersom det bör bevaras:

- Matchmotorns kommentarhistorik (`match.ts`) dokumenterar tidigare balansbuggar
  med **uppmätta siffror** — mentality som dominant strategi, tempo som delad
  sannolikhet, felaktig sidotilldelning av fouls. Det är ovanligt disciplinerat.
- `isPersistableEntitlement` / `mergeDeviceMonetization` löser
  RevenueCat-fällorna korrekt och av rätt skäl.
- Chunkstrategin i `vite.config.ts` med kommentarer om varför recharts och
  `nationalPlayerPool` medvetet **inte** manuellt chunkas.
- `getFormationFitBonus` som tilldelningsproblem i stället för set cover.
- Cup-veckokoreografin i `data/cup.ts` med explicit motivering.
- `checkAbandon` som faktiskt strippar målhändelser och nollar spelarstatistik i
  stället för att bara ändra siffran.

Problemet är inte hantverket. Det är att de fyra kritiska punkterna ovan sitter i
mekaniker spelaren *ser* — halvtidstal, uppgraderingar, playoff — medan
granskningsenergin har gått till motorns inre.

---

## Föreslagen ordning

1. **#1 team talk** — enrads-helper `applyTeamTalk(str)` som varje omräkning går
   igenom. En timme.
2. **#5 ad-free-påståendet** — ta bort raden. Tio minuter, direkt refund-risk.
3. **#2 medicalLevel** — skicka `state.facilities.medicalLevel` för spelarens
   klubb i alla fyra callsites. En timme.
4. **#6 source maps** — ett steg i `ios-testflight.yml`. Tio minuter, ~35 MB.
5. **#3 + #4 playoff** — kör riktiga matcher via `simulateMatch`, spelarens egna
   playoff genom `MatchDay`. Störst arbete, störst upplevelseeffekt.
