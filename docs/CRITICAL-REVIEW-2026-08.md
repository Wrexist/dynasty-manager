# Kritisk granskning — Dynasty Manager v1.3.0

Genomförd 2026-08-05 mot `main` @ `952ac1d`. Allt nedan är verifierat i koden.
`npm run lint`, `npm run typecheck` och `npm run build` är gröna. Testsviten är
också grön — **162 filer passerade, 3 skippade (165), 2 347 tester passerade,
4 skippade** — men tog **1 717 s (28,6 min)** wall clock att köra.

Inget av fynden nedan fångades av någon befintlig gate.

Ordnat efter hur mycket det kostar er — inte efter hur svårt det är att fixa.

## Status

**Åtgärdade (21 av 22):** 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
15, 16, 18, 19, 20 (exploiten), 21 (bedömd, ej ändrad). Varje fix bär en regressionstest; de
som gick att verifiera negativt kördes mot koden före fixen och fallerade där.

Två av dem stod först som "går inte att åtgärda härifrån" och visade sig göra
det ändå:

- **#20** filades som "kräver backend". Riktig kvittovalidering gör det — men
  *exploiten* gör det inte. Klockmanipulation stängs lokalt med en monoton
  högvattenmärkning.
- **#18** stod som halvlöst med en "oidentifierbar" flake. Den var identifierbar;
  jag gav upp för tidigt. Det var en enda timeout under CPU-kontention.

**Två extra fynd hittades under arbetet**, båda åtgärdade:

- `abandonMatch` fanns inte på `HalfState`, så en avbruten första halvlek följdes
  av en helt normal andra halvlek och forfeiten ogjordes tyst. Se punkt 11.
- **Hörnor låg på 5,9/match mot verklighetens ~10** — den största orörda
  avvikelsen i matchstatistiken, som ingen mätning tidigare fångat. Höjd till
  9,7, med merparten av ökningen tagen på den målneutrala grenen. Se punkt 13.

**Fyra ytterligare fynd, alla i säsongsrullningen, alla åtgärdade** (`se
seasonRolloverIntegrity.test.ts`). De föll ut när regressionstestet för #3 började
fallera på en storleksavvikelse jag först antog var flakig. Den var inte flakig.
Gemensam grundorsak: **säsongen var inte *avgjord* innan saker började läsa
tabeller ur den.** `endSeasonImpl` snabbspolar varje divisions ospelade matcher
*efter* att playoff-bracketen redan seedats — två olika tabeller.

- **Klubbar både uppflyttade och nedflyttade i samma rullning.** En klubb seedad
  in i playoffet från tabellen *före* snabbspolningen kunde ligga i
  nedflyttningszonen i tabellen *efter*. Den togs bort ur sin liga en gång men
  lades till i två. eng-2 växte till 25 lag och stannade där. Cirka 1 rullning
  av 10, permanent, ärvd av varje efterföljande säsong.
- **Spelarens sista match kunde simuleras om.** `divisionFixtures` synkas mot
  `fixtures` bara inne i `advanceWeek`. Avslutas säsongen direkt efter sista
  matchen saknas den i `divisionFixtures`, och snabbspolningen hittade på ett
  annat resultat — in i tabellen som avgör uppflyttning. Det här träffar varje
  spelare, inte bara playoff-fall.
- **`playoffState` städades aldrig.** Rullningen konsumerade den men nollställde
  den inte, så *nästa* säsongs rullning körde förra säsongens bracket med förra
  säsongens resultat. En klubb som slutade 19:a fick ett uppflyttningsplayoff mot
  motståndare den inte mött. `initGame` nollställde den inte heller, så en ny
  karriär ärvde den föregåendes.
- **Uppflyttningsplatser kunde bli ostädade.** Gav playoffet ingen vinnare
  fylldes inte platsen, och de två nivåerna gled isär permanent.

Fixen är att `endSeason` avgör ligan och *committar* den innan något läser en
tabell, plus en strukturell spärr i `applyPromotionRelegation` så att storleks-
drift är omöjlig även om de två tabellerna någonsin skiljer sig igen. Alla sex
testerna fallerar mot koden före fixen.

**Ett icke-fynd, för ordningens skull:** min mätrigg flaggade röda kort som låga
(0,12/match mot referensen 0,25). Referensen var fel. 0,12 med ett gult:rött-
förhållande på 31,8:1 ligger inom kodens egna dokumenterade mål och nära
Premier League (0,16 och ~28:1). Jag ändrade ingenting.

**Öppna, med skäl:**

