// playerCollision.js - basic AABB collision for player vs static solids
// Assumptions:
//  - Player entity (#rig) moves primarily on X/Z plane with manual Y changes (jump)
//  - Static geometry (walls, platforms, crates, barriers, ramps) are boxes added at load
//  - We tag them with class="solid" (done in tacticalMap.js)
//  - This is a lightweight broad-phase (single list) good enough for small counts (< 300)
//  - Uses THREE.Box3 from each object's mesh; recalculated only once & cached since static
//  - Player treated as a capsule approximated by a vertical box (width, depth, height)
// Limitations:
//  - Slanted ramps are axis-aligned boxes so you'll bump against their vertical faces
//  - No sliding along surfaces (simple axis resolution)
//  - No dynamic moving platforms yet
//  - If you teleport inside geometry you may pop out to nearest free side (axis resolution)

(function () {
  if (!window.AFRAME) return;

  function buildStaticCache(sceneEl) {
    const solids = Array.from(sceneEl.querySelectorAll(".solid"));
    const entries = [];
    solids.forEach((el) => {
      const mesh = el.getObject3D("mesh");
      if (!mesh) return; // Wait? We'll listen below.
      const box = new THREE.Box3().setFromObject(mesh);
      entries.push({ el, box });
    });
    return entries;
  }

  AFRAME.registerComponent("player-collision", {
    schema: {
      width: { type: "number", default: 0.6 }, // approximate shoulder width
      depth: { type: "number", default: 0.6 }, // front/back
      height: { type: "number", default: 1.7 }, // standing height
      yOffset: { type: "number", default: 0 }, // if rig origin differs from feet
      stepHeight: { type: "number", default: 0.55 }, // max ledge height we can auto step onto
      stepVerticalClearance: { type: "number", default: 1.4 }, // space above step required (to avoid head clipping)
      debug: { type: "boolean", default: false },
    },
    init() {
      this.prevPos = new THREE.Vector3();
      this.tmpBox = new THREE.Box3();
      this.staticCache = [];
      this.needsRebuild = true;
      this.lastRebuildAttempt = 0;

      // Rebuild after a short delay (tactical map builds async in init phase)
      setTimeout(() => {
        this.rebuildCache();
      }, 500);

      this.el.sceneEl.addEventListener("object3dset", (e) => {
        if (e.detail.type === "mesh" && e.target.classList.contains("solid")) {
          this.needsRebuild = true;
        }
      });
    },
    rebuildCache() {
      this.staticCache = buildStaticCache(this.el.sceneEl);
      this.needsRebuild = false;
      if (this.data.debug) {
        console.log("[player-collision] cache size", this.staticCache.length);
      }
    },
    tick() {
      const now = performance.now();
      if (this.needsRebuild && now - this.lastRebuildAttempt > 200) {
        this.lastRebuildAttempt = now;
        this.rebuildCache();
      }

      const rigObj = this.el.object3D;
      const pos = rigObj.position;

      // Player AABB from current position
      const halfW = this.data.width * 0.5;
      const halfD = this.data.depth * 0.5;
      const baseY = pos.y + this.data.yOffset; // bottom
      const topY = baseY + this.data.height;

      // We'll test each axis separately (x then z then y) for simple resolution
      // Save original
      const originalX = pos.x;
      const originalZ = pos.z;
      const originalY = pos.y;

      // Build candidate boxes per axis
      // Axis X
      this._resolveAxis("x", pos, halfW, halfD, baseY, topY);
      // Axis Z
      this._resolveAxis("z", pos, halfW, halfD, baseY, topY);
      // Axis Y (jump / gravity interactions) limited
      this._resolveAxis("y", pos, halfW, halfD, baseY, topY);
    },
    _resolveAxis(axis, pos, halfW, halfD, baseY, topY) {
      // Compute player box after candidate move (pos already contains updated axis)
      const min = new THREE.Vector3(pos.x - halfW, baseY, pos.z - halfD);
      const max = new THREE.Vector3(pos.x + halfW, topY, pos.z + halfD);
      const playerBox = this.tmpBox.set(min, max);

      for (let i = 0; i < this.staticCache.length; i++) {
        const entry = this.staticCache[i];
        const box = entry.box;
        if (!playerBox.intersectsBox(box)) continue;
        // Detect floor: large extent in X & Z and very thin height near y=0
        const isFloor =
          box.max.y - box.min.y < 0.6 &&
          box.min.y < 0.05 &&
          box.max.x - box.min.x > 30 &&
          box.max.z - box.min.z > 30;
        if (isFloor && (axis === "x" || axis === "z")) {
          // Skip horizontal push for floor to avoid lateral teleport; handle only in Y pass.
          continue;
        }
        // Compute overlap along axis
        if (axis === "x") {
          const overlapLeft = box.max.x - playerBox.min.x; // positive if penetrating from left
          const overlapRight = playerBox.max.x - box.min.x; // positive if penetrating from right
          // Attempt step-up if eligible instead of horizontal push
          if (this._tryStep(box, pos, halfW, halfD, baseY, topY)) {
            // Recompute playerBox after vertical change (x not adjusted)
            const newBase = pos.y + this.data.yOffset;
            playerBox.min.y = newBase;
            playerBox.max.y = newBase + this.data.height;
          } else {
            if (overlapLeft > 0 && overlapLeft < overlapRight) {
              pos.x += overlapLeft + 0.001; // push right
            } else {
              pos.x -= overlapRight + 0.001; // push left
            }
          }
          // Update playerBox for subsequent collisions same axis
          playerBox.min.x = pos.x - halfW;
          playerBox.max.x = pos.x + halfW;
        } else if (axis === "z") {
          const overlapFront = box.max.z - playerBox.min.z;
          const overlapBack = playerBox.max.z - box.min.z;
          if (this._tryStep(box, pos, halfW, halfD, baseY, topY)) {
            const newBase = pos.y + this.data.yOffset;
            playerBox.min.y = newBase;
            playerBox.max.y = newBase + this.data.height;
          } else {
            if (overlapFront > 0 && overlapFront < overlapBack) {
              pos.z += overlapFront + 0.001;
            } else {
              pos.z -= overlapBack + 0.001;
            }
          }
          playerBox.min.z = pos.z - halfD;
          playerBox.max.z = pos.z + halfD;
        } else if (axis === "y") {
          const overlapBelow = box.max.y - playerBox.min.y;
          const overlapAbove = playerBox.max.y - box.min.y;
          if (overlapBelow > 0 && overlapBelow < overlapAbove) {
            // Potentially standing on (or intersecting) top surface of box.
            // Only auto-elevate (land) if the penetration depth is small (<= stepHeight).
            // This prevents mid-air side collisions from teleporting the player upward.
            if (overlapBelow <= this.data.stepHeight + 0.01) {
              // Snap feet to surface without extra upward bump.
              pos.y += overlapBelow; // exact correction (no +epsilon to avoid lift bounce)
              // Let gravity component zero vertical velocity (treat like a step/landing).
              this.el.emit("player-stepped");
            }
            // If overlapBelow is large we treat it like a vertical wall; do not modify Y.
          } else if (overlapAbove > 0) {
            // Ceiling collision: push down.
            pos.y -= overlapAbove + 0.001;
          }
          // Refresh extents
          const newBase = pos.y + this.data.yOffset;
          playerBox.min.y = newBase;
          playerBox.max.y = newBase + this.data.height;
        }
      }
    },
    _tryStep(box, pos, halfW, halfD, baseY, topY) {
      // Check if box top is a small ledge above current base
      const stepHeight = this.data.stepHeight;
      if (stepHeight <= 0) return false;
      const ledgeTop = box.max.y;
      const rise = ledgeTop - baseY;
      if (rise <= 0 || rise > stepHeight) return false; // too high or below
      // Ensure vertical clearance above new position (player head must not intersect box above)
      const newBase = ledgeTop; // feet on top
      const newTop = newBase + this.data.height;
      // Quick clearance test: no other cached box should overlap horizontally & vertically with new AABB
      for (let j = 0; j < this.staticCache.length; j++) {
        const other = this.staticCache[j].box;
        if (other === box) continue;
        // Horizontal overlap check (using new pos.x/z already) & vertical overlap of head region
        const horiz =
          pos.x + halfW > other.min.x &&
          pos.x - halfW < other.max.x &&
          pos.z + halfD > other.min.z &&
          pos.z - halfD < other.max.z;
        if (!horiz) continue;
        if (newTop > other.min.y && newBase < other.max.y) {
          // Would collide after stepping
          return false;
        }
      }
      // Apply step
      pos.y = ledgeTop - this.data.yOffset + 0.001; // slight lift
      return true;
    },
  });
})();
