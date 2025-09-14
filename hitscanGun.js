// hitscanGun.js
aframeReady(() => {
  AFRAME.registerComponent("hitscan-gun", {
    init() {
      const el = this.el;
      // Listen to controller button events
      el.addEventListener("triggerdown", () => this.fire());
      // Desktop: left mouse for testing
      window.addEventListener("mousedown", (e) => {
        if (AFRAME.scenes[0].is("vr-mode")) return; // ignore in VR
        if (e.button === 0) this.fire();
      });
    },
    fire() {
      const muzzle = this.el.object3D;
      // Build a ray from the gun's forward direction
      const origin = new THREE.Vector3();
      const direction = new THREE.Vector3(0, 0, -1);
      muzzle.getWorldPosition(origin);
      muzzle.getWorldDirection(direction);

      // Visualize a brief tracer (avoid deprecated/unknown 'line' shader)
      const tracerLen = 30; // meters
      const end = origin.clone().add(direction.clone().multiplyScalar(tracerLen));
      const tracer = document.createElement("a-entity");
      if (AFRAME.components && AFRAME.components["line"]) {
        tracer.setAttribute(
          "line",
          `start: ${origin.x} ${origin.y} ${origin.z}; end: ${end.x} ${end.y} ${end.z}; color: #ffeb91`
        );
        tracer.setAttribute("material", "color: #ffeb91; transparent: true; opacity: 0.9");
      } else {
        // Fallback: thin cylinder aligned along direction
        const mid = origin.clone().add(end).multiplyScalar(0.5);
        const cyl = document.createElement("a-entity");
        const height = tracerLen;
        // Compute rotation to align cylinder forward (0 1 0 base orientation => align with direction)
        const up = new THREE.Vector3(0, 1, 0);
        const quat = new THREE.Quaternion().setFromUnitVectors(up, direction.clone().normalize());
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
      const raycaster = new THREE.Raycaster(origin, direction, 0, tracerLen);
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
    },
  });
});
