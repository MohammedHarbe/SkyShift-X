import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { BodyModel } from '../model';
import { bodyRegistry, FRAME, registerBody, registerLabel, type BodyEntry } from '../registry';
import { SelectionMarker } from './SelectionMarker';
import { HIT_MATERIAL, selectHandlers, UNIT_SPHERE_LOW } from './shared';

/** Distance from Earth's centre at which the (hugely enlarged) spacecraft circles, in scene units. */
const ORBIT_RADIUS = 1.5;
/** Seconds of real time per lap. Purely for liveliness; unrelated to the true orbital period. */
const LAP_SECONDS = 60;

/** Nested open cones: the three photon shields that give SPHEREx its distinctive silhouette. */
const SHIELDS: { top: number; bottom: number; height: number; y: number }[] = [
  { top: 1.0, bottom: 0.46, height: 1.15, y: 0.42 },
  { top: 0.8, bottom: 0.4, height: 1.02, y: 0.36 },
  { top: 0.6, bottom: 0.34, height: 0.9, y: 0.3 },
];

/**
 * Stylised EDUCATIONAL model of the SPHEREx observatory built from primitives: photon shields,
 * telescope barrel, spacecraft bus and solar panel. It is enlarged enormously and parked beside
 * Earth so it can be seen; it is not an engineering model, and its orbit and attitude here are schematic.
 */
export function Spherex({ model }: { model: BodyModel }) {
  const group = useRef<THREE.Group>(null);
  const craft = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.LineLoop>(null);
  const s = model.radius;

  // Registered a little larger than the model so camera framings leave room around it.
  // The camera looks down into the nested shields, which is what makes the telescope recognisable.
  const entry = useMemo<BodyEntry>(() => ({ id: model.id, position: new THREE.Vector3(), radius: s * 1.5, cameraElevation: 0.95 }), [model.id, s]);
  useEffect(() => registerBody(entry), [entry]);
  useEffect(() => registerLabel({ id: model.id, position: entry.position, lift: s * 1.25 + 0.1, maxDistance: 75 }), [entry, model.id, s]);

  const tmp = useMemo(() => ({ offset: new THREE.Vector3(), tilt: new THREE.Quaternion().setFromEuler(new THREE.Euler(1.05, 0, 0.35)) }), []);

  const ringGeometry = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * ORBIT_RADIUS, 0, Math.sin(a) * ORBIT_RADIUS).applyQuaternion(tmp.tilt));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [tmp]);
  const ringMaterial = useMemo(() => new THREE.LineBasicMaterial({ color: model.accent, transparent: true, opacity: 0.3, depthWrite: false }), [model.accent]);
  const shieldMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: model.color, metalness: 0.35, roughness: 0.45, side: THREE.DoubleSide, emissive: new THREE.Color(model.color), emissiveIntensity: 0.16 }),
    [model.color],
  );
  const darkMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3a4656', metalness: 0.5, roughness: 0.5, emissive: new THREE.Color('#1a2330'), emissiveIntensity: 0.6 }), []);
  const lipMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#f2f8ff', toneMapped: false }), []);
  const accentMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: model.accent, toneMapped: false }), [model.accent]);
  const panelMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1d3f78', metalness: 0.4, roughness: 0.35, emissive: new THREE.Color('#102850'), emissiveIntensity: 0.7 }), []);
  useEffect(
    () => () => {
      for (const d of [ringGeometry, ringMaterial, shieldMaterial, darkMaterial, lipMaterial, accentMaterial, panelMaterial]) d.dispose();
    },
    [ringGeometry, ringMaterial, shieldMaterial, darkMaterial, lipMaterial, accentMaterial, panelMaterial],
  );

  useFrame(({ clock }) => {
    const parent = model.parentId ? bodyRegistry.get(model.parentId) : undefined;
    const a = (clock.elapsedTime / LAP_SECONDS) * Math.PI * 2;
    tmp.offset.set(Math.cos(a) * ORBIT_RADIUS, 0, Math.sin(a) * ORBIT_RADIUS).applyQuaternion(tmp.tilt);
    if (parent) entry.position.copy(parent.position).add(tmp.offset);
    else entry.position.copy(tmp.offset);
    group.current?.position.copy(entry.position);
    if (parent) ringRef.current?.position.copy(parent.position);
    // Slow turn so the nested shields read clearly from any side.
    if (craft.current) craft.current.rotation.y = clock.elapsedTime * 0.12;
  }, FRAME.satellites);

  const handlers = useMemo(() => selectHandlers(model.id), [model.id]);

  return (
    <>
      <lineLoop ref={ringRef} geometry={ringGeometry} material={ringMaterial} frustumCulled={false} />
      <group ref={group}>
        <group rotation={[0.16, 0, -0.12]}>
          <group ref={craft} scale={s * 0.62}>
            {SHIELDS.map((c, i) => (
              <group key={i}>
                <mesh position={[0, c.y, 0]} material={shieldMaterial}>
                  <cylinderGeometry args={[c.top, c.bottom, c.height, 48, 1, true]} />
                </mesh>
                {/* Bright lip so the three nested shields read as separate shells */}
                <mesh position={[0, c.y + c.height / 2, 0]} rotation={[Math.PI / 2, 0, 0]} material={lipMaterial}>
                  <torusGeometry args={[c.top, 0.014, 6, 64]} />
                </mesh>
              </group>
            ))}
            {/* Telescope barrel with a glowing aperture ring */}
            <mesh position={[0, 0.22, 0]} material={darkMaterial}>
              <cylinderGeometry args={[0.24, 0.24, 0.8, 24]} />
            </mesh>
            <mesh position={[0, 0.63, 0]} rotation={[Math.PI / 2, 0, 0]} material={accentMaterial}>
              <torusGeometry args={[0.24, 0.03, 8, 40]} />
            </mesh>
            {/* Spacecraft bus */}
            <mesh position={[0, -0.36, 0]} material={darkMaterial}>
              <cylinderGeometry args={[0.44, 0.5, 0.4, 8]} />
            </mesh>
            {/* Solar panel */}
            <mesh position={[0, -0.6, 0]} material={panelMaterial}>
              <boxGeometry args={[1.5, 0.04, 0.9]} />
            </mesh>
          </group>
        </group>
        <mesh geometry={UNIT_SPHERE_LOW} material={HIT_MATERIAL} scale={Math.max(s * 1.8, 0.7)} userData={{ bodyId: model.id }} {...handlers} />
        <SelectionMarker id={model.id} radius={s * 1.1} position={entry.position} />
      </group>
    </>
  );
}
