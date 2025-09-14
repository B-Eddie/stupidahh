// gooseGrounding.js - Fail-safe grounded movement for geese
// Strategy: treat geese as always ground-constrained unless falling off an edge.
// Multi-ray downward sampling each frame chooses best ground height; horizontal collision prevents passing through solids.
// If ground lost for N frames, apply gravity until ground reacquired; if below hard limit, teleport to last safe.
(function () {
  if (!window.AFRAME) return;
  const DOWN = new THREE.Vector3(0, -1, 0);
  function collectSolids(scene) {
    return Array.from(scene.querySelectorAll(".solid"))
      .map((el) => ({ el, mesh: el.getObject3D("mesh") }))
      .filter((e) => e.mesh)
      .map((e) => ({ el: e.el, box: new THREE.Box3().setFromObject(e.mesh) }));
  }
  AFRAME.registerComponent("goose-ground-lock", {
    schema: {
      radius: { type: "number", default: 0.28 },
      bodyHeight: { type: "number", default: 0.55 },
      raySpan: { type: "number", default: 0.32 }, // sample circle radius
      rayCount: { type: "int", default: 6 },
      maxSnap: { type: "number", default: 0.6 },
      gravity: { type: "number", default: -20 },
      maxFallVel: { type: "number", default: -35 },
      loseGroundFrames: { type: "int", default: 10 },
      rebuildMs: { type: "int", default: 2500 },
      hardFloorY: { type: "number", default: -6 },
      recoveryY: { type: "number", default: 0.25 },
      debug: { type: "boolean", default: false },
    },
    init() {
      this.solids = [];
      this.lastBuild = 0;
      this.velY = 0;
      this.lastSafe = new THREE.Vector3(0, this.data.recoveryY, 0);
      this.lostFrames = 0;
      this.raycaster = new THREE.Raycaster();
      this.tmpOrigin = new THREE.Vector3();
      this._rebuild();
      setTimeout(() => this._rebuild(), 700);
      this.el.sceneEl.addEventListener("object3dset", (e) => {
        if (e.detail.type === "mesh" && e.target.classList.contains("solid"))
          this.lastBuild = 0;
      });
    },
    _rebuild() {
      this.solids = collectSolids(this.el.sceneEl);
      this.lastBuild = performance.now();
      if (this.data.debug)
        console.log("[goose-ground-lock] solids", this.solids.length);
    },
    tick(t, dt) {
      if (!dt) return;
      if (performance.now() - this.lastBuild > this.data.rebuildMs)
        this._rebuild();
      const obj = this.el.object3D;
      const pos = obj.position;
      // 1. Determine intended horizontal move (already applied externally).
      // 2. Resolve horizontal interpenetration first (keeps on top of platforms edges).
      this._resolveHorizontal(pos);
      // 3. Ground sample
      const groundY = this._sampleGround(pos);
      if (groundY != null) {
        // Re-ground
        if (this.velY < 0) this.velY = 0;
        // If within snap distance apply direct placement, else treat as step down / fall start
        if (pos.y - groundY <= this.data.maxSnap) {
          pos.y = groundY;
          this.lostFrames = 0;
          this.lastSafe.set(pos.x, pos.y, pos.z);
        } else {
          // too far: start falling
          this._applyGravity(pos, dt);
        }
      } else {
        // No ground detected beneath sample points -> apply gravity
        this._applyGravity(pos, dt);
        this.lostFrames++;
      }
      // Hard floor recovery
      if (pos.y < this.data.hardFloorY) {
        pos.copy(this.lastSafe);
        this.velY = 0;
        this.lostFrames = 0;
      }
    },
    _applyGravity(pos, dt) {
      const sec = dt / 1000;
      this.velY += this.data.gravity * sec;
      if (this.velY < this.data.maxFallVel) this.velY = this.data.maxFallVel;
      pos.y += this.velY * sec;
    },
    _resolveHorizontal(pos) {
      const r = this.data.radius;
      const feet = pos.y;
      const head = feet + this.data.bodyHeight;
      for (const s of this.solids) {
        const b = s.box;
        if (b.min.y > head || b.max.y < feet - 0.05) continue;
        const overlapX = pos.x + r > b.min.x && pos.x - r < b.max.x;
        const overlapZ = pos.z + r > b.min.z && pos.z - r < b.max.z;
        if (overlapX && overlapZ) {
          // Push out on shallowest axis
          const penLeft = b.max.x - (pos.x - r);
          const penRight = pos.x + r - b.min.x;
          const penFront = b.max.z - (pos.z - r);
          const penBack = pos.z + r - b.min.z;
          const xPen = Math.min(penLeft, penRight);
          const zPen = Math.min(penFront, penBack);
          if (xPen < zPen) {
            if (penLeft < penRight) pos.x += penLeft + 0.001;
            else pos.x -= penRight + 0.001;
          } else {
            if (penFront < penBack) pos.z += penFront + 0.001;
            else pos.z -= penBack + 0.001;
          }
        }
      }
    },
    _sampleGround(pos) {
      // Cast multiple short rays downward to find highest valid surface
      const rays = this.data.rayCount;
      let best = null; // highest top <= current pos.y + maxSnap
      const span = this.data.raySpan;
      // Always include center
      best = this._rayDown(pos.x, pos.y + 0.2, pos.z, best);
      for (let i = 0; i < rays; i++) {
        const ang = (i / rays) * Math.PI * 2;
        const rx = pos.x + Math.cos(ang) * span;
        const rz = pos.z + Math.sin(ang) * span;
        best = this._rayDown(rx, pos.y + 0.2, rz, best);
      }
      return best;
    },
    _rayDown(x, y, z, currentBest) {
      this.tmpOrigin.set(x, y, z);
      this.raycaster.set(this.tmpOrigin, DOWN);
      const hits = this.raycaster.intersectObjects(
        this.el.sceneEl.object3D.children,
        true
      );
      for (const h of hits) {
        const el = h.object && h.object.el;
        if (!el || !el.classList || !el.classList.contains("solid")) continue;
        const gy = h.point.y; // top surface
        if (gy <= this.el.object3D.position.y + this.data.maxSnap) {
          if (currentBest == null || gy > currentBest) currentBest = gy;
          return currentBest; // because hits sorted by distance
        }
      }
      return currentBest;
    },
  });
})();
