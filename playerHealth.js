// playerHealth.js - manages player health, damage intake, and respawn logic
aframeReady(() => {
  AFRAME.registerComponent('player-health', {
    schema: {
      max: { type: 'int', default: 100 },
      respawnDelay: { type: 'int', default: 1200 }, // ms after death
      biteDamage: { type: 'int', default: 25 },
      hazardDamage: { type: 'int', default: 15 },
      invulnAfterRespawn: { type: 'int', default: 1500 }
    },
    init() {
      this.health = this.data.max;
      this.dead = false;
      this.lastDamageTime = -Infinity;
      this.respawnTimer = null;
      this.invulnUntil = 0;
      this._bindEvents();
      this._ensureHud();
      this.updateHud();
    },
    _bindEvents() {
      const scene = this.el.sceneEl;
      scene.addEventListener('playerHit', (e) => {
        this.applyDamage(this.data.hazardDamage, 'hazard');
      });
      scene.addEventListener('playerBite', (e) => {
        this.applyDamage(this.data.biteDamage, 'goose');
      });
    },
    applyDamage(amount, source) {
      const now = performance.now();
      if (this.dead) return;
      if (now < this.invulnUntil) return; // spawn protection
      if (now - this.lastDamageTime < 150) return; // tiny throttle
      this.lastDamageTime = now;
      this.health = Math.max(0, this.health - amount);
      // Flash HUD
      if (this.hudEl) {
        this.hudEl.style.filter = 'drop-shadow(0 0 6px #ff2e2e)';
        setTimeout(() => (this.hudEl.style.filter = ''), 220);
      }
      this.updateHud();
      if (this.health <= 0) {
        this.handleDeath(source);
      }
    },
    handleDeath(source) {
      if (this.dead) return;
      this.dead = true;
      this.health = 0;
      this.updateHud();
      // Simple death feedback: lower camera a bit & fade screen if desired
      this.el.sceneEl.emit('playerDeath', { source });
      console.log('[player-health] Player died from', source);
      // Schedule respawn
      this.respawnTimer = setTimeout(() => this.respawn(), this.data.respawnDelay);
    },
    respawn() {
      // Pick random safe location
      const pos = this.pickRespawnPosition();
      if (pos) {
        this.el.object3D.position.set(pos.x, pos.y, pos.z);
      }
      this.health = this.data.max;
      this.dead = false;
      this.invulnUntil = performance.now() + this.data.invulnAfterRespawn;
      this.updateHud();
      this.el.sceneEl.emit('playerRespawn', { position: pos });
      console.log('[player-health] Player respawned at', pos);
    },
    pickRespawnPosition() {
      // Strategy:
      // 1. Use enemy spawn rings as safe anchors (class 'enemy-spawn').
      // 2. Filter out those too close (<3m) to any goose.
      // 3. If none available, random sample within tactical-map size using downward raycast.
      const scene = this.el.sceneEl;
      const mapRoot = document.querySelector('#mapRoot');
      const rigYAdjust = -0.5; // to counter ring height offset
      const geese = Array.from(scene.querySelectorAll('[enemy-mover]'));
      const goosePositions = geese.map(g => {
        const v = new THREE.Vector3();
        g.object3D.getWorldPosition(v); return v; });
      let candidates = Array.from(mapRoot ? mapRoot.querySelectorAll('.enemy-spawn') : []);
      const safe = candidates.filter(el => {
        const p = el.getAttribute('position');
        if (!p) return false;
        for (let i=0;i<goosePositions.length;i++) {
          const gp = goosePositions[i];
          const dx = gp.x - p.x; const dz = gp.z - p.z;
          if (dx*dx + dz*dz < 9) return false; // within 3m
        }
        return true;
      });
      if (safe.length) {
        const chosen = safe[Math.floor(Math.random()*safe.length)].getAttribute('position');
        return { x: chosen.x, y: Math.max(0, chosen.y + rigYAdjust), z: chosen.z };
      }
      // Fallback random sampling within tactical-map or matrix-map extents
      let size = 50; // default
      const mapComp = mapRoot && (mapRoot.components['tactical-map'] || mapRoot.components['matrix-map']);
      if (mapComp) {
        size = mapComp.data.size || mapComp.data.radius*2 || size;
      }
      const half = size/2 * 0.9;
      const raycaster = new THREE.Raycaster();
      const down = new THREE.Vector3(0,-1,0);
      const origin = new THREE.Vector3();
      const meshes = [];
      if (mapRoot) {
        mapRoot.object3D.traverse(obj => { if (obj.isMesh) meshes.push(obj); });
      }
      for (let attempt=0; attempt<40; attempt++) {
        const x = (Math.random()*2-1)*half;
        const z = (Math.random()*2-1)*half;
        origin.set(x, 30, z);
        raycaster.set(origin, down);
        const hits = raycaster.intersectObjects(meshes, true);
        if (hits && hits.length) {
          const hit = hits[0];
          const y = hit.point.y + 0.05;
          // Distance from geese check
            let nearGoose = false;
            for (let i=0;i<goosePositions.length;i++) {
              const gp = goosePositions[i];
              const dx = gp.x - x; const dz = gp.z - z;
              if (dx*dx + dz*dz < 9) { nearGoose = true; break; }
            }
            if (nearGoose) continue;
          return { x, y, z };
        }
      }
      // Give up, stay where you are
      console.warn('[player-health] Failed to find respawn location; using current position');
      const cur = this.el.object3D.position;
      return { x: cur.x, y: cur.y, z: cur.z };
    },
    _ensureHud() {
      // Reuse existing HUD container or create extension
      let hud = document.getElementById('playerHealthHud');
      if (!hud) {
        hud = document.createElement('div');
        hud.id = 'playerHealthHud';
        hud.style.position = 'fixed';
        hud.style.top = '8px';
        hud.style.right = '12px';
        hud.style.fontFamily = 'monospace';
        hud.style.fontSize = '12px';
        hud.style.color = '#3eff8c';
        hud.style.textShadow = '0 0 4px #2aff65';
        hud.style.pointerEvents = 'none';
        hud.style.zIndex = '10';
        document.body.appendChild(hud);
      }
      this.hudEl = hud;
    },
    updateHud() {
      if (!this.hudEl) return;
      const pct = Math.round((this.health/this.data.max)*100);
      const inv = performance.now() < this.invulnUntil ? ' (INV)' : '';
      this.hudEl.textContent = `HP ${this.health}/${this.data.max} (${pct}%)${inv}`;
      this.hudEl.style.opacity = this.dead ? '0.5' : '1';
      if (this.dead) {
        this.hudEl.style.color = '#ff4444';
      } else if (pct < 35) {
        this.hudEl.style.color = '#ffaa33';
      } else {
        this.hudEl.style.color = '#3eff8c';
      }
    }
  });

  // Goose melee bite component
  AFRAME.registerComponent('goose-bite', {
    schema: {
      target: { type: 'selector', default: '#rig' },
      radius: { type: 'number', default: 0.9 },
      cooldown: { type: 'int', default: 1100 },
      tickRate: { type: 'int', default: 120 }
    },
    init() {
      this._acc = 0;
      this.lastBite = -Infinity;
      this.tmpE = new THREE.Vector3();
      this.tmpP = new THREE.Vector3();
    },
    tick(t, dt) {
      this._acc += dt;
      if (this.data.tickRate > 0 && this._acc < this.data.tickRate) return;
      this._acc = 0;
      if (!this.data.target) return;
      this.el.object3D.getWorldPosition(this.tmpE);
      this.data.target.object3D.getWorldPosition(this.tmpP);
      const dist = this.tmpE.distanceTo(this.tmpP);
      if (dist <= this.data.radius) {
        if (t - this.lastBite > this.data.cooldown) {
          this.lastBite = t;
          this.el.sceneEl.emit('playerBite', { enemy: this.el });
        }
      }
    }
  });
});
