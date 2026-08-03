import * as THREE from 'three';

/**
 * Unified desktop + mobile input.
 * Desktop: WASD/arrows move, mouse aims (raycast to gun-height plane), LMB fires.
 * Mobile: left virtual joystick moves, right joystick aims + fires while held.
 */
export class Input {
  constructor() {
    this.keys = new Set();
    this.justPressed = new Set();
    this.mouse = new THREE.Vector2(0, 0); // NDC
    this.mousePx = new THREE.Vector2(-100, -100);
    this.mouseDown = false;

    this.isTouch = 'ontouchstart' in window && navigator.maxTouchPoints > 0;

    // touch joystick state
    this.touchMove = new THREE.Vector2(0, 0); // -1..1
    this.touchAim = new THREE.Vector2(0, 0);
    this.touchFiring = false;

    this._raycaster = new THREE.Raycaster();
    this._aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.1); // y = 1.1 (gun height)
    this._aimPoint = new THREE.Vector3();

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (!this.keys.has(e.code)) this.justPressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });

    window.addEventListener('mousemove', (e) => {
      this.mousePx.set(e.clientX, e.clientY);
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0 && !e.target.closest('button, .panel, .overlay')) this.mouseDown = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    window.addEventListener('contextmenu', (e) => {
      if (e.target.tagName === 'CANVAS') e.preventDefault();
    });

    if (this.isTouch) this._setupJoysticks();
  }

  _setupJoysticks() {
    const bind = (el, onMove, onEnd) => {
      if (!el) return;
      let touchId = null;
      const center = new THREE.Vector2();
      const knob = el.querySelector('.joy-knob');
      const radius = 55;

      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        touchId = t.identifier;
        const r = el.getBoundingClientRect();
        center.set(r.left + r.width / 2, r.top + r.height / 2);
        handle(t);
      }, { passive: false });

      const handle = (t) => {
        const dx = t.clientX - center.x;
        const dy = t.clientY - center.y;
        const len = Math.hypot(dx, dy);
        const cl = Math.min(len, radius);
        const nx = len > 0 ? (dx / len) * cl : 0;
        const ny = len > 0 ? (dy / len) * cl : 0;
        if (knob) knob.style.transform = `translate(${nx}px, ${ny}px)`;
        onMove(nx / radius, ny / radius);
      };

      window.addEventListener('touchmove', (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === touchId) handle(t);
        }
      }, { passive: false });

      const end = (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === touchId) {
            touchId = null;
            if (knob) knob.style.transform = 'translate(0,0)';
            onEnd();
          }
        }
      };
      window.addEventListener('touchend', end);
      window.addEventListener('touchcancel', end);
    };

    bind(document.getElementById('joy-move'),
      (x, y) => this.touchMove.set(x, y),
      () => this.touchMove.set(0, 0));

    bind(document.getElementById('joy-aim'),
      (x, y) => {
        this.touchAim.set(x, y);
        this.touchFiring = this.touchAim.length() > 0.25;
      },
      () => {
        this.touchAim.set(0, 0);
        this.touchFiring = false;
      });
  }

  /** Movement vector in world XZ space (screen-up = -Z), normalized. */
  getMoveVector(out) {
    out.set(0, 0);
    if (this.isTouch && this.touchMove.lengthSq() > 0.01) {
      out.copy(this.touchMove);
    } else {
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) out.y -= 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) out.y += 1;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) out.x -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) out.x += 1;
    }
    if (out.lengthSq() > 1) out.normalize();
    return out;
  }

  /** World-space point the player is aiming at (on the gun-height plane). */
  getAimPoint(camera, playerPos) {
    if (this.isTouch) {
      const a = this.touchAim.lengthSq() > 0.02 ? this.touchAim : this._lastTouchAim || new THREE.Vector2(0, -1);
      if (this.touchAim.lengthSq() > 0.02) this._lastTouchAim = this.touchAim.clone();
      this._aimPoint.set(playerPos.x + a.x * 12, 1.1, playerPos.z + a.y * 12);
      return this._aimPoint;
    }
    this._raycaster.setFromCamera(this.mouse, camera);
    if (!this._raycaster.ray.intersectPlane(this._aimPlane, this._aimPoint)) {
      this._aimPoint.set(playerPos.x, 1.1, playerPos.z - 10);
    }
    return this._aimPoint;
  }

  get firing() {
    return this.isTouch ? this.touchFiring : this.mouseDown;
  }

  wasPressed(code) {
    return this.justPressed.has(code);
  }

  /** Call at end of each frame. */
  lateUpdate() {
    this.justPressed.clear();
  }
}
