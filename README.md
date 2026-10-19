# AI Energy & Cost Lens

A research tool that estimates the energy, carbon, water and cost of AI usage, per query and across a full data center. Built for the Ethical Tech CoLab research project.

> **Research question.** Energy is a small share of an AI provider's total cost but a large share of its external impact (grid, carbon, water). How large is that gap, what drives it, and which efficiency levers move which metric?

Every number is an **estimate with a range** (low / central / high), labeled with its **boundary** (GPU only, IT load, facility, lifecycle) and traceable to a **sourced assumption** in [`data/assumptions/`](data/assumptions/). All default assumptions are currently `"verified": false`.

## Status

| Milestone | State |
|---|---|
| M1 Engine + assumptions | ✅ done |
| M2 Receipt page + Assumptions browser | ✅ done |
| M3 Cost Stack Explorer | ⏳ |
| M4 Analytics dashboard | ⏳ |
| M5 Metered chat mode | ⏳ |
| M6 Extensions | later |

## Run

Requires Node 20+.

```bash
npm install
npm run dev       # app at http://localhost:5173
npm test          # engine unit + calibration tests (Vitest)
npm run typecheck
npx playwright install chromium   # once
npm run test:e2e  # Playwright smoke test per page
```

Everything runs locally. Saved receipts live in your browser's IndexedDB; nothing is sent anywhere.

## Pages

- **AI Receipt** (`#/receipt`): estimates a single query. Tokens are entered by hand or counted from a pasted conversation; it then shows ranges, boundaries and sources, an at-scale view, and levers grouped by who controls them.
- **Cost Stack** (`#/costStack`): M3
- **Research Dashboard** (`#/analytics`): M4
- **Assumptions** (`#/assumptions`): every assumption, searchable, with session overrides that can be edited in place

## Layout

- `data/assumptions/*.json`: every numeric assumption, each with a source, range and verification flag
- `src/engine/`: the pure TypeScript estimation engine (no UI dependencies), reusable for a later browser extension
- `src/features/`, `src/components/`, `src/store/`, `src/db/`: the React UI, Zustand store and Dexie (IndexedDB) schema
- `tests/engine/`: unit, calibration and sanity tests
- `tests/e2e/`: Playwright smoke tests
- `docs/METHODOLOGY.md`: formulas, calibration results, deviations from the spec, and known limitations
- `docs/SOURCES.md`: the bibliography
