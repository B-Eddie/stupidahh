// playerRecorder.js
aframeReady(() => {
  AFRAME.registerComponent("player-recorder", {
    init() {
      this.recordedData = [];
      this.startTime = performance.now();
      this.lastRecordTime = 0;
      this.recordInterval = 100; // ms
  // Jump state
  this.isJumping = false;
  this.jumpCooldown = false;
  this.jumpHeight = 1.2; // meters
  this.jumpDuration = 400; // ms
  this.groundY = null;

      // Listen to shots from the gun
      const gun = this.el.querySelector("#rightHand");
      if (gun) {
        gun.addEventListener("shot", (event) => {
          const time = performance.now() - this.startTime;
          this.recordedData.push({
            time: time,
            type: "shot",
            position: event.detail.position,
            direction: event.detail.direction,
          });
        });
      }
      // Keyboard jump (space)
      window.addEventListener("keydown", (e) => {
        if (e.code === "Space") {
          this.triggerJump();
        }
      });

      // VR controller jump (primary button on right hand)
      this.el.sceneEl.addEventListener("controllerbuttondown", (evt) => {
        // evt.detail = {hand, button}
        if (evt.detail && evt.detail.hand === "right" && evt.detail.button === "a") {
          this.triggerJump();
        }
      });
    },
    tick() {
      const now = performance.now();
      if (now - this.lastRecordTime > this.recordInterval) {
        const time = now - this.startTime;
        const position = this.el.object3D.position.clone();
        this.recordedData.push({
          time: time,
          type: "position",
          position: position,
        });
        this.lastRecordTime = now;
      }
      // Handle jump animation
      if (this.isJumping) {
        const elapsed = now - this.jumpStartTime;
        if (elapsed < this.jumpDuration) {
          // Simple parabolic jump
          const t = elapsed / this.jumpDuration;
          const y = this.groundY + this.jumpHeight * 4 * t * (1 - t);
          this.el.object3D.position.y = y;
        } else {
          this.el.object3D.position.y = this.groundY;
          this.isJumping = false;
          setTimeout(() => { this.jumpCooldown = false; }, 200);
        }
      }
    },
    getRecordedData() {
      return this.recordedData;
    },
    // Trigger jump if not already jumping or in cooldown
    triggerJump() {
      if (this.isJumping || this.jumpCooldown) return;
      this.groundY = this.el.object3D.position.y;
      this.isJumping = true;
      this.jumpStartTime = performance.now();
      this.jumpCooldown = true;
    },
    reset() {
      this.recordedData = [];
      this.startTime = performance.now();
      this.lastRecordTime = 0;
  this.isJumping = false;
  this.jumpCooldown = false;
    },
  });
});
