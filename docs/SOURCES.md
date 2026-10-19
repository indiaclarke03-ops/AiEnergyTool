# Sources

Seed sources for the assumption files. Each assumption in `data/assumptions/*.json` cites the specific sources it uses. **No source has yet been checked by the research team**, so every assumption is `verified: false`.

## Data center cost
- Epoch AI (May 2026). *Total cost of ownership of a one-gigawatt AI data center*. https://epoch.ai/data-insights/ai-datacenter-cost-breakdown
- ITK Research. *Data centre operating cost structures* (decomposition of SemiAnalysis's Meta H100 cluster TCO: GPUs ~46%, electricity ~9%). https://itkservices3.com/background/datacentre_opex

## Per-query energy
- Google (Aug 2025). Median Gemini text prompt measured at 0.24 Wh, 0.03 gCO₂e and 0.26 mL water, facility-inclusive. Summary: https://hannahritchie.substack.com/p/ai-footprint-august-2025
- Joule (2026). *Energy use of AI inference, efficiency pathways, and test-time scaling*. https://www.sciencedirect.com/science/article/pii/S2542435126001145
- ML.ENERGY Benchmark & Leaderboard (NeurIPS 2025). https://arxiv.org/html/2505.06371v2
- Hugging Face AI Energy Score. https://huggingface.github.io/AIEnergyScore
- Hugging Face ChatUI-energy (prior art for Module A). https://www.linkedin.com/posts/clementdelangue_energy-is-a-massive-constraint-for-ai-but-activity-7320557423415513088-FnbL
- Projet Celsius (2026). Comparison of per-query estimates. https://projetcelsius.com/en/blog/chatgpt-query-energy-consumption

## Efficiency levers
- TokenPowerBench. Effects of batch size and FP8 on energy per token. https://arxiv.org/html/2512.03024v1
- Spheron (2026). Cost effects of continuous batching and FP8. https://www.spheron.network/blog/ai-inference-power-electricity-cost-2026

## Lifecycle and disclosure
- Brookings. Mistral Large 2 LCA figures and the EU AI Act disclosure context. https://www.brookings.edu/articles/global-energy-demands-within-the-ai-regulatory-landscape

## Grid and facility (placeholders cited; specific figures still to be pulled)
- Ember. Electricity data explorer. https://ember-energy.org/data/electricity-data-explorer/
- Electricity Maps. https://app.electricitymaps.com/
- IEA (2025). *Energy and AI*. https://www.iea.org/reports/energy-and-ai
- LBNL (2024). *United States Data Center Energy Usage Report*. https://eta.lbl.gov/publications/2024-lbnl-data-center-energy-usage-report
- Uptime Institute. Global Data Center Survey (PUE). https://uptimeinstitute.com/resources/research-and-reports
- US EPA (2023). Social cost of greenhouse gases. https://www.epa.gov/environmental-economics/scghg
