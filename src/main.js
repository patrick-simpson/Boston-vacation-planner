import './style.css';
import * as THREE from 'three';
import { SceneManager } from './engine/SceneManager.js';
import { Input } from './engine/Input.js';
import { AudioEngine } from './engine/AudioEngine.js';
import { ParticleSystem } from './engine/ParticleSystem.js';
import { Environment } from './game/Environment.js';
import { HeatSystem } from './game/HeatSystem.js';
import { Player } from './game/Player.js';
import { WeaponSystem } from './game/WeaponSystem.js';
import { EnemyManager } from './game/EnemyManager.js';
import { HUDManager } from './ui/HUDManager.js';

/**
 * Application state controller: builds every subsystem, owns the
 * delta-capped game loop and the menu → playing → gameover flow.
 */
class Game {
  constructor() {
    this.state = 'menu';
    this.stats = { kills: 0, waves: 0, time: 0, scrapEarned: 0 };

    const container = document.getElementById('game-container');
    this.input = new Input();
    // touch devices get the low-power render tier (phones are the target there)
    this.sceneM = new SceneManager(container, this.input.isTouch);
    this.audio = new AudioEngine();
    this.particles = new ParticleSystem(this.sceneM.scene);

    this.env = new Environment(this);
    this.heat = new HeatSystem(this);
    this.player = new Player(this);
    this.weapons = new WeaponSystem(this);
    this.enemies = new EnemyManager(this);
    this.hud = new HUDManager(this);

    this.clock = new THREE.Clock();
    this.hud.showStart();

    // auto-pause when the tab/app goes to the background (phone home button etc.)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') {
        this.state = 'paused';
        this.hud.setPaused(true);
      }
    });

    this.sceneM.renderer.setAnimationLoop(() => this._frame());
  }

  start() {
    this.audio.init(); // must happen inside the click gesture
    this.hud.hideStart();
    this.state = 'playing';
    this.clock.getDelta(); // discard time spent on the menu
    this.hud.toast('Gather 🪵 wood and keep the fire alive!', 'good');
  }

  restart() {
    this.enemies.reset();
    this.weapons.reset();
    this.env.reset();
    this.heat.reset();
    this.player.reset();
    this.particles.clear();
    this.stats = { kills: 0, waves: 0, time: 0, scrapEarned: 0 };
    this.hud.hideGameOver();
    this.hud.closeShop();
    this.state = 'playing';
    this.clock.getDelta();
  }

  gameOver(cause) {
    if (this.state !== 'playing') return;
    this.state = 'gameover';
    this.audio.setFlame(false);
    this.audio.gameOver();
    this.sceneM.addShake(0.8);
    this.hud.showGameOver(cause, this.stats);
  }

  _frame() {
    // cap delta so tab-switches / hitches never explode the simulation
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.state === 'playing') {
      if (this.input.wasPressed('KeyP')) {
        this.state = 'paused';
        this.hud.setPaused(true);
      } else {
        if (this.input.wasPressed('Tab') || this.input.wasPressed('KeyB')) this.hud.toggleShop();

        this.stats.time += dt;
        this.player.update(dt);
        this.weapons.update(dt);
        this.enemies.update(dt);
        this.heat.update(dt);
        this.hud.update(dt);
      }
    } else if (this.state === 'paused') {
      if (this.input.wasPressed('KeyP') || this.hud.consumeResumeTap()) {
        this.state = 'playing';
        this.hud.setPaused(false);
        this.clock.getDelta();
      }
    }

    // world keeps breathing on every screen (menu shows the living scene)
    this.env.update(dt);
    this.particles.update(dt);
    this.audio.update(
      dt,
      this.state === 'playing' ? this.heat.crackleProximity() : 0.3,
      this.state === 'playing' && this.player.hp < this.player.maxHp * 0.25
    );
    this.sceneM.update(dt, this.player.pos);
    this.sceneM.render();

    this.input.lateUpdate();
  }
}

const game = new Game();
window.__FROSTFALL = game; // handy for debugging / automated smoke tests
