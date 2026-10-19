# Build Spec: AI Energy & Cost Lens

*A research tool that estimates the energy, carbon, water and cost of AI usage, per query and across a full data center, with analytics.*

Project context: Ethical Tech CoLab research project (early stage). The audience is researchers, so transparency of assumptions matters more than polish.

---

## 0. Instructions for the coding agent

- Build this project incrementally, milestone by milestone (section 9). Run tests and confirm the app works before moving to the next milestone.
- **Every numeric assumption must live in `/data/assumptions/*.json`, with a source, a range (low / central / high) and a `verified` flag.** Never hard-code a number in components or the engine.
- The estimation engine must be pure TypeScript with no UI dependencies, so it can be unit tested and reused (web app now, browser extension later).
- Always show **ranges, not single numbers**. Every output carries low / central / high values.
- Default values below are starting points taken from public sources (section 10). Mark them `"verified": false` until a human checks them.
- Ask before adding any dependency not listed in section 3.

---

## 1. Goals

The project has two modules that share one estimation engine.

| Module | Name | Purpose |
|---|---|---|
| **A** | **AI Receipt** | Per-query and per-session estimate of Wh, gCO₂e, mL water, and cost. Cost is split into the energy-only cost and a fully loaded cost that includes hardware and facility. |
| **B** | **Cost Stack Explorer** | An interactive model of an AI data center's total cost of ownership, traced from facility down to cost per token. It shows what share of cost is energy, and which levers matter most. |
| **Analytics** | **Research Dashboard** | Logs sessions and scenarios, compares models and settings, runs sensitivity analysis and Monte Carlo uncertainty, and exports data. |

The research question this tool serves:

> Energy is a small share of an AI provider's total cost but a large share of its external impact (grid, carbon, water). How large is that gap, what drives it, and which efficiency levers move which metric?

### Non-goals (for now)
- Claiming exact measurements for proprietary models. The tool only estimates.
- Training-energy accounting. Add an optional "amortized training" line later (section 9, M6).
- User accounts or a cloud backend. Everything is local-first.

---

## 2. Framing rules (ethics and design)

These rules are requirements, not suggestions.

1. **Show uncertainty everywhere.** Use ranges, error bars and distributions. Never display a single unqualified number.
2. **State the boundary on every figure.** Each figure is labeled with what it counts: `GPU only`, `IT load`, `Facility (incl. cooling/PUE)` or `Lifecycle (incl. embodied)`. Different providers report with different boundaries, so the UI must make this visible.
3. **Avoid putting the responsibility on individuals.** Every per-query number in the Receipt is shown next to an aggregate view ("if 100M people did this daily…") and a provider-side lever ("batching would cut this by X%"). Avoid guilt language.
4. **Every assumption is sourced.** Hovering or clicking any number shows its source, its range and its verification status.
5. **Separate energy cost from full cost.** These are always shown as two distinct lines.

---

## 3. Tech stack

- **Framework:** Vite + React + TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **Charts:** Apache ECharts (`echarts-for-react`). It's needed for waterfall, tornado, histogram and Sankey charts.
- **State:** Zustand
- **Local storage:** IndexedDB via `dexie` for sessions and scenarios
- **Tokenizer (approximate counts):** `js-tiktoken`. Label results as "approximate for non-OpenAI models".
- **Validation:** `zod` for assumption files and imports
- **Testing:** Vitest (engine) and Playwright (one smoke test per page)
- **Optional M5 server:** a small Node/Express proxy for metered chat, with API keys kept in `.env` and never sent to the browser

---

## 4. Repository structure

