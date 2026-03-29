import { describe, expect, it } from "vitest";
import { assetCatalog, assetManifest, assetPaths, assetTone, getAssetPath } from "./index.js";

describe("asset catalog", () => {
  it("keeps generated paths centralized", () => {
    expect(getAssetPath("banner")).toBe(assetPaths.banner);
    expect(assetCatalog.uiAssets.missionCard).toBe("/generated/mission-card.svg");
  });

  it("keeps the tone and manifest aligned", () => {
    expect(assetManifest.hud.banner).toBe(assetPaths.banner);
    expect(assetTone.style).toBe("retro-industrial");
    expect(assetCatalog.palette.accent).toBe("#ff7a18");
  });
});

