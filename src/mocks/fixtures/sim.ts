/**
 * Builds contract-shaped SIMULATED science data from the generated manifest.
 * Everything here stands in for what the real Python backend will return.
 */
import type { z } from 'zod';
import type {
  Band,
  Candidate,
  CandidateSummary,
  Comparison,
  ComparisonMarker,
  Detection,
  EvidenceItem,
  Explanation,
  Observation,
  Provenance,
  SkyRegion,
  SpectrumDataset,
} from '@/contracts/v1';
import manifest from './sim-manifest.json';

type In<T extends z.ZodType> = z.input<T>;

const { widthPx: N, pixelScaleArcsec: PIX } = manifest.image;
const SIZE_DEG = (N * PIX) / 3600;

/** Detector bands as listed on the IRSA SPHEREx mission page. */
export const SPHEREX_BANDS: In<typeof Band>[] = [
  { id: 'SPHEREx-D1', label: 'Band 1', wavelengthMinUm: 0.75, wavelengthMaxUm: 1.1, resolvingPower: 39 },
  { id: 'SPHEREx-D2', label: 'Band 2', wavelengthMinUm: 1.1, wavelengthMaxUm: 1.6, resolvingPower: 41 },
  { id: 'SPHEREx-D3', label: 'Band 3', wavelengthMinUm: 1.6, wavelengthMaxUm: 2.4, resolvingPower: 41 },
  { id: 'SPHEREx-D4', label: 'Band 4', wavelengthMinUm: 2.4, wavelengthMaxUm: 3.8, resolvingPower: 35 },
  { id: 'SPHEREx-D5', label: 'Band 5', wavelengthMinUm: 3.8, wavelengthMaxUm: 4.4, resolvingPower: 112 },
  { id: 'SPHEREx-D6', label: 'Band 6', wavelengthMinUm: 4.4, wavelengthMaxUm: 5.0, resolvingPower: 128 },
];

const GENERATOR = `${manifest.generator.name} ${manifest.generator.version}`;

const simProvenance = (origin: string, notes?: string): In<typeof Provenance> => ({
  classification: 'simulated',
  origin,
  pipeline: GENERATOR,
  processingVersion: 'sim-v0',
  sourceIds: ['src-irsa-cutouts', 'src-irsa-sdt'],
  notes: notes ?? 'Synthetic test data that mimics the structure of SPHEREx products. Not a NASA measurement.',
});

type SimRegion = (typeof manifest.regions)[number];
type SimObs = SimRegion['observations'][number];
type SimCmp = SimRegion['comparisons'][number];
type SimInjected = SimRegion['injected'][number];

const REGION_TEXT: Record<string, { description: string }> = {
  'field-a': {
    description:
      'A synthetic 15.5-arcminute field placed near the ecliptic, where solar-system objects are most common. It contains one slow-moving source, one fast mover, one variable source and one detector artifact, so you can practise telling them apart.',
  },
  'field-b': {
    description:
      'A synthetic control field with no moving objects: one variable source and one detector artifact. Useful for seeing what "nothing moved" looks like.',
  },
};

