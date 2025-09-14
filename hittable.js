// hittable.js
aframeReady(() => {
  AFRAME.registerComponent("hittable", {
    init() {
      const markAll = () => {
        if (!this.el.object3D) return;
        this.el.object3D.traverse((o) => {
          if (o.isMesh) o.userData.hittable = true;
        });
      };
      markAll();
      // GLTF loads async; ensure meshes added later are marked
      this.el.addEventListener("model-loaded", () => markAll());
    },
  });
});
