/**
 * Sunday League — one icon vocabulary.
 *
 * WHY THIS EXISTS. Forty-five distinct lucide icons were spread across eleven
 * Sunday files with no shared map, and two of them had drifted into meaning
 * more than one thing:
 *
 *   - `Trophy` marked the cup (hub + league screens), the completed season
 *     (history) AND the derby banner (match day)
 *   - `Flag` marked a folded club (history) AND the ratings list (match day)
 *
 * A glyph that means two things is worse than no glyph, and the immersion work
 * multiplies the surfaces each one appears on. So: every concept the mode shows
 * an icon for is named here exactly once, and the screens import the NAME. If
 * two concepts should share a glyph that is now a visible, deliberate line in
 * this file rather than a coincidence in two unrelated files.
 *
 * THE BUNDLE RULE. Every lucide icon in the app lands in one shared `lucide`
 * chunk, and that chunk is EAGER (see `vite.config.ts` manualChunks and
 * `scripts/check-eager-bundle.mjs`). Adding an icon name the app does not
 * already use anywhere therefore costs first-paint bytes for a mode most
 * players never open. Every glyph below is one the app already imports
 * somewhere, so this map is free. Keep it that way: reuse before you import.
 *
 * This file holds NO copy and NO behaviour — glyph and tone choices only.
 */
import {
  AlertTriangle, Armchair, ArrowLeft, ArrowRight, Award, Banknote, Beer,
  CalendarDays, Check, ChevronDown, CloudRain, Coins, Dices, Dumbbell, Eye,
  Flag, Flame, Footprints, Frown, Gauge, Hand, HandCoins, HeartCrack,
  HeartHandshake, History, Landmark, Lightbulb, ListOrdered, MapPin, Medal,
  MessageSquare,
  PartyPopper, Phone, Play, Receipt, Repeat, Shield, Shirt, SkipForward,
  Snowflake, Sparkles, Star, Stethoscope, Sun, Swords, TrendingDown,
  TrendingUp, Trophy, Users, UserMinus, UserPlus, Wallet, Wand2, Wind, Wrench,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  SundayEventInstance, SundayMatchTier, SundayMemoryKind, SundayUpgradeId,
  WeatherCondition,
} from '@/types/game';

/**
 * The general vocabulary: one key per concept the mode puts an icon on.
 *
 * Read the KEY, not the glyph. `cup` and `honours` are different concepts and
 * may one day want different glyphs; `rival` is `Swords` on every screen
 * because it is one concept.
 */
export const SUNDAY_ICON = {
  // ── Availability ──
  /** He is playing. */
  available: Check,
  /** He might play. */
  doubt: AlertTriangle,
  /** He is not playing. */
  out: UserMinus,
  /** The afternoon on the phone talking somebody round. */
  ringRound: Phone,

  // ── Money ──
  money: Wallet,
  income: TrendingUp,
  expense: TrendingDown,
  /** Match fees the lads owe. */
  subs: Coins,
  fundraiser: HandCoins,
  sponsor: Banknote,
  /** The books. */
  ledger: Receipt,

  // ── The club ──
  clubhouse: Landmark,
  venue: MapPin,
  pitch: Footprints,
  upgrade: Wrench,
  morale: Beer,
  reputation: Sparkles,
  squad: Users,
  /** The run is over. Distinct from `seasonComplete`, which is an ending the
   *  club survives. */
  folded: HeartCrack,

  // ── Competition ──
  /** The cup, and only the cup. */
  cup: Trophy,
  league: ListOrdered,
  fixtures: CalendarDays,
  /** The season is over — a chequered flag, not a graveside one. */
  seasonComplete: Flag,
  /** The honours board. */
  honours: Medal,
  legend: Award,
  /** A rivalry, everywhere. Used to be `Trophy` on the match-day derby
   *  banner, which read as "you have won something". */
  rival: Swords,
  /** How hot the feud has got. */
  derbyHeat: Flame,

  // ── Selection ──
  starting: Shirt,
  bench: Armchair,
  captain: Star,
  autoPick: Wand2,
  confirm: Check,
  tactics: Lightbulb,

  // ── Match day ──
  kickOff: Play,
  skip: SkipForward,
  substitution: Repeat,
  ratings: Gauge,
  hero: Sparkles,
  lowlight: Frown,
  injury: Stethoscope,
  form: Zap,
  /** A player in form. Shares `Flame` with `derbyHeat` deliberately — both
   *  mean "this has heat on it" — but they are separate concepts and get
   *  separate names so either can move without dragging the other. */
  hotForm: Flame,
  training: Dumbbell,
  /** Something that happened last time these two met. */
  recall: History,

  // ── Recruitment ──
  recruit: UserPlus,
  release: UserMinus,
  /** Seen with your own eyes (a trialist). */
  scouted: Eye,
  /** Heard about from somebody (a rumour). */
  rumour: MessageSquare,

  // ── Setup / navigation ──
  back: ArrowLeft,
  forward: ArrowRight,
  reroll: Dices,
  expand: ChevronDown,
  warning: AlertTriangle,
} as const satisfies Record<string, LucideIcon>;

