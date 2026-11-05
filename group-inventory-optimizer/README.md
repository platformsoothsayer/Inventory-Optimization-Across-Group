# Group Inventory Optimization (demo)

Bilingual (ES/EN) demo of AI-driven inventory optimization for a fictional multi-location dealer group. Sample data only. Built by Soothsayer Analytics.

```bash
npm install
npm run dev          # generates data, then starts Next.js
npm run verify       # model, constraint, KPI, story, determinism and copy checks
npm run build        # static export to out/
npm run screenshots  # 1600x900 presentation screenshots in screenshots/es and screenshots/en
```

URL options: `?lang=es|en`, `?present=1` (fixed 1600x900 canvas, larger type), `/unidades/?story=1` opens a planted story unit.

- `scripts/generate-data.ts` seeded synthetic world -> `src/data/*.json`
- `src/lib/` pure TypeScript modeling: `demand`, `economics`, `optimizer`, `explain`, `backtest`, `scenario`, `kpis`
- `src/i18n/es.json`, `src/i18n/en.json` all user-facing copy
- `docs/PLAN.md` build plan, `docs/verify-output.txt` latest verification run
