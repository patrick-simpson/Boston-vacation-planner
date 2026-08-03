import * as THREE from 'three';
import { WORLD_RADIUS } from './Environment.js';

const TYPES = {
  wolf: {
    hp: 34, speed: 6.6, damage: 8, radius: 0.75, height: 1.4,
    attackRange: 1.7, attackRate: 1.1, scrap: [3, 6], preferFire: 0.1,
    roarChance: 0.25,
  },
  bear: {
    hp: 130, speed: 4.3, damage: 17, radius: 1.25, height: 2.2,
    attackRange: 2.3, attackRate: 0.8, scrap: [7, 12], preferFire: 0.35,
    roarChance: 0.5,
  },
  goliath: {
    hp: 620, speed: 2.5, damage: 34, radius: 2.0, height: 3.6,
    attackRange: 3.1, attackRate: 0.55, scrap: [38, 55], preferFire: 0.75,
    roarChance: 1.0,
  },
};

const INTERMISSION = 12;
const MAX_RAGDOLL_PARTS = 60;

// ---------------------------------------------------------------- model builders

function wolfModel() {
  const fur = new THREE.MeshStandardMaterial({ color: 0x8a95a3, roughness: 0.95, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x4a525e, roughness: 0.95 });
  const g = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 1.3), fur);
  body.position.y = 0.72;
  g.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.45), fur);
  head.position.set(0, 0.95, -0.8);
  g.add(head);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.3), dark);
  snout.position.set(0, 0.88, -1.1);
  g.add(snout);
  const earGeo = new THREE.ConeGeometry(0.09, 0.2, 4);
  const earL = new THREE.Mesh(earGeo, dark);
  earL.position.set(-0.13, 1.2, -0.75);
  const earR = earL.clone();
  earR.position.x = 0.13;
  g.add(earL, earR);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x9adfff });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), eyeMat);
  eyeL.position.set(-0.11, 1.0, -1.0);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.11;
  g.add(eyeL, eyeR);

  const legs = [];
  const legGeo = new THREE.BoxGeometry(0.14, 0.6, 0.14);
  for (const [x, z] of [[-0.2, -0.45], [0.2, -0.45], [-0.2, 0.45], [0.2, 0.45]]) {
    const leg = new THREE.Mesh(legGeo, fur);
    leg.position.set(x, 0.3, z);
    g.add(leg);
    legs.push(leg);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.5), fur);
  tail.position.set(0, 0.85, 0.85);
  tail.rotation.x = 0.5;
  g.add(tail);

  return { group: g, legs, head };
}

function bearModel() {
  const fur = new THREE.MeshStandardMaterial({ color: 0xf2f2ec, roughness: 0.95, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.9 });
  const g = new THREE.Group();

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 8), fur);
  body.scale.set(1, 0.9, 1.35);
  body.position.y = 1.1;
  g.add(body);

  const hump = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 7), fur);
  hump.position.set(0, 1.55, 0.3);
  g.add(hump);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 9, 8), fur);
  head.position.set(0, 1.45, -1.15);
  g.add(head);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.2, 7, 6), fur);
  snout.position.set(0, 1.35, -1.5);
  g.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), dark);
  nose.position.set(0, 1.37, -1.66);
  g.add(nose);
  const earGeo = new THREE.SphereGeometry(0.12, 6, 5);
  const earL = new THREE.Mesh(earGeo, fur);
  earL.position.set(-0.28, 1.78, -1.05);
  const earR = earL.clone();
  earR.position.x = 0.28;
  g.add(earL, earR);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x18181c });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), eyeMat);
  eyeL.position.set(-0.18, 1.52, -1.45);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.18;
  g.add(eyeL, eyeR);

  const legs = [];
  const legGeo = new THREE.CylinderGeometry(0.2, 0.24, 0.9, 7);
  for (const [x, z] of [[-0.5, -0.6], [0.5, -0.6], [-0.5, 0.7], [0.5, 0.7]]) {
    const leg = new THREE.Mesh(legGeo, fur);
    leg.position.set(x, 0.45, z);
    g.add(leg);
    legs.push(leg);
  }
  return { group: g, legs, head };
}