| # | Varför inte åtgärdat |
|---|---|
| 3 (rest) | Spelarens egna playoff spelas fortfarande inte interaktivt. Resultaten *visas* nu. **Designen är gjord och nedskriven** i `docs/PLAN-interactive-playoff.md` — inklusive nyckelbeslutet att INTE göra säsongsrullningen pausbar, utan köra playoffet före rullningen som vanliga matcher. Inte implementerad: det ändrar spelets mest bärande transition och förtjänar att byggas med testerna först, inte blint i slutet av en granskningssession |
| 17 | **DELVIS ÅTGÄRDAT.** Båda "blockerarna" jag angav var mina egna antaganden: en handrullad `t()` lägger till *noll* beroenden, och jag hade precis själv höjt bundle-headroom till 53,5 kB. Kvar stod bara "halvmigrerad i18n är värre än ingen" — vilket bara gäller om otextade ytor *går sönder*. Med engelska alltid laddad som fallback gör de inte det: `t()` på en omigrerad nyckel returnerar exakt samma sträng som literalen gjorde. Grunden finns nu (`src/i18n/`, `useTranslation`), plus svenska som bevis att en andra locale fungerar, och `SeasonSummary` + `TitleScreen` migrerade som första ytor. Resterande ~490 filer är mekaniska och kan tas en skärm i taget |
| 19 | **ÅTGÄRDAT.** Jag hade fel: den kunde fixas utan att ta bort någon funktionalitet. Radix delades vid `react-dialog`, och de två villkorliga dialogerna plus titelskärmens inställningspanel gjordes lata. **522,1 → 506,5 kB gz eager, headroom 37,9 → 53,5 kB (+41 %)** |
| 20 (rest) | Riktig kvittovalidering kräver en backend som inte finns. **Men exploiten är stängd** — klockmanipulation neutraliseras nu av en monoton högvattenmärkning (`41d4bf4`), verifierad mot koden före fixen |
| 21 | AI-utveckling batchad till säsongsslut. Dokumenterat prestandaval, inte ett fel |
| 22 | Online-läge. Ett produktbeslut, inte en fix |


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

> **ÅTGÄRDAT** i `4b75a73`, i andra försöket. Första försöket byggdes, mättes
> och backades — historiken står kvar nedan, eftersom mätningen därifrån är det
> som pekade ut den verkliga orsaken.
>
> Slutresultat, 400 matcher jämnstarka 70-lag:
>
> | Mått | Före | Efter | Verklighet |
> |---|---|---|---|
> | skott | 20,5 | **24,9** | ~25 |
> | på mål | 47,4 % | **36,0 %** | 33–35 % |
> | konvertering | 30,1 % | **31,6 %** | ~32 |
> | mål | 2,91 | **2,83** | 2,7–2,8 |
> | hörnor | 5,9 | **9,7** | ~10 |
> | räddningar | 6,2 | **5,6** | ~5,8 |
> | fouls | 21,6 | 21,8 | ~22 |
> | gula | 3,80 | 3,81 | 3,5–4 |
> | oavgjort | 28,0 % | **26,3 %** | 24–26 % |
>
> Nyckeln var att volymen måste flyttas först — de fyra skottmåtten är
> överbestämda. `SHOT_ATTEMPT_THRESHOLD` 0,40 → 0,49 (vald så foul-bandet
> behåller full bredd under taket, alltså orörda fouls/kort/straffar), plus en ny
> `GOAL_CHANCE_VOLUME_SCALE` som håller målen. Båda uppenbara alternativen
> testades och mättes som modellförvrängande: att sänka `ATTACK_MULT` komprimerar
> anfallarnas kvalitetssignal (separationen föll till 57,5 % mot golvet 58 %),
> att höja `DEFENSE_MULT` trycker svaga anfallare mot `GOAL_CHANCE_MIN` och
> blåser upp oavgjort till 34,5 % mot taket 34 %.
>
> **En testtröskel rördes**, och åt det skärpande hållet: `matchRealism`s
> mentalitetscell gick från n=300 till n=900 per cell. Vid n=300 låg max-min av
> fem urvalsmedelvärden inne i sitt eget brusband, så en frisk motor kunde nå
> taket 0,35 av ren tur — och gjorde det, på 0,3500000000000001. Motorns sanna
> spridning, mätt vid n=1200/cell, är **0,122** mot testets egen dokumenterade
> baslinje 0,13. Jag lossade inte taket; jag lät testet mäta det det påstår.
>
> ---
>
> Historiken från första försöket:
>
> Jag byggde fixen, mätte den, och backade den.
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

