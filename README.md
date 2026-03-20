# Dynasty Manager

**Build your club. Dominate the league. Create a dynasty.**

A premium mobile-first football management simulation built with React, TypeScript, and Zustand. Pick a club from a 20-team league, manage your squad, set tactics, handle transfers, and simulate match-by-match seasons.

<!-- ![Dynasty Manager Screenshot](screenshot.png) -->

## Tech Stack

React 18 | TypeScript | Vite 5 | Tailwind CSS | Zustand | Framer Motion | shadcn/ui | Vitest

## Getting Started

```bash
git clone <your-repo-url>
cd dynasty-manager
npm install
npm run dev
```

Opens at `http://localhost:8080`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run build:dev` | Development build |
| `npm run preview` | Preview production build |
| `npm run test` | Run tests |
| `npm run test:watch` | Tests in watch mode |
| `npm run lint` | ESLint |

## Project Structure

```
src/
├── components/game/   # Game UI (PitchView, PlayerCard, GlassPanel...)
├── components/ui/     # shadcn/ui components
├── data/              # Club data, fixture generation
├── engine/            # Match simulation engine
├── pages/             # All screen components
├── store/             # Zustand game state
├── types/             # TypeScript types
└── utils/             # Player generation, calculations
```

## For AI Contributors

Read `CLAUDE.md` first — it contains full project context, conventions, and hard rules. Check `LEARNINGS.md` for accumulated knowledge. Cursor rules are in `.cursor/rules/`.

## License

MIT
