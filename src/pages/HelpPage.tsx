import { useState } from 'react';
import { GlassPanel } from '@/components/game/GlassPanel';
import { ChevronDown, ChevronUp, Search, HelpCircle } from 'lucide-react';

interface HelpSection {
  title: string;
  content: string;
}

const HELP_SECTIONS: HelpSection[] = [
  {
    title: 'Getting Started',
    content: 'Pick a club from 30 European leagues. Each club has different budgets, reputations, and facilities. Lower-tier leagues are harder but more rewarding. Your goal: build a dynasty through smart management, transfers, and tactical mastery.',
  },
  {
    title: 'Weekly Game Loop',
    content: 'Each week: review your dashboard, manage squad/tactics/transfers, then tap "Advance Week" to simulate. If you have a match that week, it plays automatically. Review match results, check messages, and plan for next week.',
  },
  {
    title: 'Training & Development',
    content: 'Set weekly training focus to develop specific attributes. Heavy training risks injuries but develops players faster. Young players (<24) grow toward their potential. Veterans (31+) gradually decline. A player\'s professionalism personality trait affects training effectiveness (0.7x to 1.3x).',
  },
  {
    title: 'Tactics & Formations',
    content: '7 formations available (4-4-2, 4-3-3, 3-5-2, etc.). Tactical familiarity builds over time — switching formations resets it. Set mentality (defensive/balanced/attacking), defensive shape, and assign set-piece and penalty takers on the Tactics page.',
  },
  {
    title: 'Transfers & Loans',
    content: 'Transfer windows: Weeks 1-8 (summer) and 20-24 (winter). Browse the market, make offers with negotiation. You can also list your players for sale to attract bids. Loans let you develop young players at other clubs. Loan deals include wage splits and optional recall/buy clauses.',
  },
  {
    title: 'Contracts',
    content: 'Players have contracts that expire at season end. Watch for expiry warnings in your inbox. Renewing gives a morale boost. Wage demands depend on player age, overall rating, form, and club reputation. If contracts expire, players become free agents.',
  },
  {
    title: 'Chemistry System',
    content: 'Players build chemistry with teammates over time. Higher chemistry improves team coordination in matches. Chemistry bonuses are calculated based on how long players have played together and their positions on the pitch.',
  },
  {
    title: 'Personality Traits',
    content: 'Each player has 5 personality traits (1-20 scale): Professionalism (training effectiveness), Ambition (development speed), Temperament (card risk & morale stability), Loyalty (transfer demand resistance), Leadership (team morale influence). These affect gameplay in meaningful ways.',
  },
  {
    title: 'Board Confidence & Objectives',
    content: 'The board sets seasonal objectives (critical/important/optional). Confidence changes based on match results, league position, and financial health. If confidence drops below 25, you get a warning. Below 10 = sacked. Win streaks boost confidence.',
  },
  {
    title: 'Season Turnover',
    content: 'Each league operates independently — there is no promotion or relegation between leagues. At the end of each season, the bottom clubs in each league are replaced by newly generated clubs, keeping the competition fresh.',
  },
  {
    title: 'Cup Competition',
    content: 'A knockout tournament separate from the league. Win to advance — lose and you\'re out. Cup matches can feature extra time and penalties. Cup victories earn XP and prestige.',
  },
  {
    title: 'Scouting',
    content: 'Assign scouts to 5 regions to discover hidden talent. Better scouts find higher-potential players. Assignments take several weeks. Discovered players appear in the transfer market or your watch list.',
  },
  {
    title: 'Youth Academy',
    content: 'Your academy produces young prospects at the end of each season. Upgrade youth facilities for better prospects. Promote the best to your first team. Youth development speed depends on your Youth Developer perk and facilities.',
  },
  {
    title: 'Finances',
    content: 'Income: matchday (fan base), commercial (reputation), merchandise, sponsorships, prize money. Expenses: wages, transfers, facility upgrades. Keep your wage-to-revenue ratio below 70% to avoid Financial Fair Play penalties.',
  },
  {
    title: 'Manager Perks & XP',
    content: 'Earn XP from wins, draws, cup victories, achievements, and weekly objectives. Level up to earn XP you can spend on permanent perks across 5 tiers. Perks include training boosts, transfer discounts, and match bonuses. The XP bar is at the top of the screen.',
  },
  {
    title: 'Prestige Mode',
    content: 'Reset your career with permanent bonuses carried over. The more you achieve before prestiging, the stronger your bonuses for the next run. Each prestige level increases the XP multiplier.',
  },
  {
    title: 'Injuries',
    content: '7 injury types with 3 severity levels (minor/moderate/severe). Medical facilities reduce injury probability. Re-injury risk exists for recently recovered players. A good physio speeds up recovery.',
  },
  {
    title: 'Morale & Form',
    content: 'Wins boost morale (+8) and form (+5). Losses hurt morale (-10) and form (-8). Players not in the lineup lose morale weekly. Very low morale (<30 for 4+ weeks) triggers transfer requests. Personality temperament affects morale stability.',
  },
];

const HelpPage = () => {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? HELP_SECTIONS.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.content.toLowerCase().includes(search.toLowerCase())
      )
    : HELP_SECTIONS;

  return (
    <div className="space-y-3 pb-4">
      <div className="flex items-center gap-2 mb-1">
        <HelpCircle className="w-5 h-5 text-primary" />
        <h2 className="font-display text-lg font-bold text-foreground">Game Guide</h2>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search topics..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-muted/30 border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
        />
      </div>

      {/* Sections */}
      <div className="space-y-1.5">
        {filtered.map((section) => {
          const originalIdx = HELP_SECTIONS.indexOf(section);
          const expanded = expandedIdx === originalIdx;
          return (
            <GlassPanel
              key={section.title}
              className="transition-all"
              onClick={() => setExpandedIdx(expanded ? null : originalIdx)}
            >
              <div className="p-3 flex items-center justify-between cursor-pointer">
                <p className="text-sm font-semibold text-foreground">{section.title}</p>
                {expanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </div>
              {expanded && (
                <div className="px-3 pb-3 -mt-1">
                  <p className="text-xs text-foreground/80 leading-relaxed">{section.content}</p>
                </div>
              )}
            </GlassPanel>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <GlassPanel className="p-8 text-center">
          <Search className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No topics match your search.</p>
        </GlassPanel>
      )}
    </div>
  );
};

export default HelpPage;
