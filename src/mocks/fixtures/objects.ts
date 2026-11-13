import type { z } from 'zod';
import type { SolarSystemObject } from '@/contracts/v1';

type Obj = z.input<typeof SolarSystemObject>;

const SCALE_NOTE =
  'Not to scale: distances are compressed and sizes exaggerated so everything fits in one view. Positions along orbits are illustrative, not an ephemeris.';

function planet(
  id: string,
  name: string,
  style: Obj['visual']['style'],
  color: string,
  orbit: [a: number, e: number, i: number, p: number],
  radiusKm: number,
  tagline: string,
  summary: string,
  detail: string,
  extraFacts: Obj['facts'] = [],
  extra: Partial<Obj> = {},
): Obj {
  const [a, e, i, p] = orbit;
  return {
    id,
    name,
    kind: 'planet',
    status: 'confirmed',
    epistemicStatus: 'established',
    tagline,
    summary,
    detail,
    orbit: { semiMajorAxisAu: a, eccentricity: e, inclinationDeg: i, periodYears: p, approximate: true },
    meanRadiusKm: radiusKm,
    facts: [
      { label: 'Average distance from the Sun', value: `${a} AU`, epistemicStatus: 'established', sourceIds: ['src-jpl-planets'] },
      { label: 'Orbital period', value: p < 2 ? `${Math.round(p * 365.25)} days` : `${p} years`, epistemicStatus: 'established', sourceIds: ['src-jpl-planets'] },
      { label: 'Mean radius', value: `${radiusKm.toLocaleString('en-US')} km`, epistemicStatus: 'established', sourceIds: ['src-jpl-planets'] },
      ...extraFacts,
    ],
    visual: { style, color, rings: false, disclaimer: SCALE_NOTE },
    sourceIds: ['src-jpl-planets'],
    ...extra,
  };
}

