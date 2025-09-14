// roundManager.js
aframeReady(() => {
  AFRAME.registerComponent("round-manager", {
    schema: {
      spawnBoxes: { type: "boolean", default: true },
      healthMax: { type: "int", default: 5 },
    },
    init() {
      this.enemies = [];
      this.killed = 0;
      this.round = 1;
      this.recorder = null;
      this.ghostReplay = null;
      this.damageThisRound = 0;

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
      this.damageThisRound = 0;
      this.updateHUD();
      // Collect spawn points (dynamic difficulty grows with round)
      const spawns = Array.from(
        this.el.sceneEl.querySelectorAll(".enemy-spawn")
      );
      const baseCount = 3;
      const addPerRound = 2;
      const toSpawn = baseCount + (this.round - 1) * addPerRound;
      if (this.data.spawnBoxes) {
        for (let i = 0; i < toSpawn; i++) {
          const enemy = document.createElement("a-entity");
          const pos = spawns.length
            ? spawns[i % spawns.length].getAttribute("position")
            : { x: Math.random() * 10 - 5, y: 1, z: Math.random() * 10 - 5 };
          enemy.setAttribute("position", `${pos.x} ${pos.y} ${pos.z}`);
          enemy.setAttribute(
            "geometry",
            "primitive: box; width:0.35; height:0.6; depth:0.35"
          );
          enemy.setAttribute(
            "material",
            "color:#5a5a5a; emissive:#121212; roughness:0.85"
          );
          enemy.setAttribute("hittable", "");
          enemy.setAttribute("enemy", "");
          enemy.setAttribute("enemy-mover", "");
          enemy.setAttribute("enemy-laser", "");
          this.el.sceneEl.appendChild(enemy);
          this.enemies.push(enemy);
        }
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
        this.round++;
        this.startRound();
        this.el.sceneEl.emit("roundrestart", { round: this.round });
      }, 10000); // 10 seconds replay
    },
    playerHit() {
      this.damageThisRound++;
      this.updateHUD();
      if (this.damageThisRound >= this.data.healthMax) {
        this.playerDead();
      }
    },
    playerDead() {
      // Emit event for external systems (e.g., UI, sounds)
      this.el.sceneEl.emit("playerDead", {
        round: this.round,
        damage: this.damageThisRound,
      });
      // Quick fade / reset approach: immediately restart round (could add delay or death screen)
      this.startRound();
    },
    updateHUD() {
      const el = document.getElementById("damageCount");
      if (el) {
        el.textContent = `${this.damageThisRound}/${this.data.healthMax}`;
      }
      const roundEl = document.getElementById("roundNum");
      if (roundEl) roundEl.textContent = this.round;
    },
  });
});