function buildObservation(region: SimRegion, o: SimObs): In<typeof Observation> {
  const epoch = manifest.epochs[o.epochIndex]!;
  const band = SPHEREX_BANDS.find((b) => b.id === o.bandId)!;
  return {
    id: o.id,
    regionId: region.id,
    epochLabel: epoch.label,
    observedAt: epoch.observedAt,
    mjd: epoch.mjd,
    bandId: o.bandId,
    centralWavelengthUm: o.centralWavelengthUm,
    bandwidthUm: o.bandwidthUm,
    center: { ...region.center, frame: 'ICRS' },
    sizeDeg: { width: SIZE_DEG, height: SIZE_DEG },
    pixelScaleArcsec: PIX,
    image: {
      url: `mock-data/images/${o.file}`,
      width: N,
      height: N,
      mediaType: 'image/png',
      alt: `Simulated ${band.label} (${o.centralWavelengthUm} µm) image of ${region.name}, ${epoch.label}: a field of point sources on a noisy background.`,
    },
    display: { stretch: 'asinh', vmin: o.vmin, vmax: o.vmax, unit: manifest.image.unit, colormap: 'grayscale' },
    wcs: {
      projection: 'TAN',
      crpix: [(N - 1) / 2, (N - 1) / 2],
      crval: [region.center.raDeg, region.center.decDeg],
      cdeltDeg: [-PIX / 3600, -PIX / 3600],
      rotationDeg: 0,
    },
    product: {
      level: 'Simulated Level 2 spectral image cutout',
      collection: 'simulated',
      processingVersion: 'sim-v0',
      fileName: o.fileName,
      extensions: ['IMAGE', 'FLAGS', 'VARIANCE', 'ZODI', 'EPSF', 'WCS-WAVE'],
    },
    quality: {
      flaggedPixelFraction: o.flaggedPixelFraction,
      flagsPresent: o.flagsPresent,
      notes: 'Flag names follow the SPHEREx pixel-flag vocabulary; the flagged pixels themselves are simulated.',
    },
    provenance: simProvenance('Synthetic star field rendered by the SkyShift X simulator.'),
    downloads: [],
  };
}

export const candidateId = (key: string) => `cand-${key}`;
const designation = (key: string) => `SSX-${key.toUpperCase()}`;

function markersFor(region: SimRegion, c: SimCmp): In<typeof ComparisonMarker>[] {
  const out: In<typeof ComparisonMarker>[] = [];
  for (const inj of region.injected) {
    if (inj.band && inj.band !== c.bandId) continue;
    const ref = inj.epochs[c.referenceEpochIndex];
    const tgt = inj.epochs[c.targetEpochIndex];
    const base = { candidateId: candidateId(inj.key), label: designation(inj.key), radiusPx: 5 };
    const stationary = ref && tgt && ref.xPx === tgt.xPx && ref.yPx === tgt.yPx;
    if (stationary) {
      out.push({ ...base, role: 'static-position', xPx: ref.xPx, yPx: ref.yPx, position: { ...ref.position, frame: 'ICRS' } });
      continue;
    }
    if (ref) out.push({ ...base, role: 'reference-position', xPx: ref.xPx, yPx: ref.yPx, position: { ...ref.position, frame: 'ICRS' } });
    if (tgt) out.push({ ...base, role: 'target-position', xPx: tgt.xPx, yPx: tgt.yPx, position: { ...tgt.position, frame: 'ICRS' } });
  }
  return out;
}

function buildComparison(region: SimRegion, c: SimCmp): In<typeof Comparison> {
  const refObs = region.observations.find((o) => o.bandId === c.bandId && o.epochIndex === c.referenceEpochIndex)!;
  const tgtObs = region.observations.find((o) => o.bandId === c.bandId && o.epochIndex === c.targetEpochIndex)!;
  const reference = buildObservation(region, refObs);
  const target = buildObservation(region, tgtObs);
  const baseline = target.mjd - reference.mjd;
  const caveats = [
    'Simulated data: both images and the difference image are synthetic.',
    `The two exposures sample slightly different wavelengths (${reference.centralWavelengthUm} µm and ${target.centralWavelengthUm} µm). Sources with steep spectra can leave residuals that are not real changes.`,
    `Bright stars leave small paired residuals from sub-pixel alignment error (${c.residualRmsPx} px RMS).`,
  ];
  if (baseline > 60)
    caveats.push('The zodiacal background differs between seasons; a constant level was subtracted before display.');
  return {
    id: c.id,
    regionId: region.id,
    bandId: c.bandId,
    reference,
    target,
    timeBaselineDays: Number(baseline.toFixed(3)),
    alignment: {
      status: 'aligned',
      method: 'Simulated: images share a pixel grid by construction, with injected sub-pixel jitter',
      residualRmsPx: c.residualRmsPx,
    },
    difference: {
      image: {
        url: `mock-data/images/${c.file}`,
        width: N,
        height: N,
        mediaType: 'image/png',
        alt: `Simulated difference image (${target.epochLabel} minus ${reference.epochLabel}). Unchanged stars cancel to near black; sources that brightened or appeared are amber, sources that faded or left are blue.`,
      },
      definition: 'target − reference, median level removed',
      display: { stretch: 'linear', vmin: -c.vmax, vmax: c.vmax, unit: manifest.image.unit, colormap: 'diverging' },
      noiseRms: c.noiseRms,
      provenance: simProvenance('Pixel-wise subtraction of two simulated observations.'),
    },
    markers: markersFor(region, c),
    caveats,
    provenance: simProvenance('Simulated comparison product.'),
  };
}

