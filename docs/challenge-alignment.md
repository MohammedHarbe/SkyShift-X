# Challenge alignment — Planet X and SPHEREx (NASA Space Apps 2026)

## The objective

As stated by the team from the official challenge description: **create a public-facing web tool for displaying SPHEREx sky images and making it easy for anyone to see how they change over time.**

> Access note: the challenge site (`www.spaceappschallenge.org`) could not be read from the build environment (its TLS certificate chain does not verify there), so this document relies on the team's statement of the objective. Paste the full challenge text into this file when convenient and re-check the table below against it.

The IRSA archive page and three IRSA tutorials (cutouts, Source Discovery Tool, mosaic cubes) **were** read and inform the data model.

## How SkyShift X answers it

| Challenge need | SkyShift X feature | Official resource it is built on | Works with mock data | Needs the backend for real data | Demo priority |
|---|---|---|---|---|---|
| Display SPHEREx sky images | Time Explorer image viewer; observation metadata | Cutouts tutorial: MEF cutouts (`IMAGE`, `FLAGS`, `VARIANCE`, `ZODI`, `EPSF`, `WCS-WAVE`), `energy_bandpassname`, `time_bounds_lower`, per-position wavelength | Yes (simulated) | Cutout retrieval, FITS→PNG, metadata | **Essential** |
| See how images change over time | Epoch selection, side-by-side, **blink**, **difference image** | Cutouts tutorial (many exposures per position, sorted by time); Source Discovery tutorial (reprojection, subtraction) | Yes | Alignment and subtraction | **Essential** |
| Easy for anyone | Beginner mode, plain-language caveats, narrated Discovery Journey, captions, keyboard access | — | Yes | — | **Essential** |
| "Planet X" motivation | 3D explorer (Neptune, Kuiper Belt, Planet Nine *search region* as a hypothesis); candidate inspection with alternative explanations | Batygin & Brown 2016 (hypothesis); IRSA Moving Object Search Tool (for known orbits) | Yes | Candidate detection, catalogue cross-match | **Essential** (inspection), explorer supports it |
| Spectral context | Spectrum chart with uncertainty and flags | Mosaic tutorial (102 planes, aperture photometry, background subtraction); Source Discovery tutorial (aperture spectra, bad-pixel flags) | Yes | Photometry | Essential for one candidate |
| Explain, don't just show | Discovery Journey linked from the candidate ("Why does this source appear to move?") | — | Prepared journey | AI generation | **Essential** (one journey) |
| Coordinate search, arbitrary regions | Not built | TAP / SIA | No | Yes | Optional |
| Wavelength explorer over mosaic cubes | Not built | Mosaic tutorial | No | Yes; the Mosaic Tool has **no API** | Optional |

## Integration limits found in the official resources

- **IRSA Mosaic Tool has no API** (stated in the mosaic tutorial); cubes must be made in the GUI or reproduced by the backend.
- **The Source Discovery Tool is a Python package/notebook** (SExtractor, Firefly, bokeh), not a web service.
- Programmatic access is **TAP** (`spherex.artifact` ⨝ `spherex.plane`), **SIA** (collections `spherex_dr1`, `spherex_qr3`), cutout URL parameters (`?center=…&size=…`) and a public **S3** bucket. All return FITS. The browser does not call IRSA directly; the backend mediates.
- **Each exposure sees a position at a different wavelength.** Comparing epochs is only clean at matched wavelength; the contract carries `centralWavelengthUm` per observation and a `caveats` list per comparison.
- Latest releases per IRSA: QR3 (September 2026) and DR1 (November 2026) supersede QR2.

## Scientific limitations and risks

- Whether SPHEREx is sensitive enough to detect a Planet Nine-class body has **not** been established by this project; the UI never implies it.
- All demo observations, candidates and spectra are **simulated** and labelled. The simulated field coordinates are arbitrary.
- A slow-moving source is not a planet: known asteroids, variables, artifacts and misalignment are always presented first, qualitatively, with no invented probabilities.
- Planet Nine is presented only as an unconfirmed hypothesis, with no orbit and no position.
- Browser speech synthesis varies by device and may need a network; journeys are fully usable with captions alone.
