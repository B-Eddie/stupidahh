// playerSpawnCenter.js - ensures player rig starts at middle of tactical map
(function () {
  if (!window.AFRAME) return;

  AFRAME.registerComponent("player-spawn-center", {
    schema: {
      y: { type: "number", default: 1.6 }, // eye height match camera
      snapToGround: { type: "boolean", default: true },
      groundY: { type: "number", default: 0 }, // assumed floor top y
      offsetX: { type: "number", default: 0 },
      offsetZ: { type: "number", default: 0 },
      epsilon: { type: "number", default: 0.02 }, // raise slightly above ground to avoid initial collision overlap
      autoAvoidSolids: { type: "boolean", default: true },
      minClearRadius: { type: "number", default: 1.2 }, // horizontal clearance from solid AABB footprint
      safeSearchMaxRadius: { type: "number", default: 20 },
      safeSearchStep: { type: "number", default: 1.5 },
    },
    init() {
      // Delay until after tactical-map builds geometry
      setTimeout(() => this.place(), 100);
    },
    place() {
      const pos = this.el.object3D.position;
      const y = this.data.snapToGround
        ? this.data.groundY + this.data.epsilon
        : this.data.y;
      // Base desired spawn
      let spawnX = this.data.offsetX;
      let spawnZ = this.data.offsetZ;

      if (this.data.autoAvoidSolids) {
        const scene = this.el.sceneEl;
        const solids = Array.from(scene.querySelectorAll(".solid"));
        // Precompute AABBs, skip ground-like very flat large floor (max.y <= 0.05 treated as ground) so we don't reject everywhere.
        const solidBoxes = [];
        solids.forEach((el) => {
          const mesh = el.getObject3D("mesh");
          if (!mesh) return;
          const box = new THREE.Box3().setFromObject(mesh);
          if (box.max.y <= 0.05) return; // ignore ground slab
          solidBoxes.push(box);
        });
        const clear = (x, z) => {
          for (let i = 0; i < solidBoxes.length; i++) {
            const b = solidBoxes[i];
            if (
              x >= b.min.x - this.data.minClearRadius &&
              x <= b.max.x + this.data.minClearRadius &&
              z >= b.min.z - this.data.minClearRadius &&
              z <= b.max.z + this.data.minClearRadius
            ) {
              return false;
            }
          }
          return true;
        };
        if (!clear(spawnX, spawnZ)) {
          // Spiral/radial search for nearest clear point
          let found = false;
          const step = this.data.safeSearchStep;
          for (
            let r = step;
            r <= this.data.safeSearchMaxRadius && !found;
            r += step
          ) {
            // sample 8 directions per ring
            for (let k = 0; k < 16; k++) {
              const ang = (Math.PI * 2 * k) / 16;
              const cx = spawnX + Math.cos(ang) * r;
              const cz = spawnZ + Math.sin(ang) * r;
              if (clear(cx, cz)) {
                spawnX = cx;
                spawnZ = cz;
                found = true;
                break;
              }
            }
          }
        }
      }

      pos.set(spawnX, y, spawnZ);
      if (this.data.debug) {
        console.log("[player-spawn-center] spawn pos", pos.toArray());
      }
      this.el.emit("player-spawned", { position: pos.clone() });
    },
  });
})();
