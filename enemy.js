// enemy.js
aframeReady(() => {
  AFRAME.registerComponent("enemy", {
    init() {
      this.el.addEventListener("hit", (event) => {
        this.die();
      });
    },
    die() {
      // Animate death, e.g., scale down or change color
      this.el.setAttribute("material", "color", "red");
      this.el.setAttribute("animation", "property: scale; to: 0 0 0; dur: 500");
      setTimeout(() => {
        this.el.remove();
        this.el.sceneEl.emit("enemyKilled", { enemy: this.el });
      }, 500);
    },
  });
});
