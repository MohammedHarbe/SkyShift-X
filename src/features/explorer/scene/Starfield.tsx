import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { createPointsMaterial } from '../materials';
import { hash01 } from '../scale';

const SHELL_RADIUS = 4000;

function starGeometry(count: number, salt: number): THREE.BufferGeometry {
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const bright = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // Uniform points on a sphere.
    const u = hash01(`s${i}`, salt) * 2 - 1;
    const phi = hash01(`s${i}`, salt + 1) * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    pos[i * 3] = r * Math.cos(phi) * SHELL_RADIUS;
    pos[i * 3 + 1] = u * SHELL_RADIUS;
    pos[i * 3 + 2] = r * Math.sin(phi) * SHELL_RADIUS;
    const m = hash01(`s${i}`, salt + 2);
    size[i] = 1.1 + 2.2 * m * m * m; // few bright stars, many faint ones
    bright[i] = 0.3 + 0.7 * hash01(`s${i}`, salt + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aBright', new THREE.BufferAttribute(bright, 1));
  return g;
}

/** Decorative background stars (not a real star catalogue). The shell follows the camera so it feels infinitely far. */
export function Starfield({ count }: { count: number }) {
  const group = useRef<THREE.Group>(null);
  const cool = useMemo(() => ({ geometry: starGeometry(Math.round(count * 0.8), 11), material: createPointsMaterial({ color: '#d6e6ff', attenuate: false, opacity: 0.9 }) }), [count]);
  const warm = useMemo(() => ({ geometry: starGeometry(Math.round(count * 0.2), 23), material: createPointsMaterial({ color: '#ffe9cf', attenuate: false, opacity: 0.9 }) }), [count]);

  useEffect(
    () => () => {
      for (const s of [cool, warm]) {
        s.geometry.dispose();
        s.material.dispose();
      }
    },
    [cool, warm],
  );

  useFrame(({ camera, gl }) => {
    group.current?.position.copy(camera.position);
    const pr = gl.getPixelRatio();
    cool.material.uniforms.uPixelRatio!.value = pr;
    warm.material.uniforms.uPixelRatio!.value = pr;
  });

  return (
    <group ref={group}>
      <points geometry={cool.geometry} material={cool.material} frustumCulled={false} />
      <points geometry={warm.geometry} material={warm.material} frustumCulled={false} />
    </group>
  );
}
