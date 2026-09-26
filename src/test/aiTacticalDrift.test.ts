/**
 * AI in-season tactical adaptation bends a manager's approach; it must not
 * permanently rewrite it.
 *
 * `processAITacticalAdaptation` stepped the mentality DOWN after three defeats
 * (always) or two in three (30%), and UP after three wins (20%), and nothing
 * ever undid either. Losing and winning runs are equally common across a league,
 * so the world ratcheted toward `defensive`: measured on a real save the count of
 * defensive managers went 54 at kickoff -> 97 -> 113 -> 120 of 168 over three
 * seasons, and because mutual caution is the engine's lowest-scoring matchup,
 * league scoring fell season on season with it (audit S6).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { processAITacticalAdaptation } from '@/utils/aiSimulation';
import { generateAIManagerProfile, getAIStyleTactics } from '@/config/aiManager';
import type { Club, LeagueTableEntry, AIManagerStyle } from '@/types/game';
import { mulberry32 } from './helpers/matchCalibration';

const MENTALITIES = ['defensive', 'cautious', 'balanced', 'attacking', 'all-out-attack'];
const originalRandom = Math.random;
afterEach(() => { Math.random = originalRandom; });

function mkClub(id: string, style: AIManagerStyle): Club {
  const profile = generateAIManagerProfile(id, 3);
  return {
    id, formation: '4-4-2',
    aiManagerProfile: { ...profile, style, adaptability: 0.9, defaultTactics: getAIStyleTactics(style) },
  } as unknown as Club;
}

describe('AI tactical adaptation over a long run of ordinary results', () => {
  it('keeps each manager near his own style instead of ratcheting defensive', () => {
    Math.random = mulberry32(0xA11CE);
    const styles: AIManagerStyle[] = ['balanced', 'direct', 'counter-attack', 'defensive'];
    let clubs: Record<string, Club> = {};
    for (let i = 0; i < 40; i++) {
      const c = mkClub(`c${i}`, styles[i % styles.length]);
      clubs[c.id] = c;
    }
    const pick = () => (['W', 'D', 'L'] as const)[Math.floor(Math.random() * 3)];

    // Two seasons of weeks, every club on an even W/D/L diet — exactly as many
    // losing runs as winning runs.
    for (let week = 0; week < 90; week++) {
      const table: LeagueTableEntry[] = Object.keys(clubs).map(clubId => ({
        clubId, form: [pick(), pick(), pick()],
      } as unknown as LeagueTableEntry));
      clubs = processAITacticalAdaptation(clubs, { eng: table }, 'player');
    }

    // Mean signed distance, in mentality steps, from each manager's own style.
    let drift = 0;
    for (const c of Object.values(clubs)) {
      const p = c.aiManagerProfile!;
      drift += MENTALITIES.indexOf(p.defaultTactics.mentality) - MENTALITIES.indexOf(getAIStyleTactics(p.style).mentality);
    }
    drift /= Object.keys(clubs).length;
    // Measured on this seed: old rule -1.23 steps (most balanced and direct
    // managers ended cautious or defensive, and nobody ever came back); with
    // the drift back to style, -0.03.
    expect(drift).toBeGreaterThan(-0.6);
    expect(drift).toBeLessThan(0.6);
  });

  it('still reacts to a losing streak', () => {
    Math.random = mulberry32(0xB0B);
    let clubs: Record<string, Club> = { x: mkClub('x', 'balanced') };
    for (let week = 0; week < 20; week++) {
      clubs = processAITacticalAdaptation(clubs, { eng: [{ clubId: 'x', form: ['L', 'L', 'L'] } as unknown as LeagueTableEntry] }, 'player');
    }
    expect(clubs.x.aiManagerProfile!.defaultTactics.mentality).not.toBe('balanced');
  });
});
