const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const fpsEl = document.getElementById('fps');
const statusEl = document.getElementById('status');
const flareEl = document.getElementById('flareState');

const W = canvas.width;
const H = canvas.height;
const keys = new Set();

const player = {
  x: 0,
  y: 0,
  z: 0,
  yaw: 0,
  pitch: 0,
  roll: 0,
  speed: 16,
  radius: 0.5,
  health: 100,
};

const stars = Array.from({ length: 180 }, () => ({
  angle: Math.random() * Math.PI * 2,
  depth: Math.random() * 220 + 10,
  y: (Math.random() - 0.5) * 140,
  size: Math.random() * 2 + 0.5,
}));

const shots = [];
const enemies = Array.from({ length: 16 }, (_, i) => ({
  z: -40 - i * 35,
  angle: Math.random() * Math.PI * 2,
  radius: 8 + Math.random() * 6,
  hp: 2,
  pulse: Math.random() * 100,
}));
const flares = [];
let flareAmmo = 8;
let score = 0;
let time = 0;
let lastFrame = performance.now();
let frameCount = 0;
let fpsTimer = 0;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function wrapAngle(a) {
  while (a < -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
}

document.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key === ' ') {
    e.preventDefault();
    fireShot();
  }
  if (e.key.toLowerCase() === 'f') {
    deployFlare();
  }
});

document.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

function fireShot() {
  shots.push({
    x: player.x,
    y: player.y,
    z: player.z,
    yaw: player.yaw,
    pitch: player.pitch,
    life: 1.4,
  });
}

function deployFlare() {
  if (flareAmmo <= 0) return;
  flareAmmo -= 1;
  flares.push({ x: player.x, y: player.y, z: player.z, life: 6.5, base: 1.0 });
}

function project(x, y, z) {
  const dz = z - player.z;
  const dx = x - player.x;
  const dy = y - player.y;

  const cy = Math.cos(-player.yaw), sy = Math.sin(-player.yaw);
  let rx = dx * cy - dz * sy;
  let rz = dx * sy + dz * cy;

  const cp = Math.cos(-player.pitch), sp = Math.sin(-player.pitch);
  const ry = dy * cp - rz * sp;
  rz = dy * sp + rz * cp;

  if (rz > -0.2) return null;
  const fov = 420;
  const sx = W * 0.5 + (rx / -rz) * fov;
  const sy2 = H * 0.5 + (ry / -rz) * fov;
  return { sx, sy: sy2, scale: clamp(420 / (-rz), 0, 8), depth: -rz };
}

function update(dt) {
  time += dt;

  const turnSpeed = 1.7;
  const lookSpeed = 1.3;
  if (keys.has('arrowleft')) player.yaw += turnSpeed * dt;
  if (keys.has('arrowright')) player.yaw -= turnSpeed * dt;
  if (keys.has('arrowup')) player.pitch = clamp(player.pitch + lookSpeed * dt, -0.8, 0.8);
  if (keys.has('arrowdown')) player.pitch = clamp(player.pitch - lookSpeed * dt, -0.8, 0.8);

  let fwd = 0;
  let strafe = 0;
  let rise = 0;
  if (keys.has('w')) fwd += 1;
  if (keys.has('s')) fwd -= 1;
  if (keys.has('q')) strafe -= 1;
  if (keys.has('e')) strafe += 1;
  if (keys.has('a')) rise += 1;
  if (keys.has('d')) rise -= 1;

  const move = player.speed * dt;
  const c = Math.cos(player.yaw), s = Math.sin(player.yaw);
  player.x += (fwd * s + strafe * c) * move;
  player.z += (fwd * c - strafe * s) * -move;
  player.y += rise * move;

  player.y = clamp(player.y, -35, 35);

  for (const shot of shots) {
    const speed = 70;
    shot.x += Math.sin(shot.yaw) * speed * dt;
    shot.z += Math.cos(shot.yaw) * -speed * dt;
    shot.y += Math.sin(shot.pitch) * speed * dt;
    shot.life -= dt;
  }

  for (const flare of flares) flare.life -= dt;

  for (const enemy of enemies) {
    enemy.pulse += dt * 4;
    enemy.z += 8 * dt;
    enemy.angle += dt * 0.6;
    if (enemy.z > player.z + 14) {
      enemy.z = player.z - (160 + Math.random() * 220);
      enemy.angle = Math.random() * Math.PI * 2;
      enemy.radius = 7 + Math.random() * 8;
      enemy.hp = 2;
    }
  }

  for (const shot of shots) {
    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      const ex = Math.cos(enemy.angle) * enemy.radius;
      const ey = Math.sin(enemy.angle * 2.2) * 3;
      const dx = shot.x - ex;
      const dy = shot.y - ey;
      const dz = shot.z - enemy.z;
      if (dx * dx + dy * dy + dz * dz < 16) {
        enemy.hp -= 1;
        shot.life = 0;
        if (enemy.hp <= 0) {
          score += 100;
          enemy.z = player.z - (200 + Math.random() * 300);
          enemy.hp = 2;
        }
      }
    }
  }

  shots.splice(0, shots.length, ...shots.filter((s) => s.life > 0));
  flares.splice(0, flares.length, ...flares.filter((f) => f.life > 0));

  flareEl.textContent = `Flares: ${flareAmmo}`;
  statusEl.innerHTML = `Hull ${player.health}% · Score ${score} · <span class="warning">flare = F</span>`;
}

