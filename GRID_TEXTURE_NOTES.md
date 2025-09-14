# Grid Texture Notes
All platforms, base, and future walls now share a generated light gray grid texture via the `grid-material` component.

## Component: grid-material
Schema:
- `scaleRepeat` (number, default 4): Approximate world units per texture repeat (auto-quantized).
- `metalness` (number): PBR metalness.
- `roughness` (number): PBR roughness.

## Apply to Any Entity
```
<a-entity geometry="primitive: box; width:4; height:3; depth:0.3" grid-material="scaleRepeat:2"></a-entity>
```

The texture is procedurally generated (canvas) at startup; no external assets needed.

## Tweaking Line / Cell Size
Edit `gridMaterial.js` function `makeGrid` and adjust:
- `cell`: pixel size of each square (default 32)
- `line`: stroke thickness in pixels
- `bg`: light gray background color
- `fg`: darker grid line color

After changes, reload the page to regenerate the texture.
