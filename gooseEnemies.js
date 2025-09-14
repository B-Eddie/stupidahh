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
      this.tmpDir.copy(
        AFRAME.utils.directionUtil.getForward(this.el, this.data.forwardAxis)
      );
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

  // (legacy goose-spawn-manager removed; unified in gooseVoice.js)
})();
