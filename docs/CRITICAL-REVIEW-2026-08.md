# Kritisk granskning — Dynasty Manager v1.3.0

Genomförd 2026-08-05 mot `main` @ `952ac1d`. Allt nedan är verifierat i koden.
`npm run lint`, `npm run typecheck` och `npm run build` är gröna. Testsviten är
också grön — **162 filer passerade, 3 skippade (165), 2 347 tester passerade,
4 skippade** — men tog **1 717 s (28,6 min)** wall clock att köra.

Inget av fynden nedan fångades av någon befintlig gate.

Ordnat efter hur mycket det kostar er — inte efter hur svårt det är att fixa.

## Status

**Åtgärdade (13 av 22):** 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16.
Varje fix bär en regressionstest; de som gick att verifiera negativt kördes mot
koden före fixen och fallerade där.

**Ett extra fynd hittades under arbetet** och är åtgärdat: `abandonMatch` fanns
inte på `HalfState`, så en avbruten första halvlek följdes av en helt normal
andra halvlek och forfeiten ogjordes tyst. Se punkt 11.

**Försökt och medvetet återställt:** 13 (skott på mål). Fixen fungerade men
trippade projektets egen kvalitetsseparations-gate. Detaljer och mätdata står
under punkten — jag flyttade inte tröskeln för att få igenom den.

**Öppna, med skäl:**

| # | Varför inte åtgärdat |
|---|---|
| 13 | Se ovan — kräver att skottvolymen höjs och att fouls/kort/skador mäts om i samma pass |
| 17 | i18n. ~490 filer med hårdkodad engelska. Ett projekt, inte en patch |
| 19 | Eager bundle på 522/560 kB. Inte en bugg utan en budget — kan bara "fixas" genom att ta bort funktionalitet |
| 20 | Server-side kvittovalidering. Kräver backend som inte finns |
| 21 | AI-utveckling batchad till säsongsslut. Dokumenterat prestandaval, inte ett fel |
| 22 | Online-läge. En produktbeslut, inte en fix |
| 18 | Delvis: 28,6 → 6,0 min. Golvet är fast per-fil-overhead (146 s av 359 s); resten kräver att delad state isoleras så `fileParallelism` kan slås på |

---

## KRITISKT — spelmekanik som är trasig i produktion

### 1. Halvtidstalet raderas mitt i andra halvlek

> **ÅTGÄRDAT** i `0cd9cf0`. Alla tio omräkningar går nu genom en
> `recomputeStrengths()` som applicerar om talet via `withTeamTalk()`. Samma
> commit latchar AI:ns reaktiva taktik i `currentHomeTactics`/`currentAwayTactics`
> så punkt 12 nedan också är borta. Regressionstest:
> `src/test/teamTalkPersistence.test.ts` — jämför xG före minut 60 mot xG efter,
> verifierat fallerande på gamla motorn (23,25 mot 23,43, dvs. ingen effekt).

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

> **ÅTGÄRDAT** i `5ed44fb`. `simulateMatch` tar nu explicita
> `homeMedicalLevel`/`awayMedicalLevel`, och `resolveMatchMedical` i
> `matchActions` ger spelarens klubb dess riktiga `facilities.medicalLevel` och
> härleder motståndarens via nya `clubMedicalLevel()`. Samma helper används nu
> av `initGame` och `careerSlice` så skalorna inte kan glida isär.
> Regressionstest: `src/test/medicalLevel.test.ts`.

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

> **ÅTGÄRDAT** i `06c6653`. `simulatePlayoff` tar en `PlayoffTieResolver`;
> `seasonEnd` skickar in en som kör riktiga matcher via `simulateMatch` med
> riktiga trupper och derbyintensitet. Oavgjort efter 90 minuter går till det
> bättre placerade laget.
>
> **Kvar:** spelarens egna playoff spelas fortfarande inte interaktivt genom
> `MatchDay`. Det kräver ny matchfas-state och UI-flöde — en feature, inte en
> buggfix.

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

> **ÅTGÄRDAT** i `06c6653`. Alla fem ligor har nu `playoffSpots: 4` (plats
> 3–6). Guard i `promotionPlayoff.test.ts` mot att någon liga konfigurerar ett
> enlags-playoff, och mot att en playoff-vinnare saknar plats att gå upp till.

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