/* ------------------------------ candidates ------------------------------ */

const FLUX_SIGMA_UJY = 62; // simulated photometric uncertainty for a point source

function detectionsFor(region: SimRegion, inj: SimInjected): In<typeof Detection>[] {
  return region.observations
    .filter((o) => !inj.band || inj.band === o.bandId)
    .map((o, idx) => {
      const ep = inj.epochs[o.epochIndex];
      const epoch = manifest.epochs[o.epochIndex]!;
      const base = { observationId: o.id, observedAt: epoch.observedAt, wavelengthUm: o.centralWavelengthUm };
      if (!ep) return { ...base, detected: false, flags: [] };
      if (!ep.fluxUjy)
        return {
          ...base,
          detected: true,
          position: { ...ep.position, frame: 'ICRS' as const },
          positionUncertaintyArcsec: PIX / 2,
          flags: inj.flag ? [inj.flag] : [],
        };
      const truth = (ep.fluxUjy as Record<string, number>)[o.bandId] ?? 0;
      // Deterministic pseudo-measurement scatter so numbers are not suspiciously exact.
      const value = Math.round(truth + FLUX_SIGMA_UJY * Math.sin(idx * 2.7 + truth * 0.013));
      return {
        ...base,
        detected: true,
        position: { ...ep.position, frame: 'ICRS' as const },
        positionUncertaintyArcsec: 1.4,
        flux: { value, uncertainty: FLUX_SIGMA_UJY, unit: 'uJy' },
        snr: Number((value / FLUX_SIGMA_UJY).toFixed(1)),
        flags: [],
      };
    })
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt));
}

interface CandidateText {
  status: Candidate['status'];
  headline: string;
  explanations: In<typeof Explanation>[];
  evidence: In<typeof EvidenceItem>[];
  followUp: string[];
  limitations: string[];
  spectrum?: boolean;
  journeys?: string[];
}

const SIM_LIMIT = 'This candidate is simulated. It exists to demonstrate the workflow and is not evidence of any real object.';

