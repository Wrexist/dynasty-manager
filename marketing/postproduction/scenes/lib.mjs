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
