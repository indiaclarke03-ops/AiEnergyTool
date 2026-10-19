# Methodology

*Maintained alongside `src/engine/`. Last updated at milestone M4 (2026-10-19). Assumption file version: `2026-10-19`.*

All outputs are **estimates**. Every numeric input is an assumption in `data/assumptions/*.json` with a low / central / high range, a source list and a `verified` flag. All seed values are currently **unverified**.

## 1. Ranges

- **Central** is computed by evaluating each formula with every assumption at its central value.
- **Low / high** are the 5th and 95th percentiles of a Monte Carlo run (`montecarlo.ts`). Each assumption is sampled independently from a triangular distribution (low, central, high), with N = 5,000 and a fixed seed so runs are reproducible. If the central value falls outside [p5, p95], the range is widened to include it.
- Most ranges are right-skewed (for example `e_out.frontier` is 0.0002 / 0.0005 / 0.0015), so the Monte Carlo **median is above the central value** and the high end is wide. This is intended: it reflects how uncertain the upper end is.
- Sampling assumes the assumptions are **independent**, which is a simplification. For example, the three model-class energy values are probably correlated in reality.

## 2. Energy per query (Module A, `queryEnergy.ts`)

```
reasoningTokens   = reasoning ? (reasoningTokens ?? outputTokens × reasoning_multiplier) : 0
tokenEquivalents  = outputTokens + reasoningTokens + inputTokens × prefill_ratio
E_gpu             = tokenEquivalents × e_out[modelClass]
E_it              = E_gpu × server_overhead
E_facility        = E_it × pue.hyperscale
```

The user's chosen boundary sets which E appears on the **energy** line. The carbon, water and cost lines are always computed from **E_facility**, and they carry a `facility` badge (or `lifecycle` when embodied impacts are included).

## 3. Impacts (`impacts.ts`)

```
carbon_g   = E_facility_kWh × grid.<region>.intensity
water_ml   = E_facility_kWh × (wue.onsite + grid.<region>.wue_offsite) × 1000
energyCost = E_facility_kWh × grid.<region>.price
```

With **"Include embodied/lifecycle"** turned on, `outputTokensTotal × embodied.carbon_per_token` (and the matching water term) is added. These per-token values come from Mistral Large 2's LCA (~1.14 gCO₂e and ~45 mL per 400-token response). Mistral's LCA already covers inference, so this may double-count some operational impact. The issue is noted on the assumption itself.

## 4. Data center TCO (Module B, `tco.ts`)

```
CRF(r, n)        = r = 0 ? 1/n : r / (1 − (1+r)^−n)
annualCapex      = (servers + network) × CRF(r, lifespan.it)
                 + (facility + utility) × CRF(r, lifespan.facility)
                 + land × r                          # land is not depreciated: opportunity cost only
annualEnergyKWh  = capacity_kW × 8760 × utilization × pue
annualEnergyCost = annualEnergyKWh × electricity_price
annualTCO        = annualCapex + annualEnergyCost + taxes + maintenance + labor + water
energyShare      = annualEnergyCost / annualTCO
```

### Deviation from the spec: Epoch parameters (M1)

The spec's §6.3 table gave **$0.068/kWh** ("derived: Epoch's $594M ÷ 8,760 GWh"), **utilization 1.0**, **cost of capital 0%** and straight-line depreciation. Those values cannot reproduce Epoch's $8.5B total: straight-line capex comes to only ~$6.1B, for a TCO of ~$7.0B. Reading the Epoch article directly showed that it uses:

| Parameter | Spec draft | Epoch (now the default) |
|---|---|---|
| Electricity price | $0.068/kWh | **$0.0834/kWh** |
| Utilization | 1.0 | **0.71** |
| PUE | 1.12 | **1.14** (`tco.pue`, separate from the per-query `pue.hyperscale` of 1.12) |
| Annualization | straight-line | **capital recovery factor**: ≈0.24 for 5-yr IT, ≈0.12–0.13 for 14-yr facility |
| Cost of capital | 0% | **6.5%** (Epoch uses an unstated WACC; 6.5% reproduces its CRFs) |
| Land + utility | $0.34B combined | land $0.172B (opportunity cost) + utility works $0.164B (facility CRF) |

