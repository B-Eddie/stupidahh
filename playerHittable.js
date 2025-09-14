// playerHittable.js
aframeReady(() => {
  AFRAME.registerComponent("player-hittable", {
    init() {
      if (this.el.object3D) {
        this.el.object3D.userData.hittable = true;
        this.el.object3D.userData.player = true;
      }
    },
  });
});
