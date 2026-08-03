# ❄️ FROSTFALL — Arctic Survival

A 3D action-survival wave shooter that runs entirely in the browser. Fight off
endless waves of frost wolves, polar bears and ice goliaths, gather wood, and
keep the campfire burning — if it dies, you freeze.

Built with **Three.js + Vite**. Everything is procedural: geometry, materials,
particles and even the sound effects (Web Audio synthesis) — no external
assets required.

## Play

- **WASD / arrows** — move
- **Mouse** — aim, **LMB** — shoot
- **E** — gather wood / stoke the campfire
- **1 · 2 · 3** — Assault Rifle / Spread Shotgun / Flamethrower
- **R** — reload · **Q** — cycle weapons
- **Tab / B** — field workshop (upgrades & supplies)
- **P** — pause

Mobile is supported with dual virtual joysticks (left: move, right: aim + fire).

## Survival rules

- The cold constantly drains your **warmth**; at zero warmth your health drains.
- Standing near the **campfire** restores warmth — but the fire decays and
  must be stoked with gathered wood.
- **Blizzards** periodically hit, tripling the cold drain.
- Some beasts ignore you and attack the campfire directly.
- Kills drop **scrap** ⚙️ — spend it in the workshop on weapons, upgrades,
  ammo, medkits and insulated coats.

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # production build to dist/
npm run preview  # preview the production build
```

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the
Vite project and publishes `dist/` to the `gh-pages` branch for GitHub Pages.
The Vite `base: './'` setting keeps all asset paths relative so the game works
from the repository subpath.

## Architecture

```
src/
  main.js                  — state controller + delta-capped game loop
  engine/SceneManager.js   — renderer, camera, lighting, snow weather, bloom
  engine/Input.js          — keyboard/mouse + mobile joysticks
  engine/AudioEngine.js    — fully synthetic Web Audio sound engine
  engine/ParticleSystem.js — pooled GPU point-sprite particles (2 blend modes)
  game/Player.js           — survivor controller, movement, aim, interaction
  game/WeaponSystem.js     — 3 weapons, pooled projectiles, muzzle flashes
  game/EnemyManager.js     — wave scaling, AI steering, ragdolls, loot
  game/Environment.js      — procedural terrain, trees, ice barriers, campfire
  game/HeatSystem.js       — freezing mechanic, campfire decay, blizzards
  ui/HUDManager.js         — HUD overlay, shop, screens, touch buttons
```
