/**
 * The freezing mechanic. Ambient cold drains the player's warmth; standing
 * near the campfire restores it, scaled by how strongly the fire burns.
 * The fire itself decays and must be stoked with gathered wood. Periodic
 * blizzards spike the drain rate and thicken the weather.
 */
export class HeatSystem {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.warmth = 100;
    this.maxWarmth = 100;
    this.fire = 1.0;            // 0..1 campfire strength
    this.coatLevel = 0;         // shop upgrade: reduces drain
    this.blizzard = false;
    this.blizzardT = 0;
    this._nextBlizzard = 35 + Math.random() * 20;
    this._stormLerp = 0;
  }

  get heatRadius() {
    return 5 + this.fire * 9;
  }

  stokeFire() {
    this.fire = Math.min(1, this.fire + 0.24);
  }

  /** damage the fire (goliaths & bears attack it) */
  damageFire(amount) {
    this.fire = Math.max(0, this.fire - amount);
  }

  update(dt) {
    const game = this.game;
    const player = game.player;

    // ---- campfire decay ----
    this.fire = Math.max(0, this.fire - dt * 0.011);

    // ---- blizzard cycle ----
    if (this.blizzard) {
      this.blizzardT -= dt;
      if (this.blizzardT <= 0) {
        this.blizzard = false;
        this._nextBlizzard = 34 + Math.random() * 26;
        game.hud.toast('The blizzard passes...', 'good');
      }
    } else {
      this._nextBlizzard -= dt;
      if (this._nextBlizzard <= 0) {
        this.blizzard = true;
        this.blizzardT = 10 + Math.random() * 6;
        game.hud.toast('⚠ BLIZZARD INCOMING — get to the fire!', 'warn');
      }
    }
    const stormTarget = this.blizzard ? 1 : 0;
    this._stormLerp += (stormTarget - this._stormLerp) * Math.min(1, dt * 1.2);
    game.sceneM.setStorm(this._stormLerp);
    game.audio.setWind(this._stormLerp);

    // ---- warmth balance ----
    const drainMul = Math.max(0.4, 1 - this.coatLevel * 0.15);
    let drain = 2.4 * drainMul * (1 + this._stormLerp * 2.4);

    const dist = player.pos.distanceTo(game.env.firePos);
    let gain = 0;
    if (dist < this.heatRadius && this.fire > 0.03) {
      const falloff = 1 - dist / this.heatRadius;
      gain = (4 + this.fire * 14) * falloff;
    }
    this.warmth = Math.min(this.maxWarmth, Math.max(0, this.warmth + (gain - drain) * dt));

    // ---- consequences ----
    if (this.warmth <= 0) {
      player.freezeDamage(4.5 * dt);
    } else if (this.warmth > 55 && player.hp < player.maxHp) {
      player.hp = Math.min(player.maxHp, player.hp + 1.4 * dt); // cozy = slow regen
    }

    // freeze vignette intensity for the HUD
    const chill = 1 - this.warmth / this.maxWarmth;
    game.hud.setFreeze(Math.pow(chill, 1.6));
  }

  /** 0..1 — how close the player is to the fire, for the crackle audio */
  crackleProximity() {
    const d = this.game.player.pos.distanceTo(this.game.env.firePos);
    if (this.fire < 0.03) return 0;
    return Math.max(0, 1 - d / 14) * this.fire;
  }
}