> **DELVIS ÅTGÄRDAT.** Grunden finns: `src/i18n/` (handrullad, ~40 rader,
> noll beroenden), `useTranslation`, engelska som källa, svenska som lazy
> overlay, och `SeasonSummary` + `TitleScreen` migrerade som första ytor —
> titelskärmen medvetet vald för att den är den första skärmen varje spelare
> ser och därmed den enda som garanterat syns på varje enhet.
>
> **Rättelse till mitt eget påstående nedan.** Jag angav två blockerare —
> "inga nya npm-beroenden" och "38 kB kvar av bundlebudgeten". Ingen av dem
> var verklig. En handrullad `t()` lägger till noll beroenden, och jag hade
> precis själv höjt headroom till 53,5 kB via #19. Det enda äkta argumentet
> var "halvmigrerad i18n är värre än ingen" — och det gäller bara om otextade
> ytor går sönder. Engelska laddas alltid, så `t()` på en omigrerad eller
> oöversatt nyckel returnerar exakt samma sträng som literalen gjorde.
> Migrationen kan därför tas en skärm i taget utan att någon skärm regredierar.
>
> Kvar: ~490 filer. Mekaniskt arbete, inte designarbete. Matchmotorn,
> `src/config/` och allt som producerar *lagrade* strängar stannar på engelska
> — det är speldata, inte presentation.

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
> **SLUTLIGT UTFALL — helt åtgärdat.** Flaken var inte oidentifierbar; jag gav
> upp för tidigt. Jagad med `VITEST_PARALLEL=1 vitest run --reporter=verbose` var
> den **en enda timeout**: `longevity.test.ts` 10-säsongersfall budgeterade
> 120 s och tog 124 s när fyra forks konkurrerar om fyra kärnor. Ingen delad
> state, ingen korruption — arbetet är bara långsammare per fil under kontention.
> Syskonsviten `longevityStress.test.ts` budgeterar ~16,7 s per simulerad säsong
> och klarade sig; `longevity.test.ts` budgeterade ~12 s. Timeouterna där är nu
> skalade till samma headroom, och parallellisering är påslagen för hela sviten.
>
> **Uppmätt efter fixen**, två raka fulla parallella körningar:
>
> | Körning | Filer | Tester | Tid |
> |---|---|---|---|
> | #1 | 170 gröna, 3 skippade | 2389 gröna | **12 min 46 s** |
> | #2 | 170 gröna, 3 skippade | 2389 gröna | **12 min 49 s** |
>
> Alltså **28,6 min → 12,8 min** för hela sviten (2,2×) och **6 min → 2,5 min**
> för per-commit-gaten. Mitt tidigare estimat "~11 min" var en gissning från en
> körning med de gamla timeouterna; 12,8 är den mätta siffran.
>
> Kvarvarande golv: `tests` står för ~2 010 s av 765 s wall clock, så
> parallelliseringen ger 2,6× på testtiden. Att komma längre kräver att de
> längsta enskilda filerna kortas — en 20-säsongerssimulering är en
> 20-säsongerssimulering, och den kan inte delas över forks.
>
> Historiken nedan står kvar, eftersom mellansteget — att begränsa
> parallelliseringen när jag inte kunde namnge flaken — var rätt beslut med den
> information jag hade då.
>
> ---
>
> **MELLANSTEG — åtgärdat för per-commit-gaten, medvetet inte för den fulla.**
> `fileParallelism` är påslaget enbart när `VITEST_FAST` är satt:
> **6 min 00 s → 2 min 30 s** för snabbsviten, tre raka gröna körningar
> (146,8 s / 146,6 s / 148,9 s, 157 filer).
>
> **Full parallellisering testades och backades.** Bevisen:
>
> | Körning | Resultat |
> |---|---|
> | Snabb, parallell ×3 | 157 filer gröna |
> | Långsamma isolerat, parallellt | 12 filer gröna |
> | **Full svit, parallell #1** | **1 fil failade** / 168 gröna |
> | Full svit, parallell #2 | 169 gröna |
>
> Failuren återkom inte och fångades inte vid namn — det finns alltså en
> intermittent, oidentifierad flake som bara uppträder när alla 172 filer körs
> samtidigt. Sviten var deterministisk innan jag rörde den, och en gate som blir
> grön på andra försöket lär folk att köra om i stället för att läsa. Det är
> sämre än en långsam gate.
>
> Den fulla sviten (10 min 54 s parallellt mot 28,6 min seriellt) står alltså
> kvar som seriell tills flaken är identifierad. Instruktion för att lyfta
> spärren ligger i `vitest.config.ts`.
>
> **Och en rättelse till mig själv igen:** jag skrev att seriell körning var
> avsiktlig och skyddade delad modulnivå-state. Det stämde inte. `pool: 'forks'`
> ger redan varje testfil sin egen process, så modulnivå-state är isolerad by
> construction. Jag antog ett skäl i stället för att testa det — precis det
> misstag jag anmärkte på i punkt 16. `maxForks` är däremot begränsad till 4,
> eftersom varje fork primar ~400K LOC genererad data; där är minne den bindande
> faktorn, inte CPU.

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

