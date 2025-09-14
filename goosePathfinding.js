// goosePathfinding.js - lightweight grid builder + A* for geese
(function () {
  if (!window.AFRAME) return;
  const A = AFRAME;
  const KEY = "goose-pathfinding";
  const vec3 = new THREE.Vector3();

  function hash(x, y) {
    return x + "," + y;
  }

  A.registerSystem(KEY, {
    schema: {
      cellSize: { type: "number", default: 2 },
      halfExtent: { type: "number", default: 32 },
      maxHeightDiff: { type: "number", default: 2.5 },
      rebuildOnStart: { type: "boolean", default: true },
    },
    init() {
      this.grid = null; // { cellSize, nodes: Map(hash->{x,y,worldY,walkable}), neighbors:Map(hash->hash[]) }
      this.solidMeshes = [];
      this._built = false;
      if (this.data.rebuildOnStart) setTimeout(() => this.build(), 200); // allow scene solids to exist
    },
    collectSolids() {
      const solids = Array.from(this.sceneEl.querySelectorAll(".solid"));
      this.solidMeshes = solids
        .map((e) => e.getObject3D("mesh"))
        .filter(Boolean);
    },
    build() {
      this.collectSolids();
      const cs = this.data.cellSize;
      const he = this.data.halfExtent;
      const nodes = new Map();
      const ray = new THREE.Raycaster();
      const up = new THREE.Vector3(0, -1, 0);
      const tmp = new THREE.Vector3();
      for (let gx = -he; gx <= he; gx += cs) {
        for (let gz = -he; gz <= he; gz += cs) {
          // sample from above downward to find floor/platform top
          const origin = new THREE.Vector3(gx, 100, gz);
          ray.set(origin, up);
          let hitY = null;
          let min = Infinity;
          for (const mesh of this.solidMeshes) {
            if (!mesh) continue;
            const hits = ray.intersectObject(mesh, true);
            if (hits && hits.length) {
              const h = hits[0];
              if (h.point.y < min) {
                min = h.point.y;
                hitY = h.point.y;
              }
            }
          }
          if (hitY === null) continue; // no floor here
          // Determine walkability: ensure clearance above
          // Simple: always walkable if found
          const key = hash(Math.round(gx / cs), Math.round(gz / cs));
          nodes.set(key, { x: gx, z: gz, worldY: hitY, walkable: true });
        }
      }
      // Build neighbor links (4-way + diagonals if both orthogonals walkable)
      const neighbors = new Map();
      const dirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ];
      nodes.forEach((n, k) => {
        const list = [];
        const cx = Math.round(n.x / cs);
        const cz = Math.round(n.z / cs);
        for (const d of dirs) {
          const nk = hash(cx + d[0], cz + d[1]);
          if (nodes.has(nk)) list.push(nk);
        }
        neighbors.set(k, list);
      });
      this.grid = { cellSize: cs, nodes, neighbors };
      this._built = true;
      console.log("[goose-pathfinding] grid built nodes=", nodes.size);
    },
    worldToCell(x, z) {
      const cs = this.grid.cellSize;
      return { cx: Math.round(x / cs), cz: Math.round(z / cs) };
    },
    nearestNode(x, z) {
      if (!this._built) return null;
      const { cx, cz } = this.worldToCell(x, z);
      const cs = this.grid.cellSize;
      const key = hash(cx, cz);
      if (this.grid.nodes.has(key))
        return { key, node: this.grid.nodes.get(key) };
      // spiral search
      for (let r = 1; r < 6; r++) {
        for (let dx = -r; dx <= r; dx++) {
          for (let dz = -r; dz <= r; dz++) {
            if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
            const k = hash(cx + dx, cz + dz);
            if (this.grid.nodes.has(k))
              return { key: k, node: this.grid.nodes.get(k) };
          }
        }
      }
      return null;
    },
    findPath(start, goal) {
      if (!this._built) return [];
      if (!start || !goal) return [];
      if (start.key === goal.key) return [start.node];
      const open = new Map();
      const closed = new Set();
      const g = new Map();
      const f = new Map();
      const came = new Map();
      const h = (a, b) => {
        const dx = a.x - b.x;
        const dz = a.z - b.z;
        return Math.sqrt(dx * dx + dz * dz);
      };
      open.set(start.key, start.node);
      g.set(start.key, 0);
      f.set(start.key, h(start.node, goal.node));
      while (open.size) {
        // pick lowest f
        let curKey = null;
        let curNode = null;
        let best = Infinity;
        open.forEach((n, k) => {
          const fv = f.get(k);
          if (fv < best) {
            best = fv;
            curKey = k;
            curNode = n;
          }
        });
        if (curKey === goal.key) {
          // reconstruct
          const path = [goal.node];
          let ck = curKey;
          while (came.has(ck)) {
            ck = came.get(ck);
            if (ck !== goal.key) path.push(this.grid.nodes.get(ck));
          }
          path.reverse();
          return path;
        }
        open.delete(curKey);
        closed.add(curKey);
        const neigh = this.grid.neighbors.get(curKey) || [];
        for (const nk of neigh) {
          if (closed.has(nk)) continue;
          const tentative = g.get(curKey) + 1;
          if (!open.has(nk) || tentative < g.get(nk)) {
            came.set(nk, curKey);
            g.set(nk, tentative);
            const node = this.grid.nodes.get(nk);
            f.set(nk, tentative + h(node, goal.node));
            open.set(nk, node);
          }
        }
      }
      return [];
    },
  });

  // Goose brain component: wander when far, chase with path when near.
  A.registerComponent("goose-brain", {
    schema: {
      target: { type: "selector", default: "#rig" },
      wanderRadius: { type: "number", default: 4 },
      wanderInterval: { type: "number", default: 4000 },
      chaseRadius: { type: "number", default: 18 },
      repathInterval: { type: "number", default: 1200 },
      speed: { type: "number", default: 0.9 },
      arriveEpsilon: { type: "number", default: 0.4 },
      debug: { type: "boolean", default: false },
    },
    init() {
      this.sys = this.el.sceneEl.systems[KEY];
      this.mode = "idle";
      this.path = [];
      this.pathIndex = 0;
      this.lastRepath = 0;
      this.lastWander = 0;
      this.tmp = new THREE.Vector3();
      this.tmpT = new THREE.Vector3();
      if (!this.sys) {
        console.warn("[goose-brain] pathfinding system not ready yet");
      }
    },
    pickWanderGoal() {
      const base = this.el.object3D.position;
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * this.data.wanderRadius;
      return { x: base.x + Math.cos(ang) * r, z: base.z + Math.sin(ang) * r };
    },
    computePath(toX, toZ) {
      if (!this.sys || !this.sys._built) return [];
      const s = this.sys.nearestNode(
        this.el.object3D.position.x,
        this.el.object3D.position.z
      );
      const g = this.sys.nearestNode(toX, toZ);
      if (!s || !g) return [];
      return this.sys.findPath(s, g);
    },
    tick(t, dt) {
      if (!this.data.target) return;
      const o3 = this.el.object3D;
      this.data.target.object3D.getWorldPosition(this.tmpT);
      o3.getWorldPosition(this.tmp);
      const dx = this.tmpT.x - this.tmp.x;
      const dz = this.tmpT.z - this.tmp.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < this.data.chaseRadius * this.data.chaseRadius) {
        // chase mode
        if (
          this.mode !== "chase" ||
          t - this.lastRepath > this.data.repathInterval
        ) {
          this.path = this.computePath(this.tmpT.x, this.tmpT.z);
          this.pathIndex = 0;
          this.lastRepath = t;
          this.mode = "chase";
        }
      } else {
        // wander mode
        if (
          this.mode !== "wander" ||
          t - this.lastWander > this.data.wanderInterval ||
          this.pathIndex >= this.path.length
        ) {
          const g = this.pickWanderGoal();
          this.path = this.computePath(g.x, g.z);
          this.pathIndex = 0;
          this.lastWander = t;
          this.mode = "wander";
        }
      }
      if (!this.path || !this.path.length) return;
      const node = this.path[this.pathIndex];
      if (!node) {
        return;
      }
      // Move toward node
      const dirX = node.x - o3.position.x;
      const dirZ = node.z - o3.position.z;
      const d2 = dirX * dirX + dirZ * dirZ;
      if (d2 < this.data.arriveEpsilon * this.data.arriveEpsilon) {
        this.pathIndex++;
        return;
      }
      const d = Math.sqrt(d2);
      const step = (this.data.speed * dt) / 1000;
      const nx = o3.position.x + (dirX / d) * step;
      const nz = o3.position.z + (dirZ / d) * step;
      o3.position.x = nx;
      o3.position.z = nz;
      // Face direction
      o3.rotation.set(0, Math.atan2(dirX, dirZ), 0);
    },
  });
})();
