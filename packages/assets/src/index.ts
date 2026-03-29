import { assetManifestSchema, type AssetManifest } from "@descent/shared";

export type AssetKey = "banner" | "crosshair" | "missionCard" | "statusPanel" | "flareIcon" | "reactorAlarm";

export const assetPaths: Record<AssetKey, string> = {
  banner: "/generated/hud-banner.svg",
  crosshair: "/generated/crosshair.svg",
  missionCard: "/generated/mission-card.svg",
  statusPanel: "/generated/status-panel.svg",
  flareIcon: "/generated/flare-icon.svg",
  reactorAlarm: "/generated/reactor-alarm.svg"
};

export const assetLabels: Record<AssetKey, string> = {
  banner: "foundry banner",
  crosshair: "reticle",
  missionCard: "mission briefing card",
  statusPanel: "status panel",
  flareIcon: "flare icon",
  reactorAlarm: "reactor alarm visual"
};

export const assetTone = {
  style: "retro-industrial",
  mood: "high-contrast, practical, and battle-worn",
  palette: {
    background: "#04070f",
    panel: "#111a2d",
    accent: "#ff7a18",
    highlight: "#f4f7fb",
    warning: "#ff3b30",
    cool: "#67d1ff"
  }
} as const;

export function getAssetPath(key: AssetKey) {
  return assetPaths[key];
}

export function getAssetLabel(key: AssetKey) {
  return assetLabels[key];
}

export function buildAssetManifest(): AssetManifest {
  return assetManifestSchema.parse({
    generatedAt: new Date().toISOString(),
    hud: {
      banner: assetPaths.banner,
      crosshair: assetPaths.crosshair
    },
    audio: {
      alarm: "/generated/reactor-alarm.txt",
      flare: "/generated/flare-sfx.txt"
    }
  });
}

export const assetManifest = buildAssetManifest();

export const assetCatalog = {
  version: "1.0.0",
  style: assetTone.style,
  mood: assetTone.mood,
  palette: assetTone.palette,
  uiAssets: {
    banner: getAssetPath("banner"),
    crosshair: getAssetPath("crosshair"),
    missionCard: getAssetPath("missionCard"),
    statusPanel: getAssetPath("statusPanel"),
    flareIcon: getAssetPath("flareIcon")
  },
  warnings: {
    reactorAlarm: getAssetPath("reactorAlarm"),
    flareAudio: assetManifest.audio.flare
  }
};