const CANDIDATE_TEXT: Record<string, CandidateText> = {
  'a-001': {
    status: 'needs-follow-up',
    headline: 'A faint source that shifts position between every epoch',
    spectrum: true,
    journeys: ['journey-moving-source'],
    explanations: [
      {
        id: 'exp-known',
        label: 'A known asteroid or comet',
        description: 'Most moving points in survey images are already-catalogued small bodies.',
        assessment: 'not-ruled-out',
        rationale:
          'No counterpart was found in the simulated catalogue of known objects. Real catalogues are incomplete for faint bodies, and a main-belt asteroid near a turning point of its apparent path can also move this slowly for a few days.',
        evidenceIds: ['ev-a-001-xmatch', 'ev-a-001-motion'],
      },
      {
        id: 'exp-distant',
        label: 'A distant icy body beyond Neptune',
        description: 'Trans-Neptunian objects drift slowly because they are far away.',
        assessment: 'consistent',
        rationale:
          'The measured drift of about 0.23 arcseconds per hour is slow, as expected for a distant body. Being consistent is not the same as being identified: no orbit can be fitted from three positions.',
        evidenceIds: ['ev-a-001-motion', 'ev-a-001-spectrum'],
      },
      {
        id: 'exp-planet',
        label: 'An undiscovered planet',
        description: 'For example the hypothesised, unconfirmed "Planet Nine".',
        assessment: 'not-ruled-out',
        rationale:
          'Nothing in this evidence singles out a planet over any other slow-moving body. Establishing a new solar-system object needs many positions over months to years, an orbit, and independent confirmation.',
        evidenceIds: [],
      },
      {
        id: 'exp-artifact',
        label: 'An image artifact or noise',
        description: 'Cosmic-ray hits, hot pixels and ghosts can look like sources.',
        assessment: 'disfavoured',
        rationale: 'The source is detected in two wavelength bands at all three epochs with similar brightness. Artifacts rarely repeat that way.',
        evidenceIds: ['ev-a-001-multiband'],
      },
      {
        id: 'exp-variable',
        label: 'A variable star or galaxy',
        description: 'A fixed source whose brightness changes.',
        assessment: 'disfavoured',
        rationale: 'A variable source stays in the same place. This one changes position, leaving a paired dark-and-bright signature in the difference image.',
        evidenceIds: ['ev-a-001-diff'],
      },
      {
        id: 'exp-alignment',
        label: 'Image misalignment',
        description: 'If two images are not registered correctly, every star appears to shift.',
        assessment: 'disfavoured',
        rationale: 'Neighbouring stars subtract cleanly. The alignment residual is about 0.06 pixels, while this source moved 8.6 pixels.',
        evidenceIds: ['ev-a-001-diff'],
      },
    ],
    evidence: [
      {
        id: 'ev-a-001-diff',
        kind: 'difference-image',
        title: 'Paired residual in the difference image',
        summary: 'Epoch 2 minus Epoch 1 shows a negative (blue) residual at the earlier position and a positive (amber) residual 53 arcseconds away.',
        epistemicStatus: 'simulated',
        comparisonId: 'cmp-field-a-d2-e1-e2',
        observationIds: ['obs-field-a-d2-e1', 'obs-field-a-d2-e2'],
      },
      {
        id: 'ev-a-001-motion',
        kind: 'measurement',
        title: 'Apparent motion between Epoch 1 and Epoch 2',
        summary: 'Positions measured by the (simulated) backend in the aligned frame.',
        epistemicStatus: 'simulated',
        observationIds: ['obs-field-a-d2-e1', 'obs-field-a-d2-e2'],
        values: [
          { label: 'Angular separation', measurement: { value: 53.1, uncertainty: 2.0, unit: 'arcsec' } },
          { label: 'Time baseline', measurement: { value: 9.48, unit: 'days' } },
          { label: 'Apparent rate', measurement: { value: 0.233, uncertainty: 0.009, unit: 'arcsec/hour' } },
        ],
      },
      {
        id: 'ev-a-001-multiband',
        kind: 'measurement',
        title: 'Detected in two bands at every epoch',
        summary: 'Six independent detections (Band 2 and Band 4, three epochs) at signal-to-noise above 10.',
        epistemicStatus: 'simulated',
      },
      {
        id: 'ev-a-001-xmatch',
        kind: 'catalog-crossmatch',
        title: 'No match in the known-object catalogue',
        summary: 'A simulated cross-match against known solar-system objects returned nothing within 30 arcseconds at any epoch. The real backend will query actual catalogues.',
        epistemicStatus: 'simulated',
      },
      {
        id: 'ev-a-001-spectrum',
        kind: 'spectrum',
        title: 'Spectrum resembling sunlight reflected from an icy surface',
        summary: 'The simulated spectrum follows a Sun-like continuum with injected absorption near 1.5, 2.0 and 3.0 µm.',
        epistemicStatus: 'simulated',
        datasetId: 'ds-spec-a-001',
      },
    ],
    followUp: [
      'More positions over weeks to months, to fit an orbit and estimate distance.',
      'A cross-match against catalogues of known solar-system objects at each observation time.',
      'A search along the predicted track in other SPHEREx exposures (IRSA provides a Moving Object Search Tool for known orbits).',
      'Independent confirmation with a different telescope.',
    ],
    limitations: [SIM_LIMIT, 'Three positions cannot constrain an orbit.', 'Each exposure samples a different wavelength, so brightness differences between epochs mix colour and time variation.'],
  },
  'a-002': {
    status: 'known-object-match',
    headline: 'Bright source present in Epoch 1 only',
    explanations: [
      {
        id: 'exp-known',
        label: 'A known main-belt asteroid',
        description: 'Fast-moving small bodies cross a cutout this size within hours to days.',
        assessment: 'consistent',
        rationale: 'The simulated catalogue cross-match places a known asteroid at this position at the time of Epoch 1. By Epoch 2 it had left the field.',
        evidenceIds: ['ev-a-002-xmatch'],
      },
      {
        id: 'exp-transient',
        label: 'A one-off transient (flare, nova)',
        description: 'A source that appears briefly at a fixed position.',
        assessment: 'not-ruled-out',
        rationale: 'A single epoch cannot distinguish a transient from a mover; the catalogue match makes the asteroid explanation simpler.',
        evidenceIds: [],
      },
      {
        id: 'exp-artifact',
        label: 'An image artifact',
        description: 'A detector effect confined to one exposure.',
        assessment: 'disfavoured',
        rationale: 'It has a star-like profile and appears in both bands observed at Epoch 1.',
        evidenceIds: [],
      },
    ],
    evidence: [
      {
        id: 'ev-a-002-xmatch',
        kind: 'catalog-crossmatch',
        title: 'Simulated match to a catalogued asteroid',
        summary: 'Simulated cross-match result. No real asteroid is implied.',
        epistemicStatus: 'simulated',
      },
    ],
    followUp: ['Confirm the predicted position of the matched object at the exposure time.'],
    limitations: [SIM_LIMIT],
  },
  'a-003': {
    status: 'likely-variable-source',
    headline: 'A star that brightens, then fades, without moving',
    spectrum: true,
    explanations: [
      {
        id: 'exp-variable',
        label: 'A variable star',
        description: 'Many stars pulsate or are eclipsed by companions.',
        assessment: 'consistent',
        rationale: 'The position is identical at every epoch while the brightness changes by more than 60%. The difference image shows a single-sign residual, not a pair.',
        evidenceIds: ['ev-a-003-flux'],
      },
      {
        id: 'exp-moving',
        label: 'A moving object',
        description: 'Something passing in front of or near the star.',
        assessment: 'disfavoured',
        rationale: 'No positional shift is measured.',
        evidenceIds: [],
      },
      {
        id: 'exp-wavelength',
        label: 'A colour effect',
        description: 'Each exposure samples a different wavelength, so a very red or blue star can appear to change.',
        assessment: 'not-ruled-out',
        rationale: 'The wavelength differs by a few percent between epochs; a real analysis must compare matched wavelengths.',
        evidenceIds: [],
      },
    ],
    evidence: [
      {
        id: 'ev-a-003-flux',
        kind: 'measurement',
        title: 'Brightness at three epochs (Band 2)',
        summary: 'Simulated photometry at a fixed position.',
        epistemicStatus: 'simulated',
        values: [
          { label: 'Epoch 1', measurement: { value: 2400, uncertainty: 62, unit: 'uJy' } },
          { label: 'Epoch 2', measurement: { value: 3900, uncertainty: 62, unit: 'uJy' } },
          { label: 'Epoch 3', measurement: { value: 2100, uncertainty: 62, unit: 'uJy' } },
        ],
      },
    ],
    followUp: ['Build a light curve from all available exposures at matched wavelengths.', 'Cross-match against variable-star catalogues.'],
    limitations: [SIM_LIMIT],
  },
  'a-004': {
    status: 'likely-artifact',
    headline: 'A sharp spike in one exposure, one band',
    explanations: [
      {
        id: 'exp-artifact',
        label: 'A cosmic-ray hit or other detector transient',
        description: 'Energetic particles deposit charge in a few pixels during a single exposure.',
        assessment: 'consistent',
        rationale: 'It is sharper than a star, appears in one exposure of one band only, and the affected pixels carry the TRANSIENT flag.',
        evidenceIds: ['ev-a-004-flags'],
      },
      {
        id: 'exp-real',
        label: 'A real astronomical source',
        description: 'A genuine brief flash.',
        assessment: 'disfavoured',
        rationale: 'A real point source would be blurred to the width of the telescope\'s point-spread function.',
        evidenceIds: [],
      },
    ],
    evidence: [
      {
        id: 'ev-a-004-flags',
        kind: 'measurement',
        title: 'Flagged pixels at the detection position',
        summary: 'Simulated FLAGS extension marks these pixels TRANSIENT.',
        epistemicStatus: 'simulated',
      },
    ],
    followUp: ['None needed; excluded by pixel flags.'],
    limitations: [SIM_LIMIT],
  },
  'b-001': {
    status: 'likely-variable-source',
    headline: 'A bright star whose brightness changes at every epoch',
    explanations: [
      {
        id: 'exp-variable',
        label: 'A variable star',
        description: 'Many stars pulsate or are eclipsed by companions.',
        assessment: 'consistent',
        rationale: 'Fixed position, changing brightness, single-sign residual in every difference image.',
        evidenceIds: [],
      },
      {
        id: 'exp-moving',
        label: 'A moving object',
        description: 'Something in the solar system.',
        assessment: 'disfavoured',
        rationale: 'No positional shift is measured.',
        evidenceIds: [],
      },
    ],
    evidence: [],
    followUp: ['Build a light curve at matched wavelengths.'],
    limitations: [SIM_LIMIT],
  },
  'b-002': {
    status: 'likely-artifact',
    headline: 'A spike in one Band 4 exposure',
    explanations: [
      {
        id: 'exp-artifact',
        label: 'Detector persistence or a cosmic-ray hit',
        description: 'A leftover signal from a previous bright exposure, or a particle hit.',
        assessment: 'consistent',
        rationale: 'Present in one exposure of one band only; pixels carry the PERSIST flag.',
        evidenceIds: [],
      },
      {
        id: 'exp-real',
        label: 'A real astronomical source',
        description: 'A genuine brief flash.',
        assessment: 'disfavoured',
        rationale: 'It is sharper than the point-spread function and has no counterpart in the other band.',
        evidenceIds: [],
      },
    ],
    evidence: [],
    followUp: ['None needed; excluded by pixel flags.'],
    limitations: [SIM_LIMIT],
  },
};

