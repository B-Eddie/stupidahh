// playerGravity.js - simple gravity + jump + ground snap for A-Frame rig
// Adds vertical motion independent from movement-controls (which is horizontal only).
// Usage: add to rig entity: player-gravity-jump="jumpSpeed:4; gravity:-9.8"
// Assumes rig origin is at feet (or close). If not, adjust footOffset.
(function(){
  if(!window.AFRAME) return;
  AFRAME.registerComponent('player-gravity-jump', {
    schema:{
      gravity:{type:'number', default:-9.8}, // m/s^2
      jumpSpeed:{type:'number', default:4.5}, // upward impulse
      maxFall:{type:'number', default:-35},
      groundEpsilon:{type:'number', default:0.05},
      footOffset:{type:'number', default:0}, // if rig y is already at foot level
      rayLength:{type:'number', default:1}, // how far below to search for ground
      groundedGraceMs:{type:'int', default:120}, // coyote time after walking off edge
      jumpCooldownMs:{type:'int', default:180},
      enableDoubleJump:{type:'boolean', default:false},
      maxDoubleJumps:{type:'int', default:1},
      debug:{type:'boolean', default:false}
    },
    init(){
      this.velY = 0;
      this.lastGrounded = 0;
      this.jumpsUsed = 0;
      this.lastJumpTime = -Infinity;
      this.tmpOrigin = new THREE.Vector3();
      this.tmpDir = new THREE.Vector3(0,-1,0);
      this.raycaster = new THREE.Raycaster();
      this.keyDown = {};
      window.addEventListener('keydown', e=>{ this.keyDown[e.code]=true; });
      window.addEventListener('keyup', e=>{ this.keyDown[e.code]=false; });
    },
    _isJumpRequested(){
      // Space or gamepad A (if mapped later) - only on keydown edge but we approximate here
      return this.keyDown['Space'];
    },
    _groundCheck(){
      // Raycast from slightly above feet downward
      const obj = this.el.object3D;
      obj.getWorldPosition(this.tmpOrigin);
      this.tmpOrigin.y += 0.05; // small lift to avoid starting inside surface
      this.raycaster.set(this.tmpOrigin, this.tmpDir);
      const intersects = this.raycaster.intersectObjects(this.el.sceneEl.object3D.children, true);
      for(let i=0;i<intersects.length;i++){
        const hit = intersects[i];
        if(!hit.object) continue;
        // Filter out player's own hierarchy (avoid self-hit)
        // We consider anything with distance < rayLength and below origin as ground
        if(hit.distance <= this.data.rayLength){
          return hit;
        }
      }
      return null;
    },
    tick(t, dt){
      if(dt<=0) return;
      dt = dt/1000; // seconds
      const obj = this.el.object3D;

      // Ground detection
      const hit = this._groundCheck();
      const grounded = !!hit && (obj.position.y - (hit.point.y) <= this.data.rayLength + 0.2) && (obj.position.y >= hit.point.y - 0.3);

      if(grounded){
        // Snap to ground if within epsilon and falling
        if(obj.position.y - hit.point.y <= this.data.groundEpsilon && this.velY <=0){
          obj.position.y = hit.point.y; // align feet to surface
          this.velY = 0;
        }
        this.lastGrounded = performance.now();
        this.jumpsUsed = 0; // reset double-jump counter
      }

      // Jump input
      const canJump = (
        performance.now() - this.lastJumpTime > this.data.jumpCooldownMs &&
        (grounded || (performance.now() - this.lastGrounded) <= this.data.groundedGraceMs ||
          (this.data.enableDoubleJump && this.jumpsUsed < this.data.maxDoubleJumps))
      );
      if(canJump && this._isJumpRequested()){
        this.velY = this.data.jumpSpeed;
        this.lastJumpTime = performance.now();
        if(!grounded && (performance.now() - this.lastGrounded) > this.data.groundedGraceMs){
          this.jumpsUsed++;
        }
      }

      // Apply gravity
      this.velY += this.data.gravity * dt;
      if(this.velY < this.data.maxFall) this.velY = this.data.maxFall;

      // Integrate
      obj.position.y += this.velY * dt;

      // Prevent sinking through ground (if we overshot after large dt). Check again with simple clamp.
      if(hit && obj.position.y < hit.point.y){
        obj.position.y = hit.point.y;
        this.velY = 0;
      }

      if(this.data.debug){
        if(!this._lastDbg || performance.now() - this._lastDbg > 250){
          console.log('[player-gravity-jump]', {y: obj.position.y.toFixed(2), velY:this.velY.toFixed(2), grounded, jumpsUsed:this.jumpsUsed});
          this._lastDbg = performance.now();
        }
      }
    }
  });
})();
