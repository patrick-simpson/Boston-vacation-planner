import { WEAPONS } from '../game/WeaponSystem.js';

/**
 * DOM overlay: bars, wave banner, resources, ammo, crosshair, hitmarkers,
 * toasts, the upgrade shop, start/pause/game-over screens and touch buttons.
 */
export class HUDManager {
  constructor(game) {
    this.game = game;
    this.el = {
      hud: document.getElementById('hud'),
      healthFill: document.getElementById('health-fill'),
      warmthFill: document.getElementById('warmth-fill'),
      fireFill: document.getElementById('fire-fill'),
      waveLabel: document.getElementById('wave-label'),
      waveSub: document.getElementById('wave-sub'),
      wood: document.getElementById('wood-count'),
      scrap: document.getElementById('scrap-count'),
      slots: document.getElementById('weapon-slots'),
      ammoDisplay: document.getElementById('ammo-display'),
      ammoMag: document.getElementById('ammo-mag'),
      ammoReserve: document.getElementById('ammo-reserve'),
      reloadHint: document.getElementById('reload-hint'),
      interactHint: document.getElementById('interact-hint'),
      toasts: document.getElementById('toasts'),
      hitmarker: document.getElementById('hitmarker'),
      crosshair: document.getElementById('crosshair'),
      vFreeze: document.getElementById('vignette-freeze'),
      vDamage: document.getElementById('vignette-damage'),
      shop: document.getElementById('shop'),
      shopItems: document.getElementById('shop-items'),
      shopButton: document.getElementById('shop-button'),
      startScreen: document.getElementById('start-screen'),
      startButton: document.getElementById('start-button'),
      gameoverScreen: document.getElementById('gameover-screen'),
      gameoverTitle: document.getElementById('gameover-title'),
      gameoverStats: document.getElementById('gameover-stats'),
      restartButton: document.getElementById('restart-button'),
      pauseOverlay: document.getElementById('pause-overlay'),
      touchUI: document.getElementById('touch-ui'),
    };

    this._damageT = 0;
    this._touchInteract = false;
    this._touchSwap = false;
    this._touchReload = false;
    this._resumeTap = false;
    this._lastInteractHint = undefined;

    this._buildWeaponSlots();
    this._wire();

    if (game.input.isTouch) {
      document.body.classList.add('touch');
      this.el.touchUI.classList.remove('hidden');
      // start screen: show touch controls instead of keyboard bindings
      const grid = this.el.startScreen.querySelector('.controls-grid');
      grid.innerHTML = `
        <div><b>LEFT STICK</b> Move</div>
        <div><b>RIGHT STICK</b> Aim &amp; auto-fire</div>
        <div><b>Ⓔ</b> Gather wood / Stoke fire</div>
        <div><b>⇄</b> Switch weapon</div>
        <div><b>Ⓡ</b> Reload</div>
        <div><b>⚒ UPGRADES</b> Open the workshop</div>`;
    }
  }

  _wire() {
    this.el.startButton.addEventListener('click', () => this.game.start());
    this.el.restartButton.addEventListener('click', () => this.game.restart());
    this.el.shopButton.addEventListener('click', () => this.toggleShop());
    document.getElementById('shop-close').addEventListener('click', () => this.closeShop());

    const touch = (id, cb) => {
      const b = document.getElementById(id);
      if (b) b.addEventListener('touchstart', (e) => { e.preventDefault(); cb(); }, { passive: false });
    };
    touch('btn-interact', () => { this._touchInteract = true; });
    touch('btn-swap', () => { this._touchSwap = true; });
    touch('btn-reload', () => { this._touchReload = true; });

    // pause screen: tapping anywhere resumes (phones have no P key)
    this.el.pauseOverlay.addEventListener('pointerdown', () => { this._resumeTap = true; });
    if (this.game.input.isTouch) {
      this.el.pauseOverlay.querySelector('p').textContent = 'Tap to resume';
    }
  }

  consumeResumeTap() { const v = this._resumeTap; this._resumeTap = false; return v; }
  consumeTouchInteract() { const v = this._touchInteract; this._touchInteract = false; return v; }
  consumeTouchSwap() { const v = this._touchSwap; this._touchSwap = false; return v; }
  consumeTouchReload() { const v = this._touchReload; this._touchReload = false; return v; }

  // ------------------------------------------------------------ weapon slots

  _buildWeaponSlots() {
    this.el.slots.innerHTML = '';
    this.slotEls = {};
    for (const [id, w] of Object.entries(WEAPONS)) {
      const div = document.createElement('div');
      div.className = 'wslot';
      div.innerHTML = `<span class="key">[${w.key}]</span>${w.name}`;
      this.el.slots.appendChild(div);
      this.slotEls[id] = div;
    }
  }

