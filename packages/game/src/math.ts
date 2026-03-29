export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

export const cloneVec3 = (value: Vec3): Vec3 => ({ x: value.x, y: value.y, z: value.z });

export const addVec3 = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

export const subVec3 = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

export const scaleVec3 = (value: Vec3, scalar: number): Vec3 => ({ x: value.x * scalar, y: value.y * scalar, z: value.z * scalar });

export const lengthVec3 = (value: Vec3): number => Math.hypot(value.x, value.y, value.z);

export const distanceVec3 = (a: Vec3, b: Vec3): number => lengthVec3(subVec3(a, b));

export const normalizeVec3 = (value: Vec3): Vec3 => {
  const len = lengthVec3(value);
  if (len <= 0.000001) {
    return vec3();
  }

  return scaleVec3(value, 1 / len);
};

export const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount;

export const wrapAngle = (value: number): number => {
  const tau = Math.PI * 2;
  let wrapped = value % tau;
  if (wrapped > Math.PI) {
    wrapped -= tau;
  } else if (wrapped < -Math.PI) {
    wrapped += tau;
  }
  return wrapped;
};

export const roundTo = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