export const objects: Obj[] = [
  {
    id: 'sun',
    name: 'Sun',
    kind: 'star',
    status: 'confirmed',
    epistemicStatus: 'established',
    tagline: 'The star everything here orbits',
    summary:
      'The Sun holds more than 99% of the mass of the solar system. Its gravity keeps every planet, comet and icy body in orbit, out to distances far beyond Neptune.',
    detail:
      'Reflected sunlight is what makes distant solar-system bodies visible at all. Because sunlight spreads out on the way there and again on the way back, brightness falls very steeply with distance, which is why far-off objects are so hard to find.',
    meanRadiusKm: 695700,
    facts: [
      { label: 'Type', value: 'G-type main-sequence star', epistemicStatus: 'established', sourceIds: [] },
      { label: 'Mean radius', value: '695,700 km', epistemicStatus: 'established', sourceIds: ['src-jpl-planets'] },
    ],
    visual: { style: 'sun', color: '#ffd9a0', accentColor: '#ff9d3c', rings: false, disclaimer: SCALE_NOTE },
    sourceIds: ['src-jpl-planets'],
  },
  planet('mercury', 'Mercury', 'rocky', '#9a8f86', [0.387, 0.206, 7.0, 0.241], 2440, 'The innermost planet',
    'A small, rocky world that races around the Sun in just 88 days.',
    'Mercury moves quickly across the sky; objects close to the Sun always do. Apparent speed is one of the simplest clues to distance.'),
  planet('venus', 'Venus', 'rocky', '#e2c48f', [0.723, 0.007, 3.4, 0.615], 6052, 'Earth\'s cloud-wrapped neighbour',
    'Nearly the same size as Earth, hidden under thick, reflective clouds.',
    'Venus is bright because it is close and its clouds reflect most of the sunlight that reaches them.'),
  planet('earth', 'Earth', 'rocky', '#4f8fdc', [1.0, 0.017, 0.0, 1.0], 6371, 'Our moving vantage point',
    'Every observation in SkyShift X is made from near Earth. Because Earth itself moves around the Sun, nearby objects appear to shift against the distant stars.',
    'Earth travels about 30 km every second. For bodies far beyond Neptune, most of their apparent drift across the sky over a few days is really a reflection of Earth\'s own motion.',
    [], { visual: { style: 'rocky', color: '#4f8fdc', accentColor: '#9fd6ff', rings: false, disclaimer: SCALE_NOTE } }),
  planet('mars', 'Mars', 'rocky', '#c96a4a', [1.524, 0.093, 1.85, 1.881], 3390, 'The red planet',
    'A cold desert world about half the diameter of Earth.',
    'Between Mars and Jupiter lies the main asteroid belt, the source of most moving objects seen in survey images.'),
  planet('jupiter', 'Jupiter', 'gas-giant', '#d9b48a', [5.203, 0.048, 1.3, 11.86], 69911, 'The giant',
    'The largest planet, more massive than all the others combined.',
    'Jupiter\'s gravity shapes the orbits of asteroids and comets throughout the solar system.',
    [], { visual: { style: 'gas-giant', color: '#d9b48a', accentColor: '#a8744e', rings: false, disclaimer: SCALE_NOTE } }),
  planet('saturn', 'Saturn', 'gas-giant', '#e6cf9c', [9.537, 0.054, 2.49, 29.45], 58232, 'The ringed planet',
    'A gas giant circled by bright rings of ice and rock.',
    'Saturn takes almost thirty years to orbit the Sun, so it creeps slowly through the constellations.',
    [], { visual: { style: 'gas-giant', color: '#e6cf9c', accentColor: '#bfa36a', rings: true, disclaimer: SCALE_NOTE } }),
  planet('uranus', 'Uranus', 'ice-giant', '#9fe0e6', [19.19, 0.047, 0.77, 84.02], 25362, 'The tilted ice giant',
    'An ice giant that orbits the Sun tipped on its side.',
    'Small unexplained deviations in the motion of Uranus led astronomers to predict another planet beyond it. That planet was Neptune.',
    [], { visual: { style: 'ice-giant', color: '#9fe0e6', accentColor: '#d6fbff', rings: false, disclaimer: SCALE_NOTE } }),
  planet('neptune', 'Neptune', 'ice-giant', '#3f6fe0', [30.07, 0.009, 1.77, 164.8], 24622, 'The planet found by prediction',
    'Neptune is the most distant known planet, about thirty times farther from the Sun than Earth. Sunlight takes roughly four hours to reach it.',
    'Neptune was first observed in 1846, at a position calculated from irregularities in the motion of Uranus. It is the classic example of finding a world by its gravitational influence before seeing it, and the historical inspiration for searches for more distant planets. Only one spacecraft, Voyager 2, has visited (1989). Its largest moon, Triton, orbits in the opposite direction to the planet\'s spin.',
    [
      { label: 'First observed', value: '1846, at a predicted position', epistemicStatus: 'established', sourceIds: ['src-nasa-neptune'] },
      { label: 'Spacecraft visits', value: 'Voyager 2 flyby, 1989', epistemicStatus: 'established', sourceIds: ['src-nasa-neptune'] },
      { label: 'Light travel time from the Sun', value: 'about 4 hours', epistemicStatus: 'established', sourceIds: [] },
    ],
    {
      visual: { style: 'ice-giant', color: '#3f6fe0', accentColor: '#8fb6ff', rings: false, disclaimer: SCALE_NOTE },
      sourceIds: ['src-jpl-planets', 'src-nasa-neptune'],
      links: { journeyId: 'journey-moving-source' },
    }),
  {
    id: 'kuiper-belt',
    name: 'Kuiper Belt',
    kind: 'belt',
    status: 'confirmed',
    epistemicStatus: 'established',
    tagline: 'A ring of icy worlds beyond Neptune',
    summary:
      'Beyond Neptune lies a broad belt of small icy bodies left over from the formation of the solar system. Pluto is one of them.',
    detail:
      'Most of the belt lies roughly 30 to 50 AU from the Sun. Its members are faint and slow-moving, so they are found by comparing images of the same sky taken at different times, the same technique SkyShift X demonstrates.',
    facts: [
      { label: 'Main extent', value: 'roughly 30–50 AU', epistemicStatus: 'established', sourceIds: [] },
      { label: 'How members are found', value: 'By their motion between repeated images', epistemicStatus: 'established', sourceIds: [] },
    ],
    visual: {
      style: 'belt',
      color: '#9fc4e6',
      rings: false,
      disclaimer: 'The dots are an illustrative cloud, not individual catalogued objects. ' + SCALE_NOTE,
    },
    links: { timeExplorerRegionId: 'field-a' },
  },
  {
    id: 'pluto',
    name: 'Pluto',
    kind: 'dwarf-planet',
    status: 'confirmed',
    epistemicStatus: 'established',
    tagline: 'The best-known Kuiper Belt world',
    summary: 'A dwarf planet with a tilted, stretched orbit that sometimes brings it closer to the Sun than Neptune.',
    detail:
      'Pluto was discovered in 1930 by comparing photographic plates taken days apart and spotting the one dot that had moved, an early version of the comparison technique used in the Time Explorer.',
    orbit: { semiMajorAxisAu: 39.48, eccentricity: 0.249, inclinationDeg: 17.1, periodYears: 247.9, approximate: true },
    meanRadiusKm: 1188,
    facts: [
      { label: 'Average distance from the Sun', value: '39.5 AU', epistemicStatus: 'established', sourceIds: ['src-jpl-sbdb'] },
      { label: 'Orbital period', value: '248 years', epistemicStatus: 'established', sourceIds: ['src-jpl-sbdb'] },
      { label: 'Discovered', value: '1930, by blinking two photographic plates', epistemicStatus: 'established', sourceIds: [] },
    ],
    visual: { style: 'icy-body', color: '#d8c3a5', rings: false, disclaimer: SCALE_NOTE },
    sourceIds: ['src-jpl-sbdb'],
  },
  {
    id: 'eris',
    name: 'Eris',
    kind: 'dwarf-planet',
    status: 'confirmed',
    epistemicStatus: 'established',
    tagline: 'A distant dwarf planet nearly the size of Pluto',
    summary: 'Eris follows a steeply tilted orbit that carries it far beyond the main Kuiper Belt.',
    detail: 'Its discovery in 2005, from images taken hours apart, showed that Pluto-sized bodies exist well beyond Pluto.',
    orbit: { semiMajorAxisAu: 67.9, eccentricity: 0.44, inclinationDeg: 44.0, periodYears: 559, approximate: true },
    meanRadiusKm: 1163,
    facts: [
      { label: 'Average distance from the Sun', value: 'about 68 AU', epistemicStatus: 'established', sourceIds: ['src-jpl-sbdb'] },
      { label: 'Orbital period', value: 'about 560 years', epistemicStatus: 'established', sourceIds: ['src-jpl-sbdb'] },
    ],
    visual: { style: 'icy-body', color: '#e8e6e0', rings: false, disclaimer: SCALE_NOTE },
    sourceIds: ['src-jpl-sbdb'],
  },
  {
    id: 'sedna',
    name: 'Sedna',
    kind: 'dwarf-planet',
    status: 'confirmed',
    epistemicStatus: 'established',
    tagline: 'An icy body on an extremely stretched orbit',
    summary:
      'Sedna never comes closer to the Sun than about 76 AU and swings out to many hundreds of AU. One orbit takes more than ten thousand years.',
    detail:
      'Sedna and a handful of similar bodies are too far from Neptune for it to have shaped their orbits. How they got there is an open question, and one of the motivations for the Planet Nine hypothesis.',
    orbit: { semiMajorAxisAu: 506, eccentricity: 0.85, inclinationDeg: 11.9, periodYears: 11400, approximate: true },
    meanRadiusKm: 500,
    facts: [
      { label: 'Closest approach to the Sun', value: 'about 76 AU', epistemicStatus: 'established', sourceIds: ['src-jpl-sbdb'] },
      { label: 'Orbital period', value: 'roughly 11,000 years', epistemicStatus: 'established', sourceIds: ['src-jpl-sbdb'] },
      { label: 'Why its orbit is so detached', value: 'Unknown; several explanations proposed', epistemicStatus: 'hypothesis', sourceIds: ['src-batygin-brown-2016'] },
    ],
    visual: { style: 'icy-body', color: '#c9735a', rings: false, disclaimer: SCALE_NOTE },
    sourceIds: ['src-jpl-sbdb'],
  },
  {
    id: 'spherex',
    name: 'SPHEREx',
    kind: 'spacecraft',
    status: 'confirmed',
    epistemicStatus: 'established',
    tagline: 'NASA\'s all-sky infrared spectral survey',
    summary:
      'SPHEREx is a NASA space telescope, launched in March 2025, that maps the entire sky in infrared light. Instead of a single picture, it measures each patch of sky at about a hundred different wavelengths.',
    detail:
      'SPHEREx covers 0.75–5.0 µm with six detector bands. Each exposure images a given position at one wavelength, and the same position is imaged again on many later dates. That repeated coverage is what makes it possible to ask how the sky changes over time. Data are public at the NASA/IPAC Infrared Science Archive.',
    parentId: 'earth',
    facts: [
      { label: 'Launched', value: 'March 2025', epistemicStatus: 'established', sourceIds: ['src-irsa-cutouts'] },
      { label: 'Wavelength coverage', value: '0.75–5.0 µm in six detector bands', epistemicStatus: 'established', sourceIds: ['src-irsa-spherex'] },
      { label: 'Sky coverage (planned)', value: '100% of the sky', epistemicStatus: 'established', sourceIds: ['src-irsa-spherex'] },
      { label: 'Planned lifetime', value: '2025–2027', epistemicStatus: 'established', sourceIds: ['src-irsa-spherex'] },
      { label: 'Data archive', value: 'IRSA (public)', epistemicStatus: 'established', sourceIds: ['src-irsa-spherex'] },
    ],
    visual: {
      style: 'spacecraft',
      color: '#dfe9f5',
      accentColor: '#7fe3ff',
      rings: false,
      disclaimer:
        'Stylised educational model built from simple shapes, greatly enlarged and placed beside Earth for visibility. It is not an engineering model.',
    },
    links: { timeExplorerRegionId: 'field-a' },
    sourceIds: ['src-irsa-spherex', 'src-spherex-home'],
  },
  {
    id: 'planet-nine-region',
    name: 'Planet Nine search region',
    kind: 'region',
    status: 'hypothetical',
    epistemicStatus: 'hypothesis',
    tagline: 'A hypothesis, not a discovery',
    summary:
      'Some astronomers have proposed that an unseen planet, several times the mass of Earth, orbits far beyond Neptune. The idea was put forward to explain why the orbits of a few very distant icy bodies appear to line up. No such planet has been observed.',
    detail:
      'The hypothesis is debated. Other researchers argue that the apparent alignment could be produced by where and when surveys happened to look. If the planet exists it would be extremely faint and slow-moving, so finding it would mean comparing images of the same sky taken at different times and ruling out every ordinary explanation first.',
    facts: [
      { label: 'Status', value: 'Unconfirmed hypothesis', epistemicStatus: 'hypothesis', sourceIds: ['src-batygin-brown-2016'] },
      { label: 'Proposed in', value: '2016 (Batygin & Brown)', epistemicStatus: 'established', sourceIds: ['src-batygin-brown-2016'] },
      { label: 'Proposed distance', value: 'Hundreds of AU; model-dependent', epistemicStatus: 'hypothesis', sourceIds: ['src-batygin-brown-2016'] },
      { label: 'Observed?', value: 'No', epistemicStatus: 'established', sourceIds: [] },
    ],
    visual: {
      style: 'search-region',
      color: '#7fe3ff',
      rings: false,
      disclaimer:
        'The glowing band marks no measured position. It is an illustrative stand-in for "somewhere far beyond the Kuiper Belt". No orbit is drawn because none is known.',
    },
    links: { timeExplorerRegionId: 'field-a', journeyId: 'journey-moving-source' },
    sourceIds: ['src-batygin-brown-2016'],
  },
];