  // ------------------------------------------------------------ shop

  toggleShop() {
    this.el.shop.classList.toggle('hidden');
    if (!this.el.shop.classList.contains('hidden')) this.refreshShop();
  }

  closeShop() {
    this.el.shop.classList.add('hidden');
  }

  _shopEntries() {
    const g = this.game;
    const w = g.weapons;
    const entries = [];

    entries.push({ cat: 'ARSENAL' });
    if (!w.state.shotgun.unlocked) {
      entries.push({
        name: '🔫 Unlock Spread Shotgun', desc: 'Devastating up close', cost: WEAPONS.shotgun.unlockCost,
        act: () => w.unlock('shotgun'),
      });
    }
    if (!w.state.flamer.unlocked) {
      entries.push({
        name: '🔥 Unlock Flamethrower', desc: 'Sets beasts ablaze, melts goliaths', cost: WEAPONS.flamer.unlockCost,
        act: () => w.unlock('flamer'),
      });
    }
    for (const id of Object.keys(WEAPONS)) {
      const s = w.state[id];
      if (!s.unlocked) continue;
      const wname = WEAPONS[id].name;
      entries.push({
        name: `⚔ ${wname} damage +25%`, desc: `Level ${s.dmgLvl + 1}`,
        cost: Math.round(25 * Math.pow(1.7, s.dmgLvl)),
        act: () => { s.dmgLvl++; },
      });
      entries.push({
        name: `⚡ ${wname} fire rate +15%`, desc: `Level ${s.rateLvl + 1}`,
        cost: Math.round(22 * Math.pow(1.7, s.rateLvl)),
        act: () => { s.rateLvl++; },
      });
    }

    entries.push({ cat: 'SUPPLIES' });
    entries.push({
      name: '📦 Rifle ammo +90', desc: 'Reserve rounds', cost: 12,
      act: () => w.addAmmo('rifle', 90),
    });
    if (w.state.shotgun.unlocked) {
      entries.push({
        name: '📦 Shotgun shells +16', desc: 'Reserve shells', cost: 14,
        act: () => w.addAmmo('shotgun', 16),
      });
    }
    if (w.state.flamer.unlocked) {
      entries.push({
        name: '🛢 Flamer fuel +50', desc: 'Refill the tank', cost: 16,
        act: () => w.addAmmo('flamer', 50),
      });
    }
    entries.push({
      name: '💊 Field medkit', desc: 'Restore 50 health', cost: 22,
      act: () => { g.player.hp = Math.min(g.player.maxHp, g.player.hp + 50); },
    });

    entries.push({ cat: 'SURVIVAL' });
    entries.push({
      name: '♥ Max health +25', desc: `Currently ${g.player.maxHp}`,
      cost: Math.round(45 * Math.pow(1.6, (g.player.maxHp - 100) / 25)),
      act: () => { g.player.maxHp += 25; g.player.hp += 25; },
    });
    entries.push({
      name: '🧥 Insulated coat', desc: `Cold drain −15% · Level ${g.heat.coatLevel + 1}`,
      cost: Math.round(35 * Math.pow(1.7, g.heat.coatLevel)),
      act: () => { g.heat.coatLevel++; },
    });
    return entries;
  }

  refreshShop() {
    if (this.el.shop.classList.contains('hidden')) return;
    const g = this.game;
    this.el.shopItems.innerHTML = '';
    for (const e of this._shopEntries()) {
      if (e.cat) {
        const c = document.createElement('div');
        c.className = 'shop-cat';
        c.textContent = e.cat;
        this.el.shopItems.appendChild(c);
        continue;
      }
      const div = document.createElement('div');
      div.className = 'shop-item';
      const affordable = g.player.scrap >= e.cost;
      div.innerHTML = `
        <div class="si-info">
          <div class="si-name">${e.name}</div>
          <div class="si-desc">${e.desc}</div>
        </div>`;
      const btn = document.createElement('button');
      btn.textContent = `⚙️ ${e.cost}`;
      btn.disabled = !affordable;
      btn.addEventListener('click', () => {
        if (g.player.scrap < e.cost) { g.audio.deny(); return; }
        g.player.scrap -= e.cost;
        e.act();
        g.audio.buy();
        this.refreshShop();
      });
      div.appendChild(btn);
      this.el.shopItems.appendChild(div);
    }
  }

  // ------------------------------------------------------------ feedback

  toast(text, kind = '') {
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.innerHTML = text;
    this.el.toasts.appendChild(t);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    setTimeout(() => t.remove(), 2800);
  }

