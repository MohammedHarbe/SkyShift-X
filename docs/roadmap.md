# Roadmap

Priority order is set by the challenge: **show SPHEREx images and how they change over time**, then explain it.

## Vertical slice (built first)

1. Cinematic landing page.
2. 3D solar-system explorer with a strong Neptune / outer-solar-system experience.
3. Time Explorer: region, band and epoch selection; side-by-side, blink and difference views; candidate markers.
4. Candidate inspection panel: detections, motion, explanations, evidence, spectrum.
5. One complete Discovery Journey ("Why Did This Source Move?") with synchronised narration, captions, camera moves and evidence.
6. Typed API contracts v1, mock API, generated OpenAPI/JSON Schema/examples.
7. Live-mode switch for the Python backend, with no silent fallback.

See `docs/status.md` for what has been verified.

## Next (after the demonstration works end to end)

- **Live backend bring-up:** run against the FastAPI service, fix contract mismatches, add CORS notes.
- **Real imagery:** approved NASA/IRSA images with manifest entries (source URL, credit, terms, classification).
- **More journeys:** The Hunt for a Hidden World; Seeing the Invisible; Meet SPHEREx; Reading Cosmic Fingerprints.
- **Time Explorer depth:** slider/swipe comparison, more than two epochs as a filmstrip, flag-mask overlay, coordinate search, FITS download links.
- **Science Lab:** wavelength explorer over mosaic cubes, spectrum comparison between sources.
- **Candidate table view** across regions with sorting and filtering.
- **Premium narration:** `AudioClipProvider` using `segment.audio` with timestamped captions.
- **Quality:** screen-reader pass, visual regression screenshots, performance budget for the 3D layer on low-end devices, label occlusion in the 3D view.

## Acceptance criteria per phase (definition of done)

- `pnpm check` passes (lint, typecheck, unit tests, production build).
- `pnpm e2e` passes.
- No dead controls; unavailable features are absent or say so.
- New data goes through `src/contracts` + `src/api`; new simulated data is labelled.
- `docs/status.md` updated with what was actually verified.
