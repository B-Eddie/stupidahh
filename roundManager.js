// roundManager.js
aframeReady(() => {
  AFRAME.registerComponent("round-manager", {
    init() {
      this.enemies = [];
      this.killed = 0;
      this.round = 1;
      this.recorder = null;
      this.ghostReplay = null;

      this.el.sceneEl.addEventListener("enemyKilled", () => {
        this.killed++;
        if (this.killed >= this.enemies.length) {
          this.endRound();
        }
      });

      this.el.sceneEl.addEventListener("playerHit", () => {
        this.playerHit();
      });

      this.startRound();
    },
    startRound() {
      this.killed = 0;
      this.enemies = [];
      // Spawn enemies
      for (let i = 0; i < 3; i++) {
        const enemy = document.createElement("a-entity");
        enemy.setAttribute(
          "position",
          `${Math.random() * 10 - 5} 1 ${Math.random() * 10 - 5}`
        );
        enemy.setAttribute(
          "geometry",
          "primitive: box; width: 1; height: 2; depth: 1"
        );
        enemy.setAttribute("material", "color", "green");
        enemy.setAttribute("hittable", "");
        enemy.setAttribute("enemy", "");
        this.el.sceneEl.appendChild(enemy);
        this.enemies.push(enemy);
      }

      // Get recorder
      this.recorder =
        this.el.sceneEl.querySelector("#rig").components["player-recorder"];
      if (this.recorder) {
        this.recorder.reset();
      }

      // Remove ghost if exists
      const ghost = this.el.sceneEl.querySelector("#ghost");
      if (ghost) {
        ghost.remove();
      }
    },
    endRound() {
      // Get recorded data
      const data = this.recorder ? this.recorder.getRecordedData() : [];

      // Start replay
      this.ghostReplay = document.createElement("a-entity");
      this.ghostReplay.setAttribute(
        "ghost-replay",
        `recordedData: ${JSON.stringify(data)}`
      );
      this.el.sceneEl.appendChild(this.ghostReplay);

      // Reset player position
      const rig = this.el.sceneEl.querySelector("#rig");
      rig.object3D.position.set(0, 0, 0);

      // Next round after some time
      setTimeout(() => {
        this.startRound();
      }, 10000); // 10 seconds replay
    },
    playerHit() {
      // For now, just reset
      this.startRound();
    },
  });
});
