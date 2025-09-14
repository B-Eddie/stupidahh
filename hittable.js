// hittable.js
aframeReady(() => {
  AFRAME.registerComponent("hittable", {
    init() {
      if (this.el.object3D) {
        this.el.object3D.userData.hittable = true;
      }
    },
  });
});
