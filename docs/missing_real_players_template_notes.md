# Missing Real Players Spreadsheet (Not Integrated)

This is a planning/export artifact only. It does **not** import players into the game yet.

## Generated files

- `docs/missing_real_players_template.csv` (row-level, one row per missing player slot)
- `docs/missing_real_players_summary.csv` (team-level completeness overview)

## Coverage rules

- Reads all clubs from `src/data/leagues/*.ts`
- Reads existing template players from `src/data/squads/*.ts`
- Compares against the 25-player squad template used by generation
- Includes only missing slots for each club

## Why this version is implementation-ready

The detailed CSV now includes:

- Team identity and gap-tracking columns (`team_id`, `team_name`, `current_template_players`, `missing_players_for_team`)
- Real-player placeholders (`required_real_player_name`, `age`, `nationality`, `preferred_foot`)
- Core game attributes needed by `PlayerAttributes` (`pace`, `shooting`, `passing`, `defending`, `physical`, `mental`)
- Personality placeholders/guidance (`professionalism`, `ambition`, `temperament`, `loyalty`, `leadership`)
- Economic/contract guidance (`target_value_eur`, `target_weekly_wage_eur`, `target_contract_years`)
- FIFA-style expanded display stats (`fifa_*` columns for outfield and GK)
- Source QA columns (`source_season`, `source_verified`, `notes`)

## Usage workflow

1. Open `missing_real_players_summary.csv` and filter teams with `status = needs_real_players`.
2. Fill corresponding rows in `missing_real_players_template.csv` using only real players.
3. Mark `source_verified = yes` when each row is validated.
4. Keep this file as staging data until a dedicated import step is implemented.

## Regenerate

```bash
python scripts/generate_missing_players_sheet.py
```
