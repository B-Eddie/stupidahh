// ghostReplay.js
aframeReady(() => {
  AFRAME.registerComponent("ghost-replay", {
    schema: {
      recordedData: { type: "array", default: [] },
    },
    init() {
      this.ghost = document.createElement("a-entity");
      this.ghost.setAttribute("id", "ghost");
      this.ghost.setAttribute("material", "color", "blue; opacity: 0.5");
      this.ghost.setAttribute(
        "geometry",
        "primitive: box; width: 0.5; height: 1.8; depth: 0.5"
      );
      this.el.sceneEl.appendChild(this.ghost);

      this.startTime = performance.now();
      this.shotIndex = 0;
      this.positionIndex = 0;
    },
    tick() {
      const now = performance.now();
      const elapsed = now - this.startTime;

      // Update position
      while (
        this.positionIndex < this.data.recordedData.length &&
        this.data.recordedData[this.positionIndex].time <= elapsed
      ) {
        if (this.data.recordedData[this.positionIndex].type === "position") {
          this.ghost.object3D.position.copy(
            this.data.recordedData[this.positionIndex].position
          );
        }
        this.positionIndex++;
      }

      // Fire shots
      while (
        this.shotIndex < this.data.recordedData.length &&
        this.data.recordedData[this.shotIndex].time <= elapsed
      ) {
        if (this.data.recordedData[this.shotIndex].type === "shot") {
          this.fireGhostShot(this.data.recordedData[this.shotIndex]);
        }
        this.shotIndex++;
      }
    },
    fireGhostShot(shotData) {
      const origin = shotData.position;
      const direction = shotData.direction;
      const tracerLen = 30;
      const end = origin
        .clone()
        .add(direction.clone().multiplyScalar(tracerLen));
      const line = document.createElement("a-entity");
      line.setAttribute(
        "line",
        `start: ${origin.x} ${origin.y} ${origin.z}; end: ${end.x} ${end.y} ${end.z}; opacity: 0.7; color: blue`
      );
      line.setAttribute("material", "shader: line; linewidth: 4");
      this.el.sceneEl.appendChild(line);
      setTimeout(() => line.remove(), 60);

      // Check if hits player
      const raycaster = new THREE.Raycaster(origin, direction, 0, tracerLen);
      const meshes = [];
      this.el.sceneEl.object3D.traverse((obj) => {
        if (obj.userData && obj.userData.player) meshes.push(obj);
      });
      const hits = raycaster.intersectObjects(meshes, true);
      if (hits.length) {
        // Player hit
        this.el.sceneEl.emit("playerHit");
      }
    },
    reset() {
      this.startTime = performance.now();
      this.shotIndex = 0;
      this.positionIndex = 0;
    },
  });
});
