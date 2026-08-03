import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const SNOW_COUNT = 2200;
const SNOW_BOX = { x: 90, y: 34, z: 90 };

/**
 * Owns renderer, camera, lighting, fog, falling-snow weather and the bloom
 * post-processing chain. Camera is a smoothed top-down action follow-cam.
 */
export class SceneManager {
  constructor(container, lowPower = false) {
    this.lowPower = lowPower; // phones: smaller shadows, lower pixel ratio, lighter bloom
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fb6d4);
    this.fogBase = 0.014;
    this.scene.fog = new THREE.FogExp2(0x9cbcd6, this.fogBase);

    this.camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.5, 300);
    this.camera.position.set(0, 22, 15);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: !lowPower, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this._setupLights();
    this._setupSnowfall();

    // post-processing: subtle bloom sells the fire, muzzle flashes and ice glints
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloomScale = lowPower ? 0.5 : 1;
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth * bloomScale, window.innerHeight * bloomScale), 0.42, 0.7, 0.82
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    // camera state
    this.camTarget = new THREE.Vector3();
    this.camOffset = new THREE.Vector3(0, 21, 13.5);
    this.shake = 0;
    this.storm = 0; // 0 calm .. 1 blizzard
    this._updateCamOffset();

    window.addEventListener('resize', () => this._onResize());
  }

  /** Portrait screens see far less of the arena — pull the camera back to compensate. */
  _updateCamOffset() {
    const aspect = window.innerWidth / window.innerHeight;
    const zoomOut = aspect < 0.7 ? 1.45 : aspect < 1.0 ? 1.25 : 1;
    this.camOffset.set(0, 21 * zoomOut, 13.5 * zoomOut);
  }

  _setupLights() {
    const hemi = new THREE.HemisphereLight(0xbdd8f0, 0xdfe9f2, 0.55);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff2df, 1.5);
    sun.position.set(-30, 42, 18);
    sun.castShadow = true;
    const sm = this.lowPower ? 1024 : 2048;
    sun.shadow.mapSize.set(sm, sm);
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.0006;
    this.scene.add(sun);
    this.sun = sun;
  }

  _setupSnowfall() {
    this.snowCount = this.lowPower ? 1300 : SNOW_COUNT;
    const pos = new Float32Array(SNOW_COUNT * 3);
    this._snowVel = new Float32Array(SNOW_COUNT); // fall speed per flake
    for (let i = 0; i < SNOW_COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * SNOW_BOX.x;
      pos[i * 3 + 1] = Math.random() * SNOW_BOX.y;
      pos[i * 3 + 2] = (Math.random() - 0.5) * SNOW_BOX.z;
      this._snowVel[i] = 2.2 + Math.random() * 2.6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, Math.floor(this.snowCount * 0.45)); // calm weather uses fewer flakes

    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);

    const mat = new THREE.PointsMaterial({
      size: 0.22,
      map: new THREE.CanvasTexture(c),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.snow = new THREE.Points(geo, mat);
    this.snow.frustumCulled = false;
    this.scene.add(this.snow);
    this._snowTime = 0;
  }

  setStorm(v) {
    this.storm = v;
  }

  addShake(amount) {
    this.shake = Math.min(0.9, this.shake + amount);
  }

  update(dt, followPos) {
    // ---- weather ----
    this._snowTime += dt;
    const pos = this.snow.geometry.attributes.position.array;
    const windX = (1.2 + this.storm * 7) * Math.sin(this._snowTime * 0.4);
    const windZ = 0.6 + this.storm * 3;
    const speedMul = 1 + this.storm * 1.6;
    const cx = followPos.x, cz = followPos.z;
    for (let i = 0; i < this.snowCount; i++) {
      const i3 = i * 3;
      pos[i3] += windX * dt;
      pos[i3 + 1] -= this._snowVel[i] * speedMul * dt;
      pos[i3 + 2] += windZ * dt;
      if (pos[i3 + 1] < 0) {
        pos[i3] = cx + (Math.random() - 0.5) * SNOW_BOX.x;
        pos[i3 + 1] = SNOW_BOX.y;
        pos[i3 + 2] = cz + (Math.random() - 0.5) * SNOW_BOX.z;
      }
      // keep the volume centred on the player
      if (Math.abs(pos[i3] - cx) > SNOW_BOX.x / 2) pos[i3] = cx + (Math.random() - 0.5) * SNOW_BOX.x;
      if (Math.abs(pos[i3 + 2] - cz) > SNOW_BOX.z / 2) pos[i3 + 2] = cz + (Math.random() - 0.5) * SNOW_BOX.z;
    }
    this.snow.geometry.attributes.position.needsUpdate = true;
    this.snow.geometry.setDrawRange(0, Math.floor(this.snowCount * (0.45 + this.storm * 0.55)));

    const targetFog = this.fogBase + this.storm * 0.03;
    this.scene.fog.density += (targetFog - this.scene.fog.density) * Math.min(1, dt * 2);

    // ---- camera follow + shake ----
    this.camTarget.lerp(followPos, Math.min(1, dt * 5));
    this.camera.position.set(
      this.camTarget.x + this.camOffset.x,
      this.camTarget.y + this.camOffset.y,
      this.camTarget.z + this.camOffset.z
    );
    if (this.shake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.6;
      this.camera.position.z += (Math.random() - 0.5) * this.shake;
      this.shake *= Math.max(0, 1 - dt * 7);
    }
    this.camera.lookAt(this.camTarget.x, 0, this.camTarget.z);
  }

  render() {
    this.composer.render();
  }

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this._updateCamOffset();
  }
}
