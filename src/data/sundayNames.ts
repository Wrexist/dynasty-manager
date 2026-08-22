/**
 * Sunday League content pools — names, clubs, jobs, venues and flavour text.
 *
 * This is GAME DATA, not UI copy: it is English by design and deliberately not
 * routed through i18n, exactly like the match engine's commentary (see the note
 * at the top of `src/i18n/index.ts`). Translating "Dog & Duck FC" would lose the
 * joke and gain nothing.
 *
 * Everything here is picked through the seeded RNG in `src/utils/sunday/rng.ts`,
 * so two saves with different seeds produce genuinely different casts and the
 * same save always retells the same story.
 */

// ── People ──────────────────────────────────────────────────────────────────

export const SUNDAY_FIRST_NAMES: readonly string[] = [
  'Dave', 'Gary', 'Kev', 'Lee', 'Craig', 'Danny', 'Marc', 'Scott', 'Wayne', 'Shaun',
  'Ryan', 'Jordan', 'Callum', 'Liam', 'Connor', 'Josh', 'Bradley', 'Kyle', 'Reece', 'Tyler',
  'Steve', 'Paul', 'Mark', 'Neil', 'Andy', 'Rob', 'Chris', 'Jamie', 'Ash', 'Baz',
  'Tom', 'Sam', 'Jack', 'Harry', 'Charlie', 'George', 'Alfie', 'Freddie', 'Ollie', 'Louie',
  'Dec', 'Mo', 'Aaron', 'Kane', 'Jonny', 'Ricky', 'Terry', 'Nicky', 'Stu', 'Big Al',
  'Ade', 'Femi', 'Kwame', 'Rio', 'Amir', 'Hass', 'Zeb', 'Yusuf', 'Deniz', 'Pawel',
  'Mateusz', 'Kacper', 'Dermot', 'Fionn', 'Rhys', 'Gethin', 'Callan', 'Struan', 'Brodie', 'Finlay',
];

export const SUNDAY_LAST_NAMES: readonly string[] = [
  'Bishop', 'Braithwaite', 'Brennan', 'Brooks', 'Burrows', 'Carty', 'Chadwick', 'Chapman',
  'Clough', 'Coates', 'Corrigan', 'Cousins', 'Crabtree', 'Dolan', 'Duffield', 'Eastwood',
  'Fairhurst', 'Farrelly', 'Fitzgerald', 'Garrity', 'Gilhooley', 'Grimshaw', 'Hackett',
  'Halliwell', 'Hardcastle', 'Haslam', 'Heaney', 'Hepworth', 'Higginbottom', 'Holbrook',
  'Ingham', 'Jarvis', 'Kelsall', 'Kinsella', 'Lonsdale', 'Marsden', 'Mottram', 'Naylor',
  'Nuttall', 'Ogden', 'Pemberton', 'Pilkington', 'Postlethwaite', 'Quigley', 'Rushworth',
  'Sedgwick', 'Shufflebottom', 'Sidebottom', 'Slater', 'Standen', 'Tattersall', 'Thwaite',
  'Trickett', 'Unsworth', 'Verity', 'Wainwright', 'Whitfield', 'Wilkes', 'Womersley', 'Yates',
  'Adeyemi', 'Okonkwo', 'Mensah', 'Nowak', 'Kowalski', 'Grabowski', 'Ozturk', 'Demir',
  'Rahman', 'Iqbal', 'Ali', 'Begum', 'Sandhu', 'Dhillon', 'Kaur', 'Moloney', 'Sheridan',
  'Llewellyn', 'Prothero', 'Macdonald', 'Kinnear', 'Bruce', 'Fenwick', 'Charlton', 'Peacock',
];

