import type { ContinentalGroup, ContinentalGroupMatch, VirtualClub } from '@/types/game';
import { cn } from '@/lib/utils';
import { Shield, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface GroupTableProps {
  group: ContinentalGroup;
  virtualClubs: Record<string, VirtualClub>;
  playerClubId: string;
  clubs: Record<string, { name: string; shortName: string; color: string }>;
  isPlayerGroup: boolean;
  currentMatchday: number;
}

function ClubBadge({ color, size = 'sm' }: { color: string; size?: 'sm' | 'xs' }) {
  return (
    <div
      className={cn('rounded-full flex items-center justify-center shrink-0', size === 'sm' ? 'w-5 h-5' : 'w-4 h-4')}
      style={{ backgroundColor: color || '#888' }}
    >
      <Shield className={cn('text-white', size === 'sm' ? 'w-2.5 h-2.5' : 'w-2 h-2')} />
    </div>
  );
}

function getClubInfo(clubId: string, clubs: Record<string, { name: string; shortName: string; color: string }>, virtualClubs: Record<string, VirtualClub>) {
  const real = clubs[clubId];
  if (real) return { name: real.name, shortName: real.shortName, color: real.color };
  const vc = virtualClubs[clubId];
  if (vc) return { name: vc.name, shortName: vc.shortName, color: vc.color };
  return { name: 'Unknown', shortName: '???', color: '#888' };
}

function MatchResult({ match, clubs, virtualClubs, playerClubId }: {
  match: ContinentalGroupMatch;
  clubs: Record<string, { name: string; shortName: string; color: string }>;
  virtualClubs: Record<string, VirtualClub>;
  playerClubId: string;
}) {
  const home = getClubInfo(match.homeClubId, clubs, virtualClubs);
  const away = getClubInfo(match.awayClubId, clubs, virtualClubs);
  const isPlayer = match.homeClubId === playerClubId || match.awayClubId === playerClubId;

  return (
    <div className={cn(
      'flex items-center gap-2 py-1.5 px-2 rounded-lg text-xs',
      isPlayer && 'bg-primary/10 border border-primary/20'
    )}>
      <ClubBadge color={home.color} size="xs" />
      <span className={cn('flex-1 truncate', match.homeClubId === playerClubId && 'text-primary font-medium')}>{home.shortName}</span>
      {match.played ? (
        <span className="font-mono font-bold text-foreground">{match.homeGoals}-{match.awayGoals}</span>
      ) : (
        <span className="text-muted-foreground">vs</span>
      )}
      <span className={cn('flex-1 truncate text-right', match.awayClubId === playerClubId && 'text-primary font-medium')}>{away.shortName}</span>
      <ClubBadge color={away.color} size="xs" />
    </div>
  );
}

export function GroupTable({ group, virtualClubs, playerClubId, clubs, isPlayerGroup, currentMatchday }: GroupTableProps) {
  const [expanded, setExpanded] = useState(isPlayerGroup);
  const [showMatches, setShowMatches] = useState(false);

  return (
    <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left px-3 py-2.5"
      >
        {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        <span className={cn('text-sm font-display font-bold', isPlayerGroup ? 'text-primary' : 'text-foreground')}>
          Group {group.id}
        </span>
        {isPlayerGroup && (
          <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">Your Group</span>
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {/* Standings table */}
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border/30">
                <th className="text-left py-1 w-5">#</th>
                <th className="text-left py-1">Club</th>
                <th className="text-center py-1 w-6">P</th>
                <th className="text-center py-1 w-6">W</th>
                <th className="text-center py-1 w-6">D</th>
                <th className="text-center py-1 w-6">L</th>
                <th className="text-center py-1 w-8">GD</th>
                <th className="text-center py-1 w-7 font-bold">Pts</th>
              </tr>
            </thead>
            <tbody>
              {group.standings.map((s, idx) => {
                const info = getClubInfo(s.clubId, clubs, virtualClubs);
                const isPlayer = s.clubId === playerClubId;
                const qualifies = idx < 2;

                return (
                  <tr key={s.clubId} className={cn(
                    'border-b border-border/10',
                    isPlayer && 'bg-primary/5',
                    qualifies && !isPlayer && 'bg-emerald-500/5',
                  )}>
                    <td className={cn('py-1.5 font-medium', qualifies ? 'text-emerald-400' : 'text-muted-foreground')}>{idx + 1}</td>
                    <td className="py-1.5">
                      <div className="flex items-center gap-1.5">
                        <ClubBadge color={info.color} size="xs" />
                        <span className={cn('truncate', isPlayer ? 'text-primary font-bold' : 'text-foreground')}>
                          {info.shortName}
                        </span>
                      </div>
                    </td>
                    <td className="text-center text-muted-foreground">{s.played}</td>
                    <td className="text-center">{s.won}</td>
                    <td className="text-center text-muted-foreground">{s.drawn}</td>
                    <td className="text-center text-muted-foreground">{s.lost}</td>
                    <td className="text-center">
                      <span className={cn({
                        'text-emerald-400': s.goalsFor - s.goalsAgainst > 0,
                        'text-destructive': s.goalsFor - s.goalsAgainst < 0,
                        'text-muted-foreground': s.goalsFor - s.goalsAgainst === 0,
                      })}>
                        {s.goalsFor - s.goalsAgainst > 0 ? '+' : ''}{s.goalsFor - s.goalsAgainst}
                      </span>
                    </td>
                    <td className="text-center font-bold">{s.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Toggle matches */}
          <button
            onClick={() => setShowMatches(!showMatches)}
            className="mt-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {showMatches ? 'Hide matches' : 'Show matches'}
          </button>

          {showMatches && (
            <div className="mt-2 space-y-0.5">
              {[1, 2, 3, 4, 5, 6].map(md => {
                const mdMatches = group.matches.filter(m => m.matchday === md);
                if (mdMatches.length === 0) return null;
                const allPlayed = mdMatches.every(m => m.played);
                return (
                  <div key={md}>
                    <div className={cn('text-[10px] font-medium py-1', md === currentMatchday ? 'text-primary' : 'text-muted-foreground')}>
                      Matchday {md} {md === currentMatchday && !allPlayed ? '(Current)' : ''}
                    </div>
                    {mdMatches.map(m => (
                      <MatchResult key={m.id} match={m} clubs={clubs} virtualClubs={virtualClubs} playerClubId={playerClubId} />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
