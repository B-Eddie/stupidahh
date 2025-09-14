// gooseBetterPhysics.js - Continuous collision detection + substep gravity for geese
// Approach:
// 1. Maintain a cached list of static solids' AABBs.
// 2. Integrate gravity in fixed substeps (e.g., 4 per frame) for stability.
// 3. Each substep: apply vertical velocity, then resolve vertical penetration (floor/ceiling),
//    then apply horizontal intent (from external movement) with swept resolution per axis.
// 4. Downward ray assist: if falling and within snap epsilon of a surface, snap & zero velocity.
// 5. Track lastSafeGround position for recovery if they ever fall through.
(function () {
  if (!window.AFRAME) return;
  function collectSolids(scene) {
    return Array.from(scene.querySelectorAll(".solid"))
      .map((el) => ({ el, mesh: el.getObject3D("mesh") }))
      .filter((e) => e.mesh)
      .map((e) => ({ el: e.el, box: new THREE.Box3().setFromObject(e.mesh) }));
  }
  function rebuild(component) {
    component.solids = collectSolids(component.el.sceneEl);
    component.lastRebuild = performance.now();
  }
  AFRAME.registerComponent("goose-physics-ccd", {
    schema: {
      radius: { type: "number", default: 0.25 },
      height: { type: "number", default: 0.55 },
      gravity: { type: "number", default: -9.8 },
      maxFall: { type: "number", default: -30 },
      substeps: { type: "int", default: 4 },
      rebuildMs: { type: "int", default: 2000 },
      groundSnap: { type: "number", default: 0.08 },
      floorMinY: { type: "number", default: -5 },
      recoveryY: { type: "number", default: 0.2 },
      debug: { type: "boolean", default: false },
    },
    init() {
      this.solids = [];
      this.lastRebuild = 0;
      this.velY = 0;
      this.prevPos = new THREE.Vector3();
      this.lastSafeGround = new THREE.Vector3(0, this.data.recoveryY, 0);
      this.tmpVec = new THREE.Vector3();
      rebuild(this);
      setTimeout(() => rebuild(this), 600);
      this.el.sceneEl.addEventListener("object3dset", (e) => {
        if (e.detail.type === "mesh" && e.target.classList.contains("solid"))
          this.lastRebuild = 0;
      });
    },
    tick(t, dt) {
      if (!dt) return;
      if (performance.now() - this.lastRebuild > this.data.rebuildMs)
        rebuild(this);
      const o = this.el.object3D;
      const pos = o.position;
      const moveX = pos.x - this.prevPos.x; // external horizontal movement already applied
      const moveZ = pos.z - this.prevPos.z;
      const sub = Math.max(1, this.data.substeps);
      const dtSec = dt / 1000;
      const step = dtSec / sub;
      for (let i = 0; i < sub; i++) {
        // Apply gravity
        this.velY += this.data.gravity * step;
        if (this.velY < this.data.maxFall) this.velY = this.data.maxFall;
        pos.y += this.velY * step;
        // Vertical resolve (floor/ceiling)
        this._resolveVertical(pos);
        // Apply fractional horizontal motion this substep then resolve
        pos.x = this.prevPos.x + moveX * ((i + 1) / sub);
        this._resolveAxis(pos, "x");
        pos.z = this.prevPos.z + moveZ * ((i + 1) / sub);
        this._resolveAxis(pos, "z");
      }
      // Ground snap assist
      if (this.velY <= 0) {
        const gy = this._nearestGroundBelow(pos, this.data.groundSnap);
        if (gy != null && pos.y - gy <= this.data.groundSnap) {
          pos.y = gy;
          this.velY = 0;
          this.lastSafeGround.copy(pos);
        }
      }
      // Recovery if fell through map
      if (pos.y < this.data.floorMinY) {
        pos.copy(this.lastSafeGround);
        this.velY = 0;
      }
      this.prevPos.copy(pos);
    },
    _resolveVertical(pos) {
      const feet = pos.y;
      const head = feet + this.data.height;
      for (const s of this.solids) {
        const b = s.box;
        // Check overlap range vertically
        if (b.min.y > head || b.max.y < feet) continue;
        // Horizontal overlap for standing / ceiling test
        if (!this._horizOverlap(pos, b)) continue;
        // Feet below top surface (standing on) -> clamp up
        const penetrationDown = b.max.y - feet; // positive if feet under top
        if (penetrationDown >= 0 && penetrationDown <= this.data.height) {
          // We are inside from above -> place on top
          pos.y = b.max.y;
          this.velY = 0;
          this.lastSafeGround.set(pos.x, pos.y, pos.z);
          continue;
        }
        // Ceiling: head penetrates underside
        const penetrationUp = head - b.min.y;
        if (penetrationUp > 0 && b.min.y > feet) {
          pos.y -= penetrationUp + 0.001; // move down just below
          if (this.velY > 0) this.velY = 0;
        }
      }
    },
    _resolveAxis(pos, axis) {
      const r = this.data.radius;
      const feet = pos.y;
      const head = feet + this.data.height;
      for (const s of this.solids) {
        const b = s.box;
        if (b.min.y > head || b.max.y < feet) continue; // vertical non-overlap
        if (!this._horizOverlap(pos, b)) continue;
        // Compute push out along single axis by checking overlap ranges
        if (axis === "x") {
          const leftPen = b.max.x - (pos.x - r);
          const rightPen = pos.x + r - b.min.x;
          if (leftPen > 0 && rightPen > 0) {
            if (leftPen < rightPen) pos.x += leftPen + 0.001;
            else pos.x -= rightPen + 0.001;
          }
        } else if (axis === "z") {
          const frontPen = b.max.z - (pos.z - r);
          const backPen = pos.z + r - b.min.z;
          if (frontPen > 0 && backPen > 0) {
            if (frontPen < backPen) pos.z += frontPen + 0.001;
            else pos.z -= backPen + 0.001;
          }
        }
      }
    },
    _horizOverlap(pos, b) {
      const r = this.data.radius;
      return (
        pos.x + r > b.min.x &&
        pos.x - r < b.max.x &&
        pos.z + r > b.min.z &&
        pos.z - r < b.max.z
      );
    },
    _nearestGroundBelow(pos, maxDist) {
      let best = null;
      let bestDelta = Infinity;
      for (const s of this.solids) {
        const b = s.box;
        const top = b.max.y;
        if (top <= pos.y && pos.y - top <= maxDist) {
          if (this._horizOverlap(pos, b)) {
            const d = pos.y - top;
            if (d < bestDelta) {
              bestDelta = d;
              best = top;
            }
          }
        }
      }
      return best;
    },
  });
})();