/** Weekday jobs. Drives work-related absences and the odd event. */
export const SUNDAY_JOBS: readonly string[] = [
  'scaffolder', 'sparky', 'plumber', 'joiner', 'plasterer', 'roofer', 'groundworker',
  'delivery driver', 'HGV driver', 'taxi driver', 'warehouse picker', 'forklift driver',
  'chef', 'kitchen porter', 'bartender', 'barista', 'bouncer', 'security guard',
  'nurse', 'paramedic', 'care worker', 'porter', 'pharmacy tech',
  'teacher', 'TA', 'PE teacher', 'lecturer', 'student', 'apprentice',
  'sales rep', 'call-centre lad', 'IT support', 'accountant', 'insurance broker',
  'postie', 'binman', 'landscaper', 'mechanic', 'MOT tester', 'tyre fitter',
  'barber', 'tattooist', 'personal trainer', 'lifeguard', 'window cleaner',
  'fishmonger', 'butcher', 'baker', 'farmhand', 'railway engineer', 'signaller',
  'firefighter', 'soldier', 'PCSO', 'estate agent', 'quantity surveyor',
  'between things', 'doing a bit of everything', 'his dad’s business',
];

// ── Clubs ───────────────────────────────────────────────────────────────────

/** Club-name prefixes: the pub, the estate, the industrial unit. */
export const SUNDAY_CLUB_PREFIX: readonly string[] = [
  'Dog & Duck', 'Red Lion', 'Rose & Crown', 'The Swan', 'Kings Head', 'Ship Inn',
  'Fox & Hounds', 'Old Oak', 'Rovers Return', 'Crown & Anchor', 'The Wheatsheaf',
  'Marsh Lane', 'Beech Road', 'Pit Lane', 'Canal Street', 'Gasworks', 'Retail Park',
  'Springfield', 'Northfield', 'Southbrook', 'Eastgate', 'Westhill', 'Millbank',
  'Riverside', 'Parkside', 'Hillside', 'Brookvale', 'Ashgrove', 'Elm Park',
  'Cemetery Road', 'Station Road', 'Bypass', 'Ring Road', 'Old Mill', 'Foundry',
  'Kwik Fit', 'Bargain Booze', 'Kebab Hut', 'Tandoori Nights', 'Golden Fry',
  'Sportsman', 'Traveller’s Rest', 'Bricklayers', 'Cricketers', 'Railway',
];

/** Club-name suffixes. */
export const SUNDAY_CLUB_SUFFIX: readonly string[] = [
  'FC', 'AFC', 'United', 'Rovers', 'Athletic', 'Wanderers', 'Rangers', 'Albion',
  'Town', 'Sports', 'Social', 'Casuals', 'Nomads', 'Olympic', 'Dynamo', 'Sporting',
  'Reserves', 'Old Boys', 'Colts', 'Amateurs', 'Vets', 'All Stars', 'Select',
];

/** Nicknames, drawn independently of the club name. */
export const SUNDAY_NICKNAMES: readonly string[] = [
  'The Ducks', 'The Lions', 'The Boys', 'The Lads', 'The Yellows', 'The Stripes',
  'The Hoops', 'The Reds', 'The Blues', 'The Greens', 'The Cannons', 'The Hammers',
  'The Millers', 'The Bakers', 'The Sparks', 'The Chippies', 'The Vans',
  'The Regulars', 'The Committee', 'The Sunday Club', 'The Rec Boys', 'The Nine Men',
];

/** Venues. Every one of them is a public park with a portakabin. */
export const SUNDAY_VENUES: readonly string[] = [
  'Marsh Lane Rec, Pitch 4', 'Hollins Park (the slopey one)', 'Beech Road Playing Fields',
  'The Rec', 'Victoria Park, Pitch 2', 'Ashfield Common', 'The Old Sewage Works Pitch',
  'Kingsway Sports Ground', 'Meadow Bank', 'The Bowl', 'Council Pitch 7',
  'Longbank Fields', 'Waterloo Rec', 'Church Meadow', 'Pitch B, Leisure Centre',
  'Stanley Park (behind the tennis courts)', 'Coronation Fields', 'Jubilee Rec',
];

