import * as THREE from 'three';
import { WORLD_RADIUS } from './Environment.js';

const PROJECTILE_POOL = 90;

export const WEAPONS = {
  rifle: {
    name: 'Assault Rifle', key: '1', auto: true,
    damage: 13, rate: 7.5, spread: 0.035, speed: 55, projLife: 1.3,
    mag: 30, reserve: 150, maxReserve: 420, reload: 1.3,
    tracer: 0xffd27f, unlockCost: 0,
  },
  shotgun: {
    name: 'Spread Shotgun', key: '2', auto: false,
    damage: 8, pellets: 7, rate: 1.5, spread: 0.16, speed: 46, projLife: 0.55,
    mag: 6, reserve: 42, maxReserve: 140, reload: 1.9,
    tracer: 0xffb35e, unlockCost: 60,
  },
  flamer: {
    name: 'Flamethrower', key: '3', auto: true,
    dps: 46, range: 8.5, cone: 0.42, drain: 13,
    mag: 100, reserve: 0, maxReserve: 0, maxFuel: 100,
    tracer: 0xff7722, unlockCost: 120,
  },
};

/**
 * All three weapons, their procedural models, pooled projectiles, muzzle
 * flash light, ammo/reload management and upgrade multipliers.
 */
export class WeaponSystem {
  constructor(game) {
    this.game = game;
    this.state = {};
    for (const id of Object.keys(WEAPONS)) {
      this.state[id] = {
        unlocked: id === 'rifle',
        mag: WEAPONS[id].mag,
        reserve: WEAPONS[id].reserve,
        dmgLvl: 0,
        rateLvl: 0,
        reloading: 0,
      };
    }
    this.current = 'rifle';
    this._cooldown = 0;
    this._flameOn = false;

    this._buildProjectilePool();
    this._buildWeaponMeshes();

    // reusable muzzle flash light
    this.muzzleLight = new THREE.PointLight(0xffb066, 0, 14, 2);
    game.sceneM.scene.add(this.muzzleLight);

    this._tmpDir = new THREE.Vector3();
    this._tmpMuzzle = new THREE.Vector3();
  }

  // ------------------------------------------------------------ meshes

