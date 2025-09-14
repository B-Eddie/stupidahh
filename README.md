# Web VR Shooter Prototype

## A-Frame Loading Strategy
Dynamic loader in `index.html` tries multiple CDNs:
1. unpkg
2. jsDelivr
3. cdnjs

If all fail, you must host A-Frame locally.

### Host Locally
Download and place in `vendor/` (create folder):
```
curl -L https://aframe.io/releases/1.5.0/aframe.min.js -o vendor/aframe.min.js
curl -L https://unpkg.com/aframe-extras@6.1.1/dist/aframe-extras.min.js -o vendor/aframe-extras.min.js
```
Then (edit near the loader) short-circuit with:
```
if (!navigator.onLine) { /* inject local script tags before loadNext() */ }
```
Or simply replace dynamic logic with static:
```
<script src="vendor/aframe.min.js"></script>
<script src="vendor/aframe-extras.min.js"></script>
```

## Fallback Locomotion
If `aframe-extras` fails, a `basic-locomotion` component is registered automatically. Attach it to an entity (e.g., the rig):
```
<a-entity id="rig" basic-locomotion></a-entity>
```
Controls: WASD relative to camera facing.

## Next Steps
- Implement enemy spawning + mark hittable
- Record player transform & shot events each frame (timestamped)
- Replay ghost by interpolating stored frames & reproducing shots
- Distinguish ghost shots (color) so player dodges them

## Debug Tips
Open console:
```
AFRAME && AFRAME.version
```
If undefined after a few seconds, network/CSP blocked.

## Troubleshooting Renderer Error
If you see errors like `Cannot set properties of undefined (setting 'useLegacyLights')`:
1. Verify file integrity:
```
shasum -a 256 vendor/aframe.min.js
```
(Compare against official download.)
2. Try a different A-Frame version (e.g. 1.4.2):
```
curl -L https://aframe.io/releases/1.4.2/aframe.min.js -o vendor/aframe.min.js
```
3. Test `minimal-test.html`. If that fails the file is corrupt or environment blocks execution.
4. Disable custom components temporarily (comment out their script tags) to rule out side effects.
5. Remove `renderer` attribute in `<a-scene>` to let defaults apply; reintroduce gradually.

## License
Internal prototype.
