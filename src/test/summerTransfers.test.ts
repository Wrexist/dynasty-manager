import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { applyTransferUpdates } from '../../scripts/fc27/lib/transferUpdates.mjs';
import { parseCsv } from '../../scripts/fc27/lib/csv.mjs';
import { isMain } from '../../scripts/lib/isMain.mjs';
import { ALL_CLUBS } from '@/data/league';
import { byClub } from '@/data/communityPack/byClub';
import { freeAgents } from '@/data/communityPack/freeAgents';
import { confirmedFreeAgents } from '@/data/communityPack/confirmedFreeAgents';
import { cpLeagueSquads } from '@/data/communityPack/cpLeagueSquads';
import { mergeRosterTemplates } from '@/utils/mergeRosterTemplates';
import type { PlayerTemplate } from '@/data/playerTemplates';
import { useGameStore } from '@/store/gameStore';
import { calculateSigningBonus } from '@/utils/transferOffers';

const ledger = JSON.parse(readFileSync(resolve('data/transfers/summer-2026.json'), 'utf8'));
const rows = parseCsv(readFileSync(resolve('data/fc27/FC27_male_players_reconciled.csv'), 'utf8'));

describe('reviewed summer roster update', () => {
  it('uses updated foreign squads and preserves loan ownership through return', async () => {
    await useGameStore.getState().initGame('arsenal', { communityPackEnabled: true });
    const state = useGameStore.getState();
    for (const transfer of ledger.transfers.filter(t => t.toClubId && state.clubs[t.toClubId])) {
      const matches = Object.values(state.players).filter(p => p.fcId === transfer.playerId);
      expect(matches, transfer.name).toHaveLength(1);
      expect(matches[0].clubId, transfer.name).toBe(transfer.toClubId);
      if (transfer.kind === 'loan') {
        const player = matches[0];
        expect(player.onLoan).toBe(true);
        expect(player.loanFromClubId).toBe(transfer.loan.fromClubId);
        expect(state.clubs[player.loanFromClubId!]).toBeDefined();
        expect(state.startNegotiation(player.id, true)).toEqual({ success: false });
        expect(state.activeLoans.filter(l => l.playerId === player.id)).toHaveLength(1);
      }
    }
    expect(state.activeLoans.length).toBeGreaterThan(0);
    const loans = JSON.parse(JSON.stringify(state.activeLoans));
    state.processLoanReturns(true);
    const after = useGameStore.getState();
    expect(after.activeLoans).toHaveLength(0);
    for (const loan of loans) {
      expect(after.players[loan.playerId].clubId).toBe(loan.fromClubId);
      expect(after.players[loan.playerId].onLoan).toBe(false);
      expect(after.clubs[loan.toClubId].playerIds).not.toContain(loan.playerId);
      expect(after.clubs[loan.fromClubId].playerIds).toContain(loan.playerId);
      expect(after.freeAgents).not.toContain(loan.playerId);
    }
  });
  it('seeds every verified free agent once and signs one through the existing free-agent flow', async () => {
    await useGameStore.getState().initGame('real-madrid', { communityPackEnabled: true });
    const state = useGameStore.getState();
    expect(state.freeAgents).toHaveLength(confirmedFreeAgents.length);
    for (const template of confirmedFreeAgents) {
      const matches = Object.values(state.players).filter(p => p.fcId === template.fcId);
      expect(matches, template.ln).toHaveLength(1);
      const player = matches[0];
      expect(player.clubId).toBe('');
      expect(state.freeAgents).toContain(player.id);
      expect(state.transferMarket.some(listing => listing.playerId === player.id)).toBe(false);
      expect(Object.values(state.clubs).some(club => club.playerIds.includes(player.id))).toBe(false);
    }
    const player = state.freeAgents.map(id => state.players[id]).sort((a, b) => a.overall - b.overall)[0];
    const before = state.clubs['real-madrid'].budget;
    const result = state.signFreeAgent(player.id, player.wage, 2);
    expect(result.success, result.message).toBe(true);
    const after = useGameStore.getState();
    expect(after.players[player.id].clubId).toBe('real-madrid');
    expect(after.freeAgents).not.toContain(player.id);
    expect(after.clubs['real-madrid'].budget).toBe(before - calculateSigningBonus(player.wage, 2));
  });
  it('generates every reviewed identity at exactly its confirmed club, including fallback leagues', () => {
    const merged = mergeRosterTemplates(cpLeagueSquads, byClub, [...freeAgents, ...confirmedFreeAgents]);
    for (const transfer of ledger.transfers) {
      const id = transfer.playerId; // Preserve the source ID used by existing templates.
      const clubs = Object.entries(merged).filter(([, squad]) => squad.some(p => p.fcId === id)).map(([club]) => club);
      expect(clubs, transfer.name).toEqual(transfer.kind === 'free-agent' ? [] : [transfer.toClubId]);
      expect(freeAgents.some(p => p.fcId === id), transfer.name).toBe(false);
      expect(confirmedFreeAgents.filter(p => p.fcId === id).length).toBe(transfer.kind === 'free-agent' ? 1 : 0);
    }
  });

  it('validates source identities and is repeatable without modifying the input snapshot', () => {
    const before = JSON.stringify(rows);
    const updated = applyTransferUpdates(rows, ledger, ALL_CLUBS);
    expect(applyTransferUpdates(updated, ledger, ALL_CLUBS)).toEqual(updated);
    expect(JSON.stringify(rows)).toBe(before);
    for (const transfer of ledger.transfers) {
      const row = updated.find(r => r.player_id === transfer.playerId);
      expect(row.game_club_id).toBe(transfer.toClubId ?? '');
      expect(row.overall).toBe(rows.find(r => r.player_id === transfer.playerId).overall);
    }
  });

  it.each([
    ['unknown identity', { playerId: 'not-a-player' }],
    ['wrong name', { name: 'Other Person' }],
    ['wrong nationality', { nationality: 'Unknown' }],
    ['unknown club', { toClubId: 'not-a-club' }],
    ['missing evidence', { source: 'rumour' }],
    ['future update', { date: '2027-01-01' }],
    ['unsupported kind', { kind: 'rumour' }],
  ])('refuses %s instead of silently assigning a player', (_label, patch) => {
    const invalid = { ...ledger, transfers: [{ ...ledger.transfers[0], ...patch }] };
    expect(() => applyTransferUpdates(rows, invalid, ALL_CLUBS)).toThrow();
  });

  it('refuses two competing destinations for the same identity', () => {
    expect(() => applyTransferUpdates(rows, { ...ledger, transfers: [ledger.transfers[0], ledger.transfers[0]] }, ALL_CLUBS)).toThrow('Duplicate transfer');
  });

  it('removes stale fallback identities without mutating either dataset', () => {
    const player = { fcId: 'fc26-1', fn: 'Test', ln: 'Player' } as PlayerTemplate;
    const fallback = { old: [player], other: [{ ...player, fcId: 'fc26-2' }] };
    const current = { destination: [player] };
    const merged = mergeRosterTemplates(fallback, current, []);
    expect(merged.old).toEqual([]);
    expect(merged.destination).toEqual([player]);
    expect(merged.other).toEqual(fallback.other);
    expect(fallback.old).toEqual([player]);
  });

  it('recognises a script entry in paths containing spaces', () => {
    const path = resolve('folder with spaces', 'extract.mjs');
    expect(isMain(pathToFileURL(path).href, path)).toBe(true);
    expect(isMain(pathToFileURL(path).href, resolve('different.mjs'))).toBe(false);
    expect(isMain(pathToFileURL(path).href, '')).toBe(false);
  });
});
