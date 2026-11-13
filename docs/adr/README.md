# Architecture decision records

| # | Decision | Why | Alternatives rejected |
|---|---|---|---|
| 1 | Vite + React SPA (no Next.js) | One persistent WebGL canvas, client-only; FastAPI is the server; static deploy anywhere | Next.js: SSR/server components add complexity with no benefit here |
| 2 | three.js + React Three Fiber | Scene state driven by React/Zustand, so journeys direct the camera with plain store calls | Babylon.js: heavier, outside React's model |
| 3 | Zod contracts as the single source; JSON Schema + OpenAPI generated | Runtime validation and backend docs cannot drift apart | Hand-written OpenAPI + generated TS types: no runtime validation |
| 4 | In-process mock transport instead of MSW | No service worker to fail on demo day or on sub-path static hosting; identical Request/Response path; mock code not loaded in live mode | MSW: network-level fidelity, but service-worker registration is an extra failure point |
| 5 | TypeScript 6.0, React Router 7, Vitest 4, jsdom 30 (not the newest majors) | TS 7 unsupported by typescript-eslint; the others were weeks-to-months old and offered nothing needed | Latest majors: avoidable risk before a deadline |
| 6 | pnpm | npm 10.9 crashes resolving this dependency tree (`Cannot read properties of null (reading 'edgesOut')`); pnpm also enforces peer ranges | npm with `--legacy-peer-deps`: hides peer conflicts |
| 7 | Plotly (basic bundle, lazy) for spectra | Error bars, hover, zoom and overlays built in; fastest to a correct scientific chart | Custom SVG (more code for zoom/tooltips), uPlot (no built-in error bars), Recharts/ECharts (less scientific or larger) |
| 8 | Web Speech API behind `NarrationProvider`, with a caption-pace provider | Free and immediate; provider boundary keeps premium TTS a drop-in; captions keep journeys usable when speech is unavailable | Cloud TTS now: cost, keys, latency |
| 9 | Narration is spoken sentence by sentence; pause = cancel + restart sentence | Long utterances and `pause()` are unreliable on several engines | Engine pause/resume: inconsistent across browsers |
| 10 | Hash router by default | Static build works on any host without rewrite rules | Browser router only: needs SPA fallback configuration |
| 11 | Preview PNGs from the backend, not FITS in the browser | Small, fast, no FITS parser; backend already has astropy | In-browser FITS: heavy and slow on mobile |
| 12 | Time Explorer state in URL search params | Shareable views; explorer and journeys can deep-link to a comparison/candidate | Store-only state: not linkable |