function buildCandidate(region: SimRegion, inj: SimInjected): In<typeof Candidate> {
  const text = CANDIDATE_TEXT[inj.key]!;
  const detections = detectionsFor(region, inj);
  const seen = detections.filter((d) => d.detected);
  const first = seen[0]!;
  const kind: CandidateSummary['kind'] =
    inj.kind === 'moving-source' ? 'moving-source' : inj.kind === 'brightness-change' ? 'brightness-change' : 'single-epoch-detection';
  const candidate: In<typeof Candidate> = {
    id: candidateId(inj.key),
    designation: designation(inj.key),
    regionId: region.id,
    kind,
    status: text.status,
    headline: text.headline,
    position: first.position!,
    detectionCount: seen.length,
    firstObservedAt: first.observedAt,
    lastObservedAt: seen[seen.length - 1]!.observedAt,
    classification: 'simulated',
    detections,
    explanations: text.explanations,
    evidence: text.evidence,
    spectrumDatasetId: text.spectrum ? `ds-spec-${inj.key}` : undefined,
    followUp: text.followUp,
    limitations: text.limitations,
    relatedJourneyIds: text.journeys ?? [],
    provenance: simProvenance('Injected into the simulated images by the SkyShift X simulator.'),
  };
  if (inj.kind === 'moving-source') {
    const a = inj.epochs[0]!;
    const b = inj.epochs[1]!;
    const dx = b.xPx - a.xPx;
    const dy = b.yPx - a.yPx;
    const sep = Math.hypot(dx, dy) * PIX;
    const baseline = manifest.epochs[1]!.mjd - manifest.epochs[0]!.mjd;
    // x increases to the west and y increases to the south in the preview frame.
    const pa = (Math.atan2(-dx, -dy) * 180) / Math.PI;
    candidate.motion = {
      angularSeparation: { value: Number(sep.toFixed(1)), uncertainty: 2.0, unit: 'arcsec' },
      baselineDays: Number(baseline.toFixed(2)),
      rate: { value: Number((sep / (baseline * 24)).toFixed(3)), uncertainty: 0.009, unit: 'arcsec/hour' },
      positionAngleDeg: Number(((pa + 360) % 360).toFixed(1)),
      method: 'Simulated centroid difference between Epoch 1 and Epoch 2 in the aligned frame',
    };
  }
  return candidate;
}