/** Towns and areas. */
export const SUNDAY_TOWNS: readonly string[] = [
  'Ashworth', 'Barnhill', 'Cleveden', 'Draycott', 'Eastvale', 'Fairhaven', 'Grimsby Road',
  'Hazelmere', 'Ivybridge', 'Kirkstall', 'Longmoor', 'Marsden Bottom', 'Netherfield',
  'Oldcastle', 'Pendlebury', 'Quarry Bank', 'Ravensthorpe', 'Stainforth', 'Thornbury',
  'Upholland', 'Wetherby Cross', 'Yeadon',
];

/** Colour pairs for generated clubs — primary, secondary. Sunday kits are
 *  bought in bulk from a catalogue, so the palette is deliberately cheap. */
export const SUNDAY_KIT_COLORS: readonly (readonly [string, string])[] = [
  ['#D92B2B', '#FFFFFF'], ['#1E4FD8', '#FFFFFF'], ['#0E8A3E', '#FFFFFF'],
  ['#F2C230', '#1A1A1A'], ['#111827', '#F5F5F5'], ['#7A2E8E', '#F5D020'],
  ['#E36414', '#0B132B'], ['#0F5257', '#F0F3BD'], ['#8C1C13', '#F5D9C4'],
  ['#2B2D42', '#EF233C'], ['#3A6EA5', '#FF6B35'], ['#5B8C5A', '#F2E8CF'],
  ['#B23A48', '#FCB9B2'], ['#1B998B', '#2D3047'], ['#4C1D95', '#C4B5FD'],
  ['#166534', '#FDE047'], ['#7C2D12', '#FED7AA'], ['#0C4A6E', '#BAE6FD'],
];

// ── Absence flavour ─────────────────────────────────────────────────────────
//
// Keyed by `SundayAbsenceReason`. `{name}` is substituted with the player's
// first name. Every line has to be readable both as a warning ("Kev's on a
// stag do") and as a discovery after the fact.

export const SUNDAY_ABSENCE_NOTES: Readonly<Record<string, readonly string[]>> = {
  work: [
    'is on nights again',
    'got called in to cover a shift',
    'is doing a job in Doncaster and won’t be back',
    'is on a double and cannot get out of it',
    'has a delivery run that finishes at two',
  ],
  family: [
    'has his daughter’s tournament',
    'is on grandma duty',
    'has a christening',
    'promised he’d take the kids swimming',
    'has an in-laws lunch he cannot escape',
  ],
  holiday: [
    'is in Tenerife for a fortnight',
    'has gone to Benidorm with the lads',
    'is away caravanning with the family',
    'is on a cruise, of all things',
  ],
  injury: [
    'is still limping',
    'cannot walk down stairs properly yet',
    'has his ankle in a boot',
    'did his hamstring and is being sensible about it, for once',
  ],
  suspended: [
    'is banned',
    'is serving his suspension',
    'is not allowed within fifty yards of a referee',
  ],
  wedding: [
    'is best man at a wedding',
    'is on a stag do in Prague',
    'is at his cousin’s wedding in Ireland',
    'is getting married. This Sunday. He did mention it.',
  ],
  hungover: [
    'is, by his own admission, in no state',
    'was last seen at 4am and has not been heard from',
    'says he’s "coming down with something"',
    'has sent a voice note that was mostly groaning',
  ],
  travel: [
    'is stuck on the M6',
    'is in London for the weekend',
    'missed the train and is not going to make it',
    'is driving back from Cornwall and will not be close',
  ],
  school: [
    'has an exam on Monday and his mum has intervened',
    'is on a school trip',
    'has coursework due and has been grounded',
  ],
  'fell-out': [
    'is not speaking to half the changing room',
    'is still sulking about last week',
    'says he’ll come back "when things change"',
  ],
  'other-team': [
    'has been asked to play for another side',
    'is guesting for his mate’s team',
    'is playing Saturday football now and cannot do both',
  ],
  'cant-be-bothered': [
    'has looked at the weather and made a decision',
    'says he’s "having a week off"',
    'has replied with a thumbs down and nothing else',
    'left the group chat, then rejoined, then went quiet',
  ],
  'no-show': [
    'simply did not turn up',
    'is not answering his phone',
    'was seen in a car park nearby but never reached the pitch',
    'is, as far as anyone can establish, still in bed',
  ],
};

