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
  this.jumpHeight = 2.2; // meters
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

      // VR controller jump (A or B button on right hand). Some libs emit generic
      // controllerbuttondown with detail {hand, button}, others emit specific
      // events like 'abuttondown' / 'bbuttondown'. Support both.
      this.el.sceneEl.addEventListener("controllerbuttondown", (evt) => {
        // evt.detail expected: { hand: 'right'|'left', button: 'a'|'b'|... }
        if (!evt.detail) return;
        const { hand, button } = evt.detail;
        // Treat A, B, primary, secondary as jump buttons on right controller
        if (hand === "right" && ["a", "b", "primary", "secondary"].includes(button)) {
          this.triggerJump();
        }
      });

      // Fallback for explicit button events (A-Frame emits these for oculus-touch-controls)
      this.el.addEventListener("abuttondown", () => this.triggerJump());
      this.el.addEventListener("bbuttondown", () => this.triggerJump());
      // Optional: uncomment for debugging which buttons are firing
      // this.el.sceneEl.addEventListener('controllerbuttondown', e => console.log('controllerbuttondown', e.detail));
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