/* ------------------------------ spectra ------------------------------ */

const SPECTRUM_TEXT: Record<string, { title: string; description: string; refLabel: string; refDescription: string; target: string }> = {
  'a-001': {
    title: 'Simulated spectrum of SSX-A-001',
    description: 'Synthetic 0.75–5.0 µm spectrum: a Sun-like continuum (reflected sunlight) with injected absorption features and noise.',
    refLabel: 'Sun-like continuum (no absorption)',
    refDescription: 'What reflected sunlight would look like from a perfectly grey surface. Smooth model curve.',
    target: 'SSX-A-001',
  },
  'a-003': {
    title: 'Simulated spectrum of SSX-A-003',
    description: 'Synthetic 0.75–5.0 µm spectrum of a cool star with injected absorption features and noise.',
    refLabel: 'Cool-star continuum (no absorption)',
    refDescription: 'A 3,400 K blackbody curve for comparison. Smooth model curve.',
    target: 'SSX-A-003',
  },
};

function buildSpectrum(key: string): In<typeof SpectrumDataset> {
  const spec = (manifest.spectra as Record<string, (typeof manifest.spectra)['a-001']>)[key]!;
  const text = SPECTRUM_TEXT[key]!;
  return {
    id: `ds-spec-${key}`,
    kind: 'spectrum',
    title: text.title,
    description: text.description,
    target: { name: text.target, candidateId: candidateId(key) },
    wavelengthUnit: 'um',
    fluxUnit: 'uJy',
    points: spec.points,
    extraction: {
      method: 'Simulated aperture photometry with annulus background subtraction',
      apertureRadiusPx: 3,
      backgroundAnnulusPx: [6, 10],
      notes: '102 channels: one per plane of a SPHEREx mosaic cube. Flagged points mark apertures containing a bad pixel.',
    },
    comparisonSeries: [
      { id: 'reference', label: text.refLabel, description: text.refDescription, epistemicStatus: 'illustrative', points: spec.reference },
    ],
    features: spec.injectedFeatures.map((f) => ({
      wavelengthUm: f.wavelengthUm,
      label: f.label,
      epistemicStatus: 'simulated' as const,
      note: 'Deliberately injected into the simulation; not a detection.',
    })),
    provenance: simProvenance('Synthetic spectrum generated by the SkyShift X simulator.'),
    downloads: [],
  };
}

