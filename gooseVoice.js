// gooseVoice.js - Proximity voice system for geese to roast the player
(function () {
  if (!window.AFRAME) return;
  const A = AFRAME;

  // Collection of roast phrases for geese to say
  const ROAST_PHRASES = [
    "Honk honk! Look who's trying to be a hero!",
    "You call that aim? My grandma shoots better!",
    "Honk! Are you lost? This isn't a daycare!",
    "HONK! You're moving like you're stuck in molasses!",
    "Honk honk! Did you forget how to walk?",
    "HONK! Your reflexes are slower than a snail!",
    "Honk! Is that the best you can do?",
    "HONK HONK! You're making this too easy!",
    "Honk! Maybe you should stick to watching TV!",
    "HONK! I've seen better players in tutorial mode!",
    "Honk honk! Are you even trying?",
    "HONK! You're about as threatening as a pillow!",
    "Honk! My pet rock has better game sense!",
    "HONK HONK! You're embarrassing yourself!",
    "Honk! Did you learn to play from a manual?",
    "HONK! You're so bad, you make me look good!",
    "Honk honk! Maybe try a different hobby?",
    "HONK! You're like a walking target practice!",
    "Honk! I could beat you with my eyes closed!",
    "HONK HONK! You're making geese look smart!",
    "Honk! Your strategy is... wait, you have a strategy?",
    "HONK! I've seen better coordination in a chicken coop!",
    "Honk honk! Are you sure you know what you're doing?",
    "HONK! You're about as stealthy as a marching band!",
    "Honk! My feathers have better reflexes than you!",
    "HONK HONK! You're like a tutorial that never ends!",
    "Honk! I could outsmart you in my sleep!",
    "HONK! You're making this look like a comedy show!",
    "Honk honk! Maybe you should stick to easy mode!",
    "HONK! You're so predictable, I could write a book about it!"
  ];

  // Voice system for managing audio context and spatial audio
  A.registerSystem("goose-voice-system", {
    init() {
      this.audioContext = null;
      this.voices = new Map(); // Map of goose entities to their voice data
      this.initializeAudioContext();
    },

    initializeAudioContext() {
      // Initialize Web Audio API context
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log("[goose-voice] Audio context initialized");
      } catch (error) {
        console.warn("[goose-voice] Failed to initialize audio context:", error);
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
        isSpeaking: false
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
      
      if (!('speechSynthesis' in window)) {
        console.warn("[goose-voice] Speech synthesis not supported, showing text only");
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
      const preferredVoices = voices.filter(voice => 
        voice.name.toLowerCase().includes('robotic') || 
        voice.name.toLowerCase().includes('synthetic') ||
        voice.name.toLowerCase().includes('alex') ||
        voice.name.toLowerCase().includes('samantha')
      );
      
      if (preferredVoices.length > 0) {
        utterance.voice = preferredVoices[Math.floor(Math.random() * preferredVoices.length)];
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
      const hud = document.getElementById('gooseVoiceHud');
      const text = document.getElementById('gooseVoiceText');
      if (hud && text) {
        text.textContent = phrase;
        hud.style.opacity = '1';
      }
    },

    hideVoiceHud() {
      const hud = document.getElementById('gooseVoiceHud');
      if (hud) {
        hud.style.opacity = '0';
      }
    }
  });

  // Proximity voice component for individual geese
  A.registerComponent("goose-proximity-voice", {
    schema: {
      proximityRadius: { type: "number", default: 5.0 },
      checkRate: { type: "number", default: 100 }, // Check every 100ms
      target: { type: "selector", default: "#rig" },
      enabled: { type: "boolean", default: true }
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
      if ('speechSynthesis' in window) {
        speechSynthesis.getVoices();
        // Some browsers need this event to load voices
        speechSynthesis.addEventListener('voiceschanged', () => {
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
      if (!this.data.enabled || !this.data.target || !this.voiceSystem) return;
      
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

      // Select a random roast phrase
      const phrase = ROAST_PHRASES[Math.floor(Math.random() * ROAST_PHRASES.length)];
      
      // Add some goose-like prefixes
      const goosePrefixes = ["HONK! ", "Honk honk! ", "HONK HONK! ", ""];
      const prefix = goosePrefixes[Math.floor(Math.random() * goosePrefixes.length)];
      
      this.voiceSystem.speak(this.el, prefix + phrase);
    }
  });

  // Enhanced goose spawn manager to include voice component
  A.registerComponent("goose-spawn-manager-with-voice", {
    schema: {
      perRoundBase: { type: "int", default: 3 },
      perRoundAdd: { type: "int", default: 2 },
      scale: { type: "number", default: 0.35 },
      activationRadius: { type: "number", default: 8 },
      randomGround: { type: "int", default: 4 },
      minDistanceFromPlayer: { type: "number", default: 6 },
      spawnForwardMinZ: { type: "number", default: 0 },
      usePrimitive: { type: "boolean", default: false },
      voiceEnabled: { type: "boolean", default: true },
      voiceProximityRadius: { type: "number", default: 5.0 }
    },

    init() {
      this.round = 1;
      this.scene = this.el.sceneEl || this.el;
      this.player = document.querySelector("#rig");
      this.tmpPlayer = new THREE.Vector3();
      
      if (this.scene) {
        this.scene.addEventListener("roundrestart", (e) => {
          this.round = e.detail && e.detail.round ? e.detail.round : this.round + 1;
          this.spawnBatch();
        });
      }
      this.spawnBatch();
    },

    _farEnough(x, z) {
      if (!this.player) return true;
      this.player.object3D.getWorldPosition(this.tmpPlayer);
      const dx = x - this.tmpPlayer.x;
      const dz = z - this.tmpPlayer.z;
      return dx * dx + dz * dz >= this.data.minDistanceFromPlayer * this.data.minDistanceFromPlayer;
    },

    _ensureFar(pos) {
      if (this._farEnough(pos.x, pos.z)) return pos;
      if (!this.player) return pos;
      
      this.player.object3D.getWorldPosition(this.tmpPlayer);
      let dx = pos.x - this.tmpPlayer.x;
      let dz = pos.z - this.tmpPlayer.z;
      let len = Math.sqrt(dx * dx + dz * dz);
      
      if (len < 0.001) {
        const ang = Math.random() * Math.PI * 2;
        dx = Math.cos(ang);
        dz = Math.sin(ang);
        len = 1;
      }
      
      const targetR = this.data.minDistanceFromPlayer + 0.5 + Math.random() * 2;
      const scale = targetR / len;
      pos.x = this.tmpPlayer.x + dx * scale;
      pos.z = this.tmpPlayer.z + dz * scale;
      return pos;
    },

    _placeNear(basePos) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const jitterR = 0.4 + Math.random() * 1.2;
        const jitterA = Math.random() * Math.PI * 2;
        const px = basePos.x + Math.cos(jitterA) * jitterR;
        const pz = basePos.z + Math.sin(jitterA) * jitterR;
        if (this._farEnough(px, pz)) return { x: px, y: basePos.y, z: pz };
      }
      return this._ensureFar({ ...basePos });
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
      
      const count = this.data.perRoundBase + (this.round - 1) * this.data.perRoundAdd;
      let spawns = Array.from(this.scene.querySelectorAll(".enemy-spawn"));
      
      if (this.data.spawnForwardMinZ) {
        spawns = spawns.filter((s) => {
          const p = s.getAttribute("position");
          return p.z >= this.data.spawnForwardMinZ;
        });
      }

      // Spawn geese with voice component
      for (let i = 0; i < count; i++) {
        this.spawnGoose(spawns, i);
      }

      // Spawn random ground geese
      for (let g = 0; g < this.data.randomGround; g++) {
        this.spawnGoose([], g, true);
      }
    },

    spawnGoose(spawns, index, isGroundSpawn = false) {
      const enemy = document.createElement("a-entity");
      let basePos;
      
      if (spawns.length && !isGroundSpawn) {
        basePos = spawns[index % spawns.length].getAttribute("position");
        basePos = this._ensureFar(this._placeNear(basePos));
      } else {
        basePos = isGroundSpawn ? this._placeGround() : {
          x: Math.random() * 10 - 5,
          y: 1,
          z: Math.random() * 10 - 5
        };
      }

      enemy.setAttribute("position", `${basePos.x} ${basePos.y} ${basePos.z}`);
      const s = this.data.scale;
      enemy.setAttribute("scale", `${s} ${s} ${s}`);

      // Add goose model and components
      if (this.data.usePrimitive) {
        this._buildPrimitiveGoose(enemy);
      } else {
        enemy.setAttribute("gltf-model", "assets/goose.glb");
        enemy.setAttribute("goose-anim", "");
      }

      // Add movement and combat components
      enemy.setAttribute("enemy-mover", `activationRadius:${this.data.activationRadius}`);
      enemy.setAttribute("enemy-laser", `activationRadius:${this.data.activationRadius}`);
      enemy.setAttribute("hittable", "");
      enemy.setAttribute("enemy", "");

      // Add voice component if enabled
      if (this.data.voiceEnabled) {
        enemy.setAttribute("goose-proximity-voice", 
          `proximityRadius:${this.data.voiceProximityRadius}; target:#rig; enabled:true`);
      }

      // Handle model loading
      if (!this.data.usePrimitive) {
        enemy.addEventListener("model-loaded", (e) => {
          console.log("[goose] model loaded", e.detail);
        });
        enemy.addEventListener("model-error", (e) => {
          console.warn("[goose] model load failed, using primitive fallback", e.detail);
          enemy.removeAttribute("gltf-model");
          this._buildPrimitiveGoose(enemy);
        });
      }

      this.scene.appendChild(enemy);
    },

    _buildPrimitiveGoose(root) {
      // Same primitive goose building logic as original
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
      mk("primitive:sphere; radius:0.5", "color:#ffffff; roughness:0.8", "0 0.55 0", "1 0.7 1.4");
      // Neck
      mk("primitive:cylinder; radius:0.12; height:0.8", "color:#ffffff; roughness:0.8", "0 1.15 0.2");
      // Head
      mk("primitive:sphere; radius:0.18", "color:#ffffff; roughness:0.75", "0 1.55 0.35");
      // Beak
      mk("primitive:cone; radiusBottom:0.09; radiusTop:0.02; height:0.22", "color:#ffb347; emissive:#663300; roughness:0.6", "0 1.55 0.52");
      // Eyes
      mk("primitive:sphere; radius:0.035", "color:#111111", "-0.07 1.57 0.42");
      mk("primitive:sphere; radius:0.035", "color:#111111", "0.07 1.57 0.42");
      // Legs
      mk("primitive:cylinder; radius:0.06; height:0.55", "color:#ffb347; roughness:0.5", "-0.15 0.27 0");
      mk("primitive:cylinder; radius:0.06; height:0.55", "color:#ffb347; roughness:0.5", "0.15 0.27 0");
      // Feet
      mk("primitive:box; width:0.22; height:0.05; depth:0.28", "color:#ffb347; roughness:0.4", "-0.15 0.02 0.05");
      mk("primitive:box; width:0.22; height:0.05; depth:0.28", "color:#ffb347; roughness:0.4", "0.15 0.02 0.05");
    }
  });

})();
