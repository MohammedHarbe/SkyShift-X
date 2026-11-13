# SkyShift X API contract (v1) — backend integration guide

This is the contract between the website and the Python scientific/AI backend.

- **Source of truth:** `src/contracts/v1/*.ts` (Zod).
- **Generated from it** by `pnpm gen:api` (never edit by hand):
  - `openapi.json` — OpenAPI 3.1; load it into Swagger UI or use it to check a FastAPI app.
  - `schemas/*.schema.json` — one JSON Schema (2020-12) per type; usable with `jsonschema` or to generate Pydantic models (`datamodel-code-generator --input docs/api/openapi.json`).
  - `examples/*.json` — real request/response pairs captured from the mock API.

The frontend validates **every** response against these schemas. A response that does not match is shown to the user as an error ("Unexpected response from the data service"), never patched up.

## Connecting a real backend

```bash
VITE_API_MODE=live VITE_API_BASE_URL=http://localhost:8000 pnpm dev
```

- Enable CORS on the backend for the frontend origin (`GET`, `POST`, `OPTIONS`; headers `Content-Type`, `Accept`).
- In live mode the mock code is not loaded and there is **no fallback**: if a call fails, the UI shows the error state for that panel.
- `GET /api/v1/health` is called on start-up; `capabilities` controls wording in the UI (`liveObservations`, `dynamicJourneys`).

### Reference backend

`pnpm mock:server` serves the mock API over real HTTP on `http://localhost:8000` (set `PORT` to change), with CORS and the preview images. Use it to:

- try the frontend's live mode before the Python service exists;
- `curl` known-good responses and compare them with your own, e.g. `curl -s localhost:8000/api/v1/candidates/cand-a-001 | jq`.

Its responses keep `meta.dataOrigin: "mock"` and `simulated: true`, and the UI's status badge then reads "Live service · simulated data".

## Rules that apply to every endpoint

| Rule | Detail |
|---|---|
| Success body | `{ "apiVersion": "1.0", "data": …, "meta": { "dataOrigin": "live", "simulated": false, "generatedAt": "<ISO UTC>", "notice"?: "…" } }` |
| Error body | `{ "apiVersion": "1.0", "error": { "code": "not_found" \| "validation_error" \| "unsupported_in_demo" \| "unavailable" \| "internal_error", "message": "<shown to the user>", "details"?: {…} } }` with a non-2xx status |
| Versioning | `apiVersion` must start with `1.`. Additive changes bump the minor version. Removing or renaming a field is a new major (`/api/v2`). |
| Honesty flag | `meta.simulated` must be `true` if **any** value in the response is synthetic. Every image/dataset also carries `provenance.classification`; the UI prints that label on the image itself. |
| Timestamps | ISO 8601 UTC with `Z` (`2025-05-18T07:42:10Z`). `mjd` is also required on observations. |
| Coordinates | ICRS decimal degrees: `{ "raDeg": 52.5, "decDeg": 18.2, "frame": "ICRS" }`. |
| Units | Always explicit strings next to the number (`"uJy"`, `"MJy/sr"`, `"arcsec"`, `"arcsec/hour"`). Wavelengths are micrometres. |
| Images | The backend renders FITS to PNG previews and returns `{ url, width, height, mediaType, alt }`. `url` may be absolute or relative to the API base URL. Reference, target and difference images of one comparison **must share the same pixel grid and size**. |
| Who computes what | Alignment, subtraction, source detection, photometry, motion and catalogue matching are all backend work. The frontend only displays. |
| No invented certainty | Explanations carry a qualitative `assessment` (`consistent`, `not-ruled-out`, `disfavoured`, `ruled-out`). There is no probability field, and no "confirmed planet" status. |

## Endpoints

| Method and path | Returns (`data`) | Example |
|---|---|---|
| `GET /api/v1/health` | `Health` | `examples/health.json` |
| `GET /api/v1/regions` · `/regions/{id}` | `SkyRegion[]` · `SkyRegion` | `examples/regions.json` |
| `GET /api/v1/observations?regionId=&bandId=` · `/observations/{id}` | `Observation[]` oldest first · `Observation` | `examples/observations.json` |
| `POST /api/v1/comparisons` · `GET /comparisons/{id}` | `Comparison` | `examples/comparison.json`, `examples/comparison-rejected.json` |
| `GET /api/v1/candidates?regionId=` · `/candidates/{id}` | `CandidateSummary[]` · `Candidate` | `examples/candidates.json`, `examples/candidate.json` |
| `GET /api/v1/datasets/{id}` | `Dataset` (`kind: "spectrum"`) | `examples/dataset-spectrum.json` |
| `GET /api/v1/journeys` · `/journeys/{id}` · `POST /journeys` | `JourneySummary[]` · `Journey` · `Journey` | `examples/journey-request.json`, `examples/journey-declined.json` |
| `GET /api/v1/objects` · `/objects/{id}` | `SolarSystemObject[]` · one | — (static content; can stay served by the frontend build) |
| `GET /api/v1/sources` | `Source[]` | — |

### Observation epochs (`Observation`)

One image of a region at one time and wavelength, shaped after a SPHEREx Level-2 spectral-image cutout:

