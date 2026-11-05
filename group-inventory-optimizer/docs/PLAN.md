# Build plan

## Files
- `scripts/generate-data.ts` seeded synthetic world (truth process + push-stocked inventory + planted stories) -> `src/data/world.json`, `src/data/inventory.json`
- `src/lib/` pure TypeScript, no UI
  - `types.ts`, `rng.ts`, `calendar.ts`, `geo.ts`
  - `demand.ts` Gamma-Poisson hierarchical rates, seasonality, Dirichlet trim/color fit, queue-aware unit hazard, survival curves
  - `economics.ts` 90-day expected value per action, plan piso, transfer and aging costs
  - `optimizer.ts` greedy with lazy re-scoring priority queue + local improvement pass, constraints, plan summary
  - `explain.ts` drivers and bilingual reason templates (strings come from dictionaries)
  - `backtest.ts` fit months 1-21, forecast 22-24, WAPE vs naive, raw vs pooled
  - `scenario.ts` evaluation of any set of actions (KPIs used by Panorama and verify)
  - `engine.ts` glue used by both UI and Node scripts
- `src/i18n/es.json`, `src/i18n/en.json` every user-facing string
- `src/components/*` screens and charts, `src/state/*` context + reducer
- `scripts/verify.ts` assertions listed in section 8, `scripts/screenshots.ts` Playwright capture

## Data shapes
- Store `{id,name,region,lat,lng,tier,brands[],traffic,inboundCap}`
- Model `{id,brand,name,segment,bodyKey,msrpBase}`; trims 3 with price steps; colors 6
- History `sales[store][model] = number[24]`, `trimCounts[store][model] = number[3]`, `colorCounts[store][model] = number[6]`, `brandStart[store][brand] = monthIndex`
- Unit `{id,store,brand,model,trim,color,cost,msrp,arrival,age,storyId?}`
- Action `{id,unitId,type:'transfer'|'discount',from,to?,discount?,improvement}`

## Module boundaries
Data -> demand (rates) -> economics (EV per action) -> optimizer (plan) -> scenario (KPIs) -> UI.
UI never computes model math. Node scripts import the same modules.
