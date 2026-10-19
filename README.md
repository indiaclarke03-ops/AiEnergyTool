# AI Energy & Cost Lens

A research tool that estimates the energy, carbon, water and cost of AI usage, per query and across a full data center. Built for the Ethical Tech CoLab research project.

> **Research question.** Energy is a small share of an AI provider's total cost but a large share of its external impact (grid, carbon, water). How large is that gap, what drives it, and which efficiency levers move which metric?

Every number is an **estimate with a range** (low / central / high), labeled with its **boundary** (GPU only, IT load, facility, lifecycle) and traceable to a **sourced assumption** in [`data/assumptions/`](data/assumptions/). All default assumptions are currently `"verified": false`.

## Status

| Milestone | State |
|---|---|
| M1 Engine + assumptions | ✅ done |
| M2 Receipt page + Assumptions browser | ✅ done |
| M3 Cost Stack Explorer | ✅ done |
| M4 Analytics dashboard | ✅ done |
| M5 Metered chat mode | ✅ done |
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

### Metered chat (optional)

Metered chat sends a conversation through a small local proxy, so the receipt uses the **exact** token counts the provider reports (including hidden reasoning tokens, where the provider reports them).

```bash
cp .env.example .env      # add ANTHROPIC_API_KEY and/or OPENAI_API_KEY (+ OPENAI_BASE_URL for any OpenAI-compatible host)
npm run server            # proxy on http://127.0.0.1:8787 (localhost only)
npm run dev               # Vite forwards /api to the proxy
```

API keys stay in `.env` on the proxy and never reach the browser. `.env` is git-ignored. The Anthropic route defaults to `claude-opus-5-5` and turns on server-side refusal fallbacks for models that support them. Requires Node 22.18+ (the proxy runs TypeScript directly).

## Pages

- **AI Receipt** (`#/receipt`): estimates a single query. Tokens are entered by hand, counted from a pasted conversation, or metered exactly through the proxy; it then shows ranges, boundaries and sources, an at-scale view, and levers grouped by who controls them.
- **Cost Stack** (`#/costStack`): models the TCO of an AI data center, with sliders for every §6.3 parameter and three presets. Charts: a waterfall, the cost mix, a Sankey down to $/M tokens, and cost vs utilization. It also has the headline twin bars (energy's share of cost vs its share of externalities), a drill-down from facility to token, and an optional API-price comparison.
- **Research Dashboard** (`#/analytics`): a filterable table of saved receipts; small multiples comparing model classes and regions; a tornado sensitivity chart and Monte Carlo histogram for any output; a manager for saving and comparing up to 4 scenarios; an editable disclosure tracker; and CSV/JSON exports plus a methodology-snapshot bundle
- **Assumptions** (`#/assumptions`): every assumption, searchable, with session overrides that can be edited in place

## Layout

- `data/assumptions/*.json`: every numeric assumption, each with a source, range and verification flag
- `src/engine/`: the pure TypeScript estimation engine (no UI dependencies), reusable for a later browser extension
- `server/`: the metered-chat proxy (Express + the Anthropic SDK + an OpenAI-compatible fetch route)
- `src/features/`, `src/components/`, `src/store/`, `src/db/`: the React UI, Zustand store and Dexie (IndexedDB) schema
- `tests/engine/`: unit, calibration and sanity tests
- `tests/e2e/`: Playwright smoke tests
- `docs/METHODOLOGY.md`: formulas, calibration results, deviations from the spec, and known limitations
- `docs/SOURCES.md`: the bibliography
