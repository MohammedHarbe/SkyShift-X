# Asset manifest and imagery policy

**Current state: the build ships no third-party imagery.** Nothing was downloaded from NASA or elsewhere.

| What you see | Classification | Origin |
|---|---|---|
| 3D solar system, SPHEREx model, Planet Nine search band | `procedural-visualization` | Drawn at runtime from shapes and shaders (`src/features/explorer`) |
| Sky images, difference images | `simulated` | `scripts/generate-mock-data.mjs` → `public/mock-data/images/*.png` |
| Spectra | `simulated` | Same script → `src/mocks/fixtures/sim-manifest.json` |
| Diagrams in journeys | `illustrative-diagram` | Hand-written SVG (`src/features/journey/scenes/diagrams.tsx`) |

## Adding a real image

Real images are delivered through the API as `Asset` entries (see `src/contracts/v1/journeys.ts`), never bundled anonymously. Each entry must have:

- `sourceUrl` — the authoritative page it came from (NASA, JPL, IRSA, ESA…);
- `credit` — exactly as the source requests;
- `usageTerms` — e.g. NASA media usage guidelines; note any restriction;
- `classification` — `real-observation`, `artist-impression`, `illustrative-diagram`, …;
- `observation` — instrument, wavelength/band, date, where applicable;
- `image.alt` — a text alternative.

Rules: artist impressions are labelled as such on the image; real scientific images keep their wavelength context; nothing synthetic is ever presented as a NASA measurement.
