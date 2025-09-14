// gooseEnemies.js - persistent hazards & goose enemy behaviors (clean rewrite with activation radius & random spawn variance)
(function () {
  if (!window.AFRAME) return;
  const A = AFRAME;

  // ---------------- Hazard System ----------------
  A.registerSystem("hazard-system", {
    init() {
      if (!window.__PERSISTENT_HAZARDS) {
        window.__PERSISTENT_HAZARDS = { beams: [], id: 0 };
      }
      this.store = window.__PERSISTENT_HAZARDS;
      this.activeBeams = []; // {ent, expire}
      this.pool = [];
    },
    registerBeam(data) {
      const id = ++this.store.id;
      this.store.beams.push({
        id,
        s: data.start.clone(),
        e: data.end.clone(),
        r: data.radius || 0.1,
      });
      this.renderBeam({ id, ...data });
    },
    getHazards() {
      return this.store.beams;
    },
    renderBeam(conf) {
      const scene = this.sceneEl;
      const start = conf.start,
        end = conf.end;
      const len = start.distanceTo(end);
      const mid = start.clone().add(end).multiplyScalar(0.5);
      const dir = end.clone().sub(start).normalize();
      let ent = this.pool.pop();
      if (!ent) {
        ent = document.createElement("a-entity");
        ent.setAttribute(
          "geometry",
          `primitive:cylinder; height:${len}; radius:${conf.radius || 0.025}`
        );
        ent.setAttribute(
          "material",
          "color:#3eff8c; emissive:#1aff5d; emissiveIntensity:0.8; roughness:0.4; metalness:0.1"
        );
        scene.appendChild(ent);
      } else {
        ent.setAttribute(
          "geometry",
          `primitive:cylinder; height:${len}; radius:${conf.radius || 0.025}`
        );
        ent.setAttribute("visible", "true");
        ent.setAttribute(
          "material",
          "color:#3eff8c; emissive:#1aff5d; emissiveIntensity:0.8; roughness:0.4; metalness:0.1"
        );
      }
      ent.object3D.position.set(mid.x, mid.y, mid.z);
      const up = new THREE.Vector3(0, 1, 0);
      const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
      ent.object3D.quaternion.copy(quat);
      this.activeBeams.push({
        ent,
        expire: performance.now() + (conf.visibleMs || 1800),
      });
    },
    tick() {
      const now = performance.now();
      for (let i = this.activeBeams.length - 1; i >= 0; i--) {
        const b = this.activeBeams[i];
        if (now >= b.expire) {
          // fade state (simple hide + push to pool)
          b.ent.setAttribute("visible", "false");
          this.pool.push(b.ent);
          this.activeBeams.splice(i, 1);
        }
      }
    },
  });

  // ---------------- Enemy Movement (activation radius) ----------------
  A.registerComponent("enemy-mover", {
    schema: {
      speed: { type: "number", default: 0.7 },
      target: { type: "selector", default: "#rig" },
      stop: { type: "number", default: 0.6 },
      activationRadius: { type: "number", default: 8 },
      tickRate: { type: "number", default: 50 },
    },
    init() {
      this.tmpP = new THREE.Vector3();
      this.tmpT = new THREE.Vector3();
      this.active = false;
      this._accum = 0;
    },
    tick(t, dt) {
      if (!this.data.target) return;
      this._accum += dt;
      if (this.data.tickRate > 0 && this._accum < this.data.tickRate) return;
      this._accum = 0;
      const obj = this.el.object3D;
      obj.getWorldPosition(this.tmpP);
      this.data.target.object3D.getWorldPosition(this.tmpT);
      const dir = this.tmpT.clone().sub(this.tmpP);
      const dist = dir.length();
      if (!this.active && dist <= this.data.activationRadius) {
        this.active = true;
      }
      if (!this.active) return;
      if (dist > this.data.stop) {
        dir.normalize();
        obj.position.addScaledVector(
          dir,
          (this.data.speed * (this.data.tickRate || dt)) / 1000
        );
      }
      dir.y = 0;
      if (dir.lengthSq() > 1e-4) {
        obj.rotation.set(0, Math.atan2(dir.x, dir.z), 0);
      }
    },
  });

  // ---------------- Enemy Laser (activation radius gating) ----------------
  A.registerComponent("enemy-laser", {
    schema: {
      rate: { type: "number", default: 1500 },
      range: { type: "number", default: 30 },
      offset: { type: "vec3", default: { x: 0, y: 0.6, z: 0.6 } },
      activationRadius: { type: "number", default: 8 },
      variance: { type: "number", default: 400 },
      forwardAxis: { type: "string", default: "-z" }, // enemy model facing
    },
    init() {
      this.last = 0;
      this.ray = new THREE.Raycaster();
      this.tmpO = new THREE.Vector3();
      this.tmpDir = new THREE.Vector3();
      this.tmpEnemyPos = new THREE.Vector3();
      this.sys = this.el.sceneEl.systems["hazard-system"];
      this.targetRig = document.querySelector("#rig");
      this.active = false; // random phase so clusters stagger
      this.last = -(Math.random() * this.data.variance);
    },
    tick(t) {
      if (!this.targetRig) return;
      this.el.object3D.getWorldPosition(this.tmpEnemyPos);
      this.targetRig.object3D.getWorldPosition(this.tmpDir);
      const dist = this.tmpEnemyPos.distanceTo(this.tmpDir);
      if (!this.active && dist <= this.data.activationRadius) {
        this.active = true;
      }
      if (!this.active) return;
      if (t - this.last < this.data.rate) return;
      this.last = t;
      this.fire();
    },
    fire() {
      const o3 = this.el.object3D;
      this.tmpO.set(this.data.offset.x, this.data.offset.y, this.data.offset.z);
      o3.localToWorld(this.tmpO);
      // Base forward (-Z local) then adjust depending on forwardAxis
      o3.getWorldDirection(this.tmpDir); // world forward for local -Z
      switch (this.data.forwardAxis) {
        case "+z":
          this.tmpDir.multiplyScalar(-1); // invert
          break;
        case "+x": {
          // rotate +90 yaw
          const f = this.tmpDir.clone();
          this.tmpDir.set(-f.z, f.y, f.x);
          break;
        }
        case "-x": {
          // rotate -90 yaw
          const f = this.tmpDir.clone();
          this.tmpDir.set(f.z, f.y, -f.x);
          break;
        }
        case "+y":
        case "-y":
          // keep horizontal forward; vertical attack uncommon
          break;
        default:
          break;
      }
      this.tmpDir.normalize();
      const end = this.tmpO
        .clone()
        .addScaledVector(this.tmpDir, this.data.range);
      if (this.sys) {
        this.sys.registerBeam({
          start: this.tmpO,
          end: end,
          radius: 0.12,
          visibleMs: 2000,
        });
      }
    },
  });

  // ---------------- Goose Animation (simple walk/idle state) ----------------
  // Requires that the GLB includes animation clips named (case-insensitive) something like 'Walk' and 'Idle'.
  // If only one clip exists, it will just play that clip.
  A.registerComponent("goose-anim", {
    schema: {
      walkClip: { type: "string", default: "Walk" },
      idleClip: { type: "string", default: "Idle" },
      speedThreshold: { type: "number", default: 0.05 },
      fade: { type: "number", default: 0.25 },
    },
    init() {
      this.prevPos = new THREE.Vector3();
      this.curPos = new THREE.Vector3();
      this._lastSwitch = 0;
      this.activeClip = "";
      this.mixerEl = null;
      this.ready = false;
      this._ensure();
    },
    _ensure() {
      const mesh = this.el.getObject3D("mesh");
      if (!mesh) {
        this.el.addEventListener("model-loaded", () => this._ensure());
        return;
      } // attach animation-mixer if not existing
      if (!this.el.components["animation-mixer"]) {
        this.el.setAttribute("animation-mixer", "clip: *; loop: repeat");
      }
      this.mixerEl = this.el.components["animation-mixer"];
      this.el.object3D.getWorldPosition(this.prevPos);
      this.ready = true;
      // Attempt to start idle initially
      this.playClip(this.data.idleClip, true);
    },
    playClip(name, force) {
      if (!this.mixerEl) return;
      if (!force && this.activeClip === name) return;
      this.activeClip = name;
      this.el.setAttribute(
        "animation-mixer",
        `clip:${name}; crossFadeDuration:${this.data.fade}`
      );
    },
    tick(time, dt) {
      if (!this.ready || dt <= 0) return;
      const o3 = this.el.object3D;
      o3.getWorldPosition(this.curPos);
      const dist = this.curPos.distanceTo(this.prevPos);
      const speed = dist / (dt / 1000);
      const moving = speed > this.data.speedThreshold;
      const target = moving ? this.data.walkClip : this.data.idleClip;
      this.playClip(target, false);
      this.prevPos.copy(this.curPos);
    },
  });

  // ---------------- Hazard Damage Check ----------------
  A.registerComponent("hazard-damage", {
    schema: {
      target: { type: "selector", default: "#rig" },
      checkRate: { type: "number", default: 120 },
      radius: { type: "number", default: 0.3 },
      torsoYOffset: { type: "number", default: 1.3 },
      invuln: { type: "number", default: 750 },
    },
    init() {
      this.lastHit = -Infinity;
      this.lastCheck = 0;
      this.tmp = new THREE.Vector3();
      this.sys = this.el.sceneEl.systems["hazard-system"];
    },
    tick(t) {
      if (t - this.lastCheck < this.data.checkRate) return;
      this.lastCheck = t;
      if (!this.sys || !this.data.target) return;
      this.data.target.object3D.getWorldPosition(this.tmp);
      this.tmp.y += this.data.torsoYOffset;
      const hz = this.sys.getHazards();
      for (let i = 0; i < hz.length; i++) {
        if (
          this.distToSegmentSq(this.tmp, hz[i].s, hz[i].e) <=
          (hz[i].r + this.data.radius) ** 2
        ) {
          if (t - this.lastHit > this.data.invuln) {
            this.lastHit = t;
            this.el.sceneEl.emit("playerHit", { hazard: hz[i].id });
          }
          break;
        }
      }
    },
    distToSegmentSq(p, a, b) {
      const AB = b.clone().sub(a);
      const tClamp = Math.max(
        0,
        Math.min(1, p.clone().sub(a).dot(AB) / AB.lengthSq())
      );
      const closest = a.clone().addScaledVector(AB, tClamp);
      return closest.distanceToSquared(p);
    },
  });

  // ---------------- Goose Spawn Manager (randomized spawn distribution & activation radius passing) ----------------
  A.registerComponent("goose-spawn-manager", {
    schema: {
      perRoundBase: { type: "int", default: 3 },
      perRoundAdd: { type: "int", default: 2 },
      scale: { type: "number", default: 0.35 },
      // New variation ranges (if scaleMin/Max provided they override single scale for randomness)
      scaleMin: { type: 'number', default: 0.25 },
      scaleMax: { type: 'number', default: 0.55 },
      speedMin: { type: 'number', default: 0.55 },
      speedMax: { type: 'number', default: 1.2 },
      laserRateMin: { type: 'number', default: 1100 },
      laserRateMax: { type: 'number', default: 1900 },
      sizeSpeedLink: { type: 'boolean', default: true }, // if true smaller = faster automatically
      activationRadius: { type: "number", default: 8 },
      randomGround: { type: "int", default: 4 },
      minDistanceFromPlayer: { type: "number", default: 6 },
      spawnForwardMinZ: { type: "number", default: 0 },
      usePrimitive: { type: "boolean", default: false },
    },
    init() {
      this.round = 1;
      this.scene = this.el.sceneEl || this.el;
      this.player = document.querySelector("#rig");
      this.tmpPlayer = new THREE.Vector3();
      if (this.scene) {
        this.scene.addEventListener("roundrestart", (e) => {
          this.round =
            e.detail && e.detail.round ? e.detail.round : this.round + 1;
          this.spawnBatch();
        });
      }
      this.spawnBatch();
    },
    _rand01() { return Math.random(); },
    _randRange(a,b){ return a + (b-a)*Math.random(); },
    _pickScale(){
      const { scaleMin, scaleMax, scale } = this.data;
      if (scaleMin && scaleMax) return this._randRange(scaleMin, scaleMax);
      return scale;
    },
    _pickSpeed(size){
      const { speedMin, speedMax, sizeSpeedLink } = this.data;
      let base = this._randRange(speedMin, speedMax);
      if (sizeSpeedLink) {
        // Map size into [0,1] in its range and invert influence (smaller -> faster)
        const s0 = this.data.scaleMin, s1 = this.data.scaleMax;
        if (s0 < s1) {
          const t = (size - s0)/(s1 - s0);
          const inv = 1 - t; // smaller size => higher inv
          base = speedMin + (speedMax - speedMin) * (0.4 + inv*0.6); // bias a bit toward faster small
        }
      }
      return base;
    },
    _pickLaserRate(size){
      const { laserRateMin, laserRateMax, sizeSpeedLink } = this.data;
      if (!laserRateMin || !laserRateMax) return 1500;
      if (sizeSpeedLink) {
        const s0 = this.data.scaleMin, s1 = this.data.scaleMax;
        if (s0 < s1) {
          const t = (size - s0)/(s1 - s0); // larger size -> closer to 1
          const inv = 1 - t; // smaller -> larger inv
          return Math.round(laserRateMin + (laserRateMax - laserRateMin) * (0.3 + inv*0.7));
        }
      }
      return Math.round(this._randRange(laserRateMin, laserRateMax));
    },
    _farEnough(x, z) {
      if (!this.player) return true;
      this.player.object3D.getWorldPosition(this.tmpPlayer);
      const dx = x - this.tmpPlayer.x;
      const dz = z - this.tmpPlayer.z;
      return (
        dx * dx + dz * dz >=
        this.data.minDistanceFromPlayer * this.data.minDistanceFromPlayer
      );
    },
    _ensureFar(pos) {
      if (this._farEnough(pos.x, pos.z)) return pos;
      if (!this.player) {
        return pos;
      } // push outward
      this.player.object3D.getWorldPosition(this.tmpPlayer);
      let dx = pos.x - this.tmpPlayer.x;
      let dz = pos.z - this.tmpPlayer.z;
      let len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.001) {
        // random direction if exactly overlapping
        const ang = Math.random() * Math.PI * 2;
        dx = Math.cos(ang);
        dz = Math.sin(ang);
        len = 1;
      }
      const targetR = this.data.minDistanceFromPlayer + 0.5 + Math.random() * 2; // small buffer
      const scale = targetR / len;
      pos.x = this.tmpPlayer.x + dx * scale;
      pos.z = this.tmpPlayer.z + dz * scale;
      return pos;
    },
    _placeNear(basePos) {
      // jitter with retries respecting min distance
      for (let attempt = 0; attempt < 8; attempt++) {
        const jitterR = 0.4 + Math.random() * 1.2;
        const jitterA = Math.random() * Math.PI * 2;
        const px = basePos.x + Math.cos(jitterA) * jitterR;
        const pz = basePos.z + Math.sin(jitterA) * jitterR;
        if (this._farEnough(px, pz)) return { x: px, y: basePos.y, z: pz };
      }
      return this._ensureFar({ ...basePos }); // push if still too close
    },
    _placeGround() {
      for (let attempt = 0; attempt < 12; attempt++) {
        const ang = Math.random() * Math.PI * 2;
        const rad = 6 + Math.random() * 14;
        const x = Math.cos(ang) * rad;
        const z = Math.sin(ang) * rad;
        if (this._farEnough(x, z)) return { x, y: 0.5, z };
      }
      return { x: 10, y: 0.5, z: 10 };
    },
    spawnBatch() {
      if (!this.scene) return;
      const count =
        this.data.perRoundBase + (this.round - 1) * this.data.perRoundAdd;
      let spawns = Array.from(this.scene.querySelectorAll(".enemy-spawn"));
      if (this.data.spawnForwardMinZ) {
        spawns = spawns.filter((s) => {
          const p = s.getAttribute("position");
          return p.z >= this.data.spawnForwardMinZ;
        });
      }
      const created = [];
      for (let i = 0; i < count; i++) {
        const enemy = document.createElement("a-entity");
        let basePos;
        if (spawns.length) {
          basePos = spawns[i % spawns.length].getAttribute("position");
        } else {
          basePos = {
            x: Math.random() * 10 - 5,
            y: 1,
            z: Math.random() * 10 - 5,
          };
        }
        const pos = this._ensureFar(this._placeNear(basePos));
        enemy.setAttribute("position", `${pos.x} ${pos.y} ${pos.z}`);
        const s = this._pickScale();
        enemy.setAttribute("scale", `${s} ${s} ${s}`);
        if (this.data.usePrimitive) {
          this._buildPrimitiveGoose(enemy);
        } else {
          enemy.setAttribute("gltf-model", "assets/goose.glb");
          enemy.setAttribute("goose-anim", "");
        }
        const mvSpeed = this._pickSpeed(s).toFixed(3);
        const laserRate = this._pickLaserRate(s);
        // Apply movement speed variation + activation radius
        enemy.setAttribute('enemy-mover', `activationRadius:${this.data.activationRadius}; speed:${mvSpeed}`);
        // Laser rate varied by size (smaller may fire a bit faster)
        enemy.setAttribute('enemy-laser', `activationRadius:${this.data.activationRadius}; rate:${laserRate}`);
        // Add melee bite capability
        enemy.setAttribute('goose-bite', '');
        if (!this.data.usePrimitive) {
          enemy.addEventListener("model-loaded", (e) => {
            console.log("[goose] model loaded", e.detail);
          });
          enemy.addEventListener("model-error", (e) => {
            console.warn(
              "[goose] model load failed, using primitive fallback",
              e.detail
            );
            enemy.removeAttribute("gltf-model");
            this._buildPrimitiveGoose(enemy);
          });
        }
        this.scene.appendChild(enemy);
        created.push(enemy);
      }
      for (let g = 0; g < this.data.randomGround; g++) {
        const enemy = document.createElement("a-entity");
        const pos = this._placeGround();
        enemy.setAttribute("position", `${pos.x} ${pos.y} ${pos.z}`);
        const s = this._pickScale();
        enemy.setAttribute("scale", `${s} ${s} ${s}`);
        if (this.data.usePrimitive) {
          this._buildPrimitiveGoose(enemy);
        } else {
          enemy.setAttribute("gltf-model", "assets/goose.glb");
          enemy.setAttribute("goose-anim", "");
        }
        const mvSpeed = this._pickSpeed(s).toFixed(3);
        const laserRate = this._pickLaserRate(s);
        enemy.setAttribute('enemy-mover', `activationRadius:${this.data.activationRadius}; speed:${mvSpeed}`);
        enemy.setAttribute('enemy-laser', `activationRadius:${this.data.activationRadius}; rate:${laserRate}`);
        enemy.setAttribute('goose-bite', '');
        if (!this.data.usePrimitive) {
          enemy.addEventListener("model-loaded", (e) => {
            console.log("[goose] model loaded", e.detail);
          });
          enemy.addEventListener("model-error", (e) => {
            console.warn(
              "[goose] model load failed, using primitive fallback",
              e.detail
            );
            enemy.removeAttribute("gltf-model");
            this._buildPrimitiveGoose(enemy);
          });
        }
        this.scene.appendChild(enemy);
        created.push(enemy);
      }
      // Emit event with newly created geese for timeline system
      if (created.length) {
        this.scene.emit('geeseSpawned', { geese: created });
      }
    },
    _buildPrimitiveGoose(root) {
      // Simple stylized goose: body (capsule via two spheres + cylinder), neck, head, beak, legs
      const mk = (geom, mat, pos, scale) => {
        const e = document.createElement("a-entity");
        e.setAttribute("geometry", geom);
        e.setAttribute("material", mat);
        e.setAttribute("position", pos);
        if (scale) e.setAttribute("scale", scale);
        root.appendChild(e);
        return e;
      };
      // Body
      mk(
        "primitive:sphere; radius:0.5",
        "color:#ffffff; roughness:0.8",
        "0 0.55 0",
        "1 0.7 1.4"
      );
      // Neck
      mk(
        "primitive:cylinder; radius:0.12; height:0.8",
        "color:#ffffff; roughness:0.8",
        "0 1.15 0.2"
      );
      // Head
      mk(
        "primitive:sphere; radius:0.18",
        "color:#ffffff; roughness:0.75",
        "0 1.55 0.35"
      );
      // Beak
      mk(
        "primitive:cone; radiusBottom:0.09; radiusTop:0.02; height:0.22",
        "color:#ffb347; emissive:#663300; roughness:0.6",
        "0 1.55 0.52"
      );
      // Eyes
      const eyeL = mk(
        "primitive:sphere; radius:0.035",
        "color:#111111",
        "-0.07 1.57 0.42"
      );
      const eyeR = mk(
        "primitive:sphere; radius:0.035",
        "color:#111111",
        "0.07 1.57 0.42"
      );
      // Legs
      mk(
        "primitive:cylinder; radius:0.06; height:0.55",
        "color:#ffb347; roughness:0.5",
        "-0.15 0.27 0"
      );
      mk(
        "primitive:cylinder; radius:0.06; height:0.55",
        "color:#ffb347; roughness:0.5",
        "0.15 0.27 0"
      );
      // Feet
      mk(
        "primitive:box; width:0.22; height:0.05; depth:0.28",
        "color:#ffb347; roughness:0.4",
        "-0.15 0.02 0.05"
      );
      mk(
        "primitive:box; width:0.22; height:0.05; depth:0.28",
        "color:#ffb347; roughness:0.4",
        "0.15 0.02 0.05"
      );
    },
  });
})();
