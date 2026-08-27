#!/usr/bin/env node
/**
 * Local stand-in for the EA Drop API, used to exercise the pipeline end to end
 * without network access.
 *
 * The records it serves are SYNTHETIC and obviously so (names are
 * "Fixture Player N"). They exist to prove pagination, restart, gender
 * splitting, dedupe, validation and CSV escaping actually work. Nothing it
 * produces may ever be presented as FC27 data — `npm run fc27:smoke` writes
 * its output to a temp directory for exactly that reason.
 */
import { createServer } from 'http';

const TOTAL = Number(process.env.FIXTURE_TOTAL ?? 400);
const PORT = Number(process.env.FIXTURE_PORT ?? 8791);

const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'];
const CLUBS = ['Fixture City', 'Fixture United', 'Fixture, Rovers', 'Fixture "Athletic"'];

function makePlayer(i) {
  const isGk = i % 10 === 0;
  const stats = isGk
    ? { gkDiving: 60 + (i % 30), gkHandling: 60 + (i % 25), gkKicking: 55 + (i % 20), gkPositioning: 58 + (i % 22), gkReflexes: 62 + (i % 28) }
    : { pace: 40 + (i % 55), shooting: 35 + (i % 60), passing: 40 + (i % 50), dribbling: 42 + (i % 52), defending: 30 + (i % 65), physicality: 45 + (i % 48), acceleration: 40 + (i % 55), sprintSpeed: 41 + (i % 54), finishing: 35 + (i % 60), unmappedNewStat: i % 9 };
  return {
    id: 900000 + i,
    rank: i + 1,
    firstName: 'Fixture',
    lastName: `Player ${i}`,
    commonName: i % 3 === 0 ? `F. Player ${i}` : null,
    overallRating: 45 + (i % 45),
    birthdate: `${1990 + (i % 18)}-0${1 + (i % 9)}-1${i % 9}`,
    height: 165 + (i % 30),
    weight: 60 + (i % 30),
    skillMoves: 1 + (i % 5),
    weakFootAbility: 1 + (i % 5),
    // 1=Right, 2=Left with a realistic ~75/25 split so the validator's foot
    // check has something meaningful to assert against.
    preferredFoot: i % 4 === 0 ? 2 : 1,
    gender: { id: i % 7 === 0 ? 1 : 0, label: i % 7 === 0 ? 'Female' : 'Male' },
    nationality: { id: 1 + (i % 40), label: `Nation ${i % 40}` },
    team: { id: 100 + (i % 4), label: CLUBS[i % CLUBS.length] },
    leagueName: `Fixture League ${i % 5}`,
    position: { shortLabel: POSITIONS[isGk ? 0 : (i % 9) + 1], positionType: { name: isGk ? 'GOALKEEPER' : 'OUTFIELD' } },
    alternatePositions: i % 5 === 0 ? [{ shortLabel: 'CM' }] : [],
    playerAbilities: i % 2 === 0
      ? [{ label: 'Technical', type: { id: 'playStyle' } }, { label: 'Finesse Shot', type: { id: 'playStylePlus' } }]
      : [],
    stats: Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, { value: v, diff: 0 }])),
    avatarUrl: `https://example.invalid/${900000 + i}.png`,
  };
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (!url.pathname.startsWith('/rating/')) {
    res.writeHead(404).end('{}');
    return;
  }
  // Only the current season's slug answers, so resolveSlug() is genuinely
  // exercised rather than matching whatever it asks for first.
  if (!url.pathname.endsWith('/ea-sports-fc-27')) {
    res.writeHead(404, { 'Content-Type': 'application/json' }).end('{"error":"unknown title"}');
    return;
  }
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 100), 100);
  const offset = Number(url.searchParams.get('offset') ?? 0);
  const items = [];
  for (let i = offset; i < Math.min(offset + limit, TOTAL); i++) items.push(makePlayer(i));
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ totalItems: TOTAL, items }));
});

server.listen(PORT, '127.0.0.1', () => console.log(`[fixture] listening on http://127.0.0.1:${PORT} (${TOTAL} synthetic players)`));