function goliathModel() {
  const ice = new THREE.MeshPhysicalMaterial({
    color: 0xa8dcf5, roughness: 0.15, metalness: 0.1, flatShading: true,
    transparent: true, opacity: 0.92, emissive: 0x0a3a55, emissiveIntensity: 0.4,
  });
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x66d9ff });
  const g = new THREE.Group();

  const torso = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 0), ice);
  torso.scale.set(1, 1.35, 0.8);
  torso.position.y = 2.2;
  g.add(torso);

  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.4), coreMat);
  core.position.set(0, 2.2, -0.5);
  g.add(core);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), ice);
  head.position.y = 3.6;
  g.add(head);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xbff1ff });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), eyeMat);
  eyeL.position.set(-0.18, 3.65, -0.42);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.18;
  g.add(eyeL, eyeR);

  const legs = [];
  const armGeo = new THREE.IcosahedronGeometry(0.5, 0);
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(armGeo, ice);
    shoulder.position.set(side * 1.35, 2.9, 0);
    g.add(shoulder);
    const fist = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 0), ice);
    fist.position.set(side * 1.55, 1.2, -0.3);
    g.add(fist);
    legs.push(fist); // fists swing like legs while walking

    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 1.3, 6), ice);
    leg.position.set(side * 0.55, 0.65, 0);
    g.add(leg);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, legs, head, core };
}

const BUILDERS = { wolf: wolfModel, bear: bearModel, goliath: goliathModel };

// ---------------------------------------------------------------- manager

export class EnemyManager {
  constructor(game) {
    this.game = game;
    this.enemies = [];
    this.ragdolls = [];
    this.pickups = [];
    this.wave = 0;
    this.phase = 'intermission'; // 'intermission' | 'active'
    this.phaseT = 5; // shorter first countdown
    this.spawnQueue = [];
    this.spawnT = 0;
    this.kills = 0;

    this._v1 = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
  }

  // ------------------------------------------------------------ waves