// ── Sunday morning ──────────────────────────────────────────────────────────
//
// Arrival beats: what the manager learns standing in the car park at twenty
// to eleven. `{name}` is the player. Discovery lines never state the excuse —
// that arrives (or does not) after the match.

export const SUNDAY_ARRIVAL_TURNED_UP: readonly string[] = [
  '{name} has turned up after all, still doing his laces.',
  '{name} made it. He looks like he ran here.',
  '{name} is here — "told you I would be".',
];

export const SUNDAY_ARRIVAL_CRIED_OFF: readonly string[] = [
  '{name} has cried off. Ten to eleven, of course.',
  '{name} is not coming. The message arrived as everyone else got changed.',
  '{name} sends his apologies, which do not head a corner out.',
];

export const SUNDAY_ARRIVAL_NO_SHOW: readonly string[] = [
  '{name} has not arrived. Phone going straight to voicemail.',
  'No sign of {name}. Someone drove past his house. Curtains shut.',
  '{name} is simply not here. The group chat is being drafted.',
];

// ── Match ambience ──────────────────────────────────────────────────────────
//
// These are decoration ONLY. They never assert anything about the scoreline,
// the scorers or the events — that is what makes it safe to sprinkle them into
// a real match feed. Anything that makes a factual claim is generated from the
// engine's own event stream in `src/utils/sunday/match.ts`.

export const SUNDAY_AMBIENCE: readonly string[] = [
  'A dog has got onto the pitch. Play continues around it.',
  'Somebody’s dad is refereeing the referee from the touchline.',
  'The ball has gone into the car park. Again.',
  'The linesman is a substitute who does not want to be doing this.',
  'A jogger has run straight through the penalty area without breaking stride.',
  'There is a genuine argument about whether that was a corner.',
  'The far goal has no net, so nobody is entirely sure what happened.',
  'A man walking his greyhound has stopped to offer tactical advice.',
  'The pitch markings run out around the halfway line.',
  'Somebody’s phone is going off in a pile of coats behind the goal.',
  'The wind has picked up and both goalkeepers look worried.',
  'A youth match on the next pitch has stopped to watch this one.',
  'Half-time oranges have been produced. Nobody knows by whom.',
  'The referee has asked, politely, for the swearing to stop.',
  'There is now more mud on the ball than on the pitch.',
  'An ice-cream van has pulled up, in February.',
];

/** Lines used when the club turns up short. */
export const SUNDAY_SHORT_SIDE_LINES: readonly string[] = [
  'You kick off with {n}. The referee counts twice to be sure.',
  '{n} men. The opposition manager is trying not to look delighted.',
  'You start with {n} and an apology.',
  '{n} of you. Someone suggests a back three and is ignored.',
];

/** Lines used when a ringer is drafted in. `{name}` is the ringer. */
export const SUNDAY_RINGER_LINES: readonly string[] = [
  '{name} has been produced from somewhere. He is somebody’s brother-in-law.',
  '{name} was walking past with a dog and has been persuaded into a shirt.',
  '{name} plays for the team on the next pitch and has agreed to help out.',
  '{name} is here to watch his son and has been handed the number nine.',
  '{name} has not played since school but says he is "still quick".',
];

