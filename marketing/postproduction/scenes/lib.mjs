/** Shared scene helpers for capture-app.mjs. Everything here goes through the
 *  app's own store actions — the same calls the UI makes. */

/** Start a fresh career at `clubId` in save slot 1. */
export async function startCareer(h, clubId, nationality = 'England') {
  await h.store(async (s, _p, a) => {
    await s.getState().initGame(a.clubId, { communityPackEnabled: true });
    s.getState().initNationalTeam?.(a.nationality);
    s.setState({ activeSlot: 1 });
    s.getState().saveGame(1);
  }, { clubId, nationality });
}

/** Play the user's match (if any) and advance, `weeks` times. Returns one
 *  line per played match, e.g. "W 2-1 vs Wrexham (H)". */
export async function simWeeks(h, weeks) {
  return h.store(async (s, _p, n) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const st = s.getState();
      let m = null;
      try { m = st.playCurrentMatch(); } catch (e) { out.push('ERR ' + e.message); }
      if (m) {
        const me = st.playerClubId;
        const home = m.homeClubId === me;
        const opp = s.getState().clubs[home ? m.awayClubId : m.homeClubId];
        const gf = home ? m.homeGoals : m.awayGoals, ga = home ? m.awayGoals : m.homeGoals;
        out.push(`${gf > ga ? 'W' : gf < ga ? 'L' : 'D'} ${gf}-${ga} vs ${opp?.name || '?'} (${home ? 'H' : 'A'}) wk${st.week}`);
      }
      await s.getState().advanceWeek();
    }
    s.getState().saveGame(1);
    return out;
  }, weeks);
}

/** League position, points and week for the user's club. */
export async function standing(h) {
  return h.store((s) => {
    const st = s.getState();
    const me = st.playerClubId;
    const club = st.clubs[me];
    const table = st.leagueTable || [];
    const idx = table.findIndex(r => r.clubId === me);
    return { club: club.name, week: st.week, season: st.season, pos: idx + 1, row: table[idx] };
  });
}

/** Load save slot 1 into the store (a fresh page starts on the title screen
 *  with nothing loaded). */
export async function resume(h) {
  return h.store((s) => {
    if (!s.getState().gameStarted) s.getState().loadGame(1);
    return s.getState().gameStarted;
  });
}

/** Put the device on day `day` of a login streak with today's free packs
 *  unopened — the state a real player is in on that morning. Device-level
 *  records (not the save), so the page is reloaded to drop in-memory mirrors. */
export async function setStreakDay(h, day) {
  await h.page.evaluate((n) => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    localStorage.setItem('dynasty-daily-streak', JSON.stringify({ lastClaimDate: key, current: n - 1, longest: Math.max(n - 1, 0) }));
    localStorage.removeItem('dynasty-daily-pack-opens');
  }, day);
  await h.page.reload({ waitUntil: 'networkidle' });
}

/** Drive a pack open through the real overlay: tap the store button matching
 *  `button` (a RegExp — labels are CSS-uppercased, the DOM text is not),
 *  rip, reveal, ride the walkout, hold the summary. */
export async function openPackUI(h, button, nth = 0, { holdSummary = 3500, reveal = 'all' } = {}) {
  await h.page.getByText(button).nth(nth).tap();
  await h.wait(1600);
  for (let i = 0; i < 10; i++) {
    if (await h.page.getByText(/tap all to reveal/i).count()) break;
    await h.tap(195, 345); await h.wait(700);
  }
  await h.wait(900);
  if (reveal === 'all' && await h.page.getByText(/tap all to reveal/i).count()) {
    await h.page.getByText(/tap all to reveal/i).tap();
  }
  await h.wait(holdSummary);
}

/** Hide first-visit page hints — capture polish, a real setting players have. */
export async function hideHints(h) {
  await h.store((s) => s.setState({ settings: { ...s.getState().settings, hidePageHints: true } }));
}

/** From anywhere in the game: Match Prep → Ready to Play → kick off at `speed`. */
export async function kickOff(h, speed = /^fast$/i) {
  await h.screen('match-prep'); await h.wait(1800);
  await h.page.getByText(/ready to play/i).first().tap();
  await h.wait(1800);
  await h.page.getByRole('button', { name: speed }).first().tap().catch(() => {});
  await h.page.getByRole('button', { name: /motivate/i }).first().tap().catch(() => {});
  await h.page.getByRole('button', { name: /kick off/i }).first().tap();
}