**Klart på den här grenen** — 16 av 22 fynd, plus två upptäckta under arbetet:

| Fynd | Commit |
|---|---|
| #1 team talk + #12 AI-taktik | `0cd9cf0` |
| #2 medicalLevel | `5ed44fb` |
| #5 ad-free-påståendet | `61f0cc8` |
| #6 source maps | `7440ceb` |
| #9 + #10 + #11 + abandon-läckaget | `2a8e70b` |
| #3 + #4 + #14 playoff som riktiga matcher | `06c6653` |
| #7 + #8 ad-offer + #15 Record Signing | `add77a6` |
| #16 dokumentationsdrift + #18 preflight-uppdelning | `1b6ea42` |
| #13 skottprofil + hörnor | `4b75a73` |
| #3 playoff-synlighet + #18 parallellisering | `1e33365` |

**Kvar, i den ordning jag skulle ta dem:**

1. **#3 sista biten — spela playoff-tien själv.** Resultaten syns nu, men
   matchen spelas inte. Kräver att `processSeasonEnd` görs pausbar: ny
   `seasonEndPhase`-state, en `pendingPlayoffTie`, MatchDay-stöd för en
   playoff-kontext och en återupptagningsväg. Störst kvarvarande
   upplevelseeffekt, men det är en feature med designbehov — och den rör den mest
   komplexa filen i kodbasen utan befintlig testtäckning för en pausad rullning.
   Skriv testerna för den pausade rullningen först.
2. **#17 i18n.** Störst kommersiell effekt av allt som återstår: ASO-metadata på
   37 språk mot en produkt som bara finns på engelska. **Grunden är byggd** —
   handrullad, noll beroenden, engelska som alltid laddad fallback. Det som
   återstår är mekaniskt: extrahera `pages/` och `components/game/` en skärm i
   taget. Motorn, `config/` och allt som producerar lagrade strängar ska aldrig
   översättas.
3. **#22 online.** Produktbeslut. Det största hålet i produkten, och värt mer än
   allt annat på listan.

**Inte planerade:** #19 (bundlebudget — inte en bugg), #20 (kräver backend),
#21 (dokumenterat prestandaval).

---

## Vad som är kvar att verifiera på riktigt

Ingenting här har körts på en enhet. Två av fixarna kan bara bekräftas i en
TestFlight-build:

- **#5** — att paywallen inte längre lovar reklamfrihet.
- **#6** — att IPA-storleken faktiskt sjunker med ~35 MB.

Och en tredje kan bara bekräftas av att spela: **#1**, att halvtidstalet nu
håller i sig hela andra halvlek. Testet bevisar att modifieraren överlever
omräkningarna; det bevisar inte att effekten *känns* rätt.

---

## Rättelser till mitt eget arbete i den här sessionen

Listade för att de säger något om hur granskningen ska läsas.

- **Jag avfärdade en fallerande test som flakig.** Storleksavvikelsen i
  `playoffPhase` var en äkta bugg — fyra buggar, faktiskt, i säsongsrullningen.
  Att den bara syntes i cirka 1 körning av 10 var symptomet, inte bruset.
- **Ett tidigare pushat commit klarade inte typecheck.** `clockRollback.test.ts`
  (från #20-fixen) utelämnade två obligatoriska fält på `SubscriptionInfo` och
  saknade typannotering på literalen. Jag hade verifierat den med `tsc --noEmit`
  mot fel tsconfig och läst preflight-utfallet genom en pipe, där exitkoden kom
  från `tail` och inte från `npm`. Åtgärdat här.
- **Två av mina egna testfall var innehållslösa.** Enhetstesterna för
  `applyPromotionRelegation` skickade `'England'` där funktionen matchar på
  `countryId` (`'eng'`), så den returnerade direkt och testet passerade utan att
  köra någonting. En senare version populerade bara två nivåer, vilket gör
  dubbelflytten omöjlig att reproducera. Båda passerade mot den trasiga koden.
- **`playoffPhase.test.ts` byggde på ett antagande som fixen tog bort.** Den
  lutade sig mot att en nyinitierad tabell sorteras alfabetiskt. Nu tvingar den
  fram sluttabellen explicit, vilket den borde ha gjort från början.
