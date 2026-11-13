# SkyShift X — architecture

SkyShift X is a single-page web app: one persistent 3D canvas with route content layered above it, fed entirely through a validated, versioned API.

```
                 ┌───────────────────────────── browser ─────────────────────────────┐
 FastAPI backend │  src/api  ──validate (Zod contracts v1)──►  TanStack Query cache  │
 (live mode)  ◄──┤   ▲  transport.ts chooses ONE of:                 │               │
                 │   │    live  → fetch(VITE_API_BASE_URL)           ▼               │
 in-app mock  ◄──┤   │    mock  → src/mocks/router (same Request/Response)           │
 (demo mode)     │   │                                   features/* (React views)    │
                 │   └── never falls back from live to mock                          │
                 └───────────────────────────────────────────────────────────────────┘
```

## Stack (versions pinned in `package.json`, installed with pnpm)

| Concern | Choice | Notes |
|---|---|---|
| Build | Vite 8, TypeScript 6 (strict) | TypeScript 7 is not yet supported by `typescript-eslint`. |
| UI | React 19.3, Tailwind 4 | React pinned below 19.4 for React Three Fiber 9. |
| 3D | three 0.187, @react-three/fiber 9, drei 10 | Procedural materials only; no downloaded textures. |
| Routing | React Router 7 | Hash router by default so the static build runs on any host; `VITE_ROUTER=browser` for hosts with SPA fallback. |
| Data | TanStack Query 5, Zod 4 | Zod schemas are the contract; JSON Schema/OpenAPI are generated from them. |
| State | Zustand 5 | Explorer/camera state and the beginner/research preference. |
| Charts | Plotly (basic bundle), lazy-loaded | Error bars, hover, zoom and overlays out of the box. |
| Narration | Web Speech API behind `NarrationProvider` | Falls back to caption pacing; see below. |
| Tests | Vitest + Testing Library, Playwright | |

## Directory map

```
src/
  app/            App (providers, router), Shell (persistent canvas + routes), TopBar
  config/env.ts   VITE_* configuration
  contracts/v1/   Zod schemas = API contract (single source of truth)
  api/            transport (mock|live), client (validation), endpoints, React Query hooks, errors
  mocks/          in-process mock backend + fixtures (reachable ONLY via api/transport.ts)
  narration/      provider interface, Web Speech + caption-pace providers, NarrationController
  features/
    landing/        cinematic landing
    explorer/       UniverseCanvas (3D) + ExplorerView (HUD, info panel, fallback)
    time-explorer/  Time Explorer: region/band/epoch selection, comparison, candidates
    candidates/     CandidatePanel (inspection, explanations, evidence, spectrum)
    journey/        StoryPlayer, scene registry, journey view
    mission/        mission, method, integrity rules, sources
    ask/            question bar (POST /journeys)
  components/science/  ComparisonViewer, SpectrumChart, ObservationMetadata (shared by tools and journeys)
  stores/         explorer (camera/selection/sim), ui (audience)
  ui/             design-system primitives, state blocks, icons
  lib/            astro formatting, cn, reduced-motion hook
scripts/          generate-mock-data.mjs (simulator), generate-api-docs.ts (JSON Schema/OpenAPI/examples)
docs/             this file, challenge alignment, roadmap, ADRs, API contract
e2e/              Playwright end-to-end tests
```

## Rules that keep the architecture honest

1. **One data path.** Components get data only from `@/api` hooks. ESLint (`no-restricted-imports`) forbids importing `@/mocks` or fixtures anywhere except `src/api/transport.ts`.
2. **Validate everything.** `request()` parses every response with the contract schema; a mismatch is a visible `contract` error.
3. **No silent substitution.** Live mode never loads the mock. Errors render as error states with a retry.
4. **Labels come from data.** "Simulated" / "Hypothesis" badges are driven by `meta.simulated`, `provenance.classification` and `epistemicStatus` from the API, not hard-coded in views.
5. **No science in the browser.** No detection, alignment, subtraction or photometry. The only maths in the UI is display formatting and the pixel→sky read-out from the supplied WCS.
6. **Closed scene set.** Journeys choose from registered scene components by validated type; they cannot inject markup or code.

## Routes

| Route | View | Canvas |
|---|---|---|
| `/` | Landing | active, cinematic drift |
| `/explore`, `/explore/:objectId` | 3D explorer HUD | active, interactive |
| `/time?region&band&ref&tgt&view&cand` | Time Explorer (state in the URL, shareable) | paused, hidden |
| `/journey/:journeyId` | Discovery Journey player | active, directed by the journey |
| `/mission` | Mission, method, sources | paused, hidden |

## The 3D layer

`UniverseCanvas` is mounted once by the Shell and never unmounted, so the camera keeps its place across landing → explorer → journey. Everything that wants to direct it writes to `stores/explorer.ts`:

- `flyTo(targetId, { framing, transition })` — animated travel or cut;
- `select(id)`, `setHighlights(ids)`, `setCinematic(bool)`, simulation speed/pause, `quality`, `webgl`.

Distances are compressed and sizes exaggerated; the UI says so. Hypothetical objects have no orbit in the contract, so none can be drawn.

## Discovery Journey engine

```
StoryPlayer (framework-free)                NarrationController
  enter(segment)                              speak(text) → sentence chunks
    1 publish position ─► React renders       provider = voice | caption pace
    2 await prepareVisual (data + images)     onEnd of last chunk ─► onDone
    3 await afterPaint
    4 narration.speak ───────────────────────►
    5 onDone ─► enter(next segment)
```

- Visuals never advance on fixed timers; only on the narration's end event (or the user's input).
- A run token is incremented on every navigation, cancel and dispose; stale callbacks check it and do nothing.
- Narration starts only from a user gesture (`begin()`), which also "unlocks" speech synchronously.
- **Providers:** `WebSpeechProvider` (browser voice; availability depends on browser, OS, installed voices and sometimes network) and `CaptionPaceProvider` (silent; emits the same events at reading pace derived from the words). If the voice is missing, fails or stalls, the controller switches to captions and tells the user. Muting uses the same path.
- **Adding premium TTS:** implement `NarrationProvider` with an `<audio>` element using `segment.audio` (`url`, timestamped `captions`); pass it to `NarrationController` in `useStoryPlayer.ts`. Nothing else changes.
- **Scene registry** (`features/journey/scenes/registry.tsx`): `camera3d`, `image`, `imageComparison`, `spectrum`, `skyMap`, `diagram`, `candidate`, `conclusion`.

## Mock mode

`src/mocks/router.ts` implements the API as a `fetch`-shaped function over fixtures. Fixtures are parsed through the contract at start-up, so the mock cannot drift from the schema. Simulated images and spectra come from `scripts/generate-mock-data.mjs` (deterministic; `pnpm gen:mock`), which writes PNGs to `public/mock-data/images` and `src/mocks/fixtures/sim-manifest.json`.

## Commands

```bash
pnpm install        # npm 10.9 crashes resolving this tree; use pnpm
pnpm dev            # http://localhost:5173 (mock mode by default)
pnpm check          # lint + typecheck + unit tests + production build
pnpm e2e            # Playwright end-to-end tests (builds and previews first)
pnpm gen:mock       # regenerate simulated images + manifest
pnpm gen:api        # regenerate docs/api from the contracts
pnpm mock:server    # reference backend over HTTP on :8000, for trying live mode
```
