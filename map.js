// map.js - procedural open map with multi-height platforms & spawn points
aframeReady(() => {
  AFRAME.registerComponent("matrix-map", {
    schema: {
      platformCount: { type: "int", default: 14 },
      radius: { type: "number", default: 25 },
      minSize: { type: "number", default: 3 },
      maxSize: { type: "number", default: 9 },
      minHeight: { type: "number", default: 0.5 },
      maxHeight: { type: "number", default: 8 },
      spawnClass: { type: "string", default: "enemy-spawn" },
      theme: { type: "string", default: "gray" },
      seed: { type: "int", default: 0 },
      layout: { type: "string", default: "radial" }, // 'radial' or 'linear'
      safeLength: { type: "number", default: 12 }, // linear safe zone length along +Z
      corridorWidth: { type: "number", default: 20 }, // linear corridor width X
      forwardLength: { type: "number", default: 180 }, // total forward extent from origin
      spawnStartZ: { type: "number", default: 35 }, // z after which enemy spawns begin
      linearPlatformBands: { type: "int", default: 6 }, // number of rough z-bands for platforms
    },
    init() {
      this.rand = this.makeRNG(
        this.data.seed || Math.floor(Math.random() * 1e9)
      );
      this.platforms = [];
      if (this.data.layout === "linear") {
        this.buildLinear();
      } else if (this.data.layout === "square") {
        this.buildSquare();
      } else if (this.data.layout === "static") {
        this.buildStatic();
      } else if (this.data.layout === "empty") {
        this.buildEmpty();
      } else {
        this.buildBase();
        this.buildPlatforms();
        this.buildSpawnPoints();
      }
    },
    makeRNG(seed) {
      return function () {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 0xffffffff;
      };
    },
    buildBase() {
      // Slightly lowered base to prevent z-fighting with any global ground plane.
      const base = document.createElement("a-entity");
      base.setAttribute(
        "geometry",
        `primitive: cylinder; radius: ${this.data.radius}; height: 0.6`
      );
      base.setAttribute("position", "0 -0.35 0");
      base.setAttribute(
        "grid-material",
        "cellSize:2; lineThickness:0.12; roughness:0.94; metalness:0.03"
      );
      this.el.appendChild(base);
    },
    buildLinear() {
      // Safe zone floor (no spawns) - rectangular pad
      const safe = document.createElement("a-entity");
      safe.setAttribute(
        "geometry",
        `primitive: box; width:${this.data.corridorWidth}; height:0.4; depth:${this.data.safeLength}`
      );
      safe.setAttribute("position", `0 0 ${this.data.safeLength / 2}`);
      safe.setAttribute(
        "grid-material",
        "cellSize:2; lineThickness:0.12; roughness:0.94; metalness:0.03"
      );
      this.el.appendChild(safe);

      // Corridor segments beyond safe zone (walkway)
      const segmentLen = 18;
      for (
        let z = this.data.safeLength;
        z < this.data.forwardLength;
        z += segmentLen
      ) {
        const seg = document.createElement("a-entity");
        const depth = Math.min(segmentLen, this.data.forwardLength - z);
        seg.setAttribute(
          "geometry",
          `primitive: box; width:${this.data.corridorWidth}; height:0.32; depth:${depth}`
        );
        seg.setAttribute("position", `0 0 ${z + depth / 2}`);
        seg.setAttribute(
          "grid-material",
          "cellSize:2; lineThickness:0.12; roughness:0.93; metalness:0.03"
        );
        this.el.appendChild(seg);
      }

      // Side walls (simple low barriers) for guidance
      const wallInterval = 24;
      for (
        let z = this.data.safeLength + 4;
        z < this.data.forwardLength;
        z += wallInterval
      ) {
        const left = document.createElement("a-entity");
        left.setAttribute(
          "geometry",
          `primitive: box; width:0.6; height:2; depth:14`
        );
        left.setAttribute(
          "position",
          `${-this.data.corridorWidth / 2 + 0.4} 1 ${z}`
        );
        left.setAttribute(
          "material",
          "color:#2e2e2e; roughness:0.85; metalness:0.05"
        );
        this.el.appendChild(left);
        const right = document.createElement("a-entity");
        right.setAttribute(
          "geometry",
          `primitive: box; width:0.6; height:2; depth:14`
        );
        right.setAttribute(
          "position",
          `${this.data.corridorWidth / 2 - 0.4} 1 ${z + 7}`
        );
        right.setAttribute(
          "material",
          "color:#2e2e2e; roughness:0.85; metalness:0.05"
        );
        this.el.appendChild(right);
      }

      // Directional platforms ahead (spawn candidates) arranged in bands
      const bands = this.data.linearPlatformBands;
      for (let b = 0; b < bands; b++) {
        const zStart =
          this.data.spawnStartZ +
          b * ((this.data.forwardLength - this.data.spawnStartZ) / bands);
        const zEnd =
          this.data.spawnStartZ +
          (b + 1) * ((this.data.forwardLength - this.data.spawnStartZ) / bands);
        const localPlatforms = Math.max(
          2,
          Math.floor(this.data.platformCount / bands)
        );
        for (let i = 0; i < localPlatforms; i++) {
          const plat = document.createElement("a-entity");
          const w =
            this.data.minSize +
            this.rand() * (this.data.maxSize - this.data.minSize);
          const d =
            this.data.minSize +
            this.rand() * (this.data.maxSize - this.data.minSize);
          const zPos = zStart + this.rand() * (zEnd - zStart);
          const lateral =
            (this.rand() * 2 - 1) * (this.data.corridorWidth * 0.45);
          plat.setAttribute(
            "geometry",
            `primitive: box; width:${w}; height:0.45; depth:${d}`
          );
          const h =
            this.data.minHeight +
            this.rand() * (this.data.maxHeight - this.data.minHeight);
          plat.setAttribute("position", `${lateral} ${h} ${zPos}`);
          plat.setAttribute("rotation", `0 ${this.rand() * 360} 0`);
          plat.setAttribute(
            "grid-material",
            "cellSize:2; lineThickness:0.12; roughness:0.9; metalness:0.05"
          );
          this.el.appendChild(plat);
          this.platforms.push(plat);
        }
      }

      // Spawn points only on a subset of platforms (skip ones too near safe zone)
      this.buildSpawnPointsLinear();
    },
    buildSpawnPointsLinear() {
      const valid = this.platforms.filter((p) => {
        const pos = p.getAttribute("position");
        return pos.z >= this.data.spawnStartZ - 2; // ensure outside safe zone
      });
      valid.slice(0, Math.min(30, valid.length)).forEach((p) => {
        const pos = p.getAttribute("position");
        const sp = document.createElement("a-entity");
        sp.setAttribute("position", `${pos.x} ${Number(pos.y) + 0.5} ${pos.z}`);
        sp.setAttribute("class", this.data.spawnClass);
        sp.setAttribute(
          "geometry",
          "primitive:ring; radiusInner:0.25; radiusOuter:0.42; segmentsTheta:30"
        );
        sp.setAttribute(
          "material",
          "color:#3eff8c; emissive:#0a391b; opacity:0.4; transparent:true"
        );
        this.el.appendChild(sp);
      });
    },
    buildPlatforms() {
      for (let i = 0; i < this.data.platformCount; i++) {
        const angle = this.rand() * Math.PI * 2;
        const dist = this.rand() * this.data.radius * 0.85;
        const size =
          this.data.minSize +
          this.rand() * (this.data.maxSize - this.data.minSize);
        const h =
          this.data.minHeight +
          this.rand() * (this.data.maxHeight - this.data.minHeight);
        const y = i % 3 === 0 ? h : h * 0.5 * (this.rand() + 0.5); // varied heights
        const plat = document.createElement("a-entity");
        const w = size;
        const d = size * (0.5 + this.rand() * 1.2);
        plat.setAttribute(
          "geometry",
          `primitive: box; width:${w}; height:0.4; depth:${d}`
        );
        plat.setAttribute(
          "grid-material",
          "cellSize:2; lineThickness:0.12; roughness:0.9; metalness:0.05"
        );
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;
        plat.setAttribute("position", `${x} ${y} ${z}`);
        // Slight rotation for variety
        plat.setAttribute("rotation", `0 ${this.rand() * 360} 0`);
        this.el.appendChild(plat);
        this.platforms.push(plat);
      }
    },
    buildSpawnPoints() {
      // Radial layout spawn points: subset of existing platforms
      this.platforms
        .slice(0, Math.min(12, this.platforms.length))
        .forEach((p) => {
          const pos = p.getAttribute("position");
          const sp = document.createElement("a-entity");
          sp.setAttribute(
            "position",
            `${pos.x} ${Number(pos.y) + 0.4} ${pos.z}`
          );
          sp.setAttribute("class", this.data.spawnClass);
          sp.setAttribute(
            "geometry",
            "primitive: ring; radiusInner:0.2; radiusOuter:0.35; segmentsTheta:24"
          );
          sp.setAttribute(
            "material",
            "color:#3eff8c; emissive:#0a391b; opacity:0.35; transparent:true"
          );
          this.el.appendChild(sp);
        });
    },
    buildSquare() {
      // Square arena parameters derived from radius (treat radius as half side length approximate)
      const half = this.data.radius; // reuse existing radius field for scale
      const side = half * 2;
      // Base square floor
      const floor = document.createElement("a-entity");
      floor.setAttribute(
        "geometry",
        `primitive: box; width:${side}; height:0.4; depth:${side}`
      );
      floor.setAttribute("position", `0 0 0`);
      floor.setAttribute(
        "grid-material",
        "cellSize:2; lineThickness:0.12; roughness:0.94; metalness:0.03"
      );
      this.el.appendChild(floor);

      // Entrance rectangle protruding on -Z side (player spawn area / safe zone)
      const entranceDepth = Math.min(10, half * 0.6);
      const entrance = document.createElement("a-entity");
      entrance.setAttribute(
        "geometry",
        `primitive: box; width:${Math.min(
          side * 0.4,
          half * 0.8
        )}; height:0.42; depth:${entranceDepth}`
      );
      entrance.setAttribute(
        "position",
        `0 0 ${-half - entranceDepth / 2 + 0.2}`
      );
      entrance.setAttribute(
        "grid-material",
        "cellSize:2; lineThickness:0.12; roughness:0.95; metalness:0.03"
      );
      this.el.appendChild(entrance);

      // Perimeter low walls (optional) - simple corners & edges (skip entrance gap)
      const wallH = 2,
        wallT = 0.6;
      const edges = [
        { x: 0, z: half, w: side, d: wallT }, // north edge
        { x: half, z: 0, w: wallT, d: side }, // east edge
        { x: -half, z: 0, w: wallT, d: side }, // west edge
        { x: 0, z: -half, w: side * 0.6, d: wallT }, // south edge partial (leave entrance opening)
      ];
      edges.forEach((e) => {
        const wEnt = document.createElement("a-entity");
        wEnt.setAttribute(
          "geometry",
          `primitive: box; width:${e.w}; height:${wallH}; depth:${e.d}`
        );
        wEnt.setAttribute("position", `${e.x} ${wallH / 2} ${e.z}`);
        wEnt.setAttribute(
          "material",
          "color:#2e2e2e; roughness:0.85; metalness:0.05"
        );
        this.el.appendChild(wEnt);
      });

      // Platform scattering inside square (avoid entrance quadrant near negative Z center)
      const plats = this.data.platformCount;
      for (let i = 0; i < plats; i++) {
        const plat = document.createElement("a-entity");
        const w =
          this.data.minSize +
          this.rand() * (this.data.maxSize - this.data.minSize);
        const d =
          this.data.minSize +
          this.rand() * (this.data.maxSize - this.data.minSize);
        // Sample until not inside entrance lane
        let x, z;
        let tries = 0;
        do {
          x = (this.rand() * 2 - 1) * (half * 0.9);
          z = (this.rand() * 2 - 1) * (half * 0.9);
          tries++;
        } while (z < -half * 0.7 && Math.abs(x) < side * 0.25 && tries < 20);
        const h =
          this.data.minHeight +
          this.rand() * (this.data.maxHeight - this.data.minHeight);
        plat.setAttribute(
          "geometry",
          `primitive: box; width:${w}; height:0.4; depth:${d}`
        );
        plat.setAttribute("position", `${x} ${h} ${z}`);
        plat.setAttribute("rotation", `0 ${this.rand() * 360} 0`);
        plat.setAttribute(
          "grid-material",
          "cellSize:2; lineThickness:0.12; roughness:0.9; metalness:0.05"
        );
        this.el.appendChild(plat);
        this.platforms.push(plat);
      }
      this.buildSpawnPointsSquare(half, side);
    },
    buildSpawnPointsSquare(half, side) {
      // Spawn points from subset excluding entrance zone
      const valid = this.platforms.filter((p) => {
        const pos = p.getAttribute("position");
        return !(pos.z < -half * 0.7 && Math.abs(pos.x) < side * 0.25);
      });
      valid.slice(0, Math.min(24, valid.length)).forEach((p) => {
        const pos = p.getAttribute("position");
        const sp = document.createElement("a-entity");
        sp.setAttribute(
          "position",
          `${pos.x} ${Number(pos.y) + 0.45} ${pos.z}`
        );
        sp.setAttribute("class", this.data.spawnClass);
        sp.setAttribute(
          "geometry",
          "primitive:ring; radiusInner:0.25; radiusOuter:0.42; segmentsTheta:30"
        );
        sp.setAttribute(
          "material",
          "color:#3eff8c; emissive:#0a391b; opacity:0.4; transparent:true"
        );
        this.el.appendChild(sp);
      });
    },
    buildStatic() {
      // Deterministic handcrafted layout: central plaza + four corner towers + side bridges.
      this.platforms = [];
      const plazaSize = 40;
      const plaza = document.createElement("a-entity");
      plaza.setAttribute(
        "geometry",
        `primitive: box; width:${plazaSize}; height:0.5; depth:${plazaSize}`
      );
      plaza.setAttribute("position", "0 0 0");
      plaza.setAttribute(
        "grid-material",
        "cellSize:2; lineThickness:0.12; roughness:0.94; metalness:0.03"
      );
      this.el.appendChild(plaza);

      // (Removed) Corner towers were here; keeping ground more open per request.

      // Side elevated bridges
      const bridges = [
        { x: 0, y: 3, z: 18, w: 26, d: 4, rot: 0 }, // north
        { x: 0, y: 3, z: -18, w: 26, d: 4, rot: 0 }, // south
        { x: 18, y: 3, z: 0, w: 4, d: 26, rot: 0 }, // east
        { x: -18, y: 3, z: 0, w: 4, d: 26, rot: 0 }, // west
      ];
      bridges.forEach((b) => {
        const br = document.createElement("a-entity");
        br.setAttribute(
          "geometry",
          `primitive: box; width:${b.w}; height:0.4; depth:${b.d}`
        );
        br.setAttribute("position", `${b.x} ${b.y} ${b.z}`);
        br.setAttribute(
          "grid-material",
          "cellSize:2; lineThickness:0.12; roughness:0.92; metalness:0.04"
        );
        this.el.appendChild(br);
        this.platforms.push(br);
      });

      // Small mid platforms
      const mids = [
        { x: 0, y: 2, z: 10, w: 8, d: 6 },
        { x: 0, y: 2, z: -10, w: 8, d: 6 },
        { x: 10, y: 2, z: 0, w: 6, d: 8 },
        { x: -10, y: 2, z: 0, w: 6, d: 8 },
        { x: 0, y: 6, z: 0, w: 10, d: 10 }, // high center
      ];
      mids.forEach((m) => {
        const mp = document.createElement("a-entity");
        mp.setAttribute(
          "geometry",
          `primitive: box; width:${m.w}; height:0.4; depth:${m.d}`
        );
        mp.setAttribute("position", `${m.x} ${m.y} ${m.z}`);
        mp.setAttribute(
          "grid-material",
          "cellSize:2; lineThickness:0.12; roughness:0.9; metalness:0.05"
        );
        this.el.appendChild(mp);
        this.platforms.push(mp);
      });

      // Spawn points: choose a curated subset; avoid ground plaza center for variety
      const spawnOrigins = this.platforms
        .filter((p) => {
          const pos = p.getAttribute("position");
          return !(Math.abs(pos.x) < 6 && Math.abs(pos.z) < 6 && pos.y < 1);
        })
        .slice(0, 18);
      spawnOrigins.forEach((p) => {
        const pos = p.getAttribute("position");
        const sp = document.createElement("a-entity");
        sp.setAttribute("position", `${pos.x} ${Number(pos.y) + 0.5} ${pos.z}`);
        sp.setAttribute("class", this.data.spawnClass);
        sp.setAttribute(
          "geometry",
          "primitive:ring; radiusInner:0.25; radiusOuter:0.42; segmentsTheta:30"
        );
        sp.setAttribute(
          "material",
          "color:#3eff8c; emissive:#0a391b; opacity:0.4; transparent:true"
        );
        this.el.appendChild(sp);
      });
    },
    buildEmpty() {
      // Intentionally create nothing (ground plane in scene remains). Keep platforms array empty.
      this.platforms = [];
    },
  });
});