function drawTunnel() {
  ctx.fillStyle = '#020309';
  ctx.fillRect(0, 0, W, H);

  const segments = 56;
  for (let i = segments; i >= 1; i--) {
    const depth = i * 9;
    const z = player.z - depth;
    const glow = flares.reduce((acc, f) => {
      const dz = Math.abs(f.z - z);
      return acc + Math.max(0, (f.life / 6.5) * (1 - dz / 90));
    }, 0);
    const p = project(0, 0, z);
    if (!p) continue;
    const radius = (120 / depth) * 130;
    const ringHue = 205 + (i % 7) * 5;
    const alpha = clamp(0.08 + glow * 0.25, 0.05, 0.55);
    ctx.strokeStyle = `hsla(${ringHue}, 90%, ${30 + i}%, ${alpha})`;
    ctx.lineWidth = clamp(3.5 * p.scale, 0.2, 6);
    ctx.beginPath();
    ctx.ellipse(p.sx, p.sy, radius, radius * 0.7, time * 0.1, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const s of stars) {
    const z = player.z - s.depth;
    const x = Math.cos(s.angle + time * 0.1) * 60;
    const p = project(x, s.y, z);
    if (!p) continue;
    ctx.globalAlpha = clamp(p.scale * 0.2, 0.05, 0.8);
    ctx.fillStyle = '#8cc8ff';
    ctx.fillRect(p.sx, p.sy, s.size * p.scale, s.size * p.scale);
    ctx.globalAlpha = 1;
  }
}

function drawEntities() {
  for (const flare of flares) {
    const p = project(flare.x, flare.y, flare.z);
    if (!p) continue;
    const life01 = flare.life / 6.5;
    const r = 26 * p.scale * (0.7 + (1 - life01));
    const grad = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r);
    grad.addColorStop(0, `rgba(255, 195, 120, ${0.9 * life01})`);
    grad.addColorStop(0.4, `rgba(255, 110, 35, ${0.5 * life01})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const enemy of enemies) {
    const ex = Math.cos(enemy.angle) * enemy.radius;
    const ey = Math.sin(enemy.angle * 2.2) * 3;
    const p = project(ex, ey, enemy.z);
    if (!p) continue;
    const sz = clamp(28 * p.scale * (1 + Math.sin(enemy.pulse) * 0.2), 2, 60);
    ctx.fillStyle = enemy.hp > 1 ? 'rgba(255,55,55,0.82)' : 'rgba(255,180,80,0.9)';
    ctx.beginPath();
    ctx.moveTo(p.sx, p.sy - sz);
    ctx.lineTo(p.sx + sz * 0.8, p.sy);
    ctx.lineTo(p.sx, p.sy + sz);
    ctx.lineTo(p.sx - sz * 0.8, p.sy);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(90,255,220,.9)';
  ctx.lineWidth = 1.5;
  for (const shot of shots) {
    const p = project(shot.x, shot.y, shot.z);
    if (!p) continue;
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, clamp(4 * p.scale, 1, 6), 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(120,255,220,.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 12, H / 2);
  ctx.lineTo(W / 2 + 12, H / 2);
  ctx.moveTo(W / 2, H / 2 - 12);
  ctx.lineTo(W / 2, H / 2 + 12);
  ctx.stroke();
}

function frame(now) {
  const dt = Math.min(0.033, (now - lastFrame) / 1000);
  lastFrame = now;

  update(dt);
  drawTunnel();
  drawEntities();

  frameCount += 1;
  fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    fpsEl.textContent = `FPS ${Math.round(frameCount / fpsTimer)}`;
    frameCount = 0;
    fpsTimer = 0;
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