/* ------------------------------ assembled tables ------------------------------ */

export const observations: In<typeof Observation>[] = manifest.regions.flatMap((r) =>
  r.observations.map((o) => buildObservation(r, o)),
);
export const comparisons: In<typeof Comparison>[] = manifest.regions.flatMap((r) =>
  r.comparisons.map((c) => buildComparison(r, c)),
);
export const candidates: In<typeof Candidate>[] = manifest.regions.flatMap((r) =>
  r.injected.map((inj) => buildCandidate(r, inj)),
);
export const datasets: In<typeof SpectrumDataset>[] = Object.keys(manifest.spectra).map(buildSpectrum);

export const regions: In<typeof SkyRegion>[] = manifest.regions.map((r) => ({
  id: r.id,
  name: r.name,
  description: REGION_TEXT[r.id]?.description ?? '',
  center: { ...r.center, frame: 'ICRS' },
  sizeDeg: { width: SIZE_DEG, height: SIZE_DEG },
  bands: SPHEREX_BANDS.filter((b) => r.observations.some((o) => o.bandId === b.id)),
  observationCount: r.observations.length,
  epochRange: { start: manifest.epochs[0]!.observedAt, end: manifest.epochs[manifest.epochs.length - 1]!.observedAt },
  candidateCount: r.injected.length,
  provenance: simProvenance('Synthetic field; coordinates are arbitrary and do not correspond to any studied region.'),
}));

export const SIM_NOTICE = manifest.notice;