// ── Conceding ───────────────────────────────────────────────────────────────
//
// THE OTHER SIDE OF THE SCORELINE. Both sides' goals used to be narrated from
// the celebratory pools above, so roughly half of every match feed cheered the
// opposition on: "Callum finishes, and the man on the touchline with the dog
// applauds" was them going 1-0 up. These pools are the same events told from
// the touchline that has just gone quiet.
//
// Same contract as `GOAL_LINES`: keyed by the engine's event type, `{scorer}`
// is whoever the event names and `{score}` the running score. For a conceded
// own goal the engine names OUR defender, which is why that pool reads the way
// it does.

export const SUNDAY_CONCEDED_LINES: Readonly<Record<string, readonly string[]>> = {
  goal: [
    'Nobody picks up {scorer} and he has the easiest finish of his life. ({score})',
    '{scorer} is left alone six yards out. Two of yours look at each other. ({score})',
    'It squirms in off {scorer}. Your keeper is already turning round to ask who was marking. ({score})',
    '{scorer} scores, and your touchline goes very quiet. ({score})',
  ],
  long_range_goal: [
    '{scorer} hits one from thirty yards and it flies in. Nothing anybody could have done. ({score})',
    'From miles out, {scorer}. Your keeper had it covered right up until he did not. ({score})',
  ],
  header_goal: [
    'A corner, nobody goes with {scorer}, and it is a free header. ({score})',
    '{scorer} climbs above a man who was watching the ball. Everyone knows which man. ({score})',
  ],
  free_kick_goal: [
    'The wall jumps. {scorer}’s free kick does not. In it goes. ({score})',
    '{scorer} curls the free kick in while your lot are still arguing about the foul. ({score})',
  ],
  counter_attack_goal: [
    'You lose it in their half, {scorer} finishes at the other end, and nobody got back. ({score})',
    'Three passes and {scorer} is through. Your midfield is still walking. ({score})',
  ],
  solo_goal: [
    '{scorer} goes past three of yours as though they had been put there for practice. ({score})',
    '{scorer} beats everybody and finishes. Somebody shouts "get tight". Somewhat late. ({score})',
  ],
  penalty_scored: [
    'Penalty against you. A long protest, no change of mind, {scorer} scores. ({score})',
    'Your keeper guesses right. It goes the other way. {scorer} does not miss. ({score})',
  ],
  own_goal: [
    '{scorer} has turned it into his own net. He pulls his shirt over his face. ({score})',
    'It comes off {scorer} and in. Nobody says a word to him, which is worse. ({score})',
  ],
  goalkeeper_error: [
    'Your keeper spills it and {scorer} rolls it into an empty net. Sickening. ({score})',
    'It goes straight through your keeper. {scorer} cannot believe his luck. ({score})',
  ],
};

/** Conceded late, when they have just gone in front. The ones that ruin the
 *  drive home. `{minute}` is the event's own minute. */
export const SUNDAY_CONCEDED_LATE_LINES: readonly string[] = [
  '{scorer}, in the {minute}th minute. Your lot are on their knees. ({score})',
  'The referee is checking his watch, and {scorer} scores. Nobody speaks. ({score})',
  '{minute} minutes gone and {scorer} has taken it off you. ({score})',
];

/** Conceded to THAT lot. */
export const SUNDAY_CONCEDED_DERBY_LINES: readonly string[] = [
  '{scorer} scores, and their bench empties. You will hear about this all week. ({score})',
  '{scorer}, against you, in this fixture of all fixtures. Their manager is looking straight at your dugout. ({score})',
];

// ── Knowing who they are ────────────────────────────────────────────────────
//
// Lines that reach into the squad's own records rather than the event stream.
// Every one of them is gated on a fact that already exists in state — the
// appearance count, the weekday job, the form the engine itself reads — and
// there are at most a couple per match, because a feed that does this every
// week is a feed nobody reads.

/** A club-appearance milestone reached by starting today. `{name}` and `{n}`. */
export const SUNDAY_MILESTONE_LINES: readonly string[] = [
  '{name} makes his {n}th appearance for the club today.',
  'Game number {n} for {name}. Nobody has organised anything.',
  'It is {name}’s {n}th for the club. He has mentioned it twice.',
];