> **ÅTGÄRDAT** i `61f0cc8`. Både `PRO_FEATURES` och paywallens bullet-lista är
> gate:ade på `NATIVE_ADS_READY` — påståendet kommer tillbaka av sig självt när
> ads faktiskt shippar. `ad_free`-*entitlementet* är orört; bara det betalda
> påståendet är borttaget. Guardrail i `launchCrashGuardrails.test.ts` pinnar
> båda listorna mot flaggan i båda riktningarna.

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

> **ÅTGÄRDAT** i `7440ceb`. `scripts/strip-sourcemaps.mjs` + `npm run
> build:native`; båda mobil-workflowsen kör strip-steget mellan bygget och
> `cap sync`, och `cap:sync` använder `build:native`. Uppmätt lokalt: 66 MB →
> 31 MB. Guardrail i `src/test/sourcemapStripping.test.ts` kräver att varje
> workflow som kör `cap sync` strippar *före* — verifierat genom att flytta
> steget efter och se testet fallera.

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

> **ÅTGÄRDAT** i `add77a6`. `AdOfferHost` monteras bara när
> `REWARDED_ADS_USABLE` är sant.

`AdOfferHost` är monterad i `GameShell` och sätter en 2,5-sekunders timer vid
varje skärmbyte (`AdOfferHost.tsx:79`). `canPrompt` returnerar alltid
`{ allowed: false, reason: 'ads_unavailable' }` eftersom `REWARDED_ADS_USABLE`
är `false` (`adPacing.ts:91`).

Pacinglogiken, modalen, fem placements, `adEngagement` i sparfilen (bumpade
schemat till v79) och 24 enhetstester — allt shippat i 1.3.0 för exakt noll
effekt. Gating-beslutet i `adPacing.ts:78–90` är korrekt resonerat (att släppa
igenom Pro hade varit pay-to-win), men då hör systemet inte hemma i en release.

### 8. `AdOfferHost` gör inte det dess egen dokumentation påstår

> **ÅTGÄRDAT** i `add77a6`. Både transferfönstret och budgetnivån kontrolleras
> nu; "låg budget" uttrycks i veckor av lönebudget (`AD_OFFER_LOW_BUDGET_WAGE_WEEKS`).

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

> **ÅTGÄRDAT** i `2a8e70b`. Kvalificerade smaker samlas först och gås igenom
> som kumulativa band, så var och en får exakt sin konfigurerade sannolikhet.

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

> **ÅTGÄRDAT** i `2a8e70b`. Invariant-test: varje mål är på mål eller ett
> självmål.

`src/engine/match.ts:1507–1527`. Grenen ökar `homeGoals`/`awayGoals` men aldrig
`homeShots`/`homeSoT`. Alla andra målgrenar gör det (1298, 1445, 1492, 1712).
Matchstatistiken kan därför visa fler mål än skott.

### 11. En avbruten match kan få mål efter avbrottet

> **ÅTGÄRDAT** i `2a8e70b` — och regressionstestet avslöjade en värre variant
> som granskningen missade: `abandonMatch` var en lokal i `simulateHalf` och
> fanns inte på `HalfState`, så andra halvlek återupptog och spelade vidare.
> Forfeiten ogjordes tyst (reproducerat: mål i minut 82 i en avbruten match).
> `HalfState` bär nu flaggan.

`checkAbandon` (anropad 1607 och 1636) nollställer målen, sätter forfeit 0–3,
strippar målhändelser och nollar spelarstatistik. Men `abandonMatch` bryter
loopen först vid **nästa** minutiteration (rad 1033).

Skadeblocket (1648) och straffblocket (1696) ligger efter i samma iteration.
Ett straff som går in där ger `homeGoals++` **efter** forfeit-nollställningen →
slutresultat 1–3 i stället för 0–3, med ett målskyttestatistik som forfeiten
just påstod sig ha raderat. Sällsynt, men resultatet blir osammanhängande.

### 12. Rött kort, skada eller byte återställer AI:ns taktikbyte

> **ÅTGÄRDAT** i `0cd9cf0` tillsammans med punkt 1 — samma kodväg.

Alla omräkningar på rad 1604, 1633, 1662, 1770, 1685, 1788, 1821, 1842 skickar in
`homeTactics` / `awayTactics` — parametervärdena från halvlekens start, inte de
reaktiva taktiker som sattes vid minut 60/75. Ett rött kort i 70:e minuten
återställer alltså motståndarmanagerns taktikbyte till utgångsläget.

### 13. Skott på mål-andelen är cirka 55 % (verklighet: ~33 %)

