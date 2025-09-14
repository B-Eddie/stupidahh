// playerSpawnCenter.js - ensures player rig starts at middle of tactical map
(function(){
  if(!window.AFRAME) return;

  AFRAME.registerComponent('player-spawn-center', {
    schema: {
      y: { type: 'number', default: 1.6 }, // eye height match camera
      snapToGround: { type: 'boolean', default: true },
      groundY: { type: 'number', default: 0 }, // assumed floor top y
      offsetX: { type: 'number', default: 0 },
      offsetZ: { type: 'number', default: 0 },
      epsilon: { type: 'number', default: 0.02 } // raise slightly above ground to avoid initial collision overlap
    },
    init(){
      // Delay until after tactical-map builds geometry
      setTimeout(()=> this.place(), 100);
    },
    place(){
      const pos = this.el.object3D.position;
      // If snapping to ground, place just above ground plane so player-collision box (whose bottom is at rig y) does not start intersecting the floor AABB.
      // Starting exactly flush caused horizontal push resolution because the player AABB overlapped the large floor box.
      const y = this.data.snapToGround ? (this.data.groundY + this.data.epsilon) : this.data.y;
      pos.set(this.data.offsetX, y, this.data.offsetZ);
      // If rig has separate camera at 1.6, keep rig y at ground and camera sets its own relative position.
      // Optional: could emit event for other systems.
      if(this.data.debug){
        console.log('[player-spawn-center] spawn pos', pos.toArray());
      }
      this.el.emit('player-spawned', { position: pos.clone() });
    }
  });
})();