```
ai-energy-lens/
├─ data/
│  └─ assumptions/
│     ├─ models.json          # model classes & energy-per-token ranges
│     ├─ overheads.json       # server overhead, PUE, WUE
│     ├─ grid.json            # carbon intensity & electricity price by region
│     ├─ datacenter_tco.json  # capex/opex defaults for Module B
│     └─ levers.json          # efficiency levers & their effect ranges
├─ src/
│  ├─ engine/                 # PURE TS, no React
│  │  ├─ types.ts
│  │  ├─ assumptions.ts       # load + zod-validate JSON
│  │  ├─ queryEnergy.ts       # Module A math
│  │  ├─ impacts.ts           # carbon, water, cost
│  │  ├─ tco.ts               # Module B math
│  │  ├─ link.ts              # connects A ↔ B (cost per token)
│  │  ├─ levers.ts            # apply efficiency levers
│  │  ├─ montecarlo.ts        # sampling over ranges
│  │  └─ sensitivity.ts       # one-at-a-time tornado analysis
│  ├─ features/
│  │  ├─ receipt/             # Module A UI
│  │  ├─ costStack/           # Module B UI
│  │  ├─ analytics/           # dashboard
│  │  └─ assumptions/         # assumptions browser/editor page
│  ├─ components/             # shared UI (RangeValue, BoundaryBadge, SourceTooltip…)
│  ├─ store/
│  ├─ db/                     # dexie schema
│  └─ App.tsx
├─ tests/
│  ├─ engine/*.test.ts
│  └─ e2e/*.spec.ts
├─ docs/
│  ├─ METHODOLOGY.md          # generated/maintained alongside the engine
│  └─ SOURCES.md
└─ README.md
```

---

## 5. Data model

### 5.1 Assumption format (used everywhere)

```ts
type Range = { low: number; central: number; high: number };

type Assumption = {
  id: string;                 // e.g. "pue.hyperscale"
  label: string;
  unit: string;               // e.g. "Wh/token", "gCO2e/kWh", "$/kWh"
  value: Range;
  boundary?: "gpu_only" | "it_load" | "facility" | "lifecycle";
  sources: { title: string; url: string; note?: string }[];
  verified: boolean;          // false until a human checks it
  notes?: string;
};
```

### 5.2 Query input (Module A)

```ts
type QueryInput = {
  modelClass: "small" | "medium" | "frontier";   // see models.json
  modelName?: string;                            // free text, for logging
  inputTokens: number;
  outputTokens: number;
  reasoning: boolean;           // reasoning/thinking mode on
  reasoningTokens?: number;     // if known; otherwise estimated
  region: string;               // key into grid.json
  boundary: "gpu_only" | "it_load" | "facility";
  modality: "text";             // image/video later
};
```

### 5.3 Output (shared by all views)

```ts
type ImpactEstimate = {
  energyWh: Range;
  carbonG: Range;
  waterMl: Range;
  energyCostUsd: Range;     // electricity only
  fullCostUsd: Range;       // hardware + facility + energy, from Module B link
  boundary: string;
  assumptionsUsed: string[];  // assumption ids, for provenance
};
```

---

## 6. Methodology (engine math)

Implement each formula as a pure function. Propagate ranges with Monte Carlo (section 6.5); `central` is computed using central values.

### 6.1 Energy per query (Module A)

```
E_gpu (Wh) = outputTokens_total × e_out[modelClass]
           + inputTokens × e_out[modelClass] × prefillRatio

outputTokens_total = outputTokens + (reasoning ? reasoningTokens : 0)
  if reasoning && reasoningTokens unknown → reasoningTokens = outputTokens × reasoningMultiplier

E_it       = E_gpu × serverOverhead          # CPU, memory, networking, idle reserve
E_facility = E_it × PUE                      # cooling & power delivery
```

The selected `boundary` decides which E is reported.

**Starting assumption ranges (verify all):**

| id | low | central | high | notes |
|---|---|---|---|---|
| `e_out.small` (<15B params), Wh/output token, GPU only | 0.00003 | 0.0001 | 0.0003 | calibrate vs ML.ENERGY / AI Energy Score |
| `e_out.medium` (15–100B) | 0.0001 | 0.0003 | 0.0008 | calibrate |
| `e_out.frontier` (>100B / MoE) | 0.0002 | 0.0005 | 0.0015 | calibrate |
| `prefillRatio` (input token cost relative to output) | 0.03 | 0.1 | 0.25 | prefill is compute-bound but parallel |
| `reasoningMultiplier` (hidden tokens ÷ visible) | 3 | 8 | 20 | |
| `serverOverhead` | 1.3 | 1.6 | 2.0 | GPUs draw only part of server power |
| `PUE.hyperscale` | 1.08 | 1.12 | 1.3 | |