| Field | Where it comes from in SPHEREx data |
|---|---|
| `observedAt`, `mjd` | `time_bounds_lower` from the `spherex.plane` TAP table |
| `bandId` | `energy_bandpassname` (`SPHEREx-D1` … `SPHEREx-D6`) |
| `centralWavelengthUm`, `bandwidthUm` | Spectral WCS (`WCS-WAVE`, key `W`) evaluated at the cutout centre |
| `product.processingVersion` | Primary-header `VERSION` |
| `product.extensions` | HDU names: `IMAGE`, `FLAGS`, `VARIANCE`, `ZODI`, `EPSF`, `WCS-WAVE` |
| `quality.flagsPresent` | Bit names from the `FLAGS` extension (e.g. `TRANSIENT`, `HOT`, `PERSIST`) |
| `display` | The stretch and range used to render the PNG, with the pixel unit (`MJy/sr`) |
| `wcs` | A simplified TAN WCS **of the preview PNG** for the cursor read-out (origin top-left, 0-based) |

Important real-data caveat: SPHEREx sees a given sky position at a **different wavelength in each exposure**. Epoch pairs should be chosen at matched (or nearly matched) wavelength; `centralWavelengthUm` is carried on every observation so the UI can show the difference, and the backend should add a line to `comparison.caveats` when it matters.

### Image comparisons and difference images (`Comparison`)

`POST /api/v1/comparisons` with `{ "referenceObservationId": "…", "targetObservationId": "…" }`.

The response embeds both `Observation`s, plus:

- `difference.image` — the difference preview; `difference.definition` says what was subtracted from what; `difference.display` gives `vmin`/`vmax`/`unit` for the colour bar (diverging: negative = fainter/gone, positive = brighter/appeared).
- `alignment` — `status`, `method`, `residualRmsPx`.
- `markers[]` — candidate positions **in preview pixel coordinates** of the shared grid (`xPx`, `yPx`, origin top-left) and on the sky, with `role` = `reference-position` / `target-position` / `static-position`.
- `caveats[]` — plain sentences shown to the user before they interpret the image.

If a pair cannot be compared, answer `422` with a helpful `message`.

### Candidate detections and scientific evidence (`Candidate`)

- `status` ∈ `unclassified`, `needs-follow-up`, `known-object-match`, `likely-variable-source`, `likely-artifact`.
- `detections[]` — one entry per observation checked, including non-detections (`detected: false`).
- `motion` — only for moving sources: separation, baseline, rate, position angle, and the `method` used.
- `explanations[]` — every plausible explanation with a qualitative assessment and a rationale. Always include the mundane ones.
- `evidence[]` (`EvidenceItem`) — inspectable items (`difference-image`, `measurement`, `spectrum`, `catalog-crossmatch`, `literature`, `image`) with an `epistemicStatus`, optional `values[]` (label + measurement with unit and uncertainty) and links (`comparisonId`, `datasetId`, `observationIds`).
- `followUp[]`, `limitations[]` — shown verbatim.

### Spectral datasets (`SpectrumDataset`)

`points[]` of `{ wavelength (µm), bandwidth, flux, fluxUncertainty (1σ), flagged, flags[], bandId?, observedAt? }`, `fluxUnit`, the `extraction` method (aperture radius, background annulus), optional `comparisonSeries[]` (model or reference curves, each with an `epistemicStatus`) and `features[]` (labelled wavelengths). `Dataset` is a union discriminated on `kind`, so light curves or cubes can be added later without breaking clients.

### Dynamically generated Discovery Journeys (`Journey`)

`POST /api/v1/journeys` with `{ "question": "...", "context": { "regionId", "comparisonId", "candidateId", "objectId" }, "audience": "beginner" | "research" }`.

A journey is an ordered list of **scenes**; each scene has **segments**. A segment is the unit of synchronisation: one `visual` plus the `narration` spoken over it. The player shows the visual, waits for it to load, then narrates, then advances when narration ends.

- `visual` is one of a **closed set** of cue types (`camera3d`, `image`, `imageComparison`, `spectrum`, `skyMap`, `diagram`, `candidate`, `conclusion`). Cues carry ids and parameters only. The backend cannot send markup or code; an unknown type fails validation.
- Cues refer to data by id (`comparisonId`, `datasetId`, `candidateId`, `observationId`, `targetObjectId`); the frontend fetches those through the endpoints above, so they must resolve.
- `claims[]` per scene: each with an `epistemicStatus` and the `evidenceIds` / `sourceIds` that support it. Those ids must exist in the journey's own `evidence[]` and `sources[]`.
- `limitations[]` per scene: uncertainty and caveats, shown in the evidence panel.
- `generation` must state honestly how the journey was made (`mode: "generated"`, `model`, and a `disclosure` sentence shown to the user).
- Optional `segment.audio` (`url`, `durationMs`, timestamped `captions[]`) is reserved for pre-rendered narration; without it the browser synthesises speech.
- If the question cannot be answered, return `422` with a `message`; optional `details.suggestions: string[]` are offered to the user as one-tap questions.

Keep each `narration` to one or two sentences; long passages should be split into more segments.