/** What the scorer does on weekdays. `{name}` and `{job}`. */
export const SUNDAY_SCORER_JOB_LINES: readonly string[] = [
  'A {job} on a Tuesday. A goalscorer on a Sunday.',
  'That is {name} — {job} all week, and now this.',
  '{name} celebrates like a man who has to be up at six. Because he is a {job}.',
];

/** The scorer is in form — and "in form" here means the number the engine
 *  itself reads in shot quality, not a hunch. `{name}`. */
export const SUNDAY_SCORER_FORM_LINES: readonly string[] = [
  '{name} again. Nobody at this club is playing better right now.',
  'That is {name} in the middle of the best run of his season.',
];

/** Opening beat for a cup tie. `{round}` is the round's own name. */
export const SUNDAY_CUP_TIE_LINES: readonly string[] = [
  '{round}. Whoever loses is out, and everybody knows it.',
  'A {round} tie, on a pitch with one net.',
];

/** Derby build-up when a former player crossed the road. Deliberately social
 *  rather than tactical: he is NOT tracked into the rival's XI, so nothing
 *  here may suggest he is on the pitch. `{name}`. */
export const SUNDAY_DEFECTOR_DERBY_LINES: readonly string[] = [
  'Somebody has already said {name}’s name in the changing room. It is that kind of morning.',
  'Two people have brought up {name} before a ball has been kicked.',
];

/** Post-match social beats — the food, the pint, the debrief. */
export const SUNDAY_POSTMATCH_LINES: readonly string[] = [
  'Everyone is back at the pub within forty minutes.',
  'The post-match chips are pronounced excellent, which helps.',
  'There is a lengthy discussion in the car park that resolves nothing.',
  'Someone has left a boot behind and will realise on Tuesday.',
  'The group chat is going to be busy tonight.',
  'Two people are still arguing about the second goal at closing time.',
];

// ── Sponsors ────────────────────────────────────────────────────────────────

export interface SundaySponsorTemplate {
  name: string;
  blurb: string;
  /** Multiplies the reputation-scaled weekly payment. */
  payMult: number;
  /** Conditions this sponsor is willing to attach. */
  conditions: readonly ('none' | 'win-streak' | 'avoid-defeat' | 'goals' | 'attendance' | 'discipline')[];
}

export const SUNDAY_SPONSORS: readonly SundaySponsorTemplate[] = [
  { name: 'Kebab Hut', blurb: 'Open until four. Sponsors everyone.', payMult: 0.8, conditions: ['none', 'goals'] },
  { name: 'The Dog & Duck', blurb: 'Wants the squad drinking there afterwards.', payMult: 0.9, conditions: ['none', 'attendance'] },
  { name: 'Hollins Motors', blurb: 'Second-hand cars, first-rate banter.', payMult: 1.2, conditions: ['win-streak', 'none'] },
  { name: 'Fairhurst & Sons Roofing', blurb: 'The owner’s lad plays for a rival. Awkward.', payMult: 1.1, conditions: ['avoid-defeat'] },
  { name: 'Peak Fitness', blurb: 'Free protein shakes, mandatory posting.', payMult: 1.0, conditions: ['attendance', 'none'] },
  { name: 'Naylor Accountancy', blurb: 'Wants a well-run club and a clean disciplinary record.', payMult: 1.15, conditions: ['discipline'] },
  { name: 'Slick Cuts', blurb: 'Barbers. Will do the whole squad for a shirt logo.', payMult: 0.7, conditions: ['none'] },
  { name: 'Crabtree Scaffolding', blurb: 'Proper local firm. Proper money.', payMult: 1.3, conditions: ['win-streak', 'avoid-defeat'] },
  { name: 'BetSafely.biz', blurb: 'Nobody has been able to find their office.', payMult: 1.6, conditions: ['goals', 'win-streak'] },
  { name: 'Marsden Plant Hire', blurb: 'Diggers, dumpers, and one very loud sponsor.', payMult: 1.25, conditions: ['none', 'discipline'] },
  { name: 'Golden Fry', blurb: 'Chippy. Will feed the squad after home games.', payMult: 0.75, conditions: ['none'] },
  { name: 'Quigley Windows', blurb: 'Their van will be parked behind the goal every week.', payMult: 1.05, conditions: ['attendance'] },
  { name: 'Zenith Crypto Solutions', blurb: 'Pays extremely well and asks unsettling questions.', payMult: 1.9, conditions: ['win-streak', 'goals'] },
  { name: 'Wainwright Funeral Directors', blurb: 'Tasteful. Slightly ominous on a shirt.', payMult: 1.1, conditions: ['none'] },
];