**Calibration tests (must pass, within range):**
- A frontier, non-reasoning query with ~500 output tokens, facility boundary, should land around **0.2–0.5 Wh**. Anchors: Google's measured 0.24 Wh median Gemini prompt, Epoch AI's ~0.3 Wh, and Altman's stated 0.34 Wh.
- A frontier reasoning query with ~5,000 output tokens should land around **2–7 Wh** (Joule 2026 study: median 3.91 Wh, IQR 2.15–7.05).
- A small model, short query, should be at or below ~0.1 Wh.

If the calibration tests fail, adjust the default ranges in the JSON, not the formulas, and document the change in `METHODOLOGY.md`.

### 6.2 Impacts

```
carbon_g    = (E_facility_Wh / 1000) × gridIntensity[region]          # gCO2e/kWh
water_ml    = (E_facility_Wh / 1000) × (WUE_onsite + WUE_offsite[region]) × 1000
energyCost  = (E_facility_Wh / 1000) × electricityPrice[region]       # $/kWh
```

`grid.json` should hold, per region: grid carbon intensity, industrial electricity price, and off-site water intensity for electricity generation. Seed it with about 8 regions (US-East/Virginia, US-Texas, US-West, Ireland, Netherlands, Sweden, UK, Singapore), sourced from Ember / Electricity Maps / IEA, with user override.

