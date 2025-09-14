// gridMaterial.js - generates a reusable light gray square grid texture
(function () {
  if (!window.AFRAME) return;
  const A = AFRAME;

  function makeGrid(opts) {
    const size = opts.size || 512; // bigger for crisper lines
    const cell = opts.cell || 64; // pixels per world cell
    const line = opts.line || 3; // line thickness
    const bg = opts.bg || "#cfcfcf";
    const fg = opts.fg || "#8a8a8a";
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = fg;
    ctx.lineWidth = line;
    ctx.beginPath();
    for (let x = 0; x <= size; x += cell) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, size);
    }
    for (let y = 0; y <= size; y += cell) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(size, y + 0.5);
    }
    ctx.stroke();
    return c;
  }

  // We will lazily generate variants keyed by parameter tuple for reuse.
  const CACHE = {};

  function getTexture(params) {
    const key = JSON.stringify(params);
    if (!CACHE[key]) {
      const canvas = makeGrid(params);
      CACHE[key] = canvas.toDataURL("image/png");
    }
    return CACHE[key];
  }

  A.registerComponent("grid-material", {
    schema: {
      cellSize: { type: "number", default: 2 }, // world units per square
      lineThickness: { type: "number", default: 0.12 }, // relative thickness factor (affects pixel canvas selection)
      bgColor: { type: "color", default: "#cfcfcf" },
      lineColor: { type: "color", default: "#8a8a8a" },
      metalness: { type: "number", default: 0.04 },
      roughness: { type: "number", default: 0.92 },
    },
    init() {
      this.apply();
    },
    update() {
      this.apply();
    },
    apply() {
      const mesh = this.el.getObject3D("mesh");
      if (!mesh) {
        this.el.addEventListener("object3dset", (e) => {
          if (e.detail.type === "mesh") this.apply();
        });
        return;
      }
      // Choose canvas params. Pixel cell mapped from desired world cell using a base resolution.
      const pxPerCell = 128; // high-res single cell block
      const linePx = Math.max(
        2,
        Math.round(pxPerCell * this.data.lineThickness * 0.08)
      );
      const url = getTexture({
        size: pxPerCell * 4,
        cell: pxPerCell,
        line: linePx,
        bg: this.data.bgColor,
        fg: this.data.lineColor,
      });
      this.el.setAttribute(
        "material",
        `src:${url}; color:#ffffff; metalness:${this.data.metalness}; roughness:${this.data.roughness}`
      );
      const box = new THREE.Box3().setFromObject(mesh);
      const dim = new THREE.Vector3();
      box.getSize(dim);
      if (mesh.material && mesh.material.map) {
        mesh.material.map.wrapS = mesh.material.map.wrapT =
          THREE.RepeatWrapping;
        const repX = Math.max(1, dim.x / this.data.cellSize);
        const repZ = Math.max(
          1,
          dim.z / this.data.cellSize || dim.y / this.data.cellSize
        );
        mesh.material.map.repeat.set(repX, repZ);
        mesh.material.needsUpdate = true;
      }
    },
  });
})();