> **FÖRSÖKT OCH ÅTERSTÄLLT.** Jag byggde fixen, mätte den, och backade den.
>
> Uppmätt före (250 matcher, två jämnstarka 70-lag): 20,1 skott, 9,6 på mål,
> 2,88 mål → **47,5 % SoT** (min uppskattning i granskningen var 55 % — den var
> för hög) och 6,7 räddningar/match mot verklighetens 3–4. Efter fixen:
> 33,6 % SoT, 4,0 räddningar. Men projektets egen `matchRealism`-svit failade:
> kvalitetsseparationen föll till 55,75 % vinstandel mot tröskeln 58 %.
> Verifierat att det var **min** ändring, inte flakighet — testet passerar på
> koden före. Kanalen är att extra events i flödet ändrar
> gap-filler-commentary, som ändrar momentum, som matar event share.
>
> Att flytta testtröskeln för att få igenom ändringen vore att avväpna den vakt
> som just gjorde sitt jobb. Fyndet står därför kvar som öppet.
>
> **Det mätningen lärde mig, som är värt mer än fixen:** den djupare orsaken är
> att skottvolymen är låg — 20/match mot verklighetens ~25. Med bara 20 skott
> går det inte att samtidigt träffa 34 % SoT och 32 % konvertering vid
> realistiska 2,8 mål; de tre är överbestämda. Rätt åtgärd är att höja volymen
> (`SHOT_ATTEMPT_THRESHOLD` / `BASE_EVENT_CHANCE`) och mäta om fouls, kort och
> skador i samma pass — inte att pilla på räddningsgrenen.

`src/engine/match.ts:1286` och `1443`.

Målrullningen har redan vägt in målvakten: `effectiveGoalChance = clampedChance *
(1 - oppGKSave)`. Räddningsgrenen rullar därefter `oppGKSave` **en gång till** på
de skott som inte blev mål.

Med `clampedChance ≈ 0.25` och `GK_SAVE ≈ 0.5`:
`P(mål) = 0.125`, `P(räddning) = 0.875 × 0.5 = 0.4375` → SoT-andel ≈ **56 %**.
Riktig fotboll ligger runt 33 %. Matchstatistiken ser konsekvent fel ut för alla
som känner sporten, vilket är målgruppen.

### 14. Playoff-bracketen seedar bara rätt för exakt fyra lag

> **ÅTGÄRDAT** i `06c6653`. Seedning är 1vN med vinnare omsorterade mellan
> ronder; bye:n går till toppseedet.

`promotionRelegation.ts:74–85`. Det generella fallet parar `remaining[i]` mot
`remaining[i+1]` — dvs. 1 mot 2 och 3 mot 4, inte 1 mot N. Vid udda antal får
sista laget walkover, dvs. den **sämst** placerade får friläge till nästa runda.
Idag räddas ni av att bara `length === 2` och `length === 4` inträffar, men koden
är fel för alla andra konfigurationer.

### 15. "Record Signing"-milstolpen mäter fel sak

> **ÅTGÄRDAT** i `add77a6`. `managerStats.biggestSigningFee` (schema v80) är
> referensen. Migration + predikattest i `recordSigning.test.ts`.

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

> **ÅTGÄRDAT.** `scripts/check-docs-drift.mjs` verifierar de räknebara
> påståendena; `npm run docs:check -- --fix` uppdaterar dem. Ligger i preflight,
> så filen kan inte tyst driva igen. Sju påståenden rättades.

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

> **DELVIS ÅTGÄRDAT.** `preflight` kör nu `test:fast` (28,6 min → **6,0 min**,
> 156 filer gröna) och `preflight:full` kör allt. Fjorton långkörande sviter —
> flersäsongssimuleringar och balanssvep — ligger i `SLOW_SUITES` i
> `vitest.config.ts`, valda utifrån uppmätt tid per fil, inte gissning.
>
> **Rättelse till mitt eget påstående ovan:** jag skrev att sviten är
> "CPU-bunden". Den är det inte — `vitest.config.ts` sätter
> `fileParallelism: false`, alltså seriell körning by design. Filtid *är*
> wall clock. Det är avsiktligt (delad modulnivå-state i real-player-claims och
> den primade genererade datan), så det är inte något att bara slå på.
>
> 6,0 min är fortfarande inte en per-commit-gate, och att exkludera mer hjälper
> inte: av de 359 sekunderna är bara 194 s faktisk testtid. Resten (~146 s) är
> fast overhead — `transform` + `collect` + jsdom-`environment` per fil under
> `pool: 'forks'` med seriell körning. Golvet ligger där, och att sänka det
> kräver att den delade modulnivå-state:n isoleras så `fileParallelism` kan slås
> på.

