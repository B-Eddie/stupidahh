// gooseVoice.js - Proximity voice system for geese to roast the player
(function () {
  const start = () => {
    if (!window.AFRAME) return; // Should not happen now
    const A = AFRAME;

    // Simple debug component to lock position (used to verify external movement influence)
    A.registerComponent("goose-position-lock", {
      schema: {},
      init() {
        this._locked = this.el.object3D.position.clone();
      },
      tick() {
        const p = this.el.object3D.position;
        p.copy(this._locked);
      },
    });

    // Dynamic roast phrase handling with Gemini API (fallback to static list)
    const FALLBACK_ROASTS = [
      "Honk honk! Default fallback roast engaged!",
      "HONK! Your config forgot an API key!",
      "Honk! Even without AI I'm still roasting you!",
      "HONK HONK! Supply a Gemini key for fresh insults!",
    ];

    async function fetchGeminiRoasts(options = {}) {
      const {
        apiKey = window.NEXT_PUBLIC_GEMINI_API_KEY ||
          localStorage.getItem("NEXT_PUBLIC_GEMINI_API_KEY"),
        model = "gemini-1.5-flash",
        count = 24,
        temperature = 0.9,
      } = options;
      if (!apiKey) {
        console.warn(
          "[goose-voice] No Gemini API key provided. Using fallback roasts."
        );
        return FALLBACK_ROASTS;
      }
      const prompt = `Generate ${count} short, playful, PG-rated goose roast lines. Respond ONLY with a JSON array of strings.`;
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: {
                temperature,
                topP: 0.95,
                maxOutputTokens: 512,
              },
            }),
          }
        );
        if (!res.ok) {
          console.warn(
            "[goose-voice] Gemini request failed",
            res.status,
            await res.text()
          );
          return FALLBACK_ROASTS;
        }
        const data = await res.json();
        const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        let parsed = [];
        try {
          parsed = JSON.parse(raw);
        } catch (e) {
          // Attempt to salvage array by extracting lines between brackets
          const match = raw.match(/\[(.|\n|\r)*\]/);
          if (match) {
            try {
              parsed = JSON.parse(match[0]);
            } catch (_) {}
          }
        }
        if (!Array.isArray(parsed) || !parsed.length) {
          console.warn(
            "[goose-voice] Gemini returned unusable data, using fallback"
          );
          return FALLBACK_ROASTS;
        }
        // Sanitize & trim
        return parsed
          .map((s) => String(s).trim())
          .filter((s) => s.length > 0 && s.length < 160)
          .slice(0, count);
      } catch (err) {
        console.warn("[goose-voice] Gemini fetch error, using fallback", err);
        return FALLBACK_ROASTS;
      }
    }

    // Voice system for managing audio context and spatial audio
    A.registerSystem("goose-voice-system", {
      init() {
        this.audioContext = null;
        this.voices = new Map(); // Map of goose entities to their voice data
        this.roasts = [...FALLBACK_ROASTS];
        this.initializeAudioContext();
        this.loadDynamicRoasts();
      },
      async loadDynamicRoasts() {
        try {
          const dynamic = await fetchGeminiRoasts({});
          if (dynamic && dynamic.length) {
            this.roasts = dynamic;
            console.log("[goose-voice] Loaded dynamic roasts:", dynamic.length);
          }
        } catch (e) {
          console.warn("[goose-voice] Could not load dynamic roasts", e);
        }
      },
      getRoast() {
        if (!this.roasts || !this.roasts.length) return FALLBACK_ROASTS[0];
        return this.roasts[Math.floor(Math.random() * this.roasts.length)];
      },

      initializeAudioContext() {
        // Initialize Web Audio API context
        try {
          this.audioContext = new (window.AudioContext ||
            window.webkitAudioContext)();
          console.log("[goose-voice] Audio context initialized");
        } catch (error) {
          console.warn(
            "[goose-voice] Failed to initialize audio context:",
            error
          );
        }
      },

      registerGoose(gooseEntity) {
        if (!this.audioContext) return;

        const voiceData = {
          entity: gooseEntity,
          lastSpeakTime: 0,
          cooldown: 3000 + Math.random() * 4000, // 3-7 seconds between roasts
          volume: 0.7,
          pitch: 0.8 + Math.random() * 0.4, // Slight pitch variation
          isSpeaking: false,
        };

        this.voices.set(gooseEntity, voiceData);
      },

      unregisterGoose(gooseEntity) {
        this.voices.delete(gooseEntity);
      },

      speak(gooseEntity, phrase) {
        const voiceData = this.voices.get(gooseEntity);
        if (!voiceData || !this.audioContext || voiceData.isSpeaking) return;

        const now = performance.now();
        if (now - voiceData.lastSpeakTime < voiceData.cooldown) return;

        voiceData.isSpeaking = true;
        voiceData.lastSpeakTime = now;

        // Create speech synthesis
        this.synthesizeSpeech(phrase, voiceData);
      },

      synthesizeSpeech(phrase, voiceData) {
        // Always show the HUD even if speech synthesis isn't available
        this.showVoiceHud(phrase);

        if (!("speechSynthesis" in window)) {
          console.warn(
            "[goose-voice] Speech synthesis not supported, showing text only"
          );
          // Hide HUD after a delay if no speech synthesis
          setTimeout(() => {
            this.hideVoiceHud();
            voiceData.isSpeaking = false;
          }, 3000);
          return;
        }

        // Cancel any existing speech
        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(phrase);

        // Configure voice settings
        utterance.rate = 0.9 + Math.random() * 0.2; // Slight speed variation
        utterance.pitch = voiceData.pitch;
        utterance.volume = voiceData.volume;

        // Try to use a more robotic/goose-like voice if available
        const voices = speechSynthesis.getVoices();
        const preferredVoices = voices.filter(
          (voice) =>
            voice.name.toLowerCase().includes("robotic") ||
            voice.name.toLowerCase().includes("synthetic") ||
            voice.name.toLowerCase().includes("alex") ||
            voice.name.toLowerCase().includes("samantha")
        );

        if (preferredVoices.length > 0) {
          utterance.voice =
            preferredVoices[Math.floor(Math.random() * preferredVoices.length)];
        }

        // Add some goose-like effects
        utterance.onstart = () => {
          console.log(`[goose-voice] "${phrase}"`);
          this.showVoiceHud(phrase);
        };

        utterance.onend = () => {
          voiceData.isSpeaking = false;
          this.hideVoiceHud();
        };

        utterance.onerror = () => {
          voiceData.isSpeaking = false;
          console.warn("[goose-voice] Speech synthesis error");
        };

        speechSynthesis.speak(utterance);
      },

      showVoiceHud(phrase) {
        const hud = document.getElementById("gooseVoiceHud");
        const text = document.getElementById("gooseVoiceText");
        if (hud && text) {
          text.textContent = phrase;
          hud.style.opacity = "1";
        }
      },

      hideVoiceHud() {
        const hud = document.getElementById("gooseVoiceHud");
        if (hud) {
          hud.style.opacity = "0";
        }
      },
    });

    // Proximity voice component for individual geese
    A.registerComponent("goose-proximity-voice", {
      schema: {
        proximityRadius: { type: "number", default: 5.0 },
        checkRate: { type: "number", default: 100 }, // Check every 100ms
        target: { type: "selector", default: "#rig" },
        enabled: { type: "boolean", default: true },
      },

      init() {
        this.lastCheck = 0;
        this.tmpPlayerPos = new THREE.Vector3();
        this.tmpGoosePos = new THREE.Vector3();
        this.isInRange = false;
        this.voiceSystem = this.el.sceneEl.systems["goose-voice-system"];

        if (this.voiceSystem) {
          this.voiceSystem.registerGoose(this.el);
        }

        // Ensure speech synthesis voices are loaded
        if ("speechSynthesis" in window) {
          speechSynthesis.getVoices();
          // Some browsers need this event to load voices
          speechSynthesis.addEventListener("voiceschanged", () => {
            console.log("[goose-voice] Voices loaded");
          });
        }
      },

      remove() {
        if (this.voiceSystem) {
          this.voiceSystem.unregisterGoose(this.el);
        }
      },

      tick(time, deltaTime) {
        if (!this.data.enabled || !this.data.target || !this.voiceSystem)
          return;

        this.lastCheck += deltaTime;
        if (this.lastCheck < this.data.checkRate) return;
        this.lastCheck = 0;

        // Get positions
        this.data.target.object3D.getWorldPosition(this.tmpPlayerPos);
        this.el.object3D.getWorldPosition(this.tmpGoosePos);

        // Calculate distance
        const distance = this.tmpPlayerPos.distanceTo(this.tmpGoosePos);
        const wasInRange = this.isInRange;
        this.isInRange = distance <= this.data.proximityRadius;

        // Player just entered range - trigger a roast
        if (this.isInRange && !wasInRange) {
          this.triggerRoast();
        }
      },

      triggerRoast() {
        if (!this.voiceSystem) return;

        // Random chance to speak (70% chance)
        if (Math.random() > 0.7) return;

        // Get a roast phrase (dynamic if loaded)
        const phrase = this.voiceSystem.getRoast();

        // Add some goose-like prefixes
        const goosePrefixes = ["HONK! ", "Honk honk! ", "HONK HONK! ", ""];
        const prefix =
          goosePrefixes[Math.floor(Math.random() * goosePrefixes.length)];

        this.voiceSystem.speak(this.el, prefix + phrase);
      },
    });

    // Enhanced goose movement for tactical maps
    A.registerComponent("tactical-goose-mover", {
      schema: {
        speed: { type: "number", default: 0.8 },
        target: { type: "selector", default: "#rig" },
        stop: { type: "number", default: 0.6 },
        activationRadius: { type: "number", default: 8 },
        tickRate: { type: "number", default: 50 },
        avoidanceRadius: { type: "number", default: 2.0 },
        platformAware: { type: "boolean", default: true },
        initialDelay: { type: "number", default: 750 }, // ms before any movement logic
      },

      init() {
        this.tmpP = new THREE.Vector3();
        this.tmpT = new THREE.Vector3();
        this.tmpAvoid = new THREE.Vector3();
        this.active = false;
        this._accum = 0;
        this.raycaster = new THREE.Raycaster();
        this.avoidanceTargets = [];
        this._spawnTime = performance.now();
        this._firstMoveLogged = false;
      },

      tick(t, dt) {
        if (!this.data.target) return;
        // Hold position during initial delay to verify spawn locations.
        if (performance.now() - this._spawnTime < this.data.initialDelay)
          return;
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

        // Basic movement towards player
        if (dist > this.data.stop) {
          dir.normalize();

          // Add avoidance behavior for obstacles
          if (this.data.platformAware) {
            this.addAvoidance(dir);
          }

          obj.position.addScaledVector(
            dir,
            (this.data.speed * (this.data.tickRate || dt)) / 1000
          );
          if (
            !this._firstMoveLogged &&
            this.el.sceneEl.systems["goose-voice-system"]
          ) {
            this._firstMoveLogged = true;
            console.log(
              "[tactical-goose-mover] first move",
              this.el.getAttribute("data-goose-id"),
              obj.position.clone()
            );
          }
        }

        // Face movement direction
        dir.y = 0;
        if (dir.lengthSq() > 1e-4) {
          obj.rotation.set(0, Math.atan2(dir.x, dir.z), 0);
        }
      },

      addAvoidance(moveDir) {
        // Simple obstacle avoidance by checking for nearby walls/platforms
        const obj = this.el.object3D;
        const pos = obj.position;

        // Check for obstacles in movement direction
        this.raycaster.set(pos, moveDir);
        const obstacles = this.el.sceneEl.querySelectorAll(
          'a-entity[geometry*="box"]'
        );

        for (let obstacle of obstacles) {
          const obstacleMesh = obstacle.getObject3D("mesh");
          if (obstacleMesh && obstacle !== this.el) {
            const intersects = this.raycaster.intersectObject(obstacleMesh);
            if (
              intersects.length > 0 &&
              intersects[0].distance < this.data.avoidanceRadius
            ) {
              // Steer away from obstacle
              const avoidDir = intersects[0].point.clone().sub(pos).normalize();
              const perpendicular = new THREE.Vector3(
                -avoidDir.z,
                0,
                avoidDir.x
              );
              moveDir.add(perpendicular.multiplyScalar(0.5));
              moveDir.normalize();
              break;
            }
          }
        }
      },
    });

    // Simplified static goose spawner: spawns all geese from a fixed list once at init.
    A.registerComponent("goose-spawn-manager", {
      schema: {
        debug: { type: "boolean", default: false },
        usePrimitive: { type: "boolean", default: false },
        voiceEnabled: { type: "boolean", default: true },
        voiceProximityRadius: { type: "number", default: 5.0 },
        activationRadius: { type: "number", default: 60 }, // larger so all geese activate immediately
        // Note: activationRadius is kept for compatibility but chase radius now fixed to 15 in enemy-laser/goose-brain attributes.
        moveSpeed: { type: "number", default: 0.9 },
        laserRate: { type: "int", default: 1500 },
        disableMovement: { type: "boolean", default: false },
      },
      init() {
        this.scene = this.el.sceneEl || this.el;
        this.positions = [
          { x: -25, y: 3, z: 25 },
          { x: 25, y: 3, z: 25 },
          { x: -25, y: 3, z: -25 },
          { x: 25, y: 3, z: -25 },
          { x: -20, y: 3.5, z: 15 },
          { x: 20, y: 3.5, z: 15 },
          { x: -20, y: 3.5, z: -15 },
          { x: 20, y: 3.5, z: -15 },
          { x: -15, y: 5.5, z: 0 },
          { x: 15, y: 5.5, z: 0 },
          { x: 0, y: 6.5, z: 20 },
          { x: 0, y: 6.5, z: -20 },
          { x: -12, y: 2, z: 8 },
          { x: 12, y: 2, z: 8 },
          { x: -12, y: 2, z: -8 },
          { x: 12, y: 2, z: -8 },
          { x: -8, y: 2, z: 12 },
          { x: 8, y: 2, z: 12 },
          { x: -8, y: 2, z: -12 },
          { x: 8, y: 2, z: -12 },
        ];
        this.spawnAll();
      },
      spawnAll() {
        const created = [];
        this.positions.forEach((p, i) => {
          const ent = document.createElement("a-entity");
          ent.setAttribute("position", `${p.x} ${p.y} ${p.z}`);
          const s = 0.35;
          ent.setAttribute("scale", `${s} ${s} ${s}`);
          if (this.data.usePrimitive) {
            this._buildPrimitiveGoose(ent);
          } else {
            ent.setAttribute("gltf-model", "assets/goose.glb");
            ent.setAttribute("goose-anim", "");
          }
          if (!this.data.disableMovement) {
            ent.setAttribute(
              "goose-brain",
              `speed:${this.data.moveSpeed.toFixed(
                3
              )}; chaseRadius:${15}; wanderRadius:6; repathInterval:900`
            );
            // Fire only while chasing (within chase radius). Aim directly at target every second.
            ent.setAttribute(
              "enemy-laser",
              `activationRadius:${15}; rate:1000; requireChase:true; aimAtTarget:true; autoOffset:true`
            );
          }
          // Use smooth capsule collision (handles gravity, stepping, sliding)
          ent.setAttribute(
            "goose-collision-smooth",
            "radius:0.26; height:0.55; stepHeight:0.4; requireDescending:true; minDescendSpeed:-0.05"
          );
          ent.setAttribute("hittable", "");
          ent.setAttribute("enemy", "");
          if (this.data.voiceEnabled) {
            ent.setAttribute(
              "goose-proximity-voice",
              `proximityRadius:${this.data.voiceProximityRadius}; target:#rig; enabled:true`
            );
          }
          ent.setAttribute("data-goose-id", i + 1);
          this.scene.appendChild(ent);
          // Ground snap: raycast downward to nearest solid within a reasonable range.
          this._snapGooseToGround(ent);
          created.push(ent);
          // Debug: log intended vs actual world position across frames
          const intended = { ...p, idx: i + 1 };
          const logPos = (tag) => {
            const wp = new THREE.Vector3();
            ent.object3D.getWorldPosition(wp);
            console.log(
              `[goose-spawn-debug] #${intended.idx} ${tag} intended=(${
                intended.x
              },${intended.y},${intended.z}) world=(${wp.x.toFixed(
                2
              )},${wp.y.toFixed(2)},${wp.z.toFixed(
                2
              )}) localAttr=${ent.getAttribute("position")}`
            );
          };
          if (this.data.debug) {
            logPos("t0");
            requestAnimationFrame(() => logPos("raf1"));
            requestAnimationFrame(() => {
              requestAnimationFrame(() => logPos("raf2"));
            });
            setTimeout(() => logPos("200ms"), 200);
            setTimeout(() => logPos("1000ms"), 1000);
          }
        });
        this.scene.emit("geeseSpawned", { geese: created, static: true });
      },
      _snapGooseToGround(ent) {
        const scene = this.sceneEl || this.scene;
        if (!scene) return;
        const obj = ent.object3D;
        const origin = obj.position.clone();
        // Cast from slightly above current pos to ensure we detect directly below.
        origin.y += 0.5;
        const dir = new THREE.Vector3(0, -1, 0);
        const ray = new THREE.Raycaster(origin, dir, 0, 20);
        const meshes = [];
        scene.object3D.traverse((o) => {
          if (o.el && o.el.classList && o.el.classList.contains("solid"))
            meshes.push(o);
        });
        const hits = ray.intersectObjects(meshes, true);
        if (hits && hits.length) {
          // Use first hit (closest)
          const h = hits[0];
          // Place goose body slightly above surface to avoid initial penetration so physics can settle.
          obj.position.y = h.point.y + 0.02;
        }
      },
      _buildPrimitiveGoose(root) {
        const mk = (geom, mat, pos, scale) => {
          const e = document.createElement("a-entity");
          e.setAttribute("geometry", geom);
          e.setAttribute("material", mat);
          e.setAttribute("position", pos);
          if (scale) e.setAttribute("scale", scale);
          root.appendChild(e);
          return e;
        };
        mk(
          "primitive:sphere; radius:0.5",
          "color:#ffffff; roughness:0.8",
          "0 0.55 0",
          "1 0.7 1.4"
        );
        mk(
          "primitive:cylinder; radius:0.12; height:0.8",
          "color:#ffffff; roughness:0.8",
          "0 1.15 0.2"
        );
        mk(
          "primitive:sphere; radius:0.18",
          "color:#ffffff; roughness:0.75",
          "0 1.55 0.35"
        );
        mk(
          "primitive:cone; radiusBottom:0.09; radiusTop:0.02; height:0.22",
          "color:#ffb347; emissive:#663300; roughness:0.6",
          "0 1.55 0.52"
        );
        mk(
          "primitive:sphere; radius:0.035",
          "color:#111111",
          "-0.07 1.57 0.42"
        );
        mk("primitive:sphere; radius:0.035", "color:#111111", "0.07 1.57 0.42");
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
  };
  if (window.AFRAME) {
    start();
  } else {
    const wait = () => {
      if (window.AFRAME) return start();
      requestAnimationFrame(wait);
    };
    wait();
  }
})();
