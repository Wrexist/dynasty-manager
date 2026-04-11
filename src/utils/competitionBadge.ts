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
  if (competition === 'Pre-Season Friendly') {
    return { name: 'Friendly', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', borderAccent: 'border-emerald-500/40' };
  }
  if (competition === 'Dynasty Cup') {
    return { name: 'Dynasty Cup', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', borderAccent: 'border-primary/40' };
  }
  if (competition === 'League Cup') {
    return { name: 'League Cup', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/30', borderAccent: 'border-cyan-500/40' };
  }
  if (competition === 'Champions Cup') {
    return { name: 'Champions Cup', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30', borderAccent: 'border-blue-500/40' };
  }
  if (competition === 'Shield Cup') {
    return { name: 'Shield Cup', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', borderAccent: 'border-orange-500/40' };
  }
  if (competition === 'Conference Cup') {
    return { name: 'Conference Cup', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', borderAccent: 'border-emerald-500/40' };
  }
  if (competition === 'Super Cup' || competition === 'Continental Super Cup') {
    return { name: competition, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30', borderAccent: 'border-purple-500/40' };
  }
  // League match
  if (options?.inPlayoffs) {
    return { name: 'Playoff', color: 'text-primary', bg: 'bg-primary/10 border-primary/30', borderAccent: 'border-primary/40' };
  }
  const name = options?.leagueName || 'League';
  return { name, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30', borderAccent: 'border-blue-500/40' };
}
