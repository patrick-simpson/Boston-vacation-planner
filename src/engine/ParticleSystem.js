import * as THREE from 'three';

// Soft radial sprite shared by every particle pool.
let spriteTexture = null;
function getSpriteTexture() {
  if (spriteTexture) return spriteTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  spriteTexture = new THREE.CanvasTexture(c);
  return spriteTexture;
}

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (280.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(vColor, vAlpha) * tex;
    if (gl_FragColor.a < 0.01) discard;
  }
`;

/**
 * CPU-simulated, GPU-drawn pooled particle system. One draw call per pool.
 * Uses swap-remove compaction so the draw range always covers live particles.
 */
export class ParticlePool {
  constructor(scene, capacity = 3000, blending = THREE.NormalBlending) {
    this.capacity = capacity;
    this.count = 0;

    this.positions = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.sizes = new Float32Array(capacity);
    this.alphas = new Float32Array(capacity);

    // simulation state (not uploaded to GPU)
    this.velocities = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.gravity = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.baseAlpha = new Float32Array(capacity);
    this.growth = new Float32Array(capacity);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    this.geometry = geo;

    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: getSpriteTexture() } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    this._color = new THREE.Color();
    this._color2 = new THREE.Color();
  }

  /**
   * Spawn particles.
   * opts: { pos, count, color, color2, spread, vel, velRand, size, sizeRand,
   *         life, lifeRand, gravity, drag, alpha, growth }
   */
  emit(opts) {
    const count = opts.count ?? 1;
    const pos = opts.pos;
    const spread = opts.spread ?? 0.1;
    const vel = opts.vel ?? null;
    const velRand = opts.velRand ?? 0.5;
    const size = opts.size ?? 0.5;
    const sizeRand = opts.sizeRand ?? 0.3;
    const life = opts.life ?? 1.0;
    const lifeRand = opts.lifeRand ?? 0.3;
    const gravity = opts.gravity ?? 0;
    const drag = opts.drag ?? 0;
    const alpha = opts.alpha ?? 1;
    const growth = opts.growth ?? 0;
    this._color.set(opts.color ?? 0xffffff);
    const hasC2 = opts.color2 !== undefined;
    if (hasC2) this._color2.set(opts.color2);

    for (let n = 0; n < count; n++) {
      if (this.count >= this.capacity) return; // pool exhausted; drop excess
      const i = this.count++;
      const i3 = i * 3;

      this.positions[i3] = pos.x + (Math.random() - 0.5) * 2 * spread;
      this.positions[i3 + 1] = pos.y + (Math.random() - 0.5) * 2 * spread;
      this.positions[i3 + 2] = pos.z + (Math.random() - 0.5) * 2 * spread;

      this.velocities[i3] = (vel ? vel.x : 0) + (Math.random() - 0.5) * 2 * velRand;
      this.velocities[i3 + 1] = (vel ? vel.y : 0) + (Math.random() - 0.5) * 2 * velRand;
      this.velocities[i3 + 2] = (vel ? vel.z : 0) + (Math.random() - 0.5) * 2 * velRand;

      let c = this._color;
      if (hasC2) {
        c = this._color.clone().lerp(this._color2, Math.random());
      }
      this.colors[i3] = c.r;
      this.colors[i3 + 1] = c.g;
      this.colors[i3 + 2] = c.b;

      this.sizes[i] = size + (Math.random() - 0.5) * 2 * sizeRand;
      const l = Math.max(0.05, life + (Math.random() - 0.5) * 2 * lifeRand);
      this.life[i] = l;
      this.maxLife[i] = l;
      this.gravity[i] = gravity;
      this.drag[i] = drag;
      this.baseAlpha[i] = alpha;
      this.alphas[i] = alpha;
      this.growth[i] = growth;
    }
  }

  _kill(i) {
    const last = this.count - 1;
    if (i !== last) {
      const i3 = i * 3, l3 = last * 3;
      for (let k = 0; k < 3; k++) {
        this.positions[i3 + k] = this.positions[l3 + k];
        this.velocities[i3 + k] = this.velocities[l3 + k];
        this.colors[i3 + k] = this.colors[l3 + k];
      }
      this.sizes[i] = this.sizes[last];
      this.alphas[i] = this.alphas[last];
      this.life[i] = this.life[last];
      this.maxLife[i] = this.maxLife[last];
      this.gravity[i] = this.gravity[last];
      this.drag[i] = this.drag[last];
      this.baseAlpha[i] = this.baseAlpha[last];
      this.growth[i] = this.growth[last];
    }
    this.count--;
  }

  update(dt) {
    let i = 0;
    while (i < this.count) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this._kill(i);
        continue; // re-process swapped-in particle at index i
      }
      const i3 = i * 3;
      this.velocities[i3 + 1] -= this.gravity[i] * dt;
      if (this.drag[i] > 0) {
        const d = Math.max(0, 1 - this.drag[i] * dt);
        this.velocities[i3] *= d;
        this.velocities[i3 + 1] *= d;
        this.velocities[i3 + 2] *= d;
      }
      this.positions[i3] += this.velocities[i3] * dt;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * dt;
      this.positions[i3 + 2] += this.velocities[i3 + 2] * dt;

      const t = this.life[i] / this.maxLife[i];
      this.alphas[i] = this.baseAlpha[i] * Math.min(1, t * 3); // fade out at end of life
      if (this.growth[i] !== 0) this.sizes[i] += this.growth[i] * dt;
      i++;
    }

    this.geometry.setDrawRange(0, this.count);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aColor.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
    this.geometry.attributes.aAlpha.needsUpdate = true;
  }

  clear() {
    this.count = 0;
    this.geometry.setDrawRange(0, 0);
  }
}

/** Convenience wrapper bundling an additive pool (fire/glow) and a normal pool (smoke/snow/blood). */
export class ParticleSystem {
  constructor(scene) {
    this.glow = new ParticlePool(scene, 3500, THREE.AdditiveBlending);
    this.soft = new ParticlePool(scene, 2500, THREE.NormalBlending);
  }
  update(dt) {
    this.glow.update(dt);
    this.soft.update(dt);
  }
  clear() {
    this.glow.clear();
    this.soft.clear();
  }
}
