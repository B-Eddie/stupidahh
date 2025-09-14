// enemy.js
aframeReady(() => {
  AFRAME.registerComponent("enemy", {
    schema: {
      explodeColor: { type: "string", default: "#ffae3e" },
      explodeDuration: { type: "int", default: 700 },
      ringColor: { type: "string", default: "#ffefcf" },
      ringDuration: { type: "int", default: 550 },
    },
    init() {
      this._dead = false;
      this.el.addEventListener("hit", () => this.die());
    },
    die() {
      if (this._dead) return;
      this._dead = true;
      const scene = this.el.sceneEl;
      const worldPos = new THREE.Vector3();
      this.el.object3D.getWorldPosition(worldPos);
      // Spawn explosion core (glow sphere)
      const boom = document.createElement("a-entity");
      boom.setAttribute(
        "geometry",
        "primitive:sphere; radius:0.25; segmentsWidth:8; segmentsHeight:8"
      );
      boom.setAttribute(
        "material",
        `color:${this.data.explodeColor}; emissive:${this.data.explodeColor}; emissiveIntensity:1.2; roughness:0.4; transparent:true; opacity:0.9`
      );
      boom.object3D.position.copy(worldPos);
      boom.setAttribute(
        "animation__scale",
        `property: scale; from: 1 1 1; to: 2.8 2.8 2.8; dur:${this.data.explodeDuration}; easing:ease-out`
      );
      boom.setAttribute(
        "animation__fade",
        `property: material.opacity; from:0.9; to:0; dur:${this.data.explodeDuration}; easing:linear`
      );
      scene.appendChild(boom);
      setTimeout(() => boom.remove(), this.data.explodeDuration + 40);

      // Expanding flat ring (shockwave)
      const ring = document.createElement("a-entity");
      ring.object3D.position.copy(worldPos);
      ring.setAttribute(
        "geometry",
        "primitive: ring; radiusInner:0.001; radiusOuter:0.25; segmentsTheta:32"
      );
      ring.setAttribute(
        "material",
        `color:${this.data.ringColor}; emissive:${this.data.ringColor}; transparent:true; opacity:0.85; side:double`
      );
      ring.setAttribute(
        "rotation",
        "-90 0 0" // lay flat
      );
      ring.setAttribute(
        "animation__grow",
        `property: geometry.radiusOuter; from:0.25; to:2.8; dur:${this.data.ringDuration}; easing:linear`
      );
      ring.setAttribute(
        "animation__fade",
        `property: material.opacity; from:0.85; to:0; dur:${this.data.ringDuration}; easing:linear`
      );
      scene.appendChild(ring);
      setTimeout(() => ring.remove(), this.data.ringDuration + 40);

      // Remove enemy immediately so it no longer collides / shoots
      this.el.removeEventListener("hit", this.die);
      this.el.remove();
      scene.emit("enemyKilled", { enemy: this.el });
    },
  });
});
