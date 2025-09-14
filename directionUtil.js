// directionUtil.js - shared forward direction computation with axis remapping
(function () {
  if (!window.AFRAME) return;
  const AXIS_TMP = new THREE.Vector3();
  const FORWARD_TMP = new THREE.Vector3();
  const QUAT_TMP = new THREE.Quaternion();
  const Y_UP = new THREE.Vector3(0, 1, 0);

  // Map a local forward axis string to a world-space direction.
  // baseForward should be world direction of local -Z (A-Frame default forward from getWorldDirection)
  function remapAxis(baseForward, object3D, axisStr) {
    switch (axisStr) {
      case "-z":
        return baseForward;
      case "+z":
        return baseForward.clone().multiplyScalar(-1);
      case "+x": {
        // rotate +90 yaw
        const f = baseForward;
        return new THREE.Vector3(-f.z, f.y, f.x);
      }
      case "-x": {
        const f = baseForward;
        return new THREE.Vector3(f.z, f.y, -f.x);
      }
      case "+y": // treat as forward projected horizontally
      case "-y":
        return baseForward; // fallback
      default:
        return baseForward;
    }
  }

  AFRAME.utils = AFRAME.utils || {};
  AFRAME.utils.directionUtil = {
    getForward: function (el, axis) {
      // baseForward = world direction for local -Z
      el.object3D.getWorldDirection(FORWARD_TMP); // mutated
      return remapAxis(
        FORWARD_TMP.clone(),
        el.object3D,
        axis || "-z"
      ).normalize();
    },
  };
})();