With these defaults the engine gives **annual TCO $8.48B** (Epoch: ~$8.5B), annualized capex **$7.58B** (Epoch: $7.607B), energy **$591M** (Epoch: $594M) and an **energy share of 6.97%**. The §6.3 sanity test asserts the TCO and energy share to within ±5%. Further tests check Epoch's stated sensitivities: a 3-year IT lifespan gives more than $11B, and a 7-year lifespan gives less than $7.6B. Setting the cost of capital to 0 switches back to straight-line depreciation.

## 5. Linking A ↔ B (`link.ts`)

```
itWhPerToken        = e_out[modelClass] × server_overhead
annualITKWh         = capacity_kW × 8760 × utilization          # before PUE
tokensPerYear       = annualITKWh × 1000 / itWhPerToken
costPerMTok_full    = annualTCO / tokensPerYear × 1e6
costPerMTok_energy  = annualEnergyCost / tokensPerYear × 1e6
```

**Per-query full cost** is computed as
`E_it_kWh × (annualCapex + otherOpex) / annualITKWh + energyCost(region)`.
In other words, the hardware, facility and labor cost per **IT** kWh from Module B is added to the query's own regional electricity cost. This equals `tokenEquivalents × costPerToken_full` from the spec whenever the Module A and Module B PUE and electricity price match (a test checks this). It keeps the full-cost line consistent with the electricity-cost line shown above it.

**Change in M2:** the spec allocates by facility energy (`annualEnergyKWh / facilityWhPerToken`). That meant lowering PUE (liquid cooling) *raised* the per-query full cost, because the same fixed costs were spread over fewer facility kWh. Tokens served depend on IT energy, not on cooling overhead, so the allocation now uses IT energy. The result is identical when the two PUEs match. A PUE change now moves only the electricity line, and a test checks this.

### Headline: cost share vs externality share

`facilityExternalities()` prices the facility's annual impacts:

- **energy externality** = operational CO₂ × social cost of carbon + water (on-site + off-site) × water shadow price
- **total externality** = energy externality + embodied CO₂ (IT hardware amortized over the IT lifespan, facility construction over the facility lifespan) × social cost of carbon

Defaults for the reference 1 GW facility in US-East: energy is **~7% of cost** but **~96% of externalities**. The embodied-carbon-per-MW assumptions are rough placeholders, and they are flagged on the assumptions themselves.

## 6. Efficiency levers (`levers.ts`)

Levers change a single sampled point (inputs and assumption values), so their effect ranges feed into the Monte Carlo. Lever types:

- `reasoning_off`: removes reasoning tokens
- `model_downsize`: frontier → medium → small
- `multiply`: target assumptions × an effect assumption (batching, FP8, caching)
- `set`: target assumptions take the effect assumption's value, but only if that is an improvement (liquid-cooling PUE, longer lifespan)
- `region_switch`: moves the query to a cleaner grid region (default Sweden)

Levers stack multiplicatively.

## 7. Sensitivity (`sensitivity.ts`)

A one-at-a-time sweep: each assumption is set to its low and then its high value, with all others held at central. Bars are ranked by |output(high) − output(low)|, and assumptions with no effect on the output are dropped.

## 8. Calibration results (M1, central values)

| Test (§6.1) | Target | Engine (central) | Monte Carlo p5–p95 |
|---|---|---|---|
| Frontier, 100 in / 500 out, no reasoning, facility | 0.2–0.5 Wh | **0.457 Wh** | 0.32–1.24 Wh |
| Frontier, 500 out + 4,500 reasoning | 2–7 Wh | **4.49 Wh** | 3.1–12.0 Wh |
| Frontier, 500 out, reasoning estimated (×8) | 2–7 Wh | **4.04 Wh** | 2.8–16.2 Wh |
| Small, 50 in / 150 out | ≤ 0.1 Wh | **0.028 Wh** | 0.018–0.075 Wh |

No default ranges needed changing for the calibration tests to pass.

Other figures from the current defaults:
- Frontier 500-token query in US-East: ~0.17 gCO₂e and ~1.4 mL water. Google reports 0.03 g and 0.26 mL, but on a market-based carbon accounting and an on-site-only water boundary. The tool uses location-based grid intensity and includes off-site water from electricity generation, so its figures are higher. This boundary difference needs to be shown in the UI.
- Implied cost per million tokens (Epoch facility): **small $0.21, medium $0.64, frontier $1.07** (full); energy-only is ~7% of each. These sit well below public API prices, which suggests either large margins or that the `e_out` values imply higher throughput than real serving achieves. Worth investigating.

