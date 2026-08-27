/**
 * One CLI parser for the whole pipeline.
 *
 * Previously the extractor owned the parser, so it also had to know about
 * flags only the orchestrator used (`--merge-potential`, `--export-for-game`).
 * Every stage now reads the same parsed shape and ignores what it does not
 * need.
 */

/** @type {Record<string, 'string' | 'number' | 'boolean'>} */
const FLAGS = {
  // Source + pagination
  '--base': 'string',
  '--slug': 'string',
  '--locale': 'string',
  '--gender': 'string',
  '--limit': 'number',
  '--delay': 'number',
  '--max': 'number',
  // Locations
  '--raw-dir': 'string',
  '--out-dir': 'string',
  '--csv': 'string',
  '--report': 'string',
  '--game-out': 'string',
  // Behaviour
  '--min': 'number',
  '--baseline': 'string',
  '--from': 'string',
  '--label': 'string',
  '--league-map': 'string',
  '--out': 'string',
  '--merge-potential': 'string',
  '--potential-label': 'string',
  '--fresh': 'boolean',
  '--clamp': 'boolean',
  '--clamp-potential': 'boolean',
  '--export-for-game': 'boolean',
  '--no-compare': 'boolean',
  '--dry-run': 'boolean',
};

/** `--out-dir` -> `outDir`. */
const camel = (flag) => flag.replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());

export const DEFAULTS = { limit: 100, delay: 1000, max: Infinity, locale: 'en', fresh: false };

/**
 * Parse `--flag value`, `--flag=value` and bare boolean flags.
 * Unknown flags are an error rather than a silent no-op — a typo'd
 * `--merge-potentials` must not quietly skip the merge.
 *
 * @param {string[]} argv
 * @returns {Record<string, any>}
 */
export function parseArgs(argv) {
  const args = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const eq = token.indexOf('=');
    const flag = eq === -1 ? token : token.slice(0, eq);
    const kind = FLAGS[flag];
    if (!kind) throw new Error(`Unknown flag ${flag}. Known flags: ${Object.keys(FLAGS).join(' ')}`);

    if (kind === 'boolean') {
      args[camel(flag)] = true;
      continue;
    }
    const raw = eq === -1 ? argv[++i] : token.slice(eq + 1);
    if (raw === undefined) throw new Error(`${flag} needs a value.`);
    const value = kind === 'number' ? Number(raw) : raw;
    if (kind === 'number' && Number.isNaN(value)) throw new Error(`${flag} needs a number, got "${raw}".`);
    args[camel(flag)] = value;
  }
  // `--clamp` and `--clamp-potential` are the same switch under two names,
  // because the standalone stage and the orchestrator each read naturally.
  if (args.clampPotential) args.clamp = true;
  return args;
}
