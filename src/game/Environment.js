import * as THREE from 'three';

export const WORLD_RADIUS = 52;

// deterministic hash noise for terrain bumps
function noise2(x, z) {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}
function smoothNoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = noise2(xi, zi), b = noise2(xi + 1, zi);
  const c = noise2(xi, zi + 1), d = noise2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/**
 * Procedural arctic arena: snow terrain, pine trees (wood source), log piles,
 * breakable ice barriers, perimeter ice ridge, and the central campfire that
 * everything revolves around.
 */
export class Environment {
  constructor(game) {
    this.game = game;
    const scene = game.sceneM.scene;

    this.trees = [];
    this.woodPiles = [];
    this.barriers = [];
    this.firePos = new THREE.Vector3(0, 0, 0);

    this._buildTerrain(scene);
    this._buildPerimeter(scene);
    this._buildTrees(scene);
    this._buildWoodPiles(scene);
    this._buildBarriers(scene);
    this._buildCampfire(scene);

    this._fireTime = 0;
  }

  // ------------------------------------------------------------ terrain

  _buildTerrain(scene) {
    const size = 150, seg = 110;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const col = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const d = Math.hypot(x, z);
      // flat combat zone in the middle, rolling drifts toward the edge
      const edge = THREE.MathUtils.smoothstep(d, 18, 70);
      const h = (smoothNoise(x * 0.12, z * 0.12) * 1.6 + smoothNoise(x * 0.05, z * 0.05) * 3.2) * edge;
      pos.setY(i, h - 0.02);
      // subtle blue shading in dips makes the snow read as 3D
      const tint = 0.92 + smoothNoise(x * 0.5, z * 0.5) * 0.08;
      col.setRGB(tint * 0.96, tint * 0.99, 1.0 * tint);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0xf4f9ff,
      roughness: 0.92,
      metalness: 0.02,
      vertexColors: true,
    });
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    scene.add(ground);

    // scattered glossy ice patches
    const iceMat = new THREE.MeshStandardMaterial({
      color: 0xb8e4ff, roughness: 0.12, metalness: 0.4,
      transparent: true, opacity: 0.75,
    });
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 10 + Math.random() * 38;
      const ice = new THREE.Mesh(new THREE.CircleGeometry(1.8 + Math.random() * 2.6, 20), iceMat);
      ice.rotation.x = -Math.PI / 2;
      ice.position.set(Math.cos(a) * r, 0.02, Math.sin(a) * r);
      scene.add(ice);
    }
  }

  _buildPerimeter(scene) {
    // ring of jagged ice peaks that walls off the arena
    const mat = new THREE.MeshStandardMaterial({
      color: 0xcfe8f8, roughness: 0.35, metalness: 0.1, flatShading: true,
    });
    const peaks = new THREE.Group();
    const N = 42;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + Math.random() * 0.1;
      const r = WORLD_RADIUS + 5 + Math.random() * 8;
      const h = 8 + Math.random() * 14;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(3 + Math.random() * 4, h, 5), mat);
      cone.position.set(Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r);
      cone.rotation.y = Math.random() * Math.PI;
      cone.rotation.z = (Math.random() - 0.5) * 0.15;
      cone.castShadow = true;
      peaks.add(cone);
    }
    scene.add(peaks);
  }

  // ------------------------------------------------------------ trees & wood

  _buildTrees(scene) {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.95 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2c5545, roughness: 0.9, flatShading: true });
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xf0f7ff, roughness: 0.9, flatShading: true });

    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 13 + Math.random() * (WORLD_RADIUS - 16);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const s = 0.8 + Math.random() * 0.7;

      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.32 * s, 1.6 * s, 6), trunkMat);
      trunk.position.y = 0.8 * s;
      trunk.castShadow = true;
      g.add(trunk);

      const foliage = new THREE.Group();
      for (let l = 0; l < 3; l++) {
        const rad = (2.0 - l * 0.5) * s;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(rad, 1.9 * s, 7), leafMat);
        cone.position.y = (2.0 + l * 1.2) * s;
        cone.castShadow = true;
        foliage.add(cone);
        // snow cap on each tier
        const cap = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.75, 0.55 * s, 7), snowMat);
        cap.position.y = (2.6 + l * 1.2) * s;
        foliage.add(cap);
      }
      g.add(foliage);
      g.position.set(x, 0, z);
      g.rotation.y = Math.random() * Math.PI * 2;
      scene.add(g);

      this.trees.push({ group: g, foliage, pos: new THREE.Vector3(x, 0, z), wood: 4, alive: true, shakeT: 0 });
    }
  }

  _buildWoodPiles(scene) {
    const logMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.9 });
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 8 + Math.random() * 26;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const g = new THREE.Group();
      for (let l = 0; l < 4; l++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.6, 7), logMat);
        log.rotation.z = Math.PI / 2;
        log.rotation.y = Math.random() * 0.6;
        log.position.set((Math.random() - 0.5) * 0.4, 0.18 + Math.floor(l / 2) * 0.34, (Math.random() - 0.5) * 0.4);
        log.castShadow = true;
        g.add(log);
      }
      g.position.set(x, 0, z);
      scene.add(g);
      this.woodPiles.push({ group: g, pos: new THREE.Vector3(x, 0, z), wood: 6, alive: true });
    }
  }

  // ------------------------------------------------------------ ice barriers

  _buildBarriers(scene) {
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x9fd8ff, roughness: 0.12, metalness: 0.05,
      transparent: true, opacity: 0.55, transmission: 0.35, thickness: 1.2,
      emissive: 0x1a4a6a, emissiveIntensity: 0.25,
    });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      const r = 8.5 + (i % 2) * 4.5;
      const w = 3.2 + Math.random() * 1.6;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 2.1, 0.8), mat.clone());
      mesh.position.set(Math.cos(a) * r, 1.05, Math.sin(a) * r);
      mesh.rotation.y = -a + Math.PI / 2 + (Math.random() - 0.5) * 0.5;
      mesh.castShadow = true;
      scene.add(mesh);
      this.barriers.push({ mesh, pos: mesh.position, hp: 160, maxHp: 160, radius: w * 0.55, alive: true });
    }
  }

  // ------------------------------------------------------------ campfire

  _buildCampfire(scene) {
    const g = new THREE.Group();

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x7d8894, roughness: 0.85, flatShading: true });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32 + Math.random() * 0.12), stoneMat);
      stone.position.set(Math.cos(a) * 1.35, 0.18, Math.sin(a) * 1.35);
      stone.rotation.set(Math.random(), Math.random(), Math.random());
      stone.castShadow = true;
      g.add(stone);
    }

    const logMat = new THREE.MeshStandardMaterial({ color: 0x3d2417, roughness: 0.95 });
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.5, 6), logMat);
      log.rotation.z = Math.PI / 2 - 0.35;
      log.rotation.y = (i / 4) * Math.PI * 2;
      log.position.y = 0.32;
      log.castShadow = true;
      g.add(log);
    }

    // glowing ember core (bloom picks this up)
    this.emberMat = new THREE.MeshBasicMaterial({ color: 0xff6a1a });
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), this.emberMat);
    ember.position.y = 0.3;
    ember.scale.y = 0.5;
    g.add(ember);
    this.ember = ember;

    this.fireLight = new THREE.PointLight(0xff7733, 3.2, 34, 1.6);
    this.fireLight.position.set(0, 1.6, 0);
    // point-light shadows re-render the scene 6x — too costly on phones
    this.fireLight.castShadow = !this.game.sceneM.lowPower;
    this.fireLight.shadow.mapSize.set(512, 512);
    g.add(this.fireLight);

    scene.add(g);
    this.campfire = g;
  }

  // ------------------------------------------------------------ interactions

  /** nearest gatherable wood source within reach of pos, or null */
  nearestWoodSource(pos, reach = 3.0) {
    let best = null, bestD = reach;
    for (const t of this.trees) {
      if (!t.alive) continue;
      const d = pos.distanceTo(t.pos);
      if (d < bestD) { best = t; bestD = d; }
    }
    for (const p of this.woodPiles) {
      if (!p.alive) continue;
      const d = pos.distanceTo(p.pos);
      if (d < bestD) { best = p; bestD = d; }
    }
    return best;
  }

  gatherFrom(source) {
    source.wood--;
    if (source.foliage) source.shakeT = 0.35;
    const p = source.pos.clone().setY(1.2);
    this.game.particles.soft.emit({
      pos: p, count: 10, color: 0x8a6a48, color2: 0xd9c9a8,
      spread: 0.5, velRand: 1.6, size: 0.18, life: 0.6, gravity: 5,
    });
    if (source.wood <= 0) {
      source.alive = false;
      if (source.foliage) {
        source.foliage.visible = false; // tree becomes a bare trunk
      } else {
        source.group.visible = false;
      }
    }
  }

  /** Bullet/melee damage to ice barriers. Returns true if something was hit. */
  hitBarrier(point, dmg, radius = 0.4) {
    for (const b of this.barriers) {
      if (!b.alive) continue;
      const dx = point.x - b.pos.x, dz = point.z - b.pos.z;
      if (dx * dx + dz * dz < (b.radius + radius) ** 2 && point.y < 2.3) {
        b.hp -= dmg;
        this.game.particles.glow.emit({
          pos: point, count: 5, color: 0xbfeaff, color2: 0xffffff,
          spread: 0.2, velRand: 2.2, size: 0.14, life: 0.4, gravity: 6,
        });
        if (b.hp <= 0) this._shatterBarrier(b);
        return true;
      }
    }
    return false;
  }

  _shatterBarrier(b) {
    b.alive = false;
    b.mesh.visible = false;
    this.game.audio.barrierBreak();
    this.game.particles.glow.emit({
      pos: b.pos.clone().setY(1.1), count: 40, color: 0x9fd8ff, color2: 0xffffff,
      spread: b.radius * 0.8, velRand: 4.5, size: 0.22, life: 0.9, gravity: 9,
    });
  }

  // ------------------------------------------------------------ per-frame

  update(dt) {
    // campfire visuals scale with heat system's fire level
    const fire = this.game.heat.fire; // 0..1
    this._fireTime += dt;
    const flicker = 0.85 + Math.sin(this._fireTime * 11) * 0.08 + Math.sin(this._fireTime * 23.7) * 0.07 + Math.random() * 0.1;
    this.fireLight.intensity = (0.4 + fire * 3.4) * flicker;
    this.fireLight.distance = 12 + fire * 26;
    this.ember.scale.setScalar(0.4 + fire * 0.8);
    this.ember.scale.y *= 0.5;
    this.emberMat.color.setHSL(0.05, 1.0, 0.25 + fire * 0.35);

    // flame + spark + smoke emission
    if (fire > 0.02) {
      const p = this.firePos.clone().setY(0.45);
      this.game.particles.glow.emit({
        pos: p, count: Math.ceil(fire * 4), color: 0xff9a2e, color2: 0xffe08a,
        spread: 0.32 * (0.5 + fire), vel: new THREE.Vector3(0, 2.2 + fire * 1.6, 0), velRand: 0.5,
        size: 0.5 + fire * 0.45, sizeRand: 0.15, life: 0.55 + fire * 0.3, gravity: -1.5, drag: 1.2, growth: -0.5,
      });
      if (Math.random() < fire * 0.5) {
        this.game.particles.glow.emit({
          pos: p, count: 2, color: 0xffcf5e, spread: 0.2,
          vel: new THREE.Vector3(0, 4.5, 0), velRand: 1.4, size: 0.09, life: 1.1, gravity: 2.5,
        });
      }
      if (Math.random() < 0.4) {
        this.game.particles.soft.emit({
          pos: p.clone().setY(1.4 + fire), count: 1, color: 0x555c63, alpha: 0.3,
          vel: new THREE.Vector3(0.3, 1.6, 0.2), velRand: 0.3, size: 0.8, life: 2.4, gravity: -0.4, growth: 0.55,
        });
      }
    }

    // tree gather shake
    for (const t of this.trees) {
      if (t.shakeT > 0) {
        t.shakeT -= dt;
        t.group.rotation.z = Math.sin(t.shakeT * 40) * 0.05 * (t.shakeT / 0.35);
        if (t.shakeT <= 0) t.group.rotation.z = 0;
      }
    }
  }

  reset() {
    for (const t of this.trees) {
      t.wood = 4; t.alive = true; t.foliage.visible = true; t.group.visible = true;
    }
    for (const p of this.woodPiles) {
      p.wood = 6; p.alive = true; p.group.visible = true;
    }
    for (const b of this.barriers) {
      b.hp = b.maxHp; b.alive = true; b.mesh.visible = true;
    }
  }
}