  _buildWeaponMeshes() {
    const metal = new THREE.MeshStandardMaterial({ color: 0x39434d, roughness: 0.35, metalness: 0.85 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1c2228, roughness: 0.5, metalness: 0.6 });
    const tank = new THREE.MeshStandardMaterial({ color: 0xa33d20, roughness: 0.4, metalness: 0.7 });

    const rifle = new THREE.Group();
    rifle.add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.72), metal));
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), dark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.5);
    rifle.add(barrel);
    const magMesh = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.12), dark);
    magMesh.position.set(0, -0.14, 0.05);
    rifle.add(magMesh);

    const shotgun = new THREE.Group();
    shotgun.add(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.5), dark));
    const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.55, 7), metal);
    b1.rotation.x = Math.PI / 2;
    b1.position.set(-0.04, 0.03, -0.45);
    const b2 = b1.clone();
    b2.position.x = 0.04;
    shotgun.add(b1, b2);

    const flamer = new THREE.Group();
    flamer.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.45), metal));
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.25, 8), tank);
    nozzle.rotation.x = -Math.PI / 2;
    nozzle.position.set(0, 0, -0.4);
    flamer.add(nozzle);
    const fuelTank = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 8), tank);
    fuelTank.position.set(0, 0.14, 0.18);
    fuelTank.rotation.x = Math.PI / 2;
    flamer.add(fuelTank);

    this.meshes = { rifle, shotgun, flamer };
    for (const [id, m] of Object.entries(this.meshes)) {
      m.visible = id === this.current;
      m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.game.player.weaponAnchor.add(m);
    }
  }

  _buildProjectilePool() {
    this.projectiles = [];
    const geo = new THREE.CapsuleGeometry(0.05, 0.5, 2, 5);
    geo.rotateX(Math.PI / 2);
    for (let i = 0; i < PROJECTILE_POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffd27f });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.game.sceneM.scene.add(mesh);
      this.projectiles.push({
        active: false, mesh,
        pos: new THREE.Vector3(), vel: new THREE.Vector3(),
        life: 0, damage: 0,
      });
    }
  }

  // ------------------------------------------------------------ stats & shop API

  get def() { return WEAPONS[this.current]; }
  get st() { return this.state[this.current]; }

  dmgMul(id) { return 1 + this.state[id].dmgLvl * 0.25; }
  rateMul(id) { return 1 + this.state[id].rateLvl * 0.15; }

  unlock(id) {
    this.state[id].unlocked = true;
    this.switchTo(id);
  }

  addAmmo(id, amount) {
    const s = this.state[id];
    if (id === 'flamer') {
      s.mag = Math.min(WEAPONS.flamer.maxFuel, s.mag + amount);
    } else {
      s.reserve = Math.min(WEAPONS[id].maxReserve, s.reserve + amount);
    }
  }

  switchTo(id) {
    if (!this.state[id].unlocked || id === this.current) return;
    this._setFlame(false);
    this.current = id;
    this._cooldown = Math.max(this._cooldown, 0.18);
    for (const [wid, m] of Object.entries(this.meshes)) m.visible = wid === id;
  }

  switchNext() {
    const ids = Object.keys(WEAPONS).filter((id) => this.state[id].unlocked);
    const idx = ids.indexOf(this.current);
    this.switchTo(ids[(idx + 1) % ids.length]);
  }

  startReload() {
    const d = this.def, s = this.st;
    if (this.current === 'flamer' || s.reloading > 0 || s.mag >= d.mag || s.reserve <= 0) return;
    s.reloading = d.reload;
    this.game.audio.reload();
  }

  // ------------------------------------------------------------ firing

  _setFlame(on) {
    if (on === this._flameOn) return;
    this._flameOn = on;
    this.game.audio.setFlame(on);
  }

  _spawnProjectile(origin, dir, spread, speed, life, damage, color) {
    const p = this.projectiles.find((q) => !q.active);
    if (!p) return;
    p.active = true;
    p.pos.copy(origin);
    const a = (Math.random() - 0.5) * 2 * spread;
    const cos = Math.cos(a), sin = Math.sin(a);
    p.vel.set(dir.x * cos - dir.z * sin, 0, dir.x * sin + dir.z * cos).multiplyScalar(speed);
    p.life = life;
    p.damage = damage;
    p.mesh.visible = true;
    p.mesh.position.copy(origin);
    p.mesh.material.color.set(color);
    p.mesh.lookAt(origin.x + p.vel.x, origin.y, origin.z + p.vel.z);
  }

  _muzzleFlash(pos, big = false) {
    this.muzzleLight.position.copy(pos).setY(1.3);
    this.muzzleLight.intensity = big ? 9 : 5;
    this.game.particles.glow.emit({
      pos, count: big ? 8 : 4, color: 0xffe6a8, color2: 0xff9a3d,
      spread: 0.1, velRand: big ? 3 : 1.6, size: big ? 0.5 : 0.32, life: 0.09, lifeRand: 0.03,
    });
  }

  _fireCurrent() {
    const game = this.game;
    const d = this.def, s = this.st;
    const dir = game.player.getAimDir(this._tmpDir);
    const muzzle = game.player.getMuzzleWorld(this._tmpMuzzle).setY(1.15);

    if (this.current === 'flamer') return; // handled continuously in update()

    if (s.mag <= 0) {
      game.audio.emptyClick();
      this.startReload();
      this._cooldown = 0.3;
      return;
    }
    s.mag--;

    const dmg = d.damage * this.dmgMul(this.current);
    if (this.current === 'shotgun') {
      for (let i = 0; i < d.pellets; i++) {
        this._spawnProjectile(muzzle, dir, d.spread, d.speed * (0.85 + Math.random() * 0.3), d.projLife, dmg, d.tracer);
      }
      game.sceneM.addShake(0.3);
      this._muzzleFlash(muzzle, true);
    } else {
      this._spawnProjectile(muzzle, dir, d.spread, d.speed, d.projLife, dmg, d.tracer);
      game.sceneM.addShake(0.08);
      this._muzzleFlash(muzzle, false);
    }
    game.audio.shoot(this.current);
    this._cooldown = 1 / (d.rate * this.rateMul(this.current));

    if (s.mag <= 0) this.startReload();
  }

  _updateFlamer(dt) {
    const game = this.game;
    const d = WEAPONS.flamer, s = this.state.flamer;
    const firing = game.input.firing && this.current === 'flamer' && s.mag > 0 && game.state === 'playing';
    this._setFlame(firing);
    if (!firing) return;

    s.mag = Math.max(0, s.mag - d.drain * dt);
    const dir = game.player.getAimDir(this._tmpDir);
    const muzzle = game.player.getMuzzleWorld(this._tmpMuzzle).setY(1.15);

    // flame stream particles
    game.particles.glow.emit({
      pos: muzzle, count: 6, color: 0xff8a1e, color2: 0xffe08a,
      spread: 0.12,
      vel: new THREE.Vector3(dir.x * 11, 0.6, dir.z * 11),
      velRand: 1.4, size: 0.42, sizeRand: 0.12, life: 0.45, lifeRand: 0.12,
      gravity: -2.2, drag: 1.8, growth: 1.4,
    });
    if (Math.random() < 0.35) {
      game.particles.soft.emit({
        pos: muzzle.clone().addScaledVector(dir, 3), count: 1, color: 0x4a4a50, alpha: 0.25,
        vel: new THREE.Vector3(dir.x * 4, 1.5, dir.z * 4), velRand: 0.6, size: 0.7, life: 1.2, growth: 0.8,
      });
    }
    this.muzzleLight.position.copy(muzzle).addScaledVector(dir, 2).setY(1.2);
    this.muzzleLight.intensity = 6 + Math.random() * 3;

    // cone damage with ignite
    const dps = d.dps * this.dmgMul('flamer');
    game.enemies.coneDamage(muzzle, dir, d.range, d.cone, dps * dt, true);
  }

  // ------------------------------------------------------------ frame update

  update(dt) {
    const game = this.game;
    const input = game.input;
    const s = this.st;

    // weapon hotkeys
    if (input.wasPressed('Digit1')) this.switchTo('rifle');
    if (input.wasPressed('Digit2')) this.switchTo('shotgun');
    if (input.wasPressed('Digit3')) this.switchTo('flamer');
    if (input.wasPressed('KeyQ') || game.hud.consumeTouchSwap()) this.switchNext();
    if (input.wasPressed('KeyR') || game.hud.consumeTouchReload()) this.startReload();

    // reload progress
    if (s.reloading > 0) {
      s.reloading -= dt;
      if (s.reloading <= 0) {
        const d = this.def;
        const need = d.mag - s.mag;
        const take = Math.min(need, s.reserve);
        s.mag += take;
        s.reserve -= take;
        s.reloading = 0;
      }
    }

    // trigger
    if (this._cooldown > 0) this._cooldown -= dt;
    const canFire = game.state === 'playing' && s.reloading <= 0;
    if (canFire && input.firing && this._cooldown <= 0 && this.current !== 'flamer') {
      if (this.def.auto || !this._wasFiring) this._fireCurrent();
    }
    this._wasFiring = input.firing;

    this._updateFlamer(dt);

    // muzzle light decay
    if (this.muzzleLight.intensity > 0) {
      this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 60);
    }

    // ---- projectile simulation & collision ----
    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.life -= dt;
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);

      let dead = p.life <= 0 || Math.hypot(p.pos.x, p.pos.z) > WORLD_RADIUS + 10;

      if (!dead) {
        const enemy = game.enemies.queryHit(p.pos, 0.3);
        if (enemy) {
          game.enemies.damage(enemy, p.damage, p.pos, false);
          game.hud.hitmarker();
          dead = true;
        } else if (game.env.hitBarrier(p.pos, p.damage)) {
          dead = true;
        }
      }
      if (dead) {
        p.active = false;
        p.mesh.visible = false;
      }
    }
  }

  reset() {
    for (const id of Object.keys(WEAPONS)) {
      const s = this.state[id];
      s.unlocked = id === 'rifle';
      s.mag = WEAPONS[id].mag;
      s.reserve = WEAPONS[id].reserve;
      s.dmgLvl = 0;
      s.rateLvl = 0;
      s.reloading = 0;
    }
    this._setFlame(false);
    this.switchTo('rifle');
    this.current = 'rifle';
    for (const [wid, m] of Object.entries(this.meshes)) m.visible = wid === 'rifle';
    for (const p of this.projectiles) {
      p.active = false;
      p.mesh.visible = false;
    }
  }
}
