import * as THREE from 'three';
import { WORLD_RADIUS } from './Environment.js';

const MOVE_SPEED = 8.2;
const ACCEL = 34;

/**
 * The survivor: procedural hooded character, smooth WASD movement with
 * acceleration, mouse-driven torso aim, interaction (gather/stoke), health
 * and freeze damage. The equipped weapon mesh is swapped by WeaponSystem.
 */
export class Player {
  constructor(game) {
    this.game = game;

    this.pos = new THREE.Vector3(3, 0, 4);
    this.vel = new THREE.Vector3();
    this.aimPoint = new THREE.Vector3(0, 1.1, -10);
    this.facing = 0;

    this.maxHp = 100;
    this.hp = 100;
    this.wood = 2;
    this.scrap = 0;

    this._moveInput = new THREE.Vector2();
    this._walkTime = 0;
    this._stepTimer = 0;
    this._interactCd = 0;
    this._hurtCd = 0;

    this._buildMesh();
    game.sceneM.scene.add(this.group);
  }

  _buildMesh() {
    const g = new THREE.Group();

    const coatMat = new THREE.MeshStandardMaterial({ color: 0x2e5a3f, roughness: 0.8 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x22303c, roughness: 0.9 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd8a67f, roughness: 0.7 });
    const furMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 1.0 });

    // legs (animated)
    this.legL = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.7, 6), darkMat);
    this.legL.position.set(-0.17, 0.35, 0);
    this.legR = this.legL.clone();
    this.legR.position.x = 0.17;
    g.add(this.legL, this.legR);

    // torso
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.85, 8), coatMat);
    torso.position.y = 1.05;
    torso.castShadow = true;
    g.add(torso);

    // fur collar
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.09, 6, 12), furMat);
    collar.position.y = 1.48;
    collar.rotation.x = Math.PI / 2;
    g.add(collar);

    // head + hood
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skinMat);
    head.position.y = 1.68;
    head.castShadow = true;
    g.add(head);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), coatMat);
    hood.position.y = 1.72;
    g.add(hood);

    // arms angled forward toward the weapon
    this.armL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.62, 6), coatMat);
    this.armL.position.set(-0.32, 1.2, -0.22);
    this.armL.rotation.x = -1.15;
    this.armL.rotation.z = 0.5;
    this.armR = this.armL.clone();
    this.armR.position.x = 0.32;
    this.armR.rotation.z = -0.5;
    g.add(this.armL, this.armR);

    // weapon anchor — WeaponSystem parents the gun model here
    this.weaponAnchor = new THREE.Group();
    this.weaponAnchor.position.set(0.16, 1.15, -0.45);
    g.add(this.weaponAnchor);

    g.position.copy(this.pos);
    this.group = g;
  }

  /** world-space muzzle position of the equipped weapon */
  getMuzzleWorld(out) {
    return this.weaponAnchor.getWorldPosition(out ?? new THREE.Vector3()).add(
      new THREE.Vector3(Math.sin(this.facing) * -0.9, 0, Math.cos(this.facing) * -0.9)
    );
  }

  /** normalized XZ aim direction */
  getAimDir(out) {
    out = out ?? new THREE.Vector3();
    out.subVectors(this.aimPoint, this.pos).setY(0);
    if (out.lengthSq() < 0.001) out.set(0, 0, -1);
    return out.normalize();
  }

  update(dt) {
    const game = this.game;
    const input = game.input;

    // ---- movement ----
    input.getMoveVector(this._moveInput);
    const targetVx = this._moveInput.x * MOVE_SPEED;
    const targetVz = this._moveInput.y * MOVE_SPEED;
    this.vel.x += THREE.MathUtils.clamp(targetVx - this.vel.x, -ACCEL * dt, ACCEL * dt);
    this.vel.z += THREE.MathUtils.clamp(targetVz - this.vel.z, -ACCEL * dt, ACCEL * dt);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    // arena bounds
    const d = Math.hypot(this.pos.x, this.pos.z);
    if (d > WORLD_RADIUS) {
      this.pos.x *= WORLD_RADIUS / d;
      this.pos.z *= WORLD_RADIUS / d;
    }
    // don't stand in the fire
    const df = this.pos.distanceTo(game.env.firePos);
    if (df < 1.7) {
      const push = this.pos.clone().sub(game.env.firePos).setY(0).normalize().multiplyScalar(1.7);
      this.pos.x = game.env.firePos.x + push.x;
      this.pos.z = game.env.firePos.z + push.z;
    }

    // ---- aim ----
    this.aimPoint.copy(input.getAimPoint(game.sceneM.camera, this.pos));
    const dir = this.getAimDir();
    const targetYaw = Math.atan2(-dir.x, -dir.z);
    let delta = targetYaw - this.facing;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.facing += delta * Math.min(1, dt * 14);
    this.group.rotation.y = this.facing;
    this.group.position.copy(this.pos);

    // ---- walk animation + snow puffs ----
    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (speed > 0.5) {
      this._walkTime += dt * speed * 1.4;
      const swing = Math.sin(this._walkTime) * 0.35;
      this.legL.rotation.x = swing;
      this.legR.rotation.x = -swing;
      this.group.position.y = Math.abs(Math.sin(this._walkTime)) * 0.05;

      this._stepTimer -= dt;
      if (this._stepTimer <= 0) {
        this._stepTimer = 0.22;
        game.particles.soft.emit({
          pos: this.pos.clone().setY(0.08), count: 3, color: 0xeef6ff, alpha: 0.55,
          spread: 0.18, vel: new THREE.Vector3(-this.vel.x * 0.06, 0.8, -this.vel.z * 0.06),
          velRand: 0.5, size: 0.3, life: 0.5, gravity: 2.2, growth: 0.7,
        });
      }
    } else {
      this.legL.rotation.x *= 1 - Math.min(1, dt * 10);
      this.legR.rotation.x *= 1 - Math.min(1, dt * 10);
    }

    // ---- interaction (E / touch button) ----
    if (this._interactCd > 0) this._interactCd -= dt;
    const wantsInteract = input.wasPressed('KeyE') || game.hud.consumeTouchInteract();

    const nearFire = df < 3.2;
    const woodSrc = game.env.nearestWoodSource(this.pos);
    if (nearFire) {
      game.hud.setInteractHint(this.wood > 0
        ? '<b>[E]</b> Stoke fire (1 🪵)'
        : 'Fire needs wood — chop trees! 🌲');
    } else if (woodSrc) {
      game.hud.setInteractHint(`<b>[E]</b> Gather wood (${woodSrc.wood} left)`);
    } else {
      game.hud.setInteractHint(null);
    }

    if (wantsInteract && this._interactCd <= 0) {
      if (nearFire && this.wood > 0) {
        this.wood--;
        game.heat.stokeFire();
        game.audio.stoke();
        game.hud.toast('🔥 Fire stoked!', 'good');
        this._interactCd = 0.35;
      } else if (woodSrc) {
        game.env.gatherFrom(woodSrc);
        this.wood++;
        game.audio.gather();
        game.hud.toast('+1 🪵 wood', 'good');
        this._interactCd = 0.45;
      } else if (nearFire) {
        game.audio.deny();
      }
    }

    if (this._hurtCd > 0) this._hurtCd -= dt;
  }

  takeDamage(dmg) {
    if (this.game.state !== 'playing') return;
    this.hp -= dmg;
    this.game.hud.damageFlash();
    this.game.sceneM.addShake(0.35);
    if (this._hurtCd <= 0) {
      this.game.audio.playerHurt();
      this._hurtCd = 0.4;
    }
    this.game.particles.soft.emit({
      pos: this.pos.clone().setY(1.1), count: 8, color: 0xb3202a, color2: 0x7a1018,
      spread: 0.3, velRand: 2.4, size: 0.16, life: 0.55, gravity: 7,
    });
    if (this.hp <= 0) {
      this.hp = 0;
      this.game.gameOver('mauled');
    }
  }

  freezeDamage(dmg) {
    if (this.game.state !== 'playing') return;
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.hp = 0;
      this.game.gameOver('frozen');
    }
  }

  reset() {
    this.pos.set(3, 0, 4);
    this.vel.set(0, 0, 0);
    this.hp = this.maxHp = 100;
    this.wood = 2;
    this.scrap = 0;
    this.group.position.copy(this.pos);
  }
}