Add a toggle: **"Include embodied/lifecycle"**. Off by default. When on, add per-query embodied carbon/water from a lifecycle analysis (seed from Mistral's Large 2 LCA: ~1.14 gCO₂e and ~45 mL water per 400-token response, as the `lifecycle` boundary reference). Display the boundary change prominently.

### 6.3 Data center total cost of ownership (Module B)

Inputs (all sliders, defaults from `datacenter_tco.json`):

| Parameter | Default | Source |
|---|---|---|
| Facility IT capacity | 1 GW | Epoch AI scenario |
| Server capex | $21.19B | Epoch AI (May 2026) |
| Facility capex | $11.43B | Epoch AI |
| Network capex | $4.93B | Epoch AI |
| Land + utility works capex | $0.34B | Epoch AI |
| IT equipment lifespan | 5 yrs (range 3–7) | Epoch AI |
| Facility lifespan | 14 yrs | Epoch AI |
| Electricity price | $0.068/kWh | derived: Epoch's $594M ÷ 8,760 GWh |
| Utilization (avg power ÷ capacity) | 0.7 (0.3–0.95) | assumption |
| PUE | 1.12 | overheads.json |
| Taxes / maintenance / labor / water opex | $143M / $120M / $40M / $6M per yr | Epoch AI |
| Cost of capital (optional) | 0% (0–12%) | assumption; when >0 use annuity formula |

```
annualCapex_i = capex_i / lifespan_i                          # or annuity if r > 0
annualEnergyKWh = capacityKW × 8760 × utilization × PUE
annualEnergyCost = annualEnergyKWh × electricityPrice
annualTCO = Σ annualCapex_i + annualEnergyCost + Σ otherOpex
energyShare = annualEnergyCost / annualTCO
```

**Sanity test:** with Epoch defaults (utilization 1.0, PUE folded in), annual TCO ≈ $8.5B and energy share ≈ 7%. A test should assert this within ±5%.

### 6.4 Linking A ↔ B (cost per token)

This is the core analytical bridge.

```
tokensPerYear = (annualEnergyKWh × 1000) / E_facility_per_token_Wh    # from Module A model class
costPerMTok_full   = annualTCO / tokensPerYear × 1e6
costPerMTok_energy = annualEnergyCost / tokensPerYear × 1e6
fullCostUsd (per query) = queryTokens × costPerToken_full
```

Module B shows:
- Cost per million tokens (full vs energy-only)
- An optional user-entered **public API price** per million tokens, to show an implied margin or subsidy ("provider price ÷ estimated cost")
- **Energy share of cost** vs **energy share of external impact** (the headline comparison)

### 6.5 Uncertainty

- `montecarlo.ts`: sample each assumption from a triangular distribution (low, central, high), N = 5,000 by default. Return p5 / p50 / p95 plus a histogram.
- `sensitivity.ts`: one-at-a-time sweep of each assumption from low to high. Return the ranked swing in an output metric, for a tornado chart.

### 6.6 Efficiency levers (`levers.json`)

Each lever has an id, a description, the metric it affects, a multiplier range, the actor who controls it (`user` | `provider` | `policy`) and sources.

| Lever | Actor | Effect (starting range, verify) |
|---|---|---|
| Turn off reasoning for simple tasks | user | removes reasoning tokens |
| Route to a smaller model | user/provider | swap model class |
| Shorter prompts / context caching | user/provider | prefill energy −30% to −90% |
| Continuous batching / higher utilization | provider | energy/token ×0.25–0.5 |
| FP8 quantization | provider | energy/token ×0.7–0.77 |
| Lower PUE (liquid cooling) | provider | PUE → 1.05–1.1 |
| Carbon-aware siting/scheduling | provider/policy | gridIntensity → cleaner region |
| Longer GPU lifespan | provider | IT capex/yr ↓ (cost), embodied ↓ |

The UI should let users stack levers and see before/after on **all** metrics. A key insight to surface is that some levers mainly cut cost while others mainly cut carbon.

---

## 7. Features and pages

### Page 1: AI Receipt (Module A)
- **Input panel:** model class (plus optional model name), reasoning toggle, region, boundary selector, and token entry in three modes:
  1. **Manual:** type token counts.
  2. **Paste conversation:** paste a prompt and response; count tokens with js-tiktoken (approximate).
  3. **Metered chat (M5):** chat through an API proxy; uses the exact `usage` token counts returned by the API.
- **Receipt card**, styled like a printed receipt. Each line shows its range, boundary badge and source tooltip:
  - Energy (Wh), with an everyday comparison (e.g. "≈ X seconds of a microwave")
  - Carbon (g CO₂e)
  - Water (mL)
  - Electricity cost ($)
  - Fully loaded cost ($), with the energy share of it as a percentage
- **Scale panel:** a slider for queries per day (1 to 1B) and a user count → shows aggregate MWh/yr, tCO₂e/yr and $/yr.
- **Levers panel:** "What would change this?" grouped by actor (user / provider / policy).
- **Save to session:** each receipt is appended to the current research session in IndexedDB.

### Page 2: Cost Stack Explorer (Module B)
- **Sliders** for all section 6.3 parameters, plus presets: "Epoch 1 GW reference", "Meta-style H100 cluster", "Colocation tenant".
- **Charts:**
  - **Waterfall:** annual TCO built up by component (servers, facility, network, energy, other opex).
  - **Donut or stacked bar:** capex vs opex, and energy share.
  - **Sankey:** $ per year → components → cost per million tokens.
  - **Line:** cost per million tokens vs utilization (shows why idle GPUs are expensive).
  - **Twin bars (headline):** energy share of *cost* vs energy share of *externalities*. Externalities include carbon priced at a user-set social cost of carbon (default range $50–$200/t) and water.
- **"Drill to a token" panel:** shows the chain facility → year → kWh → tokens → one query, using the current Module A query.

### Page 3: Research Dashboard (Analytics)
- **Sessions table:** every saved receipt, with filters by model class, region, reasoning and boundary.
- **Comparisons:** small multiples comparing model classes and regions on all four metrics.
- **Scenario manager:** save named Module B configurations and compare up to 4 side by side.
- **Sensitivity:** a tornado chart for a chosen output (e.g. cost/Mtok, gCO₂e/query).
- **Uncertainty:** a Monte Carlo histogram with p5/p50/p95.
- **Disclosure tracker (simple table, editable):** provider, what they disclose (per-query energy? water? methodology? boundary?), date and link. Seed rows: Google (Aug 2025 Gemini report), OpenAI (June 2025 blog statement, no methodology), Mistral (Large 2 LCA), Microsoft, Anthropic, Meta. Mark unknowns as "not found", not "none".
- **Export:** CSV and JSON for sessions, scenarios and the full assumption set used (for reproducibility). A "Methodology snapshot" export bundles results with the exact assumption versions.

### Page 4: Assumptions Browser
- Searchable table of every assumption: value range, unit, boundary, sources, verified flag.
- Edit in place (session override), with a reset to defaults.
- Badge counts of unverified assumptions, shown in the header so they can't be overlooked.

---

## 8. Shared UI components
- `<RangeValue value={Range} unit />` shows the central value with a low–high band and a hover-over distribution.
- `<BoundaryBadge boundary />` uses a distinct color per boundary.
- `<SourceTooltip assumptionIds />` lists the sources behind a number.
- `<UnverifiedFlag />` is a small warning icon shown wherever an unverified assumption feeds a number.
- Accessible: keyboard-navigable sliders, color-blind-safe palette, no meaning carried by color alone.

---

## 9. Milestones

| # | Milestone | Done when |
|---|---|---|
| **M1** | Engine + assumptions | All engine functions exist, zod validation passes, calibration tests (6.1) and the TCO sanity test (6.3) pass |
| **M2** | Receipt page (manual + paste modes) | Receipt renders ranges, boundaries and sources; scale panel works; sessions save to IndexedDB |
| **M3** | Cost Stack Explorer | All sliders, presets and charts work; A↔B link shows cost/Mtok; headline twin bars render |
| **M4** | Analytics dashboard | Sessions table, comparisons, scenarios, tornado, Monte Carlo, disclosure tracker and exports all work |
| **M5** | Metered chat mode | Express proxy (OpenAI-compatible + Anthropic), exact usage tokens logged; keys only in `.env` |
| **M6** | Extensions (later) | Optional amortized-training line; image modality; MV3 browser extension reusing `/src/engine` |

After each milestone, update `docs/METHODOLOGY.md` (formulas, assumption changes, known limitations) and `README.md` (how to run).

---

## 10. Seed sources (for `SOURCES.md` and assumption files)

- Epoch AI (May 2026): *Total cost of ownership of a one-gigawatt AI data center*. https://epoch.ai/data-insights/ai-datacenter-cost-breakdown
- ITK Research: *Data centre operating cost structures* (decomposition of SemiAnalysis's Meta H100 cluster TCO: GPUs ~46%, electricity ~9%). https://itkservices3.com/background/datacentre_opex
- Google (Aug 2025): measured median Gemini text prompt of 0.24 Wh, 0.03 gCO₂e, 0.26 mL water (facility-inclusive). Summarized at https://hannahritchie.substack.com/p/ai-footprint-august-2025
- Joule (2026): *Energy use of AI inference, efficiency pathways, and test-time scaling*. https://www.sciencedirect.com/science/article/pii/S2542435126001145
- ML.ENERGY Benchmark & Leaderboard (NeurIPS 2025). https://arxiv.org/html/2505.06371v2
- Hugging Face AI Energy Score. https://huggingface.github.io/AIEnergyScore
- Hugging Face ChatUI-energy (prior art for Module A). https://www.linkedin.com/posts/clementdelangue_energy-is-a-massive-constraint-for-ai-but-activity-7320557423415513088-FnbL
- TokenPowerBench: batch size and FP8 effects on energy per token. https://arxiv.org/html/2512.03024v1
- Spheron (2026): continuous batching and FP8 cost effects. https://www.spheron.network/blog/ai-inference-power-electricity-cost-2026
- Brookings: Mistral Large 2 LCA figures and the EU AI Act disclosure context. https://www.brookings.edu/articles/global-energy-demands-within-the-ai-regulatory-landscape
- Projet Celsius (2026): comparison of per-query estimates. https://projetcelsius.com/en/blog/chatgpt-query-energy-consumption
- To add: Ember / Electricity Maps (grid intensity), IEA *Energy and AI* (2025), LBNL 2024 US data center report, Uptime Institute (PUE survey).

---

## 11. Known limitations (state these in the app's About panel)
- Proprietary model sizes and serving setups are unknown, so the model-class approach is a deliberate simplification.
- Token counts for non-OpenAI models are approximate unless metered chat mode is used.
- TCO defaults describe one reference facility. Real providers differ in utilization, hardware mix and contracts.
- Per-query numbers are small, so the aggregate and provider-lever views are essential to avoid misleading conclusions.
- All defaults are unverified until checked by the research team.
