import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assetCatalog, assetManifest } from "./index.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(dir, "..", "generated");

await mkdir(outDir, { recursive: true });

const files: Record<string, string> = {
  "hud-banner.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 220">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#050914"/>
      <stop offset="100%" stop-color="#142036"/>
    </linearGradient>
    <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ff7a18" stop-opacity="0.15"/>
      <stop offset="50%" stop-color="#ff7a18" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#ff7a18" stop-opacity="0.15"/>
    </linearGradient>
    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M32 0H0V32" fill="none" stroke="#8ea3bf" stroke-opacity="0.08" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="960" height="220" rx="32" fill="url(#bg)"/>
  <rect x="0" y="0" width="960" height="220" rx="32" fill="url(#grid)"/>
  <path d="M52 156 C120 106, 184 88, 250 102 S382 154, 452 72 S620 48, 704 114 S834 154, 906 88" fill="none" stroke="url(#glow)" stroke-width="14" stroke-linecap="round"/>
  <path d="M56 158 C124 108, 188 90, 252 104 S384 156, 454 74 S622 50, 706 116 S836 156, 908 90" fill="none" stroke="#ff7a18" stroke-width="4" stroke-linecap="round"/>
  <circle cx="120" cy="118" r="10" fill="#67d1ff" fill-opacity="0.45"/>
  <circle cx="716" cy="102" r="10" fill="#67d1ff" fill-opacity="0.35"/>
  <text x="56" y="104" fill="#f4f7fb" font-size="62" font-family="monospace" font-weight="700">CRIMSON FOUNDRY</text>
  <text x="58" y="146" fill="#8ea3bf" font-size="24" font-family="monospace">6DOF INFILTRATION PROTOCOL // REACTOR BREACH RUN</text>
  <text x="58" y="182" fill="#ff7a18" font-size="18" font-family="monospace">F FLARE READY  |  KEYS ACTIVE  |  ESCAPE TIMELINE LOCKED</text>
</svg>`,
  "crosshair.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs>
    <radialGradient id="r" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ff7a18" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#ff7a18" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="60" cy="60" r="36" fill="url(#r)"/>
  <circle cx="60" cy="60" r="18" fill="none" stroke="#ff7a18" stroke-width="4"/>
  <circle cx="60" cy="60" r="6" fill="#f4f7fb"/>
  <path d="M60 4v24M60 92v24M4 60h24M92 60h24" stroke="#f4f7fb" stroke-width="6" stroke-linecap="round"/>
</svg>`,
  "mission-card.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 420">
  <defs>
    <linearGradient id="card" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#101827"/>
      <stop offset="100%" stop-color="#1b2c42"/>
    </linearGradient>
  </defs>
  <rect width="720" height="420" rx="28" fill="url(#card)"/>
  <rect x="26" y="26" width="668" height="368" rx="18" fill="none" stroke="#ff7a18" stroke-opacity="0.5" stroke-width="2" stroke-dasharray="10 8"/>
  <text x="50" y="88" fill="#f4f7fb" font-size="36" font-family="monospace">MISSION BRIEF</text>
  <text x="50" y="138" fill="#8ea3bf" font-size="20" font-family="monospace">INFILTRATE THE CRIMSON FOUNDRY, ARM THE REACTOR, ESCAPE.</text>
  <path d="M50 172h620" stroke="#2f445f" stroke-width="2"/>
  <text x="50" y="222" fill="#67d1ff" font-size="18" font-family="monospace">KEYS: AZURE, CRIMSON</text>
  <text x="50" y="258" fill="#67d1ff" font-size="18" font-family="monospace">F WEAPON: FLARE</text>
  <text x="50" y="294" fill="#67d1ff" font-size="18" font-family="monospace">OBJECTIVES: HUB, LOCKS, REACTOR, ESCAPE</text>
  <text x="50" y="350" fill="#ff7a18" font-size="18" font-family="monospace">RETRO INDUSTRIAL // ORIGINAL-INSPIRED PRESENTATION</text>
</svg>`,
  "status-panel.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 260">
  <rect width="520" height="260" rx="22" fill="#0d1523"/>
  <path d="M24 34h472v192H24z" fill="none" stroke="#67d1ff" stroke-opacity="0.18" stroke-width="2"/>
  <path d="M24 34h472v192H24z" fill="none" stroke="#ff7a18" stroke-opacity="0.35" stroke-width="8" stroke-linejoin="round"/>
  <text x="42" y="82" fill="#f4f7fb" font-size="28" font-family="monospace">STATUS PANEL</text>
  <text x="42" y="124" fill="#8ea3bf" font-size="16" font-family="monospace">SHIELDS / ENERGY / AMMO / FLARES</text>
  <text x="42" y="160" fill="#67d1ff" font-size="16" font-family="monospace">REACTOR: ARMED</text>
  <text x="42" y="190" fill="#ff3b30" font-size="16" font-family="monospace">ESCAPE TIMER: ACTIVE</text>
</svg>`,
  "flare-icon.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <radialGradient id="f" cx="50%" cy="38%" r="60%">
      <stop offset="0%" stop-color="#fff2b0"/>
      <stop offset="40%" stop-color="#ff7a18"/>
      <stop offset="100%" stop-color="#ff3b30"/>
    </radialGradient>
  </defs>
  <rect x="54" y="18" width="20" height="86" rx="10" fill="#f4f7fb" fill-opacity="0.16"/>
  <path d="M64 10 C82 28, 96 46, 96 68 C96 93, 82 114, 64 118 C46 114, 32 93, 32 68 C32 46, 46 28, 64 10 Z" fill="url(#f)"/>
</svg>`,
  "reactor-alarm.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 200">
  <defs>
    <linearGradient id="alarmBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1a0606"/>
      <stop offset="100%" stop-color="#2a0c0c"/>
    </linearGradient>
  </defs>
  <rect width="800" height="200" rx="24" fill="url(#alarmBg)"/>
  <circle cx="130" cy="100" r="54" fill="#ff3b30" fill-opacity="0.22"/>
  <path d="M130 48v104M78 100h104" stroke="#ff3b30" stroke-width="12" stroke-linecap="round"/>
  <text x="226" y="90" fill="#f4f7fb" font-size="44" font-family="monospace">REACTOR ALARM</text>
  <text x="226" y="132" fill="#ff7a18" font-size="22" font-family="monospace">BREACH IMMINENT // EVACUATE THE MINE</text>
</svg>`
};

await Promise.all(Object.entries(files).map(([name, content]) => writeFile(path.join(outDir, name), content, "utf8")));

await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(assetManifest, null, 2), "utf8");
await writeFile(path.join(outDir, "catalog.json"), JSON.stringify(assetCatalog, null, 2), "utf8");
await writeFile(
  path.join(outDir, "ui-kit.json"),
  JSON.stringify(
    {
      generatedAt: assetManifest.generatedAt,
      tone: assetCatalog.style,
      files: Object.keys(files)
    },
    null,
    2
  ),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      status: "ok",
      generated: [...Object.keys(files), "manifest.json", "catalog.json", "ui-kit.json"],
      style: assetCatalog.style
    },
    null,
    2
  )
);