/** Play `weeks` Sunday League weeks the way a player would: arrive, play short
 *  rather than pay ringers, auto-pick, play, take the first choice on any
 *  event, advance. Returns one line per match. */
export async function simSundayWeeks(h, weeks) {
  return h.store(async (s, _p, n) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const g = () => s.getState();
      try {
        const ev = g().sunday?.pendingEvent;
        if (ev?.choices?.length) await g().resolveSundayEvent(ev.choices[0].id);
        await g().arriveSundayMatch();
        await g().hireSundayRingers(0).catch(() => {});
        await g().autoPickSundayTeamsheet();
        const r = await g().playSundayMatch();
        if (r) out.push(`${r.goalsFor > r.goalsAgainst ? 'W' : r.goalsFor < r.goalsAgainst ? 'L' : 'D'} ${r.goalsFor}-${r.goalsAgainst} vs ${r.opponentName} wk${r.week}`);
        const ev2 = g().sunday?.pendingEvent;
        if (ev2?.choices?.length) await g().resolveSundayEvent(ev2.choices[0].id);
        await g().advanceWeek();
      } catch (e) { out.push('ERR ' + e.message); }
    }
    return out;
  }, weeks);
}

/** Sunday facts for captions. */
export async function sundayFacts(h) {
  return h.store((s) => {
    const st = s.getState();
    const su = st.sunday;
    const avail = (su.squad || []).filter(m => !m.unavailable && !m.injuredWeeks).length;
    return { week: st.week, season: st.season, totalWeeks: st.totalWeeks, balance: su.balance, name: su.identity?.name,
      division: su.divisionId, squad: su.squad.length, avail, morale: su.teamMorale, arrival: su.arrival };
  });
}

/** Play out the rest of the season (league, then any play-off) and call
 *  endSeason() exactly when the Dashboard would offer "View season summary".
 *  Returns the match lines. */
export async function finishSeason(h) {
  return h.page.evaluate(async () => {
    const { useGameStore: s } = await import('/src/store/gameStore.ts');
    const { isSeasonOver } = await import('/src/utils/dashboardSelectors.ts');
    const out = [];
    const season = s.getState().season;
    for (let i = 0; i < 80 && s.getState().season === season; i++) {
      const st = s.getState();
      // endSeason() first ENTERS a promotion play-off when the club is in
      // one, and the season only rolls once the player's ties are played.
      if (st.seasonPhase === 'playoff') {
        const pm = st.playoffState?.pendingMatch ? st.playCurrentMatch() : null;
        if (pm) out.push(`playoff ${pm.homeGoals}-${pm.awayGoals}`);
        else await s.getState().advanceWeek();
        continue;
      }
      if (isSeasonOver(st)) { st.endSeason(); continue; }
      const m = st.playCurrentMatch();
      if (m) out.push(`wk${st.week} ${m.homeGoals}-${m.awayGoals}`);
      await s.getState().advanceWeek();
    }
    s.getState().saveGame(s.getState().activeSlot || 1);
    return out;
  });
}

/** A new season can open on an international tournament that waits for the
 *  national squad. Do what a player does: open the picker, "Auto-pick best
 *  23", lock in — then play the tournament weeks out until club football
 *  resumes. No-op when nothing is waiting. */
export async function clearInternationalBreak(h) {
  const phase = () => h.store((s) => s.getState().seasonPhase);
  if ((await phase()) !== 'international') return false;
  await h.go('#/game');
  await h.wait(2000);
  await h.screen('national-squad-picker');
  await h.wait(2000);
  const auto = h.page.getByRole('button', { name: /auto-pick best/i });
  if (await auto.count()) {
    await auto.first().tap();
    await h.wait(800);
    // The lock-in button sits under the bottom nav at this viewport; a DOM
    // click is what a thumb that scrolled first would do.
    await h.page.locator('button', { hasText: /lock in squad/i }).first().evaluate(b => b.click()).catch(() => {});
    await h.wait(1200);
  }
  for (let i = 0; i < 30 && (await phase()) === 'international'; i++) {
    await h.store(async (s) => { try { s.getState().playCurrentMatch(); } catch { /* none */ } await s.getState().advanceWeek(); });
  }
  return true;
}
