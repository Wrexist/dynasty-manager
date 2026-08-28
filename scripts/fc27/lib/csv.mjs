/**
 * RFC4180 CSV read/write for the FC27 pipeline.
 *
 * The repo already has a CSV line parser in scripts/analyzeFC26.mjs, but it
 * splits on "\n" first, so it corrupts any record containing a quoted
 * newline. Player names and PlayStyle lists can carry odd characters, and a
 * silently mangled row is exactly the kind of bug this dataset must not
 * ship, so this parser is character-driven end to end.
 */

/**
 * Parse CSV text into an array of row objects keyed by header.
 * Handles quoted fields, escaped quotes ("") and embedded newlines.
 * @param {string} text
 * @returns {Record<string, string>[]}
 */
export function parseCsv(text) {
  const rows = parseRows(text);
  if (rows.length === 0) return [];
  const headers = rows[0];
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    // A trailing newline yields one empty cell; that is not a record.
    if (values.length === 1 && values[0] === '') continue;
    const obj = {};
    for (let j = 0; j < headers.length; j++) obj[headers[j]] = values[j] ?? '';
    out.push(obj);
  }
  return out;
}

/** @param {string} text @returns {string[][]} */
function parseRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  // Strip a UTF-8 BOM; Excel adds one and it poisons the first header name.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }
  row.push(field);
  rows.push(row);
  return rows;
}

/**
 * Serialise a value for CSV. `null`/`undefined` become an EMPTY field, which
 * is this pipeline's encoding of "the source did not supply this" — see
 * docs/fc27/README.md § Missing data. It is never a zero and never a guess.
 * @param {unknown} value
 * @returns {string}
 */
export function csvCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/**
 * Render rows to CSV text with a fixed column order.
 * @param {string[]} columns
 * @param {Record<string, unknown>[]} rows
 * @returns {string}
 */
export function toCsv(columns, rows) {
  const lines = [columns.map(csvCell).join(',')];
  for (const row of rows) lines.push(columns.map((c) => csvCell(row[c])).join(','));
  return `${lines.join('\n')}\n`;
}
