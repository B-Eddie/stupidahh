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
      this.maxRounds = 2;
      this.recorder = null;
      this.ghostReplayEl = null;
      this.damageThisRound = 0;
      this.roundStartTime = performance.now();
      this.totalStartTime = performance.now();
      this.playerShotsPrevRound = [];
      this.enemyShotsPrevRound = []; // goose laser shots
      this.enemyShotLog = []; // temp for current round
      this.uiWin = null;

      this._setupWinUI();

      this.el.sceneEl.addEventListener("enemyKilled", () => {
        this.killed++;
        if (this.killed >= this.enemies.length) {
          this.endRound();
        }
      });

      // When geese are spawned (initial or respawn), refresh enemy list
      this.el.sceneEl.addEventListener("geeseSpawned", () => {
        this.enemies = this._collectCurrentEnemies();
        this.killed = 0;
        this.updateHUD();
      });

      this.el.sceneEl.addEventListener("playerHit", () => {
        this.playerHit();
      });

      // Listen for goose laser shots (we'll emit custom event from enemy-laser)
      this.el.sceneEl.addEventListener("enemyLaserShot", (e) => {
        // e.detail: {start:THREE.Vector3, end:THREE.Vector3}
        const now = performance.now() - this.roundStartTime;
        if (!this.roundStartTime) return; // guard if fired too early
        this.enemyShotLog.push({
          time: now,
          type: "enemyShot",
          start: e.detail.start.clone(),
          end: e.detail.end.clone(),
        });
      });

      this.startRound();
    },
    _setupWinUI() {
      let ui = document.getElementById("winOverlay");
      if (!ui) {
        ui = document.createElement("div");
        ui.id = "winOverlay";
        ui.style.cssText =
          "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);font-family:monospace;color:#3eff8c;background:rgba(0,0,0,0.8);padding:20px 28px;border:2px solid #3eff8c;border-radius:10px;z-index:20;display:none;text-align:center;min-width:240px;";
        ui.innerHTML =
          '<div id="winTitle" style="font-size:20px;margin-bottom:8px;">YOU WIN</div><div id="winTime" style="font-size:14px;margin-bottom:12px;"></div><button id="restartBtn" style="display:none;font-family:inherit;font-size:14px;padding:6px 14px;background:#222;border:1px solid #ff4d4d;color:#ff4d4d;cursor:pointer;border-radius:4px;">RESTART</button>';
        document.body.appendChild(ui);
      }
      this.uiWin = ui;
      const btn = document.getElementById("restartBtn");
      if (btn) btn.addEventListener("click", () => this._restartGame());
    },
    startRound() {
      this.killed = 0;
      this.enemies = this._collectCurrentEnemies();
      this.damageThisRound = 0;
      this.enemyShotLog = [];
      this.roundStartTime = performance.now();
      this.updateHUD();

      // Player recorder
      this.recorder =
        this.el.sceneEl.querySelector("#rig").components["player-recorder"];
      if (this.recorder) this.recorder.reset();

      // Remove old ghost (re-added for round2)
      if (this.ghostReplayEl) {
        this.ghostReplayEl.remove();
        this.ghostReplayEl = null;
      }

      // Respawn geese if starting round2
      if (this.round === 2) {
        this._respawnGeese();
        // Replay previous round ghost (player) & enemy shots
        this._spawnRound2Ghosts();
        this._roundCue();
      }
    },
    _collectCurrentEnemies() {
      // All geese have component 'enemy'; gather live ones
      return Array.from(this.el.sceneEl.querySelectorAll("[enemy]"));
    },
    _respawnGeese() {
      // Use existing spawn manager component if present; if not, rebuild by reloading goose-spawn-manager
      const spawnMgr = this.el.sceneEl.querySelector("#mapRoot");
      if (spawnMgr && spawnMgr.components["goose-spawn-manager"]) {
        // Simple approach: remove existing geese then call spawnAll again.
        const geese = this.el.sceneEl.querySelectorAll("[data-goose-id]");
        geese.forEach((g) => g.remove());
        spawnMgr.components["goose-spawn-manager"].spawnAll();
      }
      // Update enemies list after respawn
      this.enemies = this._collectCurrentEnemies();
    },
    endRound() {
      // Store recordings from this round for next
      const playerData = this.recorder ? this.recorder.getRecordedData() : [];
      this.playerShotsPrevRound = playerData; // contains positions & shots
      this.enemyShotsPrevRound = this.enemyShotLog.slice();

      if (this.round < this.maxRounds) {
        this.round++;
        this.startRound();
      } else {
        this._showWin();
      }
    },
    _spawnRound2Ghosts() {
      // Player ghost
      if (this.playerShotsPrevRound && this.playerShotsPrevRound.length) {
        this.ghostReplayEl = document.createElement("a-entity");
        this.ghostReplayEl.setAttribute(
          "ghost-replay",
          `recordedData: ${JSON.stringify(this.playerShotsPrevRound)}`
        );
        this.el.sceneEl.appendChild(this.ghostReplayEl);
      }
      // Enemy shot replays (create timed hazard spawner)
      if (this.enemyShotsPrevRound && this.enemyShotsPrevRound.length) {
        const hazardHost = document.createElement("a-entity");
        hazardHost.setAttribute(
          "enemy-shot-replay",
          `shots: ${JSON.stringify(this.enemyShotsPrevRound)}`
        );
        this.el.sceneEl.appendChild(hazardHost);
      }
    },
    _showWin() {
      if (!this.uiWin) return;
      const totalMs = performance.now() - this.totalStartTime;
      const secs = (totalMs / 1000).toFixed(2);
      const timeEl = document.getElementById("winTime");
      if (timeEl) timeEl.textContent = `Total Time: ${secs}s`;
      const title = document.getElementById("winTitle");
      if (title) {
        title.textContent = "YOU WIN";
        title.style.color = "#3eff8c";
      }
      this.uiWin.style.display = "block";
    },
    playerHit() {
      this.damageThisRound++;
      this.updateHUD();
      if (this.damageThisRound >= this.data.healthMax) {
        this.playerDead();
      }
    },
    playerDead() {
      this.el.sceneEl.emit("playerDead", {
        round: this.round,
        damage: this.damageThisRound,
      });
      // Could implement restart; for now just show partial defeat UI overlay
      if (this.uiWin) {
        this.uiWin.style.display = "block";
        const title = document.getElementById("winTitle");
        if (title) {
          title.textContent = "YOU DIED";
          title.style.color = "#ff4d4d";
        }
        const timeEl = document.getElementById("winTime");
        if (timeEl) timeEl.textContent = "Press restart to try again";
        const btn = document.getElementById("restartBtn");
        if (btn) btn.style.display = "inline-block";
      }
    },
    updateHUD() {
      const el = document.getElementById("damageCount");
      if (el) el.textContent = `${this.damageThisRound}/${this.data.healthMax}`;
      const roundEl = document.getElementById("roundNum");
      if (roundEl) roundEl.textContent = this.round;
    },
    _roundCue() {
      console.log(`[round-manager] Starting Round ${this.round}`);
      const hud = document.querySelector(".hud");
      if (hud) {
        const oldBg = hud.style.background;
        hud.style.transition = "background 0.25s";
        hud.style.background = "rgba(255,80,80,0.15)";
        setTimeout(() => (hud.style.background = oldBg), 400);
      }
    },
    _restartGame() {
      if (this.uiWin) this.uiWin.style.display = "none";
      const btn = document.getElementById("restartBtn");
      if (btn) btn.style.display = "none";
      const title = document.getElementById("winTitle");
      if (title) {
        title.textContent = "YOU WIN";
        title.style.color = "#3eff8c";
      }
      const timeEl = document.getElementById("winTime");
      if (timeEl) timeEl.textContent = "";
      // Remove ghost & shot replay entities
      if (this.ghostReplayEl) {
        this.ghostReplayEl.remove();
        this.ghostReplayEl = null;
      }
      const shotReplay = this.el.sceneEl.querySelector("[enemy-shot-replay]");
      if (shotReplay) shotReplay.remove();
      // Remove existing geese
      this.el.sceneEl
        .querySelectorAll("[data-goose-id]")
        .forEach((g) => g.remove());
      // Reset core state
      this.round = 1;
      this.totalStartTime = performance.now();
      this.playerShotsPrevRound = [];
      this.enemyShotsPrevRound = [];
      this.enemyShotLog = [];
      this.damageThisRound = 0;
      this.killed = 0;
      // Respawn geese and restart round flow
      this._respawnGeese();
      const rig = this.el.sceneEl.querySelector("#rig");
      if (rig) rig.object3D.position.set(0, 0, 0);
      this.startRound();
    },
  });
});
