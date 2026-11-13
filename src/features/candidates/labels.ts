/** Plain-language wording for candidate fields. There is deliberately no wording for "planet". */
import type { Candidate, CandidateSummary, Explanation } from '@/contracts/v1';

type Tone = 'neutral' | 'cyan' | 'amber' | 'rose' | 'mint';

export const STATUS_LABEL: Record<CandidateSummary['status'], { label: string; tone: Tone; help: string }> = {
  unclassified: { label: 'Unclassified', tone: 'neutral', help: 'Not yet reviewed.' },
  'needs-follow-up': { label: 'Needs follow-up', tone: 'cyan', help: 'Ordinary explanations are not yet excluded. More observations are needed.' },
  'known-object-match': { label: 'Matches a known object', tone: 'mint', help: 'Coincides with an object that is already catalogued.' },
  'likely-variable-source': { label: 'Likely variable source', tone: 'neutral', help: 'A fixed source whose brightness changes.' },
  'likely-artifact': { label: 'Likely artifact', tone: 'neutral', help: 'Probably produced by the detector, not by the sky.' },
};

export const KIND_LABEL: Record<CandidateSummary['kind'], string> = {
  'moving-source': 'Moving source',
  'brightness-change': 'Brightness change',
  'single-epoch-detection': 'Seen in one epoch only',
};

export const ASSESSMENT_LABEL: Record<Explanation['assessment'], { label: string; tone: Tone }> = {
  consistent: { label: 'Consistent with the evidence', tone: 'cyan' },
  'not-ruled-out': { label: 'Not ruled out', tone: 'neutral' },
  disfavoured: { label: 'Disfavoured', tone: 'neutral' },
  'ruled-out': { label: 'Ruled out', tone: 'rose' },
};

/** Order explanations from best to least supported, keeping the API's order within each group. */
const ASSESSMENT_ORDER: Explanation['assessment'][] = ['consistent', 'not-ruled-out', 'disfavoured', 'ruled-out'];
export function sortExplanations(list: Candidate['explanations']): Candidate['explanations'] {
  return [...list].sort((a, b) => ASSESSMENT_ORDER.indexOf(a.assessment) - ASSESSMENT_ORDER.indexOf(b.assessment));
}

const EVIDENCE_KIND: Record<Candidate['evidence'][number]['kind'], string> = {
  image: 'Image',
  'difference-image': 'Difference image',
  measurement: 'Measurement',
  spectrum: 'Spectrum',
  'catalog-crossmatch': 'Catalogue cross-match',
  literature: 'Literature',
};
export const evidenceKindLabel = (k: Candidate['evidence'][number]['kind']) => EVIDENCE_KIND[k];
