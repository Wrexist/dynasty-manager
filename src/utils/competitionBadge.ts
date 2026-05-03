export interface CompetitionBadgeInfo {
  name: string;
  color: string;
  bg: string;
  borderAccent: string;
}

export function getCompetitionInfo(
  competition: string | undefined,
  options?: { inPlayoffs?: boolean; leagueName?: string }
): CompetitionBadgeInfo {
  // `orchestrationSlice` stores cup matches as `"<Name> — <Round>"`
  // (e.g. "Dynasty Cup — QF"). Strip the round suffix before matching so
  // the badge lookup stays a simple exact match per competition name.
  const base = competition?.split(' — ')[0];
  if (base === 'Pre-Season Friendly') {
    return { name: 'Friendly', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', borderAccent: 'border-emerald-500/40' };
  }
  if (base === 'Dynasty Cup') {
    return { name: 'Dynasty Cup', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', borderAccent: 'border-amber-500/40' };
  }
  if (base === 'League Cup') {
    return { name: 'League Cup', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/30', borderAccent: 'border-cyan-500/40' };
  }
  if (base === 'Champions Cup') {
    return { name: 'Champions Cup', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30', borderAccent: 'border-blue-500/40' };
  }
  if (base === 'Shield Cup') {
    return { name: 'Shield Cup', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', borderAccent: 'border-orange-500/40' };
  }
  if (base === 'Conference Cup') {
    return { name: 'Conference Cup', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', borderAccent: 'border-emerald-500/40' };
  }
  if (base === 'Super Cup' || base === 'Continental Super Cup') {
    return { name: base, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30', borderAccent: 'border-rose-500/40' };
  }
  // League match
  if (options?.inPlayoffs) {
    return { name: 'Playoff', color: 'text-primary', bg: 'bg-primary/10 border-primary/30', borderAccent: 'border-primary/40' };
  }
  const name = options?.leagueName ?? 'League';
  return { name, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30', borderAccent: 'border-blue-500/40' };
}
