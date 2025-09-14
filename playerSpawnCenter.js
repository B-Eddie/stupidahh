// playerSpawnCenter.js - ensures player rig starts at middle of tactical map
(function(){
  if(!window.AFRAME) return;

  AFRAME.registerComponent('player-spawn-center', {
    schema: {
      y: { type: 'number', default: 1.6 }, // eye height match camera
      snapToGround: { type: 'boolean', default: true },
      groundY: { type: 'number', default: 0 } // assumed floor top y
    },
    init(){
      // Delay until after tactical-map builds geometry
      setTimeout(()=> this.place(), 100);
    },
    place(){
      const pos = this.el.object3D.position;
      pos.set(0, this.data.snapToGround ? this.data.groundY : this.data.y, 0);
      // If rig has separate camera at 1.6, keep rig y at ground and camera sets its own relative position.
      // Optional: could emit event for other systems.
      this.el.emit('player-spawned', { position: pos.clone() });
    }
  });
})();
