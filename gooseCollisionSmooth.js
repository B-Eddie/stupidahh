// gooseCollisionSmooth.js - capsule-like collision + gravity for geese
(function () {
  if (!window.AFRAME) return;
  const V3 = THREE.Vector3;
  function gatherSolids(scene) {
    return Array.from(scene.querySelectorAll(".solid"))
      .map((el) => ({ el, mesh: el.getObject3D("mesh") }))
      .filter((e) => e.mesh);
  }
  function aabbFromMesh(mesh, target) {
    if (!target) target = new THREE.Box3();
    return target.setFromObject(mesh);
  }
  AFRAME.registerComponent("goose-collision-smooth", {
    schema: {
      radius: { type: "number", default: 0.26 },
      height: { type: "number", default: 0.55 },
      stepHeight: { type: "number", default: 0.4 },
      stepForwardDot: { type: "number", default: 0.1 },
      gravity: { type: "number", default: -9.5 },
      maxFall: { type: "number", default: -26 },
      rebuildIntervalMs: { type: "int", default: 1600 },
      requireDescending: { type: "boolean", default: true },
      minDescendSpeed: { type: "number", default: -0.06 },
      groundSnapEpsilon: { type: "number", default: 0.035 },
      debug: { type: "boolean", default: false },
    },
    init() {
      this.solids = [];
      this.lastBuild = 0;
      this.contactNormal = new V3();
      this.moveVec = new V3();
      this.tmpToBox = new V3();
      this.prevPos = new V3();
      this.prevY = 0;
      this.velY = 0; // vertical velocity
  this.rayDown = new THREE.Raycaster();
  this.downDir = new THREE.Vector3(0, -1, 0);
      // Prevent enormous first-frame horizontal delta causing false step / slide.
      // Capture starting position after entity is in scene graph.
      const setInitialPrev = () => {
        if (!this.el.object3D) return;
        this.prevPos.copy(this.el.object3D.position);
        this.prevY = this.el.object3D.position.y;
      };
      if (this.el.sceneEl.hasLoaded) {
        setInitialPrev();
      } else {
        this.el.sceneEl.addEventListener("loaded", setInitialPrev, { once: true });
      }
      this._rebuild();
      setTimeout(() => this._rebuild(), 600);
      this.el.sceneEl.addEventListener("object3dset", (e) => {
        if (e.detail.type === "mesh" && e.target.classList.contains("solid"))
          this.lastBuild = 0;
      });

      if (this.data.debug) {
        // Simple wireframe cylinder approximation (radius + height)
        const cyl = document.createElement("a-entity");
        cyl.setAttribute(
          "geometry",
          `primitive:cylinder; radius:${this.data.radius}; height:${this.data.height}; segmentsRadial:12; segmentsHeight:1`
        );
        cyl.setAttribute(
          "material",
          "color:#ff00aa; wireframe:true; opacity:0.6; transparent:true"
        );
        cyl.object3D.position.y = this.data.height * 0.5;
        this.el.appendChild(cyl);
        this._debugEnt = cyl;
      }
    },
    _rebuild() {
      this.solids = gatherSolids(this.el.sceneEl).map((s) => ({
        el: s.el,
        box: aabbFromMesh(s.mesh),
      }));
      this.lastBuild = performance.now();
      if (this.data.debug)
        console.log("[goose-collision-smooth] rebuilt", this.solids.length);
    },
    tick(t, dt) {
      if (!dt) return;
      if (performance.now() - this.lastBuild > this.data.rebuildIntervalMs)
        this._rebuild();
      const obj = this.el.object3D;
      const pos = obj.position;
      const dtSec = dt / 1000;
      // Gravity integration for autonomous vertical motion
      this.velY += this.data.gravity * dtSec;
      if (this.velY < this.data.maxFall) this.velY = this.data.maxFall;
      pos.y += this.velY * dtSec;
      // Vertical penetration resolve (floor & ceiling) before horizontal handling
      this._verticalResolve(pos);
      // Horizontal movement vector (post AI movement) similar to player logic
      this.moveVec.set(pos.x - this.prevPos.x, 0, pos.z - this.prevPos.z);
      let moveLen = this.moveVec.length();
      if (moveLen > 0.00001) this.moveVec.multiplyScalar(1 / moveLen);
      const verticalVel = (pos.y - this.prevY) / dtSec; // apparent vertical velocity
      this._solve(pos, verticalVel, moveLen);
      // Final ray snap to catch tiny gaps between AABB tops (platform seams)
      if (this.velY <= 0) this._rayGroundSnap(pos);
      this.prevPos.copy(pos);
      this.prevY = pos.y;
    },
    _verticalResolve(pos) {
      const feet = pos.y;
      const head = feet + this.data.height;
      for (let i = 0; i < this.solids.length; i++) {
        const b = this.solids[i].box;
        if (b.min.y > head || b.max.y < feet) continue; // vertical non-overlap
        // Horizontal overlap required
        if (
          pos.x + this.data.radius <= b.min.x ||
          pos.x - this.data.radius >= b.max.x ||
          pos.z + this.data.radius <= b.min.z ||
          pos.z - this.data.radius >= b.max.z
        )
          continue;
        // Standing on
        const penDown = b.max.y - feet;
        if (penDown >= -0.001 && penDown <= this.data.height) {
          pos.y = b.max.y; // place on top
          if (this.velY < 0) this.velY = 0;
          continue; // don't evaluate ceiling for same box
        }
        // Ceiling
        const penUp = head - b.min.y;
        if (penUp > 0 && b.min.y > feet) {
          pos.y -= penUp + 0.001;
          if (this.velY > 0) this.velY = 0;
        }
      }
    },
    _solve(pos, verticalVel, moveLen) {
      const r = this.data.radius;
      const rSq = r * r;
      for (let i = 0; i < this.solids.length; i++) {
        const box = this.solids[i].box;
        if (box.min.y > pos.y + this.data.height) continue; // entirely below player
        if (box.max.y < pos.y - 0.2) continue; // entirely above
        const cx = Math.min(Math.max(pos.x, box.min.x), box.max.x);
        const cz = Math.min(Math.max(pos.z, box.min.z), box.max.z);
        const dx = pos.x - cx;
        const dz = pos.z - cz;
        const distSq = dx * dx + dz * dz;
        if (distSq >= rSq) continue;
        const dist = Math.sqrt(Math.max(distSq, 1e-6));
        this.contactNormal.set(dx / dist, 0, dz / dist);
        const penetration = r - dist;
        // Step logic mirroring player-collision-smooth
        const rise = box.max.y - pos.y;
        const descending = verticalVel <= this.data.minDescendSpeed;
        const canRise = rise > 0 && rise <= this.data.stepHeight && descending;
        let toward = false;
        if (moveLen > 0.00001) {
          this.tmpToBox.set(
            (box.min.x + box.max.x) * 0.5 - pos.x,
            0,
            (box.min.z + box.max.z) * 0.5 - pos.z
          );
          const bl = this.tmpToBox.length();
          if (bl > 0.00001) {
            this.tmpToBox.multiplyScalar(1 / bl);
            toward =
              this.moveVec.dot(this.tmpToBox) >= this.data.stepForwardDot;
          }
        }
        const descendingOk =
          !this.data.requireDescending || verticalVel <= 0.05;
        if (canRise && toward && descendingOk) {
          const targetY = box.max.y;
          if (targetY > pos.y + 0.0005) {
            pos.y = targetY;
            if (this.velY < 0) this.velY = 0; // landed
          }
          continue;
        }
        // Horizontal slide resolve
        pos.x += this.contactNormal.x * penetration;
        pos.z += this.contactNormal.z * penetration;
        // Ceiling (when moving upward)
        if (verticalVel > 0) {
          const headY = pos.y + this.data.height;
          if (pos.y < box.min.y - 0.0005 && headY > box.min.y) {
            const pen = headY - box.min.y;
            pos.y -= pen + 0.001;
            if (this.velY > 0) this.velY = 0;
          }
        }
      }
      // Ground snap: find closest supporting box top within epsilon
      let bestRise = Infinity;
      let groundY = null;
      for (let i = 0; i < this.solids.length; i++) {
        const box = this.solids[i].box;
        const top = box.max.y;
        if (top <= pos.y + this.data.groundSnapEpsilon && top >= pos.y - 0.6) {
          // horizontally overlapping?
          if (
            pos.x + this.data.radius > box.min.x &&
            pos.x - this.data.radius < box.max.x &&
            pos.z + this.data.radius > box.min.z &&
            pos.z - this.data.radius < box.max.z
          ) {
            const rise = pos.y - top;
            if (rise >= 0 && rise < bestRise) {
              bestRise = rise;
              groundY = top;
            }
          }
        }
      }
      if (groundY !== null && this.velY <= 0) {
        pos.y = groundY;
        this.velY = 0;
      }
    },
    _rayGroundSnap(pos) {
      // Cast a short ray downward from just above feet to find closest solid surface
      const origin = new THREE.Vector3(pos.x, pos.y + 0.05, pos.z);
      this.rayDown.set(origin, this.downDir);
      const hits = this.rayDown.intersectObjects(
        this.el.sceneEl.object3D.children,
        true
      );
      for (const h of hits) {
        const el = h.object && h.object.el;
        if (!el || !el.classList || !el.classList.contains("solid")) continue;
        const dy = pos.y - h.point.y;
        if (dy >= 0 && dy <= this.data.groundSnapEpsilon + 0.05) {
          pos.y = h.point.y;
          this.velY = 0;
        }
        break; // closest hit only
      }
    },
  });
})();
