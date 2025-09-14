// Smoother capsule-like collision with sliding and predictive, lerped stepping.
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

  AFRAME.registerComponent("player-collision-smooth", {
    schema: {
      radius: { type: "number", default: 0.32 },
      height: { type: "number", default: 1.7 },
      stepHeight: { type: "number", default: 0.6 },
      stepLerpMs: { type: "int", default: 0 }, // 0 disables smoothing (direct clamp landing)
      stepForwardDot: { type: "number", default: 0.1 },
      requireDescending: { type: "boolean", default: true },
      minDescendSpeed: { type: "number", default: -0.15 }, // must be descending at least this fast to trigger step
      rebuildIntervalMs: { type: "int", default: 1500 },
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
      this.stepActive = false;
      this.stepStartY = 0;
      this.stepTargetY = 0;
      this.stepStartTime = 0;
      this.stepEndTime = 0;
      this._rebuild();
      setTimeout(() => this._rebuild(), 600);
      this.el.sceneEl.addEventListener("object3dset", (e) => {
        if (e.detail.type === "mesh" && e.target.classList.contains("solid"))
          this._flagRebuild();
      });
    },
    _flagRebuild() {
      this.lastBuild = 0;
    },
    _rebuild() {
      this.solids = gatherSolids(this.el.sceneEl).map((s) => ({
        el: s.el,
        box: aabbFromMesh(s.mesh),
      }));
      this.lastBuild = performance.now();
      if (this.data.debug)
        console.log(
          "[player-collision-smooth] rebuilt solids:",
          this.solids.length
        );
    },
    tick(t, dt) {
      if (!dt) return;
      if (performance.now() - this.lastBuild > this.data.rebuildIntervalMs)
        this._rebuild();
      const obj = this.el.object3D;
      const pos = obj.position;
      // Horizontal movement vector (post movement-controls)
      this.moveVec.set(pos.x - this.prevPos.x, 0, pos.z - this.prevPos.z);
      let moveLen = this.moveVec.length();
      if (moveLen > 0.00001) this.moveVec.multiplyScalar(1 / moveLen);
      const verticalVel = (pos.y - this.prevY) / (dt / 1000);

      this._solveCollisions(pos, verticalVel, moveLen);

      // Step animation
      // Step animation disabled to prevent post-landing upward easing.
      this.stepActive = false;
      this.prevPos.copy(pos);
      this.prevY = pos.y;
    },
    _solveCollisions(pos, verticalVel, moveLen) {
      const r = this.data.radius;
      const rSq = r * r;
      const playerTop = () => pos.y + this.data.height; // helper
      for (let i = 0; i < this.solids.length; i++) {
        const box = this.solids[i].box;
        // vertical reject
        if (box.min.y > pos.y + this.data.height) continue;
        if (box.max.y < pos.y - 0.15) continue;
        // closest point horizontally
        const cx = Math.min(Math.max(pos.x, box.min.x), box.max.x);
        const cz = Math.min(Math.max(pos.z, box.min.z), box.max.z);
        const dx = pos.x - cx;
        const dz = pos.z - cz;
        const distSq = dx * dx + dz * dz;
        if (distSq >= rSq) continue;
        const dist = Math.sqrt(Math.max(distSq, 1e-6));
        this.contactNormal.set(dx / dist, 0, dz / dist);
        const penetration = r - dist;

        // Predictive step check
        const rise = box.max.y - pos.y;
        const descending = verticalVel <= this.data.minDescendSpeed; // clearly falling
        // Only allow stepping if rise is within stepHeight and we're actually descending, not ascending or nearly stationary upward.
        const canRise = rise > 0 && rise <= this.data.stepHeight && descending;
        let toward = false;
        if (moveLen > 0.00001) {
          // direction from player to box center
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
        // Only allow step when descending (or requirement disabled) to avoid mid-ascent snapping
        const descendingOk =
          !this.data.requireDescending || verticalVel <= 0.05;
        if (canRise && toward && descendingOk) {
          const targetY = box.max.y;
          if (targetY > pos.y + 0.0005) {
            pos.y = targetY; // immediate clamp landing (no animation)
            this.el.emit("player-stepped", { y: targetY });
          }
          continue; // skip slide resolve for this contact
        }

        // Slide: push minimally along contact normal
        pos.x += this.contactNormal.x * penetration;
        pos.z += this.contactNormal.z * penetration;

        // Ceiling handling: only if feet are below the box underside and head crosses into it while ascending
        if (verticalVel > 0) {
          const headY = playerTop();
          const undersideY = box.min.y;
          // Feet clearly below underside and head passes into underside plane
          if (pos.y < undersideY - 0.0005 && headY > undersideY) {
            const penetration = headY - undersideY;
            pos.y -= penetration + 0.001; // place just below
            this.el.emit("player-ceiling", { box });
          }
        }
      }
    },
  });
})();
