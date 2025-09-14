// hitscanGun.js
aframeReady(() => {
  AFRAME.registerComponent("hitscan-gun", {
    schema: {
      forwardAxis: { type: "string", default: "-z" }, // which local axis is barrel forward: -z (default A-Frame), -y (some hand models), +z, +x, -x, +y
      useCameraForwardInAR: { type: "boolean", default: true }, // override to camera forward if AR mode detected
      debug: { type: "boolean", default: false }, // draw a persistent debug ray
      tracerLength: { type: "number", default: 30 },
    },
    init() {
      const el = this.el;
      // Listen to controller button events
      el.addEventListener("triggerdown", () => this.fire());
      // Desktop: left mouse for testing
      window.addEventListener("mousedown", (e) => {
        if (AFRAME.scenes[0].is("vr-mode")) return; // ignore in VR
        if (e.button === 0) this.fire();
      });
      if (this.data.debug) this.spawnDebugRay();
    },
    update(oldData) {
      if (this.data.debug && !oldData.debug) this.spawnDebugRay();
      if (!this.data.debug && oldData.debug && this.debugEntity) {
        this.debugEntity.remove();
        this.debugEntity = null;
      }
    },
    spawnDebugRay() {
      if (this.debugEntity) return;
      const dbg = document.createElement("a-entity");
      dbg.setAttribute(
        "geometry",
        `primitive: cylinder; radius: 0.005; height: ${this.data.tracerLength}`
      );
      dbg.setAttribute(
        "material",
        "color: #00ffaa; opacity: 0.4; transparent: true; emissive: #00ffaa"
      );
      dbg.classList.add("hitscan-debug");
      this.el.appendChild(dbg);
      this.debugEntity = dbg;
    },
    computeDirection() {
      const scene = this.el.sceneEl;
      const isAR = scene && scene.is && scene.is("ar-mode");
      if (isAR && this.data.useCameraForwardInAR && scene.camera) {
        const v = new THREE.Vector3();
        scene.camera.getWorldDirection(v);
        return v.normalize();
      }
      return AFRAME.utils.directionUtil.getForward(
        this.el,
        this.data.forwardAxis
      );
    },
    fire() {
      const muzzle = this.el.object3D;
      // Build a ray from the gun's forward direction
      const origin = new THREE.Vector3();
      const direction = this.computeDirection();
      muzzle.getWorldPosition(origin);

      // Visualize a brief tracer (avoid deprecated/unknown 'line' shader)
      const tracerLen = this.data.tracerLength; // meters
      const end = origin
        .clone()
        .add(direction.clone().multiplyScalar(tracerLen));
      const tracer = document.createElement("a-entity");
      if (AFRAME.components && AFRAME.components["line"]) {
        tracer.setAttribute(
          "line",
          `start: ${origin.x} ${origin.y} ${origin.z}; end: ${end.x} ${end.y} ${end.z}; color: #ffeb91`
        );
        tracer.setAttribute(
          "material",
          "color: #ffeb91; transparent: true; opacity: 0.9"
        );
      } else {
        // Fallback: thin cylinder aligned along direction
        const mid = origin.clone().add(end).multiplyScalar(0.5);
        const cyl = document.createElement("a-entity");
        const height = tracerLen;
        // Compute rotation to align cylinder forward (0 1 0 base orientation => align with direction)
        const up = new THREE.Vector3(0, 1, 0);
        const quat = new THREE.Quaternion().setFromUnitVectors(
          up,
          direction.clone().normalize()
        );
        const euler = new THREE.Euler().setFromQuaternion(quat, "YXZ");
        cyl.setAttribute(
          "geometry",
          `primitive: cylinder; radius: 0.01; height: ${height}`
        );
        cyl.setAttribute(
          "material",
          "color: #ffeb91; emissive: #ffeb91; transparent: true; opacity: 0.9"
        );
        cyl.object3D.position.copy(mid);
        cyl.object3D.rotation.copy(euler);
        tracer.appendChild(cyl);
      }
      this.el.sceneEl.appendChild(tracer);
      setTimeout(() => tracer.remove(), 60);

      // Do a raycast to detect hits (e.g., enemies)
      const raycaster = new THREE.Raycaster(
        origin,
        direction.clone(),
        0,
        tracerLen
      );
      const meshes = [];
      this.el.sceneEl.object3D.traverse((obj) => {
        if (obj.userData && obj.userData.hittable) meshes.push(obj);
      });
      const hits = raycaster.intersectObjects(meshes, true);
      if (hits.length) {
        const hit = hits[0].object;
        // Example reaction: briefly tint the hit object
        const old =
          hit.material && hit.material.color
            ? hit.material.color.clone()
            : null;
        if (hit.material && hit.material.color) {
          hit.material.color.setRGB(1, 0.2, 0.2);
          setTimeout(() => old && hit.material.color.copy(old), 120);
        }
        // Emit event for hit
        this.el.emit("hit", { target: hit });
      }
      // Emit shot event
      this.el.emit("shot", {
        position: origin.clone(),
        direction: direction.clone(),
      });
      if (this.debugEntity) {
        // Reposition debug ray
        const dbgObj = this.debugEntity.object3D;
        dbgObj.position.set(0, 0, 0);
        // Align cylinder whose up axis is Y to our direction
        const up = new THREE.Vector3(0, 1, 0);
        const quat = new THREE.Quaternion().setFromUnitVectors(
          up,
          direction.clone().normalize()
        );
        dbgObj.setRotationFromQuaternion(quat);
        dbgObj.position.copy(
          direction.clone().multiplyScalar(this.data.tracerLength / 2)
        );
      }
    },
    remove() {
      window.removeEventListener("mousedown", this.fire);
      if (this.debugEntity) this.debugEntity.remove();
    },
  });
});
