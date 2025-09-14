// playerGravity.js - simple gravity + jump + ground snap for A-Frame rig
// Adds vertical motion independent from movement-controls (which is horizontal only).
// Usage: add to rig entity: player-gravity-jump="jumpSpeed:4; gravity:-9.8"
// Assumes rig origin is at feet (or close). If not, adjust footOffset.
(function () {
  if (!window.AFRAME) return;
  AFRAME.registerComponent("player-gravity-jump", {
    schema: {
      gravity: { type: "number", default: -9.8 }, // m/s^2
      jumpSpeed: { type: "number", default: 4.5 }, // upward impulse
      maxFall: { type: "number", default: -35 },
      groundEpsilon: { type: "number", default: 0.05 },
      footOffset: { type: "number", default: 0 }, // if rig y is already at foot level
      rayLength: { type: "number", default: 1 }, // how far below to search for ground
      groundedGraceMs: { type: "int", default: 120 }, // coyote time after walking off edge
      jumpCooldownMs: { type: "int", default: 180 },
      debug: { type: "boolean", default: false },
      clampFloorY: { type: "number", default: 0 }, // treat this as floor even if ray misses
      hardMinY: { type: "number", default: -10 }, // if below this, snap back to floor center
      arenaHalfSize: { type: "number", default: 0 }, // 0 disables horizontal clamp; else clamp X/Z within +/- value
      respawnCenter: { type: "vec2", default: { x: 0, y: 0 } }, // where to drop player if out-of-bounds plunge occurs
      oobTeleportY: { type: "number", default: 0.05 }, // Y used when teleporting back inside arena
    },
    init() {
      this.velY = 0;
      this.lastGrounded = 0;
      this.lastJumpTime = -Infinity;
      this.tmpOrigin = new THREE.Vector3();
      this.tmpDir = new THREE.Vector3(0, -1, 0);
      this.raycaster = new THREE.Raycaster();
      this.keyDown = {};
      this._prevJumpKey = false; // for edge detection
      this._jumpEdge = false;
      // Zero vertical velocity when collision component performs a step landing.
      this.el.addEventListener("player-stepped", () => {
        if (this.velY < 0) this.velY = 0;
      });
      window.addEventListener("keydown", (e) => {
        this.keyDown[e.code] = true;
      });
      window.addEventListener("keyup", (e) => {
        this.keyDown[e.code] = false;
      });
    },
    _computeJumpEdge() {
      const nowDown = !!this.keyDown["Space"];
      this._jumpEdge = nowDown && !this._prevJumpKey;
      this._prevJumpKey = nowDown;
    },
    _groundCheck() {
      // Raycast from slightly above feet downward
      const obj = this.el.object3D;
      obj.getWorldPosition(this.tmpOrigin);
      this.tmpOrigin.y += 0.05; // small lift to avoid starting inside surface
      this.raycaster.set(this.tmpOrigin, this.tmpDir);
      const intersects = this.raycaster.intersectObjects(
        this.el.sceneEl.object3D.children,
        true
      );
      for (let i = 0; i < intersects.length; i++) {
        const hit = intersects[i];
        if (!hit.object) continue;
        // Must belong to an A-Frame entity with class 'solid'
        const el = hit.object.el;
        if (!el || !el.classList || !el.classList.contains("solid")) continue;
        if (hit.distance <= this.data.rayLength) {
          return hit;
        }
      }
      return null;
    },
    tick(t, dt) {
      if (dt <= 0) return;
      dt = dt / 1000; // seconds
      const obj = this.el.object3D;
      // Update jump edge (done once per frame before input evaluation)
      this._computeJumpEdge();

      // Ground detection
      const hit = this._groundCheck();
      const grounded =
        !!hit &&
        obj.position.y - hit.point.y <= this.data.rayLength + 0.2 &&
        obj.position.y >= hit.point.y - 0.3;

      if (grounded) {
        // Snap to ground if within epsilon and falling
        if (
          obj.position.y - hit.point.y <= this.data.groundEpsilon &&
          this.velY <= 0
        ) {
          obj.position.y = hit.point.y; // align feet to surface
          this.velY = 0;
        }
        this.lastGrounded = performance.now();
        // no double jump; nothing to reset
      }

      // Jump input
      const canJump =
        grounded &&
        performance.now() - this.lastJumpTime > this.data.jumpCooldownMs;
      if (canJump && this._jumpEdge) {
        this.velY = this.data.jumpSpeed;
        this.lastJumpTime = performance.now();
      }

      // Apply gravity
      this.velY += this.data.gravity * dt;
      if (this.velY < this.data.maxFall) this.velY = this.data.maxFall;

      // Integrate
      obj.position.y += this.velY * dt;

      // Prevent sinking through ground (if we overshot after large dt). Check again with simple clamp.
      if (hit && obj.position.y < hit.point.y) {
        obj.position.y = hit.point.y;
        this.velY = 0;
      }

      // Clamp to artificial floor even if no hit (e.g., fell through gap due to missed ray)
      if (obj.position.y < this.data.clampFloorY) {
        obj.position.y = this.data.clampFloorY;
        if (this.velY < 0) this.velY = 0;
      }

      // Out-of-bounds rescue if player somehow drops far below map
      if (obj.position.y < this.data.hardMinY) {
        const cx = this.data.respawnCenter.x || 0;
        const cz = this.data.respawnCenter.y || 0;
        obj.position.set(cx, this.data.oobTeleportY, cz);
        this.velY = 0;
        this.lastGrounded = performance.now();
        if (this.data.debug) {
          console.warn("[player-gravity-jump] OOB recovery triggered");
        }
      }

      // Optional horizontal arena clamp
      if (this.data.arenaHalfSize > 0) {
        const hs = this.data.arenaHalfSize;
        if (obj.position.x > hs) obj.position.x = hs;
        else if (obj.position.x < -hs) obj.position.x = -hs;
        if (obj.position.z > hs) obj.position.z = hs;
        else if (obj.position.z < -hs) obj.position.z = -hs;
      }

      if (this.data.debug) {
        if (!this._lastDbg || performance.now() - this._lastDbg > 250) {
          console.log("[player-gravity-jump]", {
            y: obj.position.y.toFixed(2),
            velY: this.velY.toFixed(2),
            grounded,
            // double jump disabled
          });
          this._lastDbg = performance.now();
        }
      }
    },
  });
})();
