// playerRecorder.js
aframeReady(() => {
  AFRAME.registerComponent("player-recorder", {
    init() {
      this.recordedData = [];
      this.startTime = performance.now();
      this.lastRecordTime = 0;
      this.recordInterval = 100; // ms

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
    },
    getRecordedData() {
      return this.recordedData;
    },
    reset() {
      this.recordedData = [];
      this.startTime = performance.now();
      this.lastRecordTime = 0;
    },
  });
});
