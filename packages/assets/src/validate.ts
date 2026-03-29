import { assetCatalog, assetLabels, assetManifest, assetPaths, assetTone } from "./index.js";

function fail(message: string): never {
  throw new Error(`[asset:validate] ${message}`);
}

for (const [key, value] of Object.entries(assetPaths)) {
  if (!value.startsWith("/generated/")) {
    fail(`Asset path ${key} must stay under /generated, received ${value}`);
  }
}

for (const [key, label] of Object.entries(assetLabels)) {
  if (!label.trim()) {
    fail(`Asset label ${key} must not be empty`);
  }
}

if (assetManifest.hud.banner !== assetPaths.banner) {
  fail(`Manifest banner path is out of sync with the asset catalog`);
}

if (assetManifest.hud.crosshair !== assetPaths.crosshair) {
  fail(`Manifest crosshair path is out of sync with the asset catalog`);
}

if (!assetManifest.audio.alarm.startsWith("/generated/") || !assetManifest.audio.flare.startsWith("/generated/")) {
  fail(`Audio assets must be generated placeholders until masters are added`);
}

if (assetCatalog.palette.warning !== "#ff3b30") {
  fail(`Asset tone palette changed unexpectedly`);
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      assetCount: Object.keys(assetPaths).length,
      style: assetTone.style,
      banner: assetManifest.hud.banner
    },
    null,
    2
  )
);