Era egna regler säger att ingen commit får pushas utan preflight. Uppmätt på
denna maskin:

```
Test Files  162 passed | 3 skipped (165)
     Tests  2347 passed | 4 skipped (2351)
  Duration  1717.67s (transform 29.86s, setup 6.95s, collect 51.66s,
                      tests 1534.82s, environment 79.95s, prepare 10.22s)
```

**28,6 minuter för testsviten ensam.** Med lint + typecheck + build + size:check
ovanpå landar gaten runt halvtimmen.

Den första mätningen hade en annan vitest-körning överlappande, så jag noterade
28,6 min som en övre gräns under CPU-kontention. En ren körning efteråt — enda
processen på maskinen, med de tre nya testfilerna tillagda — landade på
**1 717,97 s**, alltså 0,3 sekunder från den första:

```
Test Files  165 passed | 3 skipped (168)
     Tests  2359 passed | 4 skipped (2363)
  Duration  1717.97s (transform 16.28s, setup 6.40s, collect 47.72s,
                      tests 1539.67s, environment 80.17s, prepare 9.94s)
```

**Kontentionen betydde ingenting — 28,6 min är den faktiska siffran, inte ett
tak.** `tests ≈ 1 535 s` av 1 718 s wall clock i båda körningarna säger varför:
parallelliseringen ger nästan noll, sviten är CPU-bunden på riktiga
säsongssimuleringar. Per-fil-attribuering går inte att få ur dessa körningar
(reporter-outputen trunkerades); kör `vitest run --reporter=verbose` och sortera
för att hitta de tyngsta filerna.

Sviten är alltså **grön och grundlig** — det är inte kvaliteten som är problemet.
Problemet är att en gate som tar en halvtimme inte körs, och då är den ingen
gate. Dela upp: snabb `preflight` (lint + typecheck + enhetstester, <60 s) för
varje commit, och `preflight:full` med longevity-/stress-sviterna i CI.

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

**Klart på den här grenen** — 13 av 22 fynd, plus ett upptäckt under arbetet:

| Fynd | Commit |
|---|---|
| #1 team talk + #12 AI-taktik | `0cd9cf0` |
| #2 medicalLevel | `5ed44fb` |
| #5 ad-free-påståendet | `61f0cc8` |
| #6 source maps | `7440ceb` |
| #9 + #10 + #11 + abandon-läckaget | `2a8e70b` |
| #3 + #4 + #14 playoff | `06c6653` |
| #7 + #8 ad-offer + #15 Record Signing | `add77a6` |
| #16 dokumentationsdrift + #18 preflight | `1b6ea42` |

**Kvar, i den ordning jag skulle ta dem:**

1. **#13 skott på mål** — börja med skottvolymen, inte räddningsgrenen. Höj
   `SHOT_ATTEMPT_THRESHOLD` / `BASE_EVENT_CHANCE` mot ~25 skott/match och mät om
   mål, fouls, kort och skador i samma pass. Mätdata och det misslyckade
   försöket står under punkten. Ta #9:s smakfördelning som referens — den är nu
   korrekt och bör inte röras igen.
2. **#3 resten** — spelarens egna playoff genom `MatchDay`. Ligan avgörs nu av
   riktiga matcher, men spelaren ser fortfarande inte sin egen. Det är den
   enskilt största kvarvarande upplevelseluckan.
3. **#18 resten** — isolera den delade modulnivå-state:n (real-player claims,
   den primade genererade datan) så `fileParallelism` kan slås på. Det är vad
   som står mellan 6 minuter och något som faktiskt körs varje commit.
4. **#17 i18n** — det största av allt, och det som mest direkt kostar pengar:
   ASO-metadata på 37 språk mot en produkt som bara finns på engelska. Börja med
   att extrahera strängar i `pages/` och `components/game/`; motorn och config
   behöver aldrig översättas.
5. **#22 online** — produktbeslut, inte en fix. Men det är det största hålet i
   produkten och värt mer än allt annat på den här listan.

**Inte planerade:** #19 (bundlebudget — inte en bugg), #20 (kräver backend),
#21 (dokumenterat prestandaval).
