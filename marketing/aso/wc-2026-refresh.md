# App Store ASO — World Cup 2026 window refresh (EN / ES / PT)

> **Paste-ready** App Store Connect metadata for the closing WC-2026 search
> window. App Store id **6760918006**. Every field is char-counted against
> Apple's limit `[n/limit]`.
>
> **Positioning wedge (leads every locale):** World Cup 2026 mode · the
> no-grind pillar — *"No energy timers. No rest packs. No waiting."* · and the
> subscription wedge — full management depth **without a subscription**.
> Competitors are **never named** (Apple rejects competitor names in metadata),
> so the wedge is phrased generically ("deep management sim, no subscription
> required"), never "Football Manager" or "Netflix".
>
> **Claims are accurate to the build** (checked `src/config/monetization.ts`):
> the game IS free to download (Pro one-time/subscription + cosmetic/consumable
> packs are IAP), there ARE no energy/stamina timers or rest-pack mechanics, and
> WC-2026 mode ships. We say **"Free to download"**, never "completely free".
>
> **Trademark note:** "World Cup" is used here as a descriptive competition
> phrase, no FIFA marks/logos/"official" claims. If you prefer near-zero IP
> exposure, `marketing/world-cup/ASO-appstore-copy.md` (Variant B) swaps in
> "World Championship / Mundial / Copa" — this file is the aggressive,
> maximum-search-capture variant. Pick one and keep the in-app mode name
> consistent with what you publish.
>
> **What needs a build vs. not:** Subtitle, Promotional Text and Keywords are
> editable in App Store Connect **without** a binary submission — set them the
> day the window opens and revert after the final. Title, Description and
> "What's New" require a metadata/version submission.

---

## 🇬🇧 English (U.S. — primary; mirror to en-GB)

### Title `[23/30]`
```
Dynasty Manager: Soccer
```
*Brand-locked. "Soccer" captures US search; use `Dynasty Manager: Football`
for en-GB. Window-only aggressive test: `Dynasty Manager: World Cup` `[26/30]`.*

### Subtitle `[22/30]`
```
World Cup 2026 Manager
```

### Promotional Text `[166/170]`  *(editable without a new build)*
```
World Cup 2026 mode is live. Take any nation from the group stage to a penalty-shootout final. No energy timers. No rest packs. No waiting. Deep sim, no subscription.
```

### Keywords `[95/100]`  *(comma-separated, no space after commas; words already in Title/Subtitle are omitted — Apple indexes those separately)*
```
world cup,soccer,national team,penalty shootout,tactics,career,league,squad,formation,transfers
```

### Description — intro paragraph (prepend to the existing description body) `[305 chars]`
```
World Cup 2026 mode is here: pick any of 50+ nations and chase glory from the group stage to a penalty-shootout final. Dynasty Manager is a deep football management sim — no energy timers, no rest packs, no waiting. Play as much as you want. Full management depth without a subscription. Free to download.
```

---

## 🇪🇸 Español (LatAm-leaning — es-MX / es-ES)

> Natural football-Spanish, not a literal translation: *Mundial* (World Cup),
> *selección* (national team), *director técnico / DT*, *plantilla*, *fichajes*,
> *penales*. Keyword field uses unaccented forms to match accented and
> unaccented queries; visible copy keeps accents.

### Title `[23/30]`
```
Dynasty Manager: Fútbol
```

### Subtitle `[22/30]`
```
Dirige el Mundial 2026
```

### Promotional Text `[164/170]`  *(editable without a new build)*
```
Ya llegó el Mundial 2026. Lleva a tu selección de la fase de grupos a la final por penales. Sin barras de energía. Sin esperas. Simulador profundo, sin suscripción.
```

### Keywords `[97/100]`
```
mundial,futbol,director tecnico,seleccion,penales,tactica,carrera,liga,plantilla,fichajes,manager
```

### Description — párrafo de introducción `[333 chars]`
```
El modo Mundial 2026 ya está aquí: elige entre más de 50 selecciones y busca la gloria desde la fase de grupos hasta una final por penales. Dynasty Manager es un simulador de fútbol profundo, sin barras de energía, sin paquetes de descanso y sin esperas. Juega todo lo que quieras. Profundidad total sin suscripción. Descarga gratis.
```

---

## 🇧🇷 Português (Brasil — pt-BR)

> Football-Portuguese: *Copa* / *Copa do Mundo*, *seleção*, *técnico*, *elenco*,
> *escalação*, *pênaltis*, *contratações*. Keyword field unaccented.

### Title `[24/30]`
```
Dynasty Manager: Futebol
```

### Subtitle `[19/30]`
```
Comande a Copa 2026
```

### Promotional Text `[169/170]`  *(editable without a new build)*
```
A Copa 2026 chegou. Leve sua seleção da fase de grupos até a final nos pênaltis. Sem barras de energia. Sem esperas. Um simulador com profundidade total, sem assinatura.
```

### Keywords `[92/100]`
```
copa do mundo,futebol,tecnico,selecao,penaltis,tatica,carreira,liga,elenco,escalacao,manager
```

### Description — parágrafo de introdução `[308 chars]`
```
O modo Copa 2026 chegou: escolha entre mais de 50 seleções e busque a glória da fase de grupos até uma final nos pênaltis. Dynasty Manager é um simulador de futebol profundo, sem barras de energia, sem pacotes de descanso e sem esperas. Jogue o quanto quiser. Profundidade total sem assinatura. Baixe grátis.
```

---

## 📸 Screenshot plan (5 panels, 1290×2796 — 6.9"; App Store Connect down-scales)

Capture in-app (Settings → Cinematic where available), one caption overlay per
panel. Order matters: emotional peak first (Apple shows 1–3 in search results).

| # | Screen to capture | Where in-app | EN caption | ES caption | PT caption |
|---|---|---|---|---|---|
| 1 | **Trophy lift** — World Champions result | `WorldCupResult` (champion) | Win the World Cup 2026 | Gana el Mundial 2026 | Vença a Copa 2026 |
| 2 | **Penalty shootout** — decisive kick, stakes chip | `PenaltyShootout` | Nerve-shredding shootouts | Penales de infarto | Pênaltis de tirar o fôlego |
| 3 | **WC bracket** — knockout tree | Continental / WC bracket view | Any of 50+ nations | Más de 50 selecciones | Mais de 50 seleções |
| 4 | **Live match** — minute clock, tactics | `MatchDay` | Manage every minute | Dirige cada minuto | Comande cada minuto |
| 5 | **Squad** — FUT-style cards, ratings | `SquadPage` | No timers. No waiting. | Sin límites. Sin esperas. | Sem timers. Sem esperas. |

**Caption style:** short overlay banded top or bottom, gold-on-dark to match the
in-app glass UI. Keep the no-grind pillar on the last panel — it's the scroll-stop
differentiator, and it reads even after the tournament ends.

---

## Rollout checklist

1. **Now (no build):** set Subtitle + Promotional Text + Keywords for en-US,
   en-GB, es-MX, es-ES, pt-BR. These flip live immediately.
2. **Next metadata submission:** Title + Description intro (prepend to the
   existing body) + the "What's New" WC block in
   `marketing/world-cup/ASO-appstore-copy.md`.
3. **Screenshots:** upload the 5-panel set per locale (captions localized).
4. **After the final:** revert Subtitle/Promotional Text to the evergreen copy
   in `APP_STORE_LISTING.md`; the WC keywords decay in value fast.
```
