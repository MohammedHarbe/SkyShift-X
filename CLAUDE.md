# SkyShift X — working agreement

NASA Space Apps 2026, *Planet X and SPHEREx*. Goal: a public web tool that shows SPHEREx sky images and makes it easy to see how they change over time. Read `docs/architecture.md` and `docs/status.md` before changing anything.

## Commands

- Package manager is **pnpm** (npm 10.9 crashes on this tree).
- `pnpm dev` · `pnpm check` (lint, typecheck, tests, build) · `pnpm e2e` · `pnpm gen:mock` · `pnpm gen:api` · `pnpm mock:server`
- Run `pnpm check` before calling work done. If contracts changed, run `pnpm gen:api` and commit `docs/api`.

## Non-negotiable rules

1. **Scientific integrity**
   - Planet Nine is a hypothesis. Never show it as confirmed, never give it an orbit or position.
   - A moving source is not a planet. Candidates always list mundane explanations; no invented probabilities.
   - Simulated data is labelled on the image/chart itself (`provenance.classification`, `meta.simulated`).
   - No fabricated citations. Sources live in `src/mocks/fixtures/sources.ts`; only add documents that exist.
   - SPHEREx covers 0.75–5.0 µm.
2. **One data path**: components use `@/api` hooks only. Never import `@/mocks` outside `src/api/transport.ts` (lint enforces). Never fall back from live to mock.
3. **Contracts first**: change `src/contracts/v1` → update mock fixtures → `pnpm gen:api`. Additive changes only within v1.
4. **No science in the frontend**: no detection, alignment, subtraction or photometry. Display only.
5. **Journeys are data**: new visuals are new entries in the scene registry with a validated cue type. No markup or code from the API.
6. **Narration sync**: scenes advance on narration end events, never fixed timers. Keep the run-token checks in `StoryPlayer`.
7. **No dead controls**: if it is not built, it is not on screen (or it says "unavailable").
8. **Accessibility**: keyboard reachable, labelled, captions and transcript, reduced-motion respected, usable without WebGL or speech.

## Conventions

- TypeScript strict; `@/` = `src/`. UI primitives from `@/ui`; colours and classes from `src/styles/index.css` (amber is reserved for simulated/caution).
- Feature code in `src/features/<name>`; components shared by tools and journeys in `src/components/science`.
- Versions are pinned for compatibility (see `docs/adr/README.md`); do not bump majors casually.
- Do not put model identifiers in commits or code.

## Where things are

- Contract: `src/contracts/v1` · Mock backend: `src/mocks` · Simulator: `scripts/generate-mock-data.mjs`
- 3D control surface: `src/stores/explorer.ts` · Journey engine: `src/features/journey/player/StoryPlayer.ts`, `src/narration`
- Scene registry: `src/features/journey/scenes/registry.tsx`
