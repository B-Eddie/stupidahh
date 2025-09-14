// goosePhysics.js - lightweight gravity + collision for geese
// Geese are small; use a simplified capsule approximated by a box.
// Handles: gravity, ground snap, step-up over small ledges, horizontal collision push.
// Assumes static world solids have class="solid" (same as player system).
(function () {
  if (!window.AFRAME) return;
  function buildStaticCache(sceneEl) {
    const solids = Array.from(sceneEl.querySelectorAll(".solid"));
    const list = [];
    solids.forEach((el) => {
      const mesh = el.getObject3D("mesh");
      if (!mesh) return;
      const box = new THREE.Box3().setFromObject(mesh);
      list.push({ el, box });
    });
    return list;
  }
  AFRAME.registerComponent("goose-gravity-collision", {
    schema: {
      width: { type: "number", default: 0.5 },
      depth: { type: "number", default: 0.5 },
      height: { type: "number", default: 0.6 }, // goose body height
      gravity: { type: "number", default: -9.8 },
      maxFall: { type: "number", default: -25 },
      stepHeight: { type: "number", default: 0.35 },
      yOffset: { type: "number", default: 0 },
      groundEpsilon: { type: "number", default: 0.03 },
      rayLength: { type: "number", default: 0.8 },
      rebuildMs: { type: "int", default: 1000 },
      debug: { type: "boolean", default: false },
    },
    init() {
      this.velY = 0;
      this.tmpDown = new THREE.Vector3(0, -1, 0);
      this.ray = new THREE.Raycaster();
      this.tmpOrigin = new THREE.Vector3();
      this.staticCache = [];
      this.needsRebuild = true;
      this.lastRebuild = 0;
      setTimeout(() => this.rebuildCache(), 600);
      this.el.sceneEl.addEventListener("object3dset", (e) => {
        if (e.detail.type === "mesh" && e.target.classList.contains("solid")) {
          this.needsRebuild = true;
        }
      });
    },
    rebuildCache() {
      this.staticCache = buildStaticCache(this.el.sceneEl);
      this.needsRebuild = false;
      this.lastRebuild = performance.now();
      if (this.data.debug)
        console.log("[goose-phys] rebuilt solids", this.staticCache.length);
    },
    _groundHit() {
      const o = this.el.object3D;
      o.getWorldPosition(this.tmpOrigin);
      this.tmpOrigin.y += 0.05; // slight lift
      this.ray.set(this.tmpOrigin, this.tmpDown);
      const hits = this.ray.intersectObjects(
        this.el.sceneEl.object3D.children,
        true
      );
      for (let i = 0; i < hits.length; i++) {
        const h = hits[i];
        const el = h.object && h.object.el;
        if (!el || !el.classList || !el.classList.contains("solid")) continue;
        if (h.distance <= this.data.rayLength) return h;
      }
      return null;
    },
    tick(t, dt) {
      if (dt <= 0) return;
      if (
        this.needsRebuild &&
        performance.now() - this.lastRebuild > this.data.rebuildMs
      ) {
        this.rebuildCache();
      }
      dt = dt / 1000;
      const o = this.el.object3D;
      // Gravity integration first
      this.velY += this.data.gravity * dt;
      if (this.velY < this.data.maxFall) this.velY = this.data.maxFall;
      o.position.y += this.velY * dt;

      // Horizontal collisions & step: treat goose box after vertical move
      this._resolveAxis("x");
      this._resolveAxis("z");
      this._resolveAxis("y"); // final vertical correction + ground snap
    },
    _playerBox() {
      const p = this.el.object3D.position;
      const halfW = this.data.width * 0.5;
      const halfD = this.data.depth * 0.5;
      const baseY = p.y + this.data.yOffset;
      const topY = baseY + this.data.height;
      return { halfW, halfD, baseY, topY };
    },
    _resolveAxis(axis) {
      const p = this.el.object3D.position;
      const { halfW, halfD } = this._playerBox();
      let { baseY, topY } = this._playerBox();
      const min = new THREE.Vector3(p.x - halfW, baseY, p.z - halfD);
      const max = new THREE.Vector3(p.x + halfW, topY, p.z + halfD);
      const box = new THREE.Box3(min, max);
      for (const entry of this.staticCache) {
        const sb = entry.box;
        if (!box.intersectsBox(sb)) continue;
        if (axis === "x") {
          const overlapL = sb.max.x - box.min.x;
          const overlapR = box.max.x - sb.min.x;
          if (overlapL > 0 && overlapL < overlapR) p.x += overlapL + 0.001;
          else p.x -= overlapR + 0.001;
          box.min.x = p.x - halfW;
          box.max.x = p.x + halfW;
        } else if (axis === "z") {
          const overlapF = sb.max.z - box.min.z;
          const overlapB = box.max.z - sb.min.z;
          if (overlapF > 0 && overlapF < overlapB) p.z += overlapF + 0.001;
          else p.z -= overlapB + 0.001;
          box.min.z = p.z - halfD;
          box.max.z = p.z + halfD;
        } else if (axis === "y") {
          const overlapBelow = sb.max.y - box.min.y;
          const overlapAbove = box.max.y - sb.min.y;
          if (overlapBelow > 0 && overlapBelow < overlapAbove) {
            if (overlapBelow <= this.data.stepHeight + 0.01) {
              p.y += overlapBelow; // snap onto surface
              this.velY = 0; // landed
            }
          } else if (overlapAbove > 0) {
            p.y -= overlapAbove + 0.001; // ceiling
            if (this.velY > 0) this.velY = 0;
          }
          baseY = p.y + this.data.yOffset;
          topY = baseY + this.data.height;
          box.min.y = baseY;
          box.max.y = topY;
        }
      }

      // Ground snap using ray (after movement) for gentle landing when slight below epsilon
      if (axis === "y") {
        const hit = this._groundHit();
        if (hit) {
          const dist = p.y - hit.point.y;
          if (dist <= this.data.groundEpsilon && this.velY <= 0) {
            p.y = hit.point.y;
            this.velY = 0;
          }
        }
      }
    },
  });
})();