  hitmarker() {
    const m = this.el.hitmarker;
    const px = this.game.input.mousePx;
    m.style.left = `${px.x}px`;
    m.style.top = `${px.y}px`;
    m.classList.remove('pop');
    void m.offsetWidth; // restart CSS animation
    m.classList.add('pop');
  }

  damageFlash() {
    this._damageT = 0.5;
  }

  setFreeze(v) {
    this.el.vFreeze.style.opacity = String(Math.min(1, v));
  }

  setInteractHint(html) {
    if (html === this._lastInteractHint) return;
    this._lastInteractHint = html;
    if (html) {
      this.el.interactHint.innerHTML = html;
      this.el.interactHint.classList.remove('hidden');
    } else {
      this.el.interactHint.classList.add('hidden');
    }
  }

  announceWave(n) {
    this.el.waveLabel.style.animation = 'none';
    void this.el.waveLabel.offsetWidth;
    this.toast(`🌨 WAVE ${n} — they're coming!`, 'warn');
  }

  // ------------------------------------------------------------ screens

  showStart() {
    this.el.startScreen.classList.remove('hidden');
    this.el.hud.classList.add('hidden');
  }

  hideStart() {
    this.el.startScreen.classList.add('hidden');
    this.el.hud.classList.remove('hidden');
  }

  setPaused(paused) {
    this.el.pauseOverlay.classList.toggle('hidden', !paused);
  }

  showGameOver(cause, stats) {
    this.el.gameoverTitle.textContent = cause === 'frozen' ? 'YOU FROZE' : 'YOU WERE DEVOURED';
    const mins = Math.floor(stats.time / 60);
    const secs = Math.floor(stats.time % 60);
    this.el.gameoverStats.innerHTML = `
      <div class="stat"><div class="v">${stats.waves}</div><div class="k">WAVES SURVIVED</div></div>
      <div class="stat"><div class="v">${stats.kills}</div><div class="k">BEASTS SLAIN</div></div>
      <div class="stat"><div class="v">${mins}:${String(secs).padStart(2, '0')}</div><div class="k">TIME ALIVE</div></div>
      <div class="stat"><div class="v">${stats.scrapEarned}</div><div class="k">SCRAP EARNED</div></div>`;
    this.el.gameoverScreen.classList.remove('hidden');
    this.closeShop();
  }

  hideGameOver() {
    this.el.gameoverScreen.classList.add('hidden');
  }

  // ------------------------------------------------------------ frame update

  update(dt) {
    const g = this.game;
    const p = g.player;

    this.el.healthFill.style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
    this.el.warmthFill.style.width = `${Math.max(0, (g.heat.warmth / g.heat.maxWarmth) * 100)}%`;
    this.el.fireFill.style.width = `${Math.max(0, g.heat.fire * 100)}%`;

    this.el.wood.textContent = p.wood;
    this.el.scrap.textContent = p.scrap;

    // wave banner
    const em = g.enemies;
    this.el.waveLabel.textContent = em.wave === 0 ? 'GET READY' : `WAVE ${em.wave}`;
    if (em.phase === 'intermission') {
      this.el.waveSub.textContent = `next wave in ${Math.ceil(em.phaseT)}s — stock up!`;
    } else {
      this.el.waveSub.textContent = `${em.remaining} beast${em.remaining === 1 ? '' : 's'} remaining`;
    }

    // weapons
    const w = g.weapons;
    for (const [id, div] of Object.entries(this.slotEls)) {
      div.classList.toggle('active', id === w.current);
      div.classList.toggle('locked', !w.state[id].unlocked);
    }
    const st = w.st;
    if (w.current === 'flamer') {
      this.el.ammoMag.textContent = Math.ceil(st.mag);
      this.el.ammoReserve.textContent = 'fuel';
    } else {
      this.el.ammoMag.textContent = st.mag;
      this.el.ammoReserve.textContent = st.reserve;
    }
    this.el.ammoDisplay.classList.toggle('low', w.current === 'flamer' ? st.mag < 20 : st.mag <= Math.ceil(WEAPONS[w.current].mag * 0.2));
    this.el.reloadHint.textContent = st.reloading > 0 ? 'RELOADING...' : '';

    // crosshair follows the mouse
    if (!g.input.isTouch) {
      const px = g.input.mousePx;
      this.el.crosshair.style.left = `${px.x}px`;
      this.el.crosshair.style.top = `${px.y}px`;
    }

    // damage vignette decay
    if (this._damageT > 0) {
      this._damageT -= dt;
      this.el.vDamage.style.opacity = String(Math.max(0, this._damageT * 2));
    }
  }
}
