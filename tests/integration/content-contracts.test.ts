import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  contentCatalog,
  contentManifest,
  emitContentPreviewFile,
  getLevelSummary,
  getMissionBrief,
  levelIndex,
  missionRoute,
  primaryLevel
} from "../../packages/content/src/index.ts";
import { assetManifest } from "../../packages/assets/src/index.ts";
import { defaultControls, defaultLevelId, levelSchema } from "../../packages/shared/src/index.ts";

describe("mission contracts", () => {
  it("keeps the handcrafted mine internally consistent", () => {
    const parsed = levelSchema.parse(primaryLevel);
    const summary = getLevelSummary(parsed);
    const brief = getMissionBrief(parsed);

    expect(parsed.id).toBe(defaultLevelId);
    expect(summary.sectorCount).toBeGreaterThan(0);
    expect(summary.checkpointCount).toBe(parsed.checkpoints.length);
    expect(summary.secretCount).toBe(parsed.secrets.length);
    expect(summary.hasReactorCountdown).toBe(true);
    expect(brief.objectiveChain).toHaveLength(parsed.objectives.length);
    expect(brief.objectiveChain[0]).toMatch(/foundry hub/i);
    expect(missionRoute.at(-1)?.id).toBe("escape");
    expect(levelIndex[defaultLevelId]?.title).toBe(parsed.title);
    expect(contentCatalog.levelIds).toEqual([defaultLevelId]);
    expect(contentManifest.levels[0]?.objectiveCount).toBe(parsed.objectives.length);
  });

  it("describes the flare and mission control defaults the app will bind to", () => {
    expect(defaultControls.flare).toBe("KeyF");
    expect(defaultControls.pause).toBe("Escape");
    expect(assetManifest.hud.banner).toBe("/generated/hud-banner.svg");
    expect(assetManifest.hud.crosshair).toBe("/generated/crosshair.svg");
    expect(assetManifest.audio.alarm).toBe("/generated/reactor-alarm.txt");
  });

  it("emits a preview file that mirrors the content catalog", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "descent-content-"));
    const previewPath = path.join(tempDir, "preview.json");

    emitContentPreviewFile(previewPath);

    const preview = JSON.parse(readFileSync(previewPath, "utf8")) as {
      levelIds: string[];
      missionRoute: Array<{ id: string }>;
      generatedAt: string;
    };

    expect(preview.levelIds).toEqual([defaultLevelId]);
    expect(preview.missionRoute).toHaveLength(primaryLevel.objectives.length);
    expect(Date.parse(preview.generatedAt)).not.toBeNaN();
  });
});

