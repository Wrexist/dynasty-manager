// Maps a league-data club `id` to the key used in `CLUB_TEMPLATES`
// (src/data/squads/*.ts). Only entries where the two differ live here —
// matching ids are found directly.
//
// Every value MUST correspond to a real key in CLUB_TEMPLATES. A test in
// src/test/clubTemplateAliases.test.ts enforces this.
//
// Now empty: src/data/squads/*.ts files are auto-generated from FC26
// (scripts/buildClubTemplatesFromFC26.mjs) and keyed by the league
// club id directly, so no aliasing is needed. Add an entry here only
// if a hand-curated squad file is ever introduced under a non-canonical
// key.
export const CLUB_TEMPLATE_ALIASES: Record<string, string> = {};

/** Resolve a league club id to the matching `CLUB_TEMPLATES` key. */
export function resolveSquadKey(clubId: string): string {
  return CLUB_TEMPLATE_ALIASES[clubId] || clubId;
}
