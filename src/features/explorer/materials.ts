/**
 * Procedural materials for the 3D explorer. No textures are downloaded: every surface is a small
 * shader, which keeps the bundle light and avoids any image-licensing questions.
 * All of it is illustrative. These are not maps of the real planets.
 */
import * as THREE from 'three';
import type { VisualStyle } from './model';

/** Cheap 3D value noise + fractal sum, shared by the shaders below. */
const NOISE_GLSL = /* glsl */ `
float hash31(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3(1, 0, 0)), f.x), mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), f.x), mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
float fbm(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return s;
}
`;

/** World-space varyings used by every lit surface. The Sun sits at the world origin. */
const SURFACE_VERT = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec3 vLocal;
void main() {
  vLocal = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPosW = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

interface SurfaceParams {
  bands: number;
  bandMix: number;
  noiseScale: number;
  noiseMix: number;
  turbulence: number;
  rim: number;
}

const SURFACE: Record<VisualStyle, SurfaceParams> = {
  rocky: { bands: 0, bandMix: 0, noiseScale: 3.4, noiseMix: 0.55, turbulence: 0, rim: 0.18 },
  'icy-body': { bands: 0, bandMix: 0, noiseScale: 4.2, noiseMix: 0.45, turbulence: 0, rim: 0.06 },
  'gas-giant': { bands: 8, bandMix: 0.7, noiseScale: 2.6, noiseMix: 0.22, turbulence: 0.16, rim: 0.3 },
  'ice-giant': { bands: 3, bandMix: 0.15, noiseScale: 1.6, noiseMix: 0.16, turbulence: 0.3, rim: 1.0 },
  // Styles below are not drawn with the surface shader; listed so the lookup is total.
  sun: { bands: 0, bandMix: 0, noiseScale: 4, noiseMix: 0.5, turbulence: 0, rim: 0 },
  belt: { bands: 0, bandMix: 0, noiseScale: 4, noiseMix: 0.5, turbulence: 0, rim: 0 },
  spacecraft: { bands: 0, bandMix: 0, noiseScale: 4, noiseMix: 0.5, turbulence: 0, rim: 0 },
  'search-region': { bands: 0, bandMix: 0, noiseScale: 4, noiseMix: 0.5, turbulence: 0, rim: 0 },
};

/** Sun-lit planet surface: latitude bands and/or mottling, soft terminator, atmospheric rim light. */
export function createPlanetMaterial(opts: { color: string; accent: string; style: VisualStyle; seed: number }): THREE.ShaderMaterial {
  const p = SURFACE[opts.style];
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(opts.color) },
      uAccent: { value: new THREE.Color(opts.accent) },
      uRimColor: { value: new THREE.Color(opts.accent).lerp(new THREE.Color('#ffffff'), 0.25) },
      uBands: { value: p.bands },
      uBandMix: { value: p.bandMix },
      uNoiseScale: { value: p.noiseScale },
      uNoiseMix: { value: p.noiseMix },
      uTurb: { value: p.turbulence },
      uRim: { value: p.rim },
      uSeed: { value: opts.seed },
    },
    vertexShader: SURFACE_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform vec3 uAccent; uniform vec3 uRimColor;
      uniform float uBands; uniform float uBandMix; uniform float uNoiseScale; uniform float uNoiseMix;
      uniform float uTurb; uniform float uRim; uniform float uSeed;
      varying vec3 vNormalW; varying vec3 vPosW; varying vec3 vLocal;
      ${NOISE_GLSL}
      void main() {
        vec3 N = normalize(vNormalW);
        vec3 L = normalize(-vPosW);                 // towards the Sun at the origin
        vec3 V = normalize(cameraPosition - vPosW);
        vec3 p = normalize(vLocal);
        float n = fbm(p * uNoiseScale + uSeed);
        float lat = p.y + uTurb * (n - 0.5);
        float band = smoothstep(0.15, 0.85, 0.5 + 0.5 * sin(lat * uBands * 3.14159 + uSeed));
        vec3 base = mix(uColor, uAccent, clamp(band * uBandMix + (n - 0.45) * uNoiseMix * 2.0, 0.0, 1.0));
        float ndl = dot(N, L);
        float light = smoothstep(-0.12, 0.55, ndl);
        vec3 col = base * (0.035 + 1.05 * light);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        col += uRimColor * fres * uRim * (0.12 + 0.88 * smoothstep(-0.3, 0.4, ndl));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

/** Soft additive halo just outside a planet's limb, brightest on the sunlit side. Drawn on back faces. */
export function createAtmosphereMaterial(color: string, strength: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
    vertexShader: SURFACE_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uStrength;
      varying vec3 vNormalW; varying vec3 vPosW; varying vec3 vLocal;
      void main() {
        vec3 N = normalize(vNormalW);
        vec3 L = normalize(-vPosW);
        vec3 V = normalize(cameraPosition - vPosW);
        // On back faces dot(N, V) runs from 0 at the shell's edge to negative towards the planet's limb.
        float glow = pow(smoothstep(0.0, 0.6, -dot(N, V)), 1.6);
        float lit = smoothstep(-0.45, 0.5, dot(N, L));
        gl_FragColor = vec4(uColor, glow * uStrength * (0.1 + 0.9 * lit));
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/** Self-luminous, gently mottled surface for the Sun. `uTime` is advanced by the scene. */
export function createSunMaterial(color: string, accent: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uAccent: { value: new THREE.Color(accent) }, uTime: { value: 0 } },
    vertexShader: SURFACE_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform vec3 uAccent; uniform float uTime;
      varying vec3 vNormalW; varying vec3 vPosW; varying vec3 vLocal;
      ${NOISE_GLSL}
      void main() {
        vec3 N = normalize(vNormalW);
        vec3 V = normalize(cameraPosition - vPosW);
        float n = fbm(normalize(vLocal) * 5.0 + vec3(0.0, uTime * 0.04, uTime * 0.03));
        vec3 col = mix(uAccent, uColor, smoothstep(0.25, 0.75, n)) * 1.3;
        col *= 0.88 + 0.22 * max(dot(N, V), 0.0);   // gentle limb darkening
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

/** Banded, semi-transparent ring system. Geometry is a RingGeometry in its local XY plane. */
export function createRingMaterial(color: string, inner: number, outer: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uInner: { value: inner }, uOuter: { value: outer } },
    vertexShader: SURFACE_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uInner; uniform float uOuter;
      varying vec3 vNormalW; varying vec3 vPosW; varying vec3 vLocal;
      ${NOISE_GLSL}
      void main() {
        float t = (length(vLocal.xy) - uInner) / (uOuter - uInner);
        float lanes = 0.45 + 0.55 * vnoise(vec3(t * 34.0, 0.5, 0.5));
        float gap = smoothstep(0.015, 0.05, abs(t - 0.62));          // a dark division, as in Saturn's rings
        float alpha = smoothstep(0.0, 0.06, t) * smoothstep(1.0, 0.9, t) * lanes * gap * 0.8;
        gl_FragColor = vec4(uColor * (0.55 + 0.5 * lanes), alpha);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });
}

/**
 * The Planet Nine SEARCH REGION haze. Deliberately un-physical: soft edges, drifting noise and a faint
 * diagonal hatch, so it reads as "a schematic zone" rather than an object or an orbit.
 */
export function createSearchRegionMaterial(color: string, inner: number, outer: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uInner: { value: inner },
      uOuter: { value: outer },
      uTime: { value: 0 },
      uIntensity: { value: 1 },
    },
    vertexShader: SURFACE_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uInner; uniform float uOuter; uniform float uTime; uniform float uIntensity;
      varying vec3 vNormalW; varying vec3 vPosW; varying vec3 vLocal;
      ${NOISE_GLSL}
      void main() {
        float u = (length(vLocal.xy) - uInner) / (uOuter - uInner);
        float ang = atan(vLocal.y, vLocal.x);
        float edge = smoothstep(0.0, 0.4, u) * smoothstep(1.0, 0.6, u);
        float n = fbm(vec3(cos(ang) * 2.6, sin(ang) * 2.6, u * 2.2 + uTime * 0.02));
        float hatch = 0.5 + 0.5 * sin(ang * 28.0 + u * 9.0);
        // A thin sheet seen edge-on would pile up into a bright streak; fade it instead so the haze stays soft.
        float facing = smoothstep(0.02, 0.4, abs(dot(normalize(vNormalW), normalize(cameraPosition - vPosW))));
        float alpha = edge * (0.03 + 0.12 * n + 0.012 * hatch) * uIntensity * facing;
        gl_FragColor = vec4(uColor, alpha);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/** Round, soft points with per-point size and brightness. Used for stars and the Kuiper Belt. */
export function createPointsMaterial(opts: { color: string; attenuate: boolean; opacity: number }): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(opts.color) },
      uOpacity: { value: opts.opacity },
      uPixelRatio: { value: 1 },
      uAttenuate: { value: opts.attenuate ? 1 : 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aBright;
      uniform float uPixelRatio; uniform float uAttenuate;
      varying float vBright;
      void main() {
        vBright = aBright;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float size = aSize * uPixelRatio;
        // Attenuated points shrink with distance but never vanish completely.
        gl_PointSize = mix(size, clamp(size * 90.0 / max(-mv.z, 0.001), 1.25, size * 1.7), uAttenuate);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity;
      varying float vBright;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.08, d) * uOpacity * vBright;
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/** Radial falloff sprite texture for glows, drawn once on a 2D canvas. */
export function createGlowTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.18, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.14)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
