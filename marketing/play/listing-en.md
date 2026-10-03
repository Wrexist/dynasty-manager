# Google Play — main store listing (en-GB, default language)

Copy-paste ready. Counts are checked by `node marketing/play/check-listing.mjs`.
Rules applied (Google Play Metadata policy + PLAYBOOK §4/§12):
- No price/promo words ("free", "best", "#1", "sale") in the **title** — Play
  bans them in title, icon and developer name.
- No real player names anywhere. No league, competition or publisher marks
  ("FIFA", "FC", "FUT", "Premier League", "Champions League", "TOTY"). The iOS
  description still says "FUT-style packs" — do not copy that line to Play.
- No testimonials, rankings or award claims.
- The odds of every paid pack are shown in-app before purchase — say so; Play
  requires odds disclosure for randomised paid items too.

## App name [25/30]
```
Dynasty Manager: Football
```

## Short description [79/80]
```
Manage real clubs, open player packs daily & build a dynasty. No energy timers.
```

## Full description
```
Pick a club. Pick your XI. Manage every minute.

Dynasty Manager is a deep football management sim with real clubs, real-player packs and a full managerial career — and no energy timers, rest packs or waiting between sessions. Play as long as you want.

MANAGE 756 REAL CLUBS
• 45 leagues in 37 countries, with promotion, relegation and play-offs across full pyramids
• Domestic cups, three continental competitions and a Super Cup
• Take the national-team job alongside your club and lead your country through international tournaments

EVERY MINUTE OF MATCH DAY
• Minute-by-minute matches with live substitutions, team talks and tactical changes
• Take every spot-kick yourself in interactive penalty shootouts
• Ten formations, custom instructions and a half-time analysis that tells you what is going wrong

OPEN PLAYER PACKS
• Three free packs every day, with a login streak that raises the floor
• Pull real players, chase the walkout, and put your pull straight into your starting XI
• Legends never retire: greats who retire in your save return as Hall of Legends cards
• The odds of every pack are shown before you open or buy it

BUILD A DYNASTY
• Transfers, loans and contract negotiations with a real wage bill to balance
• Scouting, a youth academy and wonderkids who grow — or don't
• Manager Career mode: interview for jobs, earn contracts, get sacked, climb the ladder
• Sunday League: run a local park team through availability crises and pound-scale finances
• Ballon d'Or night, records, achievements and a Hall of Managers

Your saves stay on your device. No account needed.

Dynasty Pro (optional subscription or one-time purchase) adds instant sim, advanced analytics, custom tactics, Optimise Lineup and more. Subscriptions renew automatically until cancelled in Google Play → Payments & subscriptions. Player packs contain randomised items; the odds are shown in the app before purchase.

Privacy Policy: https://wrexist.github.io/dynasty-manager/privacy.html
Support: support@dynastymanager.app
```

## Store settings
- Category: **Games → Sports**
- Tags: choose up to five from Play's list — closest fits are *Sports*,
  *Football*, *Management*, *Simulation*, *Offline* (the list is fixed by Google
  and changes; pick the nearest if a name differs).
- Email: `support@dynastymanager.app`
- Website: `https://wrexist.github.io/dynasty-manager/`
- Privacy policy: `https://wrexist.github.io/dynasty-manager/privacy.html`

## Release notes for the first production release [<500]
```
Dynasty Manager is now on Android. Manage 756 real clubs across 45 leagues, open three free player packs a day and build your dynasty — no energy timers.
```

## Other languages
Add translations only when the in-app UI is translated (CLAUDE.md, i18n is
deferred). A translated listing that installs an English app earns
1-star reviews in that language. The iOS locale files in `marketing/aso/locales/`
are the starting point when that changes — their keyword fields do not carry
over (Play has no keyword field; it indexes the title, short and full description).
