# ru — Russian (App Store)

Storefronts reached: Russian-preferring users across many storefronts — Kazakhstan, Belarus, Armenia, Georgia, Israel, Germany, the Baltics and more (the Russian App Store itself is closed to new purchases, but ru metadata indexes broadly wherever users set Russian as their language). The head phrase this market types is "футбольный менеджер"; the season-window intent is "режим карьеры" — running a club through a season, not following a tournament.

## App Name [23/30]
`Dynasty Manager: Футбол`

## Subtitle [28/30]
`Футбольный менеджер: карьера`

## Promotional Text [167/170]
`Новый сезон — новая династия. Бери любой из 756 реальных клубов и веди его от предсезонки до титула: трансферы, тактика, каждая минута. Без шкал энергии. Без подписки.`

## Keywords [99/100]
`сезон,лига,клуб,состав,тактика,трансфер,тренер,кубок,чемпионат,симулятор,сборная,онлайн,схема,скаут`

## Description [2023/4000]
Сезон 2026/27 стартует. Выбирай клуб, выставляй состав и управляй каждой его минутой.

Dynasty Manager – это глубокий симулятор футбольного менеджмента: настоящая карьера тренера, а не гринд с карточками. Бери любой из 756 реальных клубов в 45 лигах и 37 странах или соглашайся возглавить сборную своей страны. Настраивай тактику, работай на трансферном рынке и делай каждую замену, пока матч идёт минута за минутой.

Без шкал энергии. Без пакетов отдыха. Без ожидания между сессиями. Играй сколько хочешь и когда хочешь.

Что тебя ждёт:
- Режим карьеры: начинай безвестным, подавайся на вакансии, веди переговоры по контрактам, бери трофеи – поднимайся вверх или получай увольнение
- 45 лиг и 756 реальных клубов: выход в высший дивизион, вылет и плей-офф на всех уровнях
- Матчи минута за минутой: живые комментарии, установки в перерыве, тактические правки и серии пенальти под твоим управлением
- Тактика и схемы: настрой, темп, прессинг, ширина и собственные указания
- Трансферы и контракты: ищи талантов через скаутов, договаривайся о суммах и зарплатах, оформляй аренды, держи зарплатную ведомость под контролем
- Молодёжная академия и тренировки: выращивай своих звёзд, а не покупай их
- Кубки и континентальные турниры: иди за треблом в кубках страны, континентальных турнирах и Суперкубке
- Сборная страны: проведи национальную команду через отбор до мирового турнира
- Наборы игроков: открывай паки и лови редкие карточки
- Стадион, финансы, спонсоры и мерч: управляй всем клубом, а не только командой

Скачивание бесплатное
Всё перечисленное входит в бесплатную загрузку. Dynasty Pro – по желанию: мгновенная симуляция, расширенная статистика, свои тактики, расширенные пресс-конференции, исторические рекорды и отсутствие рекламы. Начни с 7 дней бесплатно на пробу или купи один раз и владей навсегда.

Управляй своей династией.

Политика конфиденциальности: https://wrexist.github.io/dynasty-manager/privacy.html
Условия использования (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/

## What's New (next release note blurb)
Новый сезон, новая династия. Свежий вид в App Store, более умный ИИ на скамейке и несколько исправлений в день матча. По-прежнему без шкал энергии, без пакетов отдыха, без ожидания – только футбол.

## Screenshot Captions (5)
1. 45 лиг, 37 стран, 756 клубов
2. Матч минута за минутой: замены и пенальти
3. Состав, схема и химия команды
4. Трансферное окно: скауты и контракты
5. Сборная страны и континентальные турниры

## Keyword rationale
- ru is a high-reach locale: it indexes across Kazakhstan, Belarus, Armenia, Georgia, Israel, the Baltics and diaspora storefronts, so the terms target pan-regional Russian search behaviour rather than one country.
- **Window change: the tournament framing is gone.** The 2026 tournament ended 19 July; the live intent for the 2026-27 club season is "run my club", so the Subtitle now spends all 28 characters on evergreen head terms instead of a dead token.
- The Subtitle still binds "футбольный менеджер" — the head phrase rivals ship even on the Ukraine storefront. Cyrillic "менеджер" is a different token from the Latin "Manager" in the App Name, so this placement is not a duplicate: it is the only way the Cyrillic head query is indexed at subtitle weight. "карьера" joins it because career-mode intent is the season-window equivalent of tournament intent, and it reads as a benefit in the Today-tab format (name + icon + subtitle only).
- **Keywords reclaimed from the tournament:** dropping "мундиаль" (the everyday second name for the tournament) and "пенальти" freed the characters now funding "сезон", "симулятор", "схема" and "скаут" — season, sim, formation and scouting are the queries this window actually gets.
- "карьера" moved out of Keywords the moment it entered the Subtitle — Apple indexes App Name + Subtitle + Keywords as one set, so a repeat is a wasted character and the validator fails on it.
- **"онлайн" retained** — the pan-regional pattern is "футбольный онлайн менеджер" (OSM's own descriptor), so "онлайн" complements the in-title phrase to reconstruct it in search.
- "сборная", "состав", "трансфер", "кубок", "чемпионат", "тренер" are the natural Russian words for national team, lineup, transfer, cup, championship and coach. Singulars only ("трансфер", not "трансферы") — Apple matches the plural.
- Cyrillic script has no accent-stripping concern, so keyword tokens are spelled exactly as users type them.
- "Футбол", "футбольный", "менеджер", "карьера" are omitted from Keywords — they sit in the App Name/Subtitle and are indexed separately. No plurals of included singulars, no club/league proper nouns, no category name.
- The captions carry what the 100-char field cannot afford: "трансферное окно", "химия команды", "скауты", "контракты", "континентальные турниры" and "пенальти" — all indexed since Apple began OCR-extracting screenshot text, and none of them affordable inside 100 characters.