export type SundayIconName = keyof typeof SUNDAY_ICON;

/** Availability status → glyph. Mirrors `AvailabilityPill`'s three states. */
export const SUNDAY_AVAILABILITY_ICON: Record<'available' | 'doubt' | 'out', LucideIcon> = {
  available: SUNDAY_ICON.available,
  doubt: SUNDAY_ICON.doubt,
  out: SUNDAY_ICON.out,
};

/** Weather → glyph. The only place in the mode weather is drawn. */
export const SUNDAY_WEATHER_ICON: Record<WeatherCondition, LucideIcon> = {
  clear: Sun,
  rain: CloudRain,
  wind: Wind,
  snow: Snowflake,
};

/**
 * Event category → glyph and tone.
 *
 * Moved here verbatim from `SundayEventModal`, which owned the only
 * category→icon map in the mode and could not be reused by the hub's news
 * feed or the history log without copying it.
 */
export const SUNDAY_EVENT_CATEGORY_ICON: Record<SundayEventInstance['category'], LucideIcon> = {
  player: HeartHandshake,
  club: Shield,
  money: Wallet,
  matchday: AlertTriangle,
  rivalry: Swords,
  sponsor: Banknote,
  comedy: PartyPopper,
};

export const SUNDAY_EVENT_CATEGORY_TONE: Record<SundayEventInstance['category'], string> = {
  player: 'text-sky-300 bg-sky-500/10',
  club: 'text-primary bg-primary/10',
  money: 'text-emerald-300 bg-emerald-500/10',
  matchday: 'text-amber-300 bg-amber-400/10',
  rivalry: 'text-orange-300 bg-orange-500/10',
  sponsor: 'text-emerald-300 bg-emerald-500/10',
  comedy: 'text-fuchsia-300 bg-fuchsia-500/10',
};

/**
 * What a fixture at each tier LOOKS like.
 *
 * Lived inside `SundayMatchDay` as a private const until the hub's fixture
 * hero needed the same treatment — a cup final has to look like a cup final
 * from the moment the app opens, not only once you are on match day. It sits
 * beside `SUNDAY_EVENT_CATEGORY_TONE` because both answer "what colour is this
 * concept", which is the same question the icon maps answer in glyphs.
 *
 * Existing tokens only: gold for a final, orange for the derby, sky for a cup
 * tie, nothing at all for a wet Tuesday.
 */
export const SUNDAY_TIER_RIM: Record<SundayMatchTier, string> = {
  routine: '',
  cup: 'ring-1 ring-sky-400/30',
  derby: 'ring-1 ring-orange-400/40',
  'cup-final': 'ring-1 ring-primary/50 shadow-[0_0_28px_-8px_hsl(var(--primary)/0.55)]',
  decider: 'ring-1 ring-primary/45 shadow-[0_0_24px_-8px_hsl(var(--primary)/0.45)]',
};

/** Upgrade → glyph. One per id in `SUNDAY_UPGRADES`, so a missing entry is a
 *  type error rather than a blank square. */
export const SUNDAY_UPGRADE_ICON: Record<SundayUpgradeId, LucideIcon> = {
  kit: Shirt,
  pitch: Footprints,
  balls: Sparkles,
  nets: Shield,
  physio: Stethoscope,
  minibus: MapPin,
  floodlights: Zap,
  clubhouse: Landmark,
  coach: Lightbulb,
  'keeper-gloves': Hand,
};

/** Memory kind → glyph, for the biography and the news feed. */
export const SUNDAY_MEMORY_ICON: Record<SundayMemoryKind, LucideIcon> = {
  debut: UserPlus,
  'first-goal': Sparkles,
  'hat-trick': Sparkles,
  winner: Sparkles,
  'derby-goal': Swords,
  'cup-hero': Trophy,
  promotion: TrendingUp,
  relegation: TrendingDown,
  'red-card': AlertTriangle,
  motm: Star,
  'bad-day': Frown,
  injury: Stethoscope,
  milestone: Medal,
  'promise-kept': Check,
  'promise-broken': HeartCrack,
  'unlikely-hero': PartyPopper,
  'talked-round': Phone,
};

/** How two players stand with each other. */
export const SUNDAY_RELATIONSHIP_ICON: Record<'friend' | 'rival' | 'mentor', LucideIcon> = {
  friend: HeartHandshake,
  rival: Swords,
  mentor: Lightbulb,
};

/**
 * News-feed entry kinds.
 *
 * The keys are the source of truth for the union — `sundayNewsFeed` derives
 * its `kind` type from `keyof typeof SUNDAY_NEWS_ICON`, so a new kind cannot
 * be added to the feed without giving it a glyph here.
 */
export const SUNDAY_NEWS_ICON = {
  /** A line from this week's log. */
  week: Sparkles,
  /** A resolved event. */
  event: HeartHandshake,
  /** A club record set. */
  record: Medal,
  /** Something that happened with the rival. */
  rivalry: Swords,
  /** A moment somebody in the squad will remember. */
  memory: History,
} as const satisfies Record<string, LucideIcon>;

export type SundayNewsKind = keyof typeof SUNDAY_NEWS_ICON;
