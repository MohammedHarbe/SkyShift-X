# Status — what works, how it was verified, what is not done

Last updated: 13 November 2026 (first build session).

## Summary

The prioritised vertical slice runs end to end in demo mode: landing → 3D explorer → Time Explorer (two epochs, blink, difference) → candidate inspection → "Why does this source appear to move?" → narrated Discovery Journey with captions, camera moves and evidence. Live mode against an HTTP backend works and fails honestly.

**Everything scientific on screen is simulated and labelled.** No real SPHEREx data is used yet.

## Verified

| Area | What was checked | How |
|---|---|---|
| Lint, types, unit/component tests, production build | `pnpm check` | Passed: ESLint clean, `tsc` clean, 43 tests in 8 files, Vite production build |
| Demonstration path in a real browser | Landing → explorer; Planet Nine shown as hypothesis; Time Explorer side/blink/difference; candidate status, explanations, evidence, spectrum; ask → journey; journey advances by itself on narration end; pause; scene jump; evidence panel; transcript jump; unsupported question declined; mission sources | `pnpm e2e` (Playwright, Chromium, production build): 18 of 18 passed, including the rows below |
| No horizontal overflow at 390 px | Landing, Time Explorer (with and without a candidate), mission, explorer | `pnpm e2e` |
| Accessibility scan | No serious or critical WCAG 2.1 A/AA violations (axe-core) on landing, explorer, Time Explorer with a candidate, journey start, journey playing, mission | `e2e/a11y.spec.ts` |
| Static hosting from a sub-folder | Production build served under `/skyshift-x/`: routes, API mock and images all load, no failed requests | Manual browser run |
| API contract | Every mock endpoint parses against the v1 schemas; journey references resolve; Planet Nine has no orbit and is hypothetical; all candidates are classified simulated | `src/api/api.test.ts` |
| No silent fallback | Network failure, wrong response shape and wrong API major version each produce a visible error and no data | `src/api/api.test.ts`, `src/ui/states.test.tsx` |
| Live mode over real HTTP | With `pnpm mock:server` as the backend: API calls and images went over HTTP; badge read "Live service · simulated data". With the backend stopped: badge "Data service unreachable", error panels with retry, zero images or candidates shown | Manual browser run, screenshots inspected |
| Narration synchronisation | Visual is prepared before narration; scenes advance only on the narration end event (60 s of idle time advances nothing); stale callbacks after scene jump, pause or dispose are ignored; voice failure mid-journey falls back to captions with a notice; no-voice browsers play captions only; mute keeps position | `src/features/journey/player/StoryPlayer.test.ts` |
| Web Speech provider | Voice selection, start/boundary/end relay, start-timeout and engine errors, cancel silences handlers | `src/narration/webSpeech.test.ts` (stubbed engine) |
| Without WebGL | Explorer shows a 2D map of the same objects with the same navigator and info panel and a notice; journeys show an information card in place of 3D shots and keep playing | Browser run with 3D APIs disabled, screenshots inspected |
| 3D explorer | Sun, eight planets, Pluto, Eris, Sedna, Kuiper Belt, SPHEREx model, Planet Nine search band (labelled hypothetical, not observed); selection, info panel with sources, camera framing choices, simulation pause/speed; phone layout | Screenshots inspected at 1440×900 and 390×844 |
| Journey visuals | Start card, 3D camera scenes, diagrams, blink and difference scenes, candidate scenes, spectrum with evidence panel, conclusion; desktop and 390 px | Screenshots inspected |

## Known limitations

- **Spoken narration has not been heard on a real device.** The build environment's browser has no speech voices, so journeys ran in captions-only mode there (which is the designed fallback). The voice path is covered by unit tests with a stubbed engine. Try it in Chrome, Safari and Firefox on real hardware before the demonstration; voice quality and availability vary by browser and operating system.
- **All observations, difference images, candidates and spectra are simulated.** Field coordinates are arbitrary.
- **One journey only.** The other four planned journeys are not written. The question bar routes a few phrasings to the prepared journey and declines everything else.
- **No AI model runs in the frontend or the mock.**
- **Time Explorer:** no slider/swipe comparison, no coordinate search, no FITS downloads (the mock supplies none), "Show candidates" is not in the URL, switching band resets the chosen epochs.
- **Science Lab** (wavelength explorer over cubes) and a cross-region **candidate table** are not built.
- **No third-party imagery.** The 3D view is procedural; there are no NASA photographs yet.
- **Accessibility** passes an automated scan but has not been tested with a screen reader, and touch gestures in the 3D view were not exercised.
- **Official challenge page was not readable** from the build environment; alignment is based on the objective as stated by the team.
- **3D explorer rough edges:**
  - The detail level drops when the frame rate is low and does not climb back in the same visit.
  - Labels are not hidden when a planet is in front of them and can sit under the side panels.
  - Each body's orbit orientation and starting position are illustrative (derived from its name), because no ephemeris is used.
  - On one run the camera stopped closer to Mars than the "Medium" framing intends; not reproduced.
  - In the 2D fallback map the labels of the innermost planets overlap near the Sun.
  - The slow cinematic camera drift and the reduced-motion "cut instead of fly" behaviour are implemented but were only seen in still screenshots.
- **Performance** was observed only under software WebGL in headless Chromium, where the app drops to its reduced-detail tier. Frame rate on real phones is unmeasured.

## Next steps

See `docs/roadmap.md`. The first is running against the real FastAPI backend and fixing any contract mismatches it reveals.
