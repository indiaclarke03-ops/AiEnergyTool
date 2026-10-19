# AI Energy & Cost Lens

A research tool that estimates the energy, carbon, water and cost of AI usage, per query and across a full data center. Built for the Ethical Tech CoLab research project.

> **Research question.** Energy is a small share of an AI provider's total cost but a large share of its external impact (grid, carbon, water). How large is that gap, what drives it, and which efficiency levers move which metric?

Every number is an **estimate with a range** (low / central / high), labeled with its **boundary** (GPU only, IT load, facility, lifecycle) and traceable to a **sourced assumption** in [`data/assumptions/`](data/assumptions/). All default assumptions are currently `"verified": false`.

## Status

| Milestone | State |
|---|---|
| M1 Engine + assumptions | ✅ done |
| M2 Receipt page | ⏳ |
| M3 Cost Stack Explorer | ⏳ |
| M4 Analytics dashboard | ⏳ |
| M5 Metered chat mode | ⏳ |
| M6 Extensions | later |

## Run

Requires Node 20+.

```bash
npm install
npm test          # engine unit + calibration tests (Vitest)
npm run typecheck
```

## Layout

- `data/assumptions/*.json`: every numeric assumption, each with a source, range and verification flag
- `src/engine/`: the pure TypeScript estimation engine (no UI dependencies), reusable for a later browser extension
- `tests/engine/`: unit, calibration and sanity tests
- `docs/METHODOLOGY.md`: formulas, calibration results, deviations from the spec, and known limitations
- `docs/SOURCES.md`: the bibliography