## 9. UI conventions (M2)

- The **Receipt** shows each line with its Monte Carlo range (p5–p95), a boundary badge (colour + glyph + text) and a source button listing every assumption behind it, with an unverified-flag count.
- Each per-query line also shows the **aggregate** at the Scale panel's volume (default 100M queries/day) and the **single provider-side lever** with the largest reduction for that metric (spec §2, rule 3).
- Lever percentages in the levers panel are each lever **on its own** at central values. Ticked levers stack into the receipt's full Monte Carlo estimate.
- Everyday comparisons (microwave seconds, US-home equivalents) use sourced assumptions `compare.*` in `overheads.json`.
- Paste mode counts tokens with js-tiktoken `o200k_base` and is labelled approximate for non-OpenAI models.
- Saved receipts store the input, active levers, estimate, assumption-file versions and any session overrides, so each one is reproducible.

## 10. Cost Stack Explorer (M3)

- **Sliders** set the *central* value of a `tco.*` (or `ext.*`) assumption. The low/high range is rescaled by the same factor, so each assumption keeps its relative uncertainty (`recenter()`). Slider edits are session overrides, the same ones the Assumptions page shows, so the Receipt's full-cost line uses them as well.
- **Presets** live in `datacenter_tco.json → presets`:
  - *Epoch 1 GW reference*: the file defaults.
  - *Meta-style H100 cluster*: an illustrative ~100 MW cluster with straight-line depreciation, tuned towards ITK/SemiAnalysis shares. The engine gives a TCO of about $0.71B/yr, an energy share of ~10% (ITK: ~9%) and servers at ~62% of TCO (ITK: GPUs alone ~46%).
  - *Colocation tenant*: no facility, land or utility capex. It pays a colocation rent (`tco.opex.colocation`, ~$150/kW-month placeholder) and electricity passed through at $0.095/kWh.
- **Headline twin bars**: energy share of cost (`energyShare`) vs energy share of priced externalities (`facilityExternalities`, §5). Bars show central values; whiskers show Monte Carlo p5–p95 (N = 3,000).
- **Cost per M tokens vs utilization**: the full cost falls roughly as 1/utilization, because fixed capex and opex are spread over more tokens. The energy-only cost is flat, because tokens and energy both scale with utilization.
- **Price ÷ cost**: compares a public $/M-token price with the estimated full cost for *output* tokens of the selected model class. API prices bundle R&D, training and margin, so a ratio above 1 is not pure profit.

## 11. Research Dashboard (M4)

- **Comparisons** re-run the current Receipt query for every model class and every region (Monte Carlo, N = 1,500 each) and show central bars with p5–p95 whiskers. Each metric panel has its own scale.
- **Sensitivity** uses `tornado()` (§7) on the selected output and shows the 12 assumptions with the largest swing. Bars are drawn as deltas from the baseline, with the axis labelled in absolute values. Unverified assumptions are marked ⚠.
- **Uncertainty** runs a 5,000-sample Monte Carlo of the selected output and shows the histogram with p5 / p50 / p95 marked.
- **Scenarios** store only Module B overrides (`tco.*`, `ext.*`) plus the region and model class. Comparisons recompute central values and run a 1,000-sample Monte Carlo for each scenario.
- **Disclosure tracker** is seeded from `data/disclosures_seed.json`. An unknown is written as "not found", never "none". Seed rows are unverified.
- **Methodology snapshot** is a JSON bundle containing the assumption-file versions, session overrides, the full effective assumption set, levers, presets, and all sessions, receipts, scenarios and disclosures. With the repo at the same commit, it is enough to reproduce every saved number.

## 12. Known limitations

- Proprietary model sizes and serving setups are unknown, so the model-class approach is a deliberate simplification.
- Token counts for non-OpenAI models are approximate unless metered chat mode (M5) is used.
- TCO defaults describe one reference facility. Real providers differ in utilization, hardware mix and contracts.
- Per-query numbers are small, so the aggregate and provider-lever views are essential to avoid misleading conclusions.
- The default `e_out` values are calibrated to production deployments, which already batch requests. The batching lever (×0.25–0.5, measured against low-batch serving) may therefore overstate the gain relative to this baseline.
- Grid intensity, electricity price and off-site water values for the 8 regions are placeholders and must be checked against Ember, Electricity Maps and IEA data.
- Assumptions are sampled independently (no correlations).
- All defaults are unverified until the research team checks them.