  _composeWave(n) {
    const q = [];
    const wolves = 3 + Math.ceil(n * 1.4);
    const bears = n >= 2 ? Math.floor((n - 1) * 0.9) : 0;
    const goliaths = n % 4 === 0 ? Math.max(1, Math.floor(n / 8)) : 0;
    for (let i = 0; i < wolves; i++) q.push('wolf');
    for (let i = 0; i < bears; i++) q.push('bear');
    for (let i = 0; i < goliaths; i++) q.push('goliath');
    // shuffle so spawn order feels organic
    for (let i = q.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
    return q;
  }

  _startWave() {
    this.wave++;
    this.phase = 'active';
    this.spawnQueue = this._composeWave(this.wave);
    this.spawnT = 0;
    this.game.audio.waveHorn();
    this.game.hud.announceWave(this.wave);
    if (this.wave % 4 === 0) {
      this.game.hud.toast('⚠ Something enormous approaches...', 'warn');
    }
  }

  _spawnEnemy(type) {
    const t = TYPES[type];
    const n = this.wave;
    const hpMul = 1 + (n - 1) * 0.16;
    const dmgMul = 1 + (n - 1) * 0.07;
    const spdMul = Math.min(1.45, 1 + (n - 1) * 0.022);

    const a = Math.random() * Math.PI * 2;
    const r = WORLD_RADIUS - 2 - Math.random() * 4;
    const model = BUILDERS[type]();
    model.group.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    this.game.sceneM.scene.add(model.group);

    const e = {
      type, t,
      group: model.group,
      legs: model.legs,
      head: model.head,
      core: model.core ?? null,
      pos: model.group.position,
      hp: t.hp * hpMul,
      maxHp: t.hp * hpMul,
      damage: t.damage * dmgMul,
      speed: t.speed * spdMul * (0.9 + Math.random() * 0.2),
      radius: t.radius,
      height: t.height,
      attackCd: 0,
      lungeT: 0,
      burnT: 0,
      burnDps: 0,
      walkT: Math.random() * 10,
      prefersFire: Math.random() < t.preferFire,
      facing: a + Math.PI,
      alive: true,
    };
    this.enemies.push(e);
    if (Math.random() < t.roarChance) this.game.audio.roar(type);

    // spawn puff
    this.game.particles.soft.emit({
      pos: e.pos.clone().setY(0.5), count: 12, color: 0xeaf4ff, alpha: 0.6,
      spread: t.radius * 0.7, velRand: 2, size: 0.5, life: 0.7, growth: 1.2,
    });
  }

  // ------------------------------------------------------------ combat queries

  /** first living enemy whose cylinder intersects point (used by projectiles) */
  queryHit(point, r) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = point.x - e.pos.x, dz = point.z - e.pos.z;
      const rr = e.radius + r;
      if (dx * dx + dz * dz < rr * rr && point.y >= 0 && point.y <= e.height) return e;
    }
    return null;
  }

  /** flamethrower cone: damage everything in range/angle, apply burn */
  coneDamage(origin, dir, range, halfAngle, dmg, ignite) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      this._v1.subVectors(e.pos, origin).setY(0);
      const dist = this._v1.length();
      if (dist > range + e.radius) continue;
      this._v1.normalize();
      const dot = this._v1.x * dir.x + this._v1.z * dir.z;
      if (dist > e.radius && dot < Math.cos(halfAngle)) continue;
      this.damage(e, dmg, e.pos.clone().setY(1), true);
      if (ignite) {
        e.burnT = Math.max(e.burnT, 2.0);
        e.burnDps = 12 * this.game.weapons.dmgMul('flamer');
      }
    }
  }

  damage(e, dmg, point, isFire) {
    if (!e.alive) return;
    e.hp -= dmg;

    // splatter: red for beasts, ice shards for goliath
    const isIce = e.type === 'goliath';
    const pool = isIce ? this.game.particles.glow : this.game.particles.soft;
    if (!isFire || Math.random() < 0.25) {
      pool.emit({
        pos: point, count: isFire ? 2 : 6,
        color: isIce ? 0xbfeaff : 0xb3202a,
        color2: isIce ? 0xffffff : 0x6e0f16,
        spread: 0.2, velRand: 3, size: 0.15, life: 0.5, gravity: 8,
      });
    }
    if (e.hp <= 0) this._kill(e);
  }

  _kill(e) {
    e.alive = false;
    this.kills++;
    this.game.stats.kills++;
    this.game.audio.enemyDie(e.type);
    if (e.type === 'goliath') this.game.sceneM.addShake(0.6);
    this._ragdoll(e);
    this._dropLoot(e);
    this.game.sceneM.scene.remove(e.group);
    const i = this.enemies.indexOf(e);
    if (i >= 0) this.enemies.splice(i, 1);
  }

  // ------------------------------------------------------------ ragdoll & loot

  _ragdoll(e) {
    // fling the enemy's own parts outward — a cheap but satisfying "ragdoll"
    let budget = MAX_RAGDOLL_PARTS - this.ragdolls.length;
    if (budget <= 0) return;
    const parts = [...e.group.children];
    for (const part of parts) {
      if (budget-- <= 0) break;
      if (!part.isMesh) continue;
      const world = part.getWorldPosition(new THREE.Vector3());
      const worldQ = part.getWorldQuaternion(new THREE.Quaternion());
      e.group.remove(part);
      part.position.copy(world);
      part.quaternion.copy(worldQ);
      part.material = part.material.clone();
      part.material.transparent = true;
      this.game.sceneM.scene.add(part);
      this.ragdolls.push({
        mesh: part,
        vel: new THREE.Vector3((Math.random() - 0.5) * 6, 3 + Math.random() * 4, (Math.random() - 0.5) * 6),
        spin: new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10),
        life: 1.5,
      });
    }
  }

  _dropLoot(e) {
    const [lo, hi] = e.t.scrap;
    const scrap = lo + Math.floor(Math.random() * (hi - lo + 1));
    this._spawnPickup(e.pos, 'scrap', scrap, 0xffc94d);
    if (Math.random() < 0.3) this._spawnPickup(e.pos, 'wood', 1, 0x8a5a30);
    if (Math.random() < 0.24) this._spawnPickup(e.pos, 'ammo', 0, 0x7fd0ff);
    if (Math.random() < 0.09) this._spawnPickup(e.pos, 'medkit', 30, 0xff5e6a);
    if (this.game.weapons.state.flamer.unlocked && Math.random() < 0.2) {
      this._spawnPickup(e.pos, 'fuel', 30, 0xff8a3d);
    }
  }

  _spawnPickup(pos, type, value, color) {
    const geo = type === 'scrap'
      ? new THREE.OctahedronGeometry(0.22)
      : type === 'medkit'
        ? new THREE.BoxGeometry(0.34, 0.34, 0.34)
        : new THREE.IcosahedronGeometry(0.22, 0);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.55, roughness: 0.4,
    }));
    mesh.position.copy(pos).setY(0.5);
    mesh.position.x += (Math.random() - 0.5) * 1.2;
    mesh.position.z += (Math.random() - 0.5) * 1.2;
    this.game.sceneM.scene.add(mesh);
    this.pickups.push({ mesh, type, value, t: Math.random() * 10, life: 25 });
  }

  _collectPickup(p) {
    const game = this.game;
    const player = game.player;
    switch (p.type) {
      case 'scrap':
        player.scrap += p.value;
        game.stats.scrapEarned += p.value;
        game.hud.toast(`+${p.value} ⚙️`, 'good');
        break;
      case 'wood':
        player.wood += p.value;
        game.hud.toast('+1 🪵', 'good');
        break;
      case 'medkit':
        player.hp = Math.min(player.maxHp, player.hp + p.value);
        game.hud.toast('+30 ♥', 'good');
        break;
      case 'ammo': {
        game.weapons.addAmmo('rifle', 45);
        if (game.weapons.state.shotgun.unlocked) game.weapons.addAmmo('shotgun', 8);
        game.hud.toast('+ ammo', 'good');
        break;
      }
      case 'fuel':
        game.weapons.addAmmo('flamer', p.value);
        game.hud.toast('+ fuel', 'good');
        break;
    }
    game.audio.pickup();
  }

  // ------------------------------------------------------------ frame update

  update(dt) {
    const game = this.game;
    const player = game.player;

    // ---- wave state machine ----
    if (this.phase === 'intermission') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this._startWave();
    } else {
      if (this.spawnQueue.length > 0) {
        this.spawnT -= dt;
        if (this.spawnT <= 0) {
          const burst = Math.min(this.spawnQueue.length, 1 + Math.floor(Math.random() * 2));
          for (let i = 0; i < burst; i++) this._spawnEnemy(this.spawnQueue.pop());
          this.spawnT = 0.9 + Math.random() * 0.8;
        }
      } else if (this.enemies.length === 0) {
        // wave cleared
        this.phase = 'intermission';
        this.phaseT = INTERMISSION;
        game.stats.waves = this.wave;
        const bonus = 10 + this.wave * 5;
        player.scrap += bonus;
        game.stats.scrapEarned += bonus;
        game.hud.toast(`WAVE ${this.wave} CLEARED — +${bonus} ⚙️ bonus`, 'good');
        game.hud.refreshShop();
      }
    }

    // ---- enemy AI ----
    const firePos = game.env.firePos;
    for (const e of this.enemies) {
      // burn DoT
      if (e.burnT > 0) {
        e.burnT -= dt;
        this.damage(e, e.burnDps * dt, e.pos.clone().setY(e.height * 0.6), true);
        if (!e.alive) continue;
        if (Math.random() < 0.35) {
          game.particles.glow.emit({
            pos: e.pos.clone().setY(e.height * 0.5), count: 2, color: 0xff8a1e, color2: 0xffd27f,
            spread: e.radius * 0.5, vel: new THREE.Vector3(0, 2, 0), velRand: 0.6, size: 0.3, life: 0.4, growth: -0.3,
          });
        }
      }

      // pick target: player if close or preferred, else the campfire
      const distPlayer = e.pos.distanceTo(player.pos);
      let target = player.pos;
      let attackingFire = false;
      if (e.prefersFire && game.heat.fire > 0.05 && distPlayer > 7) {
        target = firePos;
        attackingFire = true;
      }
      const distTarget = attackingFire ? e.pos.distanceTo(firePos) : distPlayer;

      // steering: seek + separation
      this._v1.subVectors(target, e.pos).setY(0).normalize();
      for (const o of this.enemies) {
        if (o === e) continue;
        this._v2.subVectors(e.pos, o.pos).setY(0);
        const d = this._v2.length();
        const minD = e.radius + o.radius;
        if (d > 0.001 && d < minD * 1.4) {
          this._v1.addScaledVector(this._v2.normalize(), (minD * 1.4 - d) * 0.8);
        }
      }
      this._v1.normalize();

      const stopRange = (attackingFire ? 2.2 : e.t.attackRange) * 0.9;
      if (distTarget > stopRange) {
        e.pos.addScaledVector(this._v1, e.speed * dt);
        e.walkT += dt * e.speed * 1.6;
        const swing = Math.sin(e.walkT) * 0.45;
        if (e.legs) {
          for (let i = 0; i < e.legs.length; i++) {
            e.legs[i].rotation.x = i % 2 === 0 ? swing : -swing;
          }
        }
      }

      // face movement direction
      const targetYaw = Math.atan2(this._v1.x, this._v1.z);
      let dy = targetYaw - e.facing;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      e.facing += dy * Math.min(1, dt * 6);
      e.group.rotation.y = e.facing;

      // lunge animation on attack
      if (e.lungeT > 0) {
        e.lungeT -= dt;
        const k = Math.sin((1 - e.lungeT / 0.3) * Math.PI);
        e.group.scale.setScalar(1 + k * 0.12);
      } else {
        e.group.scale.setScalar(1);
      }

      // attack
      e.attackCd -= dt;
      if (e.attackCd <= 0) {
        if (!attackingFire && distPlayer < e.t.attackRange) {
          player.takeDamage(e.damage);
          e.attackCd = 1 / e.t.attackRate;
          e.lungeT = 0.3;
          if (Math.random() < 0.3) game.audio.roar(e.type);
        } else if (attackingFire && e.pos.distanceTo(firePos) < 2.6) {
          game.heat.damageFire(0.055);
          e.attackCd = 1 / e.t.attackRate;
          e.lungeT = 0.3;
          game.particles.soft.emit({
            pos: firePos.clone().setY(0.6), count: 5, color: 0x666c72, alpha: 0.4,
            spread: 0.4, velRand: 1.5, size: 0.4, life: 0.8, growth: 0.6,
          });
        }
      }

      if (e.core) e.core.rotation.y += dt * 2.5;
    }

    // ---- ragdoll parts ----
    for (let i = this.ragdolls.length - 1; i >= 0; i--) {
      const r = this.ragdolls[i];
      r.life -= dt;
      if (r.life <= 0) {
        this.game.sceneM.scene.remove(r.mesh);
        r.mesh.material.dispose();
        this.ragdolls.splice(i, 1);
        continue;
      }
      r.vel.y -= 14 * dt;
      r.mesh.position.addScaledVector(r.vel, dt);
      if (r.mesh.position.y < 0.1) {
        r.mesh.position.y = 0.1;
        r.vel.y *= -0.35;
        r.vel.x *= 0.7;
        r.vel.z *= 0.7;
      }
      r.mesh.rotation.x += r.spin.x * dt;
      r.mesh.rotation.y += r.spin.y * dt;
      r.mesh.rotation.z += r.spin.z * dt;
      r.mesh.material.opacity = Math.min(1, r.life * 1.6);
    }

    // ---- pickups: bob, magnet, collect, expire ----
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.t += dt;
      p.life -= dt;
      p.mesh.rotation.y += dt * 3;
      p.mesh.position.y = 0.5 + Math.sin(p.t * 4) * 0.12;

      const d = p.mesh.position.distanceTo(player.pos);
      if (d < 3.6) {
        this._v1.subVectors(player.pos, p.mesh.position).setY(0).normalize();
        p.mesh.position.addScaledVector(this._v1, dt * (10 - d * 2));
      }
      if (d < 1.1) {
        this._collectPickup(p);
        this.game.sceneM.scene.remove(p.mesh);
        this.pickups.splice(i, 1);
      } else if (p.life <= 0) {
        this.game.sceneM.scene.remove(p.mesh);
        this.pickups.splice(i, 1);
      }
    }
  }

  get remaining() {
    return this.enemies.length + this.spawnQueue.length;
  }

  reset() {
    for (const e of this.enemies) this.game.sceneM.scene.remove(e.group);
    for (const r of this.ragdolls) this.game.sceneM.scene.remove(r.mesh);
    for (const p of this.pickups) this.game.sceneM.scene.remove(p.mesh);
    this.enemies = [];
    this.ragdolls = [];
    this.pickups = [];
    this.spawnQueue = [];
    this.wave = 0;
    this.kills = 0;
    this.phase = 'intermission';
    this.phaseT = 5;
  }
}
