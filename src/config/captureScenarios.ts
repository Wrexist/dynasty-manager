/**
 * Capture Studio — staged World Cup scenarios for recording marketing footage
 * (see `marketing/scripts/tiktok-06-pov-textwall.md` for the ads they feed).
 *
 * Each scenario boots a throwaway World Cup session (never written to a save
 * slot — see `captureSession` in the store) with the tournament fast-forwarded
 * to a Final between two star nations, so a promo video can be screen-recorded
 * in one tap instead of playing seven rounds first.
 *
 * Nations must exist in `src/data/nations.ts`; star names are best-effort
 * matches against the auto-picked XI from the FC26-derived national pools.
 */
import type { CaptureScenario } from '@/types/game';

export const CAPTURE_SCENARIOS: CaptureScenario[] = [
  {
    id: 'goat-final',
    title: 'Messi vs Ronaldo — the last dance',
    tagline: 'Argentina–Portugal World Cup final, straight into a penalty shootout at 2-2.',
    playerNation: 'Argentina',
    opponentNation: 'Portugal',
    stage: 'penalties',
    starScorers: { player: ['Messi', 'Martínez', 'Álvarez'], opponent: ['Ronaldo', 'Félix', 'Fernandes'] },
  },
  {
    id: 'mbappe-rematch',
    title: 'France–Argentina: the rematch',
    tagline: 'The 2022 final all over again — decided on penalties at 2-2.',
    playerNation: 'France',
    opponentNation: 'Argentina',
    stage: 'penalties',
    starScorers: { player: ['Mbappé', 'Griezmann', 'Dembélé'], opponent: ['Messi', 'Martínez', 'Álvarez'] },
  },
  {
    id: 'england-pens',
    title: 'England on penalties. Again.',
    tagline: 'England–Germany World Cup final shootout at 2-2. You know how this goes.',
    playerNation: 'England',
    opponentNation: 'Germany',
    stage: 'penalties',
    starScorers: { player: ['Kane', 'Bellingham', 'Saka'], opponent: ['Musiala', 'Wirtz', 'Havertz'] },
  },
  {
    id: 'yamal-coronation',
    title: "Yamal's coronation",
    tagline: 'Spain–Argentina World Cup final from kickoff — film the whole match live.',
    playerNation: 'Spain',
    opponentNation: 'Argentina',
    stage: 'kickoff',
  },
  {
    id: 'haaland-first',
    title: "Haaland's first final",
    tagline: "Norway–Brazil — Norway's first-ever World Cup final, from kickoff.",
    playerNation: 'Norway',
    opponentNation: 'Brazil',
    stage: 'kickoff',
  },
];

export const getCaptureScenario = (id: string): CaptureScenario | undefined =>
  CAPTURE_SCENARIOS.find(s => s.id === id);
