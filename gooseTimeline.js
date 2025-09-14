// gooseTimeline.js - Records deterministic spawn timeline of geese and replays it each loop.
// Concept:
// 1. On first load after geese spawn, generate a timeline JSON: spawn time (ms 0 baseline),
//    initial position, planned patrol path (simple outward drift or idle), and random jump times.
// 2. Save JSON to window.__GOOSE_TIMELINE and trigger a download for inspection.
// 3. On player respawn (time loop), reset all geese to initial state and replay same scripted movement
//    unless they are within proximity of the player (then AI movement / chasing overrides script).
// 4. Jump events: at scheduled times in the loop, goose performs a small vertical hop once per cycle.
//
// NOTE: This is a lightweight deterministic layer; existing enemy-mover still runs when goose enters
// player proximity; we temporarily disable scripted transform updates for that goose when close.

aframeReady(() => {
  AFRAME.registerSystem('goose-timeline', {
    schema: {
      loopLength: { type: 'int', default: 30000 }, // ms length of time loop
      jumpChance: { type: 'number', default: 0.25 },
      jumpsPerGooseMax: { type: 'int', default: 3 },
      patrolRadius: { type: 'number', default: 2.5 },
      patrolWander: { type: 'number', default: 0.6 },
      playerProximityOverride: { type: 'number', default: 6 },
      jumpHeight: { type: 'number', default: 0.6 },
      jumpDuration: { type: 'int', default: 420 }
    },
    init() {
      this.generated = false;
      this.timeline = null; // { createdAt, loopLength, geese:[{id, spawnPos:{x,y,z}, path:[{t,x,y,z}], jumps:[t,...]}] }
      this._geese = [];
      this._player = document.querySelector('#rig');
      this._playerPos = new THREE.Vector3();
      this._tmp = new THREE.Vector3();
      this._loopStart = performance.now();
      this._lastExported = false;
      this.sceneEl.addEventListener('geeseSpawned', e => {
        const list = e.detail && e.detail.geese ? e.detail.geese : [];
        list.forEach((g,i)=>{
          // Assign stable id
            if (!g.hasAttribute('goose-scripted')) {
              g.setAttribute('goose-scripted', `gid:${Date.now()}_${Math.random().toString(36).slice(2)}`);
            }
            this._geese.push(g);
        });
        if (!this.generated) {
          this.generateTimeline();
        }
      });
      this.sceneEl.addEventListener('playerRespawn', ()=>{
        this.restartLoop();
      });
    },
    restartLoop() {
      this._loopStart = performance.now();
      if (!this.timeline) return;
      // Reset each goose to spawn position
      this.timeline.geese.forEach(entry => {
        const goose = this._geese.find(g => g.getAttribute('goose-scripted') && g.getAttribute('goose-scripted').includes(entry.id));
        if (goose) {
          goose.object3D.position.set(entry.spawnPos.x, entry.spawnPos.y, entry.spawnPos.z);
          goose.object3D.rotation.set(0,0,0);
        }
      });
    },
    generateTimeline() {
      if (this.generated) return;
      const loopLength = this.data.loopLength;
      this.timeline = {
        createdAt: new Date().toISOString(),
        loopLength,
        geese: []
      };
      this._geese.forEach(g => {
        const id = g.getAttribute('goose-scripted');
        const p = g.getAttribute('position');
        // Build a simple wandering path: 6-10 keyframes across loop
        const keyframes = 6 + Math.floor(Math.random()*5);
        const path = [];
        path.push({ t:0, x:p.x, y:p.y, z:p.z });
        let baseX = p.x, baseY = p.y, baseZ = p.z;
        for (let k=1;k<keyframes;k++) {
          const t = Math.round((k / (keyframes-1)) * loopLength);
          const ang = Math.random()*Math.PI*2;
          const r = Math.random()*this.data.patrolRadius;
          const wander = this.data.patrolWander;
          const x = baseX + Math.cos(ang)*r + (Math.random()-0.5)*wander;
          const z = baseZ + Math.sin(ang)*r + (Math.random()-0.5)*wander;
          path.push({ t, x, y: baseY, z });
        }
        // Jump times
        const jumps = [];
        const maxJumps = Math.min(this.data.jumpsPerGooseMax, 1 + Math.floor(Math.random()*this.data.jumpsPerGooseMax));
        for (let j=0;j<maxJumps;j++) {
          if (Math.random() <= this.data.jumpChance) {
            jumps.push(Math.round(Math.random()*loopLength));
          }
        }
        jumps.sort((a,b)=>a-b);
        this.timeline.geese.push({
          id,
            spawnPos: { x:p.x, y:p.y, z:p.z },
            path,
            jumps
        });
      });
      window.__GOOSE_TIMELINE = this.timeline;
      this.generated = true;
      this.exportTimeline();
      console.log('[goose-timeline] Generated timeline', this.timeline);
    },
    exportTimeline() {
      if (this._lastExported) return;
      try {
        const blob = new Blob([JSON.stringify(this.timeline, null, 2)], { type:'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'goose_timeline.json';
        a.click();
        setTimeout(()=> URL.revokeObjectURL(url), 2000);
        this._lastExported = true;
      } catch(e) {
        console.warn('[goose-timeline] export failed', e);
      }
    },
    tick() {
      if (!this.timeline) return;
      const now = performance.now();
      const loopT = (now - this._loopStart) % this.timeline.loopLength;
      if (this._player) {
        this._player.object3D.getWorldPosition(this._playerPos);
      }
      // For each goose, if far from player, set scripted position by interpolating path
      this.timeline.geese.forEach(entry => {
        const goose = this._geese.find(g => g.getAttribute('goose-scripted') && g.getAttribute('goose-scripted').includes(entry.id));
        if (!goose) return;
        goose.object3D.getWorldPosition(this._tmp);
        const dx = this._playerPos.x - this._tmp.x;
        const dz = this._playerPos.z - this._tmp.z;
        const nearPlayer = (dx*dx + dz*dz) < (this.data.playerProximityOverride * this.data.playerProximityOverride);
        if (nearPlayer) return; // let existing AI movement handle pursuit
        // Interpolate path
        const path = entry.path;
        if (!path.length) return;
        // Find surrounding keyframes
        let aIdx = 0, bIdx = path.length -1;
        for (let i=0;i<path.length-1;i++) {
          if (loopT >= path[i].t && loopT <= path[i+1].t) { aIdx = i; bIdx = i+1; break; }
        }
        const a = path[aIdx];
        const b = path[bIdx];
        const span = b.t - a.t || 1;
        const lt = loopT < a.t ? 0 : (loopT - a.t) / span;
        const nx = a.x + (b.x - a.x) * lt;
        const nz = a.z + (b.z - a.z) * lt;
        const nyBase = a.y + (b.y - a.y) * lt; // normally flat anyway
        let y = nyBase;
        // Apply jump if within jump window
        for (let j=0;j<entry.jumps.length;j++) {
          const jt = entry.jumps[j];
          const dt = Math.abs(loopT - jt);
          if (dt < this.data.jumpDuration) {
            const tNorm = 1 - (dt / this.data.jumpDuration); // 1 at peak start -> 0 at end edges
            const parabolic = 4 * tNorm * (1 - tNorm); // simple arch
            y = nyBase + parabolic * this.data.jumpHeight;
            break;
          }
        }
        goose.object3D.position.set(nx, y, nz);
      });
    }
  });

  // Marker component (stores id string)
  AFRAME.registerComponent('goose-scripted', {
    schema: { gid: { type:'string', default:'' } },
    init() {}
  });
});