/** Human-readable condition text, by kind. `{n}` becomes the target. */
export const SUNDAY_SPONSOR_CONDITION_TEXT: Readonly<Record<string, string>> = {
  none: 'No conditions. They just like the club.',
  'win-streak': 'Win {n} in a row before the deal is up.',
  'avoid-defeat': 'Go {n} matches without losing.',
  goals: 'Score {n} goals this season.',
  attendance: 'Field a full eleven of your own — no guests — {n} times.',
  // Says what it counts. It has never counted cards: the progress figure is
  // forfeits plus no-shows, which is a different (and more Sunday) sin.
  discipline: 'Get through the season with fewer than {n} no-shows and unfulfilled fixtures.',
};

// ── Rivalry ─────────────────────────────────────────────────────────────────

/** `{a}` and `{b}` are the two clubs' short names. */
export const SUNDAY_RIVALRY_NAMES: readonly string[] = [
  'The Retail Park Derby', 'The Rec Derby', 'The Ring Road Derby',
  'The Old Firm (Pitch 4)', 'The Bypass Clasico', 'The Car Park Classic',
  'The Battle of the Bottom Pitch', 'The Sunday Special',
];

/** How the rival manager carries himself — picked once per rivalry. */
export const SUNDAY_RIVAL_MANAGER_STYLES: readonly string[] = [
  'Runs a tight 4-4-2 and an even tighter grudge list.',
  'Wears a suit on the touchline. To a rec pitch. Every week.',
  'Screams for ninety minutes and buys everyone a drink after.',
  'Claims to have coached "at a decent level". Nobody can verify it.',
  'Has a laminated set-piece folder and is not ashamed of it.',
  'Protests every throw-in. Every single one.',
  'Poaches players with the shamelessness of a man who has never been punched.',
  'Genuinely good manager, which makes it so much worse.',
];

export const SUNDAY_TAUNTS: readonly string[] = [
  'Their manager has told the pub you "couldn’t beat a carpet".',
  'Someone from {rival} has been screenshotting your group chat.',
  'Their centre-half has promised to "sort it out" on Sunday.',
  'They have put a fixture poster up in the Dog & Duck. With your badge upside down.',
  'Their keeper says he has never conceded to you and never will.',
  'They have been telling people they beat you last year. They did not.',
  'Their manager has offered your best player "a proper set-up".',
];

// ── Records ─────────────────────────────────────────────────────────────────

/** Labels for tracked club records, by id. */
export const SUNDAY_RECORD_LABELS: Readonly<Record<string, string>> = {
  'biggest-win': 'Biggest win',
  'worst-defeat': 'Worst defeat',
  'longest-unbeaten': 'Longest unbeaten run',
  'most-goals-match': 'Most goals in a match',
  'best-finish': 'Best league finish',
  'top-scorer-season': 'Most goals in a season',
  'most-apps': 'Most club appearances',
  'biggest-comeback': 'Biggest comeback',
  'richest-week': 'Best week in the bank',
  'fewest-men': 'Fewest men fielded',
};
