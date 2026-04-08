# Missing Real Players Spreadsheet (Not Integrated)

This spreadsheet is a planning file only and is **not integrated into gameplay**.

- File: `docs/missing_real_players_template.csv`
- Scope: all clubs in `src/data/leagues/*.ts`
- Target squad size: 25 players per club (matching `SQUAD_TEMPLATE`)
- Included rows: only missing slots for clubs whose real template squad is incomplete

## Columns

- Team metadata: `league_id`, `country`, `team_id`, `team_name`
- Gap tracking: `current_template_players`, `target_squad_size`, `missing_players_for_team`, `missing_slot_index`
- Player identity placeholders: `required_real_player_name`, `age`, `nationality`, `preferred_foot`
- FIFA-style rating targets:
  - Outfield: `pace`, `shooting`, `passing`, `dribbling`, `defending`, `physical`
  - Goalkeeper: `diving`, `handling`, `kicking`, `reflexes`, `speed`, `positioning`
- Overall guidance: `target_overall`, `target_potential`

## How to use

1. Filter one team in the CSV.
2. Fill `required_real_player_name` and identity fields with real players only.
3. Keep `position` and target ratings as baseline, then adjust after scouting/validation.
4. Once all rows for a team are filled, that team is ready for manual import later.
