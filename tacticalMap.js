// tacticalMap.js - Enhanced tactical map for exciting goose chases
(function () {
  if (!window.AFRAME) return;
  const A = AFRAME;

  A.registerComponent("tactical-map", {
    schema: {
      size: { type: "number", default: 60 },
      theme: { type: "string", default: "industrial" },
      obstacleDensity: { type: "number", default: 0.7 },
      platformCount: { type: "int", default: 8 },
      wallCount: { type: "int", default: 12 },
      coverCount: { type: "int", default: 15 }
    },

    init() {
      this.buildTacticalArena();
    },

    buildTacticalArena() {
      const size = this.data.size;
      const halfSize = size / 2;

      // Main arena floor
      this.createFloor(size);
      
      // Perimeter walls with gaps for entry/exit
      this.createPerimeterWalls(size);
      
      // Central structures
      this.createCentralStructures();
      
      // Elevated platforms
      this.createElevatedPlatforms();
      
      // Cover elements (crates, barriers, etc.)
      this.createCoverElements();
      
      // Chokepoints and narrow passages
      this.createChokepoints();
      
      // Spawn points for geese
      this.createSpawnPoints();
    },

    createFloor(size) {
      // Floor intentionally removed per request (open void). Keep method in case other logic calls it.
      // If needed later, reintroduce a ground plane here.
    },

    createPerimeterWalls(size) {
      const half = size / 2;
      const height = 4;
      const thickness = 0.8;
      const gap = 10; // central opening width per side

      // Helper to spawn two wall segments with a centered gap along an axis
      const makeSide = (axis, constantVal, alongLength, isHorizontal) => {
        // alongLength is total width available (size)
        const seg = (alongLength - gap) / 2;
        // First segment
        const wallA = document.createElement('a-entity');
        const wallB = document.createElement('a-entity');
        if (isHorizontal) {
          wallA.setAttribute('geometry', `primitive: box; width:${seg}; height:${height}; depth:${thickness}`);
          wallA.setAttribute('position', `${-half + seg/2} ${height/2} ${constantVal}`);
          wallB.setAttribute('geometry', `primitive: box; width:${seg}; height:${height}; depth:${thickness}`);
          wallB.setAttribute('position', `${half - seg/2} ${height/2} ${constantVal}`);
        } else {
          wallA.setAttribute('geometry', `primitive: box; width:${thickness}; height:${height}; depth:${seg}`);
          wallA.setAttribute('position', `${constantVal} ${height/2} ${-half + seg/2}`);
          wallB.setAttribute('geometry', `primitive: box; width:${thickness}; height:${height}; depth:${seg}`);
          wallB.setAttribute('position', `${constantVal} ${height/2} ${half - seg/2}`);
        }
        [wallA, wallB].forEach(w => {
          w.setAttribute('material', 'color:#3a3a3a; roughness:0.8; metalness:0.1; emissive:#1a1a1a; emissiveIntensity:0.1');
          w.classList.add('solid');
          this.el.appendChild(w);
        });
      };

      // North (positive Z) & South (negative Z) horizontal walls
      makeSide('z', half, size, true);   // North
      makeSide('z', -half, size, true);  // South
      // East (positive X) & West (negative X) vertical walls
      makeSide('x', half, size, false);  // East
      makeSide('x', -half, size, false); // West

      // Player spawn now handled by player-spawn-center component.
    },

    createCentralStructures() {
      // Central command platform
      const command = document.createElement("a-entity");
      command.setAttribute("geometry", "primitive: box; width:12; height:0.4; depth:12");
      command.setAttribute("position", "0 2 0");
      command.setAttribute("grid-material", "cellSize:1.5; lineThickness:0.15; bgColor:#4a4a4a; lineColor:#666666; roughness:0.85; metalness:0.15");
  command.classList.add("solid");
  this.el.appendChild(command);

      // Ramps to central platform
      this.createRamp(-6, 0, 0, 4, 2, 0.3, 0); // West ramp
      this.createRamp(6, 0, 0, 4, 2, 0.3, 180); // East ramp
      this.createRamp(0, 0, -6, 4, 2, 0.3, 90); // South ramp
      this.createRamp(0, 0, 6, 4, 2, 0.3, 270); // North ramp

      // Central pillar
      const pillar = document.createElement("a-entity");
      pillar.setAttribute("geometry", "primitive: cylinder; radius:1.5; height:6");
      pillar.setAttribute("position", "0 3 0");
      pillar.setAttribute("material", "color:#2a2a2a; roughness:0.9; metalness:0.05");
  pillar.classList.add("solid");
  this.el.appendChild(pillar);
    },

    createRamp(x, y, z, width, height, depth, rotation) {
      const ramp = document.createElement("a-entity");
      ramp.setAttribute("geometry", `primitive: box; width:${width}; height:${depth}; depth:${height}`);
      ramp.setAttribute("position", `${x} ${y + height/2} ${z}`);
      ramp.setAttribute("rotation", `${rotation} 0 0`);
      ramp.setAttribute("grid-material", "cellSize:1; lineThickness:0.1; bgColor:#3a3a3a; lineColor:#555555; roughness:0.8; metalness:0.1");
  ramp.classList.add("solid");
  this.el.appendChild(ramp);
    },

    createElevatedPlatforms() {
      const platforms = [
        { x: -20, y: 3, z: 15, w: 8, d: 6, rot: 0 },
        { x: 20, y: 3, z: 15, w: 8, d: 6, rot: 0 },
        { x: -20, y: 3, z: -15, w: 8, d: 6, rot: 0 },
        { x: 20, y: 3, z: -15, w: 8, d: 6, rot: 0 },
        { x: -15, y: 5, z: 0, w: 6, d: 8, rot: 0 },
        { x: 15, y: 5, z: 0, w: 6, d: 8, rot: 0 },
        { x: 0, y: 6, z: 20, w: 10, d: 4, rot: 0 },
        { x: 0, y: 6, z: -20, w: 10, d: 4, rot: 0 }
      ];

      platforms.forEach((p, index) => {
        const platform = document.createElement("a-entity");
        platform.setAttribute("geometry", `primitive: box; width:${p.w}; height:0.4; depth:${p.d}`);
        platform.setAttribute("position", `${p.x} ${p.y} ${p.z}`);
        platform.setAttribute("rotation", `0 ${p.rot} 0`);
        platform.setAttribute("grid-material", "cellSize:1.5; lineThickness:0.12; bgColor:#4a4a4a; lineColor:#666666; roughness:0.85; metalness:0.15");
  platform.classList.add("solid");
  this.el.appendChild(platform);

        // Add ramps to some platforms
        if (index < 4) {
          this.createRamp(p.x, 0, p.z + (p.z > 0 ? -4 : 4), 3, p.y, 0.3, p.z > 0 ? 0 : 180);
        }
      });
    },

    createCoverElements() {
      // Crate stacks
      const crates = [
        { x: -12, z: 8, count: 3 },
        { x: 12, z: 8, count: 3 },
        { x: -12, z: -8, count: 3 },
        { x: 12, z: -8, count: 3 },
        { x: -8, z: 12, count: 2 },
        { x: 8, z: 12, count: 2 },
        { x: -8, z: -12, count: 2 },
        { x: 8, z: -12, count: 2 }
      ];

      crates.forEach(crate => {
        for (let i = 0; i < crate.count; i++) {
          const box = document.createElement("a-entity");
          box.setAttribute("geometry", "primitive: box; width:1.5; height:1.5; depth:1.5");
          box.setAttribute("position", `${crate.x + (Math.random() - 0.5) * 2} ${0.75 + i * 1.5} ${crate.z + (Math.random() - 0.5) * 2}`);
          box.setAttribute("rotation", `0 ${Math.random() * 360} 0`);
          box.setAttribute("material", "color:#8B4513; roughness:0.9; metalness:0.05");
          box.classList.add("solid");
          this.el.appendChild(box);
        }
      });

      // Barrier walls
      const barriers = [
        { x: -18, z: 0, w: 0.3, h: 2, d: 8, rot: 0 },
        { x: 18, z: 0, w: 0.3, h: 2, d: 8, rot: 0 },
        { x: 0, z: 18, w: 8, h: 2, d: 0.3, rot: 0 },
        { x: 0, z: -18, w: 8, h: 2, d: 0.3, rot: 0 },
        { x: -10, z: 10, w: 0.3, h: 1.5, d: 4, rot: 45 },
        { x: 10, z: 10, w: 0.3, h: 1.5, d: 4, rot: -45 },
        { x: -10, z: -10, w: 0.3, h: 1.5, d: 4, rot: -45 },
        { x: 10, z: -10, w: 0.3, h: 1.5, d: 4, rot: 45 }
      ];

      barriers.forEach(barrier => {
        const wall = document.createElement("a-entity");
        wall.setAttribute("geometry", `primitive: box; width:${barrier.w}; height:${barrier.h}; depth:${barrier.d}`);
        wall.setAttribute("position", `${barrier.x} ${barrier.h/2} ${barrier.z}`);
        wall.setAttribute("rotation", `0 ${barrier.rot} 0`);
        wall.setAttribute("material", "color:#555555; roughness:0.8; metalness:0.1");
  wall.classList.add("solid");
  this.el.appendChild(wall);
      });
    },

    createChokepoints() {
      // Narrow passages between structures
      const passages = [
        { x: -6, z: 0, w: 2, h: 3, d: 0.3, rot: 0 }, // West chokepoint
        { x: 6, z: 0, w: 2, h: 3, d: 0.3, rot: 0 },  // East chokepoint
        { x: 0, z: -6, w: 0.3, h: 3, d: 2, rot: 0 }, // South chokepoint
        { x: 0, z: 6, w: 0.3, h: 3, d: 2, rot: 0 }   // North chokepoint
      ];

      passages.forEach(passage => {
        const wall = document.createElement("a-entity");
        wall.setAttribute("geometry", `primitive: box; width:${passage.w}; height:${passage.h}; depth:${passage.d}`);
        wall.setAttribute("position", `${passage.x} ${passage.h/2} ${passage.z}`);
        wall.setAttribute("rotation", `0 ${passage.rot} 0`);
        wall.setAttribute("material", "color:#666666; roughness:0.7; metalness:0.2; emissive:#333333; emissiveIntensity:0.1");
  wall.classList.add("solid");
  this.el.appendChild(wall);
      });
    },

    createSpawnPoints() {
      // Strategic spawn points around the map
      const spawnPoints = [
        { x: -25, y: 0.5, z: 25 },
        { x: 25, y: 0.5, z: 25 },
        { x: -25, y: 0.5, z: -25 },
        { x: 25, y: 0.5, z: -25 },
        { x: -20, y: 3.5, z: 15 },
        { x: 20, y: 3.5, z: 15 },
        { x: -20, y: 3.5, z: -15 },
        { x: 20, y: 3.5, z: -15 },
        { x: -15, y: 5.5, z: 0 },
        { x: 15, y: 5.5, z: 0 },
        { x: 0, y: 6.5, z: 20 },
        { x: 0, y: 6.5, z: -20 },
        { x: -12, y: 0.5, z: 8 },
        { x: 12, y: 0.5, z: 8 },
        { x: -12, y: 0.5, z: -8 },
        { x: 12, y: 0.5, z: -8 },
        { x: -8, y: 0.5, z: 12 },
        { x: 8, y: 0.5, z: 12 },
        { x: -8, y: 0.5, z: -12 },
        { x: 8, y: 0.5, z: -12 }
      ];

      spawnPoints.forEach((spawn, index) => {
        const sp = document.createElement("a-entity");
        sp.setAttribute("position", `${spawn.x} ${spawn.y} ${spawn.z}`);
        sp.setAttribute("class", "enemy-spawn");
        sp.setAttribute("geometry", "primitive:ring; radiusInner:0.3; radiusOuter:0.5; segmentsTheta:24");
        sp.setAttribute("material", "color:#3eff8c; emissive:#0a391b; opacity:0.6; transparent:true");
        this.el.appendChild(sp);
      });
    }
  });

  // Enhanced lighting system for the tactical map
  A.registerComponent("tactical-lighting", {
    init() {
      this.setupLighting();
    },

    setupLighting() {
      // Main directional light
      const mainLight = document.createElement("a-entity");
      mainLight.setAttribute("light", "type: directional; intensity: 0.8; color: #ffffff; castShadow: true");
      mainLight.setAttribute("position", "10 20 10");
      this.el.appendChild(mainLight);

      // Ambient fill light
      const ambientLight = document.createElement("a-entity");
      ambientLight.setAttribute("light", "type: hemisphere; intensity: 0.4; color: #87CEEB; groundColor: #2a2a2a");
      this.el.appendChild(ambientLight);

      // Strategic point lights
      const pointLights = [
        { x: 0, y: 8, z: 0, color: "#ffaa00", intensity: 0.6 },
        { x: -20, y: 6, z: 15, color: "#ff6b6b", intensity: 0.4 },
        { x: 20, y: 6, z: 15, color: "#4ecdc4", intensity: 0.4 },
        { x: -20, y: 6, z: -15, color: "#45b7d1", intensity: 0.4 },
        { x: 20, y: 6, z: -15, color: "#96ceb4", intensity: 0.4 }
      ];

      pointLights.forEach(light => {
        const pointLight = document.createElement("a-entity");
        pointLight.setAttribute("light", `type: point; intensity: ${light.intensity}; color: ${light.color}; distance: 25; decay: 2`);
        pointLight.setAttribute("position", `${light.x} ${light.y} ${light.z}`);
        this.el.appendChild(pointLight);
      });
    }
  });

})();
